# Authorization Phase 10D — Final Administration Security / Behavior Re-audit

สถานะ: **CLOSED**
วันที่: 2026-09-14
Baseline ที่ตรวจ: `e87fee3d038082e474872dcfc0a06ce19e6a099e` (`feat(authorization): add Phase 10C administration operator UI`)

## Scope และ audit method

ตรวจ source, callers, routes, browser graph, Prisma schema/migrations,
production seed, domain authorization adapters, tests และเอกสาร Phase 10A,
10B, 10C, current-state, resolver, persistence, module boundaries และ audit
migration. Locked Authorization Design ที่ใช้อ้างอิงคือ
`docs/architecture/authorization-contract.md`; ไม่พบ `AUTHORIZATION_DESIGN.md`
ที่ root ของ repository

Phase 10D แก้เฉพาะ defect ที่พิสูจน์ได้จาก audit:

1. กำหนด User endpoint เป็น **search-only**: query ที่ว่างหรือมีแต่ whitespace
   ตอบ `INVALID_INPUT` ก่อนถึง persistence จึงไม่กลายเป็น unfiltered browse
2. เพิ่ม Authorization browser-graph architecture guard และ regression tests
   เพื่อกัน Prisma, server auth/persistence/audit runtime และ Authorization
   server entry หลุดเข้า client graph

## End-to-end flow ที่ตรวจยืนยัน

```text
dashboard menu (presentation only)
  -> /dashboard/authorization
  -> requireDashboardAuthorizationAdministration()
  -> trusted authenticated ADMIN account/workforce session
  -> getAuthorizationAdministrationOverview() on the server
  -> client-safe workspace and SWR read adapters
  -> ADMIN-only read/mutation API routes
  -> application read models or administration commands
  -> serializable transaction
  -> configuration write + appendAuditInTransaction() in the same transaction
  -> commit
  -> affected SWR reads revalidated
  -> operator-visible confirmed state
  -> central resolver for inspection/runtime authorization
```

Page guard runs before the initial administration read. API routes share
`app/api/authorization/administration/_lib/route-auth.ts`; commands repeat the
structural ADMIN-principal check. Menu filtering is not treated as a security
boundary.

## Surface inventory and production write ownership

| Surface | Production READ | Production MUTATION | Seed/migration | Result |
|---|---|---|---|---|
| `Team` | `authorization-administration-repository`, overview/detail routes | `administration-mutations` -> `authorization-administration-mutation-repository` | `seed.ts` only; empty approved configuration | owned |
| `TeamRole` | selected Team read model, resolver repository | same administration command/repository boundary | explicit seed boundary only | owned |
| `TeamMembership` | Team/User detail and resolver repository | add/remove/role-change commands only | explicit seed boundary only | owned |
| `TeamCapabilityGrant` | Team detail and resolver repository | exact add/remove commands only | explicit seed boundary only | owned |
| `TeamRoleCapabilityGrant` | Team detail and resolver repository | exact add/remove commands only | explicit seed boundary only | owned |
| `UserCapabilityGrant` | User detail and resolver repository | exact add/remove commands only | explicit seed boundary only | owned |

Repository-wide searches found no unrelated production table write. The only
production writes are the command-specific administration repository and the
explicit seed repository; no route/module bypasses trusted ADMIN, readiness,
impact validation, transaction, or strict audit.

## Authority, direct route, and client/server boundary

- Unauthenticated requests are denied; eligible normal `USER` requests are
  denied; trusted `ADMIN` requests are allowed.
- Role and actor identity come from `resolveAuthenticatedAccount()` and the
  database-backed authenticated session. JSON, query, URL, client state,
  `role`, `systemRole`, `actorUserId`, `actorEmail`, `isAdmin`, and employee
  fields cannot establish administration authority.
- `/dashboard/authorization` performs the server guard before reading the
  administration overview. Direct URL access and query parameters do not
  bypass it.
- `modules/authorization/client.ts` exports only the browser workspace. The
  presentation tree uses client-safe types and HTTP adapters. The new
  architecture guard rejects direct and transitive server runtime imports;
  `npm.cmd run architecture:check` checks 1,118 source files.
- Auth cookies remain `HttpOnly`, `Secure`, `SameSite=Lax`. Authorization
  routes follow the existing trusted same-origin administrative API convention
  and send the shared AJAX/request-ID headers through `apiRequest`; they do not
  claim an additional Origin/CSRF framework that the repository does not
  implement. No weaker cookie or transport posture was introduced.

## Route, HTTP, and UI/API parity

All nested handlers use the filesystem contract (`[id] -> params.id`,
`[roleId] -> params.roleId`, `[userId] -> params.userId`) and Next's awaited
Promise params contract.

