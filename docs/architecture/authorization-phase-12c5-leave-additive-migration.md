# Authorization Phase 12C.5 — Leave additive default policy migration

สถานะ: CLOSED

วันที่: 2026-09-17

## 1. Phase boundary and starting point

This phase starts from commit `c43cbd8fd325a8d77341b53ff2d3ab22a5dbaa57`
(`feat(auth): migrate stock to additive default policy`). Phase 12A, 12B,
12C.1, 12C.2, 12C.3 and 12C.4 were closed at this boundary.

Phase 12C.5 migrates the complete eight-capability registered Leave surface.
It does not migrate deferred Routine surfaces, Email Request, future IT, or
unrelated authorization domains. Historical Phase 7/9/11 records remain
historical evidence and are not rewritten as if they had always used this
policy.

## 2. Permanent Leave Default Domain Policy

For an eligible normal `USER`, the permanent defaults are:

| Capability | Default scope | Registered channel |
|---|---|---|
| `leave.request.read` | `OWN` | Dashboard, LIFF |
| `leave.approval.read` | `ASSIGNED` | Dashboard, LIFF |
| `leave.request.create` | `OWN` | Dashboard, LIFF |
| `leave.request.cancel` | `OWN` | Dashboard, LIFF |
| `leave.request.approve` | `ASSIGNED` | Dashboard, LIFF |
| `leave.cancellation.decide` | `ASSIGNED` | Dashboard only |
| `leave.request.not_taken` | `OWN + ASSIGNED` | Dashboard, LIFF |
| `leave.approver.manage` | empty | Dashboard only |

For `ADMIN`, every Leave default is empty. ADMIN authority comes from the
central resolver's `SYSTEM_ROLE / ADMIN` decision. `leave.approver.manage`
remains `CENTRAL_ONLY` while remaining administratively grantable through the
existing generic grant commands.

## 3. Central composition and failure behavior

The Leave adapter builds a trusted `AuthorizationActor` from the authenticated
identity, trusted active Employee identity and execution channel. It then:

1. resolves configured/system authority with the central resolver;
2. obtains trusted `defaultLeaveScopes()` for the registered capability;
3. composes both through the Phase 12B `composeAuthorizationAuthority()`
   primitive; and
4. exposes resolver provenance, `defaultScopes`, and effective `scopes` to
   Leave resource/domain policy.

The adapter uses `LEAVE_CAPABILITIES`, `resolveLeaveCapability()` and
`assertLeaveCapability()` as permanent names. It does not manufacture a
`DEFAULT_POLICY` grant. Only a valid normal-USER `NO_APPLICABLE_GRANT` can be
composed with defaults. `UNKNOWN_CAPABILITY`, `CHANNEL_NOT_SUPPORTED`, invalid
persisted configuration, capability mismatch, registry failures and resolver
or persistence structural failures remain fail-closed.

Configured Team, TeamRole and direct User grants are an additive union. A
narrower configured grant cannot remove a default. A normal USER with explicit
`ALL` remains a normal USER; capability possession is not system
administration.

## 4. Leave-owned authorization invariants

`OWN` is derived from the trusted active Employee identity. Client-supplied
`employeeId`, `ownerId`, requester identity, role, or scope is not authority.
Existing ownership, state, date, quota, idempotency and workflow rules remain
Leave-owned.

`ASSIGNED` is only an authorization prerequisite. It is not proof that the
actor is assigned to a particular resource. Leave continues to use the
canonical effective approver predicate: `exceptionApproverId` when present,
otherwise `approverId`. The owner is excluded, an exception approver
supersedes the original approver, and unrelated employees cannot approve or
decide a request merely because `ASSIGNED` is present.

Approval keeps pending/current-action checks, action-version and stale-action
protection, quota/workflow rules, atomic claims and transaction-time checks.
Not-taken keeps its two independent meanings:

```text
OWN       -> employee requests the employee's own not-taken operation
ASSIGNED  -> effective approver confirms/decides it
```

These are not collapsed into one generic permission.

Dashboard Admin recovery remains a Leave-specific domain rule. It is not an
`ALL` shortcut, generic `ASSIGNED` bypass, approver-management authority, or
configured USER grant authority. The established account-only Dashboard Admin
approver-management lifecycle remains Employee-optional where documented, and
that exception is not broadened to other Leave operations.

## 5. Dashboard and LIFF behavior

`leave.cancellation.decide` remains registered as `ASSIGNED` on `DASHBOARD`
only. Dashboard receives the permanent `ASSIGNED` default for an eligible
normal USER. LIFF receives no default for this capability, and the registry
does not support the capability on `LIFF_SELF_SERVICE`.

