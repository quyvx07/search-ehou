#!/bin/bash

# Build Search EHOU Chrome Extension with enhanced features
# Usage: ./build-extension.sh [dev|prod|test]

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
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

build_dev() {
    log_info "Building extension for development..."
    cd "$EXTENSION_DIR"
    npm run build:dev
}

build_prod() {
    log_info "Building extension for production..."
    cd "$EXTENSION_DIR"
    npm run build
}

build_test() {
    log_info "Building extension for testing..."
    cd "$EXTENSION_DIR"
    npm run build:test
}

show_features() {
    log_success "Extension built successfully!"
    echo ""
    echo "=========================================="
    echo "🚀 ENHANCED FEATURES"
    echo "=========================================="
    echo ""
    echo "✅ Instant API calls (no delay)"
    echo "✅ Silent operation (no notifications)"
    echo "✅ Enhanced matching algorithm:"
    echo "   • Question text similarity (40%)"
    echo "   • Answer set comparison (60%)"
    echo "   • Dynamic confidence thresholds"
    echo "   • Comprehensive scoring system"
    echo ""
    echo "🔧 Technical improvements:"
    echo "   • Smart answer matching"
    echo "   • Confidence-based filtering"
    echo "   • Detailed logging for debugging"
    echo "   • Better error handling"
    echo ""
    echo "📁 Build output:"
    echo "   Extension files: $EXTENSION_DIR/dist/"
    echo "   Test file: $EXTENSION_DIR/dist/test-auto-fill.html"
    echo ""
}

# Main script
main() {
    local build_type=${1:-"dev"}

    log_info "Building Search EHOU Chrome Extension (Enhanced Version)"
    log_info "Build type: $build_type"

    case $build_type in
        "dev")
            build_dev
            ;;
        "prod")
            build_prod
            ;;
        "test")
            build_test
            ;;
        *)
            log_error "Usage: $0 [dev|prod|test]"
            log_info "dev  - Development build (default)"
            log_info "prod - Production build (minified)"
            log_info "test - Testing build (with test files)"
            exit 1
            ;;
    esac

    show_features
}

# Run main function with all arguments
main "$@"
