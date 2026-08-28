## [Unreleased]

### Security

- Dependency audit across PyPI + npm + OSV: upgraded all vulnerable pins —
  Django 5.2.17 (CVE-2026-15830), djangorestframework-simplejwt 5.5.1
  (CVE-2024-22513 / GHSA-5vcc-86wm-547q), Pillow 12.3.0 (~17 CVEs in 11.x),
  react-router-dom 7.18.2 (CVE-2026-53666/53668/53669; the v7 future flags
  were already enabled so the jump was prepared), postcss 8.5.26 and
  nanoid 3.3.18 (transitive). All remaining pins refreshed to latest
  same-major releases; full OSV re-scan reports zero advisories.
- Frontend: removed the obsolete `future` flags from `<BrowserRouter>` —
  they are default behaviour in React Router v7.

### Changed

- djangorestframework 3.18.0, django-cors-headers 4.9.0, psycopg2-binary
  2.9.12, reportlab 4.5.1, arabic-reshaper 3.0.1, python-bidi 0.6.11,
  dj-database-url 2.3.0, django-filter 25.2, redis 5.3.1; axios ^1.20.0,
  autoprefixer ^10.5.4. RTL PDF pipeline smoke-verified on the new stack.

### Fixed

- Admin survey list pagination is ordered again: aggregate annotations
  dropped the model's `-created_at` default ordering, so DRF paginated an
  unordered queryset (`UnorderedObjectListWarning`) and on PostgreSQL sliced
  pages without ORDER BY — rows could repeat or vanish between pages.
- Employee survey list `my_votes_count` now judges completion against each
  person's OWN question assignment (default set vs custom questions),
  matching the survey-detail endpoint instead of undercounting mixed
  default/custom surveys. Still a fixed query count.
- Generated the missing `surveys/0020_alter_rating_comment` migration for the
  `Rating.comment` 1000-character validator shipped in 2.10.29, restoring
  `makemigrations --check` (CI migration gate) to green.

### Added

- Regression tests: admin survey list must paginate ordered and warning-free;
  employee list counts completion per person's own assignment on mixed
  default/custom surveys.

## [2.10.29] — 2026-08-26

### Fixed

- Scoped rate limits added for token refresh (30/min), password change
  (5/min), every CSV/Excel/PDF export (20/min), and bulk import (5/min).
- `Rating` gains a 1000-character comment validator and a full-clean guard
  rejecting ratings with no answer component, so admin inserts cannot
  poison averages.
- `duplicate_survey` skips stray cross-survey questions instead of failing
  with a KeyError.
- Logout only blacklists refresh tokens owned by the caller.
- Person names, departments, role titles, and question texts are now
  formula-neutralized in CSV/Excel matrix rows and headers.
- Removed dead PersianDatePicker/ThemeSwitcher components and four unused
  barrel exports; gitignored the local seed script; added skip-to-content
  links to both shells; gated the npm build behind typecheck.

## [2.10.28] — 2026-08-26

### Fixed

- Results calculation no longer runs one query per person: a shared
  two-query question map feeds completion checks, group aggregation, and
  export comment gating with identical output.
- Question-meta export aggregation hoisted its per-result lookup out of the
  question loop (was quadratic).
- Daily activity charts aggregate in the database via TruncDate instead of
  loading every log row of the window into Python; buckets are identical.
- The employee survey list no longer ships every question of every survey —
  payload stops growing with question count and inactive/custom question
  texts stop leaking to clients (frontend already prefers the summary
  fields).
- Progress anonymous totals ignore inactive links consistently.

## [2.10.27] — 2026-08-26

### Fixed

- Admin password resets now terminate every session of the target account
  by blacklisting its outstanding refresh tokens.
- `must_change_password` is enforced server-side: flagged users are rejected
  from regular endpoints until they change their password, while me /
  change-password / logout stay reachable.
- Dashboard `total_responses` uses the precise per-person completion model,
  fixing undercounting on surveys that mix default and custom questions.
- Hash-link PATCH parses multipart booleans correctly; `'false'` no longer
  re-activates a disabled link.
