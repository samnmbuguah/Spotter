from django.http import JsonResponse, FileResponse, HttpResponse
from django.db import connection, transaction
from django.views.decorators.csrf import csrf_exempt, csrf_protect, get_token, ensure_csrf_cookie
from django.middleware.csrf import get_token as csrf_get_token
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.shortcuts import get_object_or_404
from django.conf import settings
import os
import json
from rest_framework import generics, permissions, status, serializers
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
from rest_framework.decorators import api_view, permission_classes, authentication_classes
from rest_framework_simplejwt.tokens import RefreshToken
from django.views.decorators.http import require_http_methods
from .permissions import IsDriver, IsOwnerOrReadOnly
from .models import User


def health_check(request):
    """
    Comprehensive health check endpoint for the Spotter application.
    Returns status of database, cache, and external services.
    """
    from django.db import connection
    from django.utils import timezone

    health_status = {
        'status': 'healthy',
        'timestamp': timezone.now().isoformat(),
        'services': {}
    }

    # Database health check
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            # Detect database type from connection
            db_vendor = connection.vendor
            health_status['services']['database'] = {
                'status': 'healthy',
                'type': db_vendor
            }
    except Exception as e:
        health_status['services']['database'] = {
            'status': 'unhealthy',
            'error': str(e)
        }

    # External services (Google Maps API)
    try:
        # This is a basic check - in production you might want to make an actual API call
        api_key = os.getenv('REACT_APP_GOOGLE_MAPS_API_KEY') or os.getenv('GOOGLE_MAPS_API_KEY')
        
        if api_key:
            health_status['services']['google_maps_api'] = {
                'status': 'configured',
                'api_key_present': True
            }
        else:
            health_status['services']['google_maps_api'] = {
                'status': 'not_configured',
                'error': 'API key not found'
            }
    except Exception as e:
        health_status['services']['google_maps_api'] = {
            'status': 'error',
            'error': str(e)
        }

    # Return appropriate HTTP status code
    http_status = 200 if health_status['status'] == 'healthy' else 503
    return JsonResponse(health_status, status=http_status)


import logging
import json
from rest_framework.views import APIView
from rest_framework import status, permissions, generics, mixins, viewsets
from rest_framework.decorators import api_view, action
from rest_framework.response import Response
from rest_framework.parsers import JSONParser, MultiPartParser
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from .models import User
from .serializers import UserSerializer

logger = logging.getLogger(__name__)

