# Authorization Phase 12C.4 — Stock additive default policy migration

สถานะ: CLOSED

วันที่: 2026-09-17

## 1. Phase boundary and starting point

This phase starts from commit `25fe84446c0f3b3dd46b83f7b8b688f6791d8fd0`
(`feat(auth): migrate routine to additive default policy`). Phase 12A, 12B,
12C.1, 12C.2 and 12C.3 are closed. This phase migrates the complete
currently registered Stock authorization surface. Leave remains the next
phase, and Email Request, future IT, and deferred Routine capabilities remain
outside this change.

Historical Phase 0–11 closure records and the historical Stock migration
evidence are not rewritten.

## 2. Authorization contract and composition

Phase 12A locks existing no-grant normal-USER behavior as permanent Default
Domain Policy. Team, TeamRole and direct User grants are additional authority;
a narrower configured grant cannot remove a default scope.

Phase 12B supplies the pure application-layer primitive
`composeAuthorizationAuthority(actor, capability, defaultScopes,
configuredDecision)`. Stock now calls the central resolver and passes its
trusted default scopes through that primitive. The resolver remains the source
of configured grants and `SYSTEM_ROLE / ADMIN` authority. Stock does not
duplicate additive-union logic and does not create a fake `DEFAULT_POLICY`
grant.

Department + Notification (12C.1), Employee (12C.2), and enforced Routine
surfaces (12C.3) are the precedent for the permanent seam. Stock is now the
fourth migrated domain; Leave remains compatibility-backed until 12C.5.

For a normal USER, only a valid `NO_APPLICABLE_GRANT` decision can be composed
with defaults. `UNKNOWN_CAPABILITY`, `CHANNEL_NOT_SUPPORTED`, invalid
persisted configuration, capability mismatch, and other structural denials
remain fail-closed. ADMIN defaults are empty; ADMIN authority must come from
the central resolver.

The Stock result retains both sides of the composition:

```ts
interface StockCapabilityAuthorization {
    readonly actor: StockAuthorizationActor;
    readonly capability: StockCapability;
    readonly decision: AuthorizationDecision;
    readonly defaultScopes: readonly AuthorizationScope[];
    readonly scopes: readonly AuthorizationScope[];
    readonly isAdministrative: boolean;
}
```

`decision` preserves resolver provenance. `isAdministrative` is true only for
trusted Dashboard ADMIN actors with a central `SYSTEM_ROLE` grant. It is not
derived from `scopes.includes("ALL")`; a normal USER can receive resource ALL
through Team, TeamRole or direct User configuration without becoming system
ADMIN. LIFF USER ALL is also not administrative.

## 3. Complete registered Stock inventory

The code-owned registry is unchanged. All seven capabilities are registered,
runtime-enforced and grantable after this phase:

| Capability | Registered scopes | Registered channels |
|---|---|---|
| `stock.catalog.read` | `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` |
| `stock.inventory.manage` | `ALL` | `DASHBOARD` |
| `stock.request.read` | `OWN`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` |
| `stock.request.create` | `OWN` | `DASHBOARD`, `LIFF_SELF_SERVICE` |
| `stock.request.cancel` | `OWN`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` |
| `stock.request.process` | `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` |
| `stock.report.export` | `ALL` | `DASHBOARD` |

`stock.request.process` remains intentionally available in LIFF. No Routine-
style LIFF ADMIN clamp is applied. Inventory management and report export
remain Dashboard-only and a LIFF request is structurally denied.

## 4. Permanent Stock Default Domain Policy

For an eligible normal USER, `defaultStockScopes()` returns exactly:

| Capability | Default |
|---|---|
| `stock.catalog.read` | `ALL` |
| `stock.request.read` | `OWN` |
| `stock.request.create` | `OWN` |
| `stock.request.cancel` | `OWN` |
| `stock.inventory.manage` | empty |
| `stock.request.process` | empty |
| `stock.report.export` | empty |

For ADMIN, the Stock default is empty for every capability. A valid central
ADMIN decision preserves registered-scope semantics: capabilities supporting
`ALL` receive `SYSTEM_ROLE / ALL`; `stock.request.create` remains limited to
its registered `OWN` scope rather than manufacturing `ALL`.

Configured grants compose additively. Therefore these are valid, potentially
redundant configurations:

```text
stock.catalog.read:  default ALL + configured ALL = effective ALL
stock.request.create: default OWN + configured OWN = effective OWN
```

In contrast, `stock.request.read / ALL` and `stock.request.cancel / ALL`
expand a normal USER beyond the OWN baseline. No Stock capability is inferred
from Department, Team names, or unrelated role labels.

## 5. Requested scope is view intent

