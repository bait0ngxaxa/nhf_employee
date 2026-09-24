# H0 — Pre-IT Hardening Audited Source Baseline

Status: H0 complete — repository verification green; production acceptance
remains operator-pending.

Repository: bait0ngxaxa/nhf_employee
Audit date: 2026-09-21 (Asia/Bangkok)
Scope: audited-source discovery, verification, source-of-truth repair, and
handoff for the remaining H-series

This document is the authoritative current-state baseline for the pre-IT
hardening track. It supersedes older L-series PASS wording when the current
source or current verification differs. Historical L-series records remain
preserved in [runtime-hardening.md](./runtime-hardening.md).

## 1. Baseline metadata

| Item | Evidence |
| --- | --- |
| Audited source baseline SHA | bb61c03bdf93453b3e92ebee61c41637c3e5a477 |
| Audited source baseline subject | feat(ui): simplify role-free team-centric authorization administration |
| Audited source baseline date | 2026-09-20 16:45:12 +07:00 |
| Repository | bait0ngxaxa/nhf_employee |
| Initial H0 baseline documentation commit | c2f0374216f560ddf18c560cc4c73f23a54aaee5 |
| Relationship | H0 implementation and follow-up corrections after the audited source baseline are documentation-only; the audited runtime/application source remains bb61c03bdf93453b3e92ebee61c41637c3e5a477 |
| Previous purported L7 SHA | 6032381072cf589578f46188a4af2dbe50287fec |
| What that SHA actually is | Commit subject is chore: close L6 compatibility residue cleanup; it is not a separately evidenced L7 re-audit commit |
| Last runtime-hardening documentation commit | 5f903df3cf57f56eb2d34b7e4904d81823c21b4d |
| Distance from purported L7 SHA | 112 commits to the audited source baseline |
| Distance from last runtime-hardening documentation commit | 111 commits to the audited source baseline |
| Change magnitude from purported L7 SHA | 644 files changed; approximately 77,172 insertions and 3,882 deletions to the audited source baseline |
| Current migration count | 68 migration directories; latest is 20260920100000_migrate_routine_reminder_recipient_scope |
| Initial worktree state | Clean before H0 documentation edits |

The old L7 result cannot legitimately describe the audited source baseline.
The repository contains substantial post-baseline work in role-neutral authorization,
authorization administration, capability-based recipient policy, Routine
compatibility, Stock default-variant rollout, presentation, routes, schema,
migrations, and tests.

The historical documents refer to a final Section 24, but the highest actual
heading in runtime-hardening.md is Section 23. A repository-history search
also found no recorded Section 24 or independently evidenced L7 re-audit.
H0 repaired this inconsistency without inventing historical evidence.

## 2. Current-state conclusion

### Architecture

The modular monolith remains structurally coherent. The source tree keeps
Auth, Authorization, Employee, Department, Leave, Routine, Stock, LINE,
Notification, and Audit ownership in their existing module boundaries.
Shared Outbox, SMTP, LINE transport, and deployment infrastructure remain
shared/platform concerns. The architecture checker and architecture tests
cover the principal import, route, client/server, and persistence ownership
rules, and manual source review did not find a current direct-persistence
ownership regression.

No new architecture refactor phase is justified. K1 remains closed, Email
Request remains an intentionally deferred future IT boundary, and H0 did not
create modules/it or migrate Email Request.

There are narrow regression-protection gaps (cycle detection and generic
persistence guards) and a few retained presentation/compatibility surfaces.
They do not demonstrate an architecture failure and do not reopen the
modular-monolith migration.

### Authentication and authorization

The current implementation rechecks access-token/session, User, tokenVersion,
Employee/workforce lifecycle, and LIFF current-link state at the server
boundaries that own those decisions. Business authority is role-neutral:
Default Domain Policy plus Team, TeamRole, and direct User grants. ADMIN
remains an Auth/control-plane role for administration, bootstrap, role
management, and last-eligible-ADMIN protection; it is not an automatic
business grant source. This is documented in
[authorization-current-state.md](./authorization-current-state.md) and
implemented by the Authorization resolver/evaluator.

One Medium control-plane race remains: Authorization Administration verifies
ADMIN at the request boundary, then passes an actor snapshot into its
serializable mutation transaction without re-reading or locking the acting
User inside that transaction. This is a real residual hardening finding, not
a reason to redesign the authorization architecture.

### Severity conclusion

No Critical or High finding was established by the current source review.
The stale historical hardening evidence is fixed by H0 documentation repair.
The remaining Medium findings are the transaction-time Authorization
Administration revalidation gap and distributed runtime observability. The
remaining Low and Informational findings are bounded hardening gaps,
transitional debt, operational acceptance items, or intentional deployment
tradeoffs.

At the H0 baseline, no finding blocked H2 planning. The control-plane
revalidation finding should be closed before adding new security-sensitive
administration surfaces to a future IT capability. It does not authorize
starting IT work in H0.

H1 is explicitly DEFERRED — owner decision. It is not BLOCKED and not FAILED.
The expected handoff after H0 was H2 planning. H2 has since closed: Routine
recipient persistence under H2B and Stock explicit-default persistence under
H2C.

### Stock default-variant track

- H2C.1 — CLOSED. Operator-confirmed production backfill evidence passed with
  0 candidates; the explicit-default read cutover was enabled and stable.
- H2C.2 — CLOSED. Stock runtime treats `StockItem.defaultVariantId` as the
  canonical default. The dual-read flag, lowest-active read fallback, and
  runtime shadow comparison were removed. The nullable column remains
  intentional when an item has no active variants. When active variants exist,
  the value is required and must reference an active variant owned by that
  item. Explicit reads do not depend on the lowest variant ID; deterministic
  ID order remains only for mutation-time replacement.
