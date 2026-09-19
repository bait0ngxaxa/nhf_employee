# Phase 12H-G — Role-Neutral Production Business Enforcement Cutover and Full Security Regression

Status: **CLOSED**

Reviewed baseline: `02c987ffd3a64bf74fcd1a8ef49414226796dec4`

Phase 12H-F was accepted and closed before this cutover. Phase 12H-G changes
repository enforcement only. No production authorization data was mutated, no
production deployment was performed, and no live rollout or canary was run.

## Production resolver and composition

Before this phase, `createAuthorizationResolver()` and the exported
`authorization` singleton used `LEGACY_ADMIN_BUSINESS_AUTHORITY_COMPATIBILITY`.
An ADMIN could therefore receive a synthetic `SYSTEM_ROLE / ADMIN` business
grant and could skip configured persistence reads.

After this phase, both the normal factory and singleton use the role-neutral
configured strategy. USER and ADMIN now both load and evaluate direct User,
Team, and TeamRole persistence. `systemRole` remains trusted identity
metadata, but it does not create a business grant. Unknown capabilities,
unsupported channels, invalid persisted capabilities/scopes, inactive sources,
and origin mismatches remain typed fail-closed errors or denials.

The explicit `createLegacyAdminCompatibleAuthorizationResolver()` factory and
`evaluateLegacyAuthorization()` remain available only for Phase 12H-H snapshot
comparison. The legacy composition wrapper also remains comparison-only. No
normal route, domain adapter, presentation projection, or transaction
authorization path calls either seam. Phase 12H-I owns their deletion.

All normal Employee, Department, Routine, Stock, Leave, Notification, Audit,
and Email Request composition now uses `composeAuthorizationAuthority()`.

## Policy parity and configured authority

The production resolver regression matrix proves that equivalent USER and
ADMIN actors receive identical Default Domain Policy for the same trusted
employee, channel, and resource context. This includes Employee reads/stats/
export, Department read, Routine self/created/assigned defaults and LIFF
clamps, Stock catalog/request defaults, Leave requester/approver defaults,
and Notification inbox defaults.

Central-only capabilities are denied for both roles without a configured grant.
The test derives this set from the administration catalog rather than a
hand-maintained list. In particular, Employee mutation/import, Routine
occurrence administration/import/export, Stock inventory/process/report
operations, Leave approver/recovery operations, Audit read, and Email Request
operations do not become available merely because the identity role is ADMIN.

Direct User, Team, and TeamRole grants are evaluated identically for USER and
ADMIN. A configured `stock.inventory.manage / ALL` Team grant, for example,
produces the same authority for both roles. No Department-to-Team inference,
Team-name magic, role-name magic, or implicit configured-admin bundle exists.

## Workforce and transaction lifecycle cutover

The 28 business route callers identified at the Phase 12H-A boundary were
migrated from `requireActiveWorkforceOrAdminSession()` to
`requireActiveWorkforceSession()`. The helper was retired after the migration;
`requireApiSession()` remains unchanged for routes that only require
authentication. Existing feature, request-size, rate-limit, response, and
error ordering was preserved.

Routine transaction mutations now require an active, non-deleted User with a
linked active, non-deleted Employee for both USER and ADMIN. The account-only
Dashboard ADMIN exception was removed while row locks and transaction-time
revalidation remain.

Stock transaction authorization removed
`DASHBOARD_ADMIN_EMPLOYEE_OPTIONAL_CAPABILITIES`. Configured inventory,
processing, and cancellation authority cannot bypass the active-workforce
lifecycle, request ownership/state rules, quantity and variant invariants,
serializable transaction behavior, concurrency protection, or audit/outbox
semantics.

Leave approver management removed `allowAccountOnlyAdminApproverManagement`
and `isAccountOnlyAdminApproverManagement`. `leave.approver.manage / ALL`
requires the same active User/Employee lifecycle, locks, manager/approver
validation, pending-request constraints, self-assignment rejection,
offboarding rules, audit, and serializable transaction behavior for both roles.

## Leave attachments and Stock cancellation notifications

Private Leave attachment reads now accept only an active-workforce
`employeeId`. The database predicate is participant-only: requester, current
assigned approver, or effective exception approver. The generic ADMIN bypass
and the viewer `isAdmin` switch were removed. Non-participants receive the
existing non-disclosing not-found result, regardless of system role.

