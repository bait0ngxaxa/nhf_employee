# Runtime Security and Reliability Hardening Baseline

Status: L0 complete — discovery and threat-modeling record
Track: L-series runtime/security/reliability hardening
Evidence date: 2026-09-09
Authority: This document is the authoritative baseline for L1-L7.

This is a source-backed discovery record. It does not authorize or implement
runtime hardening, schema changes, migrations, API-contract changes, or
cleanup. Findings use the current repository as the source of truth. Historical
architecture records are used for context only and are not treated as proof
when the current implementation differs.

## 1. Status and scope

The modular-monolith migration is structurally complete:

- K1, the Stock ownership-boundary phase, is closed.
- No K2 modular-boundary phase is justified by the current repository.
- Email Request remains a deferred future IT capability. It is read here only
  where it is a shared-platform consumer of browser transport, Audit, SMTP,
  or the global Outbox. It is not migrated, renamed, or redesigned.
- NotificationOutbox remains shared/platform infrastructure.
- Generic SMTP and LINE Messaging transport remains shared/platform
  infrastructure.

L0 covers:

1. refresh-token rotation, family semantics, session termination, and
   invalidation races;
2. browser 401 refresh/replay behavior and current mutation idempotency;
3. all current Auth and mutation abuse-control mechanisms;
4. LINE identity verification, LineAccountLink, and LIFF session lifetime;
5. refresh security-event Audit metadata and its consumers;
6. Notification history cursor correctness;
7. global Outbox claim/retry/recovery/provider semantics; and
8. compatibility and obsolete-code candidates recorded by the final audit.

L0 does not implement a solution. The proposed follow-up work is organized
in section 15.

## 2. Current baseline and repository state

### 2.1 Architecture baseline

The current dependency direction is still:

    UI -> hooks/presentation -> capability application services -> persistence

The current repository has explicit Auth, LINE, Notification, Audit, Leave,
Stock, and Routine capability entries. Shared security, database, network,
email, LINE transport, and Outbox code remain platform services. No source
change in this L0 phase weakens those boundaries.

The primary architecture records inspected were:

- AGENTS.md
- docs/architecture/final-repository-audit.md
- docs/architecture/auth-session-identity-migration.md
- docs/architecture/notification-migration.md
- docs/architecture/stock-migration.md
- docs/architecture/modular-monolith.md
- docs/architecture/module-boundaries.md
- docs/architecture/dependency-rules.md

The relevant current implementation and tests were then inspected under:

- modules/auth, modules/line, modules/notification, modules/audit;
- app/api/auth, app/api/line, app/api/notifications, and app/liff;
- lib/auth, lib/security, lib/network, lib/line, lib/email, and
  lib/services/outbox;
- Leave, Stock, Routine, and shared Email Request mutation/notification
  integrations;
- Prisma schema and deployment/reverse-proxy configuration.

### 2.2 Runtime control summary

| Area | Current control | Remaining observation |
| --- | --- | --- |
| Auth refresh | Opaque random refresh token; SHA-256 hash at rest; family ID; unique rotatedFromId; conditional rotation update inside a Prisma transaction | The application-level pre-read and family-revocation paths are not coordinated with every concurrent logout/revocation path. |
| Access authorization | Access-token signature/claims plus database family, User, tokenVersion, and Employee-state checks in server account resolution | Middleware validates the JWT shape/claims without replacing the server resolver. |
| Password reset | One-time conditional token claim and serializable transaction; password version increment and refresh-family revocation are in the same reset transaction | There is no equivalent real-MySQL concurrency test for refresh versus reset/lifecycle/logout. |
| Browser refresh | One in-flight browser refresh; generic 401 retry of the original RequestInit | The generic transport does not restrict the replay to GET/HEAD or an explicit endpoint opt-in. |
| LIFF transport | Recovery may replay only GET/HEAD; a recovered mutation returns the original unauthorized result | LIFF issuance uses a signed JWT containing userId and employeeId, not a link version or revocation handle. |
| Auth abuse control | Identity/IP fixed-window maps plus DB-backed password-reset request count | The maps are process-local; topology and restart behavior are not encoded in the control itself. |
| Notification history | User/filter-scoped query, 20-row page, 21-row lookahead, timestamp cursor | Ordering and continuation use createdAt alone; equal timestamps are not uniquely addressable. |
| Outbox | Conditional claim, stale PROCESSING recovery, retry/backoff, DEAD/SUPERSEDED paths, capability rechecks | Provider side effects are at-least-once. LINE has a retry key; SMTP has only a deterministic Message-ID in notification paths. |
| Audit | Structured JSON details, admin read path, 90-day application retention | Refresh security metadata includes familyId; append is best effort and details are available to authorized Audit consumers. |

## 3. Hardening principles and exclusions

The L-series follows these rules:

1. Preserve API URLs, response shapes, cookie names, authentication/session
   contracts, Thai wording, LINE/LIFF contracts, database compatibility,
   Outbox ownership, and the deployment boundary.
2. Treat authorization as a server-side property. UI visibility, disabled
   controls, and client role state are not controls.
3. Establish an invariant and a concrete failure/attack sequence before
   calling something a vulnerability.
4. Prefer conditional database writes, transactions, idempotency, and
   explicit state machines where the actual invariant requires them.
5. Do not assume that a Prisma transaction is serializable. The code must
   explicitly set isolation or use a conditional write/lock when that is the
   required property.
6. Do not promise exactly-once external delivery where the provider contract
   and process-failure window only support at-least-once delivery.
7. Do not select a rate-limit backend in L0. L2 must first decide the
   deployment/topology and availability requirements.
8. Do not change Prisma schema or migrations during L0.
9. Do not remove residue merely because it has no in-repository caller.
   External deployments, scripts, operators, or consumers must be checked
   before L6 cleanup.

The following are explicitly out of scope:

- Email Request migration or a modules/email-request capability;
- UI redesign;
- historical TICKET_* enum/storage compatibility;
- organization or tenant concepts;
- NotificationOutbox migration into modules/notification;
- generic SMTP or LINE Messaging transport migration;
- new capabilities or modular-boundary refactors;
- schema, migration, or generated-code changes;
- runtime behavior changes in this phase.

## 4. Application-specific trust-boundary and threat model

### 4.1 Trust-boundary map

    Anonymous browser / authenticated user / administrator
                  |
                  | HTTPS cookies, request bodies, X-Requested-With,
                  | LINE/LIFF bootstrap calls
                  v
    Cloudflare / reverse proxy boundary
                  |
                  | CF-Connecting-IP, origin forwarding, request limits
                  v
    Nginx -> Next.js process
                  |                 ^
                  | Prisma           | verified LINE ID token / webhook signature
                  v                 |
    MySQL / Prisma                 LINE / LIFF platform
                  |
                  | NotificationOutbox rows and state transitions
                  v
    Shared Outbox processor -> SMTP provider
                              -> LINE Messaging provider

The deployment files describe Internet -> Cloudflare -> Nginx -> Next.js on
127.0.0.1:3000. The application helper accepts only a syntactically valid
cf-connecting-ip value; the security of that value depends on the origin
being reachable only through the trusted proxy/tunnel configuration.

### 4.2 Assets and invariants

| Asset or invariant | Why it matters |
| --- | --- |
| Passwords, reset tokens, opaque refresh tokens | Prevent account takeover and unauthorized session continuation. |
| Refresh family state | A rotated/reused token must not silently create an active session after revocation. |
| User, Employee, role, and tokenVersion state | A deactivated, deleted, or ineligible account must not obtain usable protected access. |
| LineAccountLink and LIFF session identity | A LINE user must act only for the currently intended NHFapp account and employee. |
| Leave, Stock, Routine, and Employee mutation state | A retried request must not create a second business effect or bypass a state/version guard. |
| Notification history | Every row in a user/filter history must be reachable exactly once by cursor pagination. |
| Outbox and provider side effects | A committed business event should be retried, stale work should recover, and duplicate external delivery should be understood. |
| Audit records and security-event metadata | Operators need incident correlation without exposing unnecessary sensitive identifiers. |

### 4.3 Actors and failure sources

| Source | Capability or failure assumption | Relevant boundary |
| --- | --- | --- |
| Anonymous internet client | Can send malformed, repeated, parallel, and expensive requests that reach the supported origin path. Does not control MySQL or provider credentials. | Cloudflare/Nginx/Next |
| Authenticated user | Possesses their own cookies and can intentionally issue parallel refreshes, replay bodies, and repeat authorized mutations. | Browser/Next |
| Administrator | Has broader business authorization and can view Audit records; remains an authenticated application actor, not a database operator by default. | Next/Audit |
| LINE/LIFF platform | Supplies an ID token or webhook request that must be independently verified; may be unavailable or return an error. | LINE/Next |
| Cloudflare/reverse proxy | Expected to be the only public path for the supported deployment and to provide the trusted client IP. Misconfiguration or origin bypass is a separate operational failure. | Proxy/Next |
| Next.js process | May restart, run more than one process/instance, time out, or crash after a database/provider side effect. | Next/MySQL/Outbox |
| MySQL/Prisma | Provides unique constraints, conditional updates, and transactions; isolation is determined by the explicit transaction configuration and database default. | Next/MySQL |
| Outbox processor | May claim work and stop before recording the final state. | MySQL/providers |
| SMTP provider | May accept a message and time out or return an ambiguous response; Message-ID is not assumed to be a provider-level idempotency key. | Outbox/SMTP |
| LINE Messaging provider | Supports X-Line-Retry-Key behavior used by current notification sends; network and provider errors remain possible. | Outbox/LINE |

### 4.4 Threat/reliability scenarios

The detailed finding cards below are the authoritative per-finding model. The
principal application-specific sequences are:

1. Two legitimate browser requests use one refresh cookie at the same time.
   Conditional rotation prevents two successors, but the loser can classify
   the event as token reuse and revoke the family. This protects against
   stolen-token replay at the cost of a possible same-client availability
   failure.
2. Refresh and logout/logout-all/session revocation run concurrently. Because
   the termination paths are separate reads and updates, a successor can be
   created or missed at a boundary that the caller intended to terminate.
3. The browser receives a 401 from a mutation, refreshes, and resends the same
   method and body. Endpoint-specific idempotency or state guards determine
   whether the second execution is harmless; the shared transport does not
   decide that today.
4. A client distributes requests across processes, restarts the process, or
   sends requests without a trusted Cloudflare IP header. Process-local
   counters are bypassed, reset, or collapsed into the shared unknown bucket.
5. A LINE link is valid during LIFF issuance and is removed or changed by an
   operator afterward. The signed LIFF session remains cryptographically valid
   and protected requests reread User/Employee state but not LineAccountLink.
