# Authorization Phase 10C — Authorization Administration Operator UI

สถานะ: **Implementation complete; pending Phase 10D security/behavior re-audit**  
วันที่: 2026-09-14

Phase 10C adds the operator-facing Authorization Administration workspace over
the closed Phase 10A read model and Phase 10B audited mutation boundary. It is
an administration presentation surface, not a new authorization policy.

## UI boundary and composition

`app/dashboard/authorization/page.tsx` remains a server page. It calls
`requireDashboardAuthorizationAdministration()` before reading the initial
overview and renders the browser-safe
`modules/authorization/client.ts` entry. Browser components live under
`modules/authorization/presentation/dashboard/**` and do not import Prisma,
authorization persistence repositories, server session helpers, audit
infrastructure, or mutation implementations.

The client presentation is split into a focused API adapter, data hooks, status
and error display helpers, dialogs, and sections for Teams, Users & Access,
TeamRoles/members, grants, and the Capability Registry. The adapter is the only
place where the browser constructs Authorization Administration API requests.
The server route and API guards remain authoritative even when the browser has
stale state or a user manually calls an endpoint.

## Navigation

`authorization-administration` is a stable Dashboard menu ID mapped by the
route SSOT to `/dashboard/authorization`. It appears in `การจัดการระบบ` with
the existing Dashboard menu filtering mechanism and `requiredRole: "ADMIN"`.
ADMIN sees the menu item; USER does not. This is presentation-only filtering;
direct route access still uses the server guard.

## Team workflows

The Overview section preserves the Phase 10A summary of registered
capabilities, ordinary grantability, policy activation requirements, deferred
capabilities, and active/total Teams. It supports bounded client-side Team
search, Active/Inactive/All filtering, detail selection, and Team creation.

Team creation collects `key`, `name`, and optional `description`. `key` is
described as a stable technical identifier and is never editable after
creation. The UI waits for the server response, closes the dialog, shows a
success message, refreshes the overview, and selects the created Team.

Team detail shows identity, lifecycle, counts, configuration issues, and
metadata. Name and description can be updated; key cannot. Disable/re-enable
uses confirmation. Disabling a Team does not delete memberships, roles, or
grants: they remain inspectable while effective Team authorization becomes
inactive. There is no hard-delete control.

Persisted configuration issues are displayed prominently with source, code,
capability, scope, and relevant entity context. Invalid rows are not hidden,
normalized, repaired, or described as healthy. Harmless metadata edits are not
globally disabled merely because an unrelated grant is invalid; the existing
server command decides whether a mutation can proceed.

## TeamRole and membership workflows

TeamRole management is scoped to the selected Team. The UI displays key, name,
lifecycle, membership count, and grant count; it supports create, rename, and
disable/re-enable. TeamRole keys cannot be edited, roles cannot be moved to a
different Team, and there is no hard delete. The UI explains that names such as
HEAD or MANAGER have no authority without grants.

Team members show display name, email, User ID, account lifecycle, employee
lifecycle, and TeamRole. The bounded User directory removes the need to know a
numeric ID manually. Adding a member optionally selects a TeamRole from the
selected Team only; inactive roles remain visible but cannot be newly selected.
No default role or workforce relationship inference is performed. Role changes
are explicit, and removal is confirmed with wording that distinguishes
removing membership from deleting a User.

Inactive and deleted/unavailable accounts remain visible for historical
configuration inspection. Selecting one shows that configuration does not
bypass runtime account or employee lifecycle checks.

## Grant workflows and readiness

Team, TeamRole, and direct User grants use exact additive operations: one
capability plus one scope per server request. There is no replace-all matrix,
delete-all/recreate algorithm, client-side bulk diff, wildcard, or explicit
DENY UI. Team grants and TeamRole grants are presented as separate sections.
Direct User grants are under `User Exceptions` and are described as exceptional
additive configuration; `TEAM` scope is not offered for a direct User grant.

Capability choices and supported scopes come from the Phase 10A server catalog.
The presentation uses `administrativelyGrantable === true` as its editable
condition, while the Phase 10B server readiness gate remains authoritative.
The catalog remains visible with the exact readiness vocabulary:

| Readiness | Presentation behavior |
| --- | --- |
| `GRANTABLE` | normal add/remove controls |
| `POLICY_ACTIVATION_REQUIRED` | visible warning; ordinary mutation option disabled |
| `DEFERRED` | visible neutral unavailable state; ordinary mutation option disabled |

If a stale browser receives `CAPABILITY_POLICY_ACTIVATION_REQUIRED`,
`CAPABILITY_DEFERRED`, or `INVALID_AUTHORIZATION_CONFIGURATION`, the response
is shown as a stable Thai error and the relevant read model is refreshed. The
UI never turns a rejected command into local success.

## User directory and User Exceptions

`GET /api/authorization/administration/users?query=...` is an ADMIN-only,
bounded read contract owned by the Authorization Administration application
and repository boundary. It searches safe identity fields (User ID, name,
email, and available employee name fields), orders deterministically, and
returns at most 25 results. The projection includes lifecycle information but
never credentials, password-reset values, refresh/session tokens, or other
secrets.

Selecting a directory result loads the existing Phase 10A User detail model.
The User panel shows identity, system role, account and employee lifecycle,
all Team memberships, persisted direct grants, and resolver output. Direct
User add/remove uses the Phase 10B exact grant commands and the same readiness
classification as Team grants. The UI does not duplicate membership mutation
logic in the User panel; memberships navigate back to Team workflow.

