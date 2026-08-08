# Mobile accessibility release checklist

Use this checklist after the `Mobile accessibility` workflow passes and before
publishing a customer-facing release. The automated suite is a regression gate,
not a WCAG conformance certification.

## Automated gate

- [ ] The workflow completed on the exact release commit.
- [ ] Login, anonymous, employee, and admin axe smoke journeys passed.
- [ ] No route was blocked and no critical/high finding was reported.
- [ ] No unexpected browser console or page error was reported.
- [ ] Light and dark screenshots exist at 320 px, 390 px, and desktop widths.
- [ ] The responsive evidence artifact and `screenshot-manifest.json` were saved.
- [ ] The current evidence was compared with the latest successful `main` artifact.
- [ ] Any intentional visual change was reviewed in both themes and recorded below.

The CI environment is disposable. It creates its own PostgreSQL and Redis
volumes, uses CI-only credentials, permits fixtures only on loopback, and removes
the services and volumes after every run. It never connects to a customer or
production database.

## Keyboard and focus

Perform this pass on Windows using the production build and only the keyboard.

- [ ] Login can be completed in a logical focus order.
- [ ] Admin drawer and every overflow menu trap focus, close with Escape, and
      return focus to their trigger.
- [ ] Rating dialogs keep the title, close action, validation summary, and submit
      action reachable at 320 px and 200% browser zoom.
- [ ] Score and emoji options expose their selected state without relying on color.
- [ ] Sticky headers/actions never cover the focused control, error, or toast.
- [ ] Survey creation, filters, pagination, exports, and destructive confirmations
      can be completed without a pointer.

## NVDA on Windows

Use the current stable NVDA with a supported browser.

- [ ] Page titles, landmarks, headings, and RTL reading order are meaningful.
- [ ] Inputs announce their label, required/invalid state, help, and error text.
- [ ] Progress, loading, success, and recoverable failure messages are announced.
- [ ] Admin navigation, tables/mobile cards, dialogs, tabs, and pagination expose
      correct names, roles, states, and positions.
- [ ] Anonymous and employee users can identify a participant, answer every
      enabled question type, correct validation errors, submit, and continue.

## Real mobile device

Test at least one Android device with TalkBack. Test iOS with VoiceOver whenever
the customer environment supports iOS devices.

- [ ] Portrait and landscape layouts have no page-level horizontal scrolling.
- [ ] Touch targets are comfortably separated and work at the visible label/icon.
- [ ] The software keyboard does not hide the active field or sticky action.
- [ ] Browser text enlargement and 200% zoom preserve content and actions.
- [ ] Safe-area insets protect headers, drawers, dialogs, and bottom actions.
- [ ] Reduced-motion mode retains every essential action and state change.
- [ ] Long Persian/Latin names, IPv6, counts, and comments wrap or scroll inside
      their intended bounded region.

## Visual review

- [ ] Normal and muted text, focus rings, selected states, and meaningful
      boundaries meet the intended contrast in light and dark themes.
- [ ] Responsive reading order remains logical in RTL.
- [ ] Skeletons match the final mobile layout without disruptive jumps.
- [ ] Empty, loading, offline, permission-denied, and server-error states remain
      understandable and recoverable.

## Release evidence and exceptions

Critical/high failures, blocked critical journeys, hidden actions, keyboard traps,
or data-loss risks block release. A lower-severity exception must have a usable
workaround, owner, issue, and target date.

| Field | Record |
| --- | --- |
| Version/tag | |
| Commit | |
| CI run URL | |
| Responsive artifact name | |
| Tester and date | |
| Windows/browser/NVDA versions | |
| Android/iOS device and assistive technology | |
| Screenshot comparison result | |
| Approved visual changes | |
| Exceptions, owner, issue, target date | |
| Release decision | Pass / Blocked |
