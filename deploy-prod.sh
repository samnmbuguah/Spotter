#!/bin/bash
set -e

echo "🚀 Starting Spotter production deployment..."

# Build frontend
echo "🔨 Building frontend..."
cd frontend
npm install
npm run build
cd ..

# Build and start services
echo "🚀 Starting services with Docker Compose..."
docker-compose -f docker-compose.sqlite.yml down
docker-compose -f docker-compose.sqlite.yml up -d --build

# Wait for services to start
echo "⏳ Waiting for services to be ready..."
sleep 10

# Run migrations
echo "🔄 Running database migrations..."
docker-compose -f docker-compose.sqlite.yml exec backend python manage.py migrate

# Collect static files
echo "📦 Collecting static files..."
docker-compose -f docker-compose.sqlite.yml exec backend python manage.py collectstatic --noinput

# Seed test data
echo "🌱 Seeding test data..."
docker-compose -f docker-compose.sqlite.yml exec backend python manage.py seed_logs --days=7 --username=testdriver

echo "
✅ Deployment complete!
🔗 Frontend: https://exponentialpotential.space
🔗 Backend API: https://exponentialpotential.space/api/v1/auth/

Test user credentials:
- Username: testdriver
- Password: testpass123

To view logs:
docker-compose -f docker-compose.sqlite.yml logs -f
"
