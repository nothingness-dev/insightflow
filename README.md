# InsightFlow

InsightFlow is a modern employee survey platform for Persian and RTL-first teams. It helps organizations create structured surveys, collect identified or anonymous feedback, track participation, export results, and audit sensitive admin activity from one clean dashboard.

## Highlights

- Multi-question surveys with numeric scores, emoji ratings, free-text answers, and per-question required fields.
- A manageable survey builder: questions collapse into accordion rows with compact summaries, a sticky action bar keeps saving in reach, and drafts autosave locally with a visible "saved at" state.
- Identified employee participation with progress tracking for admins.
- Anonymous hash links for account-free participation, with QR codes, optional participant limits, expiry windows, and IP-based duplicate protection.
- A mobile-friendly anonymous voting flow: compact participant rows with completion status, an overall progress bar, and a sticky "continue with next person" action.
- Admin dashboards with cached metrics, recent activity, survey status cards, and quick management actions.
- Result exports to Excel, CSV, and PDF with Persian/RTL-friendly formatting.
- Activity logs for sensitive admin operations, including expandable metadata for link changes, IPs, limits, and tokens.
- Guarded destructive admin actions with confirmation flows, plus password strength validation on account credentials.
- Accessible forms: labeled inputs with stable ids, `aria-invalid`/`aria-describedby` wiring, persistent inline field errors, and focus moved to the first invalid field on submit.
- Docker Compose deployment with PostgreSQL, Redis, backend, frontend, and Nginx.

## Screenshots

The gallery below uses the current captures tracked in `screenshots/`.

| Login | Admin Dashboard |
| --- | --- |
| ![InsightFlow login screen](screenshots/login.png) | ![InsightFlow admin dashboard](screenshots/dashboard.png) |

| Create Survey | Survey Voting |
| --- | --- |
| ![Create survey form](screenshots/create-survey.png) | ![Employee voting screen](screenshots/voting.png) |

| Results | Activity Center |
| --- | --- |
| ![Survey results dashboard](screenshots/results.png) | ![Activity center audit log](screenshots/activity.png) |

## Tech Stack

| Layer | Tools |
| --- | --- |
| Backend | Django, Django REST Framework, Simple JWT |
| Frontend | React, TypeScript, Tailwind CSS, Vite |
| Database and cache | PostgreSQL, Redis |
| Deployment | Docker Compose, Nginx, Gunicorn |
| Reports | CSV, Excel, PDF export support |

## Quick Start

1. Copy the environment template.

```bash
cp .env.example .env
```

2. Fill in the required values in `.env`, especially `SECRET_KEY`, database credentials, admin credentials, allowed hosts, and CORS origins.

3. Start the full stack.

```bash
docker compose up -d --build
```

4. Check that every service is running.

```bash
docker compose ps
```

5. Open the app.

```text
http://localhost
```

The backend applies migrations, collects static files, and creates the initial
admin account automatically during startup. Admin credentials come from
`ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_FULL_NAME` in `.env`.

## Local Development

Backend:

```bash
python -m venv .venv
# Windows PowerShell: .\.venv\Scripts\Activate.ps1
# macOS/Linux: source .venv/bin/activate
python -m pip install -r backend/requirements.txt
cd backend
python manage.py runserver --settings=config.settings.dev
```

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

Useful frontend checks:

```bash
cd frontend
npm run typecheck
npm run build
```

Useful backend checks:

```bash
python backend/manage.py makemigrations --check --dry-run --settings=config.settings.dev
python backend/manage.py test apps.accounts apps.activity apps.surveys --settings=config.settings.test
```

## Anonymous Hash Links

Admins can manage anonymous participation links from a survey detail page. Each link can have:

- A custom label.
- Active or inactive status.
- QR code generation for easy sharing.
- Optional participant capacity.
- Optional expiry duration in hours, days, or weeks.
- IP-based participation locking to reduce duplicate anonymous submissions.

Every important hash-link action is recorded in the activity log so admins can review what changed, when it changed, and which metadata was involved.

## IP Response Audit

The admin Survey Results page includes a separate **«ممیزی پاسخ‌های IP»**
tab. Its searchable selector contains only IP addresses with answers in the
current survey. After selecting an IP, InsightFlow shows its submissions
grouped by evaluated person and then by question, keeping answers for different
people strictly separate. Numeric scores, emoji ratings, and free-text answers
are shown in their native formats.