- H2C.3 — CLOSED. The one-time default-variant backfill tooling was retired;
  `stock:audit` now permanently validates canonical explicit-default integrity.
- H2C.4 — CLOSED. Repository verification passed, and the operator-confirmed
  post-H2C.3 production audit exited 0 on deployed revision
  `9437999609e23a96c36ab6f88d3cebf94784e18f`. The audit reported zero strict
  Stock integrity violations. Its non-strict informational findings are
  recorded below.
- Stock explicit-default rollout — CLOSED.
- Stock transitional persistence debt — CLOSED.
- H2 Stock — CLOSED.

H2C.4 repository verification record (2026-09-24):

- Focused Stock tests: 5 files and 100 tests passed, covering the permanent
  inventory audit, canonical default, replacement writer, queries, and
  mutations/request creation.
- `npm run test:integration:mysql`: 17 files and 98 tests passed; all 71
  migrations were already applied to the dedicated integration database. Its
  Stock concurrency cases cover item-only default resolution and preservation
  of a request's variant snapshot after the default changes.
- `npm run stock:audit -- --json` and
  `npm run stock:audit:strict -- --json`: both exited 0 on the dedicated
  integration database. Its summary was `items=0`, `variants=0`,
  `activeItemsWithoutVariant=0`, `activeItemsWithoutActiveVariant=0`,
  `pendingRequestItemsWithoutVariant=0`, `crossItemReferences=0`,
  `defaultVariantInvariantViolations=0`, and `negativeInventoryRecords=0`.
  Informational `quantityMismatches`, `ledgerDiscrepancies`, and all other
  reported counts were 0 because the test database contained no Stock rows.
- `npm run lint:strict`, `npm run typecheck`, `npm run architecture:check`,
  and `npx prisma validate` passed. The architecture checker examined 1,142
  source files. Prisma emitted the existing `package.json#prisma`
  deprecation warning.
- `npm run test`: 334 files and 3,198 tests passed.

H2C.4 operator-confirmed production audit evidence (run date not supplied):

- Command: `npm run stock:audit:strict -- --json` from the reported production
  application directory `/var/www/nhf_employee`.
- Exit code: `0`.
- Deployed revision: `9437999609e23a96c36ab6f88d3cebf94784e18f`. Repository
  history confirms this revision descends from H2C.3 (`1b42c97f`).
- The JSON summary reported `items=82` and `variants=155`. Strict integrity
  counts were all zero: `activeItemsWithoutVariant=0`,
  `activeItemsWithoutActiveVariant=0`, `pendingRequestItemsWithoutVariant=0`,
  `crossItemReferences=0`, `defaultVariantInvariantViolations=0`, and
  `negativeInventoryRecords=0`. The output also reported
  `itemsWithoutVariant=0`, `inactiveItemsWithoutVariant=0`,
  `requestItemsWithoutVariant=0`, and `transactionsWithoutVariant=0`.
- Informational findings were `quantityMismatches=50`,
  `variantsWithoutLedgerCoverage=61`, and `ledgerDiscrepancies=134`. These
  retain their existing non-strict severity and are not reported as zero.
- No production repair was performed as part of H2C.4; the audit command is
  read-only.

## 3. Evidence inventory

### Architecture and boundaries

- modules/ remains the owner of domain/application/persistence code for the
  current capabilities.
- app/api/ routes use public module/application entries; the manual review did
  not find direct Prisma delegates in route handlers or deep imports into
  internal module layers.
- scripts/check-architecture.mjs and
  __tests__/architecture/check-architecture.test.ts provide executable
  boundary evidence. The final architecture count is recorded in Section 10.
- NotificationOutbox remains shared/platform infrastructure. Its processor
  calls domain capabilities through public entries.
- Email Request remains in lib/services/email-request and is a documented
  future IT boundary, not a current regression.

The current source does contain public-entry dependency cycles such as
Authorization/Audit and LINE/Routine or LINE/Stock. They use approved public
entries, and no runtime failure was demonstrated. This is recorded as a
bounded hardening gap rather than an architecture-refactor trigger.

### Authentication and authorization

- middleware.ts validates JWT shape/claims and does not replace server-side
  route/session resolution.
- modules/auth/application/sessions.ts and the Auth API boundary recheck
  persisted session family, User state, tokenVersion, and workforce state.
- lib/auth/csrf.ts provides trusted mutation wrapping for the mutation routes
  that require it.
- lib/auth/rate-limit.ts and lib/security/mutation-rate-limit.ts provide
  pre-auth and authenticated mutation abuse controls.
- lib/network/trusted-client-ip.ts accepts only syntactically valid trusted
  client-IP input; deployment/nginx/employee_nhf.cloudflare-origin.conf
  defines the supported proxy-origin contract.
- modules/line/infrastructure/session/liff-session.ts and the LIFF
  application paths enforce the current account link for protected use.
- modules/authorization/application/evaluator.ts does not turn systemRole
  into a business grant.
- modules/authorization/application/administration-mutations.ts has the
  transaction-time actor snapshot gap described in Finding H0-AUTH-01.

Searches that found ADMIN references were classified rather than treated as
defects. They are control-plane guards, role normalization at an adapter
boundary, administration UI/presentation state, or department code values.
No unintended role-based recipient or business-authority path was found in
the current Routine, Stock, or Email Request recipient implementations.

### Persistence and migrations

- prisma/schema.prisma retains the five Routine recipient enum values during
  the expand-only rollout.
- migration
  prisma/migrations/20260920100000_migrate_routine_reminder_recipient_scope/migration.sql
  explicitly keeps both vocabularies readable until old processes are retired.
