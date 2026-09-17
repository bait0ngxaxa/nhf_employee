# Phase 12F — Full Authorization Regression / Security Matrix Closure

สถานะ: **CLOSED**  
Audit baseline: `4646e259bcb2e5900aa1a679ccc78aaae6cbe186`  
Baseline subject: `feat(auth-admin): complete effective-access inspection UX`  
วันที่ปิด audit: `2026-09-17`

เอกสารนี้สรุปผลจาก
[authorization-phase-12f-security-regression-matrix.md](authorization-phase-12f-security-regression-matrix.md)
ซึ่งเป็น current authoritative regression baseline หลัง Phase 12A–12E.
Phase 12F ตรวจ code/runtime authorization safety และ regression evidence เท่านั้น
ไม่ได้ query หรือ mutate production authorization database.

## 1. ผลสรุป

Phase 12F ปิดได้ตาม threshold:

```text
mandatory MISSING authorization/security rows = 0
blocking authorization defects = 0
ทุก protected migrated operation = DIRECT route evidence
```

ผลนี้ยืนยัน current composition chain:

```text
trusted identity
  -> system-role authority
  -> registered capability + supported channel
  -> configured resolver authority
  -> permanent Default Domain Policy + additive authority
  -> domain channel policy
  -> resource / relationship predicate
  -> workflow / lifecycle / transaction invariants
  -> ALLOW / DENY
```

ไม่มี policy redesign, explicit DENY, capability key ใหม่, generic scope ใหม่,
Email migration หรือ production rollout ใน phase นี้.

## 2. Files changed

- `docs/architecture/authorization-phase-12f-security-regression-matrix.md`
  — fresh source-derived matrix, 40-capability inventory, 86-row operation
  ledger, 17-row Administration ledger, security families, reconciliation,
  limitations and verification record.
- `docs/architecture/authorization-phase-12f-closure.md` — this closure.
- `docs/architecture/authorization-current-state.md` — current authoritative
  baseline now points to Phase 12F; exact next phase points to 12G.
- `docs/architecture/authorization-presentation-projection.md` — live phase
  handoff updated from 12F-next to 12F-closed / 12G-next.
- `__tests__/api/authorization-phase-12f-routine-route-seam.test.ts` — 83
  direct current migrated route/capability/channel boundary cases. The working
  filename is retained although the suite covers all migrated domains.
- `__tests__/api/authorization-phase-12f-administration-route-seam.test.ts` —
  direct Administration route boundary coverage for all 17 current routes.
- `app/api/uploads/image/route.ts` — sanitize and fail closed on malformed
  authorization configuration during image-upload authorization.
- `modules/stock/presentation/liff-stock-auth.ts` — sanitize and fail closed on
  malformed authorization configuration during LIFF Stock processor auth.

ไม่มี production database, migration, seed, backfill, grant or Team record ถูก
สร้าง/แก้ไข.

## 3. Capability inventory

Inventory ถูก recompute จาก current registry, administration metadata, domain
constants/adapters และ route callers:

| Measure | Count |
|---|---:|
| Registered capabilities | 40 |
| `DEFAULT_POLICY_AUTHORIZATION` / `CENTRAL_WITH_DEFAULT_POLICY` | 25 |
| `CENTRAL_WITH_COMPATIBILITY` | 0 |
| `CENTRAL_ONLY_AUTHORIZATION` | 13 |
| `DEFERRED_AUTHORIZATION_SURFACE` | 2 |
| Grantable | 38 |
| `POLICY_ACTIVATION_REQUIRED` | 0 |
| Deferred | 2 |

Arithmetic: `40 = 25 + 0 + 13 + 2`; `40 = 38 + 0 + 2`.

The only deferred capabilities are `email.request.read` and
`email.request.create`. All twelve registered Routine capabilities are in the
current migrated inventory; `routine.task.export`, `routine.summary.read` and
`routine.reference.read` are no longer deferred.

## 4. Ledger totals

### 4.1 Current operation ledger

| Family | Rows | Evidence result |
|---|---:|---|
| Employee | 7 | 7 DIRECT |
| Department | 1 | 1 DIRECT |
| Routine | 28 | 28 DIRECT |
| Stock | 28 | 25 protected DIRECT + 3 presentation-only DIRECT |
| Leave | 17 | 17 DIRECT |
| Audit | 1 | 1 DIRECT |
| Notification | 4 | 4 DIRECT |
| **Total** | **86** | **83 protected DIRECT + 3 presentation-only DIRECT** |

Arithmetic: `86 = 7 + 1 + 28 + 28 + 17 + 1 + 4`; `86 = 83 + 3`.

The five Phase 12D Routine entry points are present with their actual current
paths:

```text
GET /api/routines/export
GET /api/routines/summary
GET /api/line/routine/summary
GET /api/routines/reference
GET /api/line/routine/reference
```

### 4.2 Authorization Administration ledger

