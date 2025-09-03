# Docker Setup for Search EHOU Backend

Hướng dẫn sử dụng Docker để chạy backend của Search EHOU.

## Yêu cầu hệ thống

- Docker Engine 20.10+
- Docker Compose 2.0+

## Cấu trúc dịch vụ

Docker Compose sẽ tạo các dịch vụ sau:

- **PostgreSQL**: Cơ sở dữ liệu chính
- **Redis**: Cache và session storage
- **Elasticsearch**: Tìm kiếm full-text
- **Backend**: Ứng dụng NestJS API

## Cài đặt và chạy

### 1. Chuẩn bị môi trường

Tạo file `.env` từ template:

```bash
cp env.example .env
```

Cập nhật các biến môi trường trong `.env` nếu cần.

### 2. Chạy production environment

```bash
# Build và chạy tất cả services
docker-compose up --build

# Chạy trong background
docker-compose up -d --build

# Xem logs
docker-compose logs -f backend

# Dừng services
docker-compose down
```

### 3. Chạy development environment

```bash
# Chạy với hot reload
docker-compose -f docker-compose.yml -f docker-compose.override.yml up --build

# Chạy trong background
docker-compose -f docker-compose.yml -f docker-compose.override.yml up -d --build
```

## Truy cập dịch vụ

- **API**: http://localhost:3000
- **Swagger Docs**: http://localhost:3000/api/docs
- **PostgreSQL**: localhost:5432
- **Redis**: localhost:6379
- **Elasticsearch**: http://localhost:9200

## Quản lý dữ liệu

### Database migrations

```bash
# Chạy migrations trong container
docker-compose exec backend yarn migration:run

# Tạo migration mới
docker-compose exec backend yarn migration:generate -n MigrationName
```

### Backup và restore

```bash
# Backup database
docker-compose exec backend yarn backup

# Restore database
docker-compose exec backend yarn restore
```

## Troubleshooting

### 1. Kiểm tra health của services

```bash
docker-compose ps
```

### 2. Xem logs của service cụ thể

```bash
docker-compose logs postgres
docker-compose logs redis
docker-compose logs elasticsearch
docker-compose logs backend
```

### 3. Restart service

```bash
docker-compose restart backend
```

### 4. Rebuild và restart

```bash
docker-compose down
docker-compose up --build
```

### 5. Dọn dẹp

```bash
# Dừng và xóa containers, networks
docker-compose down

# Xóa thêm volumes
docker-compose down -v

# Xóa images
docker-compose down --rmi all
```

## Môi trường production

Để chạy trong production:

1. Cập nhật các biến môi trường trong `.env`
2. Đặt `NODE_ENV=production`
3. Sử dụng secrets thay vì plain text passwords
4. Cấu hình SSL/TLS
5. Setup monitoring và logging

## Ports được sử dụng

- 3000: Backend API
- 5432: PostgreSQL
- 6379: Redis
- 9200: Elasticsearch HTTP
- 9300: Elasticsearch Transport