- application normalization is in
  modules/routine/application/recipient-scope-compatibility.ts; mutation
  writes remain canonical.
- StockItem.defaultVariantId remains nullable because an item with no active
  variants may have no default. When active variants exist, the runtime
  validates that the canonical default belongs to the item and is active.
- H2C.2 removed the Stock runtime flag, dual-read fallback, and shadow
  comparison without a schema migration. H2C.3 retired the one-time backfill
  tooling and made the read-only RepeatableRead Stock audit validate the
  canonical explicit-default invariant.

### Runtime reliability

- Outbox state transitions use conditional claims, stale PROCESSING recovery,
  bounded exponential retry, DEAD handling, and provider-specific retry
  markers where available. The contract is at-least-once, not exactly-once.
- Routine scheduler enqueueing uses a unique event key; repeated or
  concurrent scheduler calls are intended to be safely deduplicated.
- Cron endpoints require separate secrets. Correctness of recurring work
  depends on an external scheduler; after() is only an opportunistic
  post-response dispatch/audit path.
- Audit writes are transactional on paths that require atomicity and
  best-effort on compatibility/non-transactional paths.
- Uploads use local persistent disk. Public stock image retrieval and private
  Leave attachment retrieval have separate route and authorization contracts.

### Security controls

- Trusted mutation headers are enforced by the shared helper on many
  authentication/LIFF mutation routes; H0 found a coverage gap on
  Authorization Administration mutation routes. Request limits, mutation
  rate limits, security headers, upload type/size validation, path traversal
  guards, private attachment authorization, LINE webhook HMAC verification,
  and sanitized error responses are present in current source.
- next.config.ts defines the current security header policy, including CSP,
  frame, content-type, referrer, permissions, and transport controls. H0
  does not redesign the policy.
- The Cloudflare/Nginx trusted-IP and origin-reachability assumptions are
  deployment invariants, not fully provable from source.

### Observability

The repository has application and dashboard error boundaries and some
structured-shaped Outbox/audit metadata. It does not have a single
centralized operational logger, global request/correlation-ID propagation,
APM integration, instrumentation.ts, or a health/readiness endpoint.
Production console.error/console.warn usage remains distributed (the runtime
inventory found 166 production occurrences across 103 files). This is a
later H3/H4 work item, not an H0 observability redesign.

### Test architecture

The repository inventory includes unit, API, architecture, component/
presentation, concurrency/idempotency, and MySQL integration coverage. The
current inventory found 356 test files, including 57 API, 18 MySQL
integration, 1 architecture, 91 component/presentation, and 13
concurrency/idempotency files. Vitest separates Node and jsdom projects.

No Playwright, Cypress, or other true browser E2E suite/configuration was
found. Browser transport tests are not equivalent to a browser journey.
The critical journeys that currently lack true browser-level regression
protection include authentication/refresh, LIFF link/current-session
enforcement, Stock request/processing, Leave attachment/approval, and the
Routine user-facing flow.

### Production assumptions

Repository documents define, but do not prove, the following:

- one supported Next.js process/topology for process-local controls;
- external ownership of Routine scheduler, Notification Outbox, and cleanup
  cron calls;
- Cloudflare/Tunnel/Nginx routing and trusted-origin firewall state;
- SMTP and LINE Provider/channel configuration and delivery;
- persistent .uploads storage and its backup/restore pairing with MySQL;
- production migration, rollback, monitoring, backup, and restore evidence.

The production acceptance matrix explicitly keeps manual/production rows at
NOT RUN until evidence is attached. H0 does not convert missing operator
evidence into PASS.

## 4. Ranked finding ledger

| Rank | H0 finding (historical) | Severity | Classification | H0 disposition (historical) | Recommended phase at H0 |
| --- | --- | --- | --- | --- | --- |
| 1 | Stale L7 PASS and missing Section 24 source-of-truth | Medium | CONFIRMED_DEFECT | Fixed in H0 documentation | Closed by H0 |
| 2 | Authorization Administration actor is not revalidated inside its mutation transaction | Medium | HARDENING_GAP | Open; documented only | H7 |
| 3 | Runtime logs/events are distributed and lack a centralized operational contract | Medium | HARDENING_GAP | Deferred | H3 |
| 4 | Authorization Administration mutations lack the shared trusted-mutation gate | Low | HARDENING_GAP | Deferred | H7 |
| 5 | Access-token signing secret has no minimum strength validation | Low | HARDENING_GAP | Deferred | H7 |
| 6 | Some security-sensitive request bodies are parsed before application-level size checks | Low | HARDENING_GAP | Deferred | H7/ops |
| 7 | No liveness/readiness endpoint contract | Low | HARDENING_GAP | Deferred | H4 |
| 8 | No true browser E2E regression layer | Low | HARDENING_GAP | Deferred | H5 |
| 9 | Public-entry cycles and incomplete generic persistence guards reduce regression detection | Low | HARDENING_GAP | Deferred | H7 or focused maintenance |
| 10 | Unused Stock presentation isAdmin field can invite future role-based UI logic | Low | OBSOLETE_CANDIDATE | Deferred cleanup | Focused maintenance |
| 11 | Production acceptance, backup/restore, and external-worker evidence is unverified | Informational | OPERATIONAL_ACCEPTANCE | Deferred | H6 |
| 12 | Routine recipient enum remains in expand-only compatibility state | Informational | TRANSITIONAL_DEBT | Intentionally retained | H2 |
| 13 | Stock explicit default remains dual-read with legacy fallback | Informational | TRANSITIONAL_DEBT | Intentionally retained | H2 |
| 14 | Process-local rate limits rely on single-process topology | Informational | INTENTIONAL_TRADEOFF | Accepted with deployment invariant | H6/H7 |
| 15 | Local persistent upload storage relies on backup and topology invariants | Informational | INTENTIONAL_TRADEOFF | Accepted with operational controls | H6 |
| 16 | Outbox/provider delivery is at-least-once | Informational | INTENTIONAL_TRADEOFF | Accepted and documented | H3/H6 |
| 17 | Best-effort Audit persistence remains on non-transactional paths | Informational | INTENTIONAL_TRADEOFF | Accepted and documented | H3/H6 |
| 18 | Retained LINE compatibility surface has no repository-local consumer proof | Informational | INTENTIONAL_TRADEOFF | Retained; do not remove | H7/ops confirmation |
| 19 | Email Request remains outside modules/ by design | Informational | INTENTIONAL_TRADEOFF | No action in H0 | Future IT decision |

