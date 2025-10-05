from rest_framework import authentication
from rest_framework.exceptions import AuthenticationFailed

class CsrfExemptSessionAuthentication(authentication.SessionAuthentication):
    """
    Session authentication with CSRF disabled for specific views.
    This should only be used for API endpoints that need to be accessible without CSRF.
    """
    def enforce_csrf(self, request):
        # Skip CSRF validation for API requests
        return  # Skip CSRF check for API requests
