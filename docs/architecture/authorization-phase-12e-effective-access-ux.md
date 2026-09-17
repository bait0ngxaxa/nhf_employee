# Phase 12E — Authorization Administration Effective-Access UX

สถานะ: **CLOSED**  
Starting commit: `3b6b8ac635b6121ca712b3a88d71a5837e3a7962`  
วันที่ปิด phase: 2026-09-17

## Problem and outcome

Before Phase 12E, the Authorization Administration User inspector exposed
the central resolver's configured-authority result as
`resolverEffectivePermissions`. That result is intentionally retained, but it
is not the complete capability authority for a normal `USER`: a valid
`NO_APPLICABLE_GRANT` result can coexist with a permanent domain-owned Default
Domain Policy.

The User detail read model now exposes two deliberately separate views:

```text
Default Domain Policy
+ Additional / Resolver authority
= Effective capability authority
```

The Effective result is a capability-layer inspection only. It is not a
resource-instance or workflow decision. Resource/relationship policy and
business invariants still participate in the final operation decision.

## Effective-access architecture

`modules/authorization` owns the structural Administration contract and the
generic projection of a domain inspection. It does not import Department,
Notification, Employee, Routine, Stock, Leave, or Audit policy. The structural
`AuthorizationAdministrationEffectiveAccessProvider` port is defined beside
the consuming Administration read model.

The outer composition provider at
`app/api/authorization/administration/_lib/effective-access.ts` binds the
domain inspectors through their public module entries. The provider receives a
trusted server-created actor, the already batched Dashboard resolver decisions,
and the resolver for the bounded LIFF batch. It returns domain inspection rows
to the generic Administration projector. No new persistence table, policy
registry, or authorization engine was introduced.

Each migrated domain inspector reuses its runtime default-policy function and
`composeAuthorizationAuthority()` seam. The Administration projector does not
perform a second scope union; it preserves the provider's composed result and
maps configured grants through the existing resolver provenance projection.

## Default, Additional, and Effective semantics

- **Default** is code-owned policy supplied by the owning domain for the
  selected trusted actor/context. Normal `USER` defaults are permanent Phase
  12 policy. `ADMIN` defaults are empty.
- **Additional** is configured/system authority returned by the central
  resolver: `SYSTEM_ROLE`, `TEAM`, `TEAM_ROLE`, or direct `USER`. A normal user
  with no applicable grant therefore shows `Additional = none`, even when the
  raw resolver reason is `NO_APPLICABLE_GRANT`.
- **Effective** is the domain composition result after the domain's channel
  policy. It is shown with `AVAILABLE`, `UNAVAILABLE`, `UNSUPPORTED`, or
  `DEFERRED` state and must not be read as unconditional access to every
  resource.

The read model retains `resolverEffectivePermissionStatus` and
`resolverEffectivePermissions` unchanged in meaning. They remain the raw
central-resolver evidence and preserve reason, configured grants, source,
origin, Team constraint, runtime mode, administrative status, and registry
channel/scope metadata through the existing catalog/projection.

Configured authority that does not expand the normalized pre-channel
composition is marked `redundant` for operator understanding. It remains valid,
visible, and removable through the existing mutation workflow; Phase 12E does
not clean it up automatically.

## Inspection contexts and execution channels

Contexts are stable, code-owned runtime intents. They are not browser-supplied
scopes and cannot grant authority by themselves. The provider only emits real
contexts from the registered channels `DASHBOARD` and `LIFF_SELF_SERVICE`.
There is no invented API channel and no full capability/channel/options matrix.

Routine is explicitly context-sensitive:

- `routine.task.read`: Dashboard Management, Dashboard Work items — Mine,
  Dashboard Work items — All, and LIFF Self service; the default scopes remain
  `CREATED + ASSIGNED`, `ASSIGNED`, `ALL`, and the domain's LIFF policy.
- `routine.summary.read`: Dashboard Mine, Dashboard All, and LIFF Self
  service.
