# Feature modules

`modules/` is the ownership boundary for business capabilities in the NHF
Employee application.

Stock, Routine, and Leave are migrated feature modules. Employee F1 now owns
Employee server/business behavior in `modules/employee/`; its presentation
remains in legacy locations until F2. Other legacy locations remain valid until
their feature is deliberately migrated.

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
