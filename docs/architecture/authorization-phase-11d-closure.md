# NHF Employee Authorization Phase 11D — Residue Cleanup & Final Closure

## Status

**CLOSED — Phase 11A–11D is complete for the current approved authorization policy.**

Phase 11D was a residue and closure pass. It did not introduce a new
authorization-policy migration, activate deferred policy, seed production
grants, or redesign authorization persistence.

## Baseline

| Item | Value |
| --- | --- |
| Audited commit at Phase 11D start | `a287459d71e4e92da95692b783beba01bafd2123` |
| Audit date | 2026-09-16 |
| Source-of-truth documents | `authorization-contract.md`, `authorization-resolver.md`, `authorization-current-state.md`, Phase 11A audit, Phase 11B1–11B4 closures, Phase 11C matrix and closure, `module-boundaries.md`, `dependency-rules.md`, `scripts/check-architecture.mjs` |
| Historical Phase 11C baseline | `5669d79ca359701bc6a637079ca738575b731cf7` |

The working tree changes from this closure are intentionally uncommitted. The
repository `HEAD` therefore remains the baseline SHA above; no commit was
created by this pass.

## Residue inventory

The audit searched the repository for legacy role checks, authorization
adapters and contracts, compatibility branches, capability projections, route
guards, Team/TeamRole paths, stale exports, migration comments, tests and
documentation. A finding was not classified as obsolete based on its name or
legacy-looking shape alone; callers and runtime reachability were traced first.

| Finding | Classification | Action taken | Remaining behavior / risk | Production behavior changed? |
| --- | --- | --- | --- | --- |
| `modules/stock/application/authorization.ts::canResolveStockCapabilityForMigration` and its `modules/stock/index.ts` export had no caller, test reference, or documentation reference. | `OBSOLETE_RESIDUE` | Removed the unused helper and barrel export. | Stock routes continue to use `assertStockCapabilityForMigration` or `resolveStockCapabilityForMigration`; the removed symbol had no reachable runtime path. | No |
| Domain `parseUserRole` guards and `assert*CapabilityForMigration` / `resolve*CapabilityForMigration` adapters for Employee, Department, Routine, Stock, Leave, Audit and Notification remain called by current routes/services. | `ACTIVE_AUTHORIZATION` | Retained. Verified callers and focused/full tests. | Central resolver decisions remain the server authority; domain adapters still apply domain-specific scopes and compatibility translation. | No |
| `legacyEmployee*`, `legacyDepartmentScopes`, `legacyNotificationScopes`, `legacyStockScopes`, Leave compatibility floors, and Routine's exact normal-USER work-item `NO_APPLICABLE_GRANT -> ALL` bridge remain reachable and covered. | `COMPATIBILITY_POLICY` | Retained explicitly. | Existing approved broad/relationship behavior remains; no compatibility floor was retired or broadened. | No |
| Dashboard ADMIN account/workforce seams in `requireActiveWorkforceOrAdminSession` and the narrow lower Stock/Routine/Leave transaction branches remain reachable only for documented compatibility operations. | `COMPATIBILITY_POLICY` | Retained and re-audited. | ADMIN still requires authentication and the applicable lifecycle/domain/workflow checks; account-only behavior is not a general capability bypass. | No |
| Routine summary/reference/export paths, including `isRoutineAdminActor` and the legacy presentation fallback, remain outside the migrated central policy. | `DEFERRED_AUTHORIZATION_SURFACE` | Retained and documented as deferred. | Current route authentication, self-service/resource behavior and all-view compatibility remain unchanged. | No |
| Leave report/export remains outside the generic migrated capability set where documented. | `DEFERRED_AUTHORIZATION_SURFACE` | Retained and classified as deferred. | Existing report behavior remains; no future report/export policy was selected. | No |
| Email Request read/create route guards and the in-app compatibility adapter remain outside the authorization migration. | `DEFERRED_AUTHORIZATION_SURFACE` | Retained. | Current explicit route behavior remains; Email Request was not migrated or made grantable. | No |
| Leave participant/approver/attachment relationships, Routine assignee/workflow rules, Stock request ownership/process rules, Notification actor-derived ownership and Audit export-event recording remain domain-owned. | `DOMAIN_RESOURCE_POLICY` | Retained. | Domain predicates and workflow invariants continue to run after central capability checks where applicable. | No |
| `requireApiSession`, `requireAdminSession`, workforce checks, current-role re-read, signup bootstrap and last-active-ADMIN lifecycle checks remain active. | `AUTHENTICATION_OR_LIFECYCLE` | Retained. | ADMIN remains highest system authority but does not bypass authentication, active-account or lifecycle requirements. | No |
| `isAdminRole` in Dashboard providers, tabs, page availability, labels, capability display and Authorization Administration status badges remains presentation or descriptive identity logic. | `PRESENTATION_ONLY` | Retained after caller review. | UI visibility and labels are not relied upon as server enforcement. | No |
| Authorization Administration catalog/read/write contracts, code-owned capability registry, Team/TeamRole/membership records, trusted Team origin and architecture checker remain active. | `ARCHITECTURE_BOUNDARY` | Retained. | Team is not Department; TeamRole names do not grant authority; no Team policy was activated. | No |
| `__tests__/integration/leave-quota-concurrency.integration.test.ts` supplied `session.user.role` but omitted the top-level `user.role` consumed by the real Leave request route. | `TEST_OR_FIXTURE_RESIDUE` | Added `role: "USER"` to the fixture's top-level user shape. | The fixture now matches the current persisted/session contract; `parseUserRole` remains strict. | No |
| Living current-state documentation still described Phase 11C as the latest closure and described the MySQL fixture failure as unresolved; historical Phase 11B/11C documents contain their original roadmap/evidence. | `DOCUMENTATION_RESIDUE` | Updated `authorization-current-state.md` and created this closure. Historical closure documents were not rewritten. | Historical records retain their historical claims; the living state points to Phase 11D and records the corrected fixture. | No |

