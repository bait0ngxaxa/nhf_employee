# Built-in annual holiday defaults (B5/B6)

NHF uses verified general Bank of Thailand financial-institution holidays as its
default baseline, not as a statement of legal applicability to every employer.
There are no runtime source requests, API keys, scrapers, schedulers or workers.

## Verified data

Versioned UTF-8 JSON files live in `modules/leave/domain/holiday-defaults/`.
2026 `bot-2026-r1` contains 19 dates from BOT announcement 31/2568;
2027 `bot-2027-r1` contains 18 dates from BOT announcement 37/2569.
Dates, substitutes and applicability were checked on 2026-10-31 against:

- [BOT holiday page](https://www.bot.or.th/th/financial-institutions-holiday.html)
- [2026 BOT announcement PDF, pages 2–4](https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2568/ThaiPDF/25680162.pdf)
- [2027 BOT announcement](https://app.bot.or.th/FIPCS/thai/PFIPCS_summary.aspx?packId=25690175)
- [2027 BOT announcement PDF, pages 2–4](https://www.bot.or.th/content/dam/bot/fipcs/documents/FPG/2569/ThaiPDF/25690175.pdf)
- [SEC 2027 cross-check](https://www.sec.or.th/TH/Pages/News_Detail.aspx?SECID=13306)

The default excludes the Islamic Bank's additional religious holidays and the
conditional holidays for branches in Narathiwat, Pattani, Yala, Satun and Songkhla.
It also excludes [16 October 2026, a Bangkok-only special holiday](https://www.bot.or.th/content/dam/bot/documents/th/news-and-media/news/2026/news-20260609.pdf).
The accompanying WFH dates are not holidays. ADMIN can explicitly add an NHF
holiday when applicable. No lunar dates or substitutes are extrapolated for 2028.

## Resolution and provenance

An existing active published snapshot always wins, including an ADMIN override.
If none exists, a bundled year initializes an immutable published snapshot on
demand in the caller's serializable transaction. Atomic annual-row creation and
the same annual `FOR UPDATE` lock used by publication serialize initialization,
submission and publication. Only one initialization and one Audit event commit.
Days are inserted before publication so existing immutability triggers apply.

SYSTEM snapshots have null creator/publisher IDs and an explicit dataset revision;
their Audit event has null user ID and `actor: SYSTEM`, source and revision.
No synthetic account or ADMIN authority is created. A forward-only migration
makes creator nullable and adds dataset provenance triggers. Existing snapshots,
requests, version references, quotas and adjustment ledgers are not rewritten.

An initialized snapshot is pinned: deploying a changed dataset never overwrites
it or an ADMIN customization. Correct an initialized year through the existing
ADMIN revision/publication and explicit reconciliation workflows. Add a new
officially verified annual JSON file, register it in the dataset index and add its
source/date regression test; deployment makes that new year available on demand
without an ADMIN activation step. Unknown years still support manual TSV import.

## Deployment and recovery

The Dashboard labels the effective built-in source/revision and offers ADMIN
“ปรับแต่งวันหยุด”. No draft, publication confirmation or impact panel is needed
just to activate a default. Customization uses the existing copied draft editor,
including add/edit/remove and TSV import. Once published, it appears as an NHF
calendar and publication history remains available on demand.

An indexed existence query returns whether the selected year has any requests,
including terminal statuses. If none exist, the editor skips the impact exercise
and sends `skipImpactReview: true`. Publication rechecks existence inside its
serialized transaction and returns a conflict if a request appeared in the
meantime. The user must reload and use the ordinary impact workflow. Requests
submitted under enforced calculations share the annual lock. Serializable range
reads also prevent a request insert from invalidating the empty-year check before
commit. A failed publication changes neither active version nor Audit/quota.
When history exists, the existing paginated ADMIN impact/reconciliation workflow,
pending approval revalidation and explicit approved-charge adjustments remain.
Publication never adjusts existing requests or quotas automatically.

Source verification, publication note, optimistic revisions, empty-year holiday
confirmation and eligible System ADMIN authorization all remain required for
manual publication. Authentication and Leave business permissions are unchanged.

Apply forward migrations, regenerate Prisma Client and deploy the application.
Enable `LEAVE_HOLIDAY_CALENDAR_ENABLED=true` on all instances as normal feature
activation. Bundled years need no manual draft/publication. Disabled/setup mode
continues its explicit weekday-only behavior. After activation an unknown year
fails closed for submission/approval until ADMIN supplies a published calendar.

Public calendar reads may initialize a bundled snapshot; this is a deterministic
SYSTEM operation, never a user-supplied calendar mutation. Such reads and leave
previews never change requests or quota usage. A transaction failure rolls back
initialization and its Audit together; retry the operation. Monitor SYSTEM
publication Audit events and missing-year errors. Do not reset the database or
delete snapshots for rollback. Disable feature activation if needed; retain
schema/data and deploy a compatible forward fix. Older application versions must
be reviewed for compatibility with nullable SYSTEM creators before rollback.

Use only the protected MySQL `_test`/`_integration` runner. The bundled-year suite
explicitly opts into cleanup of 2026/2027 fixtures with known provenance; ordinary
calendar fixture cleanup continues rejecting real years and external references.

For the repository's legacy full-suite fixtures, set the command environment
`LEAVE_HOLIDAY_CALENDAR_ENABLED=false`. Calendar-specific tests explicitly enable
enforcement themselves and restore the environment afterward. A local application
`.env` with enforcement enabled otherwise leaks into older mocked API tests and
synthetic 2031 fixtures without calendars. Do not change `.env`, seed fake future
holidays, or disable enforcement in application code to make those fixtures pass.

## Executed verification — 31 October 2026

| Check | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run architecture:check` | PASS, 1,399 source files |
| `npm test` with command-local calendar flag `false` | PASS, 416 files; 4,147 passed, 1 existing Windows skip |
| `npm run test:integration:mysql` with command-local calendar flag `false` | PASS, 29 files / 234 tests; protected `127.0.0.1:3309/employee_nhf_integration` |
| Focused calendar/default/customization tests | PASS; real MySQL concurrent initialization/publication/submission, immutable defaults, ADMIN override persistence and stale empty-year publication rejection |
| Prisma Client generation | PASS; forward migration applied by protected runner, no pending migrations |
| Impeccable detector, diff and UTF-8 checks | PASS; no UI detector findings or replacement characters |

Both full suites initially inherited the local application's enabled calendar
flag. That caused 23 older mocked API unit tests and 30 legacy MySQL fixture tests
to fail: they did not supply calendars for their synthetic years. The two affected
API files passed all 44 tests with a command-local `false` flag. Full suites were
then repeated with that explicit fixture environment and passed; calendar-specific
tests still explicitly exercised enforcement enabled. No `.env` file or test
assertion was changed. The initial broad unit run also exceeded the existing
30-second limit for one Routine architecture graph check while other checks were
running. It passed in isolation and in the final full run without a timeout change.

During migration development, MySQL rejected a CHECK over cascading User FK
columns. The failed atomic DDL left the test table unchanged; only the protected
integration migration record was marked rolled back. The finalized provenance
triggers successfully migrated and passed subsequent suites. A fixture-hook
signature mismatch and an extra early mutation lock were corrected before B5 was
committed; the focused four-file MySQL verification then passed all 34 tests.

No production/staging migration, seed, deployment, browser E2E, physical LINE-device
acceptance or production build was performed. DOM tests cover the simplified UI;
shared Dashboard/LIFF projections and lifecycle accounting are tested against MySQL.
The existing Prisma configuration deprecation warning and Windows IT symlink-test
skip remain unchanged. Neither requests, quotas, notifications nor ledgers were
rewritten outside normal scoped test workflows.
