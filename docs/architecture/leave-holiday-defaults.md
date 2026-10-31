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
