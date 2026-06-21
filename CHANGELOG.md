# Changelog

## [1.8.0] — 2026

### Added
- **Activity Center / Audit Reports** — a brand-new admin-only section (sidebar item «مرکز فعالیت‌ها» at `/admin/activity`) that tracks and displays important system & admin activities across the whole application. It is completely separate from survey results and does not change any existing results page, chart, ranking, or export.
  - **Headline KPIs:** Total Activities, Today's Activities, This Week's Activities, and Most Active Admin (plus failed/critical counts).
  - **Activity Timeline** of the most recent events, color-coded by category.
  - **Critical Actions Panel** highlighting sensitive actions (failed logins, deletions, password resets, bulk imports, delete-all-data).
  - **Activity Charts** — 14-day volume (with failed-event overlay) and a breakdown of the most frequent action types, rendered without any new chart dependency.
  - **Search, Filters & paginated table** — search across description/user/IP, filter by action type, user, status, and «critical only». The table uses **server-side pagination, filtering and searching** and never loads all logs at once (scales to 1000+ rows).
  - **Export Center** — download activity logs as **Excel, CSV or PDF**. The user is asked for a **From Date** and **To Date** first, and only logs within that range are exported.
- **Automatic activity tracking** wired into existing flows: Login, Failed Login, Logout, Password Change, Password Reset, User Create/Edit/Delete, User Activate/Deactivate, Bulk Employee Import, Survey Create/Edit/Delete, Survey Duplicate, Survey Publish/Close, Question Add/Edit/Delete, CSV/Excel/PDF result exports (recorded only — export logic itself unchanged), and Delete All Data.
- **New API endpoints** (all admin-only): `GET /api/admin/activity/logs/`, `/stats/`, `/timeline/`, `/critical/`, `/charts/`, `/filters/`, and `/export/` (requires `export_format`, `date_from`, `date_to`).
- **Pop-up notifications** added where missing — the Activity Center surfaces success/error toasts for refresh and exports, and the admin Dashboard now shows an error toast if its stats fail to load.

### Fixed
- **PDF export error («خطا در تولید فایل خروجی»)** — the survey results PDF endpoint now wraps report generation so any runtime failure returns a clean JSON message the UI can display instead of an opaque HTML 500 page, and the optional-dependency import guard was broadened so a missing PDF dependency degrades gracefully to a clear 501 («خروجی PDF در دسترس نیست») rather than crashing.

### Security
- Activity logging is **admin-only** and **never stores passwords, tokens, session keys, or raw request bodies**. Metadata is sanitised (sensitive-looking keys are dropped, values are bounded), and logging can never break the request it observes.

### Migrations
- `activity/0001_initial` — creates the `ActivityLog` table (indexed for scale). Run `python manage.py migrate` after deploying.

---

## [1.7.0] — 2026

### Added
- **PDF results export** — a polished, comprehensive RTL (Persian) analytics report for each survey: gradient brand header, KPI summary cards, score distribution, color-graded person ranking, per-question analysis and grouped textual comments. Endpoint `GET /api/admin/surveys/:id/export/pdf/`.
- **Self-service password change** — any signed-in user (admin or employee) can change their own password from the profile menu. Endpoint `POST /api/auth/change-password/` (verifies current password). Works independently of the admin's reset ability.
- **Forced password change on first login** — new `must_change_password` flag on the user model. A non-dismissible modal requires the user to set a new password the first time they sign in.
- **Repeat-password field + show/hide** — all password forms (self-service change, admin reset, create user) now include a «تکرار رمز عبور» field and a show/hide (eye) toggle.
- **Confirmation dialogs for sensitive actions** — password changes (self-service and admin reset) now require an explicit double-check confirmation.
- **Delete survey from the detail page** — a «حذف نظرسنجی» action (with confirmation) is now available on the survey detail page for surveys in any status, not only drafts in the list.

### Changed
- **Excel export redesigned** to match the PDF report — new «خلاصه» (summary) sheet with brand header, KPI cells and score distribution; a «کیفیت» (grade) column; auto-filters and frozen headers across sheets.
- **CSV export restructured** into clear sections (individual ranking with grade, per-question analysis, score distribution, full comments) so it stays consistent with the Excel/PDF outputs.
- **Comment-volume handling** for large surveys made explicit per format: Excel and CSV keep every comment (one row each — scales to hundreds per question), while the PDF groups comments per question and caps them (default 6 per question / 120 total) with a «+N نظر دیگر» note pointing to the Excel/CSV export.
- **Admin password reset** now sets `must_change_password`, so users are required to change an admin-assigned password on their next login. Newly created and bulk-imported users are flagged the same way.
- **Robust file-download error handling** on the frontend — failed exports now surface the real backend message instead of saving a broken file.
- **Large people lists** in the results panel now render incrementally («نمایش بیشتر») for snappier performance.

### Fixed
- **PDF generation crash** when a comment, name, or question text contained `<`, `>` or `&` — all text is now XML-escaped before rendering, so exports no longer fail (previously surfaced as a broken/erroring PDF download).

### Dependencies
- Added `reportlab`, `arabic-reshaper`, `python-bidi` (PDF rendering with correct Persian shaping) and a bundled Vazirmatn font (OFL).

### Migrations
- `accounts/0002_user_must_change_password` — adds the `must_change_password` field. Run `python manage.py migrate` after deploying.

