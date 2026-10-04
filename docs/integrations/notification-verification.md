# Notification standardization verification

2026-10-04, current Windows workspace. No dev server, production build,
database migration or external notification send was performed.

## Results and limits

- `npm run architecture:check`: passed twice; final check covered 1,318 source files.
- `npm run lint:strict`: passed twice. Focused ESLint also passed after final
  LINE presentation changes.
- `npm run typecheck`: passed after correcting an unsupported regex flag in the
  new test. The first run failed on TS1501; no production typing issue was hidden.
- Full suite ran once, after diff review and stable notification behavior:
  **392 files passed, 3,874 tests passed, 1 skipped**. The existing skip is
  `modules/it/infrastructure/attachments/cleanup-orphans.test.ts` on Windows.
- Afterwards, only LINE green/amber colors were darkened for small white header
  and button text. Actual palette contrast was checked (4.83–6.47:1), and focused
  tests/ESLint passed. No repeated full suite was warranted by this isolated change.
- UTF-8 decoding, BOM retention and absence of Unicode replacement characters
  were checked for every changed/new file. Edits preserved the original worktree
  newline style; Git's LF/CRLF checkout warnings are not Thai text corruption.
- Repository-wide searches found no active old subject/sender/CTA/Email Request
  actor wording. The old actor phrase remains only in a negative regression assertion.
- MySQL integration tests are excluded by the normal Vitest configuration and
  were not run. The updated IT integration assertion remains unverified against
  a real database. No live Email/LINE client rendering or provider acceptance is claimed.

## Exact verification commands

Output redirects to temporary UTF-8 logs are omitted here; command arguments
below are the actual verification invocations.

Initial presentation iteration (26 files: 107 passed, 28 failed on old wording
expectations; these were corrected without weakening security assertions):

```powershell
npm run test -- modules/it/infrastructure/notifications modules/it/application/email-request/notifications.test.ts modules/it/application/notifications modules/leave/application/notifications modules/leave/infrastructure/notifications modules/routine/application/notifications modules/stock/__tests__/email.test.ts modules/stock/__tests__/email-template-xss.test.ts modules/stock/__tests__/notifications.test.ts modules/stock/__tests__/line-notifications.test.ts modules/stock/__tests__/stock-low-flex.test.ts __tests__/lib/email-templates-xss.test.ts __tests__/api/forgot-password-route.test.ts
```

Iteration: 27 files; 139 passed, 1 failed on the old Stock Inbox body. Corrected later.

```powershell
npm run test -- lib/email/templates/notification.test.ts modules/it/infrastructure/notifications modules/it/application/email-request/notifications.test.ts modules/it/application/notifications modules/leave/application/notifications modules/leave/infrastructure/notifications modules/routine/application/notifications modules/stock/__tests__/notification-content.test.ts modules/stock/__tests__/email.test.ts modules/stock/__tests__/email-template-xss.test.ts modules/stock/__tests__/notifications.test.ts modules/stock/__tests__/line-notifications.test.ts modules/stock/__tests__/stock-low-flex.test.ts __tests__/lib/email-templates-xss.test.ts __tests__/api/forgot-password-route.test.ts
```

Passed: 5 files, 42 tests.

```powershell
npm run test -- modules/stock/__tests__/notifications.test.ts modules/leave/infrastructure/notifications/email.test.ts modules/leave/infrastructure/notifications/line-flex.test.ts modules/routine/application/notifications/email.test.ts __tests__/api/forgot-password-route.test.ts
```

Expanded verification: 39 files; 404 passed, 2 failed on old Stock processor wording. Corrected with focused verification below.

```powershell
npm run test -- lib/email/templates/notification.test.ts modules/it/infrastructure/notifications modules/it/application/email-request modules/it/application/notifications modules/leave/application/notifications modules/leave/infrastructure/notifications modules/routine/application/notifications modules/routine/application/reminders.test.ts modules/routine/application/contract-reminders.test.ts modules/stock/__tests__/notification-content.test.ts modules/stock/__tests__/email.test.ts modules/stock/__tests__/email-template-xss.test.ts modules/stock/__tests__/notifications.test.ts modules/stock/__tests__/line-notifications.test.ts modules/stock/__tests__/stock-low-flex.test.ts modules/stock/__tests__/mutations.test.ts __tests__/lib/email-templates-xss.test.ts __tests__/lib/email-graph.test.ts __tests__/api/forgot-password-route.test.ts __tests__/api/leave-cancel.test.ts __tests__/api/leave-not-taken.test.ts __tests__/services/outbox/processor.test.ts
```

Passed: 2 discovered files, 68 tests. The lib/ template test path was outside discovery; it was moved to __tests__/lib and executed below.

```powershell
npm run test -- __tests__/services/outbox/processor.test.ts modules/leave/application/notifications/notifications.test.ts lib/email/templates/notification.test.ts
```

Passed: 18 files, 138 tests, including the relocated generic presentation tests.

```powershell
npm run test -- __tests__/lib/notification-presentation.test.ts modules/it/infrastructure/notifications modules/it/application/notifications modules/it/application/email-request/notifications.test.ts modules/leave/infrastructure/notifications modules/stock/__tests__/notification-content.test.ts
```