Rows 12 and 13 record H0 dispositions. Their current dispositions are:

- H0-TRANS-01 — Historical H0 finding; CLOSED by H2B, including the
  operator-confirmed production transition.
- H0-TRANS-02 — Historical H0 finding; CLOSED by H2C.4 after the production
  strict audit exited 0 on deployed revision
  `9437999609e23a96c36ab6f88d3cebf94784e18f`; all strict integrity counts were
  zero. H2 Stock is CLOSED.

### Finding H0-DOC-01 — stale L7 and missing Section 24

Invariant: a hardening PASS statement and its evidence pointer must describe
the repository revision being evaluated; a missing source section must not be
presented as authoritative evidence.

Evidence: runtime-hardening.md claimed L7 and Section 24 at its top and
multiple historical references. Its actual final heading was Section 23.
final-repository-audit.md linked the purported L7 result to
6032381072cf589578f46188a4af2dbe50287fec, which is an L6 cleanup commit.
The audited source baseline is 112 commits beyond that SHA.

Affected paths: docs/architecture/runtime-hardening.md and
docs/architecture/final-repository-audit.md.

Failure scenario: a reviewer or release operator could treat the audited
source baseline as L7-passed and skip rechecking authorization, recipient
policy, migration, and route changes made after the old record.

Current mitigation: H0 created this audited-source baseline, changed the old
documents' current-status wording, and linked all current-state references to
this document while preserving historical L0-L6/L7 wording as superseded
history.

Residual risk: historical documents remain long and contain old phase claims;
readers must follow the current-state links.

Recommended phase: no further phase; this is fixed in H0.
Production behavior must change: no.
Schema or migration required: no.

### Finding H0-AUTH-01 — transaction-time administration revalidation

Invariant: a control-plane mutation that changes Team, TeamRole, membership,
or direct grant state should verify the acting ADMIN and current workforce
lifecycle inside the same transaction that writes the authorization state.

Evidence: app/api/authorization/administration/_lib/route-auth.ts checks the
current authenticated account and builds a principal snapshot. Then
modules/authorization/application/administration-mutations.ts passes that
snapshot into runSerializableTransaction without re-reading or locking the
acting User inside the transaction. The limitation is also recorded in
docs/architecture/authorization-phase-12f-security-regression-matrix.md.

Affected paths: Authorization Administration API routes and
modules/authorization/application/administration-mutations.ts.

Failure scenario: an ADMIN request passes the boundary check, another
request demotes or offboards that actor, and the first request then commits a
grant/membership mutation using its earlier snapshot.

Current mitigation: request-boundary session/workforce revalidation,
serializable transaction execution, target-state validation, uniqueness and
foreign-key constraints, and transactional Audit.

Residual risk: one control-plane write may complete after the acting ADMIN
authority has been revoked in the race window.

Recommended phase: H7 security/dependency hygiene, with a focused
transaction-time actor re-read/lock and regression test. Do not introduce a
policy DSL or architecture migration.
Production behavior must change: yes, when H7 is implemented.
Schema or migration required: no.

### Finding H0-SEC-01 — Authorization Administration trusted-mutation coverage

Invariant: state-changing browser requests must have a server-side trusted
mutation/CSRF decision in addition to authentication and authorization.

Evidence: lib/auth/csrf.ts provides the shared Origin and
X-Requested-With check, but the current Authorization Administration mutation
routes use the admin/session boundary without wrapping the mutation in
withTrustedMutation. Examples include
app/api/authorization/administration/route.ts,
app/api/authorization/administration/users/[id]/system-role/route.ts,
app/api/authorization/administration/users/[id]/grants/route.ts, and
app/api/authorization/administration/teams/[id]/route.ts.

Affected paths: Authorization Administration browser mutation routes.

Failure scenario: if deployment cookie/site assumptions are weaker than
expected, a cross-site browser request could attempt an administrative
mutation with ambient cookies. Source review does not prove an exploitable
current CSRF path because SameSite and deployment topology are also involved.

Current mitigation: HttpOnly/SameSite=Lax cookies, JSON request bodies,
server-derived ADMIN identity, and server-side authorization.

Residual risk: trusted-mutation control coverage is inconsistent and relies
partly on deployment/browser assumptions.

Recommended phase: H7; apply the shared mutation gate and add negative API
tests. Do not treat client-added headers as the security boundary.
Production behavior must change: yes, requests without the required trusted
signal would be rejected.
Schema or migration required: no.

### Finding H0-SEC-02 — access-token secret strength validation

Invariant: a production HMAC signing secret must meet a minimum strength
policy, not merely be non-empty.

Evidence: lib/auth/hybrid/constants.ts validates the access-token secret for
presence, while lib/line/config.ts has an explicit stronger production
minimum for the LIFF secret. H0 found no equivalent minimum-length/entropy
validation for AUTH_ACCESS_TOKEN_SECRET.

Affected paths: access-token signing and verification configuration.

