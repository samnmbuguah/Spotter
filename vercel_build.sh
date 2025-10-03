#!/bin/bash

set -e  # Exit on any error

echo "Starting optimized Vercel build process..."

# Install Python dependencies for the backend API only
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Build frontend with production optimizations
echo "Building frontend..."
cd frontend
npm ci --production=false
REACT_APP_API_URL=/api npm run build
cd ..

# Create a minimal wsgi.py file for Vercel (no database operations needed)
echo "Creating optimized Vercel WSGI configuration..."
cat > api/wsgi.py << 'EOL'
import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_path = str(Path(__file__).parent.parent / 'backend')
if backend_path not in sys.path:
    sys.path.append(backend_path)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
os.environ.setdefault('VERCEL', '1')  # Signal we're on Vercel

# Minimal Django setup for serverless
from django.conf import settings
if not settings.configured:
    from django.conf import settings
    settings.configure(
        DEBUG=False,
        SECRET_KEY=os.environ.get('SECRET_KEY', 'fallback-key'),
        ALLOWED_HOSTS=['*'],
        DATABASES={'default': {'ENGINE': 'django.db.backends.sqlite3', 'NAME': ':memory:'}},
        INSTALLED_APPS=[
            'django.contrib.auth',
            'django.contrib.contenttypes',
            'rest_framework',
            'corsheaders',
            'core',
            'logs',
        ],
        MIDDLEWARE=[
            'corsheaders.middleware.CorsMiddleware',
            'django.middleware.common.CommonMiddleware',
        ],
        CORS_ALLOW_ALL_ORIGINS=True,
        USE_TZ=True,
    )

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
EOL

echo "Vercel build completed successfully!"
