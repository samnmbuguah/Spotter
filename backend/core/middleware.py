"""Custom middleware for the core app."""
from django.utils.deprecation import MiddlewareMixin
from django.middleware.csrf import CsrfViewMiddleware

class DisableCSRFOnRegistration(MiddlewareMixin):
    """Middleware to disable CSRF protection for specific paths."""
    
    def process_request(self, request):
        # Skip CSRF verification for the registration endpoint
        if request.path == '/api/v1/auth/register/':
            setattr(request, '_dont_enforce_csrf_checks', True)
        return None
        
    def process_view(self, request, callback, callback_args, callback_kwargs):
        # This is needed to ensure our setting is respected
        if request.path == '/api/v1/auth/register/':
            return self._process_exempt_view(request, callback, callback_args, callback_kwargs)
        return None
        
    def _process_exempt_view(self, request, callback, callback_args, callback_kwargs):
        # This is a simplified version of CsrfViewMiddleware.process_view
        # that always skips CSRF checks
        return None
