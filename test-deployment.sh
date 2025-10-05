#!/bin/bash

# Simple deployment test script for Spotter
echo "🧪 Testing Spotter Deployment..."
echo

# Test backend health
echo "Testing backend health..."
if curl -f -s http://localhost/api/v1/auth/health/ > /dev/null; then
    echo "✅ Backend health: OK"
else
    echo "❌ Backend health: FAILED"
    exit 1
fi

# Test frontend
echo "Testing frontend..."
if curl -f -s -I http://localhost/ | head -1 | grep -q "200 OK"; then
    echo "✅ Frontend: OK"
else
    echo "❌ Frontend: FAILED"
    exit 1
fi

# Test external access
echo "Testing external access..."
if curl -f -s -I http://34.180.15.16/ | head -1 | grep -q "200 OK"; then
    echo "✅ External access: OK"
    echo "🌐 Application available at: http://34.180.15.16/"
else
    echo "❌ External access: FAILED"
    exit 1
fi

echo
echo "🎉 All tests passed! Deployment is working correctly."
