#!/bin/bash

# Docker Scripts for Search EHOU Backend
# Usage: ./docker-scripts.sh [command]

set -e

COMPOSE_FILES="-f docker-compose.yml"
if [ -f "docker-compose.override.yml" ]; then
    COMPOSE_FILES="$COMPOSE_FILES -f docker-compose.override.yml"
fi

case "$1" in
    "start")
        echo "🚀 Starting Search EHOU Backend services..."
        docker-compose $COMPOSE_FILES up -d --build
        echo "✅ Services started successfully!"
        echo "📊 API: http://localhost:3000"
        echo "📚 Docs: http://localhost:3000/api/docs"
        ;;

    "stop")
        echo "🛑 Stopping Search EHOU Backend services..."
        docker-compose $COMPOSE_FILES down
        echo "✅ Services stopped successfully!"
        ;;

    "restart")
        echo "🔄 Restarting Search EHOU Backend services..."
        docker-compose $COMPOSE_FILES restart
        echo "✅ Services restarted successfully!"
        ;;

    "logs")
        service=${2:-backend}
        echo "📋 Showing logs for $service..."
        docker-compose $COMPOSE_FILES logs -f $service
        ;;

    "build")
        echo "🔨 Building Search EHOU Backend services..."
        docker-compose $COMPOSE_FILES build --no-cache
        echo "✅ Build completed successfully!"
        ;;

    "shell")
        service=${2:-backend}
        echo "🐚 Opening shell in $service..."
        docker-compose $COMPOSE_FILES exec $service sh
        ;;

    "db-migrate")
        echo "🗃️ Running database migrations..."
        docker-compose $COMPOSE_FILES exec backend yarn migration:run
        echo "✅ Migrations completed successfully!"
        ;;

    "db-generate")
        name=${2:-Migration}
        echo "📝 Generating migration: $name..."
        docker-compose $COMPOSE_FILES exec backend yarn migration:generate -n $name
        echo "✅ Migration generated successfully!"
        ;;

    "backup")
        echo "💾 Creating database backup..."
        docker-compose $COMPOSE_FILES exec backend yarn backup
        echo "✅ Backup completed successfully!"
        ;;

    "test")
        echo "🧪 Running tests..."
        docker-compose $COMPOSE_FILES exec backend yarn test
        ;;

    "clean")
        echo "🧹 Cleaning up Docker resources..."
        docker-compose $COMPOSE_FILES down -v --rmi all
        docker system prune -f
        echo "✅ Cleanup completed successfully!"
        ;;

    "status")
        echo "📊 Service Status:"
        docker-compose $COMPOSE_FILES ps
        ;;

    "setup")
        echo "⚙️ Initial setup..."

        # Create necessary directories
        mkdir -p logs backups

        # Build and start services
        echo "🏗️ Building and starting services..."
        docker-compose $COMPOSE_FILES up -d --build

        # Wait for services to be healthy
        echo "⏳ Waiting for services to be ready..."
        sleep 30

        # Run migrations
        echo "🗃️ Running initial migrations..."
        docker-compose $COMPOSE_FILES exec backend yarn migration:run

        echo "✅ Setup completed successfully!"
        echo "📊 API: http://localhost:3000"
        echo "📚 Docs: http://localhost:3000/api/docs"
        ;;

    *)
        echo "🐳 Search EHOU Backend - Docker Scripts"
        echo ""
        echo "Usage: $0 [command]"
        echo ""
        echo "Commands:"
        echo "  setup       Initial setup and run"
        echo "  start       Start all services"
        echo "  stop        Stop all services"
        echo "  restart     Restart all services"
        echo "  build       Build all services"
        echo "  logs        Show logs (default: backend)"
        echo "  shell       Open shell in service (default: backend)"
        echo "  status      Show service status"
        echo "  db-migrate  Run database migrations"
        echo "  db-generate Generate new migration"
        echo "  backup      Create database backup"
        echo "  test        Run tests"
        echo "  clean       Clean up Docker resources"
        echo ""
        echo "Examples:"
        echo "  $0 start"
        echo "  $0 logs redis"
        echo "  $0 shell postgres"
        echo "  $0 db-generate CreateUsersTable"
        ;;
esac