Failure scenario: an operator supplies a weak secret and an attacker can
make token guessing or offline brute force materially easier.

Current mitigation: secret is environment-provided and access tokens expire;
no evidence proves that the production secret is weak.

Residual risk: configuration can be accepted without a repository-enforced
minimum strength.

Recommended phase: H7 configuration/security hygiene with a documented
rotation and deployment failure policy.
Production behavior must change: potentially; invalid configuration should
fail closed at startup or deployment validation.
Schema or migration required: no.

### Finding H0-SEC-03 — request-body limits after parsing

Invariant: untrusted request size should be bounded before expensive body
parsing wherever the application owns the boundary.

Evidence: the image upload route calls request.formData() before the local
file-size validation; Authorization Administration mutation routes call
request.json() without a local body bound; the LINE webhook reads
request.text() before signature validation. Global Cloudflare/Nginx/Next
limits may mitigate this, but their deployed values are not verifiable here.

Affected paths: app/api/uploads/image/route.ts,
app/api/authorization/administration/_lib/mutation-route.ts, and
app/api/line/webhook/route.ts.

Failure scenario: an oversized request consumes memory/CPU before application
validation and can reduce availability.

Current mitigation: downstream file/type limits, signature verification,
trusted proxy controls, and documented deployment infrastructure.

Residual risk: no uniform application-owned pre-parse limit is demonstrated
for these paths.

Recommended phase: H7 or a focused deployment-security slice after measuring
the existing proxy/runtime limits. Do not add speculative middleware in H0.
Production behavior must change: only if a tighter limit is adopted.
Schema or migration required: no.

### Finding H0-RUNTIME-01 — distributed runtime observability

Invariant: operators need consistent, actionable evidence for failed
requests, scheduler runs, outbox transitions, provider attempts, and
correlation across a request and its background work.

Evidence: 166 production console.error/console.warn occurrences across 103
files; Outbox events are structured-shaped but emitted through console.warn;
there is no centralized logger, APM, instrumentation.ts, or global
correlation-ID system. Some Stock/Routine command metadata has local request
IDs.

Affected paths: app routes, modules, lib/services/outbox, scheduler, and
Audit compatibility paths.

Failure scenario: a provider or scheduler incident is recoverable in code but
cannot be correlated or alerted consistently, delaying diagnosis and leaving
operator ownership ambiguous.

Current mitigation: Outbox state counters/events, Audit metadata, error
boundaries, external cron response counters, and deployment runbooks.

Residual risk: incomplete visibility and inconsistent retention/alerting.

Recommended phase: H3 structured operational logging and correlation
contract.
Production behavior must change: yes, when H3 is implemented.
Schema or migration required: not inherently; decide only if durable event
storage is required.

### Finding H0-OPS-01 — missing liveness/readiness contract

Invariant: deployment and proxy operators need a documented endpoint that
distinguishes process liveness from required dependency readiness.

Evidence: no health/readiness route or instrumentation contract was found in
app/; current runbooks refer to origin/process checks without a repository
owned health/readiness implementation.

Affected paths: deployment/Nginx/runbook integration.

Failure scenario: a supervisor or load-balancing check can report an
ambiguous process state, or route traffic to a process that cannot satisfy
its required database/config contract.

Current mitigation: process supervisor and origin curl procedures are
documented as deployment checks.

Residual risk: no stable machine-readable contract and no separation of
liveness from readiness.

Recommended phase: H4, after H3 event/ownership decisions.
Production behavior must change: yes, when H4 is implemented.
Schema or migration required: no.

### Finding H0-TEST-01 — browser E2E gap

Invariant: the most important cross-layer user journeys need at least one
real browser regression path in addition to unit/API/component tests.

Evidence: no Playwright/Cypress/browser E2E configuration or specs were
found. Existing browser transport tests do not run a real browser.

Affected paths: authentication/refresh, LIFF, Stock, Leave attachments and
approval, and Routine UI flows.

Failure scenario: route, cookie, browser refresh, mobile/LIFF, or
client/server integration regressions pass lower-level tests unnoticed.

Current mitigation: broad API/component/MySQL/concurrency coverage and
manual production acceptance rows.

Residual risk: browser contract and operator-facing journey regressions are
not automatically detected.

Recommended phase: H5 minimal browser smoke coverage only; do not add the
tooling in H0.
Production behavior must change: no in H0; test infrastructure changes in H5.
Schema or migration required: no.

### Finding H0-TRANS-01 — Routine recipient enum

Historical H0 finding. Current status: CLOSED by H2B, including the
operator-confirmed production transition recorded below.

Invariant: old deployed processes must continue reading persisted values
during rollout, while new application writes use canonical capability-based
values.

Evidence at the H0 audited baseline: the expand migration retained ADMINS and
ASSIGNEES_AND_ADMINS; application normalization mapped them to
ASSIGNEES/ALL_READERS/ASSIGNEES_AND_ALL_READERS; mutation writes were
canonical. Phase 13A.2 was pending at that baseline.

H2B repository closure update (2026-09-23): Phase 13A.2 implementation is
COMPLETE. Migration `20260923120000_contract_routine_reminder_recipient_scope`
guards canonical collisions before backfill, asserts zero legacy rows, and
contracts the MySQL enum. Prisma/application compatibility normalization has
been removed. At this repository-only closure point, production cutover was
still outstanding.

H2B production closure update (operator-confirmed): production collision
preflight PASSED; production migration deployment PASSED. H2B / Phase 13A.2
production transition and the Routine recipient persistence transition are
CLOSED.

Affected paths: prisma/schema.prisma, the expand migration, Routine
recipient normalization, queries, scheduler, reminders, and notification
recipient lookup.

Failure scenario: contracting the enum while an old process or legacy row
remains would cause write/read failure or notification-policy drift.

