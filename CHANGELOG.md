# Changelog

## [1.4.0] — 2026

### Fixed
- **Theme switcher now works everywhere** — Login page header, person card photo placeholder, Dashboard stat cards, all admin and employee pages now use CSS custom properties (`var(--c-600)` etc.) instead of hardcoded Tailwind purple classes. Switching theme updates all UI instantly.
- **«انتشار نظرسنجی» hover restored** — `btn-success` class was missing from globals.css and has been re-added.

### Changed
- **Removed «نمایش نتایج» field** — only `admin_only` remains; the dropdown is removed from the survey creation form. Migration `0004` updates existing rows.
- **All-or-nothing voting enforced** — employees must rate every person in a survey; partial completion badge (ناقص) is removed. A notice on the survey detail page explains this requirement.

---

## [1.3.0] — 2026

### Added
- **Theme switcher** — button in the header (both admin and employee views) lets users pick from four color themes: بنفش (purple), آبی (blue), سبز (green), قرمز (red). Choice is saved in `localStorage` and applied instantly via CSS custom properties — no page reload needed.
- **Rating comment field** — employees can now optionally write a text note (up to 1000 characters) when submitting a score. Stored in the database; visible to admins via Django admin panel.

### Changed
- **Removed `تاریخ شروع` and `تاریخ پایان`** from surveys entirely. Admins open surveys with the «انتشار» button and close them with the «بستن» button — no automatic scheduling. Removed from model, serializers, form UI, and all display components.
- Employee survey list now has three tabs: **فعال / بسته‌شده / تکمیل‌شده** (no more "expired" state).
- All hardcoded `purple-*` Tailwind classes replaced with CSS custom properties (`var(--c-600)` etc.) so the theme switcher works globally.

### Removed
- `PersianDatePicker` component (no longer needed)
- `isSurveyExpired` helper function
- `starts_at` / `ends_at` fields from `Survey` model (migration `0003_remove_survey_dates`)

---

## [1.2.0] — 2026

### Added
- **Rating comment** — optional توضیحات textarea under the score buttons in the rating modal (added in this session, finalized in 1.3.0).
- **Back button** on employee survey detail page (top and bottom).
- **Tabs** on employee survey list: فعال / پایان‌یافته / تکمیل‌شده.
- **Closed surveys visible to employees** — backend now returns both `published` and `closed` surveys.

### Fixed
- **PersianDatePicker bugs** — stale closure causing time changes to be lost; clicking a day now always selects the clicked day; timezone handled as local Tehran time (no UTC offset in emitted ISO string).
- Theme changed from blue to **purple** across all components.

---

## [1.1.0] — 2025

### Added
- Persian (Jalali) date picker for survey start/end dates.
- Survey expiry status (`مهلت نظرسنجی به پایان رسیده`) shown as a distinct orange badge.
- Optional per-person description shown in the rating modal.
- Bulk user import via CSV/TXT file upload.
- Delete-all-data button (admin only, requires typing confirmation).
- GitHub-ready project structure: `.gitignore`, bilingual README, CHANGELOG, CONTRIBUTING, CI workflow, issue templates.

### Changed
- Removed `عمومی` visibility option (only `فقط مدیر` and `کارکنان پس از بستن` remain).
- People hidden from employees before survey `starts_at`.

---

## [1.0.0] — 2025

### Added
- Initial release: Django 4.2 + DRF backend, React 18 + TypeScript + Tailwind frontend.
- PostgreSQL database, JWT auth, Docker Compose deployment with Nginx.
- Admin panel: create/edit/publish/close surveys, manage people, view results.
- Employee view: rate people 1–10, duplicate-vote prevention, anonymous results.
- CSV and Excel export.


