# Authorization Phase 12H-D — Missing / Deferred Business Capability Completion

Status: **COMPLETE**

Baseline: `2380d23e867d2d4a124bce8623dd06003c789da2`

Phase 12H-C was accepted and closed before this implementation. This phase
completes the missing business capabilities approved by the role-neutral
contract without performing the later production grant-preparation or
enforcement-cutover phases.

## Outcome

The current registered capability inventory is:

| Category | Count |
| --- | ---: |
| Total capabilities | 41 |
| `CENTRAL_WITH_DEFAULT_POLICY` | 25 |
| `CENTRAL_ONLY` | 16 |
| `CENTRAL_WITH_COMPATIBILITY` | 0 |
| `DEFERRED` | 0 |
| `GRANTABLE` | 41 |
| `POLICY_ACTIVATION_REQUIRED` | 0 |
| `DEFERRED` readiness | 0 |

The role-neutral configured core remains implemented and the domain defaults
remain rebaselined. The production `authorization` singleton has **not** been
switched to the role-neutral resolver. `SYSTEM_ROLE` support and
`composeLegacyAdminCompatibleAuthorizationAuthority()` remain active so the
current Dashboard ADMIN compatibility behavior continues during the
transition.

## Leave recovery capability

`leave.recovery.manage` is registered with this contract:

| Property | Value |
| --- | --- |
| Domain | `leave` |
| Supported scopes | `ALL` only |
| Supported channels | `DASHBOARD` only |
| Runtime mode | `CENTRAL_ONLY` |
| Default Domain Policy | none |
| Administration | grantable |

The capability authorizes entry to a Leave recovery path. It does not grant
normal approval, ownership, assigned-approver relationship authority, or a
workflow bypass. Recovery continues to require the applicable Leave-owned
conditions: Dashboard channel, authenticated active workforce context, owner
exclusion, unavailable effective approver, valid workflow state, cancellation
date or not-taken timing/state rules, recovery reason, quota correctness,
transactional row locks and revalidation, optimistic/concurrent claim
protection, notification, audit, and idempotent/current-action behavior.

Normal cancellation continues to use
`leave.cancellation.decide / ASSIGNED` plus the effective approver
relationship. Normal not-taken behavior continues to use owner `OWN` or
assigned approver `ASSIGNED` as appropriate. Recovery uses
`leave.recovery.manage / ALL` plus the recovery-domain conditions; it does not
infer permission from `leave.cancellation.decide` or
`leave.request.not_taken / ASSIGNED`.

An unavailable effective approver does not abort owner-side initiation. If the
resolver returns `null`, an owner-authorized not-taken request remains in the
canonical `APPROVED` + `notTakenRequestedAt` pending state, and an
owner-authorized approved cancellation transitions to
`CANCELLATION_REQUESTED`. Both keep `exceptionApproverId` unset/null and remain
visible to the canonical recovery-candidate query. No ADMIN or other
role-derived approver is manufactured. Employee-facing notification and audit
records are preserved, while approver-targeted outbox delivery is omitted when
there is no valid approver recipient. The later decision still requires
`leave.recovery.manage / ALL` and all existing recovery invariants.

The recovery decision is derived from the explicit capability decision rather
than `actor.systemRole === "ADMIN"`. The actor role may still be recorded as
identity/provenance metadata. Historical audit fields such as `adminOverride`
remain where needed for persisted compatibility, but their value now reflects
the actual explicit recovery decision.

The recovery list route keeps its existing Dashboard ADMIN compatibility gate
for now. It additionally asserts `leave.recovery.manage / ALL` at the
authoritative server boundary. The canonical recovery-candidate query remains
restricted to unavailable effective approvers, excludes the owner and
applicable current-actor assignments, and preserves the required workflow
state. Phase 12H-F owns removal/replacement of the remaining route and
presentation role gate.

## Exception approver resolution

Leave no longer searches active Employees whose User has `role = ADMIN` as an
exception-approver fallback. The approved resolution order is:

1. reusable active existing exception approver;
2. active original approver;
3. active current manager relationship;
4. `null` when no valid relationship exists.

