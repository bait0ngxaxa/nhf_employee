# Authorization Phase 11B.2 Closure

Status: **Closed**

Date: 2026-09-15

Baseline: `5f5ff5855c8e180d83e9158d82a42e54a5f68994` (`feat(architecture): enforce Routine browser boundaries`)

Phase 11A and Phase 11B.1 were already closed at this baseline. Phase 11B.2 adds trusted-actor provenance regression coverage and does not redesign the authorization model.

## Outcome

The production actor-construction paths reviewed in this phase derive caller authority from trusted server authentication, workforce state, or verified LIFF state. The central authorization resolver remains transport-agnostic and receives an `AuthorizationActor` plus a server-selected capability.

No production provenance bypass was found. No production authorization code was changed. The new coverage is test-only, with this closure document recording the inventory and evidence.

The enforced invariant is:

```text
untrusted request input
        -> route / validation
        -> trusted authenticated identity
        -> server-derived authorization actor
        -> central authorization resolver
        -> capability + effective scope
        -> domain/resource policy
```

Request body, query parameters, route parameters, and ordinary headers may provide validated resource targets, filters, requested views, and transport metadata. They do not establish or replace actor identity, role, channel, capability, granted scopes, Team origin, administrator status, or an authorization decision.

## Actor and target separation

The caller actor is the trusted principal used for authorization:

```text
userId, employeeId, systemRole, channel, trusted grant/team resolution context
```

Target and resource data identifies what that principal is asking the server to inspect or mutate:

```text
target userId, target employeeId, teamId, teamRoleId, grantId,
taskId, requestId, assignee employeeId, approver employeeId, and filters
```

Target IDs remain usable. They are not copied into `AuthorizationActor`. In Authorization Administration, the authenticated administrator is the principal and request IDs are mutation targets.

## Trusted actor provenance inventory

The following inventory traces the production paths rather than relying on filenames or comments alone.

| Surface | Authentication source | Actor identity | Channel | Capability selection | Request-controlled data | Central entry |
| --- | --- | --- | --- | --- | --- | --- |
| Employee Dashboard | `requireApiSession()` -> server API cookie resolution -> `resolveAuthenticatedAccount()` and eligible-current-Employee gate | `buildUserContext()` supplies trusted user ID and role; Employee authorization/transaction paths use the trusted user and server-revalidated workforce state | Literal `DASHBOARD` | Route/application operation supplies a literal Employee capability | Search, status, pagination, target Employee IDs, and mutation data | Employee authorization context -> `AuthorizationResolver.resolve()` / transaction resolver |
| Department Dashboard | `requireApiSession()` | Trusted API `UserContext`; no request role or identity fields; employee context is not client-supplied | Literal `DASHBOARD` | Literal `department.read` | Department filters and target IDs | Department authorization context -> central resolver |
| Routine Dashboard | `requireActiveWorkforceOrAdminSession()`; server re-reads User/Employee state | API session user ID/email/role plus server-derived current employee ID where required; `buildRoutineAuthorizationActor()` parses the trusted role | Fixed `DASHBOARD`; Dashboard command actor has no LIFF mode | Route operation supplies literal Routine capabilities such as `routine.occurrence.override` | Task/occurrence IDs, assignees, due dates, filters, and requested `mine`/`all` view | Routine authorization context -> resolver, with transaction-time re-resolution for mutations |
| Routine LIFF | Verified LIFF session cookie/JWT -> current User/Employee and current LineAccountLink revalidation via `requireLiffWorkforceSession()` | Revalidated server user and employee identity; `getLiffCapabilities()` supplies the fixed LIFF actor context | Fixed `LIFF_SELF_SERVICE` | LIFF route/application operation supplies the capability | Self-service task/occurrence targets and validated resource data | Routine LIFF authorization context -> central resolver |
| Stock Dashboard | Active workforce/admin server session | Trusted API user ID, persisted/server-derived role, and server-selected employee ID | Explicitly fixed `DASHBOARD` | Route supplies literal Stock capabilities | Item/request IDs, requester/processor targets, filters, and requested `scope` view | Stock authorization context -> resolver and transaction resolver |
| Stock LIFF | `requireLiffWorkforceSession()` | Revalidated LIFF User/Employee identity | Fixed `LIFF_SELF_SERVICE` | Fixed by the LIFF operation | Stock item/request targets and resource data; client scope cannot switch channel or actor | `liff-stock-auth` context -> central resolver |
| Leave Dashboard | Active workforce/admin server session | Trusted API user ID, server-derived employee ID, and persisted/server-revalidated role | Explicitly fixed `DASHBOARD` | Route/application operation supplies literal Leave capabilities | Leave request IDs, requester/approver/participant targets, filters, and resource data | Leave authorization context -> resolver and transaction resolver |
| Leave LIFF | Verified and revalidated LIFF workforce session | Server User/Employee/link identity only | Fixed `LIFF_SELF_SERVICE` | LIFF operation supplies the capability | Self-service Leave targets and validated request data | Leave LIFF authorization context -> central resolver |
| Audit Dashboard | `requireApiSession()` | Trusted API user/role used by the Audit authorization adapter | Literal `DASHBOARD` | Literal `audit.read` | Audit filters, including a legitimate `userId` log filter | Audit authorization context -> central resolver |
| Notification Dashboard | `requireApiSession()` | Service and authorization context use the authenticated API user ID; notification ownership is server-derived | Literal `DASHBOARD` | Literal `notification.inbox.read` / update capability | Notification IDs and presentation/update data; request user IDs do not select the inbox owner | Notification authorization context -> central resolver; service user ID comes from auth |
| Authorization Administration | `requireAdminSession()` -> `assertAuthorizationAdministrationAccess()` | Authenticated ADMIN session is the principal; mutation context preserves that principal and authenticated email | Server-side administration boundary; request cannot provide an actor channel | Route/application command selects the administration operation; grant/capability keys are validated targets/data | Target User, Team, TeamRole, grant, and role IDs/values | Administration access assertion and mutation service; same-transaction audit records principal plus target |