Mitigation at the H0 audited baseline: expand-only schema, normalization at
persistence boundaries, canonical writes, and tests covering both vocabularies.

At the H0 audited baseline, legacy values and old-process compatibility
remained in the schema and runtime. H2B removed that repository transition
compatibility. The preflight/deployment gate that remained at repository-only
closure was subsequently passed, as recorded in the operator-confirmed update
above.

Recommended phase at the H0 baseline: H2 / Phase 13A.2 was to prove old-process
retirement, backfill, zero legacy values, deploy contraction, and run
post-cutover verification. Production behavior and a contraction migration were
required for that follow-up.

### Finding H0-TRANS-02 — Stock explicit default

Historical H0 finding.

Current status: H2C.1–H2C.4 CLOSED; H2 Stock and the Stock explicit-default
rollout are CLOSED. The production strict audit exited 0 on deployed revision
`9437999609e23a96c36ab6f88d3cebf94784e18f` and reported zero strict integrity
violations. The H0 baseline details below describe historical runtime and
tooling only.

Invariant: an explicit default variant may be introduced without changing
selection behavior until data is backfilled, shadow comparison is clean, and
the controlled read cutover is approved.

Evidence: STOCK_EXPLICIT_DEFAULT_READ_ENABLED=false in .env.example;
defaultVariantId is nullable; the resolver uses explicit default only when
enabled and usable, otherwise lowest-active fallback; shadow mismatch
warnings and guarded backfill tooling remain.

Affected paths: prisma/schema.prisma, modules/stock/domain/default-variant-
shadow.ts, Stock queries/persistence, and
scripts/stock-default-variant-backfill.ts.

Failure scenario: enabling explicit reads before data is complete can select
the wrong variant or unexpectedly fall back, while leaving the flag false
means production still has dual behavior.

Current mitigation: safe legacy fallback, shadow comparison, explicit writes
for new items, dry-run/apply backfill guardrails, and production opt-in
acknowledgement.

Residual risk: repository evidence does not prove production flag state,
backfill completion, or shadow equality.

Recommended phase: H2 controlled backfill/evidence/cutover; do not change
production behavior or delete fallback in H0.
Production behavior must change: yes, in H2 cutover.
Schema or migration required: not necessarily for cutover; only after an
evidence-backed later cleanup.

### Finding H0-OPS-02 — production acceptance evidence

Invariant: source-backed readiness and operator-confirmed production
behavior must remain separate.

Evidence: docs/liff-production-acceptance.md keeps production, device,
backup, origin, LINE, SMTP, cron, and restore rows at NOT RUN until evidence
is attached. README.md and docs/line-routine.md document external cron,
single-process, Cloudflare/Nginx, backup, and restore assumptions.

Affected paths: production deployment, cron ownership, SMTP/LINE, database,
and .uploads storage.

Failure scenario: a documented deployment assumption is false in the actual
environment, causing missed jobs, inaccessible attachments, or an unsafe
rollback/restore.

Current mitigation: runbooks, secret-protected cron endpoints, counters,
migration backup instructions, and explicit NOT RUN status.

Residual risk: no operator evidence is available in this repository audit.

Recommended phase: H6 production acceptance and a database/file restore drill.
Production behavior must change: operationally yes; no source change required
for the H0 finding.
Schema or migration required: no.

### Finding H0-COMPAT-01 — retained LINE compatibility

Invariant: externally consumed compatibility surfaces must not be removed
solely because no in-repository caller is found.

Evidence: the historical L6 record and current source retain
lib/line/index.ts sendLineWebhook/LineWebhookData/LINE_WEBHOOK_URL; external
LINE Console or operator consumers cannot be proven absent from the
repository.

Affected paths: shared LINE transport and Stock/Email Request compatibility
surfaces.

Failure scenario: deleting a formally retained external contract could break
an operator integration outside the repository.

Current mitigation: explicit retained disposition and documented retirement
criteria.

Residual risk: external consumer inventory is unavailable.

Recommended phase: H7 or a separately authorized compatibility-retirement
review after production evidence. Do not remove it in H0.
Production behavior must change: no.
Schema or migration required: no.

### Finding H0-TOPOLOGY-01 — process-local rate limit

Invariant: the configured deployment topology must match the scope of the
abuse-control state.

Evidence: lib/auth/rate-limit.ts and
lib/security/mutation-rate-limit.ts store fixed-window entries in process
memory. The process-isolation test proves independent module/process budgets.
README.md documents a single-process deployment expectation.

Affected paths: authentication and mutation rate-limit controls, supervisor/
PM2 topology, and trusted client-IP handling.

Failure scenario: multiple processes, hosts, or a restart can provide
independent budgets and reduce the intended abuse-control strength.

Current mitigation: bounded maps, trusted proxy IP contract, and a supported
single-process deployment invariant.

Residual risk: no distributed limiter or cross-process budget.

Recommended phase: H6 operator topology confirmation; H7 security review if
scale-out becomes an approved requirement. Do not add Redis in H0.
Production behavior must change: only if topology changes.
Schema or migration required: no.

### Finding H0-STORAGE-01 — local persistent upload storage

Invariant: private attachment files must remain outside public static access
and the storage snapshot must remain recoverable with its database metadata.

Evidence: lib/uploads/local.ts uses .uploads under the process working
directory; the public upload route rejects private/traversal paths, and the
Leave attachment route authorizes access before reading private storage.
README.md and docs/leave-attachments-deployment.md require persistent disk
and coordinated database/file backup.

Affected paths: public stock image storage, private Leave attachments,
deployment storage, backup, and restore.

Failure scenario: a host replacement or multi-instance deployment loses or
diverges files from leave_attachments metadata, or an incorrect public path
exposes a private object.

