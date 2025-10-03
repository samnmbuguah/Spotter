#!/bin/bash

set -e  # Exit on any error

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt
pip install -r backend/requirements.txt

# Build frontend
echo "Building frontend..."
cd frontend
npm ci --only=production  # Use npm ci for faster, reliable builds
npm run build
cd ..

# Copy frontend build to Django static files
echo "Copying frontend files..."
cp -r frontend/build/* backend/static/

# Run migrations and collect static files
echo "Running database migrations..."
cd backend
python3 manage.py migrate --noinput
echo "Collecting static files..."
python3 manage.py collectstatic --noinput

# Create a simple wsgi.py file for Vercel
echo "Creating Vercel WSGI configuration..."
cat > ../api/wsgi.py << 'EOL'
import os
import sys
from pathlib import Path

# Add the backend directory to the Python path
backend_path = str(Path(__file__).parent.parent / 'backend')
if backend_path not in sys.path:
    sys.path.append(backend_path)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
EOL

echo "Build completed successfully!"
