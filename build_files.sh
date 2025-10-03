#!/bin/bash

echo "BUILD START"

# Install Python dependencies
echo "Installing Python dependencies..."
pip install -r requirements.txt

# Run Django collectstatic for static files
echo "Collecting static files..."
python3 manage.py collectstatic --noinput --clear

echo "BUILD END"