6. An Outbox worker completes a provider call, crashes before marking SENT, and
   later retries stale work. Provider-specific retry keys may suppress a
   duplicate; SMTP acceptance is not universally deduplicated.

## 5. Auth refresh and session findings

### 5.1 Current refresh lifecycle

The current lifecycle is:

1. The route reads the opaque refresh cookie and calls
   modules/auth/application/sessions.ts.
2. The repository finds the row by the SHA-256 token hash and includes User
   id, email, role, isActive, and tokenVersion.
3. The application pre-checks revoked/expired state and User.isActive.
4. rotateRefreshTokenAtomically starts a Prisma interactive transaction.
   It conditionally sets revokedAt on the source row where revokedAt is null.
5. If the conditional update affects zero rows, it looks for an active
   successor by rotatedFromId. A successor means alreadyRotated; no successor
   means invalid.
6. If the source was claimed, the transaction creates one successor. The
   rotatedFromId unique constraint and P2002 handling prevent two committed
   successors for the same source.
7. A reused/second request causes a separate revokeRefreshFamily call.
8. A success issues a JWT with the family ID and the User tokenVersion.
9. Later protected server resolution checks the active family, current User
   state, current tokenVersion, and current Employee state.

The current repository has a password-reset invalidation path rather than a
separate authenticated password-change route: reset-password claims the
one-time reset row, increments User.tokenVersion, and revokes all refresh
rows in the same serializable transaction. Employee offboarding/suspension
also increments tokenVersion and revokes refresh rows in its lifecycle
transaction. No distinct password-change endpoint was found in the current
route inventory.

The source-row claim is a real conditional database operation. The
application does not use a row lock or explicit Serializable isolation for
the refresh rotation transaction. Therefore, the transaction boundary alone
must not be read as proof that all refresh/revocation operations are globally
serialized.

### 5.2 Concrete concurrent refresh timeline

Let T0 be a valid source token in family F and let R1 and R2 both read T0
before either request reaches the conditional update:

| Time | R1 | R2 |
| --- | --- | --- |
| t1 | Reads T0 as unrevoked and active | Reads the same T0 as unrevoked and active |
| t2 | Conditional update claims T0; creates successor T1; commits | Waits for the source-row write, then its conditional update affects zero rows |
| t3 | Issues a 200 response with T1 | Finds T1 as an active successor and returns alreadyRotated |
| t4 | The browser may already have received T1 | The route separately revokes family F and records a reuse event |

The result can be a successful response whose newly issued token is
immediately unusable because the family is then revoked. That is an
availability failure for simultaneous legitimate requests, while the same
behavior is intentional containment for a stolen old token. A real MySQL
concurrency test is required to pin down the exact visibility of the
successor-read under the deployed isolation configuration; the current route
tests mock the count/successor result and do not establish this schedule.

At the application level the outcomes are exact: one caller whose conditional
update returns count=1 creates the successor; a caller with count=0 returns
alreadyRotated and triggers family revocation if its successor query sees an
active successor; a caller with count=0 and no visible active successor
returns invalid without the reuse Audit event; and a rotatedFromId unique
conflict is treated as alreadyRotated and triggers family revocation. The
remaining evidence question is which committed successor rows the loser sees
under the deployed MySQL isolation/locking schedule, not whether the code has
an unconditional two-successor path.

### 5.3 Finding L0-AUTH-01 — concurrent refresh can false-positive as reuse

- Classification: B — confirmed reliability risk with a security-session
  availability consequence; not a confirmed account-takeover vulnerability.
- Area: Auth refresh rotation and refresh-family semantics.
- Evidence / relevant paths:
  modules/auth/application/sessions.ts:32-118;
  modules/auth/infrastructure/persistence/refresh-token-repository.ts:160-198;
  __tests__/api/hybrid-auth-routes.test.ts:134-249.
- Current behavior: The source row is atomically claimed and only one
  successor can be created, but the loser can return alreadyRotated and
  revoke the entire family in a separate write. The route's expected reuse
  behavior does not distinguish a stolen token from two legitimate same-cookie
  browser requests.
- Security/reliability invariant: A legitimate concurrent refresh must not
  unnecessarily destroy the usable session; a genuinely reused token must
  revoke the family before it can continue.
- Concrete failure scenario: R1 and R2 both pre-read T0; R1 commits T1; R2
  classifies the now-rotated T0 as reuse, revokes F, and returns 401 while R1
  may have returned 200. The client can lose both the old and newly issued
  session.
- Current mitigation: Conditional update on id and revokedAt; unique
  rotatedFromId; active-successor detection; family revocation; active-family
  check on later protected requests; single-flight refresh in the browser.
- Residual risk: Family revocation is deliberately broad and can create a
  same-client race. No real concurrent refresh integration test currently
  proves the deployed MySQL schedule or the intended winner/loser contract.
- Severity: Medium.
- Confidence: High for the code-level race; production frequency depends on
  simultaneous request timing.
- Whether production behavior must change: Yes, if the L-series accepts
  legitimate concurrent refresh as a supported client behavior.
- Whether schema/migration may be required: Not necessarily. A transaction/
  state-machine correction can use existing columns; a persisted generation,
  grace-window, or replay-result design could require a migration and must be
  justified separately.
- Compatibility constraints: Preserve refresh cookie names, 401 behavior
  expected by current clients, family-revocation security semantics, Audit
  action shape, and API response contracts.
- Recommended future phase: L1.
- Acceptance criteria: A documented state machine distinguishes first
  rotation, same-token concurrent completion, confirmed reuse, expiry, and
  family revocation; a legitimate simultaneous browser refresh does not
  revoke a newly issued session unless the chosen threat model explicitly
  requires it; a stolen/reused token still produces family containment.
- Required tests: Real-MySQL concurrent refresh with two callers; source-row
  and successor assertions; family-revocation assertions; retry under the
  deployed isolation level; API tests for cookies and Audit events; a
  concurrency test that repeats the schedule many times.

### 5.4 Finding L0-AUTH-02 — session termination is not coordinated with rotation

- Classification: A — confirmed concurrency correctness defect in the
  termination invariant; no standalone privilege escalation was established.
- Area: Logout, logout-all, and per-session revocation.
- Evidence / relevant paths:
  modules/auth/infrastructure/persistence/refresh-token-repository.ts:95-129
  and 201-224; modules/auth/application/sessions.ts:214-257;
  app/api/auth/logout/route.ts; app/api/auth/logout-all/route.ts;
  app/api/auth/sessions/revoke/route.ts.
- Current behavior: Current logout first reads the source row and then updates
  it by id without a revokedAt:null condition. Logout-all uses a separate
  updateMany by user. Per-session revocation first reads an active row and
  then revokes its family. None of these paths share the refresh rotation
  transaction or a common lock/state transition.
- Security/reliability invariant: After a successful termination operation,
  the targeted current session or all targeted sessions must not be able to
  continue by creating or using a successor.
- Concrete failure scenario: Refresh claims T0 and commits T1 while
  logout-current is using a pre-read of T0. Logout-current revokes only T0;
  T1 remains active. A related logout-all or session-revoke schedule can
  miss a successor created at the transaction/read boundary, depending on
  database statement visibility and locking.
- Current mitigation: Access-token resolution checks the family on every
  protected server request; family revocation is used for explicit session
  revocation; password reset and employee lifecycle changes revoke refresh
  rows inside serializable transactions.
- Residual risk: Logout success is not a proof that a concurrently rotating
  family has no active successor. This is especially relevant when a browser
  sends a refresh and logout from different tabs or when a client retries a
  response.
- Severity: Medium.
- Confidence: High for the uncoordinated read/update code path; exact missed
  successor schedules require real-MySQL concurrency evidence.
- Whether production behavior must change: Yes.
- Whether schema/migration may be required: Probably not for a conditional
  claim/lock/state-machine correction; a migration is possible only if the
  chosen design adds explicit session-generation state.
- Compatibility constraints: Keep logout idempotency, cookie clearing,
  per-session targeting, current-family cookie behavior, and existing Audit
  records.
- Recommended future phase: L1.
- Acceptance criteria: Logout-current, logout-all, password reset, employee
  offboarding, and per-session revoke each have an explicit ordering contract
  against refresh; after the operation's success, no newly created successor
  remains usable for the targeted session.
- Required tests: Concurrent refresh/logout-current; refresh/logout-all;
  refresh/session-revoke; password-reset/refresh; employee-offboarding/
  refresh; repeated idempotent logout; real database assertions on every
  refresh row in the affected family.

### 5.5 Finding L0-AUTH-03 — refresh pre-check does not enforce all current account state

- Classification: C — defense-in-depth and invariant-alignment gap; not a
  confirmed protected-resource bypass.
- Area: Refresh eligibility versus server account resolution.
- Evidence / relevant paths:
  `modules/auth/infrastructure/persistence/refresh-token-repository.ts:5-22`
  and `160-197`; `modules/auth/application/sessions.ts:32-112` and
  `136-165`; `modules/auth/infrastructure/persistence/account-repository.ts:22-32`
  and `176-198`; `modules/employee/application/mutations.ts:140-158` and
  `280-346`; `modules/auth/application/employee-account-lifecycle.ts:57-75`;
  `docs/architecture/employee-migration.md:540-549` and `924-935`;
  `modules/employee/application/mutations.test.ts:575-610` and
  `__tests__/lib/server-auth-token-version.test.ts:125-152`.
- Current behavior: The refresh lookup selects `User.isActive` and
  `tokenVersion`, but not `User.deletedAt` or Employee `status`/`deletedAt`;
  the refresh pre-check therefore rejects only an inactive User before the
  atomic refresh-row rotation. Protected account resolution separately
  rereads `User.deletedAt`, Employee eligibility, `tokenVersion`, and the
  active session family.
- Reachability distinction:
  - Supported persistent state: OFFBOARD and SUSPEND run through the
    serializable Employee lifecycle transaction. It locks the Employee and
    linked User, writes the Employee state, sets the linked User inactive,
    increments `tokenVersion`, and revokes all non-revoked refresh rows before
    commit. The repository contains no evidence that an ordinary supported
    offboarding path leaves `Employee` ineligible while
    `User.isActive = true` and an active refresh family remains. Reactivation
    likewise increments the token version and revokes sessions.
  - Inconsistent/legacy/manual state: If Employee state or `User.deletedAt`
    is changed without the paired Auth/session update, an otherwise active
    refresh row can pass the narrow pre-check and rotate. The resulting access
    token is rejected by the standard protected resolver; this is an issuance
    mismatch, not a confirmed authorization bypass. No supported application
    User-deletion path was found that sets `User.deletedAt` without the
    corresponding account controls.
  - Temporary concurrency/stale read: A refresh lookup occurs before the
    rotation transaction and can read the pre-lifecycle state. If lifecycle
    invalidation commits first, the conditional rotation sees the revoked row
    and returns unauthorized. If rotation commits first, the lifecycle
    transaction later revokes the successor and increments `tokenVersion`;
    the refresh code can still finish from its stale pre-read and return
    cookies, but the family/token-version/account checks make the credentials
    unusable. The exact interleaving still needs a real-MySQL characterization
    test.