Current mitigation: path-resolution guards, separate private retrieval
route, authorization before read, no-store private responses, and explicit
backup/restore runbooks.

Residual risk: persistent storage, snapshot pairing, and multi-instance
topology are operator assumptions not verified in H0.

Recommended phase: H6 backup/restore drill and deployment acceptance.
Production behavior must change: no source change is required in H0.
Schema or migration required: no.

### Finding H0-OUTBOX-01 — at-least-once provider delivery

Invariant: committed notification work must be claimable, retryable, stale
work must recover, and duplicate provider delivery must remain an explicit
possibility.

Evidence: lib/services/outbox/processor.ts uses conditional claim,
PROCESSING recovery, bounded retry/backoff, DEAD handling, and provider
retry markers. The processor documentation explicitly describes
at-least-once behavior; SMTP Message-ID is a correlation/idempotency hint,
not a provider guarantee.

Affected paths: NotificationOutbox, Routine/Leave/Stock notification
dispatch, SMTP, and LINE provider calls.

Failure scenario: the provider accepts a message and the process crashes
before the SENT state is recorded, causing a later retry and possible
duplicate delivery.

Current mitigation: conditional state transitions, stale recovery, maximum
attempts, DEAD state, event keys, LINE retry keys, and current-state
validation before relevant sends.

Residual risk: exactly-once external delivery is not established.

Recommended phase: H3 event/alert visibility and H6 production provider
acceptance. Do not redesign Outbox in H0.
Production behavior must change: no H0 change.
Schema or migration required: no.

### Finding H0-AUDIT-01 — best-effort Audit persistence

Invariant: an Audit outage must not silently bypass authorization or token
containment, while mutations that require atomic evidence must append Audit
inside their transaction.

Evidence: modules/audit/application/commands.ts has both
appendAuditBestEffort and appendAuditInTransaction. Auth lifecycle and
authorization administration paths use transaction-bound audit where their
contract requires it; compatibility/non-transactional paths may log and
continue.

Affected paths: Auth security events, Authorization Administration, shared
Audit compatibility calls, and operational incident evidence.

Failure scenario: a non-transactional security event is lost during a
database outage, reducing forensic visibility even though the main security
decision remains fail-closed or contained.

Current mitigation: transactional audit on critical mutation paths, sanitized
operational logging, and documented best-effort policy.

Residual risk: there is no durable retry queue for every best-effort audit
event.

Recommended phase: H3 structured event ownership and H6 operational
acceptance. Do not make Audit a new cross-module dependency in H0.
Production behavior must change: only if the accepted policy changes later.
Schema or migration required: not for the current accepted policy.

### Finding H0-ARCH-01 — cycle and persistence-guard coverage

Invariant: module dependency and persistence ownership regressions should be
detected before they reach the runtime.

Evidence: current public-entry cycles include Authorization/Audit and
LINE/Routine or LINE/Stock. The checker has explicit persistence guards for
selected models such as AuditLog, LineAccountLink, Auth refresh state,
Department, and Notification, but no generic guard for every
Stock/Leave/Routine/Employee delegate. Manual review found no current bypass.

Affected paths: scripts/check-architecture.mjs, module public entries, and
future persistence imports.

Failure scenario: a future change introduces a new cycle or route-level
delegate bypass that the checker does not detect, increasing initialization
coupling or weakening ownership.

Current mitigation: approved public-entry conventions, current architecture
tests, the passing architecture checker, and manual review.

Residual risk: regression detection is incomplete even though current
ownership is coherent.

Recommended phase: H7 or a separately scoped architecture-test maintenance
slice. Do not reopen the modular-monolith migration in H0.
Production behavior must change: no current behavior change is required.
Schema or migration required: no.

### Finding H0-UI-01 — unused Stock presentation isAdmin field

Invariant: presentation state must not become a business authorization source
or invite new code to infer capability from system role.

Evidence: StockProvider exposes a role-derived isAdmin field, but the current
modules/stock search found no consumer; active server and UI capability
contracts use stockCapabilities instead.

Affected paths: Stock dashboard presentation context and future UI consumers.

Failure scenario: later UI code consumes the unused field and displays or
enables a role-based business operation that the server correctly denies.

Current mitigation: server-side capability enforcement and the current
capability-based presentation contract.

Residual risk: the obsolete field remains available to future code.

Recommended phase: focused cleanup after confirming no external consumer.
Do not remove it solely on repository-local unused status in H0.
Production behavior must change: no.
Schema or migration required: no.

### Finding H0-IT-01 — Email Request future IT boundary

Invariant: deferred future IT work must not be started implicitly as part of
the H0 baseline.

Evidence: app/api/email-request/ remains backed by
lib/services/email-request, shared Audit/Outbox seams, and capability-based
recipient selection. The current architecture documents explicitly defer
this boundary.

Affected paths: Email Request route/service/persistence and shared Outbox
integration.

Failure scenario: an unplanned migration changes external behavior or shared
transport ownership while the repository has not established the IT module
contract or production acceptance.

Current mitigation: explicit deferment, preserved compatibility seams, and
the architecture rule not to create modules/it in H0.

Residual risk: the legacy boundary remains transitional and should be
reassessed before future IT expansion.

Recommended phase: a separately authorized future IT design/implementation
phase after H-series prerequisites. Do not start it in H0 or H2 planning.
Production behavior must change: only under that future approved phase.
Schema or migration required: to be determined by that future design; none
is authorized by H0.

### Accepted tradeoffs summary

The following are still true on the audited source baseline and H0 closure;
the closure commit changed documentation only:

