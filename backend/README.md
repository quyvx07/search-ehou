# Search EHOU Backend

Backend API cho Chrome Extension Search EHOU, được xây dựng với NestJS.

## Features

- ✅ **Story 1.3**: Elasticsearch setup với Vietnamese analyzer
- ✅ **Story 1.4**: API endpoints cơ bản với rate limiting và CORS
- ✅ **Story 1.5**: Bulk search API với Vietnamese text normalization

## API Endpoints

### Core Endpoints
- `GET /api/v1/health` - Health check
- `GET /api/v1/courses` - Lấy danh sách khóa học
- `POST /api/v1/courses` - Tạo khóa học mới
- `GET /api/v1/questions` - Lấy danh sách câu hỏi
- `POST /api/v1/questions` - Tạo câu hỏi mới
- `GET /api/v1/questions/search` - Tìm kiếm câu hỏi
- `POST /api/v1/questions/quizzes` - Tạo quiz từ câu hỏi
- `POST /api/v1/questions/bulk-search` - Bulk search với Vietnamese normalization

### Security Features
- **Rate Limiting**: 100 requests/phút
- **CORS**: Hỗ trợ Chrome Extension domains
- **Input Validation**: DTOs với class-validator
- **Error Handling**: Standardized error responses

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL
- Elasticsearch (optional)

### Installation
```bash
npm install
```

### Environment Setup
```bash
cp env.example .env
# Edit .env with your database credentials
```

### Database Setup
```bash
# Run migrations
npm run migration:run

# Seed data (optional)
npm run migration:run
```

### Development
```bash
# Start development server
npm run start:dev

# Run tests
npm run test

# Quick API test
./scripts/quick-api-test.sh
```

### Production
```bash
npm run build
npm run start:prod
```

## Testing

### Unit Tests
```bash
npm run test
```

### API Tests
```bash
# Quick test
./scripts/quick-api-test.sh

# Comprehensive test
node scripts/test-api-endpoints.js

# Bulk search test
node scripts/test-bulk-search.js
```

### Coverage
```bash
npm run test:cov
```

## Documentation

- **API Documentation**: `API_ENDPOINTS.md`
- **Elasticsearch Setup**: `ELASTICSEARCH_SETUP.md`
- **Swagger UI**: `http://localhost:3000/api/docs`

## Project Structure

```
src/
├── config/           # Configuration files
├── common/           # Common utilities, filters, guards
├── modules/          # Feature modules
│   ├── health/       # Health check endpoints
│   ├── questions/    # Questions and courses management
│   └── elasticsearch/ # Search functionality
├── migrations/       # Database migrations
└── main.ts          # Application entry point
```

## Development Guidelines

### Code Style
- Follow NestJS conventions
- Use TypeScript strict mode
- Write unit tests for all services
- Use DTOs for input validation

### Git Workflow
- Feature branches from `main`
- Commit messages in English
- Pull request reviews required

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Check PostgreSQL is running
   - Verify database credentials in `.env`

2. **Elasticsearch Connection Error**
   - Check Elasticsearch is running
   - Verify Elasticsearch configuration

3. **Rate Limiting**
   - Check request frequency
   - Review rate limiting configuration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
