# Runtime Security and Reliability Hardening Baseline

Status: L7 repository gate passed — production deployment acceptance pending
Track: L-series runtime/security/reliability hardening
Evidence date: 2026-09-10
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

## 2. L0 baseline and repository state (historical record)

> **Historical-state marker:** Sections 2.1–2.2 preserve the L0 baseline
> observed before L1-L6. Phrases such as “current control” and “remaining
> observation” in this section mean “current at L0”; they are not claims about
> the final implementation. The post-L1-L6 current state is recorded in
> Sections 18–23 and the final L7 re-audit is in Section 24.

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

### 4.4 Threat/reliability scenarios (L0 historical baseline)

> The scenarios below preserve the L0 threat model. Their “can” and “does
> not” statements describe the pre-hardening behavior used to justify L1-L6;
> compare the current closure sections and Section 24 for the final result.

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

## 5. Auth refresh and session findings (L0 historical baseline)

> The finding cards in Sections 5–12 are retained L0 evidence. Their
> “Current behavior”, “Current mitigation”, and “Recommended future phase”
> labels are historical-at-L0 labels. They must not be read as current source
> claims after the closure records in Sections 18–23.

### 5.1 L0 historical refresh lifecycle

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

## 6. Generic web mutation replay findings (L0 historical baseline)

### 6.1 L0 historical transport behavior

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

## 7. Rate-limit and abuse-control findings (L0 historical baseline)

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

## 8. LINE / LIFF identity findings (L0 historical baseline)

### 8.1 L0 historical account-link and LIFF lifecycle

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

## 9. Refresh security Audit metadata findings (L0 historical baseline)

### 9.1 L0 historical metadata and consumers

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

## 10. Notification history cursor findings (L0 historical baseline)

### 10.1 L0 historical query and API contract

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

## 11. Outbox and external-provider reliability findings (L0 historical baseline)

### 11.1 L0 historical claim/retry/state behavior

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

## 12. Compatibility and obsolete-code candidates (L0 historical baseline)

These are cleanup candidates, not defects. The L0 descriptions below preserve
the original discovery evidence. The L6 dispositions are the current status;
historical L0 wording is labelled where it no longer describes the source tree.

### 12.1 Finding L0-COMPAT-01 — lib/services/audit-log residue

- Classification: F — obsolete-code cleanup candidate.
- Area: Audit compatibility seam.
- Evidence / relevant paths:
  lib/services/audit-log/index.ts;
  lib/services/audit-log/mutations.ts;
  lib/services/audit-log/queries.ts;
  lib/services/audit-log/types.ts;
  modules/audit/index.ts;
  scripts/check-architecture.mjs (L0 baseline server-only directory lists).
- L0 baseline behavior: The legacy path re-exported or wrapped modules/audit. No
  production source import was found in the repository; the architecture
  checker still knows the path as a server-only directory.
- Security/reliability invariant: Removing a compatibility path must not
  break deployed code, operator scripts, build-time architecture checks, or
  historical Audit behavior.
- Concrete failure scenario: An external script, deployment artifact, or
  operator import still references the old path. Removing it causes a
  runtime or deployment failure even though repository-local imports are
  absent.
- L0 mitigation (historical at L0): The current modules/audit entry owned active behavior;
  the residue is retained and the architecture checker accounts for it.
- L0 residual risk (historical at L0): External consumers and deployed bundles were not visible
  from repository search.
- Severity: Informational.
- Confidence: High for no in-repository production caller; Low for external
  consumer absence.
- L6 disposition: **REMOVED**. The four files were removed after the complete
  repository consumer scan found no production, test-contract, script,
  operator, deployment, build, or package consumer; `package.json` is private
  and has no export map; and the repository deployment instructions build from
  a fresh source checkout. An untracked script in an external checkout cannot
  be inspected, so that residual assumption is recorded in the L6 closure.
- Current state: `modules/audit` is the only Audit application/query/retention
  owner. The duplicate legacy `UserContext` disappeared with the removed
  compatibility types file and was not moved elsewhere.
- Whether production behavior must change: No intended behavior change, but
  deletion is itself a compatibility change until evidence is complete.
- Whether schema/migration may be required: No.
- Compatibility constraints: Preserve modules/audit API, historical Audit
  export/display representations, scripts, and architecture checks.
- Historical recommendation at L0: L6.
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
- L0 baseline behavior: sendLineWebhook, LineWebhookData, and the legacy
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
- L0 mitigation (historical at L0): Current application LINE identity verification uses
  modules/line/application/types.ts; inbound webhook signature verification
  remains present; legacy exports remain available.
- L0 residual risk (historical at L0): Environment and external integration usage are not proven
  by repository search.
- Severity: Informational.
- Confidence: Medium for repository-local unused status; Low for external
  absence.
- L6 symbol dispositions:
  - `sendLineWebhook`, `lineNotificationService.sendLineWebhook`,
    `LineWebhookData`, and `LINE_WEBHOOK_URL`: **FORMALLY RETAINED**. The
    variable remains in the local ignored environment, `.env.example`,
    README, and `docs/line-routine.md`; no live deployment, LINE Console,
    Cloudflare, or operator environment was available to verify whether an
    external integration consumes it.
  - `lib/line/types.ts` `VerifiedLineIdentity`: **REMOVED** independently.
    The repository has no consumer, the type is compile-time only, the package
    is private with no export map, and the authoritative type remains exported
    by `modules/line`.
- Current state: Inbound `/api/line/webhook` and its signature verifier are
  unchanged. Active IT, Stock, NHFapp, Email Request, LINE/LIFF identity, and
  Outbox paths remain on their existing channel contracts.
- Whether production behavior must change: No intended change; cleanup may
  remove externally visible compatibility.
- Whether schema/migration may be required: No.
- Compatibility constraints: Preserve LINE/LIFF contracts, inbound webhook
  behavior, Email Request deferral, README/deployment truth, and historical
  configuration until external validation is complete.
- Historical recommendation at L0: L6.
- Acceptance criteria: Inventory deployed environment variables, Cloudflare/
  LINE console webhook configuration, external callbacks, operator runbooks,
  package consumers, and tests; decide whether to deprecate, retain, or
  remove each symbol independently.
- Required tests: Import/architecture scan; inbound webhook signature tests;
  outbound transport tests if retained; deployment configuration validation;
  external integration acceptance test if an integration exists.

## 13. Severity-ranked finding ledger (L0 historical baseline)

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
| Informational | L0-COMPAT-01 | F | lib/services/audit-log residue — REMOVED in L6 | No intended change | L6 CLOSED |
| Informational | L0-COMPAT-02 | F | LINE compatibility residue — outbound surface FORMALLY RETAINED; duplicate identity type REMOVED in L6 | No intended change | L6 CLOSED |

There are no Critical or High findings supported by the L0 evidence. In
particular, L0 did not establish a current account-takeover path through the
refresh pre-check gap, a current double-execution path caused by a 401-after-
commit response, or an origin-bypass deployment failure. Those remain
acceptance/evidence requirements, not inflated severity labels.

## 14. Accepted design tradeoffs at L0 (historical record)

The following was the L0 decision context. It is retained as historical
evidence; the final accepted tradeoffs are restated in Section 24 and should
be used for current decisions:

1. Refresh-family revocation on confirmed/reported token reuse was a security
   containment tradeoff. L1 later bounded same-client completion without
   making stolen-token replay harmless.
2. LIFF did not reread LineAccountLink after issuance at L0. L3 later selected
   immediate current-link enforcement for protected requests.
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

## 15. Proposed L1-L7 roadmap (historical plan)

The proposed phase count and order are retained as the historical handoff.
Actual implementation and final status are recorded in Sections 18–24.
L0 adjusted scope within phases rather than adding a K2 phase or inventing
work.

| Phase | Validated scope | Adjustment supported by evidence |
| --- | --- | --- |
| L1 — Auth Refresh & Session Concurrency Hardening | Refresh state machine, concurrent rotation, logout/logout-all/session revoke ordering, full account-state eligibility, and bounded browser replay contract | Expanded to include the refresh/replay coupling because the shared 401 retry is the mechanism that can trigger the refresh race. Must begin with real-MySQL characterization tests. |
| L2 — Abuse Protection / Rate-Limit Hardening | Topology, key trust, atomic consume, restart behavior, unknown-IP policy, brute-force/enumeration budgets, observability | Backend remains undecided. Redis/MySQL/Cloudflare/external infrastructure is not selected in L0. |
| L3 — LINE / LIFF Identity & Audit Metadata Hardening | Link stale-window policy, unlink/relink invalidation, LIFF session enforcement, family-ID representation, Audit failure/retention monitoring | Keep separate from L1 because LIFF credentials and Audit compatibility have distinct contracts and operators. |
| L4 — Notification History Cursor Correctness | Stable ordered key, cursor encoding/backward compatibility, equal-timestamp and browser tests | Confirmed defect makes this a required phase; no schema change is assumed until index/performance evidence exists. |
| L5 — Outbox / Provider Reliability Hardening | Provider-specific ambiguity, retry-key coverage, SMTP limitations, stale recovery, DEAD visibility, superseding tests | Narrowed to evidence-backed provider/recovery hardening. Do not redesign the shared processor or claim exactly-once delivery generically. |
| L6 — Compatibility and Obsolete Residue Cleanup | External/operator validation and removal or formal retention of the two candidate groups | COMPLETE: Audit compatibility files were REMOVED; the outbound LINE compatibility surface was FORMALLY RETAINED because live external usage is not observable; the duplicate legacy identity type was REMOVED. |
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

## 19. L2 implementation / closure

L2 was implemented from reviewed baseline `266a869707857401204498736a6d44a1a602ab6b`.
Phase L0 and Phase L1 were already closed. This section is the authoritative
record for L2 and does not rewrite the historical L0/L1 findings above.

### 19.1 Gate A — complete abuse-control inventory

The repository-wide caller inventory was performed for
`isAuthRateLimited`, `recordAuthAttempt`, `clearAuthIdentityRateLimit`,
`enforcePreAuthIpRateLimit`, `enforceAuthenticatedMutationRateLimit`, and
`getTrustedClientIp`. The application-level controls found are:

| Control | Current owner and behavior | Failure/abuse boundary |
| --- | --- | --- |
| Auth identity/IP limiter | `lib/auth/rate-limit.ts`; process-local `Map`, fixed windows, normalized identity, and a valid trusted-IP value or `unknown` bucket | Login, signup, and forgot-password budgets; reset clears the map |
| Mutation limiter | `lib/security/mutation-rate-limit.ts`; process-local `Map`, fixed windows, synchronous consumption, periodic/at-cap expiry cleanup, and a 50,000-entry ceiling | Pre-auth trusted-IP and authenticated user budgets; new keys fail closed at capacity |
| Trusted mutation check | `withTrustedMutation` checks the existing trusted Origin / `X-Requested-With` contract on browser mutations | Rejects untrusted mutation requests before the route handler; it is not a quota |
| Request body limits | `lib/server/request-body.ts` and module HTTP helpers bound the body stream; Leave and Stock JSON are 32 KiB, Routine is 64 KiB, and LINE auth is 16 KiB | Oversized or malformed bodies return the existing 413/400 responses |
| Leave attachments | Maximum three files, 8 MiB per file, 20 MiB total, 25,000,000-byte request bound, and allowlisted image formats/dimensions | Bound before/while multipart processing; private storage and orphan cleanup remain in the Leave module |
| Database password-reset budget | `PasswordResetToken` rows are counted in the existing one-hour, three-request database check before a new token is created | The database result is a separate durable control; rate-limited, unknown, inactive, and email-send-failure paths retain accepted anti-enumeration behavior |
| Mutation idempotency and state constraints | Leave, Stock, and Routine create flows use caller idempotency keys with database uniqueness/request-hash or state/version rules; Email Request has its existing idempotency service | Prevents retried requests from creating duplicate business effects; it is not a request-rate budget |
| Reverse-proxy limits | The supported Nginx example sets `client_max_body_size 25m` and `client_body_timeout 30s` | Applies only when traffic reaches Nginx; direct Next.js exposure is unsupported |

