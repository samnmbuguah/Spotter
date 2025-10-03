import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_path = str(Path(__file__).parent.parent / 'backend')
if backend_path not in sys.path:
    sys.path.append(backend_path)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Import Django and configure for Vercel serverless
import django
from django.conf import settings

# Configure Django settings for Vercel if not already configured
if not settings.configured:
    settings.configure(
        DEBUG=False,
        SECRET_KEY=os.environ.get('SECRET_KEY', 'fallback-secret-key-for-vercel'),
        ALLOWED_HOSTS=['*'],
        DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}},
        INSTALLED_APPS=[
            'django.contrib.auth',
            'django.contrib.contenttypes',
            'django.contrib.sessions',
            'django.contrib.messages',
            'django.contrib.staticfiles',
            'rest_framework',
            'corsheaders',
            'rest_framework_simplejwt',
            'rest_framework_simplejwt.token_blacklist',
            'core.apps.CoreConfig',
            'logs.apps.LogsConfig',
            'trips.apps.TripsConfig',
        ],
        MIDDLEWARE=[
            'corsheaders.middleware.CorsMiddleware',
            'django.middleware.common.CommonMiddleware',
        ],
        CORS_ALLOW_ALL_ORIGINS=True,
        USE_TZ=True,
        ROOT_URLCONF='config.urls',
        TEMPLATES=[{
            'BACKEND': 'django.template.backends.django.DjangoTemplates',
            'DIRS': [],
            'APP_DIRS': True,
            'OPTIONS': {
                'context_processors': [
                    'django.template.context_processors.request',
                    'django.contrib.auth.context_processors.auth',
                    'django.contrib.messages.context_processors.messages',
                ],
            },
        }],
        SECRET_KEY_FALLBACK='fallback-secret-key-for-vercel',
    )

django.setup()

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
