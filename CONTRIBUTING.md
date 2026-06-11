# Contributing / مشارکت در توسعه

<div dir="rtl">

## راهنمای مشارکت

از مشارکت شما در بهبود این پروژه استقبال می‌کنیم.

### قبل از شروع

- ابتدا [Issues](../../issues) موجود را بررسی کنید تا مطمئن شوید مشکل یا ویژگی مورد نظر قبلاً گزارش نشده است
- برای تغییرات بزرگ، ابتدا یک Issue باز کنید و موضوع را مطرح کنید

### فرآیند مشارکت

1. **Fork** کردن مخزن
2. ساخت branch جدید از `main`:
   ```bash
   git checkout -b feature/your-feature-name
   # یا
   git checkout -b fix/your-bug-fix
   ```
3. اعمال تغییرات و نوشتن commit های واضح:
   ```bash
   git commit -m "feat: add Persian date range validation"
   git commit -m "fix: expired badge not showing on employee list"
   ```
4. اجرای تست‌ها:
   ```bash
   docker compose exec backend python manage.py test apps.surveys --settings=config.settings.dev
   ```
5. ارسال Pull Request به branch `main`

### استانداردهای کد

**Backend (Python/Django):**
- پیروی از [PEP 8](https://peps.python.org/pep-0008/)
- نوشتن docstring برای توابع و کلاس‌های جدید
- تست برای هر منطق جدید

**Frontend (TypeScript/React):**
- استفاده از TypeScript با تعریف کامل type ها
- کامپوننت‌های functional با hooks
- نام‌گذاری واضح برای prop ها و state ها

### گزارش باگ

هنگام باز کردن یک Issue برای باگ، لطفاً موارد زیر را ذکر کنید:
- مراحل بازتولید مشکل
- رفتار مورد انتظار در مقابل رفتار فعلی
- نسخه سیستم‌عامل و Docker
- خروجی `docker compose logs` مرتبط

</div>

---

## Contributing Guide (English)

Contributions are welcome! Please follow these steps.

### Before You Start

- Check existing [Issues](../../issues) to avoid duplicates
- For large changes, open an Issue first to discuss the approach

### Workflow

1. **Fork** the repository
2. Create a branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/your-bug-fix
   ```
3. Make your changes with clear commits:
   ```bash
   git commit -m "feat: add Persian date range validation"
   git commit -m "fix: expired badge not showing on employee list"
   ```
4. Run the tests:
   ```bash
   docker compose exec backend python manage.py test apps.surveys --settings=config.settings.dev
   ```
5. Open a Pull Request targeting `main`

### Code Standards

**Backend (Python/Django):**
- Follow [PEP 8](https://peps.python.org/pep-0008/)
- Add docstrings to new functions and classes
- Write tests for new business logic

**Frontend (TypeScript/React):**
- Use TypeScript with proper type definitions (avoid `any`)
- Functional components with hooks only
- Clear prop and state naming

### Bug Reports

When filing a bug Issue, please include:
- Steps to reproduce
- Expected vs actual behavior
- OS and Docker version
- Relevant output from `docker compose logs`