`StockCapabilityOptions.requestedScope` remains accepted for compatibility with
route callers, but it is not passed into default policy and cannot create
authority. A normal USER receives `stock.request.read / OWN` whether the route
requests `mine` or `all`. The same applies to `stock.request.cancel / OWN` when
the route requests `all`. Only a configured grant or central ADMIN decision
can contribute `ALL`.

This prevents cancellation routes, which intentionally request an `all`
authorization context, from turning query intent into cross-user authority.

## 6. Catalog and request reads

`stock.catalog.read / ALL` remains the baseline on both Dashboard and LIFF for
categories, item lists, item details and variant availability. Catalog query
semantics are unchanged: visibility is not restricted by Department, Team,
request ownership or manager hierarchy. A configured catalog ALL grant can be
administratively valid even though it is redundant with the baseline.

The existing authoritative route/domain boundary remains in place for:

```text
/api/stock/items
/api/stock/items/[id]
/api/stock/categories
/api/line/stock/items
/api/line/stock/categories
/api/line/stock/availability
```

No persistence-level catalog authorization was added.

Request list queries continue to separate authority from requested view:

```text
scope=mine + authority ALL -> requestedBy = actor.userId
scope=all  + authority OWN -> requestedBy = actor.userId
scope=all  + authority ALL -> no requestedBy ownership predicate
```

Search, status filters, pagination and requester search are unchanged. Request
detail keeps the same rule: OWN adds `requestedBy = actor.userId`; ALL may
retrieve any authorized request. An ordinary no-grant requester cannot read
another user's request.

## 7. Request creation

`stock.request.create` remains `OWN` for normal users and supports only OWN in
the registry. Explicit OWN grants are safe but may be redundant. The server
continues to derive `requestedBy` from the authenticated command actor and
never trusts an arbitrary client-supplied requester.

The serializable transaction, transaction-time authorization, idempotency key,
request hash matching, unique-key race recovery, input/item/variant
validation, audit, and notification behavior remain unchanged.

## 8. Cancellation

The normal USER cancellation baseline is `OWN`, including when the route asks
for `requestedScope: "all"`. A no-grant or OWN-only user can cancel only their
own `PENDING_ISSUE` request. A configured `stock.request.cancel / ALL` grant,
or ADMIN `SYSTEM_ROLE / ALL`, may cancel another user's pending request.

Authorization does not replace Stock business invariants. Cancellation still
requires request existence, `PENDING_ISSUE`, a conditional `updateMany` claim,
ownership when effective scope is not ALL, conflict handling, cancel reason,
`cancelledById`, `cancelledAt`, audit and in-app/email/LINE notifications.

Notification policy remains separate from authorization scope:

```text
ADMIN cancellation -> PROCESSOR semantics
USER own cancellation -> REQUESTER semantics
USER ALL cancelling another user's request -> PROCESSOR semantics
```

An explicit USER ALL grant cancelling their own request follows the existing
requester-vs-processor rule in the Stock workflow; wording is not derived
solely from the presence of ALL.

Transaction-time grant revocation is additive restoration, not blanket
denial. If a route-time USER cancel-all grant is removed before the transaction
resolver runs, effective authority becomes the baseline OWN: another user's
request is denied without a write, while the same user's pending request
remains eligible for the baseline OWN path. Revoking a central-only process or
inventory grant instead leaves an empty default and denies the operation.

## 9. Processing and inventory invariants

`stock.request.process` remains central-only with empty USER default. A normal
USER without a configured grant is denied; a valid explicit USER ALL grant can
process subject to all existing Stock rules; ADMIN uses central SYSTEM_ROLE.

The issue transaction remains serializable and keeps the atomic
`PENDING_ISSUE -> ISSUED` claim, already-processed conflict behavior, request
item/variant checks, inventory row locking, aggregate quantities, active item
and variant validation, parent/variant relationship validation, sufficient
quantity validation, conditional decrement, ledger rows and reference links,
audit, result notifications, low-stock generation and email/LINE outbox
behavior.

`stock.inventory.manage` remains central-only, empty for normal USER by
default, Dashboard-only, and valid for explicit Team/TeamRole/User grants.
Category, item and variant lifecycle, default variant handling, opening-balance
ledger entries, row locks, serializable transactions, optimistic/conditional
updates, quantity/min-stock handling, image cleanup, audits, active-state
validation and low-stock notifications remain unchanged. A revoked inventory
grant cannot mutate an inventory row.

## 10. LIFF and Dashboard lifecycle behavior

Normal LIFF requester behavior remains available from the defaults:

```text
catalog read       -> available
own request read   -> available
request create     -> available
own cancellation   -> available
request process    -> unavailable without explicit/system authority
```

`requireLiffStockProcessorSession()` still first requires a valid LIFF
workforce session, builds a trusted `LIFF_SELF_SERVICE` actor, and then
requires `stock.request.process`. A LIFF USER with explicit process ALL is
allowed. A LIFF USER without it is denied. A LIFF ADMIN with a valid workforce
identity uses central SYSTEM_ROLE authority and remains processor-capable.
Stock deliberately does not use the Routine LIFF ADMIN self-service clamp.
Dashboard-only inventory and report capabilities remain structurally denied in
LIFF even if a caller requests them.