The following are application mutation endpoints with no application-level
rate-limit call after the repository-wide search: Employee create/update/delete
and other Employee reads, Email Request mutations, webhook handlers, cleanup
endpoints, and scheduled maintenance endpoints. They retain their existing
authentication/authorization, validation, secret, audit, idempotency, or
provider controls. L2 does not add a speculative quota to them.

#### Auth endpoint inventory

The response shorthand in this table is exact:

- `M429` means status `429`, body
  `{ "error": "มีคำขอมากเกินไป กรุณาลองใหม่ภายหลัง" }`,
  `Cache-Control: no-store`, `Retry-After` equal to the remaining fixed-window
  seconds (at least one), `X-RateLimit-Limit` equal to the scope maximum, and
  `X-RateLimit-Remaining: 0`.
- `L429` means status `429`, body `{ "error": "Unauthorized" }`, with no
  `Retry-After` or `X-RateLimit-*` headers.
- `S429` means status `429`, body `{ "error": "ลองใหม่อีกครั้งภายหลัง" }`,
  with no rate-limit headers.
- `FOK` means status `200` and the unchanged accepted body
  `{ "success": true, "message": "หากอีเมลนี้มีอยู่ในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล" }`.

| Endpoint and owner | Authentication state and scope/key | Window and maximum | Count timing, success clearing, and independent controls | Limited response / IP and restart contract |
| --- | --- | --- | --- | --- |
| `POST /api/auth/hybrid-login`, Auth; identity bucket | Pre-auth request with normalized `trim().toLowerCase()` email; `login:identity:<email>` | Fixed 15 minutes; 8 failed credentials | L2 reserves synchronously before asynchronous authentication, commits only `invalidCredentials`, and releases on success or authentication exception. Success does not clear prior failures. `LOGIN_FAILED` Audit behavior is unchanged. | `L429`; IP is not part of this key. Missing trusted IP is handled by the separate IP bucket. Process restart clears state; independent processes do not share it. |
| `POST /api/auth/hybrid-login`, Auth; IP bucket | Pre-auth request; `login:ip:<trusted CF IP or unknown>` | Fixed 15 minutes; 40 failed credentials | The same reservation commits/releases with the identity reservation. The route also consumes the generic `auth-login` pre-auth mutation budget for every request before JSON parsing. | `L429` for the identity/IP Auth bucket; the generic pre-auth bucket is `M429`. No Auth-map success clearing. |
| `POST /api/auth/signup`, Auth; identity and IP buckets | Valid schema input; normalized email identity and `signup:ip:<trusted CF IP or unknown>` | Fixed 1 hour; identity 5, IP 25 | `recordAuthAttempt` occurs before `signupAccount`. Validation failures occur before the Auth limiter. Successful account creation clears only the identity bucket; it never clears the IP bucket. Eligibility, duplicate-account, and other account-creation failures remain counted. Database uniqueness remains the final duplicate constraint. | `S429`; no `Retry-After` or `X-RateLimit-*`. Missing trusted IP uses the shared `unknown` bucket. Restart/process isolation is process-local. |
| `POST /api/auth/forgot-password`, Auth recovery; identity and IP buckets | Valid schema input; normalized email identity and `forgot-password:ip:<trusted CF IP or unknown>` | Fixed 1 hour; identity 3, IP 30 | L2 reserves before the asynchronous database request. A database `rateLimited` result releases the reservation to avoid double-counting the same request; unknown/inactive and known-account results commit. No success clears the bucket. The durable `PasswordResetToken` three-per-hour check remains independent. | Schema-invalid parsed input, unknown/inactive, application-limited, database-limited, and email-send-failure outcomes preserve `FOK`; malformed JSON retains the existing generic 500 handler. No account existence is disclosed. Restart/process isolation is process-local. |
| `POST /api/auth/refresh`, Auth; generic pre-auth IP bucket | Trusted mutation; `pre-auth:auth-refresh:ip:<trusted CF IP or unknown>` | Fixed 15 minutes; 300 requests | Consumed before refresh work. No identity Auth-map bucket and no success clearing. Refresh rotation, `concurrentCompletion`, five-second completion window, reuse containment, cookie behavior, and reuse Audit behavior remain the L1 contract. | `M429`; exact L1 refresh responses remain otherwise unchanged. Restart/process isolation is process-local. |

At the reviewed baseline, hybrid login and forgot-password used a separate
`isAuthRateLimited` check followed by asynchronous work and
`recordAuthAttempt`; the final implementation uses the reservation primitive
for those two failed-authentication flows. Signup intentionally retains its
record-before-business semantics. `clearAuthIdentityRateLimit` has one
production caller, successful signup, and clears only the identity key.

`POST /api/auth/reset-password`, logout, logout-all, session revoke, session
cleanup, and the Auth/LINE identity endpoints have no application-level
rate-limit caller. Reset-password instead relies on the existing hashed,
expiring, one-time token claim and transactional password/session invalidation;
the other endpoints retain their existing authentication, authorization,
trusted-mutation, body-limit, token, or secret controls. This inventory result
is intentional; L2 does not add a quota to unrelated Auth or LINE endpoints.

#### Business mutation inventory

All mutation limiter responses are `M429`. Successful requests do not emit
rate-limit headers and do not clear a bucket. Pre-auth keys use the only
application client-IP source, `getTrustedClientIp(request.headers)`; the
authenticated keys use the server-authenticated `auth.user.id`, never a
client-supplied user ID. Both maps remain fixed-window and process-local.

| Capability owner and production callers | Pre-auth trusted-IP scope (15-minute maximum) | Authenticated user scope (1-minute maximum) | Timing and independent business control |
| --- | --- | --- | --- |
| Leave dashboard and Leave LIFF: `app/api/leave/request`, `cancel`, `decision`, `not-taken`, and corresponding `app/api/line/leave/*` routes | `leave-request-create` 60; `leave-cancel` 120; `leave-decision` 120; `leave-not-taken` 120 | Same scopes: 10, 20, 20, 20 respectively | Pre-auth consumption is before authentication/business execution; authenticated consumption is after server authentication and before the mutation handler. Leave request creation retains idempotency, quota/status checks, and transaction rules. |
| Stock dashboard and Stock LIFF: request create, request cancel, request issue/review, and item adjust routes under `app/api/stock/*` and `app/api/line/stock/*` | `stock-adjust` 300; `stock-request-create` 300; `stock-request-cancel` 300; `stock-request-issue` 300 | Same scopes: 30, 10, 20, 30 respectively | Pre-auth consumption happens before authentication; authenticated consumption remains at the existing route-specific point after auth and required input/header validation, before business mutation. Stock request creation retains `Idempotency-Key`, request-hash, uniqueness, serializable/locking, and state rules. Review selects the existing cancel/issue scope. |
| Routine dashboard: task create/update/delete, occurrence admin edits, and import preview/apply/cancel/row routes under `app/api/routines/*`; Routine LIFF task create/update/delete under `app/api/line/routine/*` | Policies exist for `routine-task-create` 60, `routine-task-update` 120, `routine-task-delete` 60, `routine-occurrence-admin` 180, and `routine-import` 30, but no current production Routine route calls the pre-auth function | `routine-task-create` 20; `routine-task-update` 40; `routine-task-delete` 20; `routine-occurrence-admin` 60; `routine-import` 12 | Current Routine production callers consume only the authenticated user scope after server authentication and before the business handler. Existing task idempotency, import staging/state/version, and authorization remain owned by Routine. The unused pre-auth policies are inventory/configuration, not evidence of active protection. |

The mutation map cleanup runs before capacity denial when the cleanup
interval has elapsed or the map reaches capacity. It removes entries whose
fixed window has expired. If 50,000 live entries remain, a new key is denied
closed with the policy window as `Retry-After`; an existing key is still
evaluated against its own quota. `unknown` is one shared pre-auth key per
scope, not a per-request fallback identity.

#### Trusted-IP helper caller inventory

`getTrustedClientIp` has these production responsibilities: mutation
pre-auth keys; Auth session/audit metadata in
`lib/auth/hybrid/session.ts` and `lib/server/audit.ts`; Routine command actor
metadata; Stock command actor metadata; and Employee create/update/delete
audit actor metadata. It accepts only a syntactically valid single
`CF-Connecting-IP` value. It rejects missing, malformed, and comma-separated
values and ignores `X-Forwarded-For`, `X-Real-IP`, `True-Client-IP`, and other
forwarding headers. These audit metadata callers do not create a rate-limit
fallback from those headers.

### 19.2 Gate B — supported production topology

Repository evidence was reconciled across `README.md`,
`docs/leave-attachments-deployment.md`, both Cloudflare Tunnel guides,
`docker-compose.yml`, `docker-compose.integration.yml`, the Nginx examples,
`package.json`, `next.config.ts`, and the repository-wide deployment/config
search.

The current supported production topology is:

```text
Internet → Cloudflare → Nginx :443 → one Next.js process at 127.0.0.1:3000
                                      ↓
                                  MySQL :3308
                                      ↓
                              persistent local .uploads/
```

`docker-compose.yml` supplies MySQL only. There is one Nginx upstream address,
no PM2/systemd/supervisor configuration that declares a cluster, and no
environment variable that selects an application process count. The
production `start` script now explicitly runs `next start --hostname
127.0.0.1`; a supervisor may restart that one process but must not run PM2
cluster mode or multiple application workers.

The explicit answers to the topology gate are:

1. **One Next.js process is the current supported production invariant:** yes.
2. **PM2 cluster mode is supported:** no; PM2 is acceptable only as a
   single-process supervisor.
3. **Multiple app processes behind Nginx are supported:** no.
4. **Multiple hosts are supported:** no.
5. **Does local upload storage constrain instances:** yes. The current local
   `.uploads/` deployment needs one instance, or a separately designed shared
   filesystem/object-storage contract before any scale-out.
6. **Does a documented deployment require rate-limit counters to survive
   restart:** no. Supervisor restart/reboot is documented for process
   availability, not counter durability.
7. **Is horizontal scale a current production requirement:** no. It is a
   future architectural possibility with explicit prerequisites.

It is technically possible to start additional Node processes or point a
Tunnel directly at port 3000, but those are not supported deployment modes.
The current Tunnel guide publishes the complete application hostname without
path-specific ingress rules and routes it through Nginx. The former
path-specific examples and obsolete hostnames are no longer current guidance.
Before any future multi-instance deployment, the limiter state, upload storage,
health behavior, cleanup, failure policy, and integration tests must be
redesigned and accepted together.

There is no current operational requirement for Auth or mutation counters to
survive a process restart. Restart clearing is therefore an explicit accepted
tradeoff for the current burst/brute-force controls, not an accidental claim
of durable enforcement.

### 19.3 Gate C — concurrency, restart, and capacity characterization

The baseline focused limiter command passed 3 files / 14 tests before the
implementation. The controlled hybrid-login barrier then established the
pre-fix behavior: ten parallel invalid requests for the same normalized
identity and IP all passed the eligibility check and completed as `401`, even
though the identity budget was eight. The next request was `429`. The
observable identity overshoot was therefore **two requests** in that run
(10 admitted versus 8), caused by the check → asynchronous authentication →
record gap. With more concurrently admitted work, the overshoot was bounded
only by the number of requests that could pass the check and by the separate
IP budget, not by the eight-failure identity budget.

The final reservation test uses the same deterministic barrier and admits
exactly eight invalid authentication calls; the remaining two return `429`
before authentication. The reservation check and both bucket increments are
synchronous within one JavaScript execution turn. A successful authentication
or an authentication exception releases both reservations, while an invalid
credential commits both. This preserves failed-attempt semantics and avoids
counting successful logins as failures.

The focused Auth characterization covers:

- normalized identity isolation, same-identity/different-IP behavior, and
  same-IP/different-identity behavior;
- sequential and parallel exact boundaries;
- success release, signup identity-only clearing with IP retention, and
  fixed-window expiry;
- unknown-IP sharing and explicit reset behavior; and
- forgot-password invalid, unknown, known, application-limited, and
  database-limited accepted responses.

