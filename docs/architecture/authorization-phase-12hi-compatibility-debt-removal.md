# Phase 12H-I — Compatibility Debt Removal

## Status

**Phase 12H-I = CLOSED / ACCEPTED**

Phase 12H-H was closed first from operator-confirmed production evidence in
[`authorization-phase-12hh-production-snapshot-live-rollout-validation.md`](./authorization-phase-12hh-production-snapshot-live-rollout-validation.md).
The H closure commit is `c03bc44` (`docs(auth): close Phase 12H-H production rollout validation`).
The H record preserves the distinction between the repository-validated SHA
(`d7bd8da121b74dea56254f7e3754c849e15a51bb`) and the production deployment
SHA, which was not independently recorded.

The temporary legacy ADMIN comparison seam was intentionally retained through
H for rollout comparison. After H acceptance it was removed by this phase.

## Final authorization boundary

```text
Authentication / account control plane
    systemRole = USER | ADMIN
              |
              | ADMIN controls Authorization Administration and other
              | explicitly approved control-plane surfaces
              v

Business authorization
    Default Domain Policy
        + Team grants
        + TeamRole grants
        + exceptional direct User grants

systemRole is not a business authorization grant source.
```

The canonical business resolver loads configured authorization persistence for
USER and ADMIN alike and evaluates it through the configured authorization
evaluator. The actual ADMIN system role, system-role management APIs,
Authorization Administration ADMIN gate, last-eligible-ADMIN protection,
self-demotion protection, role-change audit, persisted-role freshness, and
bootstrap behavior remain intact.

## Compatibility inventory and disposition

| Classification | Disposition |
| --- | --- |
| `RUNTIME_COMPATIBILITY_DELETE` | Deleted the legacy compatibility module, legacy evaluator and persistence-switch helpers, legacy resolver/composition APIs, the business `SYSTEM_ROLE` grant source, the Administration business-source projection, and Routine's historical ADMIN provenance branch. |
| `MIGRATION_TEST_DELETE_OR_REWRITE` | Deleted tests whose only purpose was implicit ADMIN business authority, skipped persistence, legacy resolver behavior, or legacy composition. Rewrote domain fixtures to use configured USER, TEAM, or TEAM_ROLE authority where extra business access is part of the scenario. |
| `CURRENT_DOC_UPDATE` | Updated the current-state, resolver, contract, presentation-projection, and H rollout records to describe the final role-neutral model. Added this H-I closure record. |
| `HISTORICAL_DOC_RETAIN` | Earlier Phase 10, 11, and 12A–12H records remain historically accurate. Historical references to the former SYSTEM_ROLE comparison model are retained and labelled as historical or superseded. |
| `AUTH_CONTROL_PLANE_KEEP` | Preserved the real Auth/system-role implementation, ADMIN-only Authorization Administration access, system-role presentation and controls, bootstrap ADMIN behavior, role-change auditing, and last-ADMIN protections. |
| `UNRELATED_LEGACY` | No unrelated compatibility or historical data was rewritten. Existing audit JSON containing `ownershipMode: "ADMIN"` remains readable. |

The five deleted legacy-only tests were:

- `composition.test.ts`: `keeps legacy ADMIN default projection at the explicit compatibility seam`;
- `resolver.test.ts`: `uses ADMIN semantics without persisted grants`;
- `resolver.test.ts`: `returns valid non-Team scopes for ADMIN when ALL is unavailable`;
- `resolver.test.ts`: `fails closed for an ADMIN-only origin-bound TEAM capability`; and
- `resolver.test.ts`: `keeps malformed persisted ADMIN rows ignored on the legacy comparison path`.

The resolver test named `fails closed on malformed ADMIN target persistence
instead of using legacy authority` was retained as a permanent fail-closed
test with its migration-specific wording removed. Production-readiness
assertions that compared legacy and role-neutral projections were removed or
rewritten as permanent configured-authority assertions.

## Implementation result

### Legacy resolver seam

Deleted:

- `modules/authorization/application/legacy-admin-business-authority-compatibility.ts`
- `evaluateLegacyAuthorization()`
- `shouldLoadLegacyAuthorizationPersistence()`
- `createLegacyAdminCompatibleAuthorizationResolver()`
- `composeLegacyAdminCompatibleAuthorizationAuthority()`
- `createRoleNeutralAuthorizationResolver()`

