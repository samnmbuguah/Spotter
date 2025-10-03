#!/bin/bash

echo "Starting build process..."

# Upgrade pip and install core packages first
echo "Upgrading pip and installing core packages..."
pip install --upgrade pip setuptools wheel

# Install Django and core dependencies first
echo "Installing Django and core dependencies..."
pip install Django==5.2.7 djangorestframework==3.16.1 django-cors-headers==4.9.0

# Install remaining dependencies
echo "Installing remaining dependencies..."
pip install -r backend/requirements.txt

# Verify Django installation
echo "Verifying Django installation..."
python -c "import django; print(f'Django version: {django.get_version()}')"

# Build React frontend
echo "Building React frontend..."
cd frontend
npm install
npm run build
cd ..

# Copy React build files to Django static directory
echo "Copying React build files..."
cp -r frontend/build/* backend/static/

# Collect static files
echo "Collecting static files..."
cd backend
python manage.py collectstatic --noinput

# Apply migrations
echo "Applying migrations..."
python manage.py migrate --noinput

echo "Build process completed successfully!"