The focused mutation characterization proves the exact boundary for each
key, synchronous simultaneous consumption, scope isolation, authenticated
user isolation behind one IP, trusted-IP isolation, fixed-window reset,
unknown-client sharing, cleanup before capacity denial, and process reset.
The capacity test fills all 50,000 live entries with unique pre-auth IPs in a
single bounded loop, then proves that an unrelated authenticated user's new
key is denied. After the 15-minute expiry, cleanup runs and a new key is
accepted. This demonstrates that one source can exhaust the shared map
capacity across capabilities; it does not increase the ceiling. Each first
seen unique key is inserted on its first synchronous consume, so 50,000
unique-key requests within the window are sufficient to fill the map; there
is no separate novelty fill-rate quota. The map is bounded at 50,000 entries,
but the repository does not claim a portable byte measurement because V8
string/map overhead is runtime-specific.

`consume()` has no `await`, so concurrent calls to one module instance cannot
interleave between its check and increment. Separate isolated module-instance
tests show the converse topology property: each instance starts with an
independent Auth and mutation map. A process restart creates the same fresh
state, and the exported test reset functions make that contract explicit.
No production server was spawned for this characterization.

### 19.4 Gate D — Cloudflare/Nginx/application client-IP boundary

Before L2, `deployment/nginx/employee_nhf.cloudflare-origin.conf` included
the Cloudflare source ranges and configured:

```nginx
real_ip_header CF-Connecting-IP;
real_ip_recursive on;
```

but did not overwrite the application-facing `CF-Connecting-IP` header. Nginx
therefore used its real-IP module to derive `$remote_addr` for Nginx-side
behavior while the upstream could still receive the original incoming header.
If that origin were directly reachable and a caller sent
`CF-Connecting-IP: 203.0.113.x`, the application helper would accept that
syntactically valid spoofed value even though the peer was not an authorized
Cloudflare source.

The Nginx configuration now explicitly sets:

```nginx
proxy_set_header CF-Connecting-IP $remote_addr;
```

after the real-IP directives. With `set_real_ip_from` restricted to the
Cloudflare ranges, a request from an authorized Cloudflare edge gets the
canonical client address; a direct untrusted peer does not get to rewrite
`$remote_addr` using its header and the application receives the peer address
instead of the spoofed value. The application still ignores arbitrary
forwarding headers. A static Nginx regression test checks the include,
real-IP directives, loopback upstream, and overwrite invariant.

This correction depends on the origin reachability invariant: port 3000 must
remain loopback-only and the origin firewall must not expose a bypass. A
Cloudflare Tunnel pointed directly at `localhost:3000` bypasses this Nginx
canonicalization and is therefore not supported for production under this
record. The current public Tunnel contract routes the complete application
hostname, without path-specific ingress rules, through Nginx. This still
requires an operator-verified trusted tunnel-to-Nginx client-IP contract. The
repository configuration trusts the listed Cloudflare source ranges, not local
`cloudflared`, by default. Cloudflare dashboard, tunnel ingress, and firewall
state cannot be verified from this repository and remain operator acceptance
requirements.

