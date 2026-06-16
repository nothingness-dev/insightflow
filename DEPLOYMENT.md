# راهنمای کامل نصب و راه‌اندازی InsightFlow
# Full Deployment Guide

---

<div dir="rtl">

## فهرست مطالب

1. [پیش‌نیازها](#پیش‌نیازها)
2. [نصب سریع (شبکه محلی)](#نصب-سریع)
3. [تغییر آدرس از localhost به آدرس دلخواه](#تغییر-آدرس)
4. [تنظیمات فایل .env](#تنظیمات-env)
5. [اجرا و مدیریت](#اجرا-و-مدیریت)
6. [اولین ورود و راه‌اندازی اولیه](#راه‌اندازی-اولیه)
7. [دسترسی از سایر دستگاه‌های شبکه](#دسترسی-از-شبکه)
8. [پشتیبان‌گیری](#پشتیبان‌گیری)
9. [عیب‌یابی](#عیب‌یابی)

---

## پیش‌نیازها

روی سرور یا کامپیوتری که می‌خواهید سیستم روی آن باشد، فقط یک چیز لازم است:

### نصب Docker Desktop (ویندوز / مک)
1. به آدرس https://www.docker.com/products/docker-desktop بروید
2. نسخه مناسب سیستم‌عامل خود را دانلود کنید
3. نصب کنید و Docker Desktop را اجرا کنید
4. صبر کنید تا آیکون Docker در taskbar سبز شود

### نصب Docker روی لینوکس (Ubuntu/Debian)
```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# خروج و ورود مجدد به سیستم
```

---

## نصب سریع

### مرحله ۱ — دانلود و آماده‌سازی پروژه

فایل zip پروژه را دانلود کرده و در مکانی مناسب extract کنید:
- **ویندوز:** مثلاً `C:\InsightFlow\`
- **مک/لینوکس:** مثلاً `~/insightflow/`

### مرحله ۲ — ساخت فایل .env

در پوشه پروژه، فایلی با نام `.env` بسازید (نه `.env.txt`).

**در ویندوز:** در Notepad فایل را باز کنید، محتوا را وارد کنید، و هنگام ذخیره در "Save as type" گزینه "All Files" را انتخاب کنید و نام فایل را `.env` بگذارید.

**در مک/لینوکس:**
```bash
cp .env.example .env
nano .env
```

محتوای فایل `.env`:
```env
SECRET_KEY=یک-رشته-تصادفی-بلند-حداقل-۵۰-کاراکتر-اینجا-وارد-کنید
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0

DB_NAME=surveydb
DB_USER=surveyuser
DB_PASSWORD=یک-رمز-عبور-قوی-برای-دیتابیس

ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@1234
ADMIN_FULL_NAME=مدیر سیستم

MAX_UPLOAD_SIZE=2097152
CORS_ALLOWED_ORIGINS=http://localhost,http://127.0.0.1
```

> **نکته:** `SECRET_KEY` باید یک رشته تصادفی طولانی باشد. می‌توانید از این سایت استفاده کنید: https://djecrety.ir

### مرحله ۳ — اجرا

پنجره Command Prompt یا Terminal را در پوشه پروژه باز کنید:

```bash
docker compose up --build -d
```

اولین بار ممکن است ۵ تا ۱۰ دقیقه طول بکشد (دانلود تصاویر Docker).

### مرحله ۴ — بررسی وضعیت

```bash
docker compose ps
```

همه سرویس‌ها باید وضعیت `Up` داشته باشند:
```
NAME                STATUS
insightflow-db      Up (healthy)
insightflow-backend Up
insightflow-frontend Up
insightflow-nginx   Up
```

### مرحله ۵ — ورود به سیستم

مرورگر را باز کنید و به آدرس زیر بروید:
```
http://localhost
```

با اطلاعات زیر وارد شوید:
- نام کاربری: `admin`
- رمز عبور: مقدار `ADMIN_PASSWORD` که در `.env` تنظیم کردید

---

## تغییر آدرس

### تغییر از `localhost` به آدرس دلخواه (مثلاً `survey.company.local`)

این یکی از رایج‌ترین نیازها در شبکه‌های سازمانی است.

#### روش ۱ — استفاده از آدرس IP سرور (ساده‌ترین روش)

IP آدرس سرور را پیدا کنید:
```bash
# ویندوز
ipconfig

# مک/لینوکس
ip addr show   # یا: hostname -I
```

مثلاً اگر IP سرور `192.168.1.100` باشد، کافی است:

**فایل `.env` را ویرایش کنید:**
```env
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,192.168.1.100
CORS_ALLOWED_ORIGINS=http://localhost,http://127.0.0.1,http://192.168.1.100
```

سپس restart کنید:
```bash
docker compose restart backend
```

حالا از هر دستگاه در شبکه می‌توان به این آدرس رفت:
```
http://192.168.1.100
```

---

#### روش ۲ — استفاده از نام دلخواه (مثلاً `survey.company.local`)

این روش نیاز به تنظیم DNS یا hosts file دارد.

**گام ۱ — تنظیم hosts file در هر دستگاه کاربران:**

*ویندوز:* فایل `C:\Windows\System32\drivers\etc\hosts` را با Notepad (به عنوان Administrator) باز کنید و این خط را اضافه کنید:
```
192.168.1.100    survey.company.local
```

*مک/لینوکس:* فایل `/etc/hosts` را ویرایش کنید:
```bash
sudo nano /etc/hosts
# این خط را اضافه کنید:
192.168.1.100    survey.company.local
```

**گام ۲ — فایل `.env` پروژه را ویرایش کنید:**
```env
ALLOWED_HOSTS=localhost,127.0.0.1,0.0.0.0,192.168.1.100,survey.company.local
CORS_ALLOWED_ORIGINS=http://localhost,http://survey.company.local,http://192.168.1.100
```

**گام ۳ — فایل `nginx/nginx.conf` را ویرایش کنید:**

خط `server_name _;` را به این تغییر دهید:
```nginx
server_name survey.company.local 192.168.1.100 localhost;
```

**گام ۴ — Rebuild کنید:**
```bash
docker compose down
docker compose up --build -d
```

حالا کاربران می‌توانند با آدرس زیر وارد شوند:
```
http://survey.company.local
```

---

#### روش ۳ — استفاده از پورت دلخواه (اگر پورت ۸۰ اشغال است)

فایل `docker-compose.yml` را باز کنید و قسمت `ports` در سرویس `nginx` را تغییر دهید:

```yaml
nginx:
  ports:
    - "8080:80"   # یا هر پورت دیگری
```

سپس:
```bash
docker compose down
docker compose up -d
```

آدرس دسترسی:
```
http://192.168.1.100:8080
```

---

## تنظیمات env

| متغیر | توضیح | مثال |
|-------|-------|------|
| `SECRET_KEY` | کلید امنیتی Django (حداقل ۵۰ کاراکتر) | `abc123...xyz789` |
| `DEBUG` | همیشه `False` در محیط تولید | `False` |
| `ALLOWED_HOSTS` | آدرس‌های مجاز برای دسترسی | `localhost,192.168.1.100` |
| `DB_NAME` | نام دیتابیس | `surveydb` |
| `DB_USER` | کاربر دیتابیس | `surveyuser` |
| `DB_PASSWORD` | رمز دیتابیس (قوی باشد) | `MyStr0ng@Pass` |
| `ADMIN_USERNAME` | نام کاربری مدیر اول | `admin` |
| `ADMIN_PASSWORD` | رمز مدیر اول | `Admin@1234` |
| `ADMIN_FULL_NAME` | نام کامل مدیر | `مدیر سیستم` |
| `CORS_ALLOWED_ORIGINS` | آدرس‌های مجاز برای API | `http://192.168.1.100` |

---

## اجرا و مدیریت

```bash
# اجرای اولیه (build + start)
docker compose up --build -d

# اجرای مجدد بدون rebuild
docker compose up -d

# متوقف کردن
docker compose down

# مشاهده وضعیت
docker compose ps

# مشاهده لاگ‌ها
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f nginx

# ری‌استارت یک سرویس خاص
docker compose restart backend

# اعمال migration جدید
docker compose exec backend python manage.py migrate

# باز کردن Django admin (مدیریت پیشرفته)
# آدرس: http://localhost/django-admin/
```

---

## راه‌اندازی اولیه

پس از اولین ورود به سیستم، این مراحل را انجام دهید:

### ۱. تغییر رمز عبور مدیر
- وارد پنل مدیریت شوید
- به بخش «کارکنان» بروید
- روی حساب admin کلیک کنید و رمز را تغییر دهید

### ۲. ایجاد حساب کارمندان
دو روش وجود دارد:

**روش تکی:** در بخش «کارکنان» دکمه «کاربر جدید» را بزنید.

**روش دسته‌ای (توصیه‌شده برای تعداد زیاد):**
- دکمه «آپلود فایل» را بزنید
- یک فایل CSV یا TXT با این فرمت آماده کنید:
```
username,نام کامل,رمز عبور,نقش
ali_mohammadi,علی محمدی,Pass@1234,employee
sara_ahmadi,سارا احمدی,Pass@5678,employee
manager1,مدیر واحد,Admin@9012,admin
```
- فایل را drag & drop کنید یا انتخاب کنید
- «آپلود و ایجاد کاربران» را بزنید

### ۳. ایجاد اولین نظرسنجی
- به «نظرسنجی‌ها» بروید
- «نظرسنجی جدید» را بزنید
- عنوان و سوال اصلی را وارد کنید
- افراد مورد نظرسنجی را اضافه کنید (عکس و توضیحات اختیاری است)
- برای شروع نظرسنجی دکمه «انتشار» را بزنید
- برای پایان دادن دکمه «بستن» را بزنید

---

## دسترسی از شبکه

برای اینکه کارمندان بتوانند از کامپیوتر خودشان وارد شوند:

1. **آدرس IP سرور را به آن‌ها بدهید** (مثلاً `http://192.168.1.100`)
2. **یا نام دامنه محلی** (مثلاً `http://survey.company.local`) — در این صورت باید hosts file هر دستگاه تنظیم شود (روش ۲ بالا)
3. مطمئن شوید **فایروال ویندوز** پورت ۸۰ را مسدود نکرده:

```powershell
# در PowerShell به عنوان Administrator:
netsh advfirewall firewall add rule name="InsightFlow HTTP" dir=in action=allow protocol=TCP localport=80
```

---

## پشتیبان‌گیری

### پشتیبان از دیتابیس
```bash
# ذخیره در فایل با تاریخ
docker compose exec db pg_dump -U surveyuser surveydb > backup_$(date +%Y%m%d_%H%M%S).sql
```

### بازیابی دیتابیس
```bash
docker compose exec -T db psql -U surveyuser surveydb < backup_20240101_120000.sql
```

### پشتیبان از تصاویر آپلودشده
```bash
docker compose cp backend:/app/media ./media_backup
```

### بازیابی تصاویر
```bash
docker compose cp ./media_backup/. backend:/app/media
```

---

## عیب‌یابی

| مشکل | دستور بررسی | راه‌حل |
|------|------------|--------|
| سیستم باز نمی‌شود | `docker compose ps` | سرویس‌ها را چک کنید |
| خطای backend | `docker compose logs backend` | معمولاً مشکل migration یا .env |
| خطای ۵۰۲ | `docker compose restart backend` | backend هنوز آماده نشده |
| از شبکه دسترسی نیست | `ipconfig` / `ip addr` | IP را در ALLOWED_HOSTS اضافه کنید |
| پورت ۸۰ اشغال است | `netstat -ano \| findstr :80` | پورت را در docker-compose.yml تغییر دهید |
| دیتابیس پیدا نمی‌شود | `docker compose logs db` | `docker compose restart backend` |
| تصاویر نمایش نمی‌دهد | `docker compose logs nginx` | media volume را بررسی کنید |

### ری‌ست کامل (از صفر شروع کنید)
```bash
# ⚠️ تمام داده‌ها پاک می‌شوند
docker compose down -v
docker compose up --build -d
```

---

## اطلاعات فنی

| بخش | تکنولوژی |
|-----|----------|
| Backend | Django 4.2 + DRF + Gunicorn |
| Frontend | React 18 + TypeScript + Tailwind |
| Database | PostgreSQL 15 |
| Web Server | Nginx |
| Auth | JWT |
| Deployment | Docker Compose |

**پورت‌های استفاده‌شده:** فقط پورت `80` (یا هر پورتی که تنظیم کنید) به خارج expose می‌شود. بقیه پورت‌ها داخلی هستند.

</div>

---

# English Summary

## Quick Start

1. Install Docker Desktop from https://docker.com
2. Copy `.env.example` to `.env` and fill in values
3. Run: `docker compose up --build -d`
4. Open `http://localhost` in browser
5. Login with `admin` / your `ADMIN_PASSWORD`

## Change URL from localhost

**Use server IP (easiest):**
- Find server IP: `ipconfig` (Windows) or `hostname -I` (Linux)
- Add IP to `.env`: `ALLOWED_HOSTS=localhost,127.0.0.1,192.168.1.100`
- Add to CORS: `CORS_ALLOWED_ORIGINS=http://localhost,http://192.168.1.100`
- Restart: `docker compose restart backend`
- Access from any device: `http://192.168.1.100`

**Use custom name (e.g. `survey.company.local`):**
- Add to each user's hosts file: `192.168.1.100  survey.company.local`
- Update `.env` ALLOWED_HOSTS and CORS_ALLOWED_ORIGINS to include the name
- Update `nginx/nginx.conf` server_name to include the name
- Rebuild: `docker compose down && docker compose up --build -d`