Dashboard ADMIN account-only transaction lifecycle remains a Stock lifecycle
exception, not Default Domain Policy. When the persisted role is ADMIN, the
existing employee-optional path remains limited exactly to:

```text
stock.inventory.manage
stock.request.process
stock.request.cancel
```

`stock.request.create` still requires an active Employee, as do normal
Dashboard USER mutations and LIFF workforce operations where established by
the workflow.

Every transaction mutation validates that the requested actor ID matches the
command actor, locks and re-reads the current User, validates active User
lifecycle, reads the persisted role, locks/validates the active Employee when
required, rebuilds the current actor and calls `resolveInTransaction()` before
composition. A stale route ADMIN therefore cannot survive a persisted
downgrade to USER.

## 11. Presentation and administration

`getStockPresentationCapabilities()` now uses the permanent composition path
and one batched resolver call. For an eligible normal USER with no grants it
projects catalog/read-own/create/cancel-own as true, and read-all,
cancel-any/process/inventory/export as false. Read OWN/ALL and cancel OWN/ALL
remain separate fields; redundant or narrow grants never turn a baseline flag
off. Presentation remains non-authoritative.

The four requester/catalog capabilities are now:

```text
stock.catalog.read   -> CENTRAL_WITH_DEFAULT_POLICY / GRANTABLE
stock.request.read   -> CENTRAL_WITH_DEFAULT_POLICY / GRANTABLE
stock.request.create -> CENTRAL_WITH_DEFAULT_POLICY / GRANTABLE
stock.request.cancel -> CENTRAL_WITH_DEFAULT_POLICY / GRANTABLE
```

The three privileged capabilities remain:

```text
stock.inventory.manage -> CENTRAL_ONLY / GRANTABLE
stock.request.process   -> CENTRAL_ONLY / GRANTABLE
stock.report.export     -> CENTRAL_ONLY / GRANTABLE
```

All seven use the existing generic Team, TeamRole and direct User grant
commands. Representative add/remove coverage includes redundant catalog ALL,
request-read ALL, request-create OWN and request-cancel ALL. No Stock-specific
administration endpoint, seed, backfill or grant migration was introduced.

The Authorization Administration inspector continues to expose resolver and
configured-grant data. For a no-grant USER it cannot yet display the complete
Stock `Default + Additional + Effective` result, so a resolver
`NO_APPLICABLE_GRANT` must not be presented as final Stock denial. The complete
operator view remains Phase 12E.

## 12. Runtime and readiness classification

The catalog remains 40 capabilities and now reports:

```text
CENTRAL_WITH_DEFAULT_POLICY  15
CENTRAL_WITH_COMPATIBILITY    7
CENTRAL_ONLY                 13
DEFERRED                      5
TOTAL                        40
```

Administrative readiness is:

```text
GRANTABLE                    28
POLICY_ACTIVATION_REQUIRED    7
DEFERRED                      5
TOTAL                        40
```

The seven and only seven compatibility-backed capabilities are the Leave
family: `leave.request.read`, `leave.approval.read`, `leave.request.create`,
`leave.request.cancel`, `leave.request.approve`, `leave.cancellation.decide`
and `leave.request.not_taken`. Routine deferred surfaces remain
`routine.task.export`, `routine.summary.read` and `routine.reference.read`;
Email Request and future IT remain deferred.

## 13. Verification and handoff

Focused authorization, Stock route/query/mutation, report, LIFF, upload,
composition, resolver and Authorization Administration suites passed. The
expanded repository selection passed with 167 test files and 1,631 tests.
The final repository suite passed with 317 test files and 2,841 tests.

The final checks were:

```text
npm run architecture:check
npm run lint:strict
npm run typecheck
npm run test:run
git diff --check
```

Results: `npm.cmd run architecture:check`, `npm.cmd run lint:strict`,
`npm.cmd run typecheck`, `npm.cmd run test:run` and `git diff --check` all
passed. No development server or production build was run.

No development server, production build, Prisma migration, seed, backfill or
grant data migration is part of Phase 12C.4.

The exact next boundary is:

```text
Phase 12C.5 — Leave Additive Default Policy Migration
```

Stock authorization no longer depends on temporary `NO_APPLICABLE_GRANT`
compatibility mechanics. Catalog and requester self-service behavior are
permanent Default Domain Policy, configured grants add authority without
narrowing that baseline, and privileged inventory, processing and report
capabilities remain central-only. Request ownership, LIFF processor semantics,
transaction-time identity revalidation, request-state concurrency, inventory
locking, ledger consistency, idempotency, notification behavior and Stock
business invariants remain authoritative.
