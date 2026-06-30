## [2.5.0] — 2026-06-30

### Polish & smoothing pass

A focused UI-polish pass across the whole app — no behavior changes, only
how transitions, hovers, and loading states feel.

#### Global (`styles/globals.css`)

- `scroll-behavior: smooth` on `html`, with a `prefers-reduced-motion`
  override that disables all animation/scroll smoothing for users who have
  that OS preference set.
- Refined `:focus-visible` ring (theme-colored, soft offset) instead of the
  browser default outline, with `-webkit-tap-highlight-color: transparent`
  so mobile taps don't flash gray.
- `.skeleton` now sweeps a light shimmer across itself instead of a flat
  opacity pulse — reads as noticeably more "alive" while loading.
- Buttons (`.btn-primary/secondary/danger/success`) gain a small
  `active:scale-[0.97]` press effect for tactile click feedback.
- `.card`, `.person-card`, `.table-row`, `.sidebar-item`, and `.input-field`
  all got eased, slightly longer transitions (150 → 200ms, `ease-out`) so
  hover/focus states settle instead of snapping.
- Theme-color utility classes (`.theme-bg`, `.theme-text`, etc.) now
  transition smoothly when the user switches the accent color in
  `ThemeSwitcher`, instead of changing instantly.

#### Navigation feel

- **Page content transition** — new `components/common/PageTransition.tsx`,
  a small fade + 8px slide wrapper keyed by route pathname. Wrapped around
  `{children}` in both `AdminLayout` and `EmployeeLayout`'s `<main>`, so
  every page swap (sidebar click, tab click, back/forward) settles in
  smoothly instead of popping.
- **Mobile sidebar drawer** (`AdminLayout`) — now slides in from the edge
  with `framer-motion` (`AnimatePresence` + spring-eased transform) instead
  of appearing instantly; backdrop fades in alongside it.
- **Employee header dropdown** (`EmployeeLayout`) and **theme color picker**
  (`ThemeSwitcher`) — both now scale/fade in on open and out on close rather
  than snapping, matching the existing `Modal` component's motion language.
- **404 page** — added a matching entrance fade for consistency with
  `LoginPage`'s existing animation.

No new dependencies were introduced — everything above reuses
`framer-motion`, which was already a project dependency used by `Modal`,
`LoginPage`, and `AnonymousSurvey`.

---

## [2.4.0] — 2026-06-30

### Added

- **Route-loading progress bar** (`components/common/RouteLoadingBar.tsx`) — a
  thin animated bar at the top of the viewport now appears on every tab/page
  navigation (admin sidebar, employee tabs, programmatic redirects). It eases
  in, holds briefly, then completes and fades out, giving consistent visual
  feedback even though most lazy-loaded route chunks resolve instantly after
  the first visit. Mounted once in `App.tsx` inside `<BrowserRouter>`.

- **404 / Not Found page** (`pages/NotFound.tsx`) — any unmatched URL now
  renders a proper not-found page instead of silently redirecting to
  `/login`. Matches the app's visual language (RTL, theme-aware colors,
  Vazirmatn font) and offers two ways back: "بازگشت به صفحه قبل" (browser
  history back) and a context-aware home link — admins go to `/admin`,
  employees to `/surveys`, signed-out visitors to `/login`. Wired in as the
  `path="*"` route in `App.tsx`, replacing the old `<Navigate to="/login" />`
  catch-all.

