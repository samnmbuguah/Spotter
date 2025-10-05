from rest_framework import permissions
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator


class BypassCSRFForRegistration(permissions.BasePermission):
    """
    Custom permission to bypass CSRF checks for registration endpoint.
    """
    def has_permission(self, request, view):
        # Skip CSRF check for registration endpoint
        if request.path == '/api/v1/auth/register/':
            return True
        return True


class IsDriver(permissions.BasePermission):
    """
    Custom permission to only allow drivers to access the view.
    """
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_driver)


class IsOwnerOrReadOnly(permissions.BasePermission):
    """
    Custom permission to only allow owners of an object to edit it.
    """
    def has_object_permission(self, request, view, obj):
        # Read permissions are allowed to any request,
        # so we'll always allow GET, HEAD or OPTIONS requests.
        if request.method in permissions.SAFE_METHODS:
            return True

        # Write permissions are only allowed to the owner of the object.
        return obj.driver == request.user