`createAuthorizationResolver()` is now the single canonical constructor. It
always loads configured persistence and evaluates the same model for USER and
ADMIN; no business decision branches on `systemRole`.

### Business grant types and presentation

`AuthorizationGrantSource` now has exactly these configured sources:

```text
TEAM
TEAM_ROLE
USER
```

The Authorization Administration effective-access projection and dashboard
source explanations no longer expose `SYSTEM_ROLE / ADMIN` as business
authority. The user's actual USER/ADMIN system role remains visible and
manageable in the separate account/system-role section.

### Routine provenance

Routine mutation classification no longer derives authorization provenance or
ownership mode from `SYSTEM_ROLE`. Future records use effective business
authority (`BROAD_AUTHORITY` or `SELF_SERVICE`) and explicit capabilities.
Historical audit rows are not rewritten.

### Production readiness

Production readiness now reports the permanent model—Default Domain Policy
plus configured Team, TeamRole, and User authority. It retains validation for
workforce eligibility, configured source validity, origin consistency,
inactive-source fail-closed behavior, effective authority counts, required
migrations, and production-environment safety. Migration-only role-neutral
versus legacy comparison output was removed.

Generic administration-catalog readiness metadata such as policy activation
state was retained because it is not a SYSTEM_ROLE authority source and no
current registry entry uses it as a legacy ADMIN bypass.

## Database decision

No database migration was required. Inspection found no persisted
`SYSTEM_ROLE` grant representation. Persisted business authority remains
represented by `TeamCapabilityGrant`, `TeamRoleCapabilityGrant`,
`UserCapabilityGrant`, and `TeamMembership`; `User.role` remains the separate
Auth/system-role field. The change is an in-memory/domain-type and runtime
compatibility cleanup.

## Verification

The following checks were executed after the implementation:

| Check | Result |
| --- | --- |
| Focused authorization/domain regression | **PASS — 19 files / 472 tests** |
| `npm run architecture:check` | **PASS — 1,153 repository source files checked** |
| `npm run lint:strict` | **PASS — zero warnings** |
| `npm run typecheck` | **PASS** |
| `npm run test:run` | **PASS — 330 files / 3,131 tests** |
| `npm run test:integration:mysql` | **PASS — 17 files / 110 tests, 0 failed files, 0 failed tests** |
| `git diff --check` | **PASS — no whitespace errors** |

The MySQL suite continued to use the accepted 17-file/110-test baseline. No
legacy-only integration test was removed.

## Runtime search audit

The only remaining source-code `SYSTEM_ROLE` occurrence is
`SYSTEM_ROLE_ACCOUNT_SELECT` in `modules/auth/application/system-role.ts`,
where it is the account/system-role persistence projection. It is not a
business grant, effective-access source, resolver branch, or composition path.
Business-authorization runtime contains zero `SYSTEM_ROLE` grant-source
branches.

Remaining ADMIN-related runtime occurrences are limited to these categories:

- authenticated session/account role parsing and trusted actor metadata;
- the ADMIN-only Authorization Administration gate;
- system-role assignment/removal, bootstrap, self-demotion and last-eligible-
  ADMIN protection, and `USER_ROLE_CHANGE` audit behavior;
- ADMIN badges and system-role controls in the account presentation;
- independently justified recipient/notification policies that target ADMIN
  accounts, not business capability resolution;
- historical serialization and domain data fields that remain readable.

No remaining production business capability, resource, mutation, query, or
effective-access gate grants authority solely because `systemRole === ADMIN`.

## Behavioral conclusion

No production business behavior changed relative to the already-cut-over,
role-neutral model validated in Phase 12H-H. This phase removes migration-era
comparison machinery and synthetic SYSTEM_ROLE business fixtures; Default
Domain Policies, capability scopes, Team/TeamRole/User semantics,
active-workforce requirements, resource predicates, workflow predicates, and
channel restrictions remain unchanged.

GitHub CI: not available / no workflow run.

**Final status:**

- **Phase 12H-H = CLOSED / ACCEPTED** — operator-confirmed production evidence;
  production deployment SHA not independently recorded.
- **Phase 12H-I = CLOSED / ACCEPTED** — no legacy SYSTEM_ROLE business
  authority compatibility remains.