- **Skeleton loading states for every remaining page** — the app already had
  `Skeleton`, `CardSkeleton`, `TableSkeleton`, and `PersonGridSkeleton`
  primitives in `components/common/index.tsx`; six pages still used a plain
  centered spinner (`PageLoader`) for their initial data fetch. All of them
  now show a structural skeleton that mirrors their real layout instead:
  - `DashboardSkeleton` — admin dashboard stat cards + recent surveys list.
  - `FormSkeleton` — survey create/edit form (title, description, question
    blocks, action buttons).
  - `ProgressListSkeleton` — survey participation progress cards.
  - `ResultsSkeleton` — survey results page (tabs, KPI cards, ranked list).
  - `SurveyDetailSkeleton` — admin survey detail header + person grid.
  - `AnonymousSurveySkeleton` — public anonymous voting page header, intro,
    progress bar, and person grid.
  - `CardGridSkeleton` — generic card-grid skeleton, used for the employee
    survey list (stat tiles + tab bar + survey cards).
  - Admin **User Management** table now shows `TableSkeleton` in place of the
    page-level spinner while keeping the search/filter bar visible during
    load, so the page doesn't visually reset on every refetch.

  `PageLoader` itself is unchanged and still used for the auth-bootstrap
  spinner in `routes/Guards.tsx`, where there's no page layout yet to mirror.

---

## [2.3.0] — 2026-06-30

### Fixed

- **Dev login hang without Redis** (`config/settings/dev.py`) — `dev.py` inherited
  the Redis-backed `CACHES` from `base.py`. Without a running Redis container,
  every request that touched the cache (login activity logging, cache
  invalidation) stalled until the Redis socket timed out. `dev.py` now
  explicitly overrides `CACHES` with `LocMemCache` so local development works
  with no Docker dependency.

- **Full test suite 429 throttle failures** — the `LoginRateThrottle`
  (5 req/min) and `AnonymousSurveyRateThrottle` are backed by the shared cache.
  Running all three test apps in one process exhausted the login rate limit,
  causing every subsequent login in the same run to return 429. A new dedicated
  `config/settings/test.py` file disables all throttle classes and raises all
  `DEFAULT_THROTTLE_RATES` to 10 000/min, while also switching to
  `LocMemCache` and the MD5 password hasher for speed. Use
  `--settings=config.settings.test` for all local test runs.

- **React Router v7 future-flag warnings** (`frontend/src/App.tsx`) — the
  browser console emitted two deprecation warnings about behaviour that will
  change in React Router v7: `v7_startTransition` and
  `v7_relativeSplatPath`. Both flags are now passed to `<BrowserRouter>` so
  the warnings are gone and the upgrade path to v7 is clear when the time
  comes. No runtime behaviour changes.

- **E2E Chrome path Windows-only** (`scripts/e2e-check.mjs`) — the
  `executablePath` was hardcoded to the Windows Chrome location. The script
  now auto-detects system Chrome across Windows, macOS, and Linux by checking
  a prioritised list of known paths. `E2E_CHROME_PATH` still overrides
  everything. If no system Chrome is found the script falls back to
  Playwright's bundled Chromium (useful in CI where `npx playwright install`
  succeeded).

### Added

- **`backend/config/settings/test.py`** — dedicated test settings module that
  extends `dev.py` and: disables all DRF throttle classes, raises all throttle
  rate limits to 10 000/min, locks in `LocMemCache`, and uses the MD5 password
  hasher. Eliminates the 429 failures that previously broke the joint test run.

---

# Changelog

## [2.2.0] - UX polish

### Added
- Draft survey forms now autosave locally on the current device and restore unsaved work when creating a new survey.
- Admins can preview a draft survey before publishing.
- Survey lists and voting pages now use skeleton loading states instead of generic spinners.
- Empty survey-list states now distinguish between no data and filtered search results.

### Changed
- Published and closed surveys show clearer UI messaging that questions and people are locked after publication.
- Employee voting modal has tighter mobile spacing and a sticky action area for easier completion on phones.
## [2.1.0] — 2026-06-28

### Added
- **Emoji rating question type** (بد / متوسط / خوب / عالی) — a third answer type for survey
  questions, alongside the existing numeric score (1–10) and text comment. Each question can
  independently enable any combination of the three types and mark each one required or optional.
  - `SurveyQuestion.has_emoji` / `emoji_required` and `Rating.emoji_rating` (new DB columns,
    migration `surveys/0008_emoji_rating`).
  - Employee voting screen shows a 4-option picker (بد/متوسط/خوب/عالی) with a colored
    background per option (red/amber/lime/green) and a minimal face icon.
  - Admin results (overview, per-question breakdown, per-person drawer) display emoji
    averages and the full بد/متوسط/خوب/عالی breakdown alongside numeric scores and comments.
  - PDF, Excel, and CSV exports include emoji averages, response counts, and an emoji
    distribution section, matching the existing score-distribution treatment.

