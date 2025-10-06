from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
from django.views.decorators.csrf import csrf_exempt

from . import views

app_name = 'core'

# Create a router for our API endpoints
router = DefaultRouter()
# Temporarily commented out to fix errors
# router.register(r'documents', views.DocumentViewSet, basename='document')
# router.register(r'duty-status', views.DutyStatusLogViewSet, basename='dutystatus')

# API v1 URL patterns
v1_patterns = [
    # CSRF Token
    path('csrf/', views.CsrfTokenView.as_view(), name='csrf_token'),
    
    # User management
    path('register/', csrf_exempt(views.CreateUserView.as_view()), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('profile/', views.ManageUserView.as_view(), name='profile'),
    path('check-auth/', views.CheckAuthView.as_view(), name='check-auth'),
    
    # JWT Token
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    
    # Driver Profile - Temporarily commented out to fix errors
    # path('driver-profile/', views.DriverProfileView.as_view(), name='driver-profile'),
    
    path('logout/', views.LogoutView.as_view(), name='logout'),
    
    # Health Check
    path('health/', views.health_check, name='health-check'),
    
    # API endpoints
    path('api/', include(router.urls)),
    
    # Current duty status (convenience endpoint)
    # Temporarily commented out to fix errors
    # path('current-status/', views.DutyStatusLogViewSet.as_view({'get': 'current_status'}), name='current-status'),
]

# Root URL patterns
urlpatterns = [
    # Version 1 API
    path('v1/', include(v1_patterns)),
    
    # Backward compatibility with non-versioned URLs
    path('', include(v1_patterns)),
]