---

## [1.6.0] — 2026

### Added
- **Multi-question survey builder** — admins can define multiple active questions instead of one fixed main question.
- **Per-question answer controls** — every question can enable numeric score (1–10), text comment, or both.
- **Required/optional input rules** — score and comment can be independently required or optional per question.
- **Full multi-question voting** — employees must answer every active question for every surveyed person; no question can be submitted empty.
- **Per-question result breakdown** — admin results now include overall ranking plus expandable question-level averages, counts, and anonymous comments.
- **Multi-question CSV/Excel exports** — exports now include dynamic columns for each question.

### Changed
- `Survey.question` is kept only as a legacy fallback; new behavior uses the `SurveyQuestion` relation.
- `Rating` now stores one answer per `(survey, person, voter, question)` and supports score-only, comment-only, or combined answers.
- Survey progress now counts completion by active people × active questions.
- Duplicate Survey now copies questions as well as people/settings, but still never copies responses.

### Fixed
- Updated backend tests to match the current publish/close lifecycle after start/end dates were removed.

---

## [1.5.0] — 2026

### Changed
- `Survey.question` (single text field) removed from the model and replaced by the `SurveyQuestion` relation. Migration `0005_survey_questions` handles this.
- Employee submit endpoint changed from `POST /surveys/:id/people/:pid/rate/` to `POST /surveys/:id/people/:pid/submit/` — accepts a `responses` array covering all questions at once.
- `Rating` model replaced by `QuestionResponse` model (per-question, per-person, per-voter).
- Admin survey form rebuilt as a question builder with add/remove/reorder controls.
- `SurveySerializer` now returns `questions_count`; full `questions` array returned on detail views.
- Results `overall_avg` is the mean of all scored-question averages for ranking; questions with no score type do not affect ranking.

### Removed
- Single `question` field from `Survey` model (migration `0005`).
- Old `Rating` model (replaced by `QuestionResponse`).
- `RatingCreateSerializer` (replaced by `SubmitResponsesSerializer`).

---

## [1.4.0] — 2026

### Fixed
- **Theme switcher now works everywhere** — Login page header, person card photo placeholder, Dashboard stat cards, all admin and employee pages now use CSS custom properties (`var(--c-600)` etc.) instead of hardcoded Tailwind purple classes. Switching theme updates all UI instantly.
- **«انتشار نظرسنجی» hover restored** — `btn-success` class was missing from globals.css and has been re-added.
- **نتایج نظرسنجی score bar** — broken class `bg-[color:var(--c-50)]0` fixed; bar and میانگین number now use red/amber/green based on value, independent of theme.
- **Drag and drop in bulk user import** — drop zone now has real `onDrop`, `onDragOver`, `onDragEnter`, `onDragLeave` handlers with visual feedback.
- **Username field in edit modal** — replaced disabled input with a readable display; shows «نام کاربری قابل تغییر نیست».
- **Delete user** — added `DELETE /api/admin/users/:id/` endpoint and confirmation modal in UI.
- **Comments in results** — `توضیحات اختیاری` written during voting are now returned by `calculate_survey_results` and displayed in the admin results page as an expandable section per person.

### Changed
- **Removed «نمایش نتایج» field** — only `admin_only` remains; the dropdown is removed from the survey creation form. Migration `0004` updates existing rows.
- **All-or-nothing voting enforced** — employees must answer every person in a survey; partial completion badge (ناقص) is removed.

---

## [1.3.0] — 2026

### Added
- **Theme switcher** — button in the header (both admin and employee views) lets users pick from four color themes: بنفش (purple), آبی (blue), سبز (green), قرمز (red). Choice is saved in `localStorage` and applied instantly via CSS custom properties.
- **Rating comment field** — employees can optionally write a text note (up to 1000 characters) when submitting a score.

### Changed
- **Removed `تاریخ شروع` and `تاریخ پایان`** from surveys entirely. Admins open surveys with «انتشار» and close with «بستن». Migration `0003_remove_survey_dates`.
- Employee survey list tabs: **فعال / بسته‌شده / تکمیل‌شده**.
- All hardcoded `purple-*` Tailwind classes replaced with CSS custom properties.

### Removed
- `PersianDatePicker` component
- `isSurveyExpired` helper
- `starts_at` / `ends_at` fields from `Survey` model

---

## [1.2.0] — 2026

### Added
- **Back button** on employee survey detail page.
- **Tabs** on employee survey list.
- **Closed surveys visible to employees.**

### Fixed
- **PersianDatePicker bugs** — stale closure, wrong day selection, timezone handling.
- Theme changed from blue to purple.

---

## [1.1.0] — 2026

### Added
- Persian (Jalali) date picker.
- Survey expiry status badge.
- Optional per-person description in rating modal.
- Bulk user import via CSV/TXT file upload.
- Delete-all-data button (admin only).
- GitHub-ready project structure.

### Changed
- Removed `عمومی` visibility option.

---

## [1.0.0] — 2026

### Added
- Initial release: Django 4.2 + DRF backend, React 18 + TypeScript + Tailwind frontend.
- PostgreSQL, JWT auth, Docker Compose + Nginx.
- Admin panel: create/publish/close surveys, manage people, view results.
- Employee view: rate people 1–10, duplicate-vote prevention, anonymous results.
- CSV and Excel export.