The tab also provides a dedicated Excel-only export for the selected survey and
IP. This export is separate from the standard CSV, Excel, and PDF result
reports. Deliberately selecting an IP and downloading its workbook create
Activity Center records containing the selected IP and relevant answer,
submission, and person counts. Person pagination, page-size changes, retries,
and background refreshes do not create duplicate view events.

## Deployment

InsightFlow is designed to run as five Docker services:

| Service | Purpose |
| --- | --- |
| `db` | PostgreSQL 15 database |
| `redis` | Cache layer for dashboards, survey results, and activity views |
| `backend` | Django REST API served by Gunicorn |
| `frontend` | React/Vite production build |
| `nginx` | Reverse proxy for `/`, `/api/`, `/static/`, and `/media/` |

On a Linux host with `cron`, make the scripts executable and prepare the default
backup directory before using the deployment helper:

```bash
chmod +x deploy.sh backup.sh
sudo install -d -m 700 -o "$USER" -g "$USER" /opt/InsightFlow/backups
./deploy.sh
```

If `/opt/InsightFlow/backups` is not appropriate for the server, follow
[BACKUP.md](BACKUP.md) and set a writable `BACKUP_DIR` when running
`backup.sh`; use the direct Docker Compose path below instead of `deploy.sh`,
which prepares the default `/opt/InsightFlow/backups` location.

Or run Docker Compose directly:

```bash
cp .env.example .env
docker compose up --build -d
```

Useful Docker commands:

```bash
docker compose ps
docker compose logs backend
docker compose logs frontend
docker compose logs nginx
docker compose logs redis
docker compose restart backend
docker compose down
docker compose up --build -d
```

### Environment

At minimum, set these values in `.env` before production use:

| Variable | Purpose | Example |
| --- | --- | --- |
| `SECRET_KEY` | Django secret key; use a long random value | `change-me-to-a-long-random-secret` |
| `DEBUG` | Keep `False` outside development | `False` |
| `ALLOWED_HOSTS` | Hostnames/IPs allowed by Django | `localhost,127.0.0.1,192.168.1.100` |
| `CORS_ALLOWED_ORIGINS` | Browser origins allowed to call the API | `http://localhost,http://192.168.1.100` |
| `VITE_PUBLIC_BASE_URL` | Public origin used when generating anonymous links | `http://192.168.1.100` |
| `DB_NAME` | PostgreSQL database name | `surveydb` |
| `DB_USER` | PostgreSQL user | `surveyuser` |
| `DB_PASSWORD` | PostgreSQL password | `use-a-strong-password` |
| `REDIS_URL` | Redis connection used by the backend | `redis://redis:6379/0` |
| `ADMIN_USERNAME` | Initial admin username | `admin` |
| `ADMIN_PASSWORD` | Initial admin password | `Admin@1234` |
| `ADMIN_FULL_NAME` | Initial admin display name | `System Admin` |
| `MAX_UPLOAD_SIZE` | Maximum uploaded image size in bytes | `2097152` |

### LAN or Custom URL

To make the app available from other devices on your network:

1. Find the server IP with `ipconfig` on Windows or `hostname -I` on Linux.
2. Add the IP to `.env`.

```env
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,192.168.1.100
CORS_ALLOWED_ORIGINS=http://localhost,http://127.0.0.1,http://192.168.1.100
VITE_PUBLIC_BASE_URL=http://192.168.1.100
```

3. Recreate the frontend and restart the backend. `VITE_PUBLIC_BASE_URL` is a
frontend build argument, so a backend-only restart does not apply it.

```bash
docker compose restart backend
docker compose up -d --build frontend
```

4. Open the app from another device:

```text
http://192.168.1.100
```

For a local domain such as `survey.company.local`, add this to each client machine's hosts file:

```text
192.168.1.100    survey.company.local
```

Then include the domain in `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, and
`VITE_PUBLIC_BASE_URL`, then rebuild. The source-build Nginx configuration
already accepts any host name; HTTPS customer deployments must also replace
`your-domain.com` in `nginx/nginx.ssl.conf`.

```bash
docker compose down
docker compose up --build -d
```

If port `80` is already in use, change the `nginx` service port mapping in `docker-compose.yml`:

```yaml
nginx:
  ports:
    - "8080:80"
