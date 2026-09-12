# Stock Authorization Migration — Phase 6A

สถานะ: เสร็จสิ้นสำหรับ **server enforcement**<br>
ขอบเขต: Stock เท่านั้น; ไม่รวม Phase 6B presentation, Leave, Employee, Audit หรือ Settings

เอกสารนี้บันทึกการย้าย authorization ของ Stock จาก role/boolean checks ไปยัง central authorization resolver โดยคงพฤติกรรมเดิมเป็น compatibility floor ชั่วคราวตาม [authorization-contract.md](authorization-contract.md), [authorization-resolver.md](authorization-resolver.md) และ [stock-migration.md](stock-migration.md)

## 1. Capability mapping

ใช้ registry เดิมเป็น source of truth และไม่ได้เพิ่มหรือเปลี่ยน capability key:

| Capability | Scope | Channel | Stock server usage |
|---|---|---|---|
| `stock.catalog.read` | `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | item/category/availability reads |
| `stock.inventory.manage` | `ALL` | `DASHBOARD` | item/category mutations, quantity adjustment, item/variant image upload |
| `stock.request.read` | `OWN`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | request list/detail |
| `stock.request.create` | `OWN` | `DASHBOARD`, `LIFF_SELF_SERVICE` | create a request owned by the authenticated actor |
| `stock.request.cancel` | `OWN`, `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | cancel pending requests |
| `stock.request.process` | `ALL` | `DASHBOARD`, `LIFF_SELF_SERVICE` | review/issue and LIFF processing queue |
| `stock.report.export` | `ALL` | `DASHBOARD` | Stock report export |

`modules/stock/application/authorization.ts` is the Stock adapter. It builds an `AuthorizationActor` from trusted server session identity (`userId`, database role, `employeeId` when available and the fixed route channel), calls the central resolver first, and translates only Stock's `OWN`/`ALL` scopes into Stock resource/query behavior. `StockCommandActor` continues to hold audit/request metadata; it is not the authorization authority.

The migration uses this decision order:

```text
central resolver
  -> allowed: honor resolved scopes
  -> NO_APPLICABLE_GRANT: use frozen Stock compatibility floor
  -> any other denial/configuration error: deny or propagate, never bridge
```

Unknown capabilities, unsupported channels and invalid persisted authorization data do not fall through to role compatibility.

## 2. Compatibility floor

The compatibility floor applies only when the resolver returns `NO_APPLICABLE_GRANT`.

### Dashboard

- USER: catalog `ALL`; request read/create/cancel `OWN`; inventory, process and report are denied.
- ADMIN: catalog `ALL`; request read has an `ALL` ceiling, but `scope=mine` remains requester-owned and `scope=all` may query all; create remains `OWN` and requires active workforce; cancel, inventory, process and report are `ALL`.

ADMIN is not used as the new policy source. A valid explicit grant can authorize a USER, for example `stock.request.process / ALL`.

### LIFF self-service

- USER: catalog `ALL`; request read/create/cancel `OWN`; process is denied. Dashboard-only inventory and report capabilities remain unsupported.
- ADMIN: catalog `ALL`; the normal requester list remains `mine`; request detail may read `ALL`; create is `OWN`; cancel and process are `ALL`.

LIFF Stock ADMIN is intentionally still a processor under the compatibility floor. This differs from Routine, where LIFF ADMIN is clamped to self-service behavior. The Stock distinction is preserved.

## 3. Request scope and resource translation

`getRequests` no longer accepts `isAdmin: boolean`. It receives the authenticated `userId` and effective capability scopes:

- requested `scope=all` plus effective `ALL` produces an organization-wide request query;
- requested `scope=all` with only `OWN` still produces `requestedBy = actor.userId`;
- requested `scope=mine` always produces the requester-owned query;
- the LIFF requester list explicitly requests `mine`, including for legacy-compatible LIFF ADMIN.

Stock owns the translation from `OWN` to `StockRequest.requestedBy`. The central authorization module does not know Stock request fields or statuses.

LIFF request detail is separate from the requester list. Read `ALL` can expose another user's request to an authorized processor/read actor, while an OWN-only unrelated request keeps the existing not-found response. Read `ALL` never implies `stock.request.process`; serialization exposes ISSUE only from the independent effective process decision. Cancel is likewise resolved independently.

## 4. Mutation enforcement and lifecycle

Routes authenticate and parse their inputs, then use the Stock adapter. Critical Prisma mutations revalidate authorization inside the transaction with `authorization.resolveInTransaction(...)` after locking and re-reading the active User/Employee identity:

- request creation resolves `stock.request.create`; `requestedBy` is derived from the trusted actor, and active workforce, availability, variant, idempotency, rate-limit, outbox and audit behavior remain unchanged;
- cancellation resolves `stock.request.cancel`; `OWN` requires the request owner and `ALL` may cancel an eligible pending request. Notification mode is an explicit side-effect choice and is not used as authorization;
- processing/issue resolves `stock.request.process` at the application transaction boundary before the atomic pending claim, inventory locks, active item/variant checks, stock transaction and notifications;
- inventory item/category/quantity mutations resolve `stock.inventory.manage` in their transaction before existing locks and domain invariants.

The LIFF processor guard verifies the active linked LIFF workforce first, then resolves `stock.request.process` for `LIFF_SELF_SERVICE`. It no longer uses `isAdminRole()` as its authorization source. The Dashboard inventory and processor paths keep the existing eligible-workforce lifecycle requirements, while explicitly granted USER actors must still be active workforce actors.

Catalog reads use `stock.catalog.read` and retain catalog-wide visibility; request ownership predicates are not applied to catalog data. Image upload remains limited to the existing `scope=item|variant` Stock workflow and is authorized by `stock.inventory.manage`, not a generic upload capability. Report export uses `stock.report.export`, remains Dashboard-only, and preserves filters, row limits, XLSX behavior and error mapping.

All Stock domain invariants remain in Stock application/domain/infrastructure code: pending-state transitions, inventory availability, active references, locking, concurrency, idempotency, audit, email, LINE notification and outbox behavior are not encoded in the generic authorization module.

## 5. Presentation boundary and non-goals

Phase 6A makes server authorization authoritative first. It intentionally does not migrate Dashboard/LIFF presentation projection, Stock navigation, tabs, buttons, `LiffHomeApp`, `CurrentUserProjection` or the legacy `canRequestStock`/`canProcessStockRequests` values. A granted USER may therefore have server authority before the UI exposes the corresponding action; this is planned Phase 6B work.

No Prisma authorization schema or migration was added. DENY grants, wildcards, ABAC, Department/Team semantics, a policy DSL and authorization administration UI are out of scope. Routine code and behavior are unchanged.

## 6. Verification record

Focused adapter, query, mutation, Dashboard route, LIFF route, inventory route and report route tests cover compatibility, explicit grants, channel denial, OWN/ALL translation, LIFF 404 hiding, processor separation and transaction revalidation. The repository-wide `npm run check` command is the final verification gate for architecture, lint, typecheck and the full test suite.
