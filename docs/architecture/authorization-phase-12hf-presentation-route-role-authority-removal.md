# Phase 12H-F — Presentation and Route Role-Authority Removal

Status: **CLOSED**

Reviewed baseline: `f425a251249932384e0e9b52669581ebaa3cf2bc`

Phase 12H-E was accepted and closed before this phase. This phase removes
ordinary business authorization decisions that were still made directly from
`systemRole = ADMIN` in Dashboard presentation and route-entry surfaces. The
target is:

```text
trusted identity/lifecycle + capability authority + domain relationship/workflow state
```

Presentation projections remain UX hints. Server APIs and application services
continue to enforce capability, resource, lifecycle, workflow, validation,
concurrency, and data-integrity rules independently.

## Scope boundary

This phase does not switch the production authorization singleton to the
role-neutral resolver. The legacy ADMIN compatibility seam remains active, and
the following were not performed:

- production grant mutation, seed, backfill, live database preflight, canary,
  rollout, or production claim;
- global removal of `legacy-admin-business-authority-compatibility.ts` or every
  `SYSTEM_ROLE` compatibility branch;
- broad retirement of `requireActiveWorkforceOrAdminSession()`;
- Stock lifecycle/processor migration;
- policy invention for the private Leave attachment participant bypass;
- historical audit/provenance rewriting.

The next phase is **12H-G — production enforcement cutover and enforcement
regression**.

## Email Request

Email Request uses the existing authorization adapter and current production
resolver to project:

```ts
EmailRequestPresentationCapabilities {
  canReadRequests: boolean;   // email.request.read / OWN or ALL
  canCreateRequests: boolean; // email.request.create / ALL
}
```

The projection is resolved through the shared authenticated-user pipeline:

```text
getCurrentUserProjection()
  -> AuthenticatedUser
  -> DashboardUser
  -> DashboardProvider / Email Request page
```

The Email Request menu item no longer has `requiredRole: "ADMIN"`. It is
visible when either presentation capability is true. The page uses a
capability-aware route projection and redirects to `/access-denied` when both
are false. `authorization-administration` keeps its separate ADMIN-only
semantics.

The section now supports every valid capability combination:

| Effective presentation authority | Form | History | History GET |
|---|---:|---:|---:|
| CREATE only | shown | hidden | not requested |
| READ only | hidden | shown | requested |
| READ + CREATE | shown | shown | requested |
| Neither | page/menu unavailable | unavailable | not requested |

`EmailRequestProvider` receives the projection and uses a null SWR key when
read authority is absent. These client decisions only reduce UI/data fetching;
the Email Request API still checks `email.request.create / ALL` and
`email.request.read / OWN|ALL` on the server.

## Leave recovery

`LeavePresentationCapabilities` now includes the explicit
`canManageRecovery` projection. It is true only for an effective
`leave.recovery.manage` decision with `ALL` scope in the `DASHBOARD` channel.
It is not inferred from cancellation, not-taken, approver, or system-role
state.

Leave availability and the recovery tab consume `canManageRecovery`. The
recovery route no longer calls `isAdminRole(auth.user.role)`. It remains
protected by:

```text
active workforce session
-> leave.recovery.manage / ALL / DASHBOARD
-> recovery candidate predicate
-> owner exclusion
-> unavailable effective approver
-> pagination validation
-> candidate query
```

The capability check precedes the LeaveRequest query. A configured USER with
the approved recovery capability can list the same valid candidates as an
ADMIN account receiving equivalent effective capability authority. Existing
owner, effective-approver, workflow-state, and recovery invariants are
unchanged.

The private Leave attachment participant `isAdmin` bypass remains explicitly
deferred to the later enforcement/domain-policy phase. It is not silently
mapped to `leave.recovery.manage`, `leave.request.read`, or
`leave.approver.manage`.

## Routine

Routine presentation no longer selects a business `ADMIN` versus
`SELF_SERVICE` mode. The projection exposes independent authority concepts,
including broad effective scopes where they control presentation:

- `canReadAllTasks` from `routine.task.read / ALL`;
- `canCreateTasksForOthers` from `routine.task.create / ALL`;
- `canUpdateAllTasks` from `routine.task.update / ALL`;
- `canDeleteAllTasks` from `routine.task.delete / ALL`;
- `canReadAllReferences` from `routine.reference.read / ALL`.

Import and export remain independent: import uses `canManageImports`, and
export uses `canExportTasks`. Occurrence controls keep their existing granular
capability/resource predicates.

For task creation, `OWN` keeps self-service assignee behavior and `ALL` enables
the approved broad assignee selection. Update and delete still require the
resource predicates and effective operation-specific scope; an `ALL` scope does
not bypass task state, version, concurrency, idempotency, imported-task,
validation, audit, or notification invariants. LIFF remains self-service
constrained even when configured Dashboard authority is broad.

Routine application code uses the semantic `hasBroadAuthority` value derived
from the effective scope relevant to the current operation. It does not use a
global or unrelated capability as an admin replacement. Query serialization
uses the approved `routine.import.manage` authority for import source metadata,
and the presentation projection expects the same visibility decision.