Across these paths, request/correlation IDs, trusted client IP, and User-Agent may be carried into audit or tracing metadata. They are not inputs to actor construction or capability selection. Team membership/origin, where applicable, is resolved from persisted authorization data; it is not taken from request Team fields.

## Central resolver boundary

`modules/authorization/application/resolver.ts` accepts only an `AuthorizationActor` and a capability (or a transaction-scoped equivalent). It does not accept `Request`, headers, query parameters, or request bodies. The evaluator derives administrator status from the actor's trusted `systemRole` and resolves user/team grants from server-side persistence. Invalid authorization configuration fails closed.

Adapters construct the actor before entering the resolver. They may apply the existing documented compatibility behavior only when the central result is `NO_APPLICABLE_GRANT`; this phase did not change compatibility floors or effective-scope policy. Transactional mutation paths re-read the current server identity and re-resolve authorization in the transaction where that behavior already exists.

## Existing coverage reused

The following coverage already existed before Phase 11B.2 and was treated as evidence rather than duplicated mechanically:

- `__tests__/auth/liff.test.ts` and `__tests__/lib/line-liff-session.test.ts` cover verified LIFF identity, current User/Employee state, Line account-link comparison, deleted/inactive identities, and relinking/mismatch failures.
- `__tests__/api/line-routine-routes.test.ts` and `__tests__/api/line-routine-self-service-routes.test.ts` cover Routine LIFF self-service identity, fixed mode/channel behavior, and forged employee/assignee/import data.
- `__tests__/api/line-stock-routes.test.ts` covers forged Stock LIFF scope and user identity, requester/processor separation, and the fixed LIFF actor.
- `__tests__/api/line-leave-routes.test.ts` covers forged Leave LIFF employee/user/role/admin/scope/capability/approver values and the fixed LIFF actor.
- `__tests__/api/authorization-administration.test.ts` and `__tests__/api/authorization-administration-mutations.test.ts` cover the authenticated administrator boundary, target IDs, server principal, and trusted transport metadata.
- `__tests__/api/notifications.test.ts` covers authenticated-user ownership despite request user IDs.
- Existing Employee, Department, Audit, Notification, Routine, Stock, Leave, resolver, and administration application tests cover exact actor values, literal capabilities, transaction-time identity revalidation, and grant evaluation.

## New and strengthened coverage

The following focused tests were added or strengthened:

| Test surface | Proven invariant |
| --- | --- |
| `__tests__/api/routines-occurrence-by-id.test.ts` | A Dashboard USER remains the trusted USER/Dashboard actor despite forged body values and spoofed authority-shaped headers; the route still uses the literal occurrence capability and preserves a legitimate assignee target. |
| `__tests__/api/stock-requests-routes.test.ts` | Stock create/process routes ignore forged actor, role, channel, scope, and capability values; Stock read keeps requested `scope=all` separate from the trusted actor and effective `OWN` grant. |
| `__tests__/api/leave-request.test.ts` | Dashboard Leave create passes the authenticated USER, server employee, USER role, Dashboard channel, and literal create capability to both central and transaction authorization paths while accepting only legitimate request data as targets. |
| `__tests__/api/employees-routes.test.ts` | Authority-shaped query values cannot promote a Dashboard USER or replace the Employee read actor; ordinary filters remain request-controlled. |
| `__tests__/api/audit-log-route.test.ts` | A valid audit `userId` query remains a log filter while forged role/admin/capability/scope/channel values do not alter the fixed Audit actor or capability. |
| `modules/routine/application/authorization.test.ts` | A requested Routine task view of `all` does not mint `ALL`; a persisted narrower grant remains the effective scope. |
| `modules/stock/application/authorization.test.ts` | A requested Stock view of `all` does not broaden a persisted `OWN` grant. |
| `__tests__/api/authorization-administration-mutations.test.ts` and `modules/authorization/application/administration-mutations.test.ts` | Administration mutation principal remains the authenticated ADMIN while requested User IDs remain targets; audit actor identity/email and target entity identity are asserted separately. |

