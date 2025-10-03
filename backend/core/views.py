from django.http import JsonResponse
from django.db import connection
from django.core.cache import cache
import os
from rest_framework import generics, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from .serializers import UserSerializer, DriverProfileSerializer
from .models import DriverProfile


def health_check(request):
    """
    Comprehensive health check endpoint for the Spotter application.
    Returns status of database, cache, and external services.
    """
    health_status = {
        'status': 'healthy',
        'timestamp': connection.ops.date_truncate_sql('second', 'NOW()'),
        'services': {}
    }

    # Database health check
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            health_status['services']['database'] = {
                'status': 'healthy',
                'type': 'postgresql'
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


class LoginView(APIView):
    """Login user and return JWT tokens."""
    permission_classes = [permissions.AllowAny]

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


class CheckAuthView(APIView):
    """Check if user is authenticated."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, format=None):
        """Return user data if authenticated."""
        return Response({
            'isAuthenticated': True,
            'user': {
                'id': request.user.id,
                'email': request.user.email,
                'name': request.user.name,
            }
        })