- Security/reliability invariant: Credential issuance and protected-resource
  authorization should agree on current account eligibility. A deactivated,
  deleted, or ineligible linked account should not receive a renewed usable
  credential, while the existing intentionally unlinked-account behavior must
  remain explicit.
- Concrete failure scenario: At T0 an Employee is active with an active
  refresh row. At T1 refresh reads the row and only `User.isActive=true`. At
  T2 either (a) the lifecycle transaction commits first, causing the
  conditional rotation to fail, or (b) rotation commits first and lifecycle
  then revokes the successor and increments `tokenVersion`. In case (b), the
  response may contain a newly issued pair even though later protected
  resolution rejects it. A separate legacy/manual inconsistent row can make
  the rotation succeed repeatedly until state is repaired, but standard
  protected routes still reject the resulting access tokens.
- Current mitigation: Supported Employee lifecycle changes coordinate User
  deactivation, token-version invalidation, and refresh-family revocation in
  one transaction; password reset does the same for password invalidation;
  protected resolution checks `User.isActive`, `User.deletedAt`, Employee
  status/deletedAt, `tokenVersion`, and active family. Existing lifecycle,
  login-eligibility, and resolver tests cover the supported state transitions
  and later authorization rejection, but not this refresh/lifecycle race on a
  real database.
- Residual risk: The refresh boundary can issue a short-lived, unusable
  credential from inconsistent persisted state or a stale concurrent read,
  and the family can be rotated before the caller learns that authorization
  will fail. A future protected entry point that bypassed the standard
  resolver would increase the impact, but no such current path was found.
- Severity: Low.
- Confidence: Medium — high confidence in the field-selection mismatch and
  supported lifecycle mitigation; medium confidence in the frequency and
  operational impact of inconsistent or concurrent states because the required
  real-MySQL characterization is not present.
- Whether production behavior must change: No immediate production change is
  justified by L0 evidence. L1 should characterize the race first, then may
  align refresh eligibility with the resolver as defense-in-depth without
  treating this finding as a current authorization defect.
- Whether schema/migration may be required: No. Existing User and Employee
  fields and refresh-family/token-version mechanisms are sufficient to test or
  implement an alignment; no Prisma schema or migration is implied.
- Compatibility constraints: Preserve 401 semantics, refresh cookies, the
  intentionally supported unlinked-account behavior, account lifecycle
  ordering, Thai messages, and the existing API/session contracts.
- Recommended future phase: L1, beginning with real-MySQL state/race
  characterization rather than an immediate schema or token redesign.
- Acceptance criteria: Prove with database-backed tests that successful
  OFFBOARD/SUSPEND commits leave the Employee ineligible, the linked User
  inactive with an incremented token version, and no active refresh row in the
  affected families. Exercise both commit orders of refresh versus lifecycle
  and show that no active usable session survives. If L1 aligns the pre-check,
  it must reject deleted Users and ineligible linked Employees before issuing
  cookies while preserving active and intentionally unlinked accounts; the
  document must continue to distinguish this defense-in-depth outcome from an
  authorization-bypass finding.
- Required tests: Real-MySQL integration tests for refresh versus OFFBOARD,
  SUSPEND, REACTIVATE, password reset, logout-current, and logout-all;
  fixtures for legacy/manual User/Employee inconsistency and `User.deletedAt`;
  protected API tests proving resolver rejection; assertions that no usable
  access token or active successor family remains after lifecycle success; and
  Audit assertions for any rejected refresh security event.

### 5.6 Finding L0-AUTH-TEST-01 — refresh concurrency evidence gap

- Classification: C — defense-in-depth/test coverage gap.
- Area: Auth concurrency verification.
- Evidence / relevant paths:
  __tests__/api/hybrid-auth-routes.test.ts:103-271 uses mocked repository
  results; __tests__/integration/password-reset-concurrency.integration.test.ts:56-86
  covers password-reset token consumption, not refresh rotation.
- Current behavior: Route tests characterize successful rotation, reused
  tokens, successor detection, inactive User, logout, and logout-all, but no
  real database test runs two refresh callers against the same row or
  refresh against termination/lifecycle changes.
- Security/reliability invariant: The documented race contract must be
  demonstrated against the actual MySQL/Prisma operations used in production.
- Concrete failure scenario: A mocked test suite remains green while a
  deployed isolation/locking schedule either false-revokes a family or leaves
  a successor active after termination.
- Current mitigation: Conditional updates and existing password-reset
  integration coverage.
- Residual risk: L1 may choose a fix based on an assumed atomicity that has
  not been exercised end to end.
- Severity: Informational.
- Confidence: High.
- Whether production behavior must change: No, this finding alone is test
  work; L1 behavior changes may be driven by its results.
- Whether schema/migration may be required: No.
- Compatibility constraints: Tests must use the existing database/schema and
  must not alter production contracts.
- Recommended future phase: L1.
- Acceptance criteria: Reproducible concurrent integration tests cover
  refresh/refresh, refresh/logout-current, refresh/logout-all,
  refresh/session-revoke, refresh/password-reset, and refresh/offboarding.
- Required tests: The integration scenarios listed above, with repeated
  runs and assertions on rows, cookies, response status, family status, and
  Audit events.

## 6. Generic web mutation replay findings

### 6.1 Current transport behavior

modules/auth/presentation/browser-transport.ts implements:

1. send the original fetch;
2. if it returns 401 and the URL is not an Auth-internal path, issue one
   single-flight POST /api/auth/refresh;
3. if refresh succeeds, send fetch(url, init) again.

There is no method check in that shared helper. Therefore POST, PUT, PATCH,
and DELETE may be replayed. lib/client/api-client.ts serializes ordinary data
once into a JSON string and reuses the same RequestInit; current FormData,
Blob, ArrayBuffer, and URLSearchParams inputs are also passed through again.
A ReadableStream body is not guaranteed to be replayable, but the helper does
not reject or guard it. The separate 429/5xx retry in api-client is restricted
to GET/HEAD; that does not constrain the independent 401 refresh replay.

The LIFF path is intentionally different. Its onUnauthorized handler returns
replay=true only for GET/HEAD, and current tests verify that a recovered
mutation is not replayed.

### 6.2 Current mutation protection inventory

| Mutation family | Current protection | External side effect boundary |
| --- | --- | --- |
| Leave request creation | Caller Idempotency-Key, request hash, unique User+key, serializable transaction, duplicate-key reread | Domain row, Audit, and Leave Outbox are committed together. |
| Stock request creation | Caller Idempotency-Key, request hash/unique key, serializable transaction | Domain state, Audit, in-app notification, and Outbox are transactionally coordinated. |
| Routine task creation | Caller Idempotency-Key and unique User+key; duplicate replay path | Domain row and associated Routine state are transactionally coordinated. |
| Email Request creation | Existing Idempotency-Key and serializable transaction | Read-only observation for L0; it remains outside this migration and hardening scope. |
| Leave decisions/cancellation/not-taken | Serializable transaction, status/action guards, locks and current-recipient checks | Domain transition creates Outbox work; repeated state transition is rejected or superseded. |
| Stock issue/cancel/adjust | Serializable/conditional status or version/state updates | Outbox/provider work occurs after business state is committed. |
| Routine updates/deletes/occurrences/imports | Version/state/conditional updates; import ledgers and supersede logic where applicable | Provider work is Outbox based for notifications. |
| Notification read/mark-all | isRead=false conditional updates; repeating the operation is effectively idempotent | No external provider side effect. |
| Auth login/signup/logout/session operations | Signup database uniqueness; reset token one-time claim; logout revocation; login intentionally creates a new session and has no generic idempotency key | Login/session cookies are direct response effects; password-reset mail is a direct SMTP path. |
| Employee create/update/import and other ordinary dashboard writes | Validation and resource authorization; no repository-wide idempotency key contract was found | Mostly direct database effects; endpoint-specific behavior must be checked before any generic replay policy. |

This inventory means the generic replay path is not proof that every current
mutation executes twice. Many important create or transition flows have
database-level protection. It does establish that replay safety is an
endpoint contract currently left to each mutation implementation.

### 6.3 Finding L0-REPLAY-01 — generic 401 recovery can replay mutations

- Classification: B — reliability risk and C — defense-in-depth; no
  evidence-backed current authorization bypass or confirmed double-execution
  was found in this discovery.
- Area: Browser/API transport and mutation idempotency.
- Evidence / relevant paths:
  modules/auth/presentation/browser-transport.ts:47-65;
  lib/client/api-client.ts:167-315;
  modules/line/presentation/liff-client.ts:90-131;
  __tests__/lib/api-client-refresh.test.ts:10-42;
  __tests__/lib/liff-session-recovery.test.ts:35-83.
- Current behavior: Dashboard/shared web transport can replay any method after
  a successful refresh using the same RequestInit/body. The generic test
  proves GET replay but does not characterize POST/PATCH/DELETE replay. LIFF
  transport limits recovery replay to GET/HEAD.
- Security/reliability invariant: A request with a business side effect must
  not be executed twice solely because credentials were refreshed; if replay
  is allowed, the endpoint must have explicit idempotency or an equivalent
  state/version invariant.
- Concrete failure/attack scenario: A mutation is accepted and commits, but
  the first response is observed as 401 or otherwise appears unauthorized at
  the browser boundary. The generic helper refreshes and resends the same
  mutation. A mutation without a key, uniqueness guard, or state transition
  can create a second row, repeat a direct side effect, or make the final
  client result ambiguous.
- Current mitigation: One in-flight refresh; Auth internal paths are
  excluded; most high-value create flows have endpoint-specific idempotency;
  LIFF mutations are not replayed; non-401 retry is read-only.
- Residual risk: The shared helper has no safe-method gate, no replay opt-in,
  and no body replayability contract. Current code review did not establish a
  route that commits a mutation and then deliberately returns 401, so this is
  not labeled a confirmed vulnerability.
- Severity: Medium.
- Confidence: High for transport behavior; Medium for current duplicate
  incidence because it depends on response/auth timing and endpoint path.
- Whether production behavior must change: Yes, either in the shared
  transport contract or by explicit endpoint opt-in/endpoint protection.
