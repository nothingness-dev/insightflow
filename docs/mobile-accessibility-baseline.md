# Mobile accessibility baseline

This document is the tracked source of truth for milestone 1 of the mobile accessibility plan. The generated screenshots and reports live under `ux-audit/mobile-baseline/generated/` and are intentionally ignored by Git.

## Test matrix

| Audience | Route or state | Baseline coverage | Additional states to preserve |
| --- | --- | --- | --- |
| Public | `/login` | 320, 390, desktop; light and dark; axe smoke | empty, validation error, invalid credentials, submitting, server error |
| Anonymous | `/s/:token` | 320, 390, desktop; light and dark; axe smoke | loading, available, completed, IP locked, expired, disabled, participant limit, invalid token |
| Anonymous | rating dialog | 320, 390, desktop; light and dark | score, emoji, comment, validation error, long content, submit error, submitting |
| Employee | `/surveys` | 320, 390, desktop; light and dark; axe smoke | loading, populated, empty, error |
| Employee | `/surveys/:id` | 320, 390, desktop; light and dark | available, partially completed, completed, rating dialog, validation and submit errors |
| Admin | `/admin` | 320, 390, desktop; light and dark; axe smoke | loading, populated, empty, API error |
| Admin | `/admin/surveys` | 320, 390, desktop; light and dark | search, filters, pagination, empty, loading, error |
| Admin | `/admin/survey-progress` | 320, 390, desktop; light and dark | filters, pagination, loading, empty, error |
| Admin | `/admin/surveys/new` | 320, 390, desktop; light and dark | empty, mixed question types, validation errors, long content |
| Admin | `/admin/surveys/:id` | 320, 390, desktop; light and dark | draft, published, closed, people pagination, hash links |
| Admin | `/admin/surveys/:id/edit` | 320, 390, desktop; light and dark | default/custom questions, validation, loading, long content |
| Admin | `/admin/surveys/:id/results` | 320, 390, desktop; light and dark | summary, comments, IP audit, filters, pagination, exporting, skeleton and error |
| Admin | `/admin/users` | 320, 390, desktop; light and dark | search, filters, pagination, add/edit modal, import, loading, empty, error |
| Admin | `/admin/activity` | 320, 390, desktop; light and dark | filters, dense logs, pagination, export, empty, loading, error |
| Admin | `/admin/settings/data` | 320, 390, desktop; light and dark | counts, destructive confirmation, loading, error |
| Shared | navigation and dialogs | covered through routes above | drawer open, account menu, theme menu, password modal, Escape and focus restoration |

The baseline runner captures stable default/data states. The additional states are required fixtures for the page-specific milestones and must receive before/after evidence when those components are changed.

## Acceptance thresholds

| Area | Threshold |
| --- | --- |
| Reflow | No document-level horizontal scrolling at 320 CSS px |
| Zoom | Primary content and actions remain available at 200% browser zoom |
| Touch targets | Aim for at least 44 × 44 CSS px for controls; exceptions must keep adequate spacing and an equivalent large target |
| Form text | Inputs, selects, and textareas use at least 16 px text on mobile |
| Page gutters | Minimum 12 px at 320; 16 px from 360 upward unless a full-bleed component is intentional |
| Typography | Body text at least 14 px; primary reading text preferably 16 px; no essential information below 12 px |
| Focus | Every keyboard control has an obvious `:focus-visible` indicator with at least a 2 px visual edge |
| Contrast | WCAG AA: 4.5:1 normal text, 3:1 large text and meaningful UI boundaries |
| Sticky/fixed UI | Does not obscure content, focused controls, validation messages, or toasts; includes mobile safe-area padding |
| Motion | Essential behavior works with `prefers-reduced-motion: reduce` |
| RTL and content | Logical order remains correct with Persian/Latin text, long survey names, long comments, IPv6, and large counts |
| Semantics | Controls expose accessible names, roles, values/states, instructions, and errors |

## Running the baseline

Against the local Docker application:

```powershell
$env:MOBILE_BASE_URL = "http://127.0.0.1"
$env:MOBILE_ALLOW_LOCAL_FIXTURES = "1"
npm.cmd --prefix frontend run e2e:mobile-baseline
```

Fixture mode is hard-blocked for non-local hosts. It creates a temporary employee and, when needed, a temporary survey/hash link, then removes them after the run. Without fixture mode, provide:

- `MOBILE_EMPLOYEE_USERNAME`
- `MOBILE_EMPLOYEE_PASSWORD`
- `MOBILE_ANONYMOUS_TOKEN`

Use `-- --strict` when high-severity baseline failures should fail the command. Normal baseline mode records current failures but exits successfully unless the runner itself fails.

## Evidence policy

Before changing a responsive component:

1. Run the baseline and keep the relevant “before” screenshots.
2. Implement one scoped component or flow.
3. Run the same viewport/theme/state combination again.
4. Review the visual diff and the JSON/Markdown findings.
5. Do not accept a change that creates new horizontal overflow, hidden actions, keyboard regressions, or serious/critical axe violations.

Automated axe results are only one layer. NVDA, TalkBack/VoiceOver, keyboard order, 200% zoom/reflow, contrast verification, and real-device behavior still require manual checks.

## Initial baseline result

The first complete run on 2026-07-29 produced:

- 90 screenshots across 15 route/state entries, three viewport sizes, and two themes;
- zero blocked routes and zero browser console errors;
- zero document-level horizontal overflow failures;
- a visible focus indicator on the first keyboard target in every captured state;
- at least one sub-44 px target in every captured state;
- mobile form text below 16 px in 28 captured state/viewport/theme combinations;
- three serious axe color-contrast findings: login (1 node), anonymous survey (6 nodes), and employee survey list (19 nodes);
- no serious/critical axe violation in the representative admin-dashboard scan.

These are baseline failures, not accepted exceptions. Milestone 2 should start with shared target sizing, mobile form typography, and muted-text contrast because those changes have the widest cross-route effect.

## Milestone 2 verification

The shared-foundation implementation was verified on 2026-07-29 with the same 90-state matrix:

| Check | Before | After |
| --- | ---: | ---: |
| Serious/high findings | 3 | 0 |
| Axe violations in representative scans | 3 | 0 |
| State combinations with sub-44 px targets | 90 | 20 |
| Mobile state combinations with sub-44 px targets | 60 | 0 |
| Mobile form-font findings | 28 | 0 |
| Horizontal overflow | 0 | 0 |
| Missing initial focus indicator | 0 | 0 |
| Browser console errors | 0 | 0 |
| Blocked routes | 0 | 0 |

The 20 remaining target-size advisories are all desktop-only compact controls. They remain recorded, but are not mobile regressions and do not block completion of the shared mobile foundation milestone.

Milestone 2 introduced:

- AA-safe light-mode muted and error colors;
- a high-contrast, forced-colors-compatible focus ring;
- consistent disabled, busy, invalid, and selected states;
- 44 px mobile buttons, form controls, icon buttons, and compact links;
- 16 px mobile input text and 13 px mobile secondary text;
- dynamic viewport-height fallbacks and safe-area-aware page gutters;
- reusable `app-container`, `app-page`, `touch-target`, and `compact-link` foundations;
- logical RTL positioning and spacing in the shared shells and form controls;
- selected-state semantics for numeric and emoji ratings;
- stronger reduced-motion fallbacks;
- correct effective-target measurement for checkboxes and radio controls wrapped by labels.
