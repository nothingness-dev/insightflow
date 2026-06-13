# Changelog

All notable changes to InsightFlow are documented here.

Format inspired by [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [1.1.0] — 2026

### Added
- **Persian (Jalali) date picker** — custom zero-dependency Jalali calendar
  component for survey start/end date selection, replacing the browser's
  native `datetime-local` input
- **Survey expiry status** — surveys with a past `ends_at` date and
  `published` status now automatically display «مهلت نظرسنجی به پایان رسیده»
  (deadline passed) as an orange badge/banner across all views (admin list,
  admin detail, employee list, employee detail); this is distinct from the
  manual «بسته شده» (closed) status triggered by the close button
- **Rating description (توضیحات)** — optional per-person description field
  displayed inside the rating modal below the person's role/department

### Changed
- `StatusBadge` component now accepts an optional `expired` prop to render
  the expiry state without altering the underlying `status` field
- `isSurveyExpired()` helper added to `utils/helpers.ts` for consistent
  expiry checks across all pages
- Employee survey detail: rating button is disabled and shows «نظرسنجی به
  پایان رسیده» when the survey has expired
- Employee survey list: expired surveys show an orange badge instead of «جدید»
  or «ناقص»

---

## [1.0.0] — 2026

### Added
- Initial public GitHub release of InsightFlow
- Django 4.2 + DRF backend with JWT authentication
- React 18 + TypeScript + Tailwind CSS frontend
- PostgreSQL database
- Docker Compose deployment with Nginx reverse proxy
- Admin panel: create, edit, publish, close surveys; manage people; view results
- Employee view: rate people 1–10 per survey with duplicate-vote prevention
- Anonymous results: voter identity never exposed
- CSV and Excel export of survey results
- Persian RTL interface
- LAN-ready deployment

## Docker migration hotfix

- Restored initial Django migrations for `accounts` and `surveys` apps.
- Removed the obsolete `version` key from `docker-compose.yml` to avoid Docker Compose warnings.
- This fixes backend startup failure: `ValueError: Dependency on app with no migrations: accounts`.
