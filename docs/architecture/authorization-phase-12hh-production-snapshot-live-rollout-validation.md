# Phase 12H-H — Production Snapshot / Live Rollout Validation

Status: **OPEN — repository/tooling validation PASS; production operational
acceptance NOT RUN**

Reviewed baseline: `8bc5eedffc5f2699d10acd86c6920290787a9786`
(`feat(auth): cut over business enforcement to role-neutral authority`)

Phase 12H-G is accepted and closed. This document is an operational handoff
and evidence record for validating the real production authorization state
before and during rollout. It does not claim that a production database,
application, deployment, canary, or observation window was inspected unless
the corresponding evidence is recorded below.

The rollout target is:

```text
trusted identity/lifecycle
  + Default Domain Policy
  + Team / TeamRole / exceptional User grants
  + domain resource/workflow relationships
```

`ADMIN` remains an identity/control-plane attribute. It is not an implicit
ordinary business grant. The legacy ADMIN-compatible resolver and composition
are retained only for the comparison seam required by this phase. Phase 12H-I
must not remove that seam until this document has actual accepted production
comparison and rollout evidence.

## A. Repository / operational tooling validation

### A.1 Existing authority and readiness boundary

This phase reuses the existing implementation. No second scanner, capability
evaluator, production mutation script, seed, backfill, or direct SQL path is
introduced.

| Responsibility | Existing authority |
|---|---|
| Read-only production command | `scripts/authorization-production-preflight.ts` |
| Readiness evaluation and status model | `modules/authorization/application/production-readiness.ts` |
| Safe persisted projection | `modules/authorization/infrastructure/persistence/authorization-production-readiness-repository.ts` |
| Capability and scope truth | Capability Registry and Administration catalog |
| Target effective access | Authorization Administration effective-access provider and domain-owned inspectors |
| Audited mutation boundary | Authorization Administration UI/API and its transaction-bound application service |
| Legacy comparison only | `createLegacyAdminCompatibleAuthorizationResolver()`, `evaluateLegacyAuthorization()`, and `composeLegacyAdminCompatibleAuthorizationAuthority()` |

The preflight repository uses a repeatable-read transaction and explicit
field projections for Teams, TeamRoles, memberships, grants, User/Employee
lifecycle, and `_prisma_migrations`. It does not read or print passwords,
sessions, refresh/access tokens, OAuth secrets, email addresses, or full
database URLs. The preflight has no create/update/delete/upsert, seed,
backfill, repair, or normalization operation.

The normal resolver/effective-access provider remains the authority for the
role-neutral target. The legacy seam may describe a historical comparison
outcome only; it must never be called by normal runtime enforcement.

### A.2 Operator preflight commands

Run these commands from the exact production release/runtime whose revision is
being validated. `DATABASE_URL` must be injected by the production secret
manager or deployment environment; never echo it or put it in evidence.

```powershell
$env:NODE_ENV = "production"
$env:AUTHORIZATION_PREFLIGHT_ENVIRONMENT = "production"

npm run authorization:production:preflight
npm run authorization:production:preflight -- --details
npm run authorization:production:preflight -- --json
```

Record the command exit code and retain the bounded stdout/JSON output in the
approved evidence store. The target record must include only non-secret
identity information:

```text
environment: production
NODE_ENV: production
database host: <recorded by operator; no credentials>
database port: <recorded by operator>
database name: <recorded by operator>
application/deployment revision: <release SHA or deployment identifier>
timestamp: <operator record>
operator: <operator record>
```

The JSON `target` projection is the source for environment, `NODE_ENV`, host,
port, and database name. Timestamp, operator, deployment revision, and
approval are recorded outside secret material.

### A.3 Readiness and evidence states

These states are not interchangeable:

| State | Meaning |
|---|---|
| `PASS` | The named gate was actually executed and its acceptance conditions passed. |
| `WARNING` | The gate executed without a blocker but has a finding requiring explicit disposition. It is not silent PASS. |
| `BLOCKED` | A blocker, failed safety condition, missing evidence, or invalid configuration prevents rollout. |
| `NOT RUN` | The gate requires an authorized production execution or operator evidence that has not occurred. |