| Ledger | Total | DIRECT | INDIRECT | MISSING | N/A |
|---|---:|---:|---:|---:|---:|
| Current Administration routes/commands | 17 | 17 | 0 | 0 | 0 |

The 17 rows cover overview, Team reads, User directory/detail, Effective Access
inspection, Team/TeamRole lifecycle, memberships, Team grants, TeamRole grants,
direct User grants and removals. The direct route suite passes through the real
`requireAdminSession` → shared Administration route-auth boundary.

## 5. Matrix totals

| Matrix artifact | Total | DIRECT | INDIRECT | MISSING | N/A |
|---|---:|---:|---:|---:|---:|
| Cross-cutting security matrix | 58 | 53 | 2 | 0 | 3 |
| Current operation ledger | 86 | 86 | 0 | 0 | 0 |
| Authorization Administration ledger | 17 | 17 | 0 | 0 | 0 |

Cross-cutting arithmetic: `58 = 53 + 2 + 0 + 3`. The two INDIRECT rows are
aggregate architecture/exhaustive-stale-interleaving claims with explicit
reasons and optional stronger proof. The three N/A rows explicitly scope out
generic guarantees that current architecture does not claim: generic Leave
capability migration for bespoke surfaces, migrated central authorization for
deferred Email, and blanket transaction-wide revalidation.

There are no silent rows: every protected operation is in the current ledger;
every relevant Phase 11C family/row is reconciled in the matrix.

## 6. Phase 11C reconciliation

The historical Phase 11C documents were not rewritten. Current reconciliation
is recorded in the new matrix:

- Employee, Department, existing Routine, Stock, Leave, Audit and Notification
  ledger rows are `RETAINED` with current Default Policy/Central Only/domain
  classifications.
- New Routine export/summary/reference route boundaries are `SPLIT` into five
  explicit current rows; the old deferred Routine summary/reference/export
  description is not carried forward.
- Old aggregate count row `API-10` is `SUPERSEDED` by the fresh 86-row ledger.
- Old compatibility-policy rows for Employee, Department, Notification,
  Routine and generic Leave are `SUPERSEDED` because their current behavior is
  permanent Default Domain Policy or Central Only.
- Routine deferred row `COMPAT-07` is `SPLIT`; Routine LIFF policy remains
  `RETAINED` as domain/channel policy.
- Stock compatibility-language row is `RETAINED` only as a domain/channel
  reconciliation, not as an active runtime fallback.
- Leave report/export, participant/detail/attachment and recovery rows remain
  `RETAINED` as intentionally domain-owned unregistered boundaries.
- Email deferral, presentation non-authority and Team/Department separation
  are `RETAINED` with current terminology.

Thus Phase 11C's `89`, `80/6/0/3`, `81`, `78`, `17` and `98` figures are not
Phase 12F counts.

## 7. Findings by security family

- Authentication/trusted identity: current Dashboard session, User/Employee
  lifecycle and LIFF signed-link/workforce checks are server-derived. Target
  User IDs in Administration are inspection targets, not actor identity.
- Registry/channel structural safety: unknown capability, mismatch, unsupported
  channel, invalid capability/scope and invalid Team origin remain distinct
  fail-closed errors. They never become `NO_APPLICABLE_GRANT` and never receive
  Default Domain Policy fallback.
- Default Domain Policy: Department read and Employee read/stats/export broad
  defaults are deliberate; Notification is actor-owned `OWN`; Routine,
  Stock, Leave and Audit defaults match current domain adapters and channel
  policy.
- Additive authority: no grant, narrower grant, broader grant, redundant grant,
  multiple Team/TeamRole/User sources, single-source revoke and all-source
  revoke are directly covered. There is no invented explicit DENY behavior.
- Provenance/lifecycle: `SYSTEM_ROLE`, `TEAM`, `TEAM_ROLE` and `USER` sources,
  Team/TeamRole origins and TEAM constraints are preserved. Inactive/revoked
  sources disappear on fresh resolution; Department/manager/position/job title
  do not infer Team membership.
- Scopes/resource policy: OWN/CREATED/ASSIGNED/TEAM/ALL remain inputs to domain
  predicates. ALL does not bypass workflow, lifecycle, validation, channel or
  transaction constraints.
- Routine: Dashboard management/mine/all, summary mine/all, LIFF self-service,
  reference minimization and Dashboard-only export are separately covered.
  LIFF configured ALL/ADMIN is clamped where current Routine policy requires.
- Stock: Dashboard and LIFF are separate; Stock's LIFF processor semantics are
  intentionally not Routine's semantics. Ownership, request state, inventory
  availability, idempotency and concurrency remain separate invariants.
- Leave: owner/approver relationships, exception precedence, owner exclusion,
  state transitions and the intentional LIFF cancellation-decision exception
  remain domain-authoritative.