The Nginx behavior was checked against the official real-IP and proxy-header
contracts: [NGINX realip module](https://nginx.org/en/docs/http/ngx_http_realip_module.html),
[NGINX proxy module](https://nginx.org/en/docs/http/ngx_http_proxy_module.html),
and [Cloudflare `CF-Connecting-IP`](https://developers.cloudflare.com/fundamentals/reference/http-headers/#cf-connecting-ip).

#### Unknown-client policy

The selected policy deliberately retains the current shared `unknown` bucket
for missing or malformed trusted client identity. It is predictable and
fail-closed at the existing per-scope budget, but unrelated clients can share
that quota. Supported production traffic should never reach this state after
Nginx canonicalization. Local development and tests may use it intentionally;
internal/direct Next.js access, malformed headers, and accidental direct-origin
traffic use it rather than falling back to an untrusted forwarding header.
Operators recover from an unexpected `unknown` flood by restoring the
supported proxy/firewall path, not by enabling header fallback. Public
responses do not reveal this infrastructure detail.

### 19.5 Selected architecture and rejected alternatives

L2 selects **Option 1: retain process-local counters under an explicit
single-process production invariant**, with two minimal corrections:

1. Auth failed-attempt reservations close the confirmed asynchronous
   check/record race without changing what counts as a failed attempt.
2. The production start command, Nginx header contract, deployment checklist,
   and Tunnel guidance make the single-process and trusted-IP invariants
   operationally visible.

This is the smallest production-safe correction supported by the evidence:
the repository currently documents one app process, has no current
requirement for restart-persistent counters or horizontal scale, and already
has useful low-cost fixed-window controls. Mutation quotas, capacity, route
URLs, response statuses, Thai wording, authentication, authorization,
CSRF/trusted mutation behavior, L1 refresh/session behavior, LIFF, Email
Request, Notification, and Outbox behavior remain unchanged.

Rejected alternatives:

- **Redis or another shared service:** no current supported multi-process or
  multi-host requirement justifies its availability, deployment, monitoring,
  failure, cleanup, and local/test dependency cost in this phase.
- **A MySQL/Prisma rate-limit table:** the current invariant does not require
  durable counters; adding one would introduce write amplification, cleanup
  and index design, transaction contention, fixed-window atomicity and outage
  decisions, migration/rollback work, and latency on every protected request.
- **Cloudflare Rate Limiting as the application fix:** the repository cannot
  verify or own the required Cloudflare account policy, and edge controls
  would not replace authenticated per-user mutation quotas or Auth identity
  semantics.
- **Counting every login request:** rejected because it would silently change
  failed-attempt semantics and charge successful/invalid-payload requests to
  the identity failure budget. The reservation model preserves the existing
  `invalidCredentials` counting contract.
- **An in-memory Promise lock:** rejected as a general scale solution because
  it would still be process-local, would add request coordination complexity,
  and would not solve restart or multi-instance bypass. The synchronous
  reservation is sufficient for the supported one-process event loop.

No new npm dependency, Prisma schema, migration, external service, or shared
backend was introduced. The only runtime deployment changes are the explicit
loopback `start` binding and the Nginx application-header overwrite.

### 19.6 Exact final contracts and failure modes

- Auth identity and IP buckets remain fixed windows. Identity normalization is
  trim/lowercase; trusted IP normalization is trim plus Node IP syntax
  validation in `getTrustedClientIp`. Auth-map limited responses retain their
  endpoint-specific status/body and emit no new rate headers.
- Hybrid login counts only invalid/inactive credential outcomes returned as
  `invalidCredentials`; successful login releases the reservation, does not
  clear previous committed failures, and retains the existing `LOGIN_FAILED`
  Audit event. Parallel admission is bounded by the configured identity and
  IP budgets within one process.
- Signup still records before account creation, clears only the identity
  bucket on success, and leaves IP pressure intact. Validation, eligibility,
  duplicate-account, and status behavior remain unchanged.
- Forgot-password remains anti-enumerating. Schema-invalid parsed input does
  not consume the application bucket; valid unknown/inactive and known
  requests have the same accepted response; database-limited requests release
  the application reservation and retain the accepted response; email errors
  remain accepted after a committed valid request. A malformed JSON stream
  still follows the pre-existing outer error handler and returns its generic
  500 failure response without performing an account lookup.
- Refresh keeps every L1 rotation and reuse rule. Only its existing generic
  pre-auth IP budget is in L2 inventory.
- Leave, Stock, and Routine retain their existing scope names, windows,
  maximums, authenticated-user isolation, business authorization, and
  idempotency/state constraints. The mutation response remains `M429` with
  its existing Thai body and headers.
- Missing/malformed application client IP remains the shared `unknown` key;
  no arbitrary forwarding-header fallback exists.
- Auth and mutation maps have no backend failure path and clear on process
  restart. Mutation capacity fails closed for new keys after expiry cleanup;
  the 50,000 ceiling is unchanged. A full map can deny unrelated new keys,
  which is an accepted bounded risk under the single-process contract and is
  now explicitly documented.
- The process-local state is not horizontally scalable. Enabling cluster,
  multiple app instances, or multiple hosts requires a future shared atomic
  limiter and shared upload-storage design; this record does not claim that
  capability exists.

### 19.7 Deployment, schema, and compatibility record

Changed deployment/runtime files:

- `package.json`: `npm run start` now binds Next.js to `127.0.0.1`.
- `deployment/nginx/employee_nhf.cloudflare-origin.conf`: Nginx overwrites
  upstream `CF-Connecting-IP` from canonical `$remote_addr`.
- `README.md`, `docs/leave-attachments-deployment.md`,
  `CLOUDFLARE_TUNNEL_SETUP.md`, and `CLOUDFLARE_ZERO_TRUST_SETUP.md`: the
  supported one-process topology, restart behavior, origin reachability,
  client-IP responsibility, unsupported cluster/multi-host modes, and future
  scale prerequisites are explicit.

There are no dependency changes, no Prisma schema changes, no migration, no
new environment variable, and no database-backed limiter. Existing MySQL
integration conventions and the durable password-reset request count are
unchanged. The package-lock file was not modified.

### 19.8 L0-RATE-01 disposition

**L0-RATE-01 is closed under Option 1, with an explicit supported-topology
constraint.** The process-local bypass is not claimed to be solved by a
distributed backend. It is closed because the current supported production
contract is now explicit and operationally guarded: one loopback-bound Next.js
process behind Nginx, no PM2 cluster/multiple app instances/multiple hosts,
restart counter loss accepted, trusted client IP canonicalized at Nginx, and
the confirmed Auth check/record overshoot removed.

The remaining accepted risks are process restart clearing counters, a shared
`unknown` bucket for unsupported/malformed traffic, the bounded 50,000-entry
capacity-exhaustion denial of new keys, and the inability of repository tests
to verify live Cloudflare firewall/Tunnel configuration. Before horizontal
scale, the limiter backend and upload storage must change and receive real
cross-instance atomic integration coverage. No operator may interpret this
closure as horizontal scalability.

### 19.9 L2 verification record

Focused characterization and endpoint regression checks completed during
implementation:

- baseline limiter tests before implementation: PASS, 3 files / 14 tests;
- final Auth/mutation/trusted-IP/process-isolation/Nginx-config and hybrid
  login run: PASS, 7 files / 39 tests;
- Auth route regression run (forgot-password, signup, hybrid login, hybrid
  Auth routes, reset password): PASS, 5 files / 45 tests.

The final repository verification command/results are recorded here after the
broader pass:

- `npm.cmd run architecture:check`: PASS; 1,003 repository source files
  checked;
- `npm.cmd run lint:strict`: PASS;
- `npm.cmd run typecheck`: PASS;
- `npm.cmd run test:run`: PASS; 260 files / 2,154 tests;
- `npm.cmd run test:integration:mysql`: PASS; no pending migrations, 11 files
  / 78 tests;
- `git diff --check`: PASS;
- development server: NOT RUN;
- production build: NOT RUN.

The supported architecture decision and L0-RATE-01 disposition do not depend
on a claim that an unavailable external Cloudflare configuration was verified.

## 20. L3 implementation / closure

This section is additive to the historical L0/L1/L2 records above. It records
the L3 implementation against the reviewed `main` baseline
`30adf7dbde12e1f725c8ce7eef6a81eb9998ad54`. L3 covers the stale LINE/LIFF
link relationship, refresh Audit family correlation metadata, and the
best-effort security Audit failure contract. L4 is not started by this record.

### 20.1 Gate A — LINE/LIFF lifecycle inventory

The current `LineAccountLink` schema remains:

- `id` CUID primary key;
- `userId` unique;
- `lineUserId` unique and `VARCHAR(64)`;
- `linkedAt` and `updatedAt` timestamps;
- cascading relation to `User`;
- no link version, revocation handle, or supported unlink/relink API.

The LINE/LIFF production ownership inventory is:

- `app/api/line/account-link/route.ts` verifies the LINE ID token, writes the
  link through `@/modules/line`, and issues the LIFF session;
- `app/api/line/liff/session/route.ts` verifies the LINE ID token, reads the
  link by verified `lineUserId`, and bootstraps the LIFF session;
- `modules/line/application/liff.ts` composes current Auth User state and
  current Employee state and owns `requireLiffWorkforceSession()`;
- the 21 protected route callers are `line/home`, the eight Leave routes
  (`approvals`, `attachments/[id]`, `cancel`, `decision`, `me`, `not-taken`,
  `request`, and `requests/[id]`), the four Routine routes (`reference`,
  `summary`, `tasks`, and `tasks/[id]`), and the eight Stock routes
  (`availability`, `categories`, `items`, `processing`, `requests`,
  `requests/[id]`, `requests/[id]/cancel`, and `requests/[id]/issue`); the two
  processor routes use `requireLiffStockProcessorSession()`, which composes
  the same shared LINE guard before Stock's role check;
- `modules/stock/presentation/liff-stock-auth.ts` composes the same shared
  guard with Stock's server-side role check; Leave, Stock, and Routine do not
  query `LineAccountLink` directly;
- `findActiveLiffWorkforceIdentity()` is called by LIFF bootstrap and the
  shared protected-session guard;
- `findLineAccountLinkByLineUserId()` is used by LIFF bootstrap;
  `linkLineAccount()` is used by account linking; and
  `findLineUserIdByUserId()` is also used by the LINE notification adapter and
  Routine reminder recipient resolution. Those notification reads remain
  current-link reads and do not change delivery or Outbox behavior.

The final lifecycle matrix is:

| State or operation | Current protected LIFF request / operation result | Reason |
| --- | --- | --- |
| First link `User U` ↔ `LINE L` | Account-link returns 200 and issues a session bound to `U`, employee, and `L`; a protected request is accepted while all current checks pass. | The server uses only the verified LINE ID-token subject and the authenticated web workforce identity. |
| Exact idempotent same link | Account-link returns its existing 200 contract and issues a fresh session bound to the same `L`; existing sessions remain accepted. | `linkLineAccount()` preserves exact idempotency. |
| Conflicting LINE identity | Link attempt returns 409; an existing unchanged link/session remains governed by that unchanged link. | `lineUserId` uniqueness and the current ownership conflict rule remain authoritative. |
| Conflicting NHF user | Link attempt returns 409; no reassignment occurs. | `userId` uniqueness and the current ownership conflict rule remain authoritative. |
| LIFF bootstrap from a linked LINE identity | Returns `{ linked: true, workforce: ... }` and sets the existing LIFF cookie. | Verified `lineUserId` resolves the link, then current User/Employee eligibility is checked before issuance. |
| LIFF bootstrap from an unlinked LINE identity | Returns `{ linked: false }` and clears the LIFF cookie. | No link is created by bootstrap; account linking remains an explicit supported operation. |
| Protected request after issuance, original link still current | Accepted. | The LIFF JWT is valid, current User/Employee eligibility is valid, and current `LineAccountLink.userId.lineUserId` equals the JWT's verified `lineUserId` claim. |
| User deactivated | Rejected with the existing 403 workforce response. | User state is reread before the link check. |
| User soft-deleted | Rejected with the existing 403 workforce response. | `deletedAt` remains authoritative. |
| Employee suspended/inactive | Rejected with the existing 403 workforce response. | Current Employee eligibility remains authoritative. |
| Employee deleted/offboarded | Rejected with the existing 403 workforce response. | Current Employee existence/deleted state remains authoritative. |
| User/Employee relationship changed | Rejected with the existing 403 workforce response. | The expected Employee ID claim is checked against the current User-to-Employee relationship. |
| Link deleted after issuance | Rejected with 401. | The current link lookup returns no `lineUserId`; the credential no longer has an accepted current relationship. |
| Link changed/relinked from `L1` to `L2` after issuance | The old `L1` session is rejected with 401; a newly bootstrapped `L2` session may be accepted after current eligibility checks. | The JWT is identity-bound; checking only that `U` has some link would incorrectly accept the old `L1` credential. |
| Link is manually deleted and the exact same `L1` identity is later recreated | Rejected while the row is absent; accepted again after the same `L1` relationship is restored, if the JWT is otherwise valid. | L3 binds the provider identity relationship, not a link-row instance. A future contract requiring delete/recreate revocation would need a link ID/version claim. |
| Password reset during a valid LIFF session | LIFF remains accepted if its own JWT, current link, User, and Employee checks remain valid. | Web Auth `tokenVersion` and refresh-token revocation are independent from the LIFF credential by contract. |
| Web logout or logout-all during a valid LIFF session | LIFF remains accepted if its own checks remain valid. | Web Auth cookies/session families and LIFF cookies/sessions are separate systems. |
| LIFF JWT expiry | Rejected with 401; the existing client recovery/bootstrap path may obtain a fresh session. | `exp` remains enforced by `jose` verification and the LIFF payload validator. |

There is no supported product unlink/relink operation in this repository.
The delete/relink rows above describe the security invariant for an operator or
manual database state change and for any future supported operation; they do
not imply a new UI or API. A future relink must preserve both unique keys and
must issue a new identity-bound session. If that future operation must revoke
an old session even when the exact same LINE identity is recreated, it must
add a link-instance/version invariant; L3 does not add that state. A missing
link also means the
existing LINE notification consumers find no current recipient; no delivery,
Outbox, or notification contract was changed here.

### 20.2 Gate B — stale-link baseline characterization

Before changing the guard, the focused baseline suite was run and the
post-issuance characterization was recorded in `__tests__/auth/liff.test.ts`.
The baseline command
`npm.cmd exec vitest run __tests__/auth/liff.test.ts` passed 1 file / 16 tests.
The characterization showed:

1. a valid issued session with active User/Employee state was accepted;
2. when the mocked current link was deleted, the session was still accepted;
3. when the mocked current link was changed to another LINE identity, the
   session was still accepted; and
4. the test asserted that the baseline guard did not call the
   `LineAccountLink` repository at all.

The same baseline run retained the existing rejection coverage for inactive,
deleted, or relationship-inconsistent User/Employee state and expired LIFF
JWTs. The account-link suite retained real persistence behavior for exact
idempotency, both uniqueness conflicts, and P2002 race outcomes; no fake
database race claim was introduced for L3.

### 20.3 Gate C — selected LIFF link invariant

L3 selects the invariant:

> Every protected LIFF request must present a valid LIFF JWT whose bound
> `lineUserId` is the same as the current `LineAccountLink.lineUserId` for the
> JWT's server-verified `userId`, in addition to the existing current User and
> Employee checks.

The smallest unambiguous mechanism is a combination of Option 1 and the
identity-binding part of Option 2:

- LIFF issuance adds the verified LINE subject as a `lineUserId` claim;
- verification requires that claim together with the existing subject,
  Employee ID, purpose, issuer, audience, `iat`, `exp`, HS256 algorithm, and
  secret checks;
- the shared LINE guard rereads `LineAccountLink` by the existing unique
  `userId` index and compares the selected `lineUserId` to the verified JWT
  claim; and
- the comparison is authoritative for every protected LIFF capability.

A user-only current-link existence check was rejected: after `L1` is replaced
by `L2`, it would accept a credential issued under `L1`. A link ID or explicit
version column was rejected as unnecessary because the existing unique
user-to-current-`lineUserId` state is sufficient once the issued credential is
bound to the LINE identity. A bounded-stale-TTL policy was rejected because it
would intentionally leave unlink/relink usable for up to the one-hour default
or the 24-hour configured maximum, while L0 classified the residual stale-link
risk as Medium and L3 has a direct current-state mechanism.

The LINE subject is provider identity metadata, not a credential. It is
carried only in the signed HttpOnly LIFF JWT so the server can distinguish
`L1` from `L2`; it is never accepted from a request body, and the JWT remains
separate from web Auth. Legacy signed LIFF JWTs without this new claim are
rejected as invalid with 401 and must use the existing fresh-ID-token recovery
path.

### 20.4 Enforcement and HTTP contract

`requireLiffWorkforceSession()` remains the sole protected LIFF identity guard.
It performs, in order, JWT verification, current User/Employee eligibility,
then the current-link reread. It returns:

- 401 for a missing, malformed, invalid, expired, legacy-unbound, or
  stale-link LIFF cookie;
- 403 for an otherwise valid LIFF session whose current User/Employee
  workforce identity is ineligible, preserving the existing behavior;
- 500 for a LIFF configuration failure or a current-link database read failure,
  failing closed rather than treating unavailable state as authorized.

The stale-link protected-route response is 401 and does not claim to clear the
cookie on every protected route: the shared guard returns a response but does
not attach `clearLiffSessionCookie()`. The existing LIFF client handles 401
recovery through a fresh LINE ID token; if bootstrap reports `{ linked: false }`,
that bootstrap response clears the cookie. Mutation replay remains disabled,
and safe GET/HEAD recovery behavior is unchanged.

The existing account-link conflict 409, invalid LINE ID-token 401, LINE
verification upstream 502, unlinked bootstrap `{ linked: false }`, LIFF cookie
name `nhf_liff_session`, purpose `nhf-liff`, issuer `nhf_employee`, audience
`nhf-liff`, and response shapes remain unchanged. The default LIFF TTL remains
3,600 seconds (one hour); the configured maximum remains 86,400 seconds (24
hours). No silent TTL change was made.

### 20.5 Gate D — Auth `familyId` producer/consumer inventory

The inventory distinguishes runtime session authorization from Audit-only
correlation:

| Location / consumer | Use of `familyId` | L3 disposition |
| --- | --- | --- |
| `lib/auth/hybrid/tokens.ts` | Generates a random 16-byte hex family ID; places the family ID in the runtime refresh draft and access-token `sid`. | Unchanged; this remains runtime Auth state. |
| `modules/auth/infrastructure/persistence/refresh-token-repository.ts` and Prisma `AuthRefreshToken` | Stores, looks up, rotates, and revokes the runtime family ID. | Unchanged; authorization and containment still use the raw runtime value. |
| `modules/auth/application/sessions.ts` and `modules/auth/application/types.ts` | Carries family IDs through refresh, family revocation, current-session resolution, session listing, and the refresh security result. | Unchanged; the application result is not an Audit representation. |
| `app/api/auth/refresh/route.ts` | Produces refresh reuse/expiry and inactive-user security Audit events. | Persists `metadata.familyCorrelation`, not `metadata.familyId`. |
| `app/api/auth/sessions/revoke/route.ts` | Produces selected session-family logout Audit events. | Persists `metadata.familyCorrelation`, not `metadata.familyId`; revocation still uses raw runtime `familyId`. |
| `components/dashboard/session-management/types.ts` and `SessionManagementView.tsx` | Displays and submits the runtime session-management identity. | Unchanged; the UI does not consume the Audit correlation field. |
| `modules/audit/application/commands.ts` and `modules/audit/infrastructure/persistence/audit-log-repository.ts` | Generic JSON Audit append and serialization. | Remains schema-agnostic; new and historical details are stored/read as JSON. |
| `GET /api/audit-logs`, Audit application queries, dashboard provider/types/display | Returns/parses generic `details`; dashboard summaries ignore unknown session metadata. | Both historical `familyId` and new `familyCorrelation` shapes remain readable; no raw session identifier is newly displayed. |
| Audit export, operational logs, tests, and historical docs | Export does not query family correlation; failure logs carry action/entity/error context, not refresh secrets; historical references document prior behavior. | No runtime export/UI contract changed; historical Audit rows are not rewritten. |
| Audit retention | `AUDIT_LOG_RETENTION_DAYS = 90`. | Unchanged. |

There is no raw `familyId` in new refresh-security or selected-session-revoke
Audit details. Login success/failure, current logout, logout-all, password
reset, and signup event producers do not receive a family ID and were not
changed by this policy. The current Auth family ID is random, is not a raw
refresh token, and is not usable by itself as an authentication credential;
L3 treats the change as defense-in-depth/privacy hardening rather than a
credential-leak correction.

### 20.6 Selected Audit correlation representation

L3 selects **Option B — deterministic truncation/redaction**. The new
`metadata.familyCorrelation` is the first 16 lowercase hexadecimal characters
of the normal 32-character runtime family ID. This preserves equality
correlation for operators while retaining 64 bits rather than all 128 bits of
the random identifier. At one million distinct values in the 90-day window,
the birthday-bound collision probability for a 64-bit prefix is approximately
2.7 × 10^-8; this is an operational correlation aid, not an authorization
key, and that residual risk is accepted for the current scale. The normal
family ID generator is the source of the 32-character format. An unexpected
non-conforming value produces the fixed `unavailable` marker rather than
persisting a short raw identifier.

The representation is deterministic for equality correlation, does not add a
secret or rotation dependency, is never accepted by Auth runtime functions,
and is not used as a cookie, access-token claim, refresh token, or session
authorization input. Tests cover deterministic output, distinct normal family
IDs, malformed/short fallback, and absence of a raw `familyId` field from new
producer details. Existing Audit rows containing `metadata.familyId` remain
untouched and readable. The generic API parser and dashboard display tolerate
both shapes without trying to reinterpret either one.

### 20.7 Gate E — best-effort security Audit failure contract

The best-effort contract is retained intentionally. The security/session
operation is completed first, Audit persistence is attempted independently,
and `appendAuditBestEffort()` catches persistence errors. The failure log now
has an explicit `event: "audit_persistence_failed"` marker plus the Audit
action, entity type, entity ID, and safe error message. It does not log Audit
details, raw refresh tokens, or runtime family IDs. The caller's Auth/LIFF
authorization result and session containment are not changed by an Audit sink
failure.

The tested invariant is:

- successful login remains successful when its Audit write fails;
- failed login remains 401 when its Audit write fails;
- confirmed refresh reuse remains 401 after family containment when its Audit
  write fails;
- current logout, logout-all, and selected-session revoke retain their
  revocation result and cookie invalidation when Audit persistence fails; and
- the failure log contains actionable event/action/entity context without a
  raw refresh secret.

No Audit outbox, retry queue, new persistence table, or retry architecture was
introduced. Repository evidence can prove the application emits the
structured stderr/process log, but cannot prove the retention/alerting policy
of the deployed process supervisor or log platform. Production monitoring
must therefore retain and alert on `audit_persistence_failed` events; that is
an operator requirement, not an authorization dependency. A future durable
Audit requirement would be a separate design and availability decision.

### 20.8 Schema, performance, and compatibility decision

No Prisma schema or migration change was required. The existing unique
`LineAccountLink.userId` index supports the current-link check with a
minimal `select: { lineUserId: true }`; there is no N+1 link lookup inside a
single protected request and no process-memory cache that could recreate the
stale-link window. The tradeoff is one indexed database read per protected
LIFF request and making current-link database availability part of
authorization. A read failure returns 500 and never authorizes. Redis,
explicit link-version state, and a generic session-revocation framework were
not justified by the current invariant.

The implementation preserves LINE ID-token verification, bootstrap/recovery
contracts, account-link uniqueness/idempotency/P2002 handling, the LIFF cookie
and TTL contract, User/Employee eligibility, Leave/Stock/Routine business
authorization, Auth refresh/session behavior, L2 rate/proxy behavior, Audit
action/entity enums, historical Audit data, 90-day retention, Notification,
Outbox, and Email Request behavior. Password reset and web logout/logout-all
remain intentionally independent from LIFF. No product unlink/relink UI was
added.

### 20.9 L3 dispositions and remaining risks

- **L0-LINE-01 — CLOSED under immediate current-link enforcement.** A
  protected LIFF credential is identity-bound and cannot survive deletion while
  the link is absent or relinking to a different LINE identity. Recreating the
  exact same provider relationship is intentionally not a link-row revocation
  event under this L3 contract. User/Employee lifecycle invalidation remains
  promptly enforced and independent.
- **L0-AUDIT-01 — CLOSED under `familyCorrelation`.** New security Audit rows
  do not persist raw Auth `familyId`; historical rows remain readable and
  runtime session management is unchanged.
- **L0-AUDIT-02 — CLOSED as an explicit intentional best-effort contract.**
  Audit sink loss remains an operational observability risk, with structured
  failure signaling and an operator log-retention/alerting requirement; it
  cannot weaken authorization, revocation, or session containment.

Remaining L3 risks are the additional LIFF database read/availability
dependency, the accepted 64-bit Audit correlation collision residual, and the
operator requirement to retain/alert on the structured Audit failure log.
There is no repository-supported unlink/relink endpoint, so product UX for
that future operation remains outside L3. LIFF remains independent of web
password reset and web logout by explicit contract. These are documented
policies, not claims of immediate invalidation beyond the selected link and
current User/Employee checks.

### 20.10 L3 verification record

The exact verification record for this implementation is:

- pre-change focused baseline: `npm.cmd exec vitest run
  __tests__/auth/liff.test.ts __tests__/lib/line-account-link.test.ts
  __tests__/api/line-auth-routes.test.ts __tests__/api/line-home-route.test.ts
  __tests__/api/line-leave-routes.test.ts __tests__/api/line-stock-routes.test.ts
  __tests__/api/line-routine-routes.test.ts
  __tests__/api/auth-audit-best-effort.test.ts` — PASS; 8 files / 88 tests;
- pre-change stale-link characterization: `npm.cmd exec vitest run
  __tests__/auth/liff.test.ts` — PASS; 1 file / 16 tests, including the
  deleted/relinked-link baseline assertions described in section 20.2;
- final focused LINE/Auth/Audit command — PASS; 17 files / 157 tests, covering
  LIFF claims and guard behavior, all representative Home/Leave/Stock/Routine
  adapters, link persistence, Auth refresh/session routes, Audit
  best-effort/failure handling, correlation, historical parsing, dashboard
  display, API compatibility, and retention:

  ```text
  npm.cmd exec vitest run __tests__/api/audit-log-route.test.ts __tests__/auth/liff.test.ts __tests__/lib/line-liff-session.test.ts __tests__/lib/line-account-link.test.ts __tests__/api/line-auth-routes.test.ts __tests__/api/line-home-route.test.ts __tests__/api/line-leave-routes.test.ts __tests__/api/line-stock-routes.test.ts __tests__/api/line-routine-routes.test.ts __tests__/api/hybrid-auth-routes.test.ts __tests__/api/auth-audit-best-effort.test.ts __tests__/api/auth-audit-failure-containment.test.ts modules/auth/application/audit-correlation.test.ts modules/audit/application/commands.test.ts modules/audit/application/queries.test.ts modules/audit/presentation/dashboard/display.test.ts modules/audit/application/retention.test.ts
  ```
- `npm.cmd run architecture:check` — PASS; 1,007 repository source files
  checked;
- `npm.cmd run lint:strict` — PASS with zero warnings;
- `npm.cmd run typecheck` — PASS;
- `npm.cmd run test:run` — one post-implementation run PASSed with 262 files /
  2,167 tests. Two later exact reruns encountered only resource-sensitive
  5-second timeouts in unrelated architecture fixture tests: one had 1 failed
  test and one had 11 failed tests, with no assertion failures. The
  architecture test file rerun alone passed 220 / 220 tests;
- `npm.cmd run test:run -- --testTimeout=15000` — PASS; 263 files / 2,171
  tests, confirming the timeout diagnosis without changing repository test
  code or configuration;
- `npm.cmd run test:integration:mysql` — PASS; 65 migrations found, no
  pending migrations, 11 files / 78 tests;
- `git diff --check` — PASS after the final documentation update;
- development server — NOT RUN;
- production build — NOT RUN.

No Prisma schema or migration was changed. No Notification, Outbox, Email
Request, or L4 work was started.

## 21. L4 implementation / closure

This section is additive to the historical L0-L3 records above. It records
the focused L4 correction for `L0-NOTIF-01`; it does not reopen L1-L3 work or
start L5/L6 work.

### 21.1 Root cause and selected ordering

The confirmed defect was in the Notification history query boundary, not in
Notification producers, stored rows, or the browser list. History rows were
ordered by `createdAt DESC` only, while the continuation boundary was
`createdAt < cursorTimestamp`. With 21 eligible rows sharing one timestamp,
the first page returned 20 rows and the timestamp cursor excluded every row
with that timestamp from the next page. Because the database order had no
unique tie-breaker, the omitted row was also not deterministic.

L4 selects the existing unique Notification CUID primary key as the stable
tie-breaker. History queries now use the unique deterministic order:

```text
createdAt DESC, id DESC
```

The latest-notification/dropdown query, polling behavior, Notification
producers, and stored Notification data were not changed.

### 21.2 Cursor contract and continuation semantics

New `nextCursor` values are version-one UTF-8 JSON encoded as unpadded
Base64URL. The decoded payload is exactly:

```json
{
  "v": 1,
  "createdAt": "<Date.toISOString()>",
  "id": "<Notification.id>"
}
```

The browser continues to treat this value as an opaque `string | null`. The
Notification application boundary owns encoding and parsing. Parsing checks
the canonical Base64URL representation, supported version, valid timestamp,
and a non-empty Notification identifier containing only the identifier
characters supported by the persisted representation. Unsupported versions
and malformed composite payloads are rejected before reaching Prisma.

For a version-one composite cursor, the repository applies the logically
equivalent descending-key boundary:

```text
createdAt < cursor.createdAt
OR (createdAt = cursor.createdAt AND id < cursor.id)
```

The same `userId` condition and existing `filter=unread` (`isRead = false`)
condition remain in the query. The query still fetches 21 rows, returns at
most 20, and derives the next cursor from both fields of the last returned
row. A final page returns `nextCursor: null`.

### 21.3 Legacy timestamp compatibility

An existing ISO timestamp cursor is accepted as a legacy input. It retains
the historical boundary `createdAt < legacyTimestamp`; it does not invent an
ID tie-breaker that was absent from the old cursor. Every newly generated
cursor uses the version-one composite format, including when the request was
continued from a legacy cursor.

This means an already-issued legacy cursor cannot recover an equal-timestamp
row that the old timestamp-only contract had already skipped. That limitation
is explicit and is not treated as a reason to rewrite historical rows. Invalid
and unsupported cursor inputs continue through the existing generic API error
path; L4 does not introduce a new malformed-cursor HTTP contract.

### 21.4 Regression and compatibility evidence

The pre-change real-MySQL characterization was:

```text
npm.cmd exec -- vitest run --config vitest.integration.config.ts __tests__/integration/notification-history-pagination.integration.test.ts
```

It failed at the old implementation with page two containing 0 rows instead
of the required 1 row for 21 equal-timestamp rows. After L4, the same focused
integration file passed 1 file / 3 tests. It covers:

- 21 equal-timestamp all-history rows across `[20, 1]` pages;
- the same equal-timestamp boundary with additional read rows, proving
  `filter=unread` remains scoped; and
- mixed timestamps with complete, duplicate-free, deterministic ordering.

The focused application/repository/cursor/API/browser command passed 6 files /
47 tests:

```text
npm.cmd exec -- vitest run modules/notification/application/history-cursor.test.ts modules/notification/application/queries.test.ts modules/notification/infrastructure/persistence/repository.test.ts modules/notification/presentation/dashboard/NotificationShared.test.tsx modules/notification/presentation/dashboard/NotificationsPageContent.test.tsx __tests__/api/notifications.test.ts
```

API tests cover no cursor, a new composite cursor, legacy ISO cursor,
`filter=all`, and `filter=unread`, while preserving the existing URL and
response fields `{ notifications, nextCursor, hasMore, totalCount }`. The
presentation test verifies that Load More passes the composite string without
inspecting it and appends the returned page. Filter reset, mark-one,
mark-all-read, action navigation, polling, loading/error/empty behavior, and
Thai wording remain in the existing presentation implementation and were not
redesigned.

### 21.5 Schema, index, and performance decision

No Prisma schema or migration was added. Existing Notification persistence is
unchanged and the unique `id` is sufficient for correctness. The inspected
Notification indexes remain:

- primary key on `id`;
- `notifications_userId_isRead_idx` on `(userId, isRead)`; and
- `notifications_createdAt_idx` on `(createdAt)`.

The generated Prisma query shape contains the user/filter predicates, the
two-branch composite continuation `OR`, `orderBy` `[createdAt DESC, id DESC]`,
and `take: 21`. A read-only MySQL `EXPLAIN` of that shape selected
`notifications_createdAt_idx` with a range and backward index scan, with
index condition and residual where evaluation. There is no production
latency, cardinality, or query-plan evidence in this phase that justifies the
write/storage cost and migration of a new composite index. The possible
future tradeoff is an index involving user/filter/order fields to reduce
candidate scanning, weighed against additional write cost and the `OR`
continuation plan; it is deferred rather than smuggled into L4.

Historical Notification rows, legacy `TICKET_*` values, and all existing
producer contracts remain compatible.

### 21.6 Files and verification record

L4 changed only the Notification cursor/application/repository tests, the
real-MySQL regression fixture, the focused presentation/API tests, the
current module overview forward reference, and this closure record:

- `modules/notification/application/history-cursor.ts`;
- `modules/notification/application/types.ts`;
- `modules/notification/application/queries.ts`;
- `modules/notification/application/history-cursor.test.ts`;
- `modules/notification/application/queries.test.ts`;
- `modules/notification/infrastructure/persistence/repository.ts`;
- `modules/notification/infrastructure/persistence/repository.test.ts`;
- `__tests__/integration/notification-history-pagination.integration.test.ts`;
- `__tests__/api/notifications.test.ts`;
- `modules/notification/presentation/dashboard/NotificationsPageContent.test.tsx`;
- `modules/README.md`; and
- `docs/architecture/runtime-hardening.md`.

Final verification:

- `npm.cmd run architecture:check` — PASS; 1,011 repository source files
  checked;
- `npm.cmd run lint:strict` — PASS with zero warnings;
- `npm.cmd run typecheck` — PASS;
- `npm.cmd run test:run` — PASS; 265 files / 2,184 tests;
- `npm.cmd run test:integration:mysql` — PASS; Prisma reported 65 migrations
  with no pending migrations, then 12 files / 81 tests passed;
- focused Notification unit/API/presentation command above — PASS; 6 files /
  47 tests;
- focused real-MySQL regression command above — PASS; 1 file / 3 tests;
- `git diff --check` — PASS after this record was authored;
- development server — NOT RUN; and
- production build — NOT RUN.

Residual risks are limited to the documented legacy cursor limitation, the
normal live-feed behavior when rows are inserted or unread state changes
between independent requests, and possible future performance work if
production cardinality or latency warrants a composite index. None weakens
user/filter scoping or the stable continuation invariant for rows addressed by
the new cursor.

**L0-NOTIF-01 — CLOSED.** L4 acceptance is complete. L3 remains closed, and
L5/L6 were not started.

## 22. L5 — Outbox / Provider Reliability Hardening

L5 is a provider-specific hardening of the existing shared Outbox boundary.
It does not redesign the delivery model as exactly-once. The global contract
remains at-least-once: a provider request may be accepted before the worker
records `SENT`, so recovery retries boundedly and uses a provider mechanism
only where the provider actually supports one. No database transaction is
held open around an external provider request, and `NotificationOutbox`
remains a shared platform boundary rather than a Notification module concern.

L1-L4 remain closed. At the time of the L5 closure, L6 cleanup had not
started; the current L6 closure is recorded in Section 23. Historical
`TICKET_*` enum/storage values remain compatibility-only and are not active
runtime dispatch types.

### 22.1 Active provider-path inventory

The following is the inventory of every type in
`OUTBOX_NOTIFICATION_TYPES` (25 active runtime types). “Failure” means the
dispatch result observed by the shared processor; a provider failure is
retryable until the configured three-attempt budget is exhausted. Capability
revalidation can intentionally return `SUPERSEDED`, and Routine can return
`DEFERRED`, which writes the row back to `PENDING` at its scheduled time.

| Outbox type | Owning capability | Side effects performed | Provider/channel | Stable event identity | Provider idempotency/retry mechanism | Current ambiguity window | Stale/supersede validation | Failure result / terminal state |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `EMAIL_REQUEST` | Deferred Email Request / IT capability | Configured IT in-app rows, then one IT LINE notification | LINE IT push when `LINE_IT_TEAM_USER_ID` is configured, otherwise IT broadcast; `LINE_IT_CHANNEL_ACCESS_TOKEN` | Existing `eventKey` when present (`email-request:<id>:created`); historical row identity fallback | `createOutboxLineRetryKey(type, id, eventKey)`; the same key reaches push or broadcast | LINE key retention is 24 hours; after that a recovery retry may be accepted as a new request; end-user delivery is not guaranteed | Payload is boundary-validated; no Email Request migration or new module | LINE `false`/error -> `FAILED`, then `DEAD`; no business supersede introduced |
| `LEAVE_ACTION` | Leave | Current-action revalidation, Leave in-app entry, child personal LINE row, SMTP email | SMTP plus deferred NHFapp personal LINE child | Payload leave/action delivery identity; parent `eventKey` is historically optional | Deterministic Leave `Message-ID`; child key is `createLineRetryKey(LEAVE_LINE eventKey)` | SMTP acceptance can be ambiguous; child LINE key has the provider retention window | Current approver/action generation is rechecked; stale action -> `SUPERSEDED` | Provider error -> `FAILED`/`DEAD`; stale current action -> `SUPERSEDED` |
| `LEAVE_RESULT` | Leave | In-app result, child personal LINE row, SMTP result email | SMTP plus NHFapp personal LINE push child | Payload `leaveId`/result identity; parent `eventKey` is historically optional | Deterministic Leave `Message-ID`; child LINE retry key | SMTP ambiguity; LINE key retention | Child enqueue is duplicate-safe and Leave state remains capability-owned | Provider error -> `FAILED`/`DEAD` |
| `LEAVE_CANCELLED` | Leave | In-app cancellation, child personal LINE row, SMTP email | SMTP plus NHFapp personal LINE push child | Payload leave/cancellation identity; parent `eventKey` is historically optional | Deterministic Leave `Message-ID`; child LINE retry key | SMTP ambiguity; LINE key retention | Existing Leave recipient/state checks remain in child dispatch | Provider error -> `FAILED`/`DEAD` |
| `LEAVE_CANCELLATION_REQUESTED` | Leave | In-app request, child personal LINE row, SMTP email | SMTP plus NHFapp personal LINE push child | Existing cancellation `eventKey` where persisted plus payload identity | Deterministic Leave `Message-ID`; child LINE retry key | SMTP ambiguity; LINE key retention | Current cancellation action/recipient is revalidated; stale -> `SUPERSEDED` | Provider error -> `FAILED`/`DEAD`; stale -> `SUPERSEDED` |
| `LEAVE_CANCELLED_AFTER_APPROVAL` | Leave | In-app result, child personal LINE row, SMTP email | SMTP plus NHFapp personal LINE push child | Existing cancellation `eventKey` plus payload identity | Deterministic Leave `Message-ID`; child LINE retry key | SMTP ambiguity; LINE key retention | Existing Leave state/recipient behavior | Provider error -> `FAILED`/`DEAD` |
| `LEAVE_NOT_TAKEN_REQUESTED` | Leave | In-app request, child personal LINE row, SMTP email | SMTP plus NHFapp personal LINE push child | Existing not-taken `eventKey` plus payload identity | Deterministic Leave `Message-ID`; child LINE retry key | SMTP ambiguity; LINE key retention | Current not-taken action/recipient is revalidated; stale -> `SUPERSEDED` | Provider error -> `FAILED`/`DEAD`; stale -> `SUPERSEDED` |
| `LEAVE_NOT_TAKEN_CONFIRMED` | Leave | In-app result, child personal LINE row, SMTP email | SMTP plus NHFapp personal LINE push child | Existing not-taken `eventKey` plus payload identity | Deterministic Leave `Message-ID`; child LINE retry key | SMTP ambiguity; LINE key retention | Existing Leave state/recipient behavior | Provider error -> `FAILED`/`DEAD` |
| `LEAVE_ACTION_LINE` | Leave | None beyond the personal LINE provider request | NHFapp personal LINE push via `LINE_APP_CHANNEL_ACCESS_TOKEN` | `buildLeaveLineEventKey` includes leave, action generation, recipient, and type | Persisted `retryKey` must equal `createLineRetryKey(eventKey)`; provider 409 with that key is accepted | 24-hour LINE retry-key retention; accepted does not mean user received it | Event key, retry key, current action generation, recipient, authorization, and LIFF destination are checked | Invalid/stale/unavailable recipient -> `SUPERSEDED`; provider failure -> `FAILED`/`DEAD` |
| `LEAVE_RESULT_LINE` | Leave | None beyond personal LINE provider request | NHFapp personal LINE push | `buildLeaveLineEventKey` with leave, result type, and recipient | Persisted deterministic `retryKey`; 2xx or keyed 409 is accepted | Same LINE retention/delivery limitation | Leave payload and recipient/state validation | Invalid/stale/unavailable recipient -> `SUPERSEDED`; provider failure -> `FAILED`/`DEAD` |
| `LEAVE_CANCELLED_LINE` | Leave | None beyond personal LINE provider request | NHFapp personal LINE push | `buildLeaveLineEventKey` | Persisted deterministic `retryKey`; keyed 409 accepted | Same LINE retention/delivery limitation | Leave payload and recipient/state validation | Invalid/stale/unavailable recipient -> `SUPERSEDED`; provider failure -> `FAILED`/`DEAD` |
| `LEAVE_CANCELLATION_REQUESTED_LINE` | Leave | None beyond personal LINE provider request | NHFapp personal LINE push | `buildLeaveLineEventKey` | Persisted deterministic `retryKey`; keyed 409 accepted | Same LINE retention/delivery limitation | Current cancellation action, recipient, authorization, and LIFF destination are checked | Stale/unavailable recipient -> `SUPERSEDED`; provider failure -> `FAILED`/`DEAD` |
| `LEAVE_CANCELLED_AFTER_APPROVAL_LINE` | Leave | None beyond personal LINE provider request | NHFapp personal LINE push | `buildLeaveLineEventKey` | Persisted deterministic `retryKey`; keyed 409 accepted | Same LINE retention/delivery limitation | Leave payload and recipient/state validation | Invalid/stale/unavailable recipient -> `SUPERSEDED`; provider failure -> `FAILED`/`DEAD` |
| `LEAVE_NOT_TAKEN_REQUESTED_LINE` | Leave | None beyond personal LINE provider request | NHFapp personal LINE push | `buildLeaveLineEventKey` | Persisted deterministic `retryKey`; keyed 409 accepted | Same LINE retention/delivery limitation | Current not-taken action, recipient, authorization, and LIFF destination are checked | Stale/unavailable recipient -> `SUPERSEDED`; provider failure -> `FAILED`/`DEAD` |
| `LEAVE_NOT_TAKEN_CONFIRMED_LINE` | Leave | None beyond personal LINE provider request | NHFapp personal LINE push | `buildLeaveLineEventKey` | Persisted deterministic `retryKey`; keyed 409 accepted | Same LINE retention/delivery limitation | Leave payload and recipient/state validation | Invalid/stale/unavailable recipient -> `SUPERSEDED`; provider failure -> `FAILED`/`DEAD` |
| `STOCK_REQUEST_LINE` | Stock | Admin in-app rows, then operational broadcast | Legacy Stock LINE broadcast with `LINE_STOCK_CHANNEL_ACCESS_TOKEN` | Historical row identity; no new `eventKey` contract | `createOutboxLineRetryKey("STOCK_REQUEST_LINE", notification.id)` | 24-hour LINE key retention; broadcast acceptance is not end-user delivery proof | Existing Stock payload parsing and audience semantics | Provider failure -> `FAILED`/`DEAD`; existing Stock behavior is otherwise unchanged |
| `STOCK_LOW_LINE` | Stock | Admin in-app rows, then operational broadcast | Legacy Stock LINE broadcast with `LINE_STOCK_CHANNEL_ACCESS_TOKEN` | Historical row identity; no new `eventKey` contract | `createOutboxLineRetryKey("STOCK_LOW_LINE", notification.id)` | Same LINE retention/delivery limitation | Existing Stock payload parsing and audience semantics | Provider failure -> `FAILED`/`DEAD`; existing Stock behavior is otherwise unchanged |
| `STOCK_REQUEST_RESULT_EMAIL` | Stock | None beyond the requester email provider request | SMTP | `stock-request:<requestId>:<status>:email` payload/event identity | Deterministic Stock `Message-ID` | SMTP server acceptance/timeout is ambiguous; Message-ID is not provider deduplication | Existing Stock result payload and recipient semantics | `false`/error -> `FAILED`, then `DEAD` |
| `STOCK_REQUEST_RESULT_LINE` | Stock | None beyond personal LINE provider request | NHFapp personal LINE push via `LineAccountLink` | `stock-request:<requestId>:<status>:line` | Persisted retry key must equal `createLineRetryKey(eventKey)`; keyed 409 accepted | Same LINE retention/delivery limitation | Stock requester/link/LIFF state and canonical event/retry identity are checked | Unavailable or mismatched business work -> `SUPERSEDED`; provider failure -> `FAILED`/`DEAD` |
| `ROUTINE_REMINDER_IN_APP` | Routine | Routine in-app rows and child email/LINE outbox rows | Database writes; deferred child provider work | `routine:<occurrence>:rule:<rule>:version:<version>` | Event-key uniqueness/dedupe for enqueue; provider identity belongs to child rows | Database transaction/claim failure is retryable; no external provider request in this dispatch | Rule, occurrence, version, due date, schedule, recipient state, and current channel are checked | Not due -> `DEFERRED`/`PENDING`; stale/invalid -> `SUPERSEDED`; persistence failure -> `FAILED`/`DEAD` |
| `ROUTINE_REMINDER_EMAIL` | Routine | None beyond reminder email request | SMTP | `routine:<occurrence>:rule:<rule>:user:<user>:version:<version>:email` | Deterministic Routine `Message-ID` | SMTP ambiguity; Message-ID is a correlation/idempotency hint only | Event key, current task/rule/recipient state and email eligibility are checked | Stale/unavailable -> `SUPERSEDED`; provider failure -> `FAILED`/`DEAD` |
| `ROUTINE_REMINDER_LINE` | Routine | None beyond personal LINE provider request | NHFapp personal LINE push | `routine:<occurrence>:rule:<rule>:user:<user>:version:<version>:line` | Persisted `retryKey` must equal `createLineRetryKey(eventKey)`; keyed 409 accepted | Same LINE retention/delivery limitation | Event/retry key, current due state, recipient/link, assignment, content, and destination are checked | Not due -> `DEFERRED`; stale/unavailable/mismatched -> `SUPERSEDED`; provider failure -> `FAILED`/`DEAD` |
| `ROUTINE_CONTRACT_EXPIRY_IN_APP` | Routine | Contract-expiry in-app rows and child email/LINE outbox rows | Database writes; deferred child provider work | `routine-contract:<task>:end:<date>` | Event-key uniqueness/dedupe for enqueue; provider identity belongs to child rows | Database transaction/claim failure is retryable; no external provider request in this dispatch | Current contract, notification date, schedule, due state, and recipients are checked | Not due -> `DEFERRED`/`PENDING`; stale/invalid -> `SUPERSEDED`; persistence failure -> `FAILED`/`DEAD` |
| `ROUTINE_CONTRACT_EXPIRY_EMAIL` | Routine | None beyond contract-expiry email request | SMTP | `routine-contract:<task>:end:<date>:user:<user>` | Deterministic Routine contract `Message-ID` | SMTP ambiguity; Message-ID is not provider deduplication | Event key, current contract, assignee and valid-email state are checked | Stale/unavailable -> `SUPERSEDED`; provider failure -> `FAILED`/`DEAD` |
| `ROUTINE_CONTRACT_EXPIRY_LINE` | Routine | None beyond personal LINE provider request | NHFapp personal LINE push | `routine-contract:<task>:end:<date>:user:<user>:line` | Persisted `retryKey` must equal `createLineRetryKey(eventKey)`; keyed 409 accepted | Same LINE retention/delivery limitation | Event/retry key, current contract, recipient/link, due state, and destination are checked | Not due -> `DEFERRED`; stale/unavailable/mismatched -> `SUPERSEDED`; provider failure -> `FAILED`/`DEAD` |

The matrix separates the three LINE channels deliberately: NHFapp personal
push uses `LINE_APP_CHANNEL_ACCESS_TOKEN`, Stock operational broadcast keeps
`LINE_STOCK_CHANNEL_ACCESS_TOKEN`, and Email Request uses the existing IT
configuration and target selection. It also separates SMTP email from LINE;
the shared processor does not turn their different provider guarantees into a
common exactly-once abstraction.

### 22.2 LINE retry-key contract and coverage

The implementation follows the verified official LINE Messaging API contract:
`X-Line-Retry-Key` is sent on the first request intended to be retryable, the
same key is reused for the same logical request, and recipient/content remain
unchanged for that key. A 2xx response means accepted. A 409 response is
treated as accepted only when a non-empty retry key was sent, representing the
same request having already been accepted. Ordinary 4xx responses remain
failures; network/provider failures remain retryable through the Outbox.

The official provider retention is 24 hours, not permanent deduplication:
[LINE Messaging API reference](https://github.com/line/line-developers-docs-source/blob/main/docs/en/reference/messaging-api/index.html.md).
The repository does not persist a provider-acceptance timestamp and does not
pretend that `updatedAt` or `createdAt` is one. Recovery that happens after
the retention window may therefore produce a duplicate rather than silently
discarding the committed event. A keyed accepted response also does not prove
that the end user received or viewed the message.

Before L5, Leave, Routine, and Stock request-result personal LINE producers
already persisted deterministic retry keys. L5 audited their dispatchers and
added explicit event/retry-key consistency checks for Routine reminder,
Routine contract-expiry, and Stock request-result child rows. A malformed or
mismatched stored key now follows the existing capability-specific stale
policy and becomes `SUPERSEDED`; a provider failure still throws/retries and
is not converted into a business supersede.

The two legacy Stock operational types had no reliable `eventKey` contract.
L5 does not add a schema field or migration. At the Outbox dispatch boundary
only, each row gets a deterministic key derived from
`outbox:<type>:<NotificationOutbox.id>`. It is stable across retries, unique
to the row/type, provider-format-safe after UUID derivation, independent of
recipient and secrets, and does not alter the legacy token, audience, or
direct helper behavior.

Email Request remains deferred and in its current ownership location. Its
dispatch now uses the non-blank existing `eventKey` when available and the
same `outbox:<type>:<id>` fallback for historical rows without one. The key
is threaded through the existing IT push-or-broadcast transport, so both
variants use the same identity for one Outbox row. No Email Request business
payload or recipient semantics changed.

### 22.3 SMTP contract and internal retry characterization

The active SMTP Outbox paths are Leave action/result/event email, Routine
reminder email, Routine contract-expiry email, and Stock request-result email.
Each has a deterministic `Message-ID` derived from its stable capability
identity. The ID is preserved across the internal Nodemailer retry loop and
across a later Outbox retry for the same logical delivery.

`Message-ID` is not an SMTP provider idempotency key. After a timeout or
connection failure, the SMTP server may already have accepted the message;
retrying the same ID may still deliver a duplicate. SMTP Outbox therefore
remains explicitly at-least-once. L5 did not remove or redesign the existing
transport retry loop. Focused fake-timer tests characterize:

- first-attempt success;
- transient connection failure, reconnect, and success;
- repeated transient failures returning `false`;
- repeated non-transient failures returning `false`; and
- an ambiguous timeout followed by retry, with the same `messageId` passed to
  Nodemailer.

These tests prove correlation identity preservation and the boolean failure
contract, not provider deduplication.

### 22.4 Crash-after-provider evidence

The regression tests model the actual L0 failure window at the dispatch seam:

```text
PROCESSING
  -> provider invocation accepted
  -> final SENT write intentionally omitted (worker loss)
  -> stale recovery
  -> bounded retry
```

Coverage includes:

- Email Request IT LINE: the recovered request reuses the same event-derived
  retry key;
- Stock legacy broadcast: the recovered request reuses the same Outbox-row
  retry key;
- Stock request-result personal LINE: the persisted canonical retry key is
  reused and the provider acceptance/duplicate path is represented by the
  mocked provider seam; and
- Stock request-result SMTP: the recovered invocation is made again with the
  same deterministic Message-ID, explicitly recording duplicate ambiguity
  rather than claiming deduplication.

LINE transport tests cover keyed 409 acceptance for personal push, IT/normal
broadcast, and legacy Stock broadcast. Provider HTTP remains mocked; no test
uses an external network.

### 22.5 Stale PROCESSING state machine and final transitions

The stale recovery state machine is now conditional per row. The conditional
update checks the row ID, `PROCESSING` status, stale timestamp, and the
observed attempt count, so a competing worker cannot overwrite a newer state.
The configured budget remains three attempts and stale recovery uses the
existing one-minute base retry delay:

| Current stale state | Recovery state | Attempts after recovery | `nextAttemptAt` |
| --- | --- | --- | --- |
| `PROCESSING`, attempts `0` | `FAILED` | `1` | `now + 60s` |
| `PROCESSING`, attempts `1` | `FAILED` | `2` | `now + 60s` |
| `PROCESSING`, attempts `2` | `DEAD` | `3` | no new schedule |
| `PROCESSING`, attempts `>= 3` | `DEAD` | remains capped at `3` | no new schedule |

Focused tests pin these exact boundaries, fresh `PROCESSING` rows, the
`PROCESSING` selection predicate that excludes `SENT`, `DEAD`, and
`SUPERSEDED`, exhausted-row capping, and the claim race in which only one of
two workers dispatches the row. Existing capability tests retain Leave,
Routine, and Stock stale/superseded behavior.

The final-state coverage includes:

```text
PENDING -> PROCESSING -> SENT
PENDING -> PROCESSING -> FAILED
FAILED  -> PROCESSING -> SENT
FAILED  -> PROCESSING -> DEAD
PROCESSING stale -> FAILED
PROCESSING stale terminal -> DEAD
PROCESSING -> SUPERSEDED
PROCESSING -> DEFERRED (dispatch outcome; persisted row is PENDING)
```

The processor still claims conditionally, never wraps a provider call in a
database transaction, preserves exponential Outbox retry/backoff, and leaves
the cron URL and secret boundary unchanged.

### 22.6 Operational observability and DEAD-letter contract

The shared processor emits safe structured process-log events:

```text
outbox_provider_attempt
outbox_retry_scheduled
outbox_stale_recovered
outbox_dead_lettered
```

Metadata is limited to operational fields such as `outboxId`, `outboxType`,
`attempt`, `nextStatus`, `nextAttemptAt`, and `isRetry`. It does not include
payload/body content, LINE user IDs, recipient email addresses, access tokens,
SMTP passwords, cookies, ID tokens, refresh tokens, or provider response
bodies. A repeated attempt is therefore machine-detectable without exposing
delivery data. `outbox_retry_scheduled`, `outbox_dead_lettered`, and
`outbox_stale_recovered` represent successfully persisted `NotificationOutbox`
state transitions: each is emitted only after its conditional persistence
update succeeds with `count === 1`. They do not represent a transition that
was merely attempted. A lost conditional update or a persistence error emits
no retry/dead-letter state event. Existing error behavior remains in place and
an observability sink is not required for a state transition to complete.

`outbox_provider_attempt` remains a shared Outbox dispatch-attempt signal. Some
dispatches can perform only database work or return `DEFERRED` before an
external provider call, so operations should use `outboxType` to identify
actual provider-bound work.

The repository proves that terminal provider failures and stale-to-`DEAD`
recovery emit `outbox_dead_lettered` only after the corresponding persisted
transition succeeds. Production operations must configure the supervisor/log
platform to alert on that event and should surface repeated provider attempts
and `outbox_retry_scheduled`. Repository tests cannot prove that an external
deployment retains these logs or has an active alert, so L5 does not claim
production alerting is already enabled. No dashboard or new metrics stack was
introduced.

### 22.7 Schema, compatibility, and implementation record

No Prisma schema change or migration was added. Existing
`NotificationOutbox.id`, nullable unique `eventKey`, `status`, `attempts`,
`nextAttemptAt`, `createdAt`, `updatedAt`, and `lastError` are sufficient for
the L5 contract. The exact provider-acceptance timestamp is not fabricated,
and no receipt table, delivery ledger, or metrics table was introduced.
Historical `TICKET_*` storage compatibility is unchanged.

L5 changed:

- `lib/services/outbox/provider-key.ts` — stable Outbox-row LINE fallback;
- `lib/line/index.ts`, `lib/line/messaging.ts`, and the existing Stock
  notification boundary — optional retry-key threading without token/channel
  changes;
- `lib/services/outbox/processor.ts` — Email Request retry identity, bounded
  conditional stale recovery, safe operational events, and exported dispatch
  seam for crash-window regression evidence;
- `modules/stock/infrastructure/notifications/outbox.ts` and
  `line-notifications.ts` — legacy broadcast key coverage and personal key
  consistency validation;
- `modules/routine/application/reminders.ts` and
  `contract-reminders.ts` — personal LINE key consistency validation;
- `__tests__/integration/outbox-state-transitions.integration.test.ts` — real
  MySQL stale-recovery and concurrent-claim evidence;
- focused provider, transport, processor, Leave, Routine, Stock, cron, and
  real-MySQL state-transition tests; and
- `docs/notification-channels.md` and this architecture record.

No provider configuration names, tokens, recipients, Thai notification
content, Leave/Routine/Stock business flow, Email Request ownership, cron URL,
or cron secret contract changed.

### 22.8 Verification and residual risk

The final command results are:

- `npm.cmd run architecture:check` — PASS; 1,012 repository source files
  checked;
- `npm.cmd run lint:strict` — PASS with zero warnings;
- `npm.cmd run typecheck` — PASS;
- focused Outbox/provider command — PASS; 15 files / 164 tests;
- `npm.cmd run test:run` — PASS; 265 files / 2,205 tests;
- `npm.cmd run test:integration:mysql` — PASS; Prisma reported 65 migrations
  with no pending migrations, then 13 files / 85 tests passed; and
- `git diff --check` — PASS.

The focused command was:

```text
npm.cmd run test:run -- --silent=true __tests__/services/outbox/processor.test.ts __tests__/services/outbox/app-line-processor.test.ts __tests__/services/outbox/provider-key.test.ts __tests__/services/outbox/routine-processor.test.ts __tests__/lib/line.test.ts __tests__/lib/email.test.ts __tests__/lib/app-line-notification.test.ts __tests__/api/notification-outbox-cron.test.ts modules/leave/infrastructure/notifications/line.test.ts modules/leave/infrastructure/notifications/email.test.ts modules/routine/application/reminders.test.ts modules/routine/application/contract-reminders.test.ts modules/routine/application/notifications/email.test.ts modules/stock/__tests__/line-notifications.test.ts modules/stock/__tests__/email.test.ts
```

Residual risks are intentional and bounded rather than hidden: SMTP may
duplicate after ambiguous acceptance; LINE retry keys expire after 24 hours
and do not guarantee end-user delivery; and production log retention/alerting
is deployment-owned. A committed event is not discarded merely because the
LINE retention window may have elapsed.

**L0-OUTBOX-01 — CLOSED as an explicit provider-specific at-least-once
reliability contract, with residual SMTP/provider ambiguity documented.**

## 23. L6 — Compatibility and Obsolete Residue Cleanup

At the L6 closure point, L6 was **CLOSED** and L1-L5 remained closed. L7 had
not yet started at that historical point. This closure
covers only `L0-COMPAT-01` and `L0-COMPAT-02`; Email Request remains deferred
and no unrelated F/D/A finding was reopened.

### 23.1 Evidence sources and consumer inventory

The evidence review inspected:

- Section 12, the L6 roadmap entry, and the L5 closure in this document;
- `docs/architecture/final-repository-audit.md`,
  `audit-migration.md`, `auth-session-identity-migration.md`,
  `module-boundaries.md`, `dependency-rules.md`, and
  `employee-migration.md`;
- `modules/audit/**`, `modules/line/**`, the candidate `lib/line/**` files,
  `app/api/audit-logs/**`, and `app/api/line/webhook/route.ts`;
- `README.md`, `.env.example`, `.env` variable names only,
  `docs/line-routine.md`, `docs/notification-channels.md`, `package.json`,
  and `scripts/check-architecture.mjs`;
- all repository-visible scripts, tests, Prisma support, Docker Compose,
  deployment/Nginx files, Cloudflare setup guides, and Git history for the
  candidate paths.

The repository-wide `rg -uu` scan covered static imports, type-only imports,
re-exports, dynamic-import/`require()` strings, mocks, scripts, configuration,
and documentation while excluding `.git`, `node_modules`, `.next`, coverage,
and the ignored TypeScript build-info file. The focused source/test scan found
**0** `lib/services/audit-log` or `auditLogService` matches. The retained LINE
scan found the helper/configuration only in `lib/line/index.ts` plus its
focused tests; `LineWebhookData` remains only as the retained helper contract,
and `VerifiedLineIdentity` matches only the four authoritative
`modules/line` definition/export/verification references. Deployment/config
scanning found **0** Audit legacy or `LINE_WEBHOOK_URL` references outside
the source/documentation contract described below.

Consumer classification:

| Candidate | Production runtime | Tests | Tool/operator | Deployment/configuration | Documentation |
| --- | --- | --- | --- | --- | --- |
| `lib/services/audit-log/**` | No consumer; Audit routes use `@/modules/audit` | No intentional legacy-path contract | No consumer | No consumer | Historical migration references only, plus current L6 disposition |
| `sendLineWebhook` / `LineWebhookData` / `LINE_WEBHOOK_URL` | Helper definition/export only; no repository production caller | Retained outbound compatibility tests | No repository operator caller | `LINE_WEBHOOK_URL` is present in ignored local `.env` and `.env.example`; no deployment artifact consumer | README and `docs/line-routine.md` advertise the retained optional contract |
| legacy `VerifiedLineIdentity` | No consumer | No consumer | No consumer | No runtime use | No current contract; authoritative type is under `modules/line` |

### 23.2 Package, build, and deployment evidence

`package.json` has `"private": true` and no explicit `exports`, `main`,
`module`, or `types` publication fields. The repository has no `.github`
workflows, PM2/ecosystem files, systemd/supervisor files, Dockerfile, or
LINE provisioning script. `docker-compose.yml` and
`docker-compose.integration.yml` provide MySQL only; they do not define an
application image or import a candidate path. `git ls-files` reports **0**
tracked `.next`, `out`, or `build` artifacts, while `.gitignore` excludes
`.next` and build output. The checked-in deployment instructions perform a
fresh source install/check/build/start sequence, so the existing untracked
`.next` directory was not treated as authoritative production source and was
not inspected for removal evidence.

The live production environment, Cloudflare dashboard/Tunnel state, LINE
Console webhook configuration, deployment-owner environment variables, and
external operator checkouts were not accessible. No deployment-owner
confirmation is claimed. This limitation is decisive for the outbound LINE
surface and is an explicit residual assumption for the private Audit source
path removal.

### 23.3 L0-COMPAT-01 disposition — Audit compatibility residue

**REMOVED.** The following files were deleted:

- `lib/services/audit-log/index.ts`;
- `lib/services/audit-log/mutations.ts`;
- `lib/services/audit-log/queries.ts`; and
- `lib/services/audit-log/types.ts`.

The removed surface included the legacy `auditLogService`, legacy re-exports
of `getAuditLogs` and `cleanupExpiredAuditLogs`,
`AUDIT_LOG_RETENTION_DAYS`, `calculateAuditLogRetentionCutoff`, the Audit
filter/result types, and the duplicate legacy `UserContext`. No duplicate
context was moved elsewhere.

Removal evidence satisfies the L6 policy: no production repository consumer,
no intentional test contract, no script/operator import, no indirect source
resolution, no package/export contract, no repository deployment/build
artifact consumer, and complete capability ownership under `modules/audit`.
The private package/no-export-map and fresh-source-build evidence makes this
an unsupported deployment contract rather than an exposed package surface;
an untracked external checkout-local import remains unobservable and is not
claimed absent.

Audit behavior was not moved or redesigned. `modules/audit` remains the
authoritative owner for query, retention cleanup, neutral contracts, and
presentation; current API routes still use its public server entry. Existing
Audit query, retention, export/display, and route tests remain in place.

### 23.4 L0-COMPAT-02 symbol-level disposition — LINE compatibility residue

| Symbol/path | Disposition | Evidence and retained/removal condition |
| --- | --- | --- |
| `lib/line/index.ts :: sendLineWebhook` | **FORMALLY RETAINED** | README, `.env.example`, `docs/line-routine.md`, and the ignored local `.env` still expose `LINE_WEBHOOK_URL`; live deployment/external integration usage cannot be inspected. Remove only after deployment owner confirms the variable is unset/unused in every active environment and no external integration consumes the helper. |
| `lineNotificationService.sendLineWebhook` | **FORMALLY RETAINED** | Retained as the object-form compatibility export of the same outbound contract; it is not the inbound route. The same external confirmation condition applies. |
| `lib/line/types.ts :: LineWebhookData` | **FORMALLY RETAINED** | Its only current source consumer is the retained outbound helper, and it describes the advertised compatibility payload. Remove only with the helper and configuration after the same external confirmation. |
| `LINE_WEBHOOK_URL` | **FORMALLY RETAINED** | Kept in runtime configuration and `.env.example`; current docs now identify it as optional legacy outbound compatibility, separate from `/api/line/webhook` and the current IT Messaging API Email Request path. |
| `lib/line/types.ts :: VerifiedLineIdentity` | **REMOVED** | No repository/package/runtime consumer; compile-time-only duplicate; `package.json` is private with no export map; authoritative `modules/line/application/types.ts` and `modules/line/index.ts` remain unchanged. |

The inbound `POST /api/line/webhook` route and `lib/line/verify-signature.ts`
were not changed. Active `LINE_IT_CHANNEL_SECRET`,
`LINE_STOCK_CHANNEL_SECRET`, IT push/broadcast, Stock legacy broadcast,
NHFapp personal LINE/LIFF identity, Email Request delivery, and L5 Outbox
retry-key behavior remain unchanged. The retained outbound helper is now
explicitly documented as distinct from inbound signature verification.

### 23.5 Architecture, documentation, and schema changes

- Removed the obsolete `lib/services/audit-log` entry from the Audit and Auth
  client-graph server-directory lists in `scripts/check-architecture.mjs`.
  The `lib/line` server boundary and all Audit/Auth client graph invariants
  remain active; an architecture regression test proves Audit client code
  still rejects the shared LINE server boundary.
- Added inbound webhook route tests for missing signature, missing channel
  configuration, invalid signature, and valid IT/Stock signatures. Added
  retained outbound helper tests for configured and absent URL behavior.
- Updated current README, `.env.example`, `docs/line-routine.md`, the final
  repository audit, module-boundary/current identity records, and the Audit
  migration current-status note. Historical migration sections retain old
  paths where they describe the earlier I0/I1 state.
- No Prisma schema, migration, enum, AuditLog, NotificationOutbox,
  LineAccountLink, User, or Employee identity change was made.
- Email Request was not migrated or redesigned; no `modules/email-request` or
  `modules/it` was created, and no unrelated F/D/A finding was changed.

### 23.6 Verification record

The following commands were executed after the L6 changes:

- `npm.cmd run architecture:check` — **PASS**; 1,009 repository source files
  checked;
- `npm.cmd run lint:strict` — **PASS** with zero warnings;
- `npm.cmd run typecheck` — **PASS**;
- `npm.cmd run test:run` — **PASS**; 266 test files / 2,215 tests;
- focused compatibility command — **PASS**; 6 test files / 254 tests:
  `__tests__/lib/line.test.ts`, `__tests__/lib/line-verify-signature.test.ts`,
  `__tests__/api/line-webhook-route.test.ts`,
  `__tests__/api/audit-log-route.test.ts`,
  `__tests__/api/audit-log-cleanup-route.test.ts`, and
  `__tests__/architecture/check-architecture.test.ts`;
- `npm.cmd run test:integration:mysql` — **PASS**; Prisma found 65 migrations
  with no pending migrations, then 13 integration files / 85 tests passed;
- `git diff --check` — **PASS**;
- development server — **NOT RUN**;
- production build — **NOT RUN**; no tracked/prebuilt deployment artifact
  required build-output validation, and source resolution was covered by the
  architecture check and typecheck.

The integration command emitted the existing Prisma warning that the
`package.json#prisma` configuration property is deprecated for Prisma 7; it
did not fail the command and was not changed in L6.

### 23.7 Closure and residual assumptions

`L0-COMPAT-01` is **CLOSED — REMOVED**. `L0-COMPAT-02` is **CLOSED with a
mixed symbol-level disposition**: the outbound compatibility helper, payload
type, object export, and URL are **FORMALLY RETAINED**; the duplicate legacy
identity type is **REMOVED**. Remaining compatibility risk is limited to an
unobservable external consumer of `LINE_WEBHOOK_URL`/`sendLineWebhook` or a
direct external source import of the removed private Audit path. The former
must be confirmed before any future removal; the latter is not a supported
package/deployment contract based on the inspected repository evidence, but
cannot be proven absent outside the workspace.

L6 was ready to hand off to L7. Section 24 records the subsequent final
re-audit and current L7 disposition.