### Changed
- **No password length or complexity requirements** — removed all Django
  `AUTH_PASSWORD_VALIDATORS` (minimum length, similarity, common-password, numeric-only) and
  every `validate_password` call in account serializers (create user, reset password, change
  password). Removed the hardcoded 8-character minimum in the bulk CSV/TXT user import and
  the matching client-side length checks/placeholders in the change-password modal and user
  management screens. Any non-empty password is now accepted; choosing a strong one is left
  to the admin/employee.

### Migrations
- `surveys/0008_emoji_rating` — adds `has_emoji`, `emoji_required` to `SurveyQuestion` and
  `emoji_rating` to `Rating`. Purely additive (new nullable/defaulted columns); no existing
  data is modified. Run `python manage.py migrate` after deploying.

---

## [2.0.0] — 2026-06-21

### Security
- **Removed `debug_ip` endpoint** — the `/api/debug-ip/` view was registered
  unconditionally in production, leaking internal header and IP information to any
  caller who knew the URL. Endpoint is gone entirely.
- **nginx: removed `set_real_ip_from 172.16.0.0/12`** — trusting the client subnet as
  a proxy range allowed clients to spoof their IP via a fake `X-Forwarded-For` header.
  nginx is the edge proxy; `$remote_addr` (the real TCP source, preserved by Linux
  iptables DNAT) is used directly instead.
- **Backend port 8000 no longer exposed to host** — changed from `ports: "8000:8000"`
  to `expose: "8000"` so gunicorn is reachable only via nginx inside the Docker network.

### Fixed — Critical
- **Multi-question vote lock** (`surveys/views.py` `EmployeeRatePersonView`) — the
  duplicate-vote guard used `.exists()` on *any* rating for that person. If a partial
  save occurred (e.g. network drop mid-submit), the voter was permanently locked out
  from completing the remaining questions. The check now only blocks when the voter
  has answered **all** active questions for that person.
- **JWT token blacklisting silently broken** — `rest_framework_simplejwt.token_blacklist`
  was missing from `INSTALLED_APPS` and `BLACKLIST_AFTER_ROTATION` was `False`. Calling
  `RefreshToken.blacklist()` on logout succeeded without error but did nothing; logged-out
  tokens remained valid for their full 7-day lifetime. Both are now correctly configured.
- **Stale user read in audit log** (`accounts/views.py` `UserDetailView.update`) — the
  view called `self.get_object()` *after* `super().update()`, producing a second DB query
  and potentially reading stale or wrong data. User is now snapshotted before the update
  and refreshed with `refresh_from_db()` afterwards.
- **nginx service missing from docker-compose** — `nginx.conf` existed but no nginx
  container was defined. The frontend was directly exposed on port 3000 and the backend
  on port 8000 with no reverse proxy, no static-file serving, and no real-IP forwarding.
  nginx is now a proper service and the single public entry point on port 80.

### Fixed — Moderate
- **Sort bug: unscored people ranked above score 0** (`surveys/services.py`) — the
  sort key used `-(None → -1) = +1` for people with no votes, ranking them above people
  with a real average score of `0.0`. None scores are now sorted last via a tuple key.
- **Survey list load errors silently swallowed** (`SurveyList.tsx`) — missing `.catch()`
  meant API failures showed an empty list with no user feedback. `toast.error` added.
- **N+1 query in AdminDashboardView** (`surveys/views.py`) — the dashboard looped over
  all surveys and fired a separate `Rating` query per survey (100 surveys = 100 DB
  queries). Replaced with a single annotated aggregate query.
- **nginx `X-Forwarded-For` overwrote the chain** (`nginx.conf`) — `$remote_addr` was
  set directly, destroying any existing XFF chain from upstream proxies. Changed to
  `$proxy_add_x_forwarded_for`.