- `routine.reference.read`: Dashboard and LIFF Self service.
- `routine.task.export`: Dashboard is inspectable; LIFF is explicitly
  `UNSUPPORTED` because the registry does not support that channel.

Stock keeps its intentional LIFF processor semantics. It does not receive the
Routine self-service ADMIN clamp. Leave's Dashboard-only
`leave.cancellation.decide` is absent from the LIFF inspection rather than
being represented as an ordinary no-grant denial.

Email Request remains outside migrated effective policy. The two registered
capabilities, `email.request.read` and `email.request.create`, are shown as
`DEFERRED` with no fabricated Default or Additional authority.

## ADMIN, lifecycle, and domain limitations

For a selected `ADMIN`, Default is empty and Additional identifies the central
`SYSTEM_ROLE / ADMIN` grant. `ALL` is never used as an ADMIN detector; a
normal user may receive `ALL` without becoming a system administrator.

The identity panel and inspector state that inactive/deleted accounts and
ineligible/deleted Employees remain subject to lifecycle checks. Configuration
is not erased merely because the account is inactive.

Every effective row may carry concise domain-owned limitations. Examples are
ownership for `OWN`, assignment/current approver checks for `ASSIGNED`, Team
constraints for `TEAM`, Leave workflow/approver/state checks, Stock request
state/inventory/concurrency checks, Routine creator/assignee/resource checks,
and LIFF data minimization. The inspector does not simulate concrete resources.

TEAM grants preserve `constraint.teamId` and originating Team. TEAM_ROLE grants
preserve both Team and TeamRole origin. Direct USER and SYSTEM_ROLE origins are
shown separately. Default policy has no fake persisted grant origin.

## Failure behavior and refresh behavior

Raw resolver configuration errors remain fail-closed as
`INVALID_CONFIGURATION`. The effective projection is empty and does not add
Default authority on top of malformed persisted capabilities, unsupported
scopes, Team-origin mismatches, membership mismatches, or other
`AuthorizationConfigurationError` failures.

The existing atomic Team, TeamRole, membership, and direct User grant commands
remain unchanged. After a direct User grant is added or removed,
`UserAccessPanel` revalidates the bounded User detail read model, so Default
stays visible while Additional and Effective are recomputed immediately.
Redundant grants remain inspectable rather than being rejected or deleted.

## UI information hierarchy

The existing Authorization Administration visual language is preserved. The
inspector uses a stacked responsive layout with accessible labels, native
filters, keyboard-focus styles, progressive disclosure for raw resolver
provenance, and compact server-derived summary counts. Operators can filter by
domain and effective state. Each row presents Capability, domain/context/
channel, Default, Additional, Effective, and domain limitations without
requiring primary horizontal scrolling.

The raw resolver section remains available under advanced disclosure, so the
operator can distinguish:

```text
Default policy
Configured/System resolver authority
Effective composed authority
```

The screen explicitly states that Effective capability authority does not by
itself decide resource ownership, relationships, workflow, or lifecycle
eligibility.

## Verification

Focused checks cover the Administration application projection, raw/effective
configuration failures, Default-backed no-grant users, broader and redundant
grants, source/origin/Team constraints, domain inspectors, Routine contexts,
Stock LIFF processor behavior, Leave channel boundaries, Audit central-only
behavior, Email deferral, UserAccessPanel meaning/filter states, invalid
configuration, and direct-grant add/remove refresh calls.

The full repository checks for this closure are recorded in the completion
report and include architecture, strict lint, typecheck, the full Vitest run,
and `git diff --check`.

## Remaining limitations and next phase

Phase 12E does not change production authorization outcomes, add scopes or
capabilities, migrate Email Request, create grants, seed Teams, add schema or
cache layers, or simulate concrete resources. Domain workflow and
resource-instance decisions remain owned by their domains and runtime paths.

The exact next phase is:

**Phase 12F — Full Authorization Regression / Security Matrix**

Phase 12F is not started by this closure.