- Bulk import survives concurrent username races (row-by-row fallback) and
  reports invalid roles as row errors instead of silently demoting admins.
- Anonymous ballots compute their required total with a constant-query
  helper instead of an N+1 while holding the link row lock.
- Frontend: token refresh honors `VITE_API_BASE_URL`; Activity Center search
  is genuinely debounced (400 ms); hash-link creation ignores Enter while a
  request is in flight.

## [2.10.26] — 2026-08-25

### Fixed

- Person creation through multipart forms no longer saves `is_active=False`
  when the field is omitted (DRF BooleanField default gotcha); absent now
  means active.
- Survey creation and all admin user mutations (create, update, delete,
  activate, deactivate, bulk import) invalidate the dashboard cache, so
  survey and employee totals are never stale.
- Anonymous votes invalidate the hash-links panel cache so participant
  counts update immediately instead of lagging 60 seconds.
- Removed dead employee-survey-list cache helpers that were never populated.

## [2.10.25] — 2026-08-25

### Fixed

- The CI backend job now receives the required settings environment
  variables (dummy `SECRET_KEY`, explicit hosts and proxy-trust flag) so the
  test suite can run without the gitignored `.env` file.

## [2.10.24] — 2026-08-25

### Documentation

- Documented the optional `SECURE_SSL_REDIRECT` and `SECURE_HSTS_SECONDS`
  environment variables in `.env.example`.

## [2.10.23] — 2026-08-25

### Fixed

- Split vendor libraries (react/router, framer-motion, axios) into
  separately cacheable chunks, shrinking the application entry bundle from
  ~420 KB to ~93 KB.
- Wired the previously dead `VITE_API_BASE_URL` Docker build argument into
  the axios client with the same-origin `/api` default.
- Login errors now flow through the shared `getErrorMessage` helper instead
  of an `any`-typed ad-hoc extractor; decorative status badges expose
  `role="img"` so screen readers announce their labels; removed an unused
  ActivityCenter constant.

## [2.10.22] — 2026-08-25

### Added

- A CI workflow running the backend migration-consistency check and full
  Django test suite plus the frontend typecheck and production build on
  every push to both branches and on pull requests.

## [2.10.21] — 2026-08-25

### Fixed

- Extracted the emoji-rating picker and question-type label into a shared
  module used by both the anonymous voting flow and the employee survey
  flow, eliminating the copy-pasted widget that risked accessibility and
  validation drift.
- The admin dashboard no longer renders a permanent blank page when the
  stats request fails; it shows a persistent error card with a retry
  action, matching the employee survey list behavior.

## [2.10.20] — 2026-08-25

### Fixed

- Added composite indexes for the survey-question hot path
  `(survey, is_active, person, display_order)` — used by every
  effective-questions resolution across lists, details, rating, and
  serialization — and for active-people-per-survey lookups
  `(survey, is_active)` used by list counters and completion totals.

## [2.10.19] — 2026-08-25

### Fixed

- `X-Forwarded-Host` / `X-Forwarded-Proto` are now honored only when
  `TRUST_PROXY_HEADERS` is enabled, matching the client-IP trust policy.
- Added `SECURE_REFERRER_POLICY` plus env-gated `SECURE_SSL_REDIRECT` and
  HSTS settings for HTTPS deployments.
- Expired JWT refresh tokens are now pruned daily (`flushexpiredtokens`
  background loop in both compose commands) instead of accumulating forever.
- Cache invalidation failures and django_redis errors log at WARNING so a
  Redis outage is no longer invisible in production logs.

## [2.10.18] — 2026-08-25

### Fixed

- Photo uploads are now validated by decoding the actual bytes with Pillow:
  the real image format must be an allowed type and must match the claimed
  extension, so renamed non-image payloads and truncated files are rejected
  instead of being stored as person photos.

## [2.10.17] — 2026-08-25

### Fixed

- Removed the N+1 query explosion from the employee survey list: counters
  are annotated once per request, completion totals are computed across all
  listed surveys in three grouped queries instead of dumping every rating of
  every survey into Python, and the requesting user's progress is batched
  into a single query — the response contract is unchanged.