### Fixed — Minor
- **Axios refresh infinite 401 loop** (`api/client.ts`) — if the `/auth/refresh/`
  endpoint itself returned 401, the response interceptor would catch it and attempt
  another refresh, looping forever. Added `isRefreshEndpoint` guard.
- **CORS blocked all LAN clients** (`settings/prod.py`) — default
  `CORS_ALLOWED_ORIGINS` was `http://localhost` only, blocking every device on a
  hospital LAN. Default now includes `http://127.0.0.1`; operators must set the env
  variable to their server IP for LAN deployments.
- **Duplicate `get_client_ip()` implementations** — `surveys/views.py` had its own
  IP-extraction function with a different priority order than `activity/services.py`.
  Consolidated to the single shared `_client_ip` helper.
- **LoginPage read from localStorage after `login()`** (`LoginPage.tsx`) — added
  `replace: true` to navigation so the login page is removed from browser history.

### Added
- **`nginx` service in docker-compose** — with `static_data` and `media_data` volume
  mounts so Django's collected static files and user uploads are served by nginx.
- **`deploy.sh`** — one-command Linux deploy script (build → start → migrate).

### Removed
- **`nginx/nginx-windows.conf`** — outdated file that connected to `127.0.0.1` (pre-Docker
  setup) and caused confusion. The current architecture is fully containerised.

### CI
- Added `apps.activity` to the Django test suite in the GitHub Actions workflow.
- Added a Redis service to the CI job so cache-backed views are tested correctly.
- Added `CORS_ALLOWED_ORIGINS` and `REDIS_URL` env vars to the CI environment.

---

## [1.9.0] — 2026-06-21

### Added
- **Redis caching layer** — a Redis 7 service is now part of the Docker stack, providing
  a shared in-memory cache that dramatically reduces database load on hot read paths.

  | Endpoint / data | Cache TTL | Invalidated when |
  |---|---|---|
  | Admin Dashboard stats | 2 min | Rating submitted, survey created/deleted |
  | Survey Results (per survey) | 5 min | Rating submitted, survey edited/closed/deleted |
  | Activity Headline KPIs | 2 min | Any activity log written |
  | Activity Charts (per day-window) | 10 min | Any activity log written |
  | Activity Filter Options | 30 min | Any activity log written |
  | Employee Survey List (per user) | 2 min | Rating submitted, survey published/closed/deleted |

- **`apps/core/cache.py`** — centralised key registry and invalidation helpers so every
  cache key is defined in exactly one place; no magic strings scattered across views.
- **Graceful Redis degradation** — `IGNORE_EXCEPTIONS = True` in the cache backend means
  the app falls back to direct DB queries if Redis is temporarily unavailable; no crashes,
  no stale data served to users.
- **`REDIS_URL` env variable** (default `redis://redis:6379/0`) — allows pointing at an
  external Redis cluster without rebuilding images.
- **Redis maxmemory policy** set to `allkeys-lru` with a 128 MB cap so the container
  can never consume unbounded memory; least-recently-used keys are evicted automatically.

### Changed
- `docker-compose.yml` — added `redis` service (Redis 7 Alpine) with a healthcheck;
  the `backend` service now depends on both `db` and `redis` being healthy before starting.
- `backend/requirements.txt` — added `django-redis==5.4.0` and `redis==5.0.8`.
- `backend/config/settings/base.py` — added `CACHES` configuration and TTL constants.
- `apps/activity/services.py` — `log_activity()` now busts activity stats and filter-options
  caches immediately after writing a log entry (still never raises).

### Fixed
- **Startup 502 errors** — nginx now waits for the backend healthcheck to pass before
  accepting traffic, eliminating the "502 Bad Gateway" page users saw on first `docker compose up`.
- **False PDF export error popup** — raw HTML nginx error pages are now detected and
  converted to a friendly Persian message instead of being rendered as raw markup in toasts.

---

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