Historical audit/provenance values such as `ADMIN` remain readable where they
are part of an existing compatibility contract. New configured broad authority
does not rewrite historical values; internal branching uses role-neutral
terminology where the value is not historical data.

## Corrective provenance boundary

The post-closure corrective baseline is `4e7236ef9d6d9a6b33cdf495544595a0ae4f9b67`.
Routine task `ALL` scopes control broad task/resource behavior only. They do
not include write authority over import provenance.

Normal `routine.task.create` always strips caller-supplied
`sourceFileName`, `sourceSheet`, and `sourceRow` before persistence and before
the normal task-create idempotency hash is generated. This applies equally to
configured USER `ALL`, legacy ADMIN compatibility `ALL`, Team/TeamRole `ALL`,
and ordinary LIFF task creation. Normal `routine.task.update` also omits those
fields from the Prisma update, so existing imported provenance remains
unchanged during ordinary task edits.

Only the import-managed apply path, which is authorized through
`routine.import.manage / ALL`, preserves trusted source provenance. The import
workflow, staging, ledger linkage, fingerprints, audit, occurrence generation,
and transaction behavior remain unchanged. Query/detail serialization remains
read-gated by the same `routine.import.manage` authority. The neutral
presentation label is `ข้อมูลต้นทางการนำเข้า`; it does not imply role-based
authority.

## Explicitly retained role uses

The final semantic search classified all remaining production role matches:

| Classification | Retained surface | Reason |
|---|---|---|
| `CONTROL_PLANE_KEEP` | `app/api/authorization/administration/**`, `app/dashboard/authorization`, `requireDashboardAuthorizationAdministration()`, `assertAuthorizationAdministrationAccess()`, Administration menu, `requireAdminSession` | Permission administration is a real control-plane concern |
| `AUTHENTICATION_LIFECYCLE_KEEP` | Bootstrap ADMIN assignment, `requireActiveWorkforceOrAdminSession()`, narrow Routine/Stock lifecycle branches, account/workforce checks | These are authentication/account-lifecycle compatibility boundaries; the broad caller audit is Phase 12H-G |
| `PRESENTATION_IDENTITY_ONLY` | Dashboard/Stock `isAdmin` identity labels and role badges | Visible identity/provenance only; no business authority is granted |
| `DOMAIN_RECIPIENT_POLICY` | Routine/Stock `Role.ADMIN` notification recipients | Recipient/business-notification policy, not current-actor authorization |
| `COMPATIBILITY_DEBT_12H_G_OR_I` | `legacy-admin-business-authority-compatibility.ts` and remaining Stock compatibility semantics | Production enforcement cutover and compatibility removal are later phases |
| Explicitly deferred domain policy | Leave private-attachment participant ADMIN bypass | No approved generic attachment capability exists in this phase |

No ordinary business presentation or route-entry role gate remains
unclassified. In particular, Email Request, Leave recovery, and Routine
business surfaces no longer use `role === "ADMIN"` as their presentation or
route-entry authority. Cosmetic identity labels and notification audiences
remain intentionally unchanged.

## 12H-D evidence housekeeping

The Phase 12H-D closure record retains its original historical repository
result of `326 files / 3,071 tests`. A note was added there stating that after
the final 12H-D corrective patch, the later Phase 12H-E repository verification
ran on the resulting code and reported `326 files / 3,091 tests` at the Phase
12H-E revision. The historical 12H-D total was not silently replaced.

## Verification

The following checks passed:

- Email/Leave/Dashboard projection and route-entry selection: **10 files / 82 tests**;
- Routine authorization/query/mutation/presentation/form selection: **12 files / 212 tests**;
- Authorization Administration control-plane selection: **8 files / 65 tests**;
- Email API and Leave authorization/API selection: **5 files / 83 tests**;
- Leave route projection regression: **1 file / 11 tests**;
- full repository suite: **328 files / 3,106 tests**;
- `npm.cmd run typecheck`;
- `npm.cmd run lint:strict`;
- `npm.cmd run architecture:check` — 1,149 source files checked;
- `git diff --check`.

No development server or production build was run. No production grant, seed,
backfill, migration, live preflight, canary, or authorization rollout was
performed.

### Post-closure corrective verification

After the Phase 12H-F closure evidence above, the corrective patch was verified
against baseline `4e7236ef9d6d9a6b33cdf495544595a0ae4f9b67`:

- Routine mutation, idempotency, import/staging/apply, query, authorization,
  and presentation regression selection: **20 files / 273 tests passed**;
- full repository suite: **328 files / 3,110 tests passed**;
- `npm.cmd run typecheck`: passed;
- `npm.cmd run lint:strict`: passed;
- `npm.cmd run architecture:check`: passed, 1,149 source files checked;
- `git diff --check`: passed.

These results are corrective verification after closure; they do not replace
the historical Phase 12H-F evidence above. No development server or production
build was run, and no production data or authorization grants were mutated.
