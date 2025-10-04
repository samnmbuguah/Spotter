from django.http import JsonResponse, FileResponse
from django.db import connection, transaction
from django.core.cache import cache
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from django.utils import timezone
from django.shortcuts import get_object_or_404
import os
from rest_framework import generics, permissions, status, viewsets, mixins
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, JSONParser
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import (
    UserSerializer, 
    DriverProfileSerializer, 
    DocumentSerializer, 
    DutyStatusLogSerializer
)
from .models import User, DriverProfile, Document, DutyStatusLog
from .permissions import IsDriver, IsOwnerOrReadOnly


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
        health_status['status'] = 'unhealthy'
        health_status['services']['database'] = {
            'status': 'unhealthy',
            'error': str(e)
        }

    # Redis cache health check
    try:
        cache.set('health_check', 'test', 1)
        test_value = cache.get('health_check')
        if test_value == 'test':
            health_status['services']['cache'] = {
                'status': 'healthy',
                'type': 'redis'
            }
        else:
            raise Exception("Cache write/read test failed")
    except Exception as e:
        health_status['status'] = 'unhealthy'
        health_status['services']['cache'] = {
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


class CreateUserView(generics.CreateAPIView):
    """Create a new user in the system."""
    serializer_class = UserSerializer
    permission_classes = [permissions.AllowAny]

    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)


class LoginView(APIView):
    """Login user and return JWT tokens."""
    permission_classes = [permissions.AllowAny]

    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

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

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id': user.id,
                'email': user.email,
                'name': user.name,
            }
        })


class ManageUserView(generics.RetrieveUpdateAPIView):
    """Manage the authenticated user."""
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        """Retrieve and return the authenticated user."""
        return self.request.user


class DriverProfileView(generics.RetrieveUpdateAPIView):
    """Manage driver profile."""
    serializer_class = DriverProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ['get', 'patch']

    def get_object(self):
        """Retrieve and return the driver profile for the authenticated user."""
        try:
            return self.request.user.driver_profile
        except DriverProfile.DoesNotExist:
            return DriverProfile.objects.create(user=self.request.user)
    def patch(self, request, *args, **kwargs):
        """Update the driver profile."""
        return self.partial_update(request, *args, **kwargs)


class DocumentViewSet(mixins.CreateModelMixin,
                     mixins.RetrieveModelMixin,
                     mixins.DestroyModelMixin,
                     mixins.ListModelMixin,
                     viewsets.GenericViewSet):
    """ViewSet for managing driver documents."""
    serializer_class = DocumentSerializer
    permission_classes = [permissions.IsAuthenticated, IsDriver]
    parser_classes = [MultiPartParser, JSONParser]

    def get_queryset(self):
        return Document.objects.filter(driver=self.request.user)

    def perform_create(self, serializer):
        serializer.save(driver=self.request.user)

    @action(detail=True, methods=['get'])
    def download(self, request, pk=None):
        """Download a document file."""
        document = self.get_object()
        return FileResponse(document.file)


class DutyStatusLogViewSet(viewsets.ModelViewSet):
    """ViewSet for managing duty status logs."""
    serializer_class = DutyStatusLogSerializer
    permission_classes = [permissions.IsAuthenticated, IsDriver]
    filterset_fields = ['status', 'start_time', 'end_time']
    search_fields = ['location', 'notes', 'inspection_notes']
    ordering_fields = ['start_time', 'end_time', 'created_at']
    ordering = ['-start_time']

    def get_queryset(self):
        return DutyStatusLog.objects.filter(driver=self.request.user)

    def perform_create(self, serializer):
        serializer.save(driver=self.request.user)

    @action(detail=False, methods=['get'])
    def current_status(self, request):
        """Get the current duty status of the driver."""
        current_log = self.get_queryset().filter(end_time__isnull=True).first()
        if current_log:
            serializer = self.get_serializer(current_log)
            return Response(serializer.data)
        return Response({
            'status': 'off_duty',
            'message': 'No active duty status found.'
        })

    @action(detail=True, methods=['post'])
    def end_status(self, request, pk=None):
        """End the current duty status."""
        duty_status = self.get_object()
        if duty_status.end_time is not None:
            return Response(
                {'error': 'This duty status has already ended.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        duty_status.end_time = timezone.now()
        duty_status.save()
        serializer = self.get_serializer(duty_status)
        return Response(serializer.data)


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
                'license_expiry': user.driver_profile.license_expiry,
                'current_vehicle': user.driver_profile.current_vehicle,
                'current_trailer': user.driver_profile.current_trailer,
            }
        
class LogoutView(APIView):
    """Logout user and blacklist refresh token."""
    permission_classes = [permissions.IsAuthenticated]

    @method_decorator(csrf_exempt)
    def dispatch(self, *args, **kwargs):
        return super().dispatch(*args, **kwargs)

    def post(self, request):
        """Logout user and blacklist refresh token."""
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                # Blacklist the refresh token
                token = RefreshToken(refresh_token)
                token.blacklist()

            return Response({
                'message': 'Successfully logged out'
            })
        except Exception as e:
            # Return success even if token blacklisting fails
            # The client-side cleanup will still happen
            return Response({
                'message': 'Logged out successfully'
            })