- Applied the same annotations to the admin survey list and dashboard
  recent-surveys so serializing surveys no longer costs ~5 queries per row.
- Added bounded-query-count and custom-question completion-semantics
  regression tests guarding the list endpoints.

## [2.10.16] — 2026-08-25

### Fixed

- Prevented a corrupted or tampered sessionStorage user entry from crashing
  the app on boot; broken session data is now parsed defensively and dropped,
  letting the session start clean.
- Added an error boundary at the app root and around the route shell, so any
  unexpected render error (including a stale lazily-loaded chunk after a
  deploy) shows a Persian recovery screen with retry, reload, and
  clear-session actions instead of a permanent blank page.
- Saved theme keys are validated against the known palette list, falling back
  to the default theme for unknown values.

## [2.10.15] — 2026-08-25

### Fixed

- Hardened client-IP resolution against spoofed `X-Real-IP` /
  `X-Forwarded-For` headers: proxy headers are honored only when
  `TRUST_PROXY_HEADERS=true`, so a directly exposed backend can no longer
  have anonymous-vote IP locks, audit entries, or rate-limit buckets forged.
- Pinned DRF throttle identity to the same trust policy via `NUM_PROXIES`,
  keeping rate limiting consistent with the new IP resolution.
- Invalid proxy-header values are now validated as real IP addresses and
  skipped instead of being stored or used for device locks.

## [2.10.14] — 2026-08-25

### Fixed

- Closed an anonymous-voting loophole where one device could rate different
  people under different anonymous tokens without ever triggering the IP lock.
- Anonymous participation now registers the device on its first ballot and
  binds it to that session token; later ballots from the same IP must present
  the same token, while multi-step voting and cross-visit resume keep working.
- Recorded survey completion separately in `finished_at` so the audit log
  still fires exactly once per completed anonymous session, with a migration
  backfilling prior completion records.

## [2.10.13] — 2026-08-08

### Improved

- Replaced the product attribution across shared application views and PDF
  exports with the minimal English credit `Built by nothingnessdev`.
- Removed the fixed calendar year and extended copyright wording from the
  attribution while preserving the developer profile link in the interface.

## [2.10.12] — 2026-08-08

### Improved

- Reorganized survey-detail actions into a clear mobile hierarchy with a
  full-width primary action and aligned secondary actions.
- Preserved the compact desktop action bar while keeping mobile controls
  readable, evenly sized, and touch-friendly.

### Fixed

- Prevented survey-detail action buttons from wrapping into an uneven layout
  on narrow screens.
- Added responsive regression coverage for action alignment, sizing, and
  minimum touch-target dimensions.

## [2.10.11] — 2026-08-08

### Added

- Added a pull-request and main-branch CI gate for the complete mobile
  accessibility and responsive regression matrix.
- Added screenshot coverage validation, SHA-256 evidence manifests, retained CI
  artifacts, and a manual keyboard, NVDA, and real-device release checklist.

### Improved

- Separated intentional offline, permission-denied, and server-error browser
  messages from unexpected console and page errors so CI failures remain
  actionable.
- Isolated CI fixtures and service volumes from development, customer, and
  production data, with unconditional cleanup after every run.

## [2.10.10] — 2026-08-07

### Added

- Expanded the responsive regression matrix with deterministic long-content,
  empty, error, offline, permission, keyboard, landscape, and 200% text states.
- Added isolated CSV, Excel, and PDF export regression coverage.

### Improved

- Made long survey names, identities, IPv6 values, counts, and comments wrap or
  scroll cleanly without clipping administrative pages.
- Kept compact Persian status, role, pagination, and breadcrumb labels readable
  at narrow widths and under text enlargement.
- Improved recoverable loading and error states across survey, result, user, and
  employee views.

### Fixed

- Prevented result cards and comment pagination from collapsing into narrow text
  columns at 200% text size.
- Removed excess RTL breadcrumb spacing while preserving accessible touch areas.