- Whether schema/migration may be required: Not for a safe replay policy;
  endpoint-specific idempotency gaps may require existing- or new-table
  constraints and must be decided by the owning capability.
- Compatibility constraints: Preserve current API URLs, status contracts,
  explicit Leave/Stock/Routine idempotency behavior, direct-fetch callers,
  and the stricter LIFF mutation behavior.
- Recommended future phase: L1 for the refresh/replay coupling, with
  capability-specific follow-up in the owning phase.
- Acceptance criteria: The shared transport documents and enforces which
  methods may replay; every replayable mutation has an idempotency/state
  proof; JSON, FormData, and non-replayable stream bodies have explicit
  behavior; a lost/401 response cannot silently create an unbounded duplicate.
- Required tests: Generic POST/PATCH/PUT/DELETE 401 characterization;
  body replay tests for JSON/FormData and rejection or opt-out for streams;
  endpoint tests for Leave/Stock/Routine/Employee/auth mutations; response
  ambiguity tests with provider/outbox side effects.

## 7. Rate-limit and abuse-control findings

### 7.1 Inventory

There are two process-local mechanisms.

1. lib/auth/rate-limit.ts stores identity and IP fixed-window entries in the
   module-global authAttempts Map.

   | Endpoint | Window | Identity limit | IP limit | Key/input |
   | --- | ---: | ---: | ---: | --- |
   | /api/auth/hybrid-login | 15 minutes | 8 | 40 | normalized email and metadata IP |
   | /api/auth/signup | 1 hour | 5 | 25 | normalized email and metadata IP |
   | /api/auth/forgot-password | 1 hour | 3 | 30 | normalized email and metadata IP, plus DB count of 3 per hour |

   Login also has the shared pre-auth IP limit below. Signup does not call
   that pre-auth policy. Forgot-password deliberately returns the accepted
   anti-enumeration response for invalid input, unknown users, and rate
   limits. Signup clears only the identity bucket after success; its IP
   bucket remains for the fixed window. Auth refresh does not use the
   identity map; it uses the shared pre-auth IP policy.

2. lib/security/mutation-rate-limit.ts stores rateLimitEntries in a module
   global. Pre-auth scopes use the trusted-IP key and a 15-minute window:

   - auth-login and auth-refresh;
   - Leave request/cancel/decision/not-taken;
   - Stock adjust/request create/request cancel/request issue; and
   - Routine task create/update/delete, occurrence administration, and import.

   Authenticated scopes use a userId key and a one-minute window for the
   corresponding Leave, Stock, and Routine mutations. The policy constants
   are the source of truth for the exact request ceilings.

3. lib/network/trusted-client-ip.ts accepts only a valid single
   cf-connecting-ip value. It ignores X-Forwarded-For, X-Real-IP, and other
   client-supplied alternatives. This is correct only if the supported origin
   path prevents clients from injecting the Cloudflare header directly.

Both maps use fixed windows. The Auth map cleans expired entries when checked;
the mutation map cleans periodically and fail-closes when its 50,000-entry
capacity is reached. A process restart clears both maps. Separate Node
processes or instances do not share counters. Missing/invalid trusted IP
values become the shared unknown bucket for pre-auth mutation limits; the
Auth identity/IP map uses the string unknown when metadata has no IP.

Current tests cover normalization, per-scope separation, fixed-window reset,
trusted-header selection, and single-process ceilings. They do not cover
restart, multiple processes/instances, capacity pressure, or a production
origin bypass.

### 7.2 Finding L0-RATE-01 — process-local abuse controls do not scale with topology

- Classification: B — confirmed operational reliability/control-coverage
  risk; C — defense-in-depth improvement. It is not labeled a vulnerability
  without evidence that production already runs multiple uncoordinated
  instances or exposes the origin directly.
- Area: Auth abuse control, mutation abuse control, and trusted client IP.
- Evidence / relevant paths:
  lib/auth/rate-limit.ts:18-92;
  lib/security/mutation-rate-limit.ts:74-190;
  lib/network/trusted-client-ip.ts:1-19;
  app/api/auth/hybrid-login/route.ts;
  app/api/auth/signup/route.ts;
  app/api/auth/forgot-password/route.ts;
  deployment/nginx/employee_nhf.cloudflare-origin.conf:7-49;
  README.md:192-304;
  __tests__/lib/auth-rate-limit.test.ts;
  __tests__/lib/mutation-rate-limit.test.ts;
  __tests__/lib/trusted-client-ip.test.ts.
- Current behavior: Limits are local to one process, fixed-window, and
  cleared by restart. A multi-process deployment can multiply the effective
  budget. A process without a CF header places pre-auth clients in one
  unknown-IP bucket; a misconfigured or bypassed origin can either collapse
  all users into that bucket or allow header spoofing.
- Security/reliability invariant: Abuse budgets and trusted client identity
  must remain predictable across the supported deployment topology, and a
  single client must not bypass or deny the control merely by selecting a
  different process or by exploiting proxy ambiguity.
- Concrete failure/attack scenario: An attacker sends login or refresh
  requests across two Next processes and receives approximately two local
  budgets. Alternatively, a direct origin request without CF header consumes
  the unknown bucket and denies unrelated clients, or an origin bypass lets
  the attacker choose a false CF client IP.
- Current mitigation: Identity plus IP buckets for login/signup/forgot;
  database request count for password-reset requests; pre-auth and
  authenticated mutation ceilings; valid-IP parsing; Nginx Cloudflare range
  configuration; documentation requiring origin firewall/tunnel controls.
- Residual risk: No shared counter, monotonic/restart policy, or topology
  assertion exists in application code. L0 has not established whether
  production is one process, PM2 cluster, multiple hosts, or a worker fleet.
  The choice of Redis, MySQL, Cloudflare, or another backend is intentionally
  deferred.
- Severity: Medium.
- Confidence: High for process-local behavior; Medium for production blast
  radius until deployment topology is verified.
- Whether production behavior must change: Yes if the supported deployment
  can have more than one process/instance or if abuse budgets must survive
  restart; otherwise an explicit single-process operational invariant must be
  documented and monitored.
- Whether schema/migration may be required: Unknown and intentionally
  undecided. L2 may select an external/shared backend or a database design;
  no choice is made here.
- Compatibility constraints: Preserve current endpoint status/headers,
  anti-enumeration responses, trusted-proxy deployment, and per-user
  authenticated mutation quotas.
- Recommended future phase: L2.
- Acceptance criteria: Production topology is recorded; each limit has an
  explicit key, window, restart, fail-open/fail-closed, and multi-instance
  contract; Cloudflare/origin assumptions are tested operationally; unknown
  IP behavior is an explicit decision; brute-force and enumeration budgets
  are measured against the chosen implementation.
- Required tests: Multi-process/instance counter tests; restart tests;
  concurrency/atomic-consume tests; unknown-IP capacity/denial tests;
  Cloudflare-header origin tests; login, refresh, signup, forgot-password,
  and authenticated mutation abuse scenarios.

## 8. LINE / LIFF identity findings

### 8.1 Current account-link and LIFF lifecycle

LINE ID-token verification calls the LINE verification endpoint and validates
the token audience, expiry, and issuer shape before returning lineUserId.

Account linking:

1. An authenticated active workforce user posts a LINE ID token to
   /api/line/account-link.
2. The route verifies the LINE identity and calls linkLineAccount.
3. The repository checks existing links by user and LINE ID, then relies on
   unique database constraints and a P2002 reread for the race case.
4. The same response issues a signed LIFF session cookie.

LIFF bootstrap:

1. /api/line/liff/session verifies the LINE ID token.
2. It reads LineAccountLink by lineUserId.
3. It rereads current User and Employee eligibility.
4. It issues nhf_liff_session containing userId and employeeId.

The LIFF JWT is HS256-signed with the configured secret, issuer, audience,
iat, and expiry. The default TTL is one hour; configuration permits up to 24
hours. A protected LIFF request verifies the JWT and rereads current User and
Employee state through findActiveLiffWorkforceIdentity. It does not reread
LineAccountLink. The repository contains no user-facing unlink operation.

### 8.2 Finding L0-LINE-01 — no post-issuance LineAccountLink reread

- Classification: D — intentional design tradeoff with residual security
  risk; not a confirmed account-takeover vulnerability under the current
  supported lifecycle.
- Area: LINE identity, LineAccountLink, and LIFF session authorization.
- Evidence / relevant paths:
  app/api/line/liff/session/route.ts:42-75;
  app/api/line/account-link/route.ts:42-63;
  modules/line/application/liff.ts:18-40 and 63-91;
  modules/line/infrastructure/session/liff-session.ts:65-117;
  modules/line/infrastructure/persistence/account-link.ts:66-148;
  lib/line/config.ts:3-5 and 100-133.
- Current behavior: Link state is read at bootstrap/issuance. Later protected
  LIFF requests verify the signed session and reread current User/Employee
  eligibility, but do not reread the current LineAccountLink row.
- Security/reliability invariant: A LIFF credential must continue to
  represent the intended current LINE-to-NHFapp relationship for the period
  in which it is accepted; account deactivation must be enforced promptly.
- Concrete failure scenario: A valid link for LINE user L and User U is used
  to issue a LIFF JWT. An operator or future unlink/relink operation removes or
  changes the link. Until the JWT expires or is otherwise invalidated, a
  request carrying the still-valid JWT can pass LIFF session verification and
  current User/Employee checks for U. With the default configuration the
  stale window is up to one hour; the configured maximum is 24 hours.
- Current mitigation: Bootstrap and recovery reread LineAccountLink; User
  inactive/deleted state and Employee active/deleted state are reread on
  every protected LIFF request; the signed cookie is HttpOnly and expires;
  account-link uniqueness prevents two current links for one user or LINE
  identity.
- Residual risk: There is no link version, session-family handle, unlink
  invalidation, or per-request link lookup. Password/tokenVersion changes in
  the web Auth model do not automatically invalidate this independent LIFF
  JWT.
- Severity: Medium.
- Confidence: High.
- Whether production behavior must change: Yes only if the security
  requirement is immediate enforcement of link unlink/relink changes. The
  current no-reread behavior is documented as intentional and should not be
  changed silently.
- Whether schema/migration may be required: Not necessarily for a direct
  per-request reread; a link-version, revocation table, or shared session
  version design could require a migration. L0 selects none.
- Compatibility constraints: Preserve LIFF bootstrap/recovery contracts,
  LINE verification behavior, response shapes, session cookie name, Thai
  client messages, and acceptable LIFF latency.
- Recommended future phase: L3.
- Acceptance criteria: The chosen stale-link maximum is explicit; unlink,
  relink, account deactivation, and password-reset behavior are separately
  defined; every protected LIFF request either enforces the selected link
  invariant or the accepted TTL is documented and monitored.
