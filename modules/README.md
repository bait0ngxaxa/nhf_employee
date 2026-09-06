# Feature modules

`modules/` is the ownership boundary for business capabilities in the NHF
Employee application.

Stock, Routine, Leave, and Employee are migrated feature modules. Employee
F0-F3 owns its server/business behavior and active presentation in
`modules/employee/`. Employee Dashboard routes consume the minimal
browser-safe `@/modules/employee/client` entry, which also exposes the proven
pure Employee display formatter required by Leave, Routine, and audit
presentation. Generic Dashboard shell/context/navigation and route access
remain outside Employee. Other legacy locations remain valid until their
feature is deliberately migrated; Employee compatibility cleanup is complete.

Rules for new work:

- Put a substantial new business feature under `modules/<feature>/`.
- Expose the supported external contract from `modules/<feature>/index.ts`.
- Treat everything below a module's public entry point as internal
  implementation.
- A module may depend on `shared/` and may consume another module only through
  that module's public entry point.
- Keep the structure proportional to the feature. See
  [module boundaries](../docs/architecture/module-boundaries.md) for the
  larger and smaller module shapes.

The intended dependency direction is documented in
[dependency rules](../docs/architecture/dependency-rules.md). Run
`npm run architecture:check` when changing code under this directory.

Employee/Leave lifecycle composition is intentionally one-way: Leave may use
the public Employee hierarchy contract for the Employee-owned `managerId`
write, while Employee lifecycle code depends only on its structural
`EmployeeOffboardingDependencyProvider` port. The outer application boundary
binds Leave's blocker implementation and passes the same transaction client
used by the Employee serializable lifecycle operation. Employee must not
runtime-import `@/modules/leave` or Leave internals.

The Employee presentation keeps using the existing `/api/employees/**` and
`/api/departments` browser endpoints. Its CSV upload/preview/result flow uses
the module-owned client-safe parser and does not depend on the deleted mixed
Prisma/Leave `lib/helpers/csv-helpers.ts` implementation. Employee
presentation internals use local contracts and must not import either Employee
public barrel. Generic User/Employee fallback display is owned by the neutral
structural helper in `shared/identity/display.ts`, and Leave report labels are
owned by Leave report infrastructure.

Phase F3 CLOSED — Employee migration complete.
F0-F3 Employee modular-monolith migration is complete. This does not claim
that other application features are fully migrated.

Phase G0 Organization/Department discovery is closed. Department remains
transitional reference data with no `modules/organization/` or
`modules/department/` implementation and no Organization/tenant persistence.
Employee owns its `departmentId` association and Employee-specific mapping,
while a future organization/reference-data capability would own Department
lifecycle only after product requirements are resolved. See
[organization-department-migration.md](../docs/architecture/organization-department-migration.md).