@method_decorator(csrf_exempt, name='dispatch')
class CreateUserView(APIView):
    """Create a new user in the system."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []  # No authentication required for registration
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    
    def dispatch(self, request, *args, **kwargs):
        # Bypass CSRF protection for this view
        setattr(request, '_dont_enforce_csrf_checks', True)
        request.csrf_processing_done = True  # Tell Django CSRF middleware to skip this request
        return super().dispatch(request, *args, **kwargs)
    
    def get_serializer(self, *args, **kwargs):
        return UserSerializer(*args, **kwargs)
        
    def post(self, request, *args, **kwargs):
        # Handle JSON parsing manually to ensure we get proper error messages
        if request.content_type == 'application/json':
            try:
                if not request.body:
                    raise ValueError("Empty request body")
                data = json.loads(request.body)
            except json.JSONDecodeError as e:
                logger.error(f"JSON decode error: {str(e)}")
                return JsonResponse(
                    {'status': 'error', 'message': 'Invalid JSON data'}, 
                    status=status.HTTP_400_BAD_REQUEST,
                    json_dumps_params={'indent': 2}
                )
            except Exception as e:
                logger.error(f"Error parsing request data: {str(e)}", exc_info=True)
                return JsonResponse(
                    {'status': 'error', 'message': 'Error processing request data'}, 
                    status=status.HTTP_400_BAD_REQUEST,
                    json_dumps_params={'indent': 2}
                )
        else:
            data = request.data
            
        try:
            # Create a serializer instance with the data
            serializer = UserSerializer(data=data)
            
            # Explicitly validate the data
            if not serializer.is_valid():
                logger.error(f"Validation errors: {serializer.errors}")
                return JsonResponse(
                    {
                        'status': 'error',
                        'message': 'Validation error',
                        'errors': serializer.errors
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                    json_dumps_params={'indent': 2}
                )
                
            user = serializer.save()
            
            # Get the serialized user data
            user_data = UserSerializer(user).data
            
            # Remove sensitive data before sending the response
            if 'password' in user_data:
                del user_data['password']
                
            return JsonResponse(
                {
                    'status': 'success',
                    'message': 'User registered successfully',
                    'data': user_data
                },
                status=status.HTTP_201_CREATED,
                json_dumps_params={'indent': 2}
            )
            
        except serializers.ValidationError as e:
            logger.error(f"Validation error: {e.detail}")
            return JsonResponse(
                {
                    'status': 'error',
                    'message': 'Validation error',
                    'errors': e.detail if hasattr(e, 'detail') else str(e)
                },
                status=status.HTTP_400_BAD_REQUEST,
                json_dumps_params={'indent': 2}
            )
            
        except Exception as e:
            error_msg = f"Unexpected error during registration: {str(e)}"
            logger.error(error_msg, exc_info=True)
            return JsonResponse(
                {
                    'status': 'error',
                    'message': 'An unexpected error occurred during registration',
                    'error': str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                json_dumps_params={'indent': 2}
            )


@method_decorator(csrf_exempt, name='dispatch')
class LoginView(APIView):
    """Login user and return JWT tokens."""
    permission_classes = [permissions.AllowAny]
    parser_classes = [JSONParser, FormParser, MultiPartParser]
    authentication_classes = []  # No authentication required for login

    def post(self, request):
        from django.contrib.auth import authenticate
        
        email = request.data.get('email')
        password = request.data.get('password')

        if not email or not password:
            return Response(
                {'detail': 'Please provide both email and password'},
                status=status.HTTP_400_BAD_REQUEST
            )

        user = authenticate(request, username=email, password=password)

        if user is None:
            return Response(
                {'detail': 'Invalid credentials'},
                status=status.HTTP_401_UNAUTHORIZED
            )

        # Generate JWT tokens
        refresh = RefreshToken.for_user(user)
        
        response = Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'email': user.email,
                'name': user.name,
            }
        })
        
        # Set CSRF token in the response cookie
        response.set_cookie(
            key='csrftoken',
            value=get_token(request),
            httponly=False,  # Allow JavaScript to access the cookie
            secure=not settings.DEBUG,  # Only send over HTTPS in production
            samesite='Lax',  # Allow cross-site requests
            max_age=60 * 60 * 24 * 30,  # 30 days
        )
        
        return response


class ManageUserView(generics.RetrieveUpdateAPIView):
    """Manage the authenticated user."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        """Retrieve and return the authenticated user."""
        return self.request.user


# Temporarily commented out to fix NameError
# class DriverProfileView(generics.RetrieveUpdateAPIView):
#     """Manage driver profile."""
#     serializer_class = DriverProfileSerializer
#     permission_classes = [permissions.IsAuthenticated]
#     http_method_names = ['get', 'patch']
# 
#     def get_object(self):
#         """Retrieve and return the driver profile for the authenticated user."""
#         return self.request.user.driver_profile
# 
#     def patch(self, request, *args, **kwargs):
#         """Update the driver profile."""
#         return self.partial_update(request, *args, **kwargs)


# Temporarily commented out to fix NameError
# class DocumentViewSet(mixins.CreateModelMixin,
#                      mixins.DestroyModelMixin,
#                      mixins.ListModelMixin,
#                      viewsets.GenericViewSet):
#     """ViewSet for managing driver documents."""
#     serializer_class = DocumentSerializer
#     permission_classes = [permissions.IsAuthenticated, IsDriver]
#     parser_classes = [MultiPartParser, JSONParser]
# 
#     def get_queryset(self):
#         return Document.objects.filter(driver=self.request.user)
# 
#     def perform_create(self, serializer):
#         serializer.save(driver=self.request.user)
# 
#     @action(detail=True, methods=['get'])
#     def download(self, request, pk=None):
#         """Download a document file."""
#         document = self.get_object()
#         if not document.file:
#             return Response(
#                 {'error': 'No file associated with this document'},
#                 status=status.HTTP_404_NOT_FOUND
#             )
#         return FileResponse(document.file)

#     def get_queryset(self):
#         return DutyStatusLog.objects.filter(driver=self.request.user)
# 
#     def perform_create(self, serializer):
#         serializer.save(driver=self.request.user)
# 
#     @action(detail=False, methods=['get'])
#     def current_status(self, request):
#         """Get the current duty status of the driver."""
#         current_log = self.get_queryset().filter(end_time__isnull=True).first()
#         if current_log:
#             serializer = self.get_serializer(current_log)
#             return Response(serializer.data)
#         return Response({
#             'status': 'off_duty',
#             'message': 'No active duty status found.'
#         })
# 
#     @action(detail=True, methods=['post'])
#     def end_status(self, request, pk=None):
#         """End the current duty status."""
#         duty_status = self.get_object()
#         if duty_status.end_time is not None:
#             return Response(
#                 {'error': 'This duty status has already ended.'},
#                 status=status.HTTP_400_BAD_REQUEST
#             )
#         
#         duty_status.end_time = timezone.now()
#         duty_status.save()
#         serializer = self.get_serializer(duty_status)
#         return Response(serializer.data)


class CsrfTokenView(APIView):
    """Get CSRF token for the session."""
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    
    @method_decorator(ensure_csrf_cookie)
    def get(self, request):
        """Return CSRF token in a cookie and as JSON response."""
        token = csrf_get_token(request)
        response = JsonResponse({'csrfToken': token})
        response.set_cookie(
            'csrftoken',
            token,
            max_age=60 * 60 * 24 * 7,  # 1 week
            domain=os.getenv('CSRF_COOKIE_DOMAIN', None),
            secure=not settings.DEBUG,
            httponly=False,
            samesite='Lax'
        )
        return response


class CheckAuthView(APIView):
    """Check if user is authenticated and return user data."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, format=None):
        """Return user data if authenticated."""
        user = request.user
        driver_profile = None
        
        if hasattr(user, 'driver_profile'):
            driver_profile = {
                'license_number': user.driver_profile.license_number,
            }
        
        return Response({
            'id': user.id,
            'email': user.email,
            'name': user.name,
            'driver_profile': driver_profile,
        })
class LogoutView(APIView):
    """Logout user and blacklist refresh token."""
    permission_classes = [permissions.IsAuthenticated]

    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def post(self, request):
        """Logout user and blacklist refresh token."""
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
            response = Response(status=status.HTTP_205_RESET_CONTENT)
            response.delete_cookie('csrftoken')
            return response
        except Exception as e:
            logger.error(f"Logout error: {str(e)}")
            return Response(
                {"detail": "Error during logout"},
                status=status.HTTP_400_BAD_REQUEST
            )