- Required tests: Link issuance followed by unlink/relink simulation;
  User/Employee deactivation during a valid LIFF session; session expiry;
  concurrent bootstrap/recovery; two-account uniqueness/race tests; API
  authorization tests for the selected enforcement mechanism.

## 9. Refresh security Audit metadata findings

### 9.1 Current metadata and consumers

When refresh detects a reused/expired token or inactive User, the route
persists a LOGIN_FAILED Audit record with:

- action LOGIN_FAILED;
- entityType User and the User id/email when available;
- top-level ipAddress and userAgent;
- details.metadata.authFlow = hybrid_refresh;
- details.metadata.reason;
- details.metadata.familyId;
- details.metadata.ipAddress and userAgent.

The family ID is generated as 16 random bytes represented as hexadecimal. It
is an opaque session-family correlation identifier, not the raw refresh token;
the raw token is random and only its SHA-256 hash is stored. Per-session
logout Audit metadata also contains familyId.

Audit details are serialized as JSON in AuditLog.details. Administrators can
retrieve Audit records through GET /api/audit-logs, and the dashboard parses
and displays the resulting records. The repository also has feature-owned
history projections and data-export Audit events. Application retention
deletes AuditLog rows older than 90 days. appendAuditBestEffort intentionally
does not fail the authentication/revocation operation if persistence fails;
it logs the failure instead.

### 9.2 Finding L0-AUDIT-01 — refresh family ID is sensitive correlation metadata

- Classification: C — defense-in-depth/privacy and incident-operations
  improvement; not a credential disclosure because familyId is not the raw
  refresh secret.
- Area: Auth security-event Audit metadata.
- Evidence / relevant paths:
  app/api/auth/refresh/route.ts:27-49;
  modules/auth/application/sessions.ts:48-103;
  modules/auth/infrastructure/persistence/refresh-token-repository.ts:25-35;
  modules/audit/infrastructure/persistence/audit-log-repository.ts:42-104;
  app/api/audit-logs/route.ts;
  modules/audit/presentation/dashboard/AuditLogViewer.tsx;
  modules/audit/application/retention.ts:4-17.
- Current behavior: A raw familyId is persisted in JSON details for refresh
  security events and some session logout events. The JSON is available to
  authorized Audit readers and is retained for 90 days unless cleanup is not
  run.
- Security/reliability invariant: Incident correlation must remain possible,
  while Audit records should expose no more session identifier material than
  operators need.
- Concrete failure scenario: An authorized Audit response, dashboard
  display, database backup, or log/debug consumer exposes a family ID that
  allows an observer to correlate refresh-reuse events and session actions.
  The value alone does not authenticate, but it increases session-history
  sensitivity.
- Current mitigation: Raw refresh tokens are not persisted or logged;
  family IDs are random; the generic Audit-log API is
  administrator-controlled; feature-owned history has its own authorization;
  cleanup has a 90-day policy; the route does not expose the raw cookie.
- Residual risk: The repository has no explicit classification, redaction,
  hashing, or consumer contract for familyId. appendAuditBestEffort can also
  lose a security event if Audit persistence fails.
- Severity: Low.
- Confidence: High.
- Whether production behavior must change: A metadata policy decision is
  required; no silent removal is authorized in L0.
- Whether schema/migration may be required: No for replacing the value in
  JSON; a dedicated correlation field would require a schema/API decision and
  must preserve historical representations.
- Compatibility constraints: Preserve Audit action/entity types, historical
  export/display representations, incident correlation, and 90-day retention
  behavior unless an explicit compatibility plan is approved.
- Recommended future phase: L3.
- Acceptance criteria: Security and operations owners decide whether raw,
  truncated, or keyed-hash family correlation is required; all current
  readers/exports are inventoried; the selected representation cannot be
  mistaken for an authentication token; Audit failure/retention monitoring is
  explicit.
- Required tests: Refresh security-event payload contract; redaction/hash
  determinism and non-reversibility tests if selected; admin API/dashboard
  display tests; historical Audit compatibility tests; retention and
  best-effort failure tests.

### 9.3 Finding L0-AUDIT-02 — security-event Audit persistence is best effort

- Classification: D — intentional operational tradeoff with C —
  defense-in-depth monitoring implications.
- Area: Auth security-event Audit production.
- Evidence / relevant paths:
  app/api/auth/refresh/route.ts:52-82;
  modules/audit/application/commands.ts;
  modules/audit/infrastructure/persistence/audit-log-repository.ts:42-55;
  lib/server/audit.ts:69-99.
- Current behavior: The refresh route revokes/denies first and then awaits
  appendAuditBestEffort. Audit failure is caught and logged; it does not
  change the 401 or session containment result.
- Security/reliability invariant: A failed Audit sink must not make an unsafe
  refresh succeed, but security-event loss must be visible enough for
  incident response.
- Concrete failure scenario: MySQL or the Audit write path is unavailable
  during a refresh-reuse event. The family is revoked and the client receives
  401, but no durable security-event record exists.
- Current mitigation: Security containment does not depend on Audit success;
  failures are written to process logs; Audit persistence has tests and
  retention.
- Residual risk: Process logs may be lost, unstructured, or unavailable
  after restart; there is no durable retry/dead-letter path for Audit writes.
- Severity: Informational.
- Confidence: High.
- Whether production behavior must change: Not necessarily; monitoring and
  an operational decision are required before changing the tradeoff.
- Whether schema/migration may be required: No for monitoring; a durable
  Audit retry queue would be a new design and is not justified by L0 alone.
- Compatibility constraints: Do not block authentication or weaken family
  revocation; preserve Audit historical semantics.
- Recommended future phase: L3, or L7 if monitoring is accepted as-is.
- Acceptance criteria: Security owners explicitly accept best-effort Audit;
  failure signals are observable and retained; a failed Audit write cannot
  affect authorization or token containment.
- Required tests: Persistence-failure tests for refresh security events,
  structured operational logging tests, and verification that family
  revocation still occurs when Audit append fails.

## 10. Notification history cursor findings

### 10.1 Current query and API contract

GET /api/notifications/all accepts the existing filter and cursor query
parameters. The application passes the authenticated user ID to a 20-row
history query with a 21-row lookahead. For filter=unread it adds isRead=false;
other values use the all-history path. The persistence query is:

- where userId and optional isRead=false;
- if cursor exists, createdAt < new Date(cursor);
- orderBy createdAt desc;
- take 21.

The application returns the first 20 rows and uses the last returned row's
createdAt.toISOString() as nextCursor. The browser stores the string cursor,
preserves the selected filter, and appends the next page to its current list.
Changing the filter clears the list and cursor.

### 10.2 Concrete equal-timestamp example

Assume one user has 21 eligible Notification rows A through U and all have
createdAt = 2026-09-09T10:00:00.000Z. The database returns any 20 rows for
page one because orderBy contains no tie-breaker. The application returns
those 20 and nextCursor = 2026-09-09T10:00:00.000Z. Page two applies:

    createdAt < 2026-09-09T10:00:00.000Z

All 21 tied rows are excluded, so the one row omitted from page one is
skipped permanently. If the database chooses a different tie order between
requests, the particular omitted row is not deterministic. With an unchanged
filter and immutable timestamps, the strict less-than predicate prevents a
direct duplicate of a tied row; the confirmed defect is omission, and the
cursor still cannot represent the page boundary. Invalid timestamp strings
also reach the generic error path rather than a documented cursor error.

### 10.3 Finding L0-NOTIF-01 — timestamp-only cursor skips equal-timestamp rows

- Classification: A — confirmed pagination correctness defect.
- Area: Notification history query/API/browser continuation.
- Evidence / relevant paths:
  modules/notification/infrastructure/persistence/repository.ts:47-62;
  modules/notification/application/queries.ts:13-54;
  app/api/notifications/all/route.ts:15-24;
  modules/notification/presentation/dashboard/NotificationsPageContent.tsx:38-87;
  prisma/schema.prisma Notification model;
  modules/notification/infrastructure/persistence/repository.test.ts:53-94;
  __tests__/api/notifications.test.ts:116-140.
- Current behavior: Rows are ordered and continued by createdAt alone. The
  API contract exposes an ISO timestamp cursor and browser consumers pass it
  unchanged.
- Security/reliability invariant: Every row matching the same user and
  filter must be reachable once across pages, and continuation must identify
  an unambiguous boundary.
- Concrete failure scenario: Twenty-one rows share the page-boundary
  timestamp. The first page returns 20; the timestamp cursor excludes all
  rows with that timestamp from page two, skipping at least one row.
- Current mitigation: User scoping, filter scoping, page-size-plus-one,
  strict less-than continuation, filter reset in the browser, and tests that
  characterize the current timestamp contract.
- Residual risk: Equal timestamp collisions are possible under MySQL DateTime
  precision and application batching. No unique tie-breaker exists in the
  query or cursor, and the current Notification indexes do not encode the
  full ordered key.
- Severity: Medium.
- Confidence: High.
- Whether production behavior must change: Yes for complete history
  correctness, but the public cursor shape must be migrated compatibly.
- Whether schema/migration may be required: Not strictly. Existing id can be
  used in an opaque composite cursor; a composite index may be desirable for
  performance and would require a migration. No migration is made in L0.
- Compatibility constraints: Preserve GET URL, filter semantics, response
  fields, browser behavior, old cursor handling policy, and legacy
  Notification rows. Do not alter TICKET_* compatibility.
- Recommended future phase: L4.
- Acceptance criteria: Deterministic order is createdAt desc plus a unique
  stable key; continuation includes both values; equal-timestamp fixtures
  produce neither skips nor duplicates; filters and old clients have an
  explicit compatibility strategy.
- Required tests: Repository query shape; application cursor encoding/
  decoding; 21 equal-timestamp rows; rows inserted between pages; unread/all
  filters; invalid and legacy cursor behavior; browser append/reset tests;
  API contract tests.

## 11. Outbox and external-provider reliability findings

### 11.1 Current claim/retry/state behavior

The global processor:

1. marks stale PROCESSING rows older than 10 minutes as FAILED with a retry
   time, or DEAD when the attempt budget is exhausted;
2. reads due PENDING/FAILED rows with attempts below the maximum and takes a
   batch ordered by createdAt;
3. claims each row using updateMany constrained by id, status, attempts, and
   nextAttemptAt;
4. dispatches through the capability contract;
5. marks normal SENT or SUPERSEDED outcomes only while the row is still
   PROCESSING;
6. on an error increments attempts, schedules exponential retry from a
   60-second base, or marks DEAD at the terminal attempt; and