| UI action family | Client adapter / API route | Application command / audit | Revalidation |
|---|---|---|---|
| Team create | `createTeam` / `POST /api/authorization/administration` | `createAuthorizationAdministrationTeam` / `TEAM_CREATE` | overview |
| Team update, disable, re-enable | `updateTeam` / `PATCH .../teams/[id]` | `updateAuthorizationAdministrationTeam` / `TEAM_UPDATE` or `TEAM_DISABLE` | overview + selected Team |
| TeamRole create, update, lifecycle | `createTeamRole`, `updateTeamRole` / nested `POST`/`PATCH` | corresponding commands / `TEAM_ROLE_CREATE`, `TEAM_ROLE_UPDATE`, `TEAM_ROLE_DISABLE` | overview + selected Team |
| Membership add, remove, role change | `addMember`, `removeMember`, `changeMemberRole` / nested member routes | corresponding commands / `TEAM_MEMBER_ADD`, `TEAM_MEMBER_REMOVE`, `TEAM_MEMBER_ROLE_CHANGE` | overview + Team + affected User |
| Team grant add/remove | `addTeamGrant`, `removeTeamGrant` / `POST`/`DELETE .../teams/[id]/grants` | exact commands / `TEAM_CAPABILITY_GRANT_UPDATE` | overview + Team |
| TeamRole grant add/remove | `addTeamRoleGrant`, `removeTeamRoleGrant` / nested `POST`/`DELETE` | exact commands / `TEAM_ROLE_CAPABILITY_GRANT_UPDATE` | overview + Team |
| Direct User grant add/remove | `addUserGrant`, `removeUserGrant` / `POST`/`DELETE .../users/[id]/grants` | exact commands / `USER_CAPABILITY_GRANT_ADD` or `USER_CAPABILITY_GRANT_REMOVE` | User; overview when applicable |

All three exact grant DELETE adapters use:

```ts
apiRequest(endpoint, { method: "DELETE", data: { capabilityKey, scope } })
```

Route tests prove the body reaches Team, TeamRole, and User handlers intact;
there is no query-string workaround and no `apiDelete()` body loss. Stable
server error codes are preserved in the response details and surfaced by the
client adapter without exposing Prisma/SQL/stack data.

## Capability readiness and compatibility audit

`CAPABILITY_REGISTRY` remains the sole capability identity/source-of-truth.
The exhaustive administration metadata map only adds operational
classification; domain `*_MIGRATED_CAPABILITIES` arrays are adapter-owned
subsets, not a second registry.

The complete registered matrix was rechecked against current adapters:

- `CENTRAL_ONLY -> GRANTABLE`: safe central-only operations, including
  `audit.read`.
- `CENTRAL_WITH_COMPATIBILITY -> POLICY_ACTIVATION_REQUIRED`: current
  Employee, Department, Routine, Stock, Leave, and Notification compatibility
  paths where a normal USER can receive a path-specific fallback.
- `DEFERRED -> DEFERRED`: deferred Routine capabilities and Email Request/future
  IT paths.

Every registered capability has `runtimeAuthorizationMode`,
`administrativeStatus`, `administrativelyGrantable`, and a conservative
`nonGrantableReason` where required. Ordinary add and remove reject both
`POLICY_ACTIVATION_REQUIRED` and `DEFERRED`. The non-monotonic Routine floor
(`routine.task.update` compatibility `CREATED + ASSIGNED`) remains blocked from
ordinary grants; the same check applies to all other compatibility-backed
capabilities. No compatibility floor was narrowed or retired.

Indirect applicability guards were rechecked for Team and TeamRole
enable/disable and membership add/remove/role change. They inspect only grants
that can become applicable or inapplicable: zero-member Teams, inactive roles,
and zero-member TeamRoles do not cause unrelated historical configuration to
block; active affected configuration is validated fail-closed. Old/new,
old/null, and null/new role transitions are covered. Unsafe Team/TeamRole
configuration, invalid origin, unknown capability, unsupported scope, and
readiness violations cannot become effective through these commands.

## Invalid configuration, lifecycle, and direct User grants

Invalid persisted rows remain raw and inspectable. Unknown capability keys,
unsupported scopes, direct User `TEAM` scope without origin, TeamRole/membership
mismatch, grant-origin mismatch, and resolver configuration errors are never
trimmed, coerced to `ALL`, auto-deleted, or auto-repaired. Resolver failures
become `INVALID_CONFIGURATION` in the inspector rather than ALLOW/DENY.

Direct User grants remain exceptional additive grants. The UI does not offer
`TEAM` scope; the server rejects it and validates registry/readiness before
both add and remove. Duplicate, missing, stale, and no-state-change outcomes
are deterministic.

User/account lifecycle and Employee/workforce lifecycle remain separate from
authorization configuration. Inactive/deleted User and Employee records,
memberships, Teams, roles, and grants remain inspectable, while trusted runtime
authentication/lifecycle checks still control access. There is no Team,
TeamRole, or authorization-history hard-delete command or UI.

## Transaction, audit, and database integrity

Every Phase 10B command uses the serializable transaction runner. Reads that
control status, existing state, role ownership, applicability, and audit
snapshots occur inside that transaction, followed by the write and
`appendAuditInTransaction()` on the same Prisma transaction. The real MySQL
rollback test proves an audit append failure leaves no configuration change.

