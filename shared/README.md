# Shared platform capabilities

`shared/` is reserved for capabilities that are genuinely cross-domain or
platform-level. Examples include authentication infrastructure, database
adapters, HTTP/security primitives, trusted network/request metadata
primitives, notification or LINE delivery, uploads, and generic UI
primitives.

The core ownership test is:

> If the code changes because a business feature changes, it belongs to that
> feature.

Shared code must not depend on `modules/`. It may not become a dumping ground
for feature-specific types, validation, policies, or workflows. Phase A does
not move the existing implementations in `lib/`, `components/`, or other
legacy locations into this directory. Phase I1 establishes the cohesive Audit
capability's physical persistence, generic query/retention, and server
application owner as `modules/audit/`, not `shared/audit/`. Phase I2 also
places Audit Dashboard presentation under that module's browser-safe client
boundary, and I3 migrates the remaining Employee, Leave, Stock, and Routine
producer/read seams. Production physical AuditLog persistence is now exclusive
to Audit infrastructure. Legacy Audit adapters remain only for
Email Request and export compatibility; Auth/Session/Identity ownership is
complete, and future IT remains intentionally deferred.
The authoritative repository-wide K0 ownership map and deferred-boundary
inventory is [final-repository-audit.md](../docs/architecture/final-repository-audit.md).

See [module boundaries](../docs/architecture/module-boundaries.md) and
[dependency rules](../docs/architecture/dependency-rules.md) for the complete
ownership and import policy. Run `npm run architecture:check` when changing
code under this directory.