7. lets capability-specific DEFERRED behavior update/follow up its own work.

The configured maximum is three attempts. The claim prevents two processors
from simultaneously owning the same current row, but the external provider
call is not part of the database transaction that changes PROCESSING to SENT.

Capability dispatchers recheck current business state where the notification
can become stale. Leave validates current action/recipient and can mark a
row SUPERSEDED. Routine checks event keys, current version/state, and can
defer or supersede. Stock dispatchers validate payload/state and use
deterministic event keys. Domain mutations create Outbox rows transactionally
with the business state in the inspected Leave, Stock, Routine, and Email
Request create paths.

### 11.2 Provider behavior

- LINE application notifications derive a deterministic UUID-shaped retry key
  from eventKey and send it as X-Line-Retry-Key. The transport treats a 409
  response with a retry key as delivered.
- Notification email paths create deterministic Message-ID values based on
  event identity (some capability email code builds equivalent deterministic
  IDs locally). SMTP acceptance and Message-ID handling are not treated as a
  universal idempotency protocol.
- The shared email transport itself retries selected network failures up to
  three times. A timeout after provider acceptance remains an ambiguous
  outcome.
- In-app notification dedupeKey and unique Outbox eventKey prevent some
  duplicate database writes, but they do not turn an external SMTP or LINE
  call into exactly-once delivery.

### 11.3 Finding L0-OUTBOX-01 — crash recovery can duplicate provider side effects

- Classification: D — intentional at-least-once delivery tradeoff with B —
  provider-dependent reliability risk; not a confirmed provider duplicate
  incident.
- Area: Shared Outbox processor and SMTP/LINE provider boundary.
- Evidence / relevant paths:
  lib/services/outbox/processor.ts:128-178 and 313-388;
  lib/services/outbox/types.ts:31-45;
  lib/services/outbox/provider-key.ts:1-23;
  lib/line/messaging.ts:7-37;
  lib/line/app-notification.ts:63-102;
  lib/email/transport.ts:72-130;
  modules/leave/infrastructure/notifications/line.ts:385-478;
  modules/routine/application/reminders.ts;
  modules/stock/infrastructure/notifications/outbox.ts;
  __tests__/services/outbox/processor.test.ts;
  __tests__/services/outbox/app-line-processor.test.ts;
  __tests__/services/outbox/provider-key.test.ts.
- Current behavior: A worker claims a row, calls SMTP/LINE or writes a
  downstream in-app notification, and only afterward records SENT or another
  terminal outcome. A process crash or timeout after provider acceptance and
  before the state update causes stale recovery/retry. Capability checks can
  supersede stale work, but they cannot undo an already delivered external
  message.
- Security/reliability invariant: Committed business events must not be lost
  silently; retries must be bounded and stale work recoverable; duplicate
  external effects must be bounded, observable, and provider-specific.
- Concrete failure scenario: Outbox row O is PROCESSING. LINE or SMTP accepts
  the message. The Next/worker process crashes before O becomes SENT. After
  ten minutes another processor marks/reclaims O and calls the provider
  again. LINE may deduplicate with its retry key; SMTP may deliver twice.
- Current mitigation: Conditional claims; three-attempt cap; 60-second
  exponential retry; ten-minute stale recovery; DEAD and SUPERSEDED states;
  unique eventKey; current-state/capability rechecks; LINE retry key and
  409 handling; deterministic email Message-ID.
- Residual risk: Exactly-once delivery is not available from the combined
  database/provider contract. SMTP Message-ID is a message header, not a
  universal provider idempotency guarantee. Some notification flows use
  direct/provider calls with different key construction, so provider-specific
  coverage must be inventoried before changing anything.
- Severity: Medium.
- Confidence: High for the at-least-once crash window; Medium for the actual
  duplicate rate because it depends on provider behavior and process failures.
- Whether production behavior must change: Only provider-specific evidence
  should drive a change. The shared processor must remain at-least-once
  unless a stronger business requirement is demonstrated.
- Whether schema/migration may be required: Not necessarily. Provider
  receipts, delivery ledger, metrics, or retry state could require a design
  change; L0 does not select one.
- Compatibility constraints: Keep the global Outbox Processor shared;
  preserve eventKey semantics, capability ownership, notification ordering,
  Thai message content, and provider configuration.
- Recommended future phase: L5.
- Acceptance criteria: Every provider path has a documented ambiguity/
  duplicate contract; crash-after-provider tests show the resulting state;
  LINE retry behavior and SMTP limitations are explicit; stale and DEAD work
  is observable; no phase claims exactly-once without provider evidence.
- Required tests: Claim races; stale PROCESSING recovery at each attempt
  boundary; crash/timeout after provider acceptance; LINE 409/retry-key
  behavior; SMTP ambiguous response and internal retry behavior; superseding
  after business state changes; final SENT/FAILED/DEAD/SUPERSEDED transitions;
  metrics/alerting for DEAD and repeated provider attempts.

## 12. Compatibility and obsolete-code candidates

These are cleanup candidates, not defects. They remain in place during L0.

### 12.1 Finding L0-COMPAT-01 — lib/services/audit-log residue

- Classification: F — obsolete-code cleanup candidate.
- Area: Audit compatibility seam.
- Evidence / relevant paths:
  lib/services/audit-log/index.ts;
  lib/services/audit-log/mutations.ts;
  lib/services/audit-log/queries.ts;
  lib/services/audit-log/types.ts;
  modules/audit/index.ts;
  scripts/check-architecture.mjs:2098-2188.
- Current behavior: The legacy path re-exports or wraps modules/audit. No
  production source import was found in the repository; the architecture
  checker still knows the path as a server-only directory.
- Security/reliability invariant: Removing a compatibility path must not
  break deployed code, operator scripts, build-time architecture checks, or
  historical Audit behavior.
- Concrete failure scenario: An external script, deployment artifact, or
  operator import still references the old path. Removing it causes a
  runtime or deployment failure even though repository-local imports are
  absent.
- Current mitigation: The current modules/audit entry owns active behavior;
  the residue is retained and the architecture checker accounts for it.
- Residual risk: External consumers and deployed bundles are not visible from
  repository search.
- Severity: Informational.
- Confidence: High for no in-repository production caller; Low for external
  consumer absence.
- Whether production behavior must change: No intended behavior change, but
  deletion is itself a compatibility change until evidence is complete.
- Whether schema/migration may be required: No.
- Compatibility constraints: Preserve modules/audit API, historical Audit
  export/display representations, scripts, and architecture checks.
- Recommended future phase: L6.
- Acceptance criteria: Search source, tests, build outputs, deployment
  scripts, runbooks, CI, package consumers, and operator documentation;
  obtain deployment-owner confirmation; remove only with a diff that updates
  the architecture checker and leaves all checks green.
- Required tests: Repository import scan; architecture check; typecheck;
  targeted Audit tests; deployment/script smoke validation if an external
  consumer is identified.

### 12.2 Finding L0-COMPAT-02 — unused LINE webhook and duplicate identity types

- Classification: F — obsolete-code cleanup candidate.
- Area: Shared LINE compatibility surface.
- Evidence / relevant paths:
  lib/line/index.ts:5-20, 58-131;
  lib/line/types.ts:1-15;
  modules/line/application/types.ts:1-17;
  modules/line/infrastructure/verification/verify-id-token.ts;
  app/api/line/webhook/route.ts;
  README.md:153-156;
  __tests__/lib/line.test.ts.
- Current behavior: sendLineWebhook, LineWebhookData, and the legacy
  VerifiedLineIdentity type remain exported. No repository-local production
  caller of sendLineWebhook or lib/line/types.ts was found. The inbound
  /api/line/webhook route is a separate signature-verification endpoint and
  must not be assumed to prove the outbound helper is unused externally.
  The README still documents LINE_WEBHOOK_URL and Email Request-related
  configuration.
- Security/reliability invariant: Removing a legacy transport or type must
  not disable an external/operator integration, inbound webhook contract, or
  configuration expected by deployment.
- Concrete failure scenario: An external Email Request integration or
  operator-provisioned webhook uses LINE_WEBHOOK_URL/sendLineWebhook even
  though no repository caller remains; deletion silently removes delivery.
  Removing the duplicate type without checking package/build consumers can
  also break external imports.
- Current mitigation: Current application LINE identity verification uses
  modules/line/application/types.ts; inbound webhook signature verification
  remains present; legacy exports remain available.
- Residual risk: Environment and external integration usage are not proven by
  repository search.
- Severity: Informational.
- Confidence: Medium for repository-local unused status; Low for external
  absence.
- Whether production behavior must change: No intended change; cleanup may
  remove externally visible compatibility.
- Whether schema/migration may be required: No.
- Compatibility constraints: Preserve LINE/LIFF contracts, inbound webhook
  behavior, Email Request deferral, README/deployment truth, and historical
  configuration until external validation is complete.
- Recommended future phase: L6.
- Acceptance criteria: Inventory deployed environment variables, Cloudflare/
  LINE console webhook configuration, external callbacks, operator runbooks,
  package consumers, and tests; decide whether to deprecate, retain, or
  remove each symbol independently.
- Required tests: Import/architecture scan; inbound webhook signature tests;
  outbound transport tests if retained; deployment configuration validation;
  external integration acceptance test if an integration exists.

## 13. Severity-ranked finding ledger

The severity is a prioritization signal, not a claim that every item is a
security vulnerability.

| Severity | ID | Classification | Finding | Production behavior change? | Phase |
| --- | --- | --- | --- | --- | --- |
| Medium | L0-AUTH-01 | B | Concurrent refresh can false-positive as reuse and revoke a legitimate family | Yes | L1 |
| Medium | L0-AUTH-02 | A | Session termination is not coordinated with rotation | Yes | L1 |
| Low | L0-AUTH-03 | C | Refresh pre-check omits deleted/Employee eligibility; supported lifecycle already revokes and invalidates sessions | No immediate; L1 decision | L1 |
| Medium | L0-REPLAY-01 | B/C | Generic web 401 recovery can replay mutations | Yes | L1 |
| Medium | L0-RATE-01 | B/C | Process-local abuse controls do not scale with topology | Conditional | L2 |
| Medium | L0-LINE-01 | D | No post-issuance LineAccountLink reread | Conditional | L3 |
| Medium | L0-NOTIF-01 | A | Timestamp-only cursor skips equal-timestamp rows | Yes | L4 |
| Medium | L0-OUTBOX-01 | D/B | At-least-once provider crash window can duplicate external effects | Evidence-dependent | L5 |
| Low | L0-AUDIT-01 | C | Raw familyId is sensitive correlation metadata | Policy decision | L3 |
| Informational | L0-AUTH-TEST-01 | C | Refresh concurrency evidence gap | No by itself | L1 |
| Informational | L0-AUDIT-02 | D/C | Security-event Audit persistence is best effort | No by itself | L3/L7 |
| Informational | L0-COMPAT-01 | F | lib/services/audit-log residue | No intended change | L6 |
| Informational | L0-COMPAT-02 | F | LINE webhook residue and duplicate identity types | No intended change | L6 |

