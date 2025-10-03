from django.urls import path
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)

from . import views

app_name = 'core'

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
    
    # Auth Check
    path('check-auth/', views.CheckAuthView.as_view(), name='check-auth'),
]
