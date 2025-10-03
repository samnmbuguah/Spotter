#!/bin/bash

echo "Starting build process..."

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r backend/requirements.txt

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
