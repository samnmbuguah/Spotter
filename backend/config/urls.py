"""
URL configuration for config project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/5.2/topics/http/urls/
"""
from django.contrib import admin
from django.urls import path, include, re_path
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from core.views import health_check

# API URL Configuration
api_urlpatterns = [
    # Core app endpoints
    path('api/v1/auth/', include('core.urls')),
    
    # Trips app endpoints
    path('api/v1/trips/', include('trips.urls')),
    
    # Logs app endpoints
    path('api/v1/logs/', include('logs.urls')),
]

# Schema View for API documentation
schema_view = get_schema_view(
    openapi.Info(
        title="Spotter API",
        default_version='v1',
        description="API for Spotter HOS Compliance Tool",
        terms_of_service="https://www.spotter.com/terms/",
        contact=openapi.Contact(email="contact@spotter.com"),
        license=openapi.License(name="MIT License"),
    ),
    public=True,
    permission_classes=(permissions.AllowAny,),
)

urlpatterns = [
    # Admin site
    path('admin/', admin.site.urls),
    
    # Health check (public endpoint)
    path('health/', health_check, name='health-check'),
    
    # API Documentation
    re_path(r'^api/docs(?P<format>\.json|\.yaml)$', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    path('api/docs/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('api/redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    
    # API endpoints
    *api_urlpatterns,
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