There are no Critical or High findings supported by the L0 evidence. In
particular, L0 did not establish a current account-takeover path through the
refresh pre-check gap, a current double-execution path caused by a 401-after-
commit response, or an origin-bypass deployment failure. Those remain
acceptance/evidence requirements, not inflated severity labels.

## 14. Accepted/current design tradeoffs

The following are current choices that should not be “fixed” without an
explicit requirement:

1. Refresh-family revocation on confirmed/reported token reuse is a security
   containment tradeoff. L1 must decide how to reduce legitimate concurrency
   false positives without making stolen-token replay harmless.
2. LIFF does not reread LineAccountLink after issuance. This is a
   latency/availability tradeoff retained by the Auth migration. L3 must
   decide the stale-link maximum and enforcement mechanism.
3. Global Outbox delivery is at-least-once. A provider-specific duplicate
   contract is preferable to a generic exactly-once redesign.
4. Audit append is best effort so an Audit outage does not change the
   authorization or containment result. Operations must decide whether
   missing security events require a durable retry path.
5. Process-local rate limits may be adequate for a verified single-process
   deployment, but that is an operational invariant to prove, not an
   assumption to carry into a multi-instance deployment.
6. Historical TICKET_* enum/storage values, Email Request behavior, generic
   transports, and current Outbox ownership are compatibility constraints,
   not obsolete code to delete during L0.

## 15. Proposed L1-L7 roadmap

The proposed phase count and order remain valid. L0 adjusted scope within
phases rather than adding a K2 phase or inventing work.

| Phase | Validated scope | Adjustment supported by evidence |
| --- | --- | --- |
| L1 — Auth Refresh & Session Concurrency Hardening | Refresh state machine, concurrent rotation, logout/logout-all/session revoke ordering, full account-state eligibility, and bounded browser replay contract | Expanded to include the refresh/replay coupling because the shared 401 retry is the mechanism that can trigger the refresh race. Must begin with real-MySQL characterization tests. |
| L2 — Abuse Protection / Rate-Limit Hardening | Topology, key trust, atomic consume, restart behavior, unknown-IP policy, brute-force/enumeration budgets, observability | Backend remains undecided. Redis/MySQL/Cloudflare/external infrastructure is not selected in L0. |
| L3 — LINE / LIFF Identity & Audit Metadata Hardening | Link stale-window policy, unlink/relink invalidation, LIFF session enforcement, family-ID representation, Audit failure/retention monitoring | Keep separate from L1 because LIFF credentials and Audit compatibility have distinct contracts and operators. |
| L4 — Notification History Cursor Correctness | Stable ordered key, cursor encoding/backward compatibility, equal-timestamp and browser tests | Confirmed defect makes this a required phase; no schema change is assumed until index/performance evidence exists. |
| L5 — Outbox / Provider Reliability Hardening | Provider-specific ambiguity, retry-key coverage, SMTP limitations, stale recovery, DEAD visibility, superseding tests | Narrowed to evidence-backed provider/recovery hardening. Do not redesign the shared processor or claim exactly-once delivery generically. |
| L6 — Compatibility and Obsolete Residue Cleanup | External/operator validation and removal or formal retention of the two candidate groups | Keep deferred until external-consumer evidence is collected; no deletion in L0. |
| L7 — Final Production Hardening Re-audit | Re-run source/contract/threat-model review, verify deployment assumptions, confirm no scope drift, and close residual risks | Retained as the final gate; it must not reopen K2, Email Request migration, tenant work, or historical compatibility work. |

### 15.1 Recommended L1 scope

L1 should be deliberately narrow and start with these explicit invariants:

1. One source refresh token has one defined successor/terminal outcome.
2. A same-client simultaneous refresh has a documented result that does not
   accidentally revoke a valid session, while true reuse remains contained.
3. Logout-current, logout-all, session revoke, password reset, and employee
   offboarding have explicit ordering against refresh.
4. Refresh refuses to issue credentials for every account state that the
   protected resolver rejects.
5. Generic web 401 recovery is safe by construction: only an approved
   replay contract can resend a mutation, and request-body replayability is
   explicit.
6. Existing cookies, route URLs, status/response contracts, Audit action
   types, Thai messages, and LIFF-specific no-mutation-replay behavior remain
   compatible.

The first L1 deliverable should be the state/race matrix and real-MySQL test
harness. Implementation choices should follow those results; L0 does not
preselect a grace window, token-version design, row-lock design, or schema
change.

### 15.2 L1 Gate A — pre-implementation real-MySQL characterization

The first L1 test pass added
`__tests__/integration/auth-session-concurrency.integration.test.ts` and ran
the existing `scripts/run-mysql-integration-tests.mjs` harness against
MySQL `127.0.0.1:3309/employee_nhf_integration`. The test uses real Prisma
operations and checks refresh rows, family state, User state, Employee state,
tokenVersion, and protected-account resolution. It does not use repository
mocks for the race scenarios.

Observed baseline matrix before production changes:

| Scenario | Interleaving / sample | Observed database result | Evidence classification |
| --- | --- | --- | --- |
| Refresh vs refresh, same source | Eight concurrent runs | Each run produced exactly one successor; the source was revoked; all eight families were then revoked. The successful access token was therefore destroyed by the losing caller's reuse path. | Reproduced in every run of the repeated sample; the exact lock schedule is MySQL-dependent. |
| Refresh vs logout-current | Controlled commit order: termination first, then refresh; refresh first, then termination | Termination first left no active rows. Refresh first left the source revoked but its successor active, so the family remained usable. | Deterministic under the two controlled commit orders. This is the current source-only logout behavior, not a probabilistic inference. |
| Refresh vs logout-all | Eight concurrent runs | One refresh succeeded across the eight runs; all eight final families had zero active rows. | Final state contained in every repeated run; the relative statement order is inferred from the result and was not controlled by a barrier. |
| Refresh vs per-session family revoke | Eight concurrent runs | Two refreshes succeeded across the eight runs; all eight final families had zero active rows and all eight revoke calls found/processed the family. | Final state contained in every repeated run; the relative statement order is inferred from the result and was not controlled by a barrier. |
| Refresh vs password reset | One concurrent run | Refresh returned success in the sample; reset committed, User.tokenVersion became 2, all family rows were inactive, and protected-account resolution rejected the issued access token. | Observed final state; serializable reset transaction and conditional rotation explain the containment, but no deterministic barrier was inserted. |
| Refresh vs Employee OFFBOARD | One concurrent run | Refresh returned success in the sample; Employee became INACTIVE, User became inactive, tokenVersion became 2, all family rows were inactive, and protected-account resolution rejected the issued access token. | Observed final state; existing Employee/Auth transaction composition and row locks are the relevant evidence. |
| Refresh vs Employee SUSPEND | One concurrent run | Refresh returned success in the sample; Employee became SUSPENDED, User became inactive, tokenVersion became 2, all family rows were inactive, and protected-account resolution rejected the issued access token. | Observed final state; existing Employee/Auth transaction composition and row locks are the relevant evidence. |
| Refresh vs Employee REACTIVATE | One concurrent run from a suspended/inactive account | Lifecycle reactivation committed, User became active, tokenVersion became 2, all family rows were inactive, and the refresh attempt did not succeed. | Observed final state; no refresh successor escaped the lifecycle transaction. |

The baseline suite passed 73 tests across 11 integration files. The
characterization establishes two implementation facts needed for Gate B:
the same-token `alreadyRotated` path is currently a false-positive family
revocation for the repeated concurrent sample, and logout-current cannot
meet the termination invariant when a successor already exists. The other
termination races in this first sample ended contained, but their concurrent
statement ordering was not controlled and remains part of the implementation
regression suite.

### 15.3 L1 implementation / closure

This corrective pass closes the remaining time-unbounded refresh-reuse issue;
L1 status is **CLOSED**.

L1 implementation was completed from the Gate A evidence above. The final
contract below is the current source of truth for Auth/session refresh and
generic browser 401 recovery.

#### Gate A and final MySQL evidence

The characterization suite was retained and strengthened as
`__tests__/integration/auth-session-concurrency.integration.test.ts`. The
final run used the same MySQL harness and exercised 78 tests across 11
integration files. It repeated refresh/refresh, logout-all, and per-session
revoke schedules; used controlled commit-order checks for logout-current; and
asserted final database state, User.tokenVersion, Employee lifecycle state,
and `resolveAuthenticatedAccount()` results.

Final repeated observations were:

| Scenario | Final observed result after the correction |
| --- | --- |
| Refresh vs refresh | 8/8 runs had one normal successor and remained usable after the one concurrent completion; a further reuse of the old source revoked the family in 8/8 runs. |
| Refresh vs logout-current | Both termination-before-refresh and refresh-before-termination ended with zero active rows; a successor created first was revoked by logout-current. |
| Refresh vs logout-all | 8/8 concurrent runs ended with zero active rows. |
| Refresh vs per-session revoke | 8/8 concurrent runs ended with zero active rows; a different user could not revoke the family. |
| Refresh vs password reset | Reset committed with tokenVersion 2, zero active refresh rows, and protected resolution rejected any access token issued before the reset completed. |
| Refresh vs OFFBOARD/SUSPEND | Employee and User lifecycle state committed, tokenVersion incremented, zero active refresh rows remained, and protected resolution rejected any access token issued before invalidation. |
| Refresh vs REACTIVATE | Reactivation also increments tokenVersion and revokes the old family; the old refresh credential did not become usable. |
| Account eligibility | Deleted and suspended linked accounts were rejected and their families revoked; an active unlinked account remained supported and could refresh. |

The corrective timestamp cases use persisted timestamp setup rather than
sleeping for the security window. An immediate same-source completion keeps the
single successor and its family active; moving the source timestamps to 5,001
milliseconds before the reuse request leaves the successor marker null but
revokes the family; and reusing the source after an accepted completion also
revokes the family. The repeated refresh/refresh test remains in place as the
database-backed concurrency check.

#### Chosen refresh state machine

`rotateRefreshTokenAtomically` now locks the User row before reading the
source state, rereads the current User and Employee eligibility, and keeps
the existing conditional source claim and unique `rotatedFromId` constraint.
The application result names are precise rather than using the old
`alreadyRotated` ambiguity:

