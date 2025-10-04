#!/bin/bash

# Simple deployment script for Spotter application
# Usage: ./deploy.sh [prod|dev]

set -e

ENVIRONMENT=${1:-prod}

echo "🚀 Deploying Spotter application in $ENVIRONMENT mode..."

# Stop existing containers
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.simple.yml down || true

# Build and start services
echo "🔨 Building and starting services..."
docker-compose -f docker-compose.simple.yml up --build -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 30

# Check if services are running
echo "🔍 Checking service status..."
docker-compose -f docker-compose.simple.yml ps

# Show logs if there are issues
echo "📋 Recent logs:"
docker-compose -f docker-compose.simple.yml logs --tail=20

echo "✅ Deployment complete!"
echo "🌐 Your application should be available at:"
echo "   Frontend: http://34.180.15.16/"
echo "   Backend API: http://34.180.15.16/api/"
echo ""
echo "📊 To check logs: docker-compose -f docker-compose.simple.yml logs -f"
echo "🛑 To stop: docker-compose -f docker-compose.simple.yml down"