- Notification/provider delivery is at-least-once. Outbox claim/retry/stale
  recovery and LINE retry keys reduce duplicates, but SMTP Message-ID is not
  provider-level exactly-once deduplication.
- Audit append is best effort on non-transactional compatibility paths;
  mutation paths requiring atomic audit use transaction-bound append.
- Local .uploads storage is persistent only if the deployment supplies the
  documented writable disk and backs it up with matching database metadata.
- after() can opportunistically wake dispatch or write audit after a response;
  external cron remains the correctness owner for recurring work.
- Process-local rate limits are acceptable only under the documented
  single-process topology.
- The LINE compatibility surface is retained until external consumers and
  rollback/retirement evidence are available.

These are not claims of exactly-once delivery, distributed rate limiting,
object-storage durability, or production acceptance.

## 5. Architecture decision

Architecture refactoring remains closed.

The current source supports the existing modular-monolith boundaries, and
the residual cycle/guard observations are regression-protection opportunities,
not evidence of a boundary migration failure. H0 therefore makes no module
creation, public-entry redesign, provider ownership redesign, or Email
Request migration.

## 6. H-series roadmap handoff

| Phase | Status / recommended scope |
| --- | --- |
| H0 — Fresh Source Baseline & SSOT Repair | Completed by this record and the linked documentation repair |
| H1 — CI / Merge Quality Gate | DEFERRED — owner decision |
| H2 — Transitional Persistence Closure | CLOSED — Routine persistence closed by H2B; Stock explicit-default persistence closed by H2C.1–H2C.4 with repository verification and post-H2C.3 production strict audit PASS |
| H3 — Runtime Observability / Structured Logging | Central event schema, logger ownership, counters, alerts, and correlation propagation |
| H4 — Liveness / Readiness | Minimal repository-owned liveness/readiness contract tied to deployment checks |
| H5 — Critical E2E Smoke Coverage | Minimal real-browser coverage for auth/LIFF, one Stock mutation, private Leave attachment/authorization, and one Routine journey |
| H6 — Production Operational Acceptance / Restore Drill | Operator-confirmed topology, cron, proxy, SMTP/LINE, backups, uploads, rollback, and database/file restore |
| H7 — Security & Dependency Hygiene | Authorization Administration transaction-time revalidation, dependency/security review, and approved compatibility cleanup |

At the H0 handoff, H2 planning was the next recommended activity. H2A and H2B
closed the Routine Import and Routine recipient persistence work. H2C.1–H2C.4
closed the Stock explicit-default runtime and tooling transition, with
repository verification passed and the post-H2C.3 production strict audit
exiting 0 with zero strict integrity violations. H2 is CLOSED. H1 remains
deferred by owner decision, and future IT remains deferred.

## 7. H0 changes

H0 made documentation-only corrections:

- added this audited-source baseline;
- changed runtime-hardening.md from a current L7 authority claim to a
  historical L1-L6 record linked to H0;
- repaired final-repository-audit.md so the old purported L7 SHA and missing
  Section 24 are clearly historical/superseded;
- linked the current authorization state document to this baseline.

No application runtime, schema, migration, dependency, CI workflow, E2E
tooling, Routine enum, Stock flag, Outbox design, upload backend, or future IT
module was changed.

## 8. Verification limitations

These limitations describe the H0 audited-source verification on 2026-09-21.
The current H2C.4 production evidence status is recorded in Section 2.

- No production database, supervisor/PM2 instance, Cloudflare/Tunnel,
  Nginx host, SMTP provider, LINE Console, monitoring system, or backup
  repository was accessible.
- Production acceptance rows remain NOT RUN and were not converted to PASS.
- No browser automation was introduced or executed.
- A Codex Security standard scan was started against the audited source
  baseline, but the
  advisory Daybreak program was not granted and the scan remained in its
  running threat-model phase during this audit. Its incomplete state is not
  treated as a no-findings result; the source-backed audit and repository
  gates below are the authoritative H0 evidence.

## 9. Files changed by H0

- docs/architecture/pre-it-hardening-h0-baseline.md
- docs/architecture/runtime-hardening.md
- docs/architecture/final-repository-audit.md
- docs/architecture/authorization-current-state.md

## 10. Final repository verification record

The final gate was executed for the audited source baseline and the initial
H0 baseline documentation commit. Subsequent H0 metadata and ledger
corrections were documentation-only and do not invalidate the recorded
verification. On Windows, PowerShell blocked the npm.ps1 shim because of the
local execution policy, so the equivalent npm.cmd/npx.cmd entry points were
used. The scripts and results were:

| Command | Result |
| --- | --- |
| npm run architecture:check | Initial PowerShell shim invocation was blocked by execution policy; npm.cmd run architecture:check passed and checked 1,168 source files |
| npm run lint:strict | npm.cmd run lint:strict passed with zero warnings |
| npm run typecheck | npm.cmd run typecheck passed |
| npx prisma validate | npx.cmd prisma validate passed; Prisma emitted only the existing package.json#prisma deprecation warning |
| npx prisma generate | npx.cmd prisma generate passed; Prisma Client v6.19.3 generated |
| npm run test:run | Initial parallel run had 337 files and 3,166 tests pass with one 30-second timeout in the architecture test; focused architecture rerun passed 251/251, then the final serialized confirmation passed 338 files and 3,167 tests |
| npm run test:integration:mysql | Passed; all 68 migrations applied, 18 files and 113 tests passed |
| npm run build | Passed; Next.js 15.5.24 compiled, type/lint checks passed, and 92/92 static pages generated |
| git diff --check | Passed after this final documentation update |

The initial parallel test timeout was not an assertion failure and was
resolved by the final serialized confirmation without changing test/source
behavior. The Prisma configuration deprecation warning is pre-existing and
does not fail the gate.
