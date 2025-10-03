#!/bin/bash

# Install Python dependencies
pip install -r backend/requirements.txt

# Build React frontend
cd frontend
npm install
npm run build
cd ..

# Copy React build files to Django static directory
cp -r frontend/build/* backend/static/

# Collect static files
cd backend
python manage.py collectstatic --noinput

# Apply migrations
python manage.py migrate --noinput