No LIFF capability, Dashboard-as-LIFF bridge, or `CHANNEL_NOT_SUPPORTED`
fallback was added. The existing LIFF effective-approver cancellation path
remains Leave-domain-authorized/deferred. LIFF approval/self-service behavior
outside cancellation decision remains unchanged. LIFF does not gain Admin
recovery behavior.

## 6. Transaction-time authorization and concurrency

Phase 11 hardening remains in place. Protected Leave mutations continue to
lock/re-read the current User and required Employee, read the persisted role,
rebuild the trusted actor, resolve current capability authority through
`resolveInTransaction()`, and re-check effective approver/resource policy
inside the transaction.

Existing LeaveRequest row locks, serializable transactions, conditional and
atomic claims, action-version/state checks, quota reconciliation, audit,
outbox and notification behavior remain unchanged. If an additional
configured grant is revoked before transaction revalidation, the configured
authority disappears but the permanent normal-USER default remains; the
operation proceeds only when that default and the Leave relationship/business
rules still authorize it.

## 7. Presentation projection

`getLeavePresentationCapabilities()` continues to make one batched
`authorization.resolveMany()` call over the registered Leave capability list.
It now projects the same permanent additive composition path. For an eligible
normal USER with no configured grant on Dashboard, the expected eligibility is:

```text
canReadOwnRequests              true
canReadAssignedApprovals        true
canCreateOwnRequests            true
canCancelOwnRequests            true
canApproveAssignedRequests      true
canDecideAssignedCancellations  true
canRequestOwnNotTaken            true
canConfirmAssignedNotTaken       true
canManageApprovers               false
```

These fields remain operation eligibility only; they do not prove that an
actionable resource is currently assigned. On LIFF,
`canDecideAssignedCancellations` remains false/unavailable because the
capability is not registered for LIFF.

## 8. Authorization Administration catalog

The code-owned inventory remains 40 capabilities. After this phase:

| Runtime mode | Count |
|---|---:|
| `CENTRAL_WITH_DEFAULT_POLICY` | 22 |
| `CENTRAL_WITH_COMPATIBILITY` | 0 |
| `CENTRAL_ONLY` | 13 |
| `DEFERRED` | 5 |
| **Total** | **40** |

| Readiness | Count |
|---|---:|
| `GRANTABLE` | 35 |
| `POLICY_ACTIVATION_REQUIRED` | 0 |
| `DEFERRED` | 5 |
| **Total** | **40** |

Exactly these seven capabilities moved to
`CENTRAL_WITH_DEFAULT_POLICY` + `GRANTABLE`:

```text
leave.request.read
leave.approval.read
leave.request.create
leave.request.cancel
leave.request.approve
leave.cancellation.decide
leave.request.not_taken
```

`leave.approver.manage` remains `CENTRAL_ONLY` + `GRANTABLE`. Generic Team,
TeamRole and direct User grant commands now accept all seven migrated
capabilities. No Leave-specific grant endpoint, persistence, seed, backfill,
grant-data migration, Prisma authorization table, new scope, or new channel
was added.

## 9. Verification

Executed checks:

```text
npm.cmd run test:run -- --reporter=dot __tests__/api/leave-cancel.test.ts __tests__/api/leave-decision.test.ts __tests__/api/leave-not-taken.test.ts __tests__/api/leave-me.test.ts __tests__/api/leave-approvals.test.ts __tests__/api/leave-approvers.test.ts __tests__/api/leave-request.test.ts modules/leave/server/request-api.test.ts modules/leave/application/requests/request-reassignment-concurrency.test.ts
  -> 9 files, 107 tests passed

npm.cmd run test:run -- --reporter=dot
  -> 317 files, 2850 tests passed

npm.cmd run architecture:check
npm.cmd run lint:strict
npm.cmd run typecheck
git diff --check
```

The full suite emitted expected error-path and React test warnings but had no
failed tests or unhandled errors.

## 10. Remaining deferred boundaries and exact next phase

The intentional Leave boundary that remains deferred is LIFF cancellation
decision: its registry contract is Dashboard-only, while the existing LIFF
effective-approver path remains domain-owned. Leave report/export,
participant/detail, attachments, generic recovery, manager/direct-report
policy, and other non-generic Leave rules remain in the Leave domain and were
not promoted into the central resolver.

The exact next phase is **Phase 12D — remaining explicitly deferred non-IT
authorization surfaces**. Email Request and the future IT module remain
outside that phase boundary. Phase 12C.5 stops here and does not begin the
next phase.
