#!/bin/bash

# Spotter Production Deployment Script
# Usage: ./scripts/deploy.sh [environment]

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-production}
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $*"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $*"
}

# Check if required tools are installed
check_dependencies() {
    log_info "Checking dependencies..."

    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed. Please install Docker and try again."
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose is not installed. Please install Docker Compose and try again."
        exit 1
    fi

    log_success "Dependencies check passed"
}

# Create backup of current deployment
create_backup() {
    if [ -d "$BACKUP_DIR" ]; then
        log_info "Creating backup..."
        mkdir -p "$BACKUP_DIR"
        tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" -C "$PROJECT_DIR" --exclude='backups' --exclude='.git' --exclude='node_modules' --exclude='__pycache__' .
        log_success "Backup created: backup_$TIMESTAMP.tar.gz"
    fi
}

# Validate environment configuration
validate_environment() {
    log_info "Validating environment configuration for $ENVIRONMENT..."

    if [ "$ENVIRONMENT" = "production" ]; then
        if [ ! -f "$PROJECT_DIR/.env.production" ]; then
            log_error "Production environment file not found: .env.production"
            log_error "Please create .env.production with your production configuration"
            exit 1
        fi

        # Check for required environment variables
        required_vars=(
            "POSTGRES_PASSWORD"
            "DJANGO_SECRET_KEY"
            "REACT_APP_GOOGLE_MAPS_API_KEY"
        )

        for var in "${required_vars[@]}"; do
            if ! grep -q "^${var}=" "$PROJECT_DIR/.env.production"; then
                log_error "Required environment variable $var not found in .env.production"
                exit 1
            fi
        done
    fi

    log_success "Environment validation passed"
}

# Stop current deployment
stop_services() {
    log_info "Stopping current services..."
    docker-compose -f docker-compose.prod.yml down
    log_success "Services stopped"
}

# Build and start services
deploy_services() {
    log_info "Building and starting services..."

    # Build images
    docker-compose -f docker-compose.prod.yml build --no-cache

    # Start services
    docker-compose -f docker-compose.prod.yml up -d

    # Wait for services to be healthy
    log_info "Waiting for services to start..."
    sleep 30

    # Check if services are running
    if docker-compose -f docker-compose.prod.yml ps | grep -q "Up"; then
        log_success "Services deployed successfully"
    else
        log_error "Some services failed to start. Check logs:"
        docker-compose -f docker-compose.prod.yml logs
        exit 1
    fi
}

# Run database migrations
run_migrations() {
    log_info "Running database migrations..."

    if docker-compose -f docker-compose.prod.yml exec -T backend python manage.py migrate --check; then
        log_info "Database is up to date"
    else
        docker-compose -f docker-compose.prod.yml exec -T backend python manage.py migrate
        log_success "Database migrations completed"
    fi
}

# Collect static files
collect_static() {
    log_info "Collecting static files..."
    docker-compose -f docker-compose.prod.yml exec -T backend python manage.py collectstatic --noinput
    log_success "Static files collected"
}

# Run tests in production-like environment
run_smoke_tests() {
    log_info "Running smoke tests..."

    # Test backend health
    if curl -f http://localhost:8000/api/health/ > /dev/null 2>&1; then
        log_success "Backend API is responding"
    else
        log_error "Backend API health check failed"
        exit 1
    fi

    # Test frontend health
    if curl -f http://localhost:80 > /dev/null 2>&1; then
        log_success "Frontend is responding"
    else
        log_error "Frontend health check failed"
        exit 1
    fi

    log_success "All smoke tests passed"
}

# Clean up old backups
cleanup_backups() {
    if [ -d "$BACKUP_DIR" ]; then
        log_info "Cleaning up old backups (keeping last 5)..."

        # Keep only the 5 most recent backups
        cd "$BACKUP_DIR"
        ls -t backup_*.tar.gz | tail -n +6 | xargs -r rm -f

        log_success "Old backups cleaned up"
    fi
}

# Print deployment summary
print_summary() {
    log_success "Deployment completed successfully!"
    echo
    echo "🚀 Deployment Summary"
    echo "===================="
    echo "Environment: $ENVIRONMENT"
    echo "Timestamp: $(date)"
    echo "Services:"
    docker-compose -f docker-compose.prod.yml ps --format "table {{.Service}}\t{{.Status}}"
    echo
    echo "Access URLs:"
    echo "- Frontend: http://localhost:80"
    echo "- Backend API: http://localhost:8000/api"
    echo "- API Documentation: http://localhost:8000/api/docs/"
    echo
    echo "To view logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo "To stop services: docker-compose -f docker-compose.prod.yml down"
}

# Main deployment process
main() {
    log_info "Starting Spotter deployment for $ENVIRONMENT environment"

    check_dependencies
    validate_environment
    create_backup
    stop_services
    deploy_services
    run_migrations
    collect_static
    run_smoke_tests
    cleanup_backups
    print_summary

    log_success "Deployment process completed successfully!"
}

# Handle script arguments
case "${1:-}" in
    "rollback")
        log_info "Rollback functionality not implemented yet"
        ;;
    "status")
        docker-compose -f docker-compose.prod.yml ps
        ;;
    "logs")
        docker-compose -f docker-compose.prod.yml logs -f
        ;;
    "stop")
        docker-compose -f docker-compose.prod.yml down
        ;;
    *)
        main
        ;;
esac
