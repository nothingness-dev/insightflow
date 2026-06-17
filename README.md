# InsightFlow

![Version](https://img.shields.io/badge/version-1.5.0-blue)
![Docker](https://img.shields.io/badge/docker-ready-success)
![License](https://img.shields.io/badge/license-MIT-green)
![Backend](https://img.shields.io/badge/backend-Django%20REST%20Framework-092E20)
![Frontend](https://img.shields.io/badge/frontend-React%20%2B%20TypeScript-61DAFB)

<div dir="rtl">

## سامانه مدرن نظرسنجی و ارزیابی سازمانی

**InsightFlow** یک پلتفرم داخلی برای مدیریت نظرسنجی‌ها، ارزیابی کارکنان و جمع‌آوری بازخورد سازمانی است.

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

### ایجاد نظرسنجی با سوالات چندگانه
![Survey Creation](screenshots/create-survey.png)

### ثبت ارزیابی توسط کارمند (گام‌به‌گام)
![Voting](screenshots/voting.png)

### نتایج و رتبه‌بندی
![Results](screenshots/results.png)

---

## ویژگی‌های اصلی

- **نظرسنجی با سوالات چندگانه** — هر نظرسنجی می‌تواند چند سوال داشته باشد
- **تنظیم نوع ورودی هر سوال** — امتیاز کمی (۱–۱۰)، توضیحات متنی، یا هر دو
- **اجباری یا اختیاری بودن** — برای هر سوال، امتیاز و توضیحات می‌توانند مستقل از هم اجباری باشند
- **ثبت ارزیابی گام‌به‌گام** — کارمندان سوال به سوال پاسخ می‌دهند و قبل از ارسال بین سوالات جابه‌جا می‌شوند
- **ارزیابی ناشناس** — هویت رأی‌دهنده در نتایج نمایش داده نمی‌شود
- **جلوگیری از رأی تکراری** — هر کاربر فقط یک بار می‌تواند به هر فرد در نظرسنجی پاسخ دهد
- **امتیازدهی اجباری به همه افراد** — کارمند باید به تمام افراد نظرسنجی پاسخ دهد
- **پنل مدیریت کامل** — ایجاد، ویرایش، انتشار، بستن و مشاهده نتایج
- **نتایج به تفکیک سوال** — رتبه‌بندی کلی و نتایج مجزا برای هر سوال
- **مدیریت کاربران** — فعال/غیرفعال کردن، ریست رمز، حذف، و آپلود دسته‌ای از CSV
- **خروجی CSV و Excel** — ستون‌های مجزا برای هر سوال
- **تغییر تم رنگی** — چهار تم بنفش، آبی، سبز، قرمز با یک کلیک
- **رابط کاربری فارسی و راست‌به‌چپ**
- **آماده برای استقرار در شبکه داخلی با Docker**

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

> **پس از هر بار به‌روزرسانی که migration جدید داشته باشد:**
> ```bash
> docker compose exec backend python manage.py migrate
> ```

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

> برای استفاده در شبکه داخلی، IP سرور را به `ALLOWED_HOSTS` و `CORS_ALLOWED_ORIGINS` اضافه کنید.

---

## اطلاعات ورود اولیه

| فیلد | مقدار |
|---|---|
| نام کاربری | `admin` |
| رمز عبور | مقدار `ADMIN_PASSWORD` در فایل `.env` |

> پس از اولین ورود، رمز عبور مدیر را تغییر دهید.

---

<div dir="ltr">

## ساختار پروژه

```text
insightflow/
├── backend/
│   ├── apps/
│   │   ├── accounts/        # کاربران، نقش‌ها، JWT
│   │   └── surveys/         # نظرسنجی‌ها، سوالات، افراد، پاسخ‌ها، نتایج
│   ├── config/
│   │   └── settings/        # base/dev/prod settings
│   ├── Dockerfile
│   ├── manage.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── api/             # axios client و endpoints
│   │   ├── components/      # کامپوننت‌های عمومی و مدیریت
│   │   ├── contexts/        # AuthContext، ThemeContext
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
├── DEPLOYMENT.md
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
| DELETE | `/api/admin/delete-all-data/` | حذف تمام داده‌ها |
| GET, POST | `/api/admin/surveys/` | لیست / ایجاد نظرسنجی |
| GET, PATCH, DELETE | `/api/admin/surveys/:id/` | جزئیات / ویرایش / حذف |
| POST | `/api/admin/surveys/:id/publish/` | انتشار نظرسنجی |
| POST | `/api/admin/surveys/:id/close/` | بستن نظرسنجی |
| GET | `/api/admin/surveys/:id/results/` | نتایج ناشناس + سوالات |
| GET | `/api/admin/surveys/:id/export/csv/` | خروجی CSV |
| GET | `/api/admin/surveys/:id/export/excel/` | خروجی Excel |
| GET, POST | `/api/admin/surveys/:id/people/` | لیست / افزودن فرد |
| PATCH, DELETE | `/api/admin/people/:id/` | ویرایش / حذف فرد |

### کاربران/کارکنان

| متد | مسیر | توضیح |
|---|---|---|
| GET | `/api/surveys/` | نظرسنجی‌های فعال/بسته |
| GET | `/api/surveys/:id/` | جزئیات نظرسنجی + سوالات + افراد |
| POST | `/api/surveys/:id/people/:pid/submit/` | ارسال پاسخ‌های همه سوالات برای یک فرد |
| GET | `/api/surveys/:id/my-ratings/` | وضعیت پاسخ‌دهی کاربر |

---

## منطق ناشناس بودن

این سامانه از مدل «ورود اجباری با نتایج ناشناس» استفاده می‌کند:

- ورود کاربران برای جلوگیری از رأی تکراری ضروری است
- هر کاربر فقط یک بار می‌تواند به هر فرد در هر نظرسنجی پاسخ دهد
- نتایج شامل میانگین امتیاز، مجموع، تعداد رأی و رتبه‌بندی هستند
- هویت رأی‌دهنده در هیچ بخشی از نتایج نمایش داده نمی‌شود
- توضیحات متنی بدون اطلاعات هویتی ذخیره و نمایش داده می‌شوند

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
| خطای 500 هنگام ایجاد نظرسنجی | مطمئن شوید migration `0005` اجرا شده: `docker compose exec backend python manage.py migrate` |

</div>

---

<a id="english"></a>

# English

## Modern Organizational Survey & Employee Evaluation Platform

**InsightFlow** is a modern internal survey and employee evaluation platform for organizations that need a secure, anonymous and self-hosted way to collect feedback, run multi-question assessments and generate ranked results.

---

## Why InsightFlow?

Many organizations still rely on spreadsheets, paper forms or disconnected tools for employee evaluations. InsightFlow provides a centralized, anonymous and LAN-ready platform that simplifies internal assessments and feedback collection.

---

## Screenshots

> Replace these with real screenshots after running your final deployment.

### Login Page
![Login](screenshots/login.png)

### Admin Dashboard
![Dashboard](screenshots/dashboard.png)

### Survey Creation (Multi-Question Builder)
![Survey Creation](screenshots/create-survey.png)

### Employee Evaluation (Step-by-Step)
![Voting](screenshots/voting.png)

### Results & Rankings
![Results](screenshots/results.png)

---

## Features

- **Multi-question surveys** — each survey can have multiple questions
- **Per-question input types** — numeric score (1–10), free-text comment, or both
- **Required / optional per input** — score and comment can be independently required or optional per question
- **Step-by-step voting** — employees answer one question at a time, navigating forward/back before final submission
- **Anonymous evaluations** — voter identity never exposed in results
- **Duplicate vote prevention** — each user can submit responses for each person only once
- **All-or-nothing participation** — employees must respond to all people in a survey
- **Full admin panel** — create, edit, publish, close and review surveys
- **Results by question** — overall ranking tab + per-question breakdown tab
- **User management** — activate/deactivate, password reset, delete, bulk CSV import
- **CSV and Excel exports** — separate columns per question
- **Four color themes** — purple, blue, green, red; saved in localStorage
- **Persian RTL UI**
- **Docker-based LAN deployment**

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

> **After any update that includes new migrations:**
> ```bash
> docker compose exec backend python manage.py migrate
> ```

---

## Initial Credentials

| Field | Value |
|---|---|
| Username | `admin` |
| Password | value of `ADMIN_PASSWORD` in `.env` |

> Change the administrator password after the first login.

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
├── DEPLOYMENT.md
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
| POST | `/api/admin/users/bulk-import/` | Bulk import users from CSV/TXT |
| GET, PATCH, DELETE | `/api/admin/users/:id/` | Detail / edit / delete user |
| POST | `/api/admin/users/:id/reset-password/` | Reset password |
| POST | `/api/admin/users/:id/activate/` | Activate user |
| POST | `/api/admin/users/:id/deactivate/` | Deactivate user |

### Survey Management

| Method | Path | Description |
|---|---|---|
| GET | `/api/admin/dashboard/` | Admin dashboard statistics |
| DELETE | `/api/admin/delete-all-data/` | Reset all survey data |
| GET, POST | `/api/admin/surveys/` | List / create surveys |
| GET, PATCH, DELETE | `/api/admin/surveys/:id/` | Detail / edit / delete (includes questions) |
| POST | `/api/admin/surveys/:id/publish/` | Publish |
| POST | `/api/admin/surveys/:id/close/` | Close |
| GET | `/api/admin/surveys/:id/results/` | Anonymous results with per-question breakdown |
| GET | `/api/admin/surveys/:id/export/csv/` | CSV export (one column set per question) |
| GET | `/api/admin/surveys/:id/export/excel/` | Excel export (one column set per question) |
| GET, POST | `/api/admin/surveys/:id/people/` | List / add person |
| PATCH, DELETE | `/api/admin/people/:id/` | Edit / delete person |

### Employee

| Method | Path | Description |
|---|---|---|
| GET | `/api/surveys/` | Active and closed surveys |
| GET | `/api/surveys/:id/` | Survey detail with questions and people |
| POST | `/api/surveys/:id/people/:pid/submit/` | Submit all question responses for one person |
| GET | `/api/surveys/:id/my-ratings/` | User response progress |

---

## Privacy & Anonymity

InsightFlow uses a mandatory-login but anonymous-results model:

- Login is required to prevent duplicate responses
- Each user can submit responses for each person once per survey
- Results expose only aggregate data: average score, vote count, total score, ranking
- Voter identity is never shown in results or exports
- Text comments are stored and displayed without any voter information

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
- Uploaded image types and size are restricted
- A database-level unique constraint prevents duplicate responses
- Configure CORS and `ALLOWED_HOSTS` for your actual domain or server IP

---

## Troubleshooting

| Problem | Solution |
|---|---|
| Services do not start | `docker compose logs backend` |
| Database is not ready | `docker compose restart backend` |
| Port 80 is already in use | Change mapping to `8080:80` in `docker-compose.yml` |
| LAN access does not work | Add server IP to `ALLOWED_HOSTS` and check firewall |
| Static files are missing | `docker compose exec backend python manage.py collectstatic --noinput` |
| 500 error on survey create | Run migrations: `docker compose exec backend python manage.py migrate` |

---

## Author

Roham
Computer Engineering Student @ IUST
GitHub: https://github.com/nothingness-dev

---

## License

MIT License

Copyright © 2026 Roham
