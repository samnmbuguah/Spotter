from django.middleware.csrf import CsrfViewMiddleware
from django.utils.deprecation import MiddlewareMixin

class CustomCsrfMiddleware(MiddlewareMixin):
    """
    Custom CSRF middleware that skips CSRF checks for specific paths.
    """
    def __init__(self, get_response=None):
        super().__init__(get_response)
        # Initialize the CsrfViewMiddleware with a dummy get_response
        self.csrf_middleware = CsrfViewMiddleware(lambda req: None)
    
    def process_request(self, request):
        # Skip CSRF checks for registration endpoint
        if request.path == '/api/v1/auth/register/':
            setattr(request, '_dont_enforce_csrf_checks', True)
        return None

    def process_view(self, request, callback, callback_args, callback_kwargs):
        # Skip CSRF checks for registration endpoint
        if request.path == '/api/v1/auth/register/':
            return None
        # Use the initialized CsrfViewMiddleware instance
        return self.csrf_middleware.process_view(request, callback, callback_args, callback_kwargs)
