from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from . import views

app_name = 'core'

# Create a router for our API endpoints
router = DefaultRouter()
router.register(r'documents', views.DocumentViewSet, basename='document')
router.register(r'duty-status', views.DutyStatusLogViewSet, basename='dutystatus')

urlpatterns = [
    # User management
    path('register/', views.CreateUserView.as_view(), name='register'),
    path('login/', views.LoginView.as_view(), name='login'),
    path('profile/', views.ManageUserView.as_view(), name='profile'),
    
    # JWT Token
    path('token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('token/verify/', TokenVerifyView.as_view(), name='token_verify'),
    
    # Driver Profile
    path('driver-profile/', views.DriverProfileView.as_view(), name='driver-profile'),
    
    path('logout/', views.LogoutView.as_view(), name='logout'),
    
    # Health Check
    path('health/', views.health_check, name='health-check'),
    
    # API endpoints
    path('api/', include(router.urls)),
    
    # Current duty status (convenience endpoint)
    path('api/current-status/', views.DutyStatusLogViewSet.as_view({'get': 'current_status'}), name='current-status'),
]
