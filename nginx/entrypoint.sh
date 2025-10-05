#!/bin/sh

# Test Nginx configuration
echo "Testing Nginx configuration..."
nginx -t

# Start Nginx in the foreground
echo "Starting Nginx..."
exec "$@"
