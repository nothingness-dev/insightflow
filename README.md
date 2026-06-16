# InsightFlow

![Version](https://img.shields.io/badge/version-1.1.0-blue)
![Docker](https://img.shields.io/badge/docker-ready-success)
![License](https://img.shields.io/badge/license-MIT-green)
![Backend](https://img.shields.io/badge/backend-Django%20REST%20Framework-092E20)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-61DAFB)

<div dir="rtl">

## سامانه مدرن نظرسنجی و ارزیابی سازمانی

**InsightFlow** یک پلتفرم داخلی برای مدیریت نظرسنجی‌ها، ارزیابی کارکنان و جمع‌آوری بازخورد سازمانی است.

این نسخه بر پایه نسخه به‌روزشده پروژه ساخته شده و تغییرات جدید مثل **تقویم شمسی اختصاصی**، **وضعیت انقضای نظرسنجی**، **توضیحات برای افراد داخل نظرسنجی**، **مدیریت کاربران** و **داشبورد کامل‌تر** را حفظ می‌کند؛ در عین حال با ساختار، برندینگ، Docker، README و اسکرین‌شات‌های نسخه سفارشی قبلی هماهنگ شده است.

[English version below ↓](#english)

---

## چرا InsightFlow؟

بسیاری از سازمان‌ها هنوز برای ارزیابی کارکنان و جمع‌آوری بازخورد از فایل‌های Excel، فرم‌های کاغذی یا ابزارهای پراکنده استفاده می‌کنند. InsightFlow یک سامانه متمرکز، ناشناس و قابل استقرار در شبکه داخلی ارائه می‌دهد تا فرآیند نظرسنجی، امتیازدهی و مشاهده نتایج ساده‌تر، امن‌تر و قابل پیگیری‌تر باشد.

---

## تصاویر پروژه

> این تصاویر برای README و ارائه پروژه آماده شده‌اند. پس از اجرای پروژه می‌توانید آن‌ها را با اسکرین‌شات‌های واقعی نسخه نهایی خود جایگزین کنید.

### صفحه ورود

![Login](screenshots/login.png)

### داشبورد مدیریت

![Dashboard](screenshots/dashboard.png)

### ایجاد نظرسنجی

![Survey Creation](screenshots/create-survey.png)

### ثبت ارزیابی توسط کارمند

![Voting](screenshots/voting.png)

### نتایج و رتبه‌بندی

![Results](screenshots/results.png)

---

## ویژگی‌های اصلی

- امتیازدهی ۱ تا ۱۰ برای هر فرد در نظرسنجی
- ثبت ارزیابی به صورت ناشناس
- جلوگیری از رأی تکراری برای هر کاربر
- تقویم شمسی/جلالی اختصاصی برای تاریخ شروع و پایان نظرسنجی
- تشخیص خودکار پایان مهلت نظرسنجی، جدا از وضعیت «بسته شده»
- امکان افزودن توضیحات برای هر فرد داخل نظرسنجی
- پنل مدیریت برای ایجاد، ویرایش، انتشار، بستن و مشاهده نتایج
- مدیریت کاربران، فعال/غیرفعال کردن حساب‌ها و ریست رمز عبور
- خروجی CSV و Excel از نتایج نهایی
- نمایش نتایج بر اساس میانگین، تعداد رأی، مجموع امتیاز و رتبه
- رابط کاربری فارسی و راست‌به‌چپ
- آماده برای استقرار در شبکه داخلی سازمان با Docker

---

## تکنولوژی‌ها

| بخش | تکنولوژی |
|---|---|
| Backend | Django 4.2 + Django REST Framework |
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Database | PostgreSQL 15 |
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

یا از داخل شبکه داخلی:

```text
http://<server-ip>
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

## تنظیمات فایل `.env`

بعد از کپی کردن `.env.example`، مقادیر مهم زیر را تنظیم کنید:

```env
SECRET_KEY=your-very-long-random-secret-key-here
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

DB_NAME=surveydb
DB_USER=surveyuser
DB_PASSWORD=change-this-strong-database-password

ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@1234
ADMIN_FULL_NAME=مدیر سیستم

MAX_UPLOAD_SIZE=2097152
CORS_ALLOWED_ORIGINS=http://localhost,http://127.0.0.1
```

> برای استفاده در شبکه داخلی، IP سرور را به `ALLOWED_HOSTS` و در صورت نیاز به `CORS_ALLOWED_ORIGINS` اضافه کنید.

---

## اطلاعات ورود اولیه

| فیلد | مقدار |
|---|---|
| نام کاربری | `admin` |
| رمز عبور | مقدار `ADMIN_PASSWORD` در فایل `.env` |

> پس از اولین ورود، رمز عبور مدیر را تغییر دهید و از رمزهای ساده یا نمونه استفاده نکنید.

---

<div dir="ltr">

## ساختار پروژه

```text
insightflow/
├── backend/
│   ├── apps/
│   │   ├── accounts/        # کاربران، نقش‌ها، JWT و مدیریت حساب‌ها
│   │   └── surveys/         # نظرسنجی‌ها، افراد، امتیازدهی و نتایج
│   ├── config/
│   │   └── settings/        # base/dev/prod settings
│   ├── Dockerfile
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/             # axios client و endpointها
│   │   ├── components/      # کامپوننت‌های عمومی و مدیریت
│   │   ├── contexts/        # AuthContext
│   │   ├── layouts/         # AdminLayout و EmployeeLayout
│   │   ├── pages/           # صفحات admin و employee
│   │   ├── routes/          # Route guards
│   │   ├── styles/
│   │   ├── types/
│   │   └── utils/
│   ├── Dockerfile
│   └── package.json
├── nginx/
│   └── nginx.conf
├── screenshots/
├── docker-compose.yml
├── .env.example
├── CHANGELOG.md
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

---

</div>

## API Endpoints

### احراز هویت

| متد | مسیر | توضیح |
|---|---|---|
| POST | `/api/auth/login/` | ورود و دریافت JWT |
| POST | `/api/auth/logout/` | خروج |
| POST | `/api/auth/refresh/` | دریافت access token جدید |
| GET | `/api/auth/me/` | اطلاعات کاربر جاری |

### مدیریت کاربران

| متد | مسیر | توضیح |
|---|---|---|
| GET, POST | `/api/admin/users/` | لیست / ایجاد کاربر |
| POST | `/api/admin/users/bulk-import/` | افزودن گروهی کاربران |
| GET, PATCH, DELETE | `/api/admin/users/:id/` | جزئیات / ویرایش / حذف کاربر |
| POST | `/api/admin/users/:id/reset-password/` | ریست رمز عبور |
| POST | `/api/admin/users/:id/activate/` | فعال‌سازی کاربر |
| POST | `/api/admin/users/:id/deactivate/` | غیرفعال‌سازی کاربر |

### مدیریت نظرسنجی‌ها

| متد | مسیر | توضیح |
|---|---|---|
| GET | `/api/admin/dashboard/` | آمار داشبورد مدیریت |
| POST | `/api/admin/delete-all-data/` | حذف داده‌های پروژه برای ریست کامل |
| GET, POST | `/api/admin/surveys/` | لیست / ایجاد نظرسنجی |
| GET, PATCH, DELETE | `/api/admin/surveys/:id/` | جزئیات / ویرایش / حذف |
| POST | `/api/admin/surveys/:id/publish/` | انتشار نظرسنجی |
| POST | `/api/admin/surveys/:id/close/` | بستن نظرسنجی |
| GET | `/api/admin/surveys/:id/results/` | نتایج ناشناس |
| GET | `/api/admin/surveys/:id/export/csv/` | خروجی CSV |
| GET | `/api/admin/surveys/:id/export/excel/` | خروجی Excel |
| GET, POST | `/api/admin/surveys/:id/people/` | لیست / افزودن فرد |
| PATCH, DELETE | `/api/admin/people/:id/` | ویرایش / حذف فرد |

### کاربران/کارکنان

| متد | مسیر | توضیح |
|---|---|---|
| GET | `/api/surveys/` | نظرسنجی‌های فعال/قابل مشاهده |
| GET | `/api/surveys/:id/` | جزئیات نظرسنجی و افراد |
| POST | `/api/surveys/:id/people/:pid/rate/` | ثبت امتیاز |
| GET | `/api/surveys/:id/my-ratings/` | وضعیت امتیازدهی کاربر |
| GET | `/api/surveys/:id/results/` | مشاهده نتایج مجاز برای کارمند |

---

## منطق ناشناس بودن

این سامانه از مدل «ورود اجباری با نتایج ناشناس» استفاده می‌کند:

- ورود کاربران برای جلوگیری از رأی تکراری ضروری است
- هر کاربر فقط یک بار می‌تواند به هر فرد در هر نظرسنجی امتیاز دهد
- نتایج شامل میانگین امتیاز، مجموع امتیاز، تعداد رأی و رتبه‌بندی هستند
- هویت رأی‌دهنده در نتایج نمایش داده نمی‌شود
- API نتایج نباید نام کاربری، شناسه رأی‌دهنده یا IP رأی‌دهنده را برگرداند

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

## پشتیبان‌گیری و بازیابی

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
- JWT برای احراز هویت استفاده می‌شود
- آپلود تصویر محدود به فرمت‌های مجاز و حجم مشخص است
- Unique constraint دیتابیسی از رأی تکراری جلوگیری می‌کند
- CORS و `ALLOWED_HOSTS` را متناسب با دامنه یا IP سرور تنظیم کنید

---

## عیب‌یابی

| مشکل | راه‌حل |
|---|---|
| سرویس‌ها اجرا نمی‌شوند | `docker compose logs backend` |
| دیتابیس آماده نیست | `docker compose restart backend` |
| پورت ۸۰ اشغال است | در `docker-compose.yml` پورت را به `8080:80` تغییر دهید |
| دسترسی از شبکه داخلی کار نمی‌کند | IP سرور را به `ALLOWED_HOSTS` اضافه کنید و فایروال را بررسی کنید |
| فایل‌های static نمایش داده نمی‌شوند | `docker compose exec backend python manage.py collectstatic --noinput` |

</div>

---

<a id="english"></a>

# English

## Modern Organizational Survey & Employee Evaluation Platform

**InsightFlow** is a modern internal survey and employee evaluation platform for organizations that need a secure, anonymous and self-hosted way to collect feedback, run assessments and generate ranked results.

This package keeps the updated application code and new functionality while aligning the repository branding, Docker documentation, README and screenshots with the previously customized InsightFlow version.

---

## Why InsightFlow?

Many organizations still rely on spreadsheets, paper forms or disconnected tools for employee evaluations. InsightFlow provides a centralized, anonymous and LAN-ready platform that simplifies internal assessments and feedback collection.

---

## Screenshots

> These screenshots are included for README and presentation purposes. Replace them with real screenshots after running your final deployment.

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
- Custom Persian/Jalali date picker
- Automatic survey expiry status separate from manual close status
- Optional rating/person descriptions
- Admin dashboard for creating, editing, publishing, closing and reviewing surveys
- User management, activation/deactivation and password reset
- CSV and Excel exports
- Ranking based on average score, vote count, total score and display order
- Persian RTL user interface
- Docker-based deployment
- LAN-ready architecture

---

## Technology Stack

| Layer | Technology |
|---|---|
| Backend | Django 4.2 + Django REST Framework |
| Frontend | React 18 + TypeScript + Tailwind CSS |
| Database | PostgreSQL 15 |
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

Or from your LAN:

```text
http://<server-ip>
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

## API Reference

### Authentication

| Method | Path | Description |
|---|---|---|
| POST | `/api/auth/login/` | Login and receive JWT |
| POST | `/api/auth/logout/` | Logout |
| POST | `/api/auth/refresh/` | Refresh access token |
| GET | `/api/auth/me/` | Current user info |

### User Management

| Method | Path | Description |
|---|---|---|
| GET, POST | `/api/admin/users/` | List / create users |
| POST | `/api/admin/users/bulk-import/` | Bulk import users |
| GET, PATCH, DELETE | `/api/admin/users/:id/` | Detail / edit / delete user |
| POST | `/api/admin/users/:id/reset-password/` | Reset password |
| POST | `/api/admin/users/:id/activate/` | Activate user |
| POST | `/api/admin/users/:id/deactivate/` | Deactivate user |

### Survey Management

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/dashboard/` | Admin dashboard statistics |
| POST | `/api/admin/delete-all-data/` | Reset project data |
| GET, POST | `/api/admin/surveys/` | List / create surveys |
| GET, PATCH, DELETE | `/api/admin/surveys/:id/` | Detail / edit / delete |
| POST | `/api/admin/surveys/:id/publish/` | Publish |
| POST | `/api/admin/surveys/:id/close/` | Close |
| GET | `/api/admin/surveys/:id/results/` | Anonymous results |
| GET | `/api/admin/surveys/:id/export/csv/` | CSV export |
| GET | `/api/admin/surveys/:id/export/excel/` | Excel export |
| GET, POST | `/api/admin/surveys/:id/people/` | List / add person |
| PATCH, DELETE | `/api/admin/people/:id/` | Edit / delete person |

### Employee

| Method | Path | Description |
|---|---|---|
| GET | `/api/surveys/` | Visible/active surveys |
| GET | `/api/surveys/:id/` | Survey detail with people |
| POST | `/api/surveys/:id/people/:pid/rate/` | Submit rating |
| GET | `/api/surveys/:id/my-ratings/` | User rating progress |
| GET | `/api/surveys/:id/results/` | Employee-visible results |

---

## Privacy & Anonymity

InsightFlow uses a mandatory-login but anonymous-results model:

- Login is required to prevent duplicate votes
- Each user can rate each person once per survey
- Results expose aggregate data such as average score, vote count, total score and ranking
- Voter identity is not shown in result pages
- Result APIs should not expose voter username, voter ID or voter IP

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
- JWT is used for authentication
- Restrict uploaded image types and size
- A database-level unique constraint prevents duplicate votes
- Configure CORS and `ALLOWED_HOSTS` for your actual domain or server IP

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Services do not start | `docker compose logs backend` |
| Database is not ready | `docker compose restart backend` |
| Port 80 is already in use | Change the port mapping to `8080:80` in `docker-compose.yml` |
| LAN access does not work | Add the server IP to `ALLOWED_HOSTS` and check firewall settings |
| Static files are missing | Run `docker compose exec backend python manage.py collectstatic --noinput` |

---

## Author

Roham  
Computer Engineering Student @ IUST  
GitHub: https://github.com/nothingness-dev

---

## License

MIT License

Copyright © 2026 Roham
