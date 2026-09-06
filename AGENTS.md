# AGENTS.md

## 1. Priorities and Scope

* Priority order: **Correctness > Security > Maintainability > Performance > Speed**
* Make the smallest necessary change and keep it consistent with the existing architecture.
* Read the relevant code before making changes. Do not infer behavior from file names or function names.
* Do not modify files outside the task scope, rewrite code unnecessarily, or revert existing user changes.
* UI/style work must not change business logic unless explicitly instructed.

## 2. Thai Text and Encoding

* **Thai text must never become corrupted, lost, translated, or mojibake.**
* Preserve the existing file encoding, BOM, and line endings.
* New text files must use **UTF-8 without BOM** unless the repository specifies otherwise.
* When using PowerShell, always specify encoding explicitly when reading or writing files, for example:

```powershell
Get-Content -Raw -Encoding UTF8

Set-Content -Encoding utf8NoBOM
```

* Never overwrite files containing Thai text using commands that rely on default encoding.
* Inspect `git diff` after making changes to detect corrupted characters such as `�`, malformed Thai text, or unintended whole-file encoding changes.
* Do not translate Thai text into English unless explicitly authorized.

## 3. Documentation and Repository Context

* Review project instructions, types, tests, schemas, and existing implementations before creating anything new.
* Treat existing repository implementations and conventions as the primary source of truth.
* When using APIs or behavior from external libraries, verify the latest documentation through **Context7 MCP** or official documentation.
* Do not guess APIs, configuration options, framework behavior, or package versions.
* If documentation is unclear, state the assumption and choose the approach with the smallest impact.
* UI/UX work must use the **Impeccable skill** and follow the project's existing design system.

## 4. Code Quality and Type Safety

* Deliver complete implementations. Do not use placeholders such as `// ...`, pseudo-code, or empty functions.
* Prefer reuse before introducing new abstractions or implementations.
* Apply SRP, DRY, KISS, early returns, and pure functions where appropriate.
* Avoid unnecessary mutation.
* Newly modified first-party code must not introduce `any`.
* Use `unknown` together with schema validation or type guards.
* Define explicit return types for exported functions, services, hooks, actions, and API handlers.
* Handle `null` and `undefined` explicitly. Do not use non-null assertions without supporting evidence.
* Do not modify generated code or vendor code merely to bypass type errors.

## 5. Validation, Security, and Errors

* Validate input at every system boundary, including APIs, server actions, forms, webhooks, and environment variables.
* Use schemas as the Single Source of Truth and derive types from schemas whenever possible.
* Enforce authentication and authorization on the server for every mutation.
* Never trust roles, owner IDs, or permissions supplied by the client.
* Do not hardcode secrets, credentials, tokens, or sensitive configuration.
* Do not expose stack traces, SQL errors, internal paths, or implementation details to clients.
* Client-facing errors must be safe and understandable. Technical details should be recorded in server logs.

Standard order for server-side mutations:

1. Request size / abuse protection / rate limiting
2. Authentication
3. Input parsing and schema validation
4. Resource-level authorization
5. Business rules
6. Transactional persistence
7. Cache invalidation or revalidation
8. Sanitized response

## 6. Architecture and Single Source of Truth

* Types, constants, validation schemas, and business rules must each have a single authoritative source.
* Dependency direction:

```text
UI → Hooks → Services → Data Layer
```

* Lower layers must not import from higher layers.
* UI code must not access the database or persistence implementation directly.
* Business logic shared across multiple entry points must live in the service/domain layer rather than being duplicated in routes or components.
* Avoid circular dependencies and hidden side effects.

## 7. API and Database

* Public APIs intended for long-term support should use versioned endpoints.
* Use cursor-based pagination for datasets that may grow significantly.
* Mutations that may be retried, submitted more than once, or have significant side effects must define clear idempotency semantics.
* Never construct SQL from user input using string concatenation.
* Use parameterized queries or ORM query APIs only.
* Raw SQL must not use `SELECT *`; select only the required fields.
* Use transactions when multiple operations must either succeed or fail together.
* Production schema changes must be applied through migrations only.
* Enforce uniqueness, foreign keys, and concurrency constraints at the database layer when they represent business invariants.

## 8. Performance and Reliability

* Avoid accidental `O(n²)` behavior, N+1 queries, and repeated database or network calls.
* Use `Map` or `Set` for repeated lookups when appropriate for the dataset size.
* Use `Promise.all` only for operations that are independent and safe to execute concurrently.
* Do not parallelize operations that have dependencies, transaction ordering requirements, or shared mutable state.
* Use caching only when ownership, TTL, invalidation, and consistency behavior are clearly defined.
* Use dynamic imports only for dependencies that are large, unnecessary on the initial path, and provide measurable benefit.
* Retry only transient failures and operations that are safe to retry.
* Retries must have a maximum attempt count, exponential backoff, and jitter.
* Do not optimize based on speculation for code paths that are not known hot paths.

## 9. Testing and Verification

Run only checks relevant to the change:

1. Lint
2. Typecheck
3. Targeted tests
4. Broader test suites when regression risk is high

* Prefer scripts defined by the repository.
* Do not build or run the development server unless explicitly requested, required to reproduce an issue, or there is no other reasonable verification method.
* Tests must verify behavior rather than implementation details.
* Use unit tests for business rules and pure logic.
* Use integration tests for database interactions, authorization, and critical mutations.
* Use E2E tests for critical user flows, including both happy paths and error paths.
* Do not modify tests merely to make them pass without verifying that the expected behavior is still correct.
* If a command cannot be run, state the command, the reason, and what remains unverified.

## 10. Git and Delivery

* Inspect `git status` and `git diff` before and after making changes.
* Do not use destructive Git commands, force pushes, or reset user work without explicit authorization.
* Do not modify lockfiles, generated files, or format the entire repository unless required by the task.
* Keep diffs small, readable, and clearly separated by concern.
* Before completing the task, summarize:

  * Files changed
  * Behavior changed
  * Important security or architecture decisions
  * Commands and tests executed, including results
  * Remaining limitations, assumptions, or risks