Together with the reused LIFF, Routine, Stock, Leave, notification, administration, resolver, and adapter suites, this covers plausible request attempts using `userId`, `employeeId`, `role`, `systemRole`, `isAdmin`, `channel`, `capability`, `scopes`, `scope`, Team/target IDs, assignee/approver IDs, and authority-shaped headers. The tests assert actor/context values where practical, not only the final HTTP status.

## Required provenance conclusions

### USER cannot self-promote

Dashboard and application tests assert that a trusted USER actor remains `systemRole: "USER"` when request input contains `role=ADMIN`, `systemRole=ADMIN`, or `isAdmin=true`. The evaluator receives the server-derived role; administrator status is not calculated from request data.

### Capability is server-selected

Representative routes pass literal operation capabilities to their adapters/resolver calls. Forged `capability` values in body, query, or headers are ignored as authority. No generic request-field blacklist was added, because capability selection is structurally owned by route/application code.

### Requested scope is not granted scope

`mine`/`all` remains a legitimate requested view where supported. The new Routine and Stock application tests prove that a requested `all` view does not create `ALL`; effective scopes remain those returned by the central decision and existing approved compatibility behavior. Existing LIFF tests continue to prove self-service scope clamping.

### Channel is server-selected

Dashboard paths construct `DASHBOARD` actors. LIFF paths use the verified LIFF workforce chain and fixed `LIFF_SELF_SERVICE` contexts. Request body, query, route, and ordinary header values cannot switch either channel. Routine command actors receive LIFF mode only from the server-owned LIFF helper; Dashboard callers do not supply it.

### LIFF identity is revalidated server-side

The existing chain remains:

```text
verified LIFF session/JWT
    -> current server User + Employee
    -> current LineAccountLink comparison
    -> fixed LIFF actor
```

Client `userId`, `employeeId`, role, admin, and channel fields do not override that result. Existing LIFF tests cover the relevant failure semantics and were preserved.

### Administration principal and target remain distinct

Administration mutations use the authenticated ADMIN session as principal. Request User/Team/TeamRole/grant IDs and role values are validated mutation targets/data. The strengthened tests assert that the audit actor is the authenticated administrator while the audit target is the requested administration object.

### Transport metadata remains metadata

Request ID, correlation ID, User-Agent, and trusted client IP are retained only for tracing/audit context where supported. Spoofed identity/role/channel/capability headers do not enter actor construction or authorization decisions. Existing trusted-client-IP behavior is unchanged.

## Production and policy impact

- No real provenance bypass was discovered.
- No production authorization or authentication code was changed.
- No schema, persistence, transaction, Team policy, compatibility floor, deferred capability, or lifecycle behavior was changed.
- `authorization-current-state.md` was not updated because actual production behavior did not change.
- No Team grants were seeded, no DENY/wildcard/ABAC/policy DSL was introduced, and no deferred Routine or Leave surface was activated.

The existing distinction between generic authenticated account identity and the legacy API eligible-current-Employee requirement remains intact.

## Verification

Focused regression suite executed after the test changes:

```text
npm.cmd run test:run -- __tests__/api/routines-occurrence-by-id.test.ts __tests__/api/stock-requests-routes.test.ts __tests__/api/leave-request.test.ts __tests__/api/employees-routes.test.ts __tests__/api/audit-log-route.test.ts modules/routine/application/authorization.test.ts modules/stock/application/authorization.test.ts modules/authorization/application/administration-mutations.test.ts __tests__/api/authorization-administration-mutations.test.ts
```

Result: **9 test files passed, 166 tests passed.**

The required repository checks completed as follows:

```text
npm.cmd run architecture:check  -> passed (1118 source files checked)
npm.cmd run lint:strict          -> passed (0 warnings/errors)
npm.cmd run typecheck            -> passed
npm.cmd run test:run             -> passed (313 test files, 2745 tests)
git diff --check                 -> passed (no whitespace errors)
```

## Remaining work for Phase 11B.3

Phase 11B.3 should remain a separate phase. Recommended scope is deeper lifecycle, concurrency, and policy-semantic coverage without weakening the provenance boundary:

- transaction and lifecycle race coverage for current User/Employee revalidation and revocation;
- detailed resource semantics for `OWN`, `CREATED`, `ASSIGNED`, `TEAM`, and `ALL` across migrated capabilities;
- critical mutation integration coverage, including transaction failure/rollback behavior;
- review of the existing high-risk compatibility behavior, especially Routine work-item `scope=all`;
- Stock image-upload preflight/file-write race coverage;
- remaining deferred/frozen surface review only as explicitly authorized by Phase 11B.3.

Phase 11B.3 must not activate deferred policy or change the trusted actor provenance invariant established here.