Passed: 4 files, 9 tests.

```powershell
npm run test -- modules/routine/application/notifications modules/stock/__tests__/notification-content.test.ts modules/stock/__tests__/stock-low-flex.test.ts
```

Passed: 392 files, 3,874 tests; 1 existing Windows-only skip.

```powershell
npm run test
```

Passed after the isolated LINE contrast adjustment: 4 files, 28 tests.

```powershell
npm run test -- modules/it/infrastructure/notifications/line-flex.test.ts modules/leave/infrastructure/notifications/line-flex.test.ts modules/stock/__tests__/notification-content.test.ts modules/stock/__tests__/stock-low-flex.test.ts
```

Static checks:

```powershell
npm run architecture:check
npm run lint:strict
npm run typecheck
npx eslint lib/email/templates/notification.ts lib/line/notification-flex.ts shared/notifications __tests__/lib/notification-presentation.test.ts modules/routine/application/notifications modules/stock/infrastructure/notifications/line-messages --max-warnings=0
npx eslint modules/it/domain/ticket-notification-content.ts modules/leave/infrastructure/notifications/line-flex.ts modules/stock/infrastructure/notifications/line-messages --max-warnings=0
git diff --check
```

`git diff --check` passed; encoding/contrast audits used temporary read/check
scripts outside the repository. No temporary source/debug artifacts were retained.

## Files changed

- `__tests__/api/forgot-password-route.test.ts`
- `__tests__/lib/email-graph.test.ts`
- `__tests__/lib/notification-presentation.test.ts`
- `__tests__/services/outbox/processor.test.ts`
- `app/api/auth/forgot-password/route.ts`
- `docs/integrations/notification-inventory.md`
- `docs/integrations/notification-verification.md`
- `docs/integrations/notifications.md`
- `lib/auth/ssot.ts`
- `lib/email/templates/notification.ts`
- `lib/email/templates/password-reset.ts`
- `lib/line/notification-flex.ts`
- `modules/it/__tests__/integration/ticket-notifications.integration.test.ts`
- `modules/it/application/email-request/notifications.test.ts`
- `modules/it/application/email-request/notifications.ts`
- `modules/it/application/notifications/dispatch.ts`
- `modules/it/domain/email-request/notification-content.ts`
- `modules/it/domain/ticket-notification-content.ts`
- `modules/it/infrastructure/notifications/email-request-email.test.ts`
- `modules/it/infrastructure/notifications/email-request-email.ts`
- `modules/it/infrastructure/notifications/email-request-flex.ts`
- `modules/it/infrastructure/notifications/email-request-line.test.ts`
- `modules/it/infrastructure/notifications/email-template.ts`
- `modules/it/infrastructure/notifications/line-flex.test.ts`
- `modules/it/infrastructure/notifications/line-flex.ts`
- `modules/it/infrastructure/notifications/ticket-email.test.ts`
- `modules/it/infrastructure/notifications/ticket-email.ts`
- `modules/leave/application/cancellation/cancellation.ts`
- `modules/leave/application/not-taken.ts`
- `modules/leave/application/notifications/notifications.test.ts`
- `modules/leave/application/notifications/notifications.ts`
- `modules/leave/domain/notification-content.ts`
- `modules/leave/infrastructure/notifications/email-templates/leave-action.ts`
- `modules/leave/infrastructure/notifications/email-templates/leave-event.ts`
- `modules/leave/infrastructure/notifications/email-templates/leave-result.ts`
- `modules/leave/infrastructure/notifications/email.test.ts`
- `modules/leave/infrastructure/notifications/email.ts`
- `modules/leave/infrastructure/notifications/line-flex.test.ts`
- `modules/leave/infrastructure/notifications/line-flex.ts`
- `modules/routine/application/notifications/email.test.ts`
- `modules/routine/application/notifications/email.ts`
- `modules/routine/application/notifications/routine-contract-expiry-email.ts`
- `modules/routine/application/notifications/routine-contract-expiry-flex.ts`
- `modules/routine/application/notifications/routine-reminder-email.ts`
- `modules/routine/application/notifications/routine-reminder-flex.test.ts`
- `modules/routine/application/notifications/routine-reminder-flex.ts`
- `modules/stock/__tests__/email.test.ts`
- `modules/stock/__tests__/mutations.test.ts`
- `modules/stock/__tests__/notification-content.test.ts`
- `modules/stock/__tests__/notifications.test.ts`
- `modules/stock/__tests__/stock-low-flex.test.ts`
- `modules/stock/infrastructure/notifications/email-template/stock-request-result.ts`
- `modules/stock/infrastructure/notifications/email.ts`
- `modules/stock/infrastructure/notifications/line-messages/stock-low.ts`
- `modules/stock/infrastructure/notifications/line-messages/stock-request-result.ts`
- `modules/stock/infrastructure/notifications/line-messages/stock.ts`
- `modules/stock/infrastructure/notifications/notifications.ts`
- `shared/notifications/presentation.ts`
