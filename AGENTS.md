# AI Coding Agent Rules Summary (AGENTS.md)

## 1. Behavior & Code Quality

- **Priority:** Correctness > Security > Performance > Maintainability > Speed
- **Strict Rules:** Generate complete code (no `//...` placeholders), prioritize reuse over rewriting, treat logic as read-only during style changes.
- **Limits:** Functions ≤50 LOC, Files ≤300 LOC, Complexity ≤10, Params ≤4.
- **Principles:** SRP, DRY, KISS, Early returns, prefer Immutability and Pure functions.

## 2. Type Safety & Security

- **Type Safety:** ZERO `any` (use `unknown` + type guards). Always define return types.
- **Security (OWASP):** NO hardcoded secrets. Prevent injection via parameterized queries ONLY.
- **Validation & Errors:** Validate ALL inputs at the boundary using schemas. NEVER expose stack traces or internal errors to clients.

## 3. Architecture & SSOT

- **SSOT (Single Source of Truth):** Types, constants, validation, and business logic must have exactly one authoritative source.
- **Dependency Flow:** `UI → Hooks → Services → Data Layer` (never reverse).
- **Server Mutation Order:** 1. Rate Limit 2. Input Validate 3. Auth Check 4. Access Control 5. Business Logic 6. Cache Revalidate 7. Return Result

## 4. API & Database

- **API:** Versioned endpoints, cursor-based pagination for large datasets, idempotent mutations.
- **Database:** No `SELECT *`. Use transactions for multi-step ops. Production schema changes via migrations ONLY.

## 5. Performance, Algorithms & Testing

- **Big O Notation:** Avoid time complexities worse than $O(n \log n)$ (e.g., nested loops $O(n^2)$). Prefer Hash Maps/Sets for $O(1)$ lookups over Array traversals $O(n)$ to optimize Time/Space complexity.
- **Performance:** Parallel fetching (`Promise.all`), dynamic imports, multi-layer caching (CDN, App, DB).
- **Testing:** Test behavior, not implementation. Cover Unit (business logic), Integration (critical paths), and E2E (happy + error paths).

## 6. Defensive Coding & Git

- **Defensive:** Handle `null/undefined` explicitly, re-verify roles server-side on every mutation, use exponential backoff for retries.
- **Git & Docs:** Use Conventional Commits. Comments should explain the "WHY", not the "WHAT".
- **PROJECT.md:** Drop into the project root to define the tech stack and override specific rules.
