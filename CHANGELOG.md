# Changelog

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
