#!/bin/bash

# Exit on error
set -e

echo "🚀 Starting Spotter deployment..."

# Set environment variables
export COMPOSE_PROJECT_NAME=spotter
export USE_SQLITE=True

# Build and start services
echo "🔨 Building and starting services..."
docker-compose -f docker-compose.sqlite.yml up -d --build

# Wait for backend to be ready
echo "⏳ Waiting for backend to be ready..."
until docker-compose -f docker-compose.sqlite.yml exec -T backend curl -s http://localhost:8000/health/ >/dev/null; do
  echo "Waiting for backend..."
  sleep 5
done

# Run database migrations
echo "🔄 Running database migrations..."
docker-compose -f docker-compose.sqlite.yml exec -T backend python manage.py migrate

# Collect static files
echo "📦 Collecting static files..."
docker-compose -f docker-compose.sqlite.yml exec -T backend python manage.py collectstatic --noinput

# Create superuser if not exists
echo "👤 Creating superuser (if not exists)..."
docker-compose -f docker-compose.sqlite.yml exec -T backend bash -c "echo 'from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.filter(username="admin").exists() or User.objects.create_superuser("admin", "admin@example.com", "admin")' | python manage.py shell"

# Seed initial data
echo "🌱 Seeding initial data..."
docker-compose -f docker-compose.sqlite.yml exec -T backend python manage.py seed_logs --username=admin --days=7

echo "✅ Deployment complete!"
echo ""
echo "🌐 Access your application at: https://exponentialpotential.space"
echo "👤 Admin credentials:"
echo "   Username: admin"
echo "   Password: admin"
echo ""
echo "🔍 Check service status with: docker-compose -f docker-compose.sqlite.yml ps"
echo "📝 View logs with: docker-compose -f docker-compose.sqlite.yml logs -f"