- ADMIN: ADMIN comes from trusted persisted system role and `SYSTEM_ROLE`; its
  Default Domain Policy is empty. USER with `ALL` is not ADMIN. ADMIN does not
  bypass current lifecycle/workforce, unsupported channels, validation,
  workflow/state, relationship or transaction rules.
- Presentation: Dashboard/LIFF projections and the Administration UI are
  non-authoritative; corresponding server routes/commands independently guard
  the operation.
- Effective Access Inspector: Default, Additional and Effective remain
  separate; contexts/channels are not flattened; unsupported/deferred/invalid
  states are distinct; the inspector does not claim resource/workflow/LIFF
  link/lifecycle/transaction success.

## 8. Security defects and corrective hardening

One fail-closed error-containment defect was found in two Stock authorization
boundaries. A malformed persisted authorization configuration could raise
`AuthorizationConfigurationError` out of:

```text
modules/stock/presentation/liff-stock-auth.ts
app/api/uploads/image/route.ts
```

The defect did not produce a permissive allow, but it escaped the intended
route response boundary rather than returning a sanitized server error. The
smallest corrective change catches that specific structural configuration
error, logs only safe error type/code metadata, and returns `serverError()`.
The direct 83-case route seam includes both paths and the full suite passes.

Result after correction: `blocking authorization defects = 0`. No authorization
policy or domain semantics changed.

## 9. Deferred and accepted domain-owned boundaries

Current deferred boundaries are:

```text
email.request.read
email.request.create
```

They remain `DEFERRED_AUTHORIZATION_SURFACE`; no grants are activated and they
are not counted as migrated central authorization.

`POST /api/email-request` remains protected by current persisted ADMIN session,
validated idempotency/body input, service idempotency/transaction, audit and
outbox behavior. `GET /api/email-request` remains protected by current API
session, validated pagination and service-side requester scoping for non-ADMIN
users (current ADMIN service branch may read the administrative list). These
are deferred boundary tests, not central migrated-capability evidence.

Leave report/export, participant/detail, attachments, recovery and LIFF
cancellation decision remain explicitly domain-owned/unregistered and have
their own current session, relationship, role, workflow or serializer
protection. Phase 12F does not invent capability keys for them.

Accepted limitations:

- No production authorization DB inventory or mutation was performed. Local
  seed state is not evidence about production.
- The audit does not claim blanket transaction isolation, exhaustive
  concurrent interleaving proof, filesystem/DB atomicity for uploads or
  all-rows atomicity for partial-success imports.
- Effective Access is an operator projection, not a resource simulator or
  final workflow decision.
- Codex Security automated scan preflight could not start because the
  environment exposed only the Microsoft Store Python alias and no usable
  Python interpreter for `config_preflight.py`; no green scan result is claimed.

None of these limitations is a mandatory MISSING protected migrated operation
or an unresolved policy decision for the current Phase 12 contract.

## 10. Verification record

All commands below were actually executed after the final source/test changes;
the subsequent documentation-only edits do not alter runtime, type or test
behavior:

| Command | Result |
|---|---|
| `npm.cmd run test:run -- modules/authorization modules/department/application modules/notification/application modules/employee/application modules/routine/application/authorization.test.ts modules/routine/application/queries.test.ts modules/stock/application modules/leave/application/authorization.test.ts __tests__/api/authorization-phase-12f-routine-route-seam.test.ts __tests__/api/authorization-phase-12f-administration-route-seam.test.ts` | **PASS** — 35 files, 543 tests |
| `npm.cmd run test:run -- __tests__/api/authorization-phase-12f-routine-route-seam.test.ts __tests__/api/authorization-phase-12f-administration-route-seam.test.ts` | **PASS** — 2 files, 86 tests |
| `npm.cmd run test:run -- __tests__/api __tests__/auth __tests__/integration/authorization-administration.integration.test.ts __tests__/integration/authorization-persistence.integration.test.ts __tests__/integration/authorization-resolver.integration.test.ts` | **PASS** — 65 files, 655 tests |
| `npm.cmd run test:run` | **PASS** — 320 files, 2,956 tests, 0 failures, 0 skips |
| `npm.cmd run test:integration:mysql` | **PASS** — migrations clean/no pending migrations; 16 files, 104 tests |
| `npm.cmd run architecture:check` | **PASS** — 1,134 repository source files checked |
| `npm.cmd run lint:strict` | **PASS** — exit 0, no warnings |
| `npm.cmd run typecheck` | **PASS** — exit 0 |
| `git diff --check` | **PASS** — exit 0 |

The MySQL runner used only the repository integration database at
`127.0.0.1:3309/employee_nhf_integration`; it did not query or mutate a
production authorization database.

## 11. Final handoff

Phase 12F is closed. Do not begin production rollout as part of this phase.

Exact next phase:

```text
Phase 12G — First Production Capability Deployment Readiness
```

Phase 12G owns production authorization inventory, rollout prerequisites, first
real capability deployment strategy, rollback/observability requirements and
operational readiness.