Stock cancellation notification mode is now derived from the operation:
canceling the actor's own request uses the REQUESTER path; canceling another
user's request requires valid `ALL` authority and uses the PROCESSOR path. It
does not inspect `systemRole`. The separate active-ADMIN recipient audience
policy remains unchanged, as do Routine ADMIN reminder recipients.

Leave recovery remains a dedicated `leave.recovery.manage / ALL` capability
with Dashboard channel, active-workforce, unavailable-approver, owner,
reason, quota/state/workflow, generation/version, audit, and outbox checks.
Historical role fields remain only as provenance data.

## Presentation and control-plane boundaries

Normal effective-access and presentation projections use the same role-neutral
resolver/composition semantics as enforcement. An ADMIN without grants no
longer receives inventory, processing, recovery, approver-management, audit,
Email Request, Routine import/export, or Employee mutation/import surfaces
unless an approved Default Domain Policy independently supplies them. An
equivalently configured USER and ADMIN project equivalent business access.
Routine LIFF clamps and resource relationships remain intact.

Authorization Administration remains a separate ADMIN-only control plane,
including its APIs, application service, Dashboard entry, route guard,
bootstrap assignment, and last-active-ADMIN safeguard. ADMIN recipient
policies for Routine reminders and Stock notifications remain domain policies,
not current-actor authorization.

## Remaining role-vocabulary matches

The post-cutover semantic search was classified as follows:

- `CONTROL_PLANE_KEEP`: Authorization Administration API/service/dashboard,
  bootstrap assignment, and last-active-ADMIN protection;
- `AUTHENTICATION_LIFECYCLE_KEEP`: trusted role parsing and account lifecycle;
- `PRESENTATION_IDENTITY_ONLY`: identity labels/badges and raw source display;
- `DOMAIN_RECIPIENT_POLICY`: Routine reminder and Stock active-ADMIN
  recipient selection;
- `HISTORICAL_AUDIT_PROVENANCE`: immutable audit/notification actor-role
  fields and the Routine historical provenance label;
- `PHASE_12H_H_COMPARISON_ONLY`: legacy evaluator, resolver factory, and
  composition wrapper; and
- `PHASE_12H_I_DELETION_DEBT`: the compatibility-named exports and legacy
  `SYSTEM_ROLE` representation that no longer reaches production business
  ALLOW/DENY decisions.

No remaining ordinary business ALLOW/DENY path uses `SYSTEM_ROLE`,
`systemRole === "ADMIN"`, `role === "ADMIN"`, `isAdministrative`, or an
ADMIN-only lifecycle branch.

## Verification and rollout boundary

The regression coverage includes resolver/evaluator/composition, paired
USER/ADMIN defaults and central-only denial, direct/Team/TeamRole grants,
inactive/deleted lifecycle, channel and LIFF behavior, resource relationships,
Routine/Stock/Leave transactions, private Leave attachments, Stock
cancellation notification mode, Employee/Department/Audit/Notification/Email
Request adapters, business routes, uploads, and Authorization Administration.

Verification evidence is recorded here after the final repository checks:

- focused resolver/evaluator/composition and domain authorization suites:
  **7 files / 256 tests passed**;
- focused Routine, Stock, and Leave mutation/lifecycle suites:
  **3 files / 111 tests passed**;
- architecture fixture suite: **1 file / 251 tests passed**;
- route/security, adapter, transaction, and presentation/effective-access
  regression selection: **58 files / 787 tests passed**;
- `npm.cmd run typecheck`: passed;
- `npm.cmd run lint:strict`: passed;
- `npm.cmd run architecture:check`: passed, **1,149 source files checked**;
- full test suite (`npm.cmd run test:run -- --testTimeout=30000`):
  **328 files / 3,110 tests passed**;
- `git diff --check`: passed.

The first unmodified full-suite invocation reached 3,108 passing tests and
timed out two slow architecture fixtures at Vitest's default five-second
per-test limit under full parallel load. The isolated architecture suite and
the final extended-timeout full run passed all assertions; no architecture
violation was reported.

No development server or production build was run. Production Teams,
TeamRoles, memberships, grants, and authorization data were not changed.
The next phase is **12H-H — Production Snapshot / Live Rollout Validation**.