1. `rotated`: an eligible, unexpired, unrevoked source is claimed once and
   creates exactly one successor. The access token uses the account role and
   tokenVersion read under the same User-row coordination.
2. `concurrentCompletion`: the source is already revoked by a prior rotation,
   its `lastUsedAt` is non-null as the source-rotation proof, exactly one active
   unexpired direct successor exists, its existing `lastUsedAt` completion
   marker is null, and the absolute difference between the server request time
   and source `revokedAt` is at most
   `AUTH_REFRESH_CONCURRENT_COMPLETION_WINDOW_MS` (5,000 milliseconds). The
   marker is then atomically claimed. This result does not mint a second
   successor, does not revoke the family, and does not emit a malicious-reuse
   Audit event. The HTTP result remains the existing 401 shape, but preserves
   cookies so a winning concurrent response is not erased.
3. `confirmedReuse`: a rotated source is reused outside the five-second
   completion window, its completion marker was already claimed, or it has no
   active direct successor. The entire family is revoked in the same
   User-coordinated transaction and the existing
   `refresh_token_reuse_or_expired` security event is emitted.
4. `expired`: the family is revoked and the existing reuse/expired security
   event is emitted.
5. `revoked`: an explicitly terminated family cannot create a successor and
   does not create a false malicious-reuse event.
6. `inactiveAccount`: current `User.isActive`, `User.deletedAt`, or the
   existing `hasEligibleEmployeeLifecycle` contract rejects issuance; the
   family is revoked and the existing inactive-user security event is emitted.
7. `invalid`: missing or inconsistent source state produces no successor.

The completion marker uses the existing successor `lastUsedAt` column. It is a
one-use marker, not proof of concurrency by itself. The request-count bound is
one successful marker claim per source; the time bound is five seconds from the
source rotation boundary. The source `revokedAt` is the persisted boundary
written when the source is claimed, while non-null source `lastUsedAt` excludes
a source that was only explicitly terminated. Successor `createdAt` is not
used as the boundary because it is a database-default timestamp and does not
provide a more reliable request-overlap signal than the source claim timestamp.
The request timestamp is generated server-side and is never client supplied;
the absolute comparison also supports a legitimate loser whose timestamp was
captured just before the User-row lock was acquired. At the inclusive boundary
the marker may be claimed. Outside it, an unused marker is not accepted:
the request is confirmed reuse, the family is revoked, and the caller receives
the existing unauthorized/reuse-Audit behavior. A concurrent caller inside the
window still receives 401 and no new credential. This is the smallest bounded
policy supported by the existing schema while avoiding the observed
false-positive family destruction.

#### Why this design and rejected alternatives

The User row lock is already used by Employee lifecycle code and can be
shared by refresh, logout, reset, and family revocation. It gives all
relevant operations one ordering point without weakening the source claim or
the `rotatedFromId` uniqueness invariant. The existing source timestamps and
`lastUsedAt` field provide a durable rotation boundary and conditional
completion marker; no new persistent state was needed.

The following alternatives were rejected: unconditional family revocation
for every already-rotated source (the reproduced L0-AUTH-01 failure), making
all already-rotated reuse harmless (unbounded stolen-token reuse), an
unbounded grace window, a generation model, a new token table, a distributed
lock, and a schema migration. Gate A did not demonstrate that the existing
schema was insufficient for a bounded one-time completion contract.

The exact security tradeoff is that at most one ambiguous old-source request
inside the five-second server-time window may consume the completion marker
without revoking the family. It still cannot mint a credential or independent
successor. A request outside the window, or a second reuse after the marker is
claimed, revokes the family and emits the reuse security event. The absolute
timestamp comparison tolerates the small pre-lock ordering/clock-skew case
within that same five-second bound; it does not accept a client-controlled
timestamp. This bounded ambiguity is accepted to prevent a single legitimate
near-simultaneous browser request from destroying the successful session.

#### Termination ordering contract

All successful termination paths now coordinate through the User row before
refresh-family writes. If termination commits first, refresh observes the
revoked/ineligible state and cannot create a successor. If refresh commits
first, termination observes and revokes the newly created successor. If both
overlap, the User row lock serializes them; the final state, independent of
which request returns first, has no usable targeted refresh successor.

- logout-current resolves the supplied token's family and revokes every
  unrevoked row in that family, including a successor already created from
  the supplied source. Repeated logout remains idempotent.
- A terminated family has no active successor eligible for
  `concurrentCompletion`. Post-termination reuse therefore remains unusable;
  a previously rotated source follows the confirmed-reuse path, while a source
  that was only terminated follows the explicit-revocation path.
- logout-all locks the account User row before revoking all of that user's
  refresh rows.
- per-session revoke retains the user/family ownership check, then locks the
  owning User row before family revocation.
- password reset retains the one-time reset-token claim and serializable
  transaction, and now locks User before claiming, updating the password and
  tokenVersion, and revoking refresh rows.
- Employee OFFBOARD, SUSPEND, and REACTIVATE retain Employee-owned lifecycle
  policy and the existing serializable Employee/Auth composition. Auth still
  owns account/session effects; User tokenVersion and refresh revocation are
  committed with the lifecycle transition.

#### Generic browser 401 replay contract

The shared browser transport may recover a 401 through the single-flight Auth
refresh request. Only GET and HEAD are replayable after successful recovery.
POST, PUT, PATCH, and DELETE still attempt session recovery so subsequent
requests can use the refreshed session, but return the original unauthorized
response and never automatically resend the mutation. No production mutation
caller was found that requires an implicit replay contract.

The policy applies to `fetchWithRefresh`, `lib/client/api-client.ts`, and the
Auth browser API. JSON strings, FormData, URLSearchParams, Blob, ArrayBuffer,
and ReadableStream bodies are not cloned or silently resent for mutations.
Auth-internal paths remain excluded from recursive recovery. LIFF keeps its
existing safe-read-only replay behavior; regression tests cover all four
mutation methods and GET/HEAD recovery.

#### Finding dispositions

| Finding | L1 disposition |
| --- | --- |
| L0-AUTH-01 | Closed. Real MySQL reproduced the false-positive; User coordination plus one-use completion bounded by both one request and five seconds now preserves the legitimate successor and retains confirmed-reuse containment. |
| L0-AUTH-02 | Closed. Refresh, current-family logout, logout-all, per-session revoke, password reset, and Employee lifecycle invalidation share an explicit final-state ordering contract. |
| L0-AUTH-03 | Closed as defense-in-depth. Refresh now rereads the protected account eligibility contract before issuance; unlinked valid accounts remain supported. This was not an authorization-bypass finding. |
| L0-AUTH-TEST-01 | Closed. The real-MySQL characterization and final repeated concurrency suite are part of the repository integration tests. |
| L0-REPLAY-01 | Closed. Shared browser recovery now replays only GET/HEAD; mutation and one-shot-body tests prove no implicit resend; LIFF remains strict. |

#### Schema, migration, and remaining risk

No Prisma schema, migration, cookie name, route URL, or external Auth
response shape changed. The existing User row, refresh-family rows,
`rotatedFromId` uniqueness, source timestamps, and `lastUsedAt` column satisfy
the final invariants. The only accepted residual Auth/session risk is the
documented one-time ambiguity for an old source inside the five-second
server-time window; it is also limited to one marker claim, cannot mint a
credential, and escalates to family revocation on the next/out-of-window reuse.
Deployment clocks must remain sufficiently synchronized for the server-side
timestamp comparison; no client timing field is trusted. Distributed rate
limiting and other abuse controls remain L2 scope.

The exact command/results record is maintained below after the final
repository verification pass.

## 16. L0 closure acceptance criteria

L0 is ready to close when all of the following are true:

- the current implementation, callers, persistence operations, transactions,
  deployment assumptions, and relevant tests have been inspected;
- every retained debt above has a concrete current behavior and failure/
  attack sequence;
- each finding has a classification, severity, confidence, compatibility
  impact, production-change flag, schema/migration flag, phase, acceptance
  criteria, and test requirements;
- confirmed defects are separated from risks, defense-in-depth, intentional
  tradeoffs, compatibility constraints, and cleanup candidates;
- no L0 change modifies executable code, tests, Prisma schema, migrations,
  API contracts, or runtime behavior;
- L1 can begin from the invariants and race scenarios in sections 5.2,
  5.3, 5.4, 5.5, 6.3, and 15.1 rather than generic hardening assumptions;
- the required repository checks in section 17 have been executed and
  recorded.

## 17. Verification record

L0 is documentation/discovery only. No executable code, test, Prisma schema,
migration, or deployment file was changed.

Required checks:

- git status inspection: PASS before authoring; PASS after authoring with only
  this document and `final-repository-audit.md` changed;
- git diff inspection: PASS; final diff is limited to the two architecture
  documents;
- `npm run architecture:check`: blocked by the local PowerShell execution
  policy for `npm.ps1`; equivalent `npm.cmd run architecture:check`: PASS
  (`997` repository source files checked);
- git diff --check: PASS;
- development server: NOT RUN;
- production build: NOT RUN;
- broader test suite: NOT RUN because no runtime behavior or test code
  changed.

The absence of a real refresh concurrency integration test is recorded as
L0-AUTH-TEST-01 and is an explicit L1 prerequisite, not an assumption that
the mocked route tests prove database atomicity.

## 18. L1 verification record

The L1 implementation verification record is separate from the historical L0
record above.

- corrective-pass baseline `git status --short --branch`: PASS; the worktree
  was clean at reviewed commit `ad1d23f80694e8428a9505d907f4c2a35e48e564`;
- pre-fix Gate A `npm.cmd run test:integration:mysql`: PASS against
  `127.0.0.1:3309/employee_nhf_integration`; Prisma reported no pending
  migrations and Vitest passed 11 files / 75 tests;
- focused Auth/session, Auth API, browser transport, LIFF, critical-flow,
  reset, and Employee lifecycle command: PASS, 8 files / 98 tests;
- `npm.cmd run architecture:check`: PASS (1,000 repository source files
  checked);
- `npm.cmd run lint:strict`: PASS;
- `npm.cmd run typecheck`: PASS;
- `npm.cmd run test:run`: PASS, 257 files / 2,133 tests;
- final `npm.cmd run test:integration:mysql`: PASS against
  `127.0.0.1:3309/employee_nhf_integration`; Prisma reported no pending
  migrations and Vitest passed 11 files / 78 tests;
- `git diff --check`: PASS;
- development server: NOT RUN;
- production build: NOT RUN;
- Prisma schema/migration diff: NONE; the integration harness applied no new
  migration.

On Windows PowerShell, `npm.ps1` is blocked by the local execution policy, so
all npm script verification above used the equivalent `npm.cmd` command.
