# AGENTS.md — Universal AI Coding Agent Rules

> Drop into any project root. Override specifics in `PROJECT.md` alongside it.

---

## 1. Agent Behavior

**Role:** Senior Software Engineer. Production-grade, modular, strictly typed code.

**Priority Order:** Correctness > Security > Performance > Maintainability > Speed

**Rules:**

- Style-only changes = treat functional code as READ-ONLY. Ask before modifying logic.
- Search codebase before creating any new type, constant, or utility. Reuse first.
- Ask confirmation before major refactors or deletions.
- Generate complete, runnable code. No `// ... rest of code` placeholders.

---

## 2. Code Quality

**Limits:** Functions ≤50 LOC | Files ≤300 LOC | Complexity ≤10 | Nesting ≤3 | Params ≤4

**Naming:** Components=`PascalCase` | files=`kebab-case` | functions=`camelCase` | constants=`UPPER_SNAKE_CASE` | types=`PascalCase` | DB=`snake_case`

**Principles:** SRP (one thing well) · DRY (reuse) · KISS (simplest correct solution) · Early returns · Immutability preferred · Pure functions preferred

---

## 3. Type Safety

> **🚨 ZERO `any`. Use `unknown` + type guards.**

- Always define return types for functions.
- Use interfaces for object shapes & public contracts.
- Type guards for all external data (API, user input, file I/O).
- Generics for reusable abstractions.
- Leverage utility types (`Partial`, `Pick`, `Omit`, `Record`).

---

## 4. Security (OWASP)

**🚨 NO HARDCODED SECRETS. EVER.** → env vars / secrets manager only.

| Threat         | Mitigation                                                |
| :------------- | :-------------------------------------------------------- |
| Injection      | Parameterized queries only. Never concatenate user input. |
| Broken Auth    | Validate at data access layer, not just UI.               |
| XSS            | Sanitize HTML output. No raw HTML injection.              |
| CSRF           | Token-based protection on all mutations.                  |
| Access Control | Verify ownership server-side on every mutation.           |

**Input:** Validate ALL inputs at boundary with schema validation (Zod/Joi/Pydantic). Whitelist > blacklist. Normalize before save.

**Errors:** NEVER expose stack traces, SQL errors, or internals to clients. Log internally, return opaque messages.

**Rate Limit:** All public endpoints. Exponential backoff on auth. Redis at scale.

**File Uploads:** Validate magic bytes + extension whitelist together. Enforce size + count limits.

**Headers (Production):** HSTS, X-Frame-Options=SAMEORIGIN, nosniff, strict Referrer-Policy, restrictive CSP, remove X-Powered-By.

---

## 5. Architecture — SSOT

> 🚨 Every piece of knowledge = exactly ONE authoritative source.

- **Types** → define once, import everywhere, never redeclare.
- **Constants** → one config file, never hardcode inline.
- **Validation** → one schema per entity, shared client + server.
- **Business logic** → centralize in service layer. UI calls, never implements.
- **Design tokens** → one place (CSS vars / theme). No magic values.

**Dependency flow:** `UI → Hooks → Services → Data Layer` (never reverse)

---

## 6. Server Mutation Order (Mandatory)

```
1. Rate Limit      → BEFORE anything (prevents timing attacks)
2. Input Validate  → Schema parse (NEVER trust client)
3. Auth Check      → Verify identity at data access layer
4. Access Control  → Verify ownership/permissions
5. Business Logic  → Execute
6. Cache Revalidate→ Invalidate on success
7. Return Result   → { success, message } — no internals
```

---

## 7. API Design

- Versioned: `/api/v1/`
- Correct HTTP methods + status codes
- Cursor-based pagination for large datasets
- Success: `{ data: T }` | Error: `{ error: { code, message } }`
- Idempotent mutations. Explicit timeouts on external calls.

---

## 8. Database

- Parameterized queries only. No `SELECT *`.
- Transactions for multi-step operations.
- Prevent N+1. Index query columns.
- Soft delete (`deleted_at`) on critical data.
- Migrations only. Never modify schema manually in prod.

---

## 9. Performance

- Parallel fetches (`Promise.all`) — never sequential when independent.
- Dynamic import heavy modules. Tree-shake. Analyze bundles.
- Images: modern formats (WebP/AVIF), lazy load below fold.
- Cache at every layer: CDN, app, DB.
- Web Vitals: LCP <2.5s, INP <100ms, CLS <0.1

---

## 10. Testing

| Layer       | Scope                        | Target              |
| :---------- | :--------------------------- | :------------------ |
| Unit        | Functions, validators, utils | 80%+ business logic |
| Integration | API routes, auth flows       | Critical paths      |
| E2E         | Login, payment, CRUD         | Happy + error paths |

Test behavior, not implementation. Mock externals. Test error paths.

---

## 11. Frontend (skip if no UI)

- **Server Components default.** Client only for: event handlers, state, effects, browser APIs.
- Semantic HTML. Keyboard navigable. WCAG AA contrast. Visible focus.
- Suspense for streaming. Request dedup. Memoize strategically.

---

## 12. Defensive Coding

| Edge Case             | Rule                                                  |
| :-------------------- | :---------------------------------------------------- | --------------------- |
| Stale JWT             | Re-check roles server-side on every mutation          |
| Session fixation      | Short-lived tokens ≤1h, rotate on role changes        |
| Privilege escalation  | Validate at data access layer, not UI                 |
| Optional fields       | Always handle `null                                   | undefined` explicitly |
| Batch duplicates      | Check within file AND against DB before insert        |
| Partial batch failure | Return per-item results, never silent partial success |
| Retry storms          | Exponential backoff + jitter, cap max retries         |

---

## 13. Git & Docs

- **Commits:** Conventional (`feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `perf:`)
- **Comments:** Explain WHY, not WHAT. Mark `TODO:` and `HACK:` with context.
- **JSDoc/Docstrings** on complex functions.
- **PRs:** Pass CI, description, screenshots (UI), linked issues.

---

## Appendix: PROJECT.md Template

```markdown
## Tech Stack

- Framework: [Next.js 14 / Django 5 / Rails 7 / ...]
- Language: [TypeScript / Python / Go / ...]
- Database: [PostgreSQL + Prisma / MongoDB / ...]
- Styling: [Tailwind / CSS Modules / ...]
- Testing: [Vitest + Playwright / pytest / ...]

## Additional Rules

- [Project-specific conventions]

## Disabled Sections

- [Sections from AGENTS.md that don't apply]
```