For the readiness report, `BLOCKED` includes missing/incomplete/rolled-back
required migrations, invalid persisted configuration, and inventory read
failure. A readiness `WARNING` still requires a disposition for every warning
before canary mutation. A production deployment gate may proceed only when
there are zero blockers, all warnings have machine-checkable reviews, business
authority is intentional, the canary plan passes validation, rollback is ready,
and application/authentication health is normal.

### A.4 Required migration contract

The code-owned `AUTHORIZATION_PRODUCTION_REQUIRED_MIGRATIONS` constant is the
contract. Production evidence must read back every required row from
`_prisma_migrations`; the existence of migration files in Git is not evidence.
Each row is accepted only when `finished_at` is non-null and `rolled_back_at`
is null. A missing, unfinished, rolled-back, duplicated, or otherwise invalid
row is a rollout blocker.

The current required migration names are:

```text
20260108060001_add_audit_log
20260911100000_add_authorization_persistence
20260914100000_add_authorization_audit_actions
```

### A.5 Safe inventory and responsibility review

The captured report must include the safe aggregate projection for:

```text
Teams, TeamRoles, TeamMemberships
TeamCapabilityGrants, TeamRoleCapabilityGrants, UserCapabilityGrants
relevant User and Employee lifecycle
required migration evidence
```

At minimum retain:

```text
teamCount, activeTeamCount, inactiveTeamCount
teamRoleCount, activeTeamRoleCount, inactiveTeamRoleCount
membershipCount
teamGrantCount, teamRoleGrantCount, directUserGrantCount
effectiveConfiguredAuthorityCount
invalidConfigurationCount, warningCount, blockerCount
grantsByCapability, grantsBySourceAndScope
```

Do not use role names, Department names, Team names, job titles, or historical
ADMIN membership as a capability mapping. For each central-only business
requirement, record the real operator and responsibility, then choose the
smallest intentional source:

```text
shared responsibility -> Team or TeamRole grant
exceptional individual responsibility -> direct User grant
```

Do not mass-backfill former ADMIN users. Examples such as Employee mutation or
import, Routine occurrence administration/import/export, Stock inventory or
processing, Leave approver/recovery, Audit read, and Email Request access are
questions for the actual responsibility matrix, not an automatic ADMIN bundle.

### A.6 Warning review contract

Every readiness `WARNING` needs an explicit record containing:

```text
finding identity
reason
impact
keep / remediate decision
operator or reviewer
```

The `reviewedWarnings` supplied to
`validateAuthorizationProductionCanaryPlan()` is the machine-checkable source.
It must match every current warning identity and contain substantive
`disposition` and `reviewedBy` values. Missing, stale, duplicate, or inadequate
or unrelated review is a canary blocker. Warnings must not be hidden by
changing the inventory, filtering output, or weakening the validator.

### A.7 Canary plan and before-state contract

The operator must select the target explicitly. The plan must contain all of
the following before validation:

```text
source: TEAM | TEAM_ROLE | USER
targetId
observerUserId
capabilityKey
scope
channel
contextKey
businessReason
operator
plannedTimeWindow
rollbackAction
```

The observer must satisfy the active User/Employee/workforce constraints for
the selected path. Team and TeamRole plans require an eligible active member;
direct User plans use the granted User as observer. Prefer a safe business
effect that can be reversed by removing exactly one grant.

Before any mutation, capture from the authoritative Authorization
Administration effective-access read model, not from operator expectation:

```text
observerUserId
capabilityKey
channel
contextKey
state
defaultScopes
effectiveScopes
```

The canary validator must reconcile this evidence with the provider and the
role-neutral resolver. It must reject an exact existing grant, unsupported
capability/scope/channel, inactive or ineligible target, readiness blockers,
stale warning review, invalid effective-access evidence, or a proposed grant
that adds no effective authority.

### A.8 Approved mutation and rollback boundary

The preflight remains read-only. If the canary is approved, perform exactly
one intended grant mutation through the existing audited Authorization
Administration UI/API transaction boundary. The relevant API surfaces are:

```text
POST/DELETE /api/authorization/administration/teams/{teamId}/grants
POST/DELETE /api/authorization/administration/teams/{teamId}/roles/{roleId}/grants
POST/DELETE /api/authorization/administration/users/{userId}/grants
```

Do not mutate authorization tables with SQL, Prisma ad-hoc scripts, seeders,
or backfills. The mutation must create the existing transaction-bound audit
event:

```text
TEAM_CAPABILITY_GRANT_UPDATE
TEAM_ROLE_CAPABILITY_GRANT_UPDATE
USER_CAPABILITY_GRANT_ADD / USER_CAPABILITY_GRANT_REMOVE
```

Define rollback before mutation. Normally it is the matching remove operation
for the exact grant just added. Do not delete a Team, TeamRole, membership, or
unrelated grant as a shortcut. Because authority is additive, verify effective
access after removal; deleting one row is not enough if another source still
supplies the same scope.

### A.9 Post-canary and observation checklist

Immediately after mutation, verify each item against actual production:

1. Administration effective-access shows the intended new authority.
2. The protected server/API operation succeeds for the canary actor.
3. The operation produces only the approved scope.
4. Resource, ownership, participant, workflow, and lifecycle predicates still
   hold.
5. Unrelated capabilities remain unavailable.
6. An equivalent actor without the grant is denied where the capability is
   central-only.
7. No implicit ADMIN business authority appears.
8. The mutation audit event exists and identifies the exact change.
9. No unexpected authorization-related 401/403/500 increase appears during
   the approved observation window.

Also validate the representative boundary matrix where safe existing records
are available. Do not create production data merely to manufacture theoretical
coverage:

| Boundary | Required production check |
|---|---|
| Defaults | Default Domain Policy for USER and ADMIN; parity for equivalent trusted context |
| Configured authority | Configured USER, configured ADMIN, Team grant, TeamRole grant, and exceptional User grant only if actually used |
| Central-only denial | Actor without the grant remains denied |
| Routine | Dashboard and LIFF; no LIFF-to-Dashboard authority expansion |
| Stock | Requester and configured processor/inventory operator; request/resource rules remain enforced |
| Leave | Requester, assigned approver, configured recovery operator if present, and private attachment participant/non-participant |
| Audit and Email Request | Configured reader/creator only when production configuration actually uses them |
| Control plane | Authorization Administration remains ADMIN-only and does not become ordinary business authority |

Observe and record authorization-related 401, 403, 500,
`AuthorizationConfigurationError`, `UNKNOWN_CAPABILITY`, and unsupported-channel
failures, workforce-lifecycle rejections, canary business success/failure, and
Authorization Administration audit events. Never log secrets, sessions, or
raw tokens. Distinguish an intentional 403 increase caused by removed implicit
ADMIN authority from an unexpected outage.

### A.10 Verification executed for this repository change

These results validate repository code and documentation only. They are not
production evidence and do not change any live-gate status in section B.

| Check | State | Result |
|---|---|---|
| Focused authorization tests | `PASS` | 6 files / 184 tests passed |
| `npm.cmd run typecheck` | `PASS` | Completed successfully |
| `npm.cmd run lint:strict` | `PASS` | Completed successfully with zero warnings |
| `npm.cmd run architecture:check` | `PASS` | 1,149 repository source files checked |
| `git diff --check` | `PASS` | Completed with exit code 0 |
| Full test suite | `NOT RUN` | No implementation code changed materially; focused authorization coverage was used |
| Live production preflight/canary/rollout | `NOT RUN` | No explicitly authorized production target or evidence was available |

## B. Actual production execution evidence

### B.1 Current execution status

**Status: NOT RUN.** No explicitly identified and authorized production
database/application target, production deployment revision, operator-approved
canary, or live observation evidence was supplied to this coding session. No
production preflight, grant mutation, deployment, canary operation, rollback,
or production data access was performed. A local/dev database, if present,
would not be labelled as production evidence.

Accordingly, the following live gates remain `NOT RUN` and the deployment must
not be declared complete:

| Live gate | Status | Required evidence |
|---|---|---|
| Deployment revision identified | `NOT RUN` | Production release/deployment SHA and timestamp |
| Production target identity | `NOT RUN` | Environment, `NODE_ENV`, host, port, database name, operator, timestamp |
| Required migrations applied | `NOT RUN` | `_prisma_migrations` readback for every required migration |
| Production inventory captured | `NOT RUN` | Preflight JSON/details and safe aggregate summary |
| Zero production blockers | `NOT RUN` | Actual production preflight with `blockerCount = 0` |
| Warning review | `NOT RUN` | One disposition/reviewer record for every warning |
| Required business authority | `NOT RUN` | Reviewed responsibility matrix and intentional Team/TeamRole/User source |
| Canary plan validation | `NOT RUN` | Explicit plan and `validateAuthorizationProductionCanaryPlan()` result `PASS` |
| Before effective access | `NOT RUN` | Provider-backed state/default/effective scopes |
| Legacy comparison snapshot | `NOT RUN` | Selected principal comparison using the retained legacy seam |
| Audited canary mutation | `NOT RUN` | Exact UI/API mutation record and matching audit event |
| Post-canary effective access | `NOT RUN` | Provider readback showing intended authority and no excess scope |
| Actual protected-path verification | `NOT RUN` | Production server/API result for canary actor and denial controls |
| Rollback | `NOT RUN` | Exact-grant removal, audit event, before-state/effective-access readback |
| Observation window | `NOT RUN` | 401/403/500/error/log/business-operation review |
| Final operator acceptance | `NOT RUN` | Named operator/reviewer acceptance against all gates |

### B.2 Evidence record to complete during an authorized run

Do not replace any `NOT RUN` value with `PASS` from unit tests, source review,
staging behavior, migration files, operator intention, or an assumed match
between staging and production.

#### Production snapshot

```text
deployment revision: NOT RUN
environment: NOT RUN
NODE_ENV: NOT RUN
database host: NOT RUN
database port: NOT RUN
database name: NOT RUN
preflight timestamp: NOT RUN
operator: NOT RUN
preflight command exit codes: NOT RUN
preflight status: NOT RUN
```

Attach the standard, `--details`, and `--json` outputs without secrets. The
JSON target and report must agree with the external operator record.

#### Migration and inventory readback

```text
20260108060001_add_audit_log: NOT RUN
20260911100000_add_authorization_persistence: NOT RUN
20260914100000_add_authorization_audit_actions: NOT RUN

inventory summary: NOT RUN
grantsByCapability: NOT RUN
grantsBySourceAndScope: NOT RUN
finding identities/details: NOT RUN
```

#### Warning and authority review

For each actual warning, record its finding identity, reason, impact,
keep/remediate decision, and reviewer. The canary plan must include the same
finding identity in `reviewedWarnings`:

```text
warning reviews: NOT RUN
business responsibility matrix: NOT RUN
intentional source selection: NOT RUN
mass ADMIN backfill: MUST NOT OCCUR
```

#### Canary and effective-access evidence

```text
source: NOT RUN
targetId: NOT RUN
observerUserId: NOT RUN
capabilityKey: NOT RUN
scope: NOT RUN
channel: NOT RUN
contextKey: NOT RUN
businessReason: NOT RUN
operator: NOT RUN
plannedTimeWindow: NOT RUN
rollbackAction: NOT RUN
canary validator result: NOT RUN

before.state: NOT RUN
before.defaultScopes: NOT RUN
before.effectiveScopes: NOT RUN
legacy effective authority: NOT RUN
target role-neutral effective authority: NOT RUN
difference and expected business impact: NOT RUN
configured source responsible for target authority: NOT RUN
```

#### Mutation, verification, rollback, and observability

```text
approved mutation boundary: NOT RUN
exact grant added: NOT RUN
mutation audit event: NOT RUN
after effective access: NOT RUN
actual protected API/server result: NOT RUN
resource/channel/lifecycle checks: NOT RUN
unconfigured equivalent actor denial: NOT RUN
implicit ADMIN authority check: NOT RUN
rollback performed: NOT RUN
exact grant removed: NOT RUN
rollback audit event: NOT RUN
effective access returned to before-state: NOT RUN
post-rollback protected operation: NOT RUN
post-rollback preflight: NOT RUN
observation window and error review: NOT RUN
```

### B.3 Fail-safe decision

Stop or roll back the deployment if configured operators lose required access,
an unconfigured actor gains central-only access, ADMIN gains implicit business
authority, USER/ADMIN default parity changes unexpectedly, a resource predicate
is bypassed, LIFF gains Dashboard authority, valid production configuration
causes a structural authorization error, widespread unexpected 401/403/500
appears, or audit evidence is missing. Do not add an ADMIN bypass to mask any
of these conditions; correct the configuration or code at the owning boundary.

### B.4 Phase boundary

