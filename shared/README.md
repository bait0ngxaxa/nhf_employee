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
legacy locations into this directory. Phase I0 resolves the cohesive Audit
capability's physical persistence, generic query/retention, and presentation
owner as a future modules/audit/ module; existing lib/ Audit code remains a
compatibility implementation during the transition. I1 establishes generic
Audit ownership, while known business producer and Routine-reader direct
access seams remain temporary until I3 closes final physical AuditLog
persistence exclusivity.

See [module boundaries](../docs/architecture/module-boundaries.md) and
[dependency rules](../docs/architecture/dependency-rules.md) for the complete
ownership and import policy. Run `npm run architecture:check` when changing
code under this directory.
