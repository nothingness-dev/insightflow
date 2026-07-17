# Docker Deployment Notes

This project is designed to run as five services:

- `db`: PostgreSQL 15
- `redis`: Redis 7 — cache layer for dashboard stats, survey results, and activity log views
- `backend`: Django REST API served by Gunicorn
- `frontend`: React/Vite production build served by `serve`
- `nginx`: reverse proxy for `/`, `/api/`, `/static/`, and `/media/`

## Start

```bash
cp .env.example .env
docker compose up --build -d
```

## Logs

```bash
docker compose logs backend
docker compose logs frontend
docker compose logs nginx
docker compose logs redis
```

## Rebuild after changes

```bash
docker compose up --build -d
```

## Common LAN setup

Add your server IP to `.env`:

```env
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,192.168.1.100
CORS_ALLOWED_ORIGINS=http://localhost,http://127.0.0.1,http://192.168.1.100
```