Phase 12H-H remains operationally open until the live gates above have actual
production evidence and explicit operator acceptance. Phase 12H-I must not
start: retain `SYSTEM_ROLE` legacy grant representation, compatibility-named
exports, the legacy resolver/evaluator, and legacy composition until H is
accepted.

## C. Phase 12H-H corrective hardening note

This corrective patch remains within Phase 12H-H. It does not constitute
production operational acceptance, and Phase 12H-I has not started. The
retained `SYSTEM_ROLE` legacy comparison seam, compatibility-named exports,
legacy resolver/evaluator, and legacy composition remain in place.

The patch corrects the following handoff findings:

- Routine all-scope presentation and server semantics now agree. Dashboard
  `scope=all` requires effective `routine.task.read / ALL`, while broad KPI
  summary authority is projected and enforced separately through
  `routine.summary.read / ALL`. Unauthorized deep links remain in the
  authorized mine view.
- Authorization Administration can intentionally assign or remove the
  system `ADMIN` role through an Auth-owned system-role operation. The change
  does not create Team, TeamRole, User grants, business capabilities, or a
  Default Domain Policy change.
- System-admin lifecycle checks use the same eligible active control-plane
  definition for promotion, demotion, and employee offboarding. Serializable
  locking, deterministic eligible-admin locking, self-demotion protection,
  last-eligible-admin protection, and same-transaction `USER_ROLE_CHANGE`
  audit are covered by focused regression tests.
- Authorization Administration now separates account/system role,
  effective access, and memberships visually. Effective-access domains are
  bounded tonal blocks, and Team permission areas use the same quiet-frame
  hierarchy without changing the existing tab model.

### C.1 Operational status

Phase 12H-H production operational acceptance remains **OPEN / NOT RUN**.
The production gates and evidence record in section B are unchanged and must
not be inferred from local tests, source review, or documentation. This note
records corrective code and test work only.

### C.2 Real MySQL integration evidence

The dedicated MySQL integration database was migrated through the repository's
normal integration convention, then the real Auth and Employee application
paths were exercised without mocking `runSerializableTransaction()`,
`lockUserRows()`, Prisma persistence, or Audit persistence.

| Evidence | State | Result |
|---|---|---|
| Real system-role integration file | `PASS` | `__tests__/integration/system-role-lifecycle.integration.test.ts`: 1 file / 6 tests passed |
| Full repository MySQL integration invocation | `PASS` | `npm run test:integration:mysql`: 17 files / 110 tests passed; 0 failed files and 0 failed tests |
| Concurrent ADMIN demotion | `PASS` | Two eligible ADMIN accounts were demoted concurrently; exactly one mutation succeeded, one returned `LAST_ELIGIBLE_ADMIN`, and the committed database retained exactly one eligible ADMIN |
| Cross-path role/lifecycle race | `PASS` | Both demotion-versus-Employee-offboarding target directions passed; one path won safely and the final database retained one eligible ADMIN |
| Real `USER_ROLE_CHANGE` audit | `PASS` | Promotion persisted `User.role` and the same-transaction Audit row with actor, before/after role, and target metadata |
| Role-neutral business authority | `PASS` | Promotion created no business grants; demotion preserved the target's Team membership, Team grant, TeamRole grant, and direct User grant |
| Eligible-admin definition | `PASS` | Inactive/deleted/unlinked/inactive-Employee/suspended-Employee/deleted-Employee ADMIN rows did not count; removing the only usable ADMIN was rejected |
| Same-transaction Audit failure rollback | `UNIT LEVEL` | The existing mocked dependency test remains the rollback proof; no artificial production failure hook was introduced solely for integration testing |

The MySQL fixture rebaseline covered the previously failing Stock issuer,
Routine import operator, Routine reminder operator, Auth-session lifecycle
actor, and signup Employee lifecycle actor. Each received only the explicit
business capability required by the exercised application path, and business
fixtures now use the active linked Employee contract where required. Requester,
negative authorization, and ineligible lifecycle fixtures were not broadened.
No implicit `ADMIN` business authority was restored, and the Authorization
Administration control plane remains intentionally ADMIN-only.

The accepted production implementation passed this real MySQL concurrency
proof unchanged; no production locking correction was required. This is
repository/integration evidence only. Phase 12H-H production operational
acceptance remains **OPEN / NOT RUN**, and Phase 12H-I remains untouched.