All 13 dedicated `AuditAction` values remain present and mapped in the existing
Audit query/display registry. Re-enable is represented as `TEAM_UPDATE` or
`TEAM_ROLE_UPDATE` with an explicit `isActive` before/after snapshot, while
disable has its dedicated action. Snapshots preserve actor, target, before,
after, timestamp, and established request metadata (IP/User-Agent) without
accepting spoofed actor identity from JSON. Existing Audit filters and history
queries remain the single read surface.

Prisma and the applied migrations preserve Team key uniqueness, TeamRole
Team/key uniqueness, composite membership identity and same-Team role foreign
key, grant uniqueness, foreign keys, and `ON DELETE RESTRICT` history safety.
Migration `20260914100000_add_authorization_audit_actions` preserves historical
mapped physical Stock enum values. No Phase 10D migration was needed.

## Resolver source/origin semantics

`SYSTEM_ROLE`, `TEAM`, `TEAM_ROLE`, and `USER` sources survive resolver,
application projection, serialization, and UI rendering. `ADMIN` is resolved
from the system role and does not require Team membership or grants. For each
TEAM-scoped effective grant, tests assert both `source/origin.teamId` and
`constraint.teamId`; multiple Team membership tests prove origins are not
collapsed. Union semantics across Team + TeamRole + User are additive, and
removing one source does not remove another.

The inspector labels results as **Central Resolver** only, separately warns
about **domain compatibility policy**, and leaves **resource/workflow policy**
to the owning domain. A compatibility-backed `NO_APPLICABLE_GRANT` is visibly
not presented as universal final runtime denial.

## Production policy and seed audit

`AUTHORIZATION_SEED_CONFIGURATION` remains empty. `prisma/seed.ts` invokes the
explicit seed boundary but does not define or implicitly create Teams,
TeamRoles, memberships, grants, or direct User grants. Phase 10 introduced no
automatic policy activation, Department-to-Team mapping, manager/position
inference, automatic user grant, delegated administrator, or compatibility
floor retirement.

## UI/operator safety and performance

The workspace has no optimistic authorization success: controls are disabled
while relevant requests are pending, duplicate submission is prevented, a
success toast follows server confirmation, failures keep the stale state from
being declared successful, and affected reads are revalidated. Conflict and
not-found responses direct the operator to refresh. Dialog labels,
descriptions, focus states, keyboard controls, busy text/spinners, icon labels,
and table captions support the security-sensitive paths. Tables use bounded
queries and horizontal scrolling at narrow widths; Team detail is loaded only
for the selected Team and User resolver calculation only for the selected User.
The User search is bounded to 25 deterministic safe identity projections and
does not preload all Users.

## Verification evidence

Passed locally:

- `npm.cmd run architecture:check` — passed, 1,118 source files checked
- `npm.cmd run lint:strict` — passed
- `npm.cmd run typecheck` — passed
- final focused Phase 10A/10B/10C/10D suite — 17 files, 341 tests passed
- `npm.cmd run test:run` — 313 files, 2,715 tests passed
- `npm.cmd run check` — architecture, strict lint, typecheck, and 313/2,715
  unit tests passed
- targeted MySQL Authorization Administration, persistence, and resolver
  integration — 3 files, 16 tests passed; migrations had no pending changes
- `npm.cmd run test:integration:mysql` — migrations applied successfully;
  15/16 files and 100/101 tests passed

The full MySQL runner's only failure is the known pre-existing
`__tests__/integration/leave-quota-concurrency.integration.test.ts` failure:
`WorkforceAuthorizationError` at
`modules/leave/application/authorization.ts:79` while parsing the fixture
actor, before quota creation. The Phase 10D working diff contains no Leave,
quota, or production-policy file, and the failure signature matches the
baseline evidence recorded in Phase 10A/10B/10C.

GitHub CI evidence is separate: this checkout has no `.github` workflow, `gh`
is unavailable, and no GitHub status/check run was available locally. No local
command above is represented as GitHub CI evidence.

The optional Codex Security prompt-only runner could not start because this
host has no usable Python interpreter. The source-backed manual audit,
architecture guard, and tests above were still completed; this is recorded as
a tooling limitation, not fabricated scanner evidence.

## Intentional post-Phase-10 deferrals

The following remain explicitly outside Phase 10: Email Request/future IT
authorization migration; deferred Routine capabilities; production policy
activation for compatibility-backed capabilities; compatibility-floor
retirement; undecided organizational Team/TeamRole policy design; Department to
Team mapping; delegated authorization administrators; and any new authorization
model such as explicit DENY, wildcards, ABAC, policy DSL, nested Teams, role
inheritance, expiry, external policy service, or tenant model.

## Final closure decision

Within the approved Authorization Administration model, no Phase 10 security,
correctness, data-integrity, UI/API parity, transaction, resolver-origin, or
production-readiness blocker remains. The known Leave integration failure is
pre-existing and unrelated to Phase 10.

```text
Phase 10A — CLOSED
Phase 10B — CLOSED
Phase 10C — CLOSED
Phase 10D — CLOSED
Phase 10  — CLOSED
```

This closure means Authorization Administration tooling is production-ready;
it does not activate compatibility-backed production policy, retire
compatibility floors, turn Department into Team, migrate deferred capabilities,
or decide the organization's future Team/TeamRole policy.