## [2.10.9] — 2026-08-07

### Added

- Added mobile card presentations for surveys, users, and activity logs while
  preserving the existing desktop tables.
- Expanded the mobile regression suite with admin editor, filtered-state,
  results, pagination, and responsive list coverage.

### Improved

- Reworked admin filters with visible removable summaries, reachable clear
  actions, and touch-friendly controls on narrow screens.
- Made survey editing, results exports, result tabs, comment pagination, and
  admin actions reflow cleanly at 320 px and under text scaling.
- Added bounded wrapping and scrolling for long activity details and response
  comments so administrative pages remain readable without page overflow.

## [2.10.8] — 2026-08-02

### Added

- Added shared, screen-reader-friendly participation progress for anonymous and
  signed-in survey flows.
- Added inline, recoverable submission feedback that preserves entered answers
  when a request fails.

### Improved

- Compressed participant cards without reserving portrait space when no photo
  exists, while keeping identities, metadata, statuses, and actions aligned.
- Replaced the fixed anonymous continuation bar with safe sticky actions for
  both anonymous and employee participation.
- Simplified question-card chrome and added visible checkmarks alongside ARIA
  selected states for score and SVG emoji ratings.
- Made score and emoji grids reflow cleanly at 320 px and 200% text scaling.
- Expanded the mobile regression suite to verify participant cards, progress,
  sticky actions, touch targets, and keyboard-selected rating states.

## [2.10.7] — 2026-08-02

### Added

- Added focused validation summaries and programmatic label, help, and error
  associations across long dialog forms.
- Expanded the mobile regression suite with anonymous-rating dialog checks for
  focus management, persistent actions, validation, 320 px reflow, and 200%
  text scaling.

### Improved

- Rebuilt shared dialogs as full-height mobile sheets with persistent headers,
  independently scrollable bodies, sticky footers, and centered desktop layouts.
- Improved focus trapping, initial focus, Escape and backdrop behavior, focus
  restoration, safe-area spacing, and busy-state dismissal protection.
- Moved rating, account, survey, QR, and destructive admin actions into reachable
  responsive footers and improved mobile password-field semantics.

### Fixed

- Increased the login subtitle contrast to meet the automated accessibility gate.

## [2.10.6] — 2026-08-01

### Added

- Added automated mobile accessibility coverage for the main public, employee,
  and admin flows at 320 and 390 CSS pixels in light and dark themes.
- Added a shared shell menu for version, display, theme, settings, and account
  actions across admin, employee, and anonymous survey pages.

### Improved

- Rebuilt the admin mobile drawer and shared headers with keyboard focus
  trapping, Escape dismissal, focus restoration, and background scroll locking.
- Standardized mobile touch targets, form text, focus indicators, contrast,
  logical RTL spacing, reduced motion, and selected-state semantics.
- Added safe-area spacing for headers, drawers, sticky controls, and fixed
  anonymous-survey actions so content remains visible on narrow devices.

## [2.10.5] — 2026-07-29

### Fixed

- Committed survey-question normalization before adding PostgreSQL constraints,
  preventing pending trigger events from blocking container startup.
- Removed unused compiler and PostgreSQL development packages from the backend
  image, eliminating an unnecessary Debian download and reducing image size.

## [2.10.4] — 2026-07-29

### Fixed

- Made score-only, emoji-only, and text-only survey questions automatically
  required across the admin editor, API, and database.
- Normalized existing question configurations during migration and clarified
  that multi-type questions require at least one active answer.

## [2.10.3] — 2026-07-29

### Fixed

- Aligned anonymous participant-card completion and action boxes by giving
  every card a consistent image, flexible details, and bottom action
  partition.

## [2.10.2] — 2026-07-29

### Improved

- Enlarged anonymous-survey participant cards with clearer photos, details,
  completion states, and rating actions while keeping them more compact than
  the signed-in employee cards.

## [2.10.1] — 2026-07-27

### Changed

- Replaced the MIT license with a proprietary, viewing-and-evaluation-only
  license that reserves all rights to Roham.
