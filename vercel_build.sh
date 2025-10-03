#!/bin/bash

set -e  # Exit on any error

echo "Starting Vercel build process..."

# Install Python dependencies for the backend API
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Build frontend
echo "Building frontend..."
cd frontend
npm ci --production=false
npm run build
cd ..

# Create a simple wsgi.py file for Vercel (no database operations needed)
echo "Creating Vercel WSGI configuration..."
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

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
EOL

echo "Vercel build completed successfully!"
