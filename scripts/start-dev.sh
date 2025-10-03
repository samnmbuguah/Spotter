#!/bin/bash

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to start the backend
start_backend() {
    echo -e "${YELLOW}[BACKEND]${NC} Starting Django backend..."
    cd "$PROJECT_DIR/backend" || exit 1
    
    # Check if virtual environment exists, if not create it
    if [ ! -d "venv" ]; then
        echo -e "${YELLOW}[BACKEND]${NC} Creating virtual environment..."
        if ! python3 -m venv venv; then
            echo -e "${RED}[BACKEND]${NC} Failed to create virtual environment"
            return 1
        fi
    fi
    
    # Activate virtual environment
    source venv/bin/activate
    
    # Install requirements
    echo -e "${YELLOW}[BACKEND]${NC} Installing Python dependencies..."
    if [ -f "requirements.txt" ]; then
        pip install -r requirements.txt
    else
        echo -e "${YELLOW}[BACKEND]${NC} requirements.txt not found, skipping dependency installation"
    fi
    
    # Run database migrations
    echo -e "${YELLOW}[BACKEND]${NC} Running database migrations..."
    python manage.py migrate
    
    # Create superuser if it doesn't exist
    echo -e "${YELLOW}[BACKEND]${NC} Creating superuser (if needed)..."
    echo "from django.contrib.auth import get_user_model; User = get_user_model(); User.objects.filter(username='admin').exists() or User.objects.create_superuser('admin', 'admin@example.com', 'admin')" | python manage.py shell
    
    # Start the development server
    echo -e "${YELLOW}[BACKEND]${NC} Starting development server..."
    python manage.py runserver
}

# Function to start the frontend
start_frontend() {
    echo -e "${GREEN}[FRONTEND]${NC} Starting React frontend..."
    cd "$PROJECT_DIR/frontend" || exit 1
    
    # Install npm dependencies if node_modules doesn't exist
    if [ ! -d "node_modules" ]; then
        echo -e "${GREEN}[FRONTEND]${NC} Installing Node.js dependencies..."
        npm install
    fi
    
    # Start the development server
    echo -e "${GREEN}[FRONTEND]${NC} Starting development server..."
    npm start
}

# Check for required commands
if ! command_exists python3; then
    echo -e "${RED}Error: Python 3 is required but not installed.${NC}" >&2
    exit 1
fi

if ! command_exists npm; then
    echo -e "${RED}Error: Node.js and npm are required but not installed.${NC}" >&2
    exit 1
fi

# Start both backend and frontend in parallel
start_backend &
BACKEND_PID=$!

# Give backend a moment to start
sleep 5

start_frontend &
FRONTEND_PID=$!

# Function to kill both processes when script exits
cleanup() {
    echo -e "\n${YELLOW}Shutting down processes...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up trap to catch script exit
trap cleanup INT TERM

# Wait for both processes to complete
wait $BACKEND_PID $FRONTEND_PID