- Refreshed the README screenshots for the login, dashboard, survey creation,
  voting, results, and activity interfaces.

## [2.10.0] — 2026-07-27

### Added

- Added a compact version badge across the admin, employee, login, and
  anonymous-survey interfaces, sourced from the frontend package version.

## [2.9.1] — 2026-07-25

### Fixed

- Person cards and anonymous person rows now render correctly in dark mode:
  the avatar placeholder area (`bg-[color:var(--c-50)]`) and the completed
  row tint (`bg-emerald-50/60`) had no dark-mode overrides, showing as
  bright white against the dark page.
- `.person-card` now carries its own `background-color` and border directly
  instead of relying on `@apply card`, which did not propagate the raw
  CSS property — the card body was transparent in dark mode.
- `.dark .card` explicitly sets `background-color: var(--surface-alt)` so
  all card-like elements use the correct dark surface.

## [2.9.0] — 2026-07-25

### Added

- Person-specific survey questions and improved anonymous participation workflows,
  including clearer progress states and compact participant rows.
- A centralized frontend motion system with page and interaction transitions.
- Password-strength validation across account flows, protected destructive admin
  actions, and a dedicated system-settings area.
- Deployment, backup, and Docker documentation for operating the full stack.

### Improved

- Survey-builder usability with sticky actions, question accordions, locally saved
  drafts, and clearer progress feedback.
- Accessibility through labeled inputs, ARIA validation attributes, persistent inline
  errors, improved interaction targets, and focus handling for invalid forms.
- Admin and employee screens for scanability, responsive behavior, and consistent UI
  motion.
- Survey results, PDF/CSV/Excel exports, admin authorization, database indexes, and
  deployment dependencies.

### Fixed

- Result summary counts and empty states.
- Anonymous ballot-stuffing and spreadsheet formula-injection protections.
- A spurious survey-detail error notification when navigating away during a request.

## [2.8.2] — 2026-07-05

### Removed the anonymous IP-lock admin UI entirely; enhanced the Audit Log instead

- The dedicated "آدرس‌های IP قفل‌شده" panel and its unlock/remove actions
  (added in 2.8.0/2.8.1) have been **removed completely** — backend views
  (`AdminHashLinkLocksView`, `AdminHashLinkLockDetailView`), their URLs,
  the `HashLinkLockSerializer`, the `hash_link_unlock_ip` /
  `hash_link_remove_participant` activity actions, and the frontend
  `HashLinkLocksModal` component and its wiring in `HashLinksPanel` are all
  gone. Anonymous IP-based duplicate-prevention itself is untouched and
  still works exactly as before — only the admin management UI around it
  was removed.
- **In its place, the Activity Log (`ActivityCenter`) was enhanced** so
  admins can already see everything they need there instead:
  - Each row in the audit log table is now expandable (click to
    open/close, with a chevron indicator) and reveals a details panel with
    the event's target, full IP address, full user agent, and every
    non-empty `metadata` field — with common keys (`token`, `label`,
    `max_participants`, `expiry_value`/`expiry_unit`, `ip_address`, etc.)
    translated to readable Persian labels instead of raw JSON keys.
  - Booleans render as "بله"/"خیر", `expiry_unit` values render as
    "ساعت"/"روز"/"هفته", and arrays/objects are formatted readably instead
    of dumping raw JSON.
  - This reuses the `metadata` JSON field that was already being recorded
    on every hash-link related `log_activity(...)` call (creation, toggle,
    limit changes) — no backend changes were needed for this, it was
    already there and simply wasn't surfaced in the UI before.

### Anonymous hash link controls: participant limits, expiry

- **Optional per-link participant limit.** `SurveyHashLink.max_participants`
  (nullable) can be set on creation or edited later. Once
  `anonymous_participant_count` reaches the limit, new anonymous
  participants are blocked with a clear Persian error message.
