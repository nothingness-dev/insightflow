# InsightFlow

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Docker](https://img.shields.io/badge/docker-ready-success)
![License](https://img.shields.io/badge/license-MIT-green)

<div dir="rtl">

## سامانه نظرسنجی و ارزیابی سازمانی

InsightFlow یک پلتفرم مدرن برای مدیریت نظرسنجی‌ها، ارزیابی کارکنان و جمع‌آوری بازخورد در سازمان‌ها است.

این سامانه با تمرکز بر **ناشناس بودن ارزیابی‌ها**، **جلوگیری از رأی تکراری**، **رابط کاربری فارسی و راست‌به‌چپ** و **استقرار آسان با Docker** طراحی شده و برای شرکت‌ها، سازمان‌ها، مراکز آموزشی و بیمارستان‌ها مناسب است.

[English version below ↓](#english)

---

## چرا InsightFlow؟

بسیاری از سازمان‌ها هنوز برای ارزیابی کارکنان و جمع‌آوری بازخورد از فایل‌های Excel، فرم‌های کاغذی یا ابزارهای پراکنده استفاده می‌کنند. InsightFlow یک سامانه متمرکز، ناشناس و قابل استقرار در شبکه داخلی ارائه می‌دهد تا فرآیند نظرسنجی و ارزیابی سازمانی ساده‌تر، امن‌تر و قابل پیگیری‌تر باشد.

---

## تصاویر پروژه

> تصاویر زیر نمونه هستند. پس از اجرای پروژه می‌توانید آن‌ها را با اسکرین‌شات‌های واقعی از محیط خود جایگزین کنید.

### صفحه ورود

![Login](screenshots/login.png)

### داشبورد مدیریت

![Dashboard](screenshots/dashboard.png)

### ایجاد نظرسنجی

![Survey Creation](screenshots/create-survey.png)

### ثبت ارزیابی

![Voting](screenshots/voting.png)

### نتایج و رتبه‌بندی

![Results](screenshots/results.png)

---

## ویژگی‌های اصلی

- امتیازدهی ۱ تا ۱۰ برای هر فرد در نظرسنجی
- ثبت ارزیابی به صورت ناشناس
- جلوگیری از رأی تکراری برای هر کاربر
- تقویم شمسی/جلالی برای تاریخ شروع و پایان نظرسنجی
- وضعیت انقضا برای نظرسنجی‌های منتشرشده
- پنل مدیریت برای ایجاد، انتشار، بستن و مشاهده نتایج
- خروجی CSV و Excel از نتایج نهایی
- رابط کاربری فارسی و RTL
- آماده برای استقرار در شبکه داخلی سازمان

---

## تکنولوژی‌ها

| بخش | تکنولوژی |
|---|---|
| Backend | Django + Django REST Framework |
| Frontend | React + TypeScript + Tailwind CSS |
| Database | PostgreSQL |
| Authentication | JWT / SimpleJWT |
| Deployment | Docker + Docker Compose + Nginx + Gunicorn |

---

## پیش‌نیازها

- Docker نسخه ۲۰ یا بالاتر
- Docker Compose نسخه ۲ یا بالاتر
- اتصال اینترنت برای دانلود image های Docker در اجرای اول

---

## راه‌اندازی سریع با Docker

```bash
git clone https://github.com/nothingness-dev/insightflow.git
cd insightflow
cp .env.example .env
docker compose up --build -d
```

پس از اجرا:

```text
http://localhost
```

برای مشاهده وضعیت سرویس‌ها:

```bash
docker compose ps
```

برای مشاهده لاگ‌ها:

```bash
docker compose logs backend
docker compose logs nginx
```

---

## اطلاعات ورود اولیه

| فیلد | مقدار |
|---|---|
| نام کاربری | `admin` |
| رمز عبور | مقدار `ADMIN_PASSWORD` در فایل `.env` |

> پس از اولین ورود، رمز عبور مدیر را تغییر دهید و از رمزهای ساده یا نمونه استفاده نکنید.

---

## ساختار پروژه

```text
insightflow/
├── backend/
├── frontend/
├── nginx/
├── screenshots/
├── docker-compose.yml
├── .env.example
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## حریم خصوصی و ناشناس بودن

این سامانه از مدل «ورود اجباری با نتایج ناشناس» استفاده می‌کند:

- ورود کاربران برای جلوگیری از رأی تکراری ضروری است
- نتایج شامل میانگین امتیاز، تعداد رأی و رتبه‌بندی هستند
- هویت رأی‌دهنده در نتایج نمایش داده نمی‌شود
- API نباید نام کاربری، شناسه رأی‌دهنده یا IP رأی‌دهنده را در نتایج عمومی بازگرداند

---

## اجرای تست‌ها

```bash
docker compose exec backend python manage.py test apps.surveys apps.accounts --settings=config.settings.dev -v 2
```

---

## توسعه محلی بدون Docker

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
cp .env.example .env
cd backend
python manage.py migrate --settings=config.settings.dev
python manage.py create_admin_if_not_exists --settings=config.settings.dev
python manage.py runserver --settings=config.settings.dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

> پوشه `node_modules` نباید روی GitHub آپلود شود. فقط `package.json` و در صورت وجود `package-lock.json` داخل مخزن قرار می‌گیرند.

---

## پشتیبان‌گیری

```bash
# Backup database
docker compose exec db pg_dump -U surveyuser surveydb > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
docker compose exec -T db psql -U surveyuser surveydb < backup.sql

# Backup uploaded media
docker compose cp backend:/app/media ./media_backup
```

---

## نکات امنیتی

- مقدار `SECRET_KEY` را برای محیط واقعی تغییر دهید
- مقدار `ADMIN_PASSWORD` را با یک رمز قوی تنظیم کنید
- فایل `.env` را روی GitHub آپلود نکنید
- در محیط تولید از `DEBUG=False` استفاده کنید
- رمزهای عبور با الگوریتم امن Django هش می‌شوند
- آپلود تصویر محدود به فرمت‌های مجاز و حجم مشخص است
- CORS و `ALLOWED_HOSTS` را متناسب با دامنه یا IP سرور تنظیم کنید

---

## عیب‌یابی

| مشکل | راه‌حل |
|---|---|
| سرویس‌ها اجرا نمی‌شوند | `docker compose logs backend` |
| دیتابیس آماده نیست | `docker compose restart backend` |
| پورت ۸۰ اشغال است | در `docker-compose.yml` پورت را به `8080:80` تغییر دهید |
| دسترسی از شبکه داخلی کار نمی‌کند | IP سرور را به `ALLOWED_HOSTS` اضافه کنید و فایروال را بررسی کنید |

</div>

---

<a id="english"></a>

# English

## Modern Organizational Survey & Employee Evaluation Platform

InsightFlow is a modern internal survey and employee evaluation platform for organizations that need a secure, anonymous, and self-hosted way to collect feedback, run assessments, and generate ranked results.

It is built with Django, React, TypeScript, PostgreSQL, and Docker, with a Persian-first RTL interface suitable for internal organizational use.

---

## Why InsightFlow?

Many organizations still rely on spreadsheets, paper forms, or disconnected tools for employee evaluations. InsightFlow provides a centralized, anonymous, and LAN-ready platform that simplifies internal assessments and feedback collection.

---

## Screenshots

> These are placeholder screenshots. Replace them with real screenshots after running the project.

### Login Page

![Login](screenshots/login.png)

### Admin Dashboard

![Dashboard](screenshots/dashboard.png)

### Survey Creation

![Survey Creation](screenshots/create-survey.png)

### Employee Evaluation

![Voting](screenshots/voting.png)

### Results & Rankings

![Results](screenshots/results.png)

---

## Features

- Anonymous employee evaluations
- 1–10 rating system
- Duplicate vote prevention
- Persian/Jalali calendar support
- Survey expiry status
- Admin dashboard for creating, publishing, closing, and reviewing surveys
- CSV and Excel exports
- Persian RTL user interface
- Docker-based deployment
- LAN-ready architecture

---

## Technology Stack

| Layer | Technology |
|---|---|
| Backend | Django + Django REST Framework |
| Frontend | React + TypeScript + Tailwind CSS |
| Database | PostgreSQL |
| Authentication | JWT / SimpleJWT |
| Deployment | Docker + Docker Compose + Nginx + Gunicorn |

---

## Quick Start with Docker

```bash
git clone https://github.com/nothingness-dev/insightflow.git
cd insightflow
cp .env.example .env
docker compose up --build -d
```

Access the application:

```text
http://localhost
```

Check running services:

```bash
docker compose ps
```

View logs:

```bash
docker compose logs backend
docker compose logs nginx
```

---

## Initial Credentials

| Field | Value |
|---|---|
| Username | `admin` |
| Password | value of `ADMIN_PASSWORD` in `.env` |

> Change the administrator password after the first login and avoid weak/example passwords in real deployments.

---

## Project Structure

```text
insightflow/
├── backend/
├── frontend/
├── nginx/
├── screenshots/
├── docker-compose.yml
├── .env.example
├── README.md
├── CHANGELOG.md
├── CONTRIBUTING.md
└── LICENSE
```

---

## Privacy & Anonymity

InsightFlow uses a mandatory-login but anonymous-results model:

- Login is required to prevent duplicate votes
- Results expose aggregate data such as average score, vote count, and ranking
- Voter identity is not shown in result pages
- Public result APIs should not expose voter username, voter ID, or voter IP

---

## Running Tests

```bash
docker compose exec backend python manage.py test apps.surveys apps.accounts --settings=config.settings.dev -v 2
```

---

## Local Development without Docker

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cd ..
cp .env.example .env
cd backend
python manage.py migrate --settings=config.settings.dev
python manage.py create_admin_if_not_exists --settings=config.settings.dev
python manage.py runserver --settings=config.settings.dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

> Do not upload `node_modules` to GitHub. Only `package.json` and, if generated, `package-lock.json` should be committed.

---

## Backup & Restore

```bash
# Backup database
docker compose exec db pg_dump -U surveyuser surveydb > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore database
docker compose exec -T db psql -U surveyuser surveydb < backup.sql

# Backup uploaded media
docker compose cp backend:/app/media ./media_backup
```

---

## Security Notes

- Change `SECRET_KEY` before real deployment
- Set a strong `ADMIN_PASSWORD`
- Never commit `.env`
- Use `DEBUG=False` in production
- Passwords are hashed by Django
- Restrict uploaded image types and size
- Configure CORS and `ALLOWED_HOSTS` for your actual domain or server IP

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Services do not start | `docker compose logs backend` |
| Database is not ready | `docker compose restart backend` |
| Port 80 is already in use | Change the port mapping to `8080:80` in `docker-compose.yml` |
| LAN access does not work | Add the server IP to `ALLOWED_HOSTS` and check firewall settings |

---

## Author

Roham

Computer Engineering Student @ IUST

GitHub: https://github.com/nothingness-dev

---

## License

MIT License

Copyright © 2026 Roham
