#!/bin/bash

# Script to build and test Search EHOU Chrome Extension
# Usage: ./test-extension.sh [build|backend|frontend|all]

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$PROJECT_ROOT/backend"
EXTENSION_DIR="$PROJECT_ROOT/chrome-extension"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to build extension
build_extension() {
    log_info "Building Chrome Extension..."

    cd "$EXTENSION_DIR"

    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        log_info "Installing extension dependencies..."
        npm install
    fi

    # Build extension
    log_info "Building extension for testing..."
    npm run build:test

    log_success "Extension built successfully!"
    log_info "Extension files are in: $EXTENSION_DIR/dist/"
}

# Function to start backend
start_backend() {
    log_info "Starting backend services..."

    cd "$BACKEND_DIR"

    # Check if docker-compose is available
    if ! command -v docker-compose &> /dev/null; then
        log_error "docker-compose is not installed. Please install Docker and docker-compose first."
        exit 1
    fi

    # Check if .env file exists
    if [ ! -f ".env" ]; then
        log_warning ".env file not found. Creating from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            log_info "Created .env file from .env.example"
            log_warning "Please update .env file with your configuration if needed"
        else
            log_error ".env.example file not found. Please create .env file manually."
            exit 1
        fi
    fi

    # Start services
    log_info "Starting Docker services (PostgreSQL, Redis, Elasticsearch, Backend)..."
    docker-compose up -d

    log_info "Waiting for services to be healthy..."
    sleep 30

    # Check if backend is responding
    if curl -f http://localhost:3000/api/v1/health &> /dev/null; then
        log_success "Backend is running and healthy!"
        log_info "API available at: http://localhost:3000"
        log_info "Swagger docs at: http://localhost:3000/api/docs"
    else
        log_warning "Backend might still be starting up..."
        log_info "Check status with: docker-compose logs backend"
    fi
}

# Function to show test instructions
show_test_instructions() {
    log_success "Extension and backend are ready for testing!"

    echo ""
    echo "=========================================="
    echo "🧪 TEST INSTRUCTIONS"
    echo "=========================================="
    echo ""

    echo "1. 🌐 LOAD EXTENSION INTO CHROME:"
    echo "   - Open Chrome and go to: chrome://extensions/"
    echo "   - Enable 'Developer mode' (top right toggle)"
    echo "   - Click 'Load unpacked'"
    echo "   - Select the folder: $EXTENSION_DIR/dist/"
    echo ""

    echo "2. 📊 TEST DATA SETUP:"
    echo "   Option A - Use existing data:"
    echo "   - If you have existing questions in database, proceed to step 3"
    echo ""
    echo "   Option B - Add test data:"
    echo "   - Visit a quiz page and let extension extract questions"
    echo "   - Or manually add via API: http://localhost:3000/api/docs"
    echo ""

    echo "3. 🎯 TEST AUTO-FILL FEATURE:"
    echo "   Method A - Test page:"
    echo "   - Open: file://$EXTENSION_DIR/dist/test-auto-fill.html"
    echo "   - Click '🔄 Test Auto Fill' to simulate"
    echo ""
    echo "   Method B - Real quiz page:"
    echo "   - Go to any Moodle quiz page"
    echo "   - Extension will auto-fill if questions exist in DB"
    echo "   - Or click extension icon → '🔄 Điền đáp án ngay'"
    echo ""

    echo "4. 🔧 EXTENSION CONTROLS:"
    echo "   - Click extension icon in toolbar"
    echo "   - Toggle 'Tự động điền đáp án' on/off"
    echo "   - Toggle 'Tự động trích xuất' on/off"
    echo ""

    echo "=========================================="
    echo "🛠️  DEVELOPMENT COMMANDS:"
    echo "=========================================="
    echo ""
    echo "Rebuild extension:  cd $EXTENSION_DIR && npm run build:test"
    echo "Restart backend:    cd $BACKEND_DIR && docker-compose restart"
    echo "View backend logs:  cd $BACKEND_DIR && docker-compose logs -f backend"
    echo "Stop all services:  cd $BACKEND_DIR && docker-compose down"
    echo ""
}

# Function to stop services
stop_services() {
    log_info "Stopping backend services..."
    cd "$BACKEND_DIR"
    docker-compose down
    log_success "Services stopped!"
}

# Main script
main() {
    local action=${1:-"all"}

    case $action in
        "build")
            build_extension
            ;;
        "backend")
            start_backend
            ;;
        "stop")
            stop_services
            ;;
        "all")
            build_extension
            start_backend
            show_test_instructions
            ;;
        *)
            log_error "Usage: $0 [build|backend|stop|all]"
            log_info "build  - Build extension only"
            log_info "backend - Start backend services only"
            log_info "stop    - Stop backend services"
            log_info "all     - Build extension and start backend (default)"
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"