- **Optional link expiry duration.** Admins choose a duration (e.g. "5
  ساعت", "2 روز", "1 هفته") instead of a fixed date —
  `expiry_value` + `expiry_unit` (`hours`/`days`/`weeks`) are stored and
  `expires_at` is computed and cached on the model (`SurveyHashLink.save()`
  / `_compute_expires_at()`). Both the anonymous survey-detail and
  submission endpoints reject expired links with a 403 and Persian message.
  Clearing both fields (send `null`/`null`) removes the expiry.
- **Backend wiring:**
  - `PATCH /admin/hash-links/<id>/` and `POST
    /admin/surveys/<id>/hash-links/` accept `max_participants`,
    `expiry_value`, `expiry_unit`.
  - `SurveyHashLinkSerializer` validates limits are positive, expiry
    value/unit are set or cleared together, and exposes read-only
    `is_expired`/`is_full`/`expires_at`.
  - Migration `surveys/0012_...` adds `max_participants`, `expiry_value`,
    `expiry_unit`, `expires_at` to `SurveyHashLink`.
  - New activity action `hash_link_update_limits` for auditing.
- **Redis wiring:** the previously-defined but unused
  `key_hash_links`/`invalidate_hash_links` cache helpers in
  `apps/core/cache.py` are now actually used — the admin hash-link list
  endpoint is cached in Redis for 60s and invalidated on every create,
  update, and delete.
- **Frontend:** `HashLinksPanel` gained optional "محدود کردن تعداد
  شرکت‌کنندگان" and "تعیین مهلت انقضا" controls, redesigned as a clear
  two-column card layout with icons, a highlighted border/background when
  a limit is enabled, and explicit "بدون محدودیت"/"بدون انقضا" hints
  otherwise. Status badges added for "منقضی شده"/"ظرفیت تکمیل".
  `types/index.ts` and `api/endpoints.ts` updated to match.
- **Dark theme pass:** removed hardcoded `bg-white` utility classes that
  fought with the app's dark-theme override system; replaced with
  `.input-field`'s own styling and dark-safe Tailwind shades already
  covered by `globals.css` (`border-emerald-200`/`border-amber-200` instead
  of the uncovered `-300` variants, `bg-gray-50` instead of `bg-white` for
  the token chip, themed checkboxes via `text-[color:var(--c-600)]`,
  matching the pattern already used in `UserManagement.tsx`).

### Bug fix: stray error toast when navigating away from a survey's detail page

- `SurveyDetail.tsx`'s `handlePersonSaved` refreshed the participant list
  with `adminPersonApi.list(surveyId).then(...)` and **no `.catch` at
  all**. If the admin saved a person and then navigated to another admin
  page before that request settled, a failed/interrupted request became an
  unhandled promise rejection, which could surface as an unintended error
  popup. Added a proper `.catch` with `isCanceledRequest` handling (silently
  ignored) and a Persian `toast.error` for genuine failures, matching the
  pattern already used everywhere else in this file.

Verified with `python manage.py check`, a full migration + smoke-test pass
(create/list/patch/clear/validate) against a throwaway sqlite DB,
`tsc --noEmit`, and `vite build`.

## [2.7.1] — 2026-07-04

### Dark mode contrast fixes

Follow-up to the [2.7.0] dark mode release — several gray elements were too
dim against the dark surfaces.

- **Page vs. card separation was too subtle.** The per-accent dark page
  background (`--c-bg`) and the generic card surface (`--surface`) were too
  close in lightness, so cards barely stood out from the page. Darkened all
  four `--c-bg` values and widened the `--surface` → `--surface-alt` →
  `--border-soft` ladder in `globals.css` so cards, secondary buttons, and
  badges are clearly distinguishable from the page and from each other.
- **Gray text scale brightened.** `text-gray-400/300`, `text-slate-400/200`,
  and both placeholder shades were too dim to read comfortably on dark
  surfaces — brightened the whole scale a step, most noticeably the dimmest
  tones (`text-gray-300`, `placeholder-gray-300`).
- **Missing overrides added:** `divide-gray-50`/`divide-slate-50` (some
  lists use `-50` instead of `-100` for row separators), and
  `placeholder-gray-300`. These utility classes were simply never covered
  before.
- **Fixed an unrelated pre-existing bug** in `ConfirmModal`
  (`components/common/index.tsx`) found while auditing: the non-danger
  variant's icon circle was setting its background via
  `className={... : 'var(--c-50)'}` — a CSS custom property used as a
  Tailwind class name, which is invalid and renders as no background at
  all. It now correctly applies `backgroundColor: 'var(--c-50)'` via
  `style`. This affected light mode too, just less noticeably against a
  white page.

No backend/DB/Redis changes — CSS/component-only. Verified with `tsc
--noEmit` and `vite build`.

## [2.7.0] — 2026-07-04

### Light / dark theme mode

Added a full light/dark mode toggle alongside the existing accent-color
switcher, with a smooth transition and no flash on load.

- **`ThemeSwitcher.tsx`** — a sun/moon button now sits next to the accent
  color swatch (in the admin sidebar, employee header, and the anonymous
  survey page) for a one-click toggle. The same choice is also exposed as a
  segmented "روشن / تاریک" control inside the color dropdown.
- **`ThemeContext.tsx`** — now manages both `theme` (accent) and `mode`
  (`light`/`dark`). Each accent has a dedicated dark palette: the `50/100/200`
  tints become translucent overlays on the dark surface instead of
  near-white fills, `600` keeps its vivid, identity value for solid button
  backgrounds, and `700` — used throughout the app as *text/hover* color on
  top of light backgrounds — is remapped to a lighter tone in dark mode so
  the same text stays readable instead of going near-invisible on a dark
  card. The chosen mode is persisted to `localStorage`
  (`app-theme-mode`) and falls back to the OS `prefers-color-scheme`
  setting on first visit, tracking it live until the person makes an
  explicit choice.
- **`index.html`** — a small inline script sets the `dark` class (and
  `color-scheme`) on `<html>` before React mounts, so there's no
  light-mode flash on reload for people who've chosen dark.
- **`globals.css`** — a global `background-color, border-color, color,
  fill, stroke, box-shadow` transition (0.2s ease) makes the mode switch
  itself feel smooth rather than an instant snap, and respects
  `prefers-reduced-motion` via the existing media query. Dark equivalents
  were added for every raw Tailwind gray/slate/status-color utility class
  already used across the app (`bg-white`, `text-gray-500`,
  `border-gray-100`, `bg-emerald-50`, hover states, shadows, scrollbars,
  skeleton shimmer, placeholders, etc.) by targeting `.dark <utility>` —
  which has higher specificity than the plain utility and so always wins —
  rather than rewriting every page with `dark:` variants.
- A handful of components compute colors as inline hex rather than Tailwind
  classes (survey results score/emoji pills, rank medals, stat cards,
  active/draft badges). These now read `mode` from `useTheme()` and pick a
  dark-appropriate variant explicitly, so they update instantly and in sync
  with the rest of the UI when the mode is toggled — a plain
  `document.documentElement.classList.contains('dark')` check inside a pure
  function would have lagged a render behind the actual DOM update.

No backend, database, Redis, or API changes — this is entirely a frontend
presentation feature. Verified with a clean `tsc --noEmit` and `vite build`.

## [2.6.2] — 2026-07-04

### Fixed: spurious "session expired" errors and forced logouts while navigating

Root cause: the backend has `ROTATE_REFRESH_TOKENS` + `BLACKLIST_AFTER_ROTATION`
enabled (`backend/config/settings/base.py`), so every call to
`/api/auth/refresh/` both issues a new refresh token **and blacklists the one
that was used** — a refresh token is single-use. The frontend axios
interceptor (`frontend/src/api/client.ts`) had two bugs that turned this into
random-feeling logouts and error toasts:

1. **Lost rotation** — on a successful refresh it only stored the new
   *access* token and silently discarded the new *refresh* token from the
   response, continuing to hold the now-blacklisted one. The very next
   refresh (up to an hour later, or immediately under bug #2 below) would
   fail, wipe the session, and hard-redirect to `/login`.
2. **Unguarded concurrency** — the in-memory access token doesn't survive a
   page reload, so right after a hard refresh every mounted component fired
   its first request unauthenticated. Each got a 401 and independently
   called `/auth/refresh/` with the *same* refresh token. Only the first
   call could ever succeed; the rest arrived after it had already been
   rotated/blacklisted, failed, and each cleared the session and redirected
   — while the still-pending page requests kept surfacing their own
   `"خطا در بارگذاری..."` toasts in the moment before the redirect actually
   fired. This is what showed up as "random error pop-ups while switching
   between parts of the app."

Fixes, both in `frontend/src/api/client.ts`:

- The rotated refresh token is now persisted (`res.data.refresh`) after
  every successful refresh.
- Concurrent 401s now await a single shared in-flight refresh call
  (`refreshPromise`) instead of racing separate ones against the same
  single-use token.

`frontend/src/contexts/AuthContext.tsx` now also proactively refreshes the
access token once on mount (when a saved user + refresh token exist) instead
of waiting for the first page request to 401 — the existing route guards in
`routes/Guards.tsx` already hold rendering on `isLoading`, so this removes
the burst of parallel unauthenticated first-requests after a reload
entirely, rather than just making them survive the race.

No backend, database, Redis, or API changes — this was purely a frontend
token-handling bug; the backend's rotate/blacklist behavior is correct and
unchanged.

## [2.6.1] — 2026-07-04

### Clearer "already participated" state on the anonymous survey page

Previously, when a device/IP had already completed an anonymous survey
(`ip_locked: true` from `GET /api/anonymous/survey/{token}/`), the frontend
only reflected that on a per-card basis: each `PersonCard` waited on the
separate `GET /api/anonymous/survey/{token}/{survey_id}/my-ratings/` call to
resolve before showing the green "ثبت شد" checkmark. In the gap between
those two requests, cards briefly showed a generic gray **"پایان یافته"**
label — indistinguishable from a closed survey — instead of communicating
"you already participated."

- **`AnonymousSurvey.tsx`** — the "already participated" banner is now
  driven solely by `ip_locked` from the initial survey fetch, not by the
  `allDone` flag (which depended on the slower `my-ratings` response). It
  renders immediately on first paint, with clearer wording.
- Person cards now treat `has_rated` as `true` immediately whenever
  `ip_locked` is set, so every card shows the emerald "ثبت شد" checkmark
  state right away instead of flashing the ambiguous gray "ended" state
  first.
- Collapsed the previous two overlapping banners (amber "already
  participated" + green "all done") into one consistent emerald state for
  the IP-locked case, with a separate, unchanged green banner for the
  (rarer) case of finishing in the current session without being
  IP-locked.
- No backend, database, Redis, or API changes — `ip_locked` was already
  returned by the existing endpoint; this is purely a frontend
  render-order fix.

## [2.6.0] — 2026-07-04

### QR codes for anonymous hash links

Admins can now generate a scannable QR code for any anonymous hash link
directly from the **Hash Links** panel on a survey's detail page — useful
for posters, printed handouts, or sharing in chat apps where a raw URL
isn't convenient.

- **`frontend/src/components/admin/QrCodeModal.tsx`** (new) — modal that
  renders a QR code onto a `<canvas>` using the `qrcode` package and offers
  a "Download PNG" button. The code encodes the exact same
  `{VITE_PUBLIC_BASE_URL}/s/{token}` URL shown next to the link, so
  scanning it lands on the same anonymous voting page as the copy-link
  button.
- **`HashLinksPanel.tsx`** — added a QR icon button next to the existing
  copy button on each link row; clicking it opens `QrCodeModal` for that
  link's URL and label.
- Generation is 100% client-side — the token/URL never leaves the
  browser to produce the code, so **no backend, database, Redis, or nginx
  changes were required**. `npm ci` in `frontend/Dockerfile` picks up the
  new dependency automatically via the updated lockfile.
- New dependencies: `qrcode@^1.5.4` (runtime) and `@types/qrcode@^1.5.6`
  (dev), added to `frontend/package.json` and `frontend/package-lock.json`.

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