### Role-check and helper disposition

The remaining `ADMIN`/`isAdminRole` references were individually classified as
follows:

- Central evaluator and Authorization Administration trusted-principal checks:
  `ACTIVE_AUTHORIZATION`.
- Session, workforce, current-role and last-active-ADMIN checks:
  `AUTHENTICATION_OR_LIFECYCLE`.
- Leave recovery/attachment, Stock workflow, Routine workflow and recipient or
  notification rules: `DOMAIN_RESOURCE_POLICY`.
- Email Request deferred guard and Routine deferred summary/reference/export
  fallback: `DEFERRED_AUTHORIZATION_SURFACE`.
- Dashboard menu/page/tab/provider/status projections: `PRESENTATION_ONLY`.
- `Role.ADMIN` recipient selection in notification/reminder infrastructure is
  `DOMAIN_RESOURCE_POLICY` delivery/workflow behavior, not caller authorization.

The per-domain role parsers are intentionally defensive boundary validation;
they do not create an independent authorization model. The `legacy*Scopes`
helpers are active compatibility policy, not duplicate central authority.

The capability registry, Administration raw/record contracts, seed entry
points, presentation projections and route guards all have current callers or
are required architecture boundaries. No additional stale import, export,
type, constant, capability projection or old adapter contract met the proof
needed for deletion.

## Cleanup performed

1. Removed the unreachable Stock boolean helper
   `canResolveStockCapabilityForMigration`.
2. Removed only its unreachable Stock public barrel export.
3. Corrected the stale Leave MySQL integration fixture by adding the missing
   top-level `user.role` field.
4. Updated the living authorization state and added this final closure record.

No production authorization source, schema, grant, Team record, route policy,
compatibility floor or deferred policy was changed.

## Intentionally retained behavior

The following approved behavior remains unchanged:

- Employee broad read/stats/export and Admin compatibility behavior.
- Department compatibility behavior.
- Notification compatibility behavior.
- Stock compatibility and relationship floors.
- Leave compatibility and domain-owned relationship/workflow boundaries.
- Dashboard ADMIN account/workforce compatibility seams.
- Routine normal USER work-item `NO_APPLICABLE_GRANT -> ALL` compatibility
  bridge, limited to its documented case.
- Current Dashboard and LIFF channel-specific behavior and projections.
- Additive grants and default-deny behavior for normal USER authorization.

No explicit DENY, wildcard capability, ABAC/policy DSL, nested Team,
TeamRole inheritance, Department-to-Team inference, implicit Team origin or
production grant seed was introduced.

## Deferred policy decisions outside Phase 11

These remain separate future policy decisions and are not claimed as migrated
by this closure:

1. Routine summary/reference/export central authorization policy.
2. Leave report/export authorization policy.
3. Email Request read/create authorization policy.
4. Future Team/domain-resource authorization policy.

Phase 11D did not retire Routine all-view compatibility, activate broad Routine
grants, change Leave report/export access, migrate Email Request, activate Team
resource policy, seed production grants, infer Team membership from Department,
or redesign authorization persistence.

## Phase 11C optional evidence review

The six legitimate `INDIRECT` matrix rows were reviewed individually. They
were not mechanically promoted to `DIRECT`:

| Matrix row | Final Phase 11D disposition |
| --- | --- |
| `AUTHN-01` | Remains `INDIRECT`: it is an aggregate over selected authenticated entry points, not an exhaustive proof for every route. |
| `CAP-12` | Remains `INDIRECT`: the additive/default-deny contract is established by source and resolver tests; no persistence model change occurred that would justify a new schema assertion. |
| `CHANNEL-07` | Remains `INDIRECT`: Dashboard and LIFF are tested separately with fixed channel actors, but there is no exhaustive paired capability table. |
| `ADMIN-08` | Remains `INDIRECT`: current-role revalidation is directly covered in named paths, while the aggregate does not claim every ADMIN route. |
| `COMPAT-10` | Remains `INDIRECT`: Leave report/export route and service behavior has tests and adjacent registry evidence, but the current classification is intentionally a deferred policy boundary rather than a new absence-only assertion. |
| `COMPAT-15` | Remains `INDIRECT`: Team/Department and TeamRole non-inference is an architecture boundary; a future Team resource policy needs its own domain matrix and behavior tests. |

