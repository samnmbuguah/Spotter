#!/bin/bash
set -e

echo "🚀 Starting Spotter production deployment as root..."

# Build frontend
echo "🔨 Building frontend..."
sudo chown -R $USER:$USER .
cd frontend
npm install
npm run build
cd ..

# Set proper permissions
echo "🔑 Setting proper permissions..."
sudo chown -R $USER:$USER .
sudo chmod -R 777 .

# Stop and remove any existing containers
echo "🛑 Stopping and removing any existing containers..."
sudo docker-compose -f docker-compose.sqlite.yml down || true

# Build and start services
echo "🚀 Starting services with Docker Compose..."
sudo docker-compose -f docker-compose.sqlite.yml up -d --build

# Wait for services to start
echo "⏳ Waiting for services to be ready..."
sleep 10

# Fix permissions inside the container
echo "🔧 Fixing container permissions..."
sudo docker-compose -f docker-compose.sqlite.yml exec -T backend bash -c "chown -R appuser:appuser /app && chmod -R 777 /app/staticfiles /app/media"

# Run migrations
echo "🔄 Running database migrations..."
sudo docker-compose -f docker-compose.sqlite.yml exec -T backend python manage.py migrate

# Collect static files with proper permissions
echo "📦 Collecting static files..."
sudo docker-compose -f docker-compose.sqlite.yml exec -T backend python manage.py collectstatic --noinput

# Seed test data
echo "🌱 Seeding test data..."
sudo docker-compose -f docker-compose.sqlite.yml exec -T backend python manage.py seed_logs --days=7 --username=testdriver

echo "\n✅ Deployment complete!"
echo "🔗 Frontend: https://exponentialpotential.space"
echo "🔗 Backend API: https://exponentialpotential.space/api/v1/auth/"
echo "\nTest user credentials:
- Username: testdriver
- Password: testpass123"

echo "\nTo view logs:
sudo docker-compose -f docker-compose.sqlite.yml logs -f"