Locking, re-read behavior, assignment generations, persistence semantics,
stale/inactive handling, effective-approver precedence, and notification
deduplication remain unchanged. If no approved relationship is available, the
owner request remains pending in the unavailable-approver condition and must
use the explicit recovery path; the resolver never selects an ADMIN merely by
role.

## Email Request migration

The two formerly deferred capabilities are now centralized and grantable:

| Capability | Supported scopes | Channel | Runtime mode | Default scopes |
| --- | --- | --- | --- | --- |
| `email.request.read` | `OWN`, `ALL` | `DASHBOARD` | `CENTRAL_ONLY` | none |
| `email.request.create` | `ALL` | `DASHBOARD` | `CENTRAL_ONLY` | none |

The Email Request authorization adapter uses the existing production
authorization singleton and legacy compatibility composition. It constructs
the actor from trusted authenticated server state, fixes the channel to
Dashboard, resolves only these registered capabilities, exposes effective
scopes, and propagates structural/configuration failures. Request body/query
fields cannot provide the actor, role, channel, capability, or scopes.

For `GET /api/email-request`, `OWN` becomes
`where.requestedBy = authenticated actor userId`; `ALL` selects the broad
authorized query. `ALL` subsumes `OWN`. Authorization is resolved before the
EmailRequest query, and pagination/filter validation remains a query concern.

For `POST /api/email-request`, normal API authentication is followed by
`email.request.create / ALL` before Idempotency-Key handling, validation,
transaction creation, persistence, idempotency state, outbox work, or audit
creation. The authenticated user remains `requestedBy`; an `ALL` grant does
not change record ownership. Existing validation, serializable transaction,
replay/conflict behavior, response shape, audit, and outbox behavior remain
unchanged.

Email Request Dashboard menu/page role visibility is intentionally not migrated
in this phase. A configured non-ADMIN user may therefore have valid server
authority while the legacy Dashboard does not yet expose the menu. Server
authorization remains authoritative. The presentation and remaining route-role
migration is scheduled for Phase 12H-F.

## Authorization Administration

The catalog, grant mutations, registry presentation metadata, and effective
access inspection now represent Leave recovery and Email Request as real
central capabilities. No default authority is fabricated. Email inspection
shows the actual central resolver result with `defaultScopes: []`; configured
`OWN`/`ALL` is shown when present, otherwise the state is `UNAVAILABLE`.
Leave recovery is similarly visible as a grantable Dashboard-only capability.

Existing Team/direct-User origin validation, deterministic catalog ordering,
and ordinary Administration grant commands remain unchanged. No production
Team, TeamRole, membership, grant seed/backfill, schema change, or migration
was added for Phase 12H-D.

## Intentionally deferred work

This phase does not perform:

- the Phase 12H-E production Team/grant preparation and effective-access
  reconciliation;
- broad Dashboard/menu/tab presentation migration;
- removal of the recovery list route's legacy ADMIN gate;
- migration of all remaining route role authority or Routine presentation
  semantics;
- removal of the legacy ADMIN compatibility seam or `SYSTEM_ROLE` support;
- production role-neutral resolver enforcement cutover;
- rollout validation or compatibility-debt deletion.

The next phase is **Phase 12H-E — Production Team/grant preparation and
effective-access reconciliation**. Later lifecycle ownership remains:
12H-F presentation and remaining route role-authority removal, 12H-G
production enforcement cutover, 12H-H rollout validation, and 12H-I deletion
of compatibility/system-role business-authority debt.

## Verification evidence

The final focused authorization/business-capability run passed:

```text
45 test files passed
442 tests passed
```

It covered the registry and Administration catalog/mutations/effective access,
resolver/evaluator/composition, Leave authorization/recovery/cancellation/
not-taken/exception-approver/current-action paths, the recovery route, Email
Request authorization/query/mutation/API paths, and Email Request idempotency
integration coverage.

The broader repository suite also passed:

```text
326 test files passed
3,071 tests passed
```

Additional checks passed:

- `npm.cmd run typecheck`
- `npm.cmd run lint:strict`
- `npm.cmd run architecture:check` — 1,147 source files checked
- `git diff --check`

No development server or production build was run. No production grant seed,
backfill, migration, or authorization cutover was performed.