No low-signal snapshot or absence-only test was added solely to increase the
`DIRECT` count.

## MySQL integration fixture investigation

The Phase 11C failure was reproduced first with the exact target test:

`creates one quota for concurrent non-overlapping requests with different keys`

The failure occurred before quota persistence in:

`app/api/leave/request/route.ts` → `buildLeaveAuthorizationContext` →
`modules/leave/application/authorization.ts::parseUserRole`.

The production boundary receives `auth.user` with `id`, `role`, `email` and
`name` from `lib/auth/server.ts` / `lib/auth/workforce.ts`. The failing fixture
provided `role` only under `session.user`, while the route consumed the
top-level `user` object. A second current integration fixture already used the
correct top-level role shape, confirming this was stale fixture residue rather
than a production role-contract mismatch, database default, concurrency issue,
or Vitest interference.

The fixture was corrected only. `parseUserRole` was not weakened, production
role shapes were not broadened, and workforce authorization was not bypassed.
The focused test passed after the correction, and the full MySQL integration
suite then passed all 16 files and 104 tests.

## Final authorization architecture state

The following current server surfaces remain centralized through the
authorization contract, with domain predicates and workflow invariants kept in
their owning modules:

- Employee server operations under `/api/employees/**`, including the
  documented broad-read/export compatibility floor.
- Department server access under `/api/departments`.
- Routine task/occurrence/import authorization for the migrated work-item
  surface in Dashboard and LIFF channels. Summary/reference/export remain
  deferred, and the exact work-item compatibility bridge remains active.
- Stock catalog, inventory, request and report operations through the Stock
  adapter and central resolver, with Stock relationship and compatibility
  floors preserved.
- Leave registered request, approval, cancellation and related migrated
  capability operations through the Leave adapter and central resolver, while
  report/export, participant/detail, attachment and recovery rules retain
  their documented domain/deferred ownership.
- Audit read access through the Audit adapter and `audit.read`; audit
  export-event recording remains a separate operation.
- Notification inbox/read/update operations through the Notification adapter,
  with actor-derived ownership and compatibility behavior preserved.
- Authorization Administration read/write configuration boundaries with
  trusted ADMIN bootstrap authority, code-owned capability readiness and
  central resolver effective-permission views. This does not mean that future
  Team resource policy is active.
- Dashboard and LIFF presentation projections for migrated surfaces use their
  fixed channel boundaries and are not treated as server enforcement.

Email Request and the four deferred policy families above are not included in
the migrated-centralized claim.

## Locked architectural invariants re-confirmed

- ADMIN remains the highest system authorization authority.
- ADMIN does not bypass authentication.
- ADMIN does not bypass lifecycle requirements.
- ADMIN does not bypass domain or workflow invariants.
- Normal USER authorization remains additive and default-deny.
- Team is not Department.
- TeamRole names do not intrinsically grant authority.
- Direct User grants remain exceptional additive grants.
- The capability registry remains code-owned.
- Database configuration cannot invent arbitrary capabilities.
- Team-origin scope requires an explicit trusted origin.
- UI visibility is not security enforcement.
- The server remains authoritative.
- Domain modules own resource predicates and business invariants.
- Dashboard and LIFF preserve their channel boundaries.

The final repository-wide review found no newly introduced or unclassified
server-side authorization bypass in Employee, Department, Routine, Stock,
Leave, Audit, Notification, Authorization Administration, Dashboard API routes
or LIFF routes.

## Verification

The runtime and fixture checks below were run after the code/fixture changes;
the documentation changes were then applied and `git diff --check` was run
again.

| Command | Result |
| --- | --- |
| `npm.cmd run architecture:check` | **PASS** — checked 1121 repository source files for module boundaries. |
| `npm.cmd run lint:strict` | **PASS** — zero warnings/errors. |
| `npm.cmd run typecheck` | **PASS** — `tsc --noEmit` completed successfully. |
| `npm.cmd run test:run -- modules/stock/application/authorization.test.ts` | **PASS** — 1 file, 21 tests. |
| `npm.cmd run test:run` | **PASS** — 316 files, 2786 tests. |
| `npm.cmd run test:integration:mysql` | **PASS** — Prisma migrations: 67 found, no pending; 16 files, 104 tests. |
| `git diff --check` | **PASS** — no whitespace errors. Windows emitted only the normal LF/CRLF working-copy warning. |

The initially reproduced MySQL target test failed with the stale fixture;
the same focused test passed after adding the missing top-level role, and the
subsequent full integration run passed.

## Final Phase 11 conclusion

Phase 11A, 11B, 11C and 11D are complete. The current authorization
architecture can be considered closed for the approved policy recorded in the
repository: migrated server authority is centralized, compatibility and domain
boundaries are explicit, deferred policy is not silently activated, and the
remaining evidence limitations are documented rather than overstated.

This closure does not decide the four future policy families listed above and
does not begin a new phase.
