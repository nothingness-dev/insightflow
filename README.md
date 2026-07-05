# InsightFlow

<div dir="rtl">

## نظرسنجی کارکنان — InsightFlow

InsightFlow یک پلتفرم فارسی‌زبان نظرسنجی کارکنان است که برای جمع‌آوری بازخورد ناشناس و شناسه‌دار در سازمان‌ها طراحی شده. این پروژه با Django (بک‌اند) و React + TypeScript (فرانت‌اند) ساخته شده و به‌طور کامل از راست‌به‌چپ (RTL) و زبان فارسی پشتیبانی می‌کند.

### امکانات اصلی

- ساخت نظرسنجی‌های چندسؤالی با انواع مختلف پرسش و امتیازدهی (از جمله ایموجی)
- شرکت شناسه‌دار کارکنان و پیگیری پیشرفت آن‌ها
- **لینک‌های ناشناس (Hash Link)** برای مشارکت بدون نیاز به حساب کاربری، با قابلیت‌های زیر:
  - تولید کد QR برای هر لینک
  - **قفل خودکار بر اساس IP** برای جلوگیری از شرکت تکراری در هر لینک
  - **محدودیت تعداد شرکت‌کنندگان** برای هر لینک (اختیاری)
  - **انقضای زمان‌دار لینک** بر حسب ساعت، روز یا هفته (اختیاری، بدون نیاز به انتخاب تاریخ دقیق)
- خروجی گرفتن از نتایج به‌صورت Excel، CSV و PDF با پشتیبانی کامل از متن فارسی و راست‌به‌چپ
- داشبورد مدیریتی با نمودارهای زنده و کش شده در Redis برای عملکرد بهتر
- ثبت کامل رویدادها (Activity Log) برای تمام عملیات حساس مدیریتی، با امکان باز کردن هر ردیف و مشاهده جزئیات کامل (IP، توکن لینک، محدودیت‌ها و غیره)

### تکنولوژی‌ها

- **بک‌اند:** Django, Django REST Framework, PostgreSQL, Redis, Celery-ready cache invalidation
- **فرانت‌اند:** React, TypeScript, TailwindCSS, Vite
- **زیرساخت:** Docker Compose (db, redis, backend, frontend)

### راه‌اندازی سریع

```bash
cp .env.example .env
# مقادیر .env را طبق نیاز خود تنظیم کنید

docker compose up -d --build
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

سپس فرانت‌اند روی آدرس تنظیم‌شده در `VITE_PUBLIC_BASE_URL` در دسترس است.

### مدیریت لینک‌های ناشناس

از صفحه جزئیات هر نظرسنجی، بخش «لینک‌های ناشناس» امکانات زیر را در اختیار ادمین قرار می‌دهد:

1. ایجاد لینک جدید با نام دلخواه
2. فعال/غیرفعال کردن هر لینک
3. تعیین (اختیاری) حداکثر تعداد شرکت‌کنندگان — با تکمیل ظرفیت، لینک برای شرکت‌کنندگان جدید بسته می‌شود
4. تعیین (اختیاری) مهلت انقضا بر حسب ساعت/روز/هفته — پس از سررسید، لینک به‌طور خودکار غیرقابل‌استفاده می‌شود

تمام این تنظیمات به‌صورت کامل بین فرانت‌اند، بک‌اند، دیتابیس و کش Redis هماهنگ شده‌اند. تمام رویدادهای مهم مربوط به این لینک‌ها (ایجاد، تغییر وضعیت، تغییر محدودیت‌ها) در بخش «گزارش فعالیت‌ها» با جزئیات کامل ثبت و قابل مشاهده هستند.

</div>

---

## InsightFlow (English)

InsightFlow is a Persian-language employee survey platform for collecting both identified and anonymous feedback inside organizations. It's built with Django (backend) and React + TypeScript (frontend), with full RTL and Persian-language support.

### Key Features

- Multi-question surveys with multiple question/rating types (including emoji ratings)
- Identified employee participation with progress tracking
- **Anonymous hash links** for account-free participation, including:
  - QR code generation per link
  - **Automatic IP-based locking** to prevent duplicate submissions
  - **Optional per-link participant limit**
  - **Optional link expiry duration** in hours, days, or weeks (no fixed date required)
- Styled Excel/CSV/PDF exports with full Persian RTL text support
- Admin dashboard with Redis-cached live charts
- Full activity logging for sensitive admin operations, with expandable rows showing full metadata (IPs, tokens, limits, etc.) directly in the audit log

### Tech Stack

- **Backend:** Django, Django REST Framework, PostgreSQL, Redis
- **Frontend:** React, TypeScript, TailwindCSS, Vite
- **Infrastructure:** Docker Compose (db, redis, backend, frontend)

### Quick Start

```bash
cp .env.example .env
# fill in the values in .env

docker compose up -d --build
docker compose exec backend python manage.py migrate
docker compose exec backend python manage.py createsuperuser
```

### Managing Anonymous Hash Links

From a survey's detail page, the "Anonymous Links" panel lets admins:

1. Create a new link with an optional label
2. Toggle each link active/inactive
3. Optionally cap the number of participants — once full, the link stops accepting new anonymous participants
4. Optionally set an expiry duration in hours/days/weeks — the link automatically becomes unusable once it lapses

These settings are fully wired end-to-end across the frontend, backend, database, and Redis cache. Every notable event on these links (creation, activation toggles, limit changes) is recorded with full detail in the Activity Log / audit trail.

### Testing

```bash
docker compose exec backend python manage.py test apps.surveys --settings=config.settings.dev
```

See `CONTRIBUTING.md` for contribution guidelines and `CHANGELOG.md` for release history.