## Effective Access Inspector semantics

The inspector renders `resolverEffectivePermissions` and
`resolverEffectivePermissionStatus` as supplied by the server. It supports
Allowed/Denied/All and Domain filters and keeps denied results inspectable.
Each resolved row presents capability, domain, ALLOW/DENY, effective scopes,
resolver reason, runtime authorization mode, and distinct grant sources.

Sources are rendered as:

- `SYSTEM_ROLE` — `ADMIN` system role;
- `TEAM` — Team name and Team ID;
- `TEAM_ROLE` — TeamRole and owning Team;
- `USER` — Direct User Grant.

Where supplied, `constraint.teamId` remains visible. The page explicitly calls
the result central-resolver output and explains that it is not a universal
final runtime decision. For `CENTRAL_WITH_COMPATIBILITY`, it warns that a
domain adapter may still allow an operation under migration compatibility
policy when the resolver returns `NO_APPLICABLE_GRANT`. It does not calculate a
fake domain decision or duplicate Routine, Leave, Stock, Employee, or other
domain policy in React.

`INVALID_CONFIGURATION` is a prominent error state with the safe server error
code/context. It is never shown as a normal ALLOW or DENY result.

## API SSOT and DELETE body handling

`API_ROUTES.authorizationAdministration` owns builders for overview, bounded
User search, Team/User detail, TeamRoles, members, Team grants, TeamRole grants,
and User grants. The presentation adapter wraps `apiGet`, `apiPost`,
`apiPatch`, and `apiRequest` and maps stable server error codes to Thai
feedback while retaining the shared request ID.

The shared `apiDelete()` helper does not accept JSON data. Exact grant DELETE
operations therefore deliberately call `apiRequest()` with:

```json
{
  "capabilityKey": "...",
  "scope": "..."
}
```

The adapter regression tests assert the exact body for Team, TeamRole, and
direct User grant removal. The Phase 10B endpoints remain body-based; no
query-string workaround was introduced.

## Loading, mutation, and revalidation strategy

The server-provided overview avoids an empty first render. SWR manages fresh
overview, selected Team, selected User, and bounded User-directory reads.
Detail data is fetched only after selection; resolver results are not loaded
for every User. Forms use local busy state, disable only the relevant controls,
wait for server confirmation, and then revalidate affected overview/detail
keys. There is no optimistic authorization state. Conflicts, not-found
responses, no-op updates, stale readiness, and network failures remain visible
and do not fabricate success. Empty, loading, error, and invalid-configuration
states are intentional for each surface.

Dialogs use the existing `AsyncFormDialog` and `AlertDialog` primitives. Dirty
forms request discard confirmation, and lifecycle, membership removal, and
grant removal use explicit confirmation where the action is security-sensitive.

## Accessibility and responsive behavior

Form labels are connected to controls, dialogs have titles/descriptions, icon
buttons have accessible labels, busy states use `aria-busy`, tables have
captions and scoped headers, and status is conveyed with text as well as color.
Tables scroll horizontally only when their columns require it; detail panels,
filters, dialogs, and action groups stack on smaller widths. The page keeps
the existing NHFapp surface, border, typography, and status token language.

## Explicitly unchanged

Phase 10C does **not**:

- activate compatibility-backed Team policies;
- retire compatibility floors;
- change capability readiness classification;
- seed Teams, TeamRoles, memberships, or grants;
- map Department to Team or infer TeamRole from manager, position, Department,
  or employee status;
- add delegated `authorization.manage` or `authorization.admin` semantics;
- add explicit DENY, wildcard permissions, ABAC, policy DSL, role inheritance,
  nested Teams, hard delete, or UI-specific schema columns;
- create a second Authorization audit persistence/query system;
- make the browser UI an authorization boundary;
- begin Phase 10D.

## Tests and handoff

The Phase 10C test surface covers Dashboard menu/route identity, the bounded
User directory application/repository/API contract, API adapter URL and exact
DELETE bodies, Team filtering and creation presentation, Team key immutability,
configuration issue visibility, Team lifecycle confirmation, User selection and
lifecycle presentation, readiness controls, User Exception and Effective
Access semantics, source/origin explanation, Team constraints, compatibility
warning, and invalid resolver state. Existing Phase 10A/10B route,
application, mutation, audit, and direct API security tests remain part of the
verification set.

Verification on 2026-09-14: the focused Phase 10A/10B/10C run passed 13 test
files and 104 tests. The full repository unit run passed 313 test files and
2,708 tests. `npm.cmd run check` passed architecture, strict lint, typecheck,
and the same full unit suite. The targeted MySQL Authorization Administration,
authorization persistence, and resolver integration run passed 3 files and 16
tests. The complete MySQL integration runner applied migrations successfully
and passed 15 of 16 files (100 of 101 tests); its one failure is the unrelated
Leave quota concurrency test at
`__tests__/integration/leave-quota-concurrency.integration.test.ts`, where
Leave authorization rejects the fixture before quota creation. No Phase 10C
file or Leave behavior was changed for that failure.

Phase 10D must perform the final security/behavior re-audit across the Phase
10A read model, Phase 10B audited mutation boundary, and this Phase 10C
operator flow. Phase 10C should not be marked CLOSED until that re-audit and
the repository verification commands establish that the UI cannot bypass
server authority, lose exact DELETE payloads, or misrepresent resolver output
as final runtime authorization.
