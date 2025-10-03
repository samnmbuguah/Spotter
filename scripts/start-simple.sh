#!/bin/bash

# Get the directory of this script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to start the backend
start_backend() {
    echo -e "${BLUE}[BACKEND]${NC} Starting Django server..."
    cd "$PROJECT_DIR/backend" || exit 1
    source venv/bin/activate
    python manage.py runserver
}

# Function to start the frontend
start_frontend() {
    echo -e "${GREEN}[FRONTEND]${NC} Starting React development server..."
    cd "$PROJECT_DIR/frontend" || exit 1
    npm start
}

# Start both backend and frontend in parallel
start_backend &
BACKEND_PID=$!

# Give backend a moment to start
sleep 3

start_frontend &
FRONTEND_PID=$!

# Function to kill both processes when script exits
cleanup() {
    echo -e "\nShutting down processes..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit 0
}

# Set up trap to catch script exit
trap cleanup INT TERM

# Wait for both processes to complete
wait $BACKEND_PID $FRONTEND_PID