```

### Backups

Use the included backup script for PostgreSQL backups:

```bash
./backup.sh backup
./backup.sh list
./backup.sh verify latest
./backup.sh restore latest
```

Restore is interactive and replaces the current database and uploaded media.
Create and verify a fresh backup first. See [BACKUP.md](BACKUP.md) for custom
paths, unattended restore, retention, and recovery-server instructions.

Manual database backup and restore:

```bash
docker compose exec -T db pg_dump -U surveyuser surveydb > backup.sql
docker compose exec -T db psql -U surveyuser surveydb < backup.sql
```

Back up uploaded media:

```bash
docker compose cp backend:/app/media ./media_backup
docker compose cp ./media_backup/. backend:/app/media
```

### Troubleshooting

| Problem | Check | Typical fix |
| --- | --- | --- |
| App does not open | `docker compose ps` | Make sure all services are up |
| Backend error | `docker compose logs backend` | Check migrations and `.env` |
| 502 from Nginx | `docker compose restart backend` | Backend may still be starting |
| LAN access fails | `ipconfig` / `hostname -I` | Add the server IP to `ALLOWED_HOSTS` and CORS |
| Port 80 is busy | `netstat -ano \| findstr :80` | Change the Nginx host port |
| Uploaded images fail | `docker compose logs nginx` | Check media volume and proxy paths |

> **Data-loss warning:** the following reset permanently deletes the PostgreSQL
> database, Redis data, uploaded media, and collected static volumes for this
> Compose project. Run `./backup.sh backup` and verify it before continuing.

To reset everything and intentionally delete all named volumes:

```bash
docker compose down -v
docker compose up --build -d
```

### Customer Deployment

Customer deployments use prebuilt images and must not receive the application
source or run `--build`. In addition to the standard `.env` values, set the
versioned image references:

```env
INSIGHTFLOW_BACKEND_IMAGE=ghcr.io/nothingness-dev/insightflow-backend:<version>
INSIGHTFLOW_FRONTEND_IMAGE=ghcr.io/nothingness-dev/insightflow-frontend:<version>
HTTP_PORT=80
HTTPS_PORT=443
```

Replace `your-domain.com` in `nginx/nginx.ssl.conf`, and place the TLS
certificate and key at `ssl/fullchain.pem` and `ssl/privkey.pem`. For an
existing installation, create and verify a backup before pulling images:

```bash
COMPOSE_FILE="$PWD/docker-compose.customer.yml" ./backup.sh backup
COMPOSE_FILE="$PWD/docker-compose.customer.yml" ./backup.sh verify latest
docker compose --env-file .env -f docker-compose.customer.yml config
docker compose --env-file .env -f docker-compose.customer.yml pull backend frontend
docker compose --env-file .env -f docker-compose.customer.yml up -d
docker compose --env-file .env -f docker-compose.customer.yml ps
```

Named database and media volumes are preserved by `pull` and `up -d`. Never
run `docker compose down -v` during an upgrade. See [BACKUP.md](BACKUP.md) for
the complete backup and recovery workflow; [DEPLOYMENT.md](DEPLOYMENT.md)
covers source-build installations.

## Contributing

Contributions are welcome. For larger changes, open an issue first so the approach can be discussed before implementation.

Recommended workflow:

1. Fork the repository.
2. Create a branch from `main`.

```bash
git switch -c feature/your-feature-name
```

3. Make focused commits with clear messages.
4. Run the relevant checks.

```bash
npm --prefix frontend run typecheck
npm --prefix frontend run build
python backend/manage.py test apps.accounts apps.activity apps.surveys --settings=config.settings.test
```

5. Open a pull request targeting `main`.

Code standards:

- Backend changes should follow PEP 8 and include tests for new business logic.
- Frontend changes should use TypeScript types clearly and avoid unnecessary `any`.
- UI changes should preserve RTL/Persian behavior and responsive layouts.
- Bug reports should include reproduction steps, expected behavior, actual behavior, OS/Docker version, and relevant logs.

## Repository Notes

- `.env`, local SQLite databases, `node_modules`, and frontend build output are ignored.
- Keep screenshots in `screenshots/` so the README gallery keeps working.
- Keep secrets out of commits; use `.env.example` for documented configuration only.

## Project Docs

- [CHANGELOG.md](CHANGELOG.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [BACKUP.md](BACKUP.md)
- [DOCKER.md](DOCKER.md)
- [LICENSE](LICENSE)
