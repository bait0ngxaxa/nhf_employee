# NHF Employee — Current Authorization State

> **Current repository state (authorization Phase 12H-I,
> notification-recipient Phase 13A/13A.1/13A.2, IT1–IT9D CLOSED):** ADMIN is an Auth/control-plane role only. Business
> authorization is the domain Default Domain Policy plus
> configured Team, TeamRole, and exceptional direct User grants. The normal
> `authorization` singleton and `createAuthorizationResolver()` load and
> evaluate configured persistence for USER and ADMIN alike; `systemRole` is
> not a business grant source. Phase 12H-H production validation is
> **CLOSED / ACCEPTED** from operator-confirmed evidence. Phase 12H-I
> compatibility-debt removal is recorded in
> [authorization-phase-12hi-compatibility-debt-removal.md](authorization-phase-12hi-compatibility-debt-removal.md).
> Phase 13A/13A.1/13A.2 subsequently aligned Routine, Stock, and Email Request
> notification audiences with configured capabilities and contracted the
> Routine recipient enum. H2B / Phase 13A.2 is CLOSED: repository implementation
> COMPLETE, production collision preflight PASSED, production deployment
> PASSED, and production transition CLOSED. See
> [notification-capability-recipient-migration.md](notification-capability-recipient-migration.md).
> The older Phase 12H-B through 12H-H boundary notes below remain historical
> records of behavior at those phase boundaries.
>
> H2A is CLOSED. Routine Excel/file import has no current runtime, capability
> (`routine.import.manage`), routes, staging services, Prisma models, or task
> provenance fields. H2A.1 was deployed and previous processes were replaced
> before H2A.2 removed the physical persistence. Historical `ROUTINE_IMPORT_*`
> audit actions remain readable. The rollback floor is
> `099dc0ade8b114c40096cebe0e63c92b1ffc00e9` or a newer H2A.1-compatible
> release. H2B / Phase 13A.2 is CLOSED; MySQL, Prisma, and application
> recipient scopes now use the canonical-only vocabulary. The operator
> confirmed production collision preflight and migration deployment PASSED.
> The Routine recipient persistence transition is CLOSED.
>
> IT1–IT9D are CLOSED. The `it` domain has five role-neutral capabilities:
> `it.ticket.read`, `it.ticket.create`, and `it.ticket.comment` are supported on
> `DASHBOARD` and `LIFF_SELF_SERVICE`; `it.ticket.manage` and
> `it.analytics.read` are `DASHBOARD`-only. All five are unsupported on
> `SYSTEM`. Dashboard keeps the requester `OWN` defaults and additive configured
> authority. LIFF is requester-only: effective read/create/comment scopes are
> always `OWN` for both USER and ADMIN, even when configured authority resolves
> to `ALL`; Dashboard configured `ALL` behavior is unchanged.
>
> Ticket persistence, shared application commands and queries, requester
> OWN-constrained reads/conversation, a separate read-ALL operator
> API/Dashboard surface, operator read-ALL/comment-ALL conversation, and a
> merged timeline exist. IT5B attachments use current comment authority for
> upload and current `it.ticket.read` authority for private download; requester
> access remains constrained to the requester's Ticket. No attachment
> capability was added. IT9A adds `/api/line/it/tickets` (list/create),
> `/api/line/it/tickets/:id`, `/api/line/it/tickets/:id/timeline`,
> `/api/line/it/tickets/:id/comments`, and
> `/api/line/it/attachments/:id`. These routes use
> `requireLiffWorkforceSession()` and the shared IT requester commands/queries.
> IT9A does not add a `/liff/it` UI, LIFF Home or Bottom Nav entry, Rich Menu
> integration, Ticket LINE notifications, operator LIFF, or analytics LIFF.
> `AUTHORIZATION_SEED_CONFIGURATION` remains empty, with no IT Team,
> membership, role, or grant mapping. IT8 moved Email Request ownership without
> changing its existing authorization keys, scopes, defaults,
> session/workforce eligibility, or route behavior. Earlier IT phase statements
> below preserve the decisions at their phase boundaries; this document's IT9A
> note records the current LIFF authorization and API scope.
>
> The audited-source pre-IT hardening baseline and its remaining transition
> evidence are recorded in
> [pre-it-hardening-h0-baseline.md](pre-it-hardening-h0-baseline.md).

Current IT9C presentation integration consumes `getITPresentationCapabilities()`
from the verified LIFF workforce identity with fixed `LIFF_SELF_SERVICE` context.
The Home module is shown only for requester own-ticket read or create projection;
this presentation state adds no capability or authorization grant, and direct IT
API checks remain authoritative. `it.ticket.manage` and `it.analytics.read`
remain unsupported through LIFF.

## Current final authorization model

The current production source of truth, including IT9A, is:

| Concern | Final rule |
|---|---|
| Account/control plane | `User.role` / `Role.ADMIN` remains the Auth system role for authentication, Authorization Administration, bootstrap, role management, and last-eligible-ADMIN protection. |
| Business authority | Domain-owned Default Domain Policy plus configured `TEAM`, `TEAM_ROLE`, and exceptional direct `USER` grants. |
| Resolver | `createAuthorizationResolver()` is the canonical constructor; USER and ADMIN load configured persistence equally. `systemRole` never creates a business grant. |
| IT authorization | **Dashboard:** `it.ticket.read/create/comment` default to `OWN`, and configured Team, TeamRole, and direct User authority is additive; `it.ticket.manage` and `it.analytics.read` have no defaults and require configured `ALL`. **LIFF_SELF_SERVICE:** read/create/comment are supported with effective `OWN` only for USER and ADMIN, even when configured authority resolves to `ALL`; manage and analytics are unsupported. **SYSTEM:** all five IT capabilities are unsupported. `systemRole`, Department, and Team/TeamRole names do not grant IT business authority; configured grants remain resolver evidence. Requester reads, comments, and attachment downloads retain the requester Ticket predicate in LIFF. IT5B upload uses current comment authority (requester OWN through requester-only resource scope; operator read ALL plus comment ALL), while each private download re-resolves current read OWN/ALL and checks the Ticket requester relation. Assignment, comment authorship, manage, and comment ALL alone do not grant download. Dashboard queue/detail reads require read ALL before broad Ticket rows are queried, workflow mutations recheck manage ALL transactionally, and assignee checks use configured exact-user scopes only. Ticket ownership remains requester-based. |
| Email Request authorization | Existing `email.request.read` (`OWN|ALL`) and `email.request.create` (`ALL`) remain unchanged. Default scopes are empty; POST requires effective create ALL, and GET applies OWN as `requestedBy = authenticated userId` in the database. Actor is `DASHBOARD` with `employeeId: null`. No `it.ticket.*`, `it.analytics.read`, ADMIN role, Department, Team, or TeamRole mapping grants Email Request access. |
| Administration presentation | Account/system role is shown separately from business grant sources. Business explanations contain only Team, TeamRole, and direct User origins. |
| Routine provenance | Future mutation classification uses effective business authority; historical `ownershipMode: "ADMIN"` audit JSON remains readable and is not rewritten. |
| Fail-closed behavior | Unknown, inactive, revoked, malformed, unsupported, or structurally invalid configured sources remain denied or surface the existing configuration error. |

The current registry contains 45 capabilities across the nine authorization
domains: `employee`, `department`, `routine`, `stock`, `leave`, `audit`,
`email`, `notification`, and `it`. IT1/IT2/IT3/IT4/IT5A/IT5B add no production
authorization configuration: `AUTHORIZATION_SEED_CONFIGURATION` remains
empty. The IT assignee contract requires active workforce plus configured
read, comment, and manage `ALL`; Default Domain Policy and analytics authority
do not satisfy those requirements. IT8 adds no capability key, grant
configuration, or Email Request default. Ticket persistence, requester
queries, operator queue, requester/operator timelines and replies, private
comment attachments, read-authorized attachment access, API, and Dashboard
surfaces exist. Email Request remains a structured domain with independent
configured authority and is not mapped to an IT Ticket.

The detailed matrices and phase notes below include historical evidence from
before this final cleanup. They are retained for traceability and must not be
read as current permission behavior.

Phase 12A status: CLOSED — additive policy contract and current capability
inventory only. See
[authorization-phase-12a-additive-policy-contract.md](authorization-phase-12a-additive-policy-contract.md).

Phase 12B status: CLOSED — reusable additive composition core. Phase 12C.1 is
CLOSED for Department + Notification, Phase 12C.2 is CLOSED for Employee,
Phase 12C.3 is CLOSED for the enforced Routine surfaces, Phase 12C.4 is
CLOSED for Stock, and Phase 12C.5 is CLOSED for Leave. The next handoff is
Phase 12D, which is now CLOSED for the remaining Routine surfaces. Phase 12E
is now CLOSED for Authorization Administration effective-access inspection;
Phase 12F is now CLOSED for the full authorization regression/security matrix;
Phase 12G-A — Authorization Administration UX Simplification is now CLOSED after
its final closure correction on baseline `14a300d03a8bd9803afcf0bce8258ae7bd08e4d4`;
Phase 12G-B — First Production Capability Deployment Readiness is now
implementation-complete on baseline `c49caec5f14569655d1e385c1706dc7e9e22c0a8`.
Phase 12H-G — role-neutral production business enforcement cutover and full
security regression is closed as a historical phase record. Phase 12H-H and
Phase 12H-I are closed in the current repository state; their evidence is
linked in the current-state summary above.

Phase 12H-A through Phase 12H-F are retained below as historical phase
records. Their target contract, implementation boundaries, and verification
records remain linked from those sections; none is the current source of
truth for the final role-neutral production model.

สถานะรวม: Phase 12A–12G — historical closure records; Phase 12H-H —
**CLOSED / ACCEPTED จาก operator-confirmed production evidence**; Phase 12H-I
— **CLOSED**; ADMIN ยังคงเป็น system/control-plane role แต่ไม่ใช่ business
permission source; business grant sources มีเฉพาะ `TEAM`, `TEAM_ROLE`, `USER`
ร่วมกับ Default Domain Policy; Authorization Administration ยังคง ADMIN-only<br>
วันที่สำรวจ: 2026-09-20<br>
ขอบเขต: พฤติกรรมจาก source code, callers, Prisma/query scopes, routes, presentation projections และ tests ที่มีอยู่ใน repository ปัจจุบัน

หมายเหตุ Phase 12H-A: target ระยะยาวเป็น role-neutral business authorization
สำหรับ USER และ ADMIN ที่มี trusted workforce/domain context, channel และ
resource relationship เดียวกัน. สิทธิ์ธุรกิจเพิ่มเติมต้องมาจาก Team, TeamRole
หรือ exceptional direct User grant เท่านั้น; ADMIN ยังมีความหมายเฉพาะ
control-plane และ lifecycle boundaries ที่ระบุในเอกสาร Phase 12H-A. ข้อความนี้
อธิบาย target เท่านั้น ไม่ได้อ้างว่า runtime ปัจจุบันเปลี่ยนแล้ว. Phase 12H-A
ปิดแล้วในขอบเขต contract/inventory และ supersede ทั้ง ADMIN implicit business
authority และ selected legacy USER defaults ที่ถูก narrow แล้ว โดยเฉพาะ Routine
broad authority; Phase 12H-B เพิ่ม role-neutral configured core และ composition
แล้ว แต่ยังไม่เปลี่ยน production enforcement และยังคง legacy ADMIN compatibility
ไว้ชั่วคราว.

สถานะ capability ปัจจุบันหลัง Phase 12F (historical pre-12H runtime record): `routine.task.export`, `routine.summary.read` และ
`routine.reference.read` ใช้ permanent additive Default Domain Policy ผ่าน
Routine adapter และ central resolver แล้ว. Registry มี `25
CENTRAL_WITH_DEFAULT_POLICY`, `0 CENTRAL_WITH_COMPATIBILITY`, `13
CENTRAL_ONLY`, `2 DEFERRED` จากทั้งหมด 40 รายการ; readiness คือ `38
GRANTABLE`, `0 POLICY_ACTIVATION_REQUIRED`, `2 DEFERRED`. `DEFERRED` ที่เหลือ
มีเฉพาะ `email.request.read` และ `email.request.create`. Phase 12D ไม่ได้
เพิ่ม capability, scope, channel, schema, seed, backfill หรือ grant migration.

หมายเหตุ: บันทึก Phase ก่อนหน้าในเอกสารนี้เป็น historical evidence ตาม
boundary ของแต่ละ phase; สถานะ live หลัง final Phase 12G-A closure ให้ยึดข้อความ
ด้านบน ตาราง capability/route ปัจจุบัน และหัวข้อ 9.12 เป็นหลัก

หมายเหตุ Phase 11C (historical final closure): Phase 11B enforcement hardening — **CLOSED** และ Phase 11C security regression audit — **CLOSED** ที่ baseline `5669d79ca359701bc6a637079ca738575b731cf7`. Matrix สุดท้ายมี 89 cases (`80 DIRECT`, `6 INDIRECT`, `0 MISSING`, `3 N/A`); operation ledger มี 81/81 `DIRECT`, protected routes 78/78 `DIRECT`, Authorization Administration 17/17 `DIRECT` และ combined explicit ledger 98/98 `DIRECT`. Mandatory Phase 11C.2 work items เหลือ `0`. Compatibility policies และ deferred surfaces ยังคงอยู่, สี่ future policy families ยังอยู่นอก Phase 11, และ production authorization database grant inventory ยังไม่ได้ audit. เอกสารนี้คงผล MySQL fixture failure ไว้เป็น historical evidence; Phase 11D ได้ตรวจสอบและแก้ stale fixture แล้วโดยไม่เปลี่ยน production authorization semantics. รายละเอียดเดิมอยู่ใน [authorization-phase-11c-closure.md](authorization-phase-11c-closure.md)

หมายเหตุ Phase 11D (final closure): audit baseline คือ `a287459d71e4e92da95692b783beba01bafd2123`. พบและลบเฉพาะ `canResolveStockCapabilityForMigration` ซึ่งไม่มี caller/test/documentation reference เหลืออยู่ และเพิ่มเฉพาะ top-level `user.role` ที่ขาดหายจาก `__tests__/integration/leave-quota-concurrency.integration.test.ts` ให้ fixture ตรงกับ production session shape. ไม่มี production authorization policy, compatibility floor, deferred surface หรือ Team policy ถูกเปลี่ยน. Residue inventory, intentional retention, deferred decisions และ verification record อยู่ใน [authorization-phase-11d-closure.md](authorization-phase-11d-closure.md)

หมายเหตุ Phase 12A (locked target): พฤติกรรม NHF เดิมของ USER ที่ไม่มี configured grant เป็น **Default Domain Policy ถาวร** ไม่ใช่ compatibility behavior ชั่วคราวที่มีแผน retire. Grant จาก Team, TeamRole และ direct User เป็น authority แบบ additive ที่วางทับ baseline และห้ามทำให้ default authority แคบลง. Phase 12C.1 นำ contract นี้มาใช้จริงกับ Department และ Notification; Phase 12C.2 นำมาใช้กับ Employee; Phase 12C.3 นำมาใช้กับ Routine enforced surfaces; Phase 12C.4 นำมาใช้กับ Stock; และ Phase 12C.5 นำมาใช้กับ Leave แล้ว. รายละเอียด inventory และ contract อยู่ใน [authorization-phase-12a-additive-policy-contract.md](authorization-phase-12a-additive-policy-contract.md). ไม่มี production grant inventory, migration, seed, backfill หรือ historical-grant reconciliation ที่ต้องทำใน phase นี้

หมายเหตุ Phase 12B (additive composition core): เพิ่ม pure `composeAuthorizationAuthority()` เป็น application-layer seam สำหรับรวม domain-provided Default Domain Policy กับ configured authority จาก central resolver. Resolver ยังคงคืน configured/system-role authority เท่านั้น; structural denial และ `AuthorizationConfigurationError` ไม่ถูกแปลงเป็น default allow. Composition รักษา `source`, Team/TeamRole origin และ `TEAM` constraint ของ configured grants แยกจาก normalized scope semantics. Phase 12C.1 migrate Department และ Notification มาใช้ seam นี้แล้ว, Phase 12C.2 migrate Employee แล้ว, Phase 12C.3 migrate Routine enforced surfaces แล้ว, Phase 12C.4 migrate Stock แล้ว และ Phase 12C.5 migrate Leave แล้ว; catalog readiness ปัจจุบันคือ `22 CENTRAL_WITH_DEFAULT_POLICY`, `0 CENTRAL_WITH_COMPATIBILITY`, `13 CENTRAL_ONLY`, `5 DEFERRED` และ `35 GRANTABLE`, `0 POLICY_ACTIVATION_REQUIRED`, `5 DEFERRED`. รายละเอียดอยู่ใน [authorization-phase-12b-additive-composition-core.md](authorization-phase-12b-additive-composition-core.md), [authorization-phase-12c4-stock-additive-migration.md](authorization-phase-12c4-stock-additive-migration.md) และ [authorization-phase-12c5-leave-additive-migration.md](authorization-phase-12c5-leave-additive-migration.md)

หมายเหตุ Phase 12C.2 (Employee additive migration): Employee capabilities ทั้งเจ็ดใช้ central resolver ร่วมกับ `composeAuthorizationAuthority()` ทั้ง route-time, presentation และ transaction-time. `employee.read`, `employee.stats.read` และ `employee.export` มี permanent normal-USER default `ALL`; `employee.create`, `employee.update`, `employee.delete` และ `employee.import` มี default ว่าง จึงยัง DENY เมื่อไม่มี configured grant. ADMIN ได้ authority จาก central `SYSTEM_ROLE / ADMIN` ไม่ใช่ Employee default policy. Explicit Team, TeamRole และ direct User grants ยังคง additive และ grantable ทั้งเจ็ดรายการ. Update/delete ยังคง lock และ re-read User/Employee ใน serializable transaction ก่อน `resolveInTransaction()`, แล้วจึง compose และตรวจ `ALL`; lifecycle, query, import/export และ broad read behavior ไม่เปลี่ยน. รายละเอียดและ verification อยู่ใน [authorization-phase-12c2-employee-additive-migration.md](authorization-phase-12c2-employee-additive-migration.md)

หมายเหตุ Phase 12C.3 (Routine additive migration): Routine enforced capabilities เก้ารายการใช้ `composeAuthorizationAuthority()` ทั้ง route/presentation และ transaction-time โดยไม่มี `NO_APPLICABLE_GRANT` fallback แบบ compatibility. Default Domain Policy ของ normal USER คือ `routine.task.read` แบบ context-sensitive (management `CREATED + ASSIGNED`, work-item mine `ASSIGNED`, work-item all `ALL`), create `OWN`, update `CREATED + ASSIGNED`, delete `CREATED` และ occurrence read `ASSIGNED`; occurrence administration ทั้งสามรายการกับ import management มี default ว่างและยัง central-only. Configured Team, TeamRole และ direct User grants เป็น additive; `routine.task.read` work-item `scope=all` ยังคงคืนงาน active แบบ all-scope ตาม behavior ที่ Phase 12A lock ไว้. Dashboard ADMIN ยังคงเป็น `SYSTEM_ROLE / ADMIN` และเห็น source metadata; LIFF ADMIN ถูกใช้ self-service channel policy หลัง composition จึงไม่เป็น administrative และไม่ข้าม resource relationship. LIFF task detail ยังคง creator/task-assignee/occurrence-assignee relationship และ USER `ALL` ที่ตั้งค่าเพิ่มขยายได้โดยไม่ลบ baseline. Transaction mutations ยังคง lock/re-read actor และ target state, resolve current authority ใน serializable transaction และคง lifecycle, normalization, outbox, audit, idempotency และ version invariants. `routine.task.export`, `routine.summary.read` และ `routine.reference.read` ยัง `DEFERRED` และ exporter ยังคงใช้ `DEFERRED_EXPORT`; รายละเอียดอยู่ใน [authorization-phase-12c3-routine-additive-migration.md](authorization-phase-12c3-routine-additive-migration.md)

หมายเหตุการปรับปรุง: หลัง Phase 6A การบังคับใช้ authorization ฝั่ง server ของ Stock ใช้ central resolver ตามหลักฐานใน [authorization-stock-migration.md](authorization-stock-migration.md), Phase 6B เพิ่ม Stock presentation projection จาก resolver เดียวกัน และ Phase 6C ปิด migration ด้วย complete-surface audit, query-level request-detail ownership และ regression hardening. Phase 12C.4 แทนที่ compatibility floor เดิมด้วย permanent additive composition โดยคงพฤติกรรม Stock ที่ล็อกไว้ ส่วนโดเมนที่ยังไม่เข้าสู่ migration ยังคงอ้างอิง baseline ของ Phase 0 ตามที่ระบุในแต่ละหัวข้อ

หมายเหตุ Phase 12C.5 (Leave additive default policy): Leave registered capabilities ทั้งแปดรายการใช้ central resolver และ `composeAuthorizationAuthority()` แล้ว. สำหรับ eligible normal `USER`, `leave.request.read/create/cancel` มี default `OWN`, `leave.approval.read` และ `leave.request.approve` มี default `ASSIGNED`, `leave.cancellation.decide` มี default `ASSIGNED` เฉพาะ `DASHBOARD`, `leave.request.not_taken` มี `OWN + ASSIGNED`, และ `leave.approver.manage` มี default ว่าง. ADMIN ไม่มี Leave default และใช้ central `SYSTEM_ROLE`; configured Team, TeamRole และ direct User grants เป็น additive และ capability ทั้งเจ็ดรายการที่เคย compatibility-backed กลายเป็น grantable. Effective approver/exception precedence, owner exclusion, workflow/state, quota, recovery, attachment/participant/report, transaction lock/revalidation และ notification/outbox behavior ยังคง Leave-owned. LIFF cancellation decision ยังคง intentionally deferred/domain-owned เพราะ registry รองรับ capability นี้เฉพาะ Dashboard. รายละเอียดและ verification อยู่ใน [authorization-phase-12c5-leave-additive-migration.md](authorization-phase-12c5-leave-additive-migration.md)

หมายเหตุ Phase 7A: Leave ย้าย registered server capabilities ไปยัง central resolver พร้อม Leave compatibility floor และยังคงให้ relationship, workflow, report, participant, attachment และ recovery boundaries ที่ยังไม่อยู่ใน generic scope เป็นความรับผิดชอบของ Leave ตามที่บันทึกใน [authorization-leave-migration.md](authorization-leave-migration.md)

หมายเหตุ Phase 7B: Leave เพิ่ม immutable `LeavePresentationCapabilities` จากการเรียก `authorization.resolveMany()` แบบ batch เดียวผ่าน Leave boundary แล้วต่อเข้ากับ Dashboard current-user projection และ LIFF `/api/line/home` โดยคง legacy aliases, report projection, Admin recovery และ participant/detail/attachment policy เดิมไว้

หมายเหตุ Phase 7C: Leave complete-surface audit และ regression hardening ปิดแล้ว โดย Dashboard menu/direct route/tab ใช้ capability + relationship projection เดียวกัน, migrated server operations ยังคงใช้ Leave adapter/central resolver และ transaction-time lifecycle revalidation, LIFF cancellation decision ยังคงเป็น Leave-domain exception, และ reports/export, participant/detail, attachments กับ Admin recovery ยังคงเป็น deferred Leave policy

หมายเหตุ Phase 8A (historical first Employee authorization implementation): Employee server authorization migration ปิดแล้วสำหรับ registered capabilities ทั้งเจ็ด โดย routes ใต้ `/api/employees/**` ใช้ `requireApiSession()` เป็น authentication/workforce boundary แล้วผ่าน Employee adapter และ central resolver ด้วย execution channel `DASHBOARD`; explicit `ALLOW` ของ normal `USER` มีผลได้ และ update/delete re-resolve current User/Employee lifecycle ใน existing serializable transaction ขณะที่ list/stats/export query scope, import partial-success และ Employee lifecycle/audit invariants ยังคงเดิม. Phase 12C.2 supersedes the former Employee compatibility translation with permanent additive composition.

หมายเหตุ Phase 8B (historical Employee presentation implementation): Employee Dashboard ใช้ immutable `EmployeePresentationCapabilities` เจ็ด field จาก `getEmployeePresentationCapabilities()` ซึ่งเรียก `authorization.resolveMany()` เพียงครั้งเดียว. `getCurrentUserProjection()` สร้าง trusted Employee actor จาก authenticated account กับ current active Employee และส่ง `employeeCapabilities` ผ่าน `AuthenticatedUser`/`DashboardUser`; menu, direct Add/Import route, list/stats SWR, create/import/update/export controls ใช้ field ที่ตรงกันแบบ granular. `canDeleteEmployees` ถูก project และส่งต่อแต่ยังไม่มี delete/offboarding UI ที่มีอยู่ให้ migrate. Phase 12C.2 เปลี่ยน projection ให้ใช้ permanent additive composition path เดียวกับ server authorization.

หมายเหตุ Phase 8C: เพิ่ม trusted server-side RSC boundary ให้ `/dashboard/employees` โดยใช้ `canReadEmployees OR canReadStats` ร่วมกับ `canAccessEmployeeDashboard()` เดียวกับเมนู/`handleMenuClick()`; direct Add/Import routes ยังคงตรวจ capability เฉพาะของตนเอง. Complete-surface search ไม่พบ production Employee bypass, Employee presentation ADMIN authority หรือ delete/offboarding UI; EmployeeProvider และ Employee-specific Add/Import global revalidation ตรวจ capability ก่อนโหลด/refresh. ผล export/read reachability, role classification, route parity, API call-site audit และ regression evidence อยู่ใน [authorization-employee-migration.md](authorization-employee-migration.md)

หมายเหตุ Phase 9A: Department, Audit read และ Notification inbox server routes ย้ายมาใช้ domain-owned authorization adapters และ central resolver ด้วย `DASHBOARD` actor โดยคง `requireApiSession()` เป็น authentication/legacy workforce boundary. `NO_APPLICABLE_GRANT` compatibility floor ใช้เฉพาะ Department และ Notification เพื่อรักษา eligible-user behavior เดิม; Audit คง Admin central semantics และรองรับ explicit `audit.read / ALL` grant ของ normal USER โดยไม่เปิด access ให้ผู้ใช้ที่ไม่มี grant. Notification ยังคง actor-derived `OWN` predicates ใน query/update layer. Audit cleanup และ export-event ไม่ได้ถูกแปลงเป็น `audit.read`, Email Request ยังคง deferred และไม่มี presentation migration ใน Phase 9A. รายละเอียดอยู่ใน [authorization-remaining-server-migration.md](authorization-remaining-server-migration.md)

หมายเหตุ Phase 9B: Department, Audit และ Notification เพิ่ม immutable domain-owned presentation projections จาก resolver เดียวกับ Phase 9A แล้วต่อเข้ากับ trusted `getCurrentUserProjection()` หลัง current active Employee lifecycle check. Audit menu, `handleMenuClick()` และ `/dashboard/audit` ใช้ `auditCapabilities`; Notification Navbar/page ใช้ `canReadInbox` และคง read/update เป็นอิสระ; Employee Add/Edit Department selectors เรียก `/api/departments` เฉพาะเมื่อ `canReadDepartments` เป็น true และแยก unauthorized reference state จาก authorized-empty state. Phase 9A server authority ไม่เปลี่ยน, Email Request/future IT module ยังคง deferred. Phase 9C closure audit อยู่ใน [authorization-phase-9c-closure.md](authorization-phase-9c-closure.md)

หมายเหตุ Phase 10A: เพิ่ม read-only Authorization Administration boundary ใต้ `modules/authorization/` โดยใช้ trusted authenticated account/workforce session และ `ADMIN` เป็น bootstrap administration authority เพียงอย่างเดียว. มี capability administration catalog ที่ project จาก `CAPABILITY_REGISTRY` พร้อม `runtimeAuthorizationMode` (`CENTRAL_ONLY`, `CENTRAL_WITH_COMPATIBILITY`, `DEFERRED`) และ readiness (`GRANTABLE`, `POLICY_ACTIVATION_REQUIRED`, `DEFERRED`); เฉพาะ `GRANTABLE` ที่ `administrativelyGrantable` เป็น true. มี Team/TeamRole/membership/grant read models, User authorization detail และ `resolverEffectivePermissions` ที่เรียก central resolver เดิมพร้อม source/origin และ Team constraint. ชื่อ resolver-level นี้ไม่ใช่ final domain/runtime access เพราะ domain adapters อาจแปล `NO_APPLICABLE_GRANT` ต่อ. API อยู่ใต้ `/api/authorization/administration/**` และ Dashboard read-only foundation อยู่ที่ `/dashboard/authorization`; ทั้งสองไม่รับ role จาก client. Phase 10A ไม่เพิ่ม mutation, ไม่ activate Team policy, ไม่ derive Team จาก Department และไม่เปลี่ยน runtime authorization ของ production modules. Focused checks และ repository `check` ผ่าน; full MySQL integration runner ยังมี failure ใน Leave quota concurrency แต่การรันเทียบ baseline `fe5cf7f1c84a7a8a50db98db836819db1dd9e6de` ยืนยันว่าเป็น failure เดิม จึงไม่ใช่ Phase 10A regression. รายละเอียดอยู่ใน [authorization-phase-10a-closure.md](authorization-phase-10a-closure.md)

หมายเหตุ Phase 10B: เพิ่ม explicit Authorization Administration mutation boundary ใต้ `modules/authorization/` สำหรับ Team/TeamRole lifecycle, membership add/remove/role-change, Team/TeamRole capability grants และ exceptional direct User grants. ทุก command ตรวจ trusted `ADMIN` principal, validate input และ code-owned capability registry/readiness, ใช้ serializable transaction และเรียก `appendAuditInTransaction()` ด้วย transaction เดียวกัน; audit failure จึง rollback configuration write. เฉพาะ capability ที่เป็น `GRANTABLE` เท่านั้นที่ ordinary grant add/remove และ policy-applicability mutation จะผ่านได้; `POLICY_ACTIVATION_REQUIRED`, `DEFERRED`, unknown/invalid persisted configuration ถูกปฏิเสธแบบ fail-closed รวมถึง Team/TeamRole active-state และ membership impact guard. Impact guard ยึด resolver semantics: Team ที่ไม่มีสมาชิกไม่ตรวจ grant readiness, TeamRole grants ของ Team lifecycle ต้องเป็น role ที่ active และมีสมาชิก, และ TeamRole lifecycle ตรวจเมื่อ Team active และ role มีสมาชิกเท่านั้น; membership add/remove/role-change ยังคงตรวจ role ที่กำลังจะเปลี่ยน applicability โดยตรง. Team key/TeamRole key stable, TeamRole ไม่ย้ายข้าม Team, direct User `TEAM` scope ไม่มี origin จึงถูกปฏิเสธ, และไม่มี hard delete, seed, Department-to-Team mapping หรือ compatibility-floor retirement. API mutation surfaces อยู่ใต้ `/api/authorization/administration/**`; nested routes ใช้ `params.id` ตาม folder `[id]`, Dashboard ยัง read-only และไม่มี Phase 10C UI. Migration `20260914100000_add_authorization_audit_actions` เพิ่ม audit actions เฉพาะ authorization โดยคง historical mapped Stock values. รายละเอียดอยู่ใน [authorization-phase-10b-closure.md](authorization-phase-10b-closure.md)

หมายเหตุ Phase 10C: เพิ่ม operator workspace สำหรับ ADMIN ที่ `/dashboard/authorization` โดย page ยังคงเรียก `requireDashboardAuthorizationAdministration()` ก่อน render และส่ง initial overview จาก server shell ให้ client-safe `@/modules/authorization/client`. Workspace แบ่งเป็นภาพรวม/Teams, ผู้ใช้และสิทธิ์ และ Capability Registry; Team detail ใช้ progressive disclosure สำหรับ metadata, members, TeamRoles, Team grants และ TeamRole grants. ทุก mutation เรียก API adapter ที่รวม URL และ request mechanics ไว้จุดเดียว ใช้ pessimistic server confirmation, local pending state และ SWR revalidation เฉพาะ overview/detail ที่ได้รับผลกระทบ. User endpoint เป็น bounded search-only contract ที่ต้องมี non-empty trimmed query และคืน `INVALID_INPUT` เมื่อ query ว่าง; UI ไม่ทำ unfiltered browse. ผล focused/repository/MySQL re-audit อยู่ใน [authorization-phase-10d-closure.md](authorization-phase-10d-closure.md) และ Phase 10C — CLOSED.

Phase 10C เพิ่ม bounded ADMIN-only User directory/search ที่ `/api/authorization/administration/users` โดยค้นหา id, name, email และ employee identity fields ตาม safe projection และ deterministic limit 25; เป็น search-only และ query ว่าง/whitespace ถูกปฏิเสธด้วย `INVALID_INPUT`; ไม่ส่ง credentials หรือ token fields. User Exceptions ใช้ direct User grant แบบ additive และไม่แสดง `TEAM` scope. UI แสดง lifecycle ของ User/Employee, Team memberships, persisted configuration issues และ resolver effective permissions พร้อม source/origin (`SYSTEM_ROLE`, `TEAM`, `TEAM_ROLE`, `USER`) และ `constraint.teamId`. `CENTRAL_WITH_COMPATIBILITY` มีคำเตือนว่า domain adapter อาจใช้ migration compatibility policy เมื่อ resolver ได้ `NO_APPLICABLE_GRANT`; หน้าไม่คำนวณหรืออ้างว่าเป็น final runtime decision. `INVALID_CONFIGURATION` แสดงเป็น error state ที่ไม่ถูกตีความเป็น ALLOW/DENY ปกติ.

Phase 10C/10D ไม่ activate production Team policy, ไม่ retire compatibility floors, ไม่เพิ่ม `authorization.manage`/`authorization.admin`, ไม่ seed หรือ infer Team จาก Department/manager/position/employee, ไม่เพิ่ม explicit DENY, wildcard, ABAC, policy DSL, nested Team, role inheritance, schema/migration หรือ audit persistence ใหม่. Phase 10D re-audit ยืนยันว่า Authorization Administration tooling production-ready ภายใน approved model; ไม่ได้หมายความว่า compatibility-backed policies ถูก activate, compatibility floors ถูก retire, Department กลายเป็น Team, deferred capabilities ถูก migrate หรือมีการตัดสินใจ organizational policy ใหม่. หลักฐานอยู่ใน [authorization-phase-10d-closure.md](authorization-phase-10d-closure.md).

หมายเหตุ Phase 11B.3: เพิ่ม lifecycle/concurrency hardening ที่ไม่เปลี่ยน authorization policy ได้แก่ Routine ล็อกและ re-read target Employee ก่อนเขียนชุด assignee, Leave ล็อก affected/proposed approver rows และล็อกเจ้าของความสัมพันธ์ก่อน resolve fallback approver, รวมถึง re-check User/capability ปัจจุบันทันทีหลัง validation และก่อน `saveLocalImageUpload()`. Filesystem upload ยังคงอยู่นอก DB transaction จึงลด race window ได้แต่ไม่สามารถ rollback side effect แบบ atomic กับ authorization state ได้. Compatibility floors, Team policy และ deferred policy ยังคงเดิม. รายละเอียดและหลักฐานอยู่ใน [authorization-phase-11b3-closure.md](authorization-phase-11b3-closure.md)

หมายเหตุ Phase 11B.4: final enforcement audit ปิดแล้วโดยไม่พบ unclassified `LEGACY_AUTHORIZATION_BYPASS` ใน migrated authorization surfaces. Routine work-item `NO_APPLICABLE_GRANT -> ALL` compatibility, deferred summary/export และ Dashboard all-view presentation ยังคง active ตาม current production behavior; target ระยะยาวคือ broad Routine visibility ต้องมี trusted central `routine.task.read / ALL` และ migration ต้องครอบคลุม list, summary, export, UI, focus/deep link และ grant readiness แบบ atomic. Phase นี้ยังไม่ retire compatibility, ไม่ seed grant และไม่ activate Team policy. รายละเอียดอยู่ใน [authorization-phase-11b4-closure.md](authorization-phase-11b4-closure.md)

เอกสารนี้เป็น baseline ของพฤติกรรมปัจจุบัน ไม่ใช่ policy ใหม่และไม่ใช่การออกแบบ resolver ในอนาคต ทุกข้อความที่ระบุว่า “ปัจจุบัน” หมายถึงสิ่งที่ trace ได้จาก code หรือ test โดยตรง การพบพฤติกรรมที่เสี่ยงหรือดูไม่ตรงกับหลัก least privilege จะถูกบันทึกเป็น risk เพื่อให้ Phase ถัดไปตัดสินใจอย่างชัดเจน โดย Phase 0 ไม่แก้ผลลัพธ์ authorization เดิม

## Executive summary

ระบบปัจจุบันมี role ระดับระบบเพียง ADMIN และ USER โดย ADMIN เป็น role สูงสุด แต่ไม่ได้เป็น bypass ของ authentication, active account/workforce, relationship, workflow, validation หรือ transaction rules

เส้นทางตัดสินใจปัจจุบันโดยสรุปคือ:

~~~text
web access cookie / LIFF session / system secret
  -> account or channel authentication
  -> active User and, for legacy API, eligible active Employee
  -> route guard or domain/query relationship
  -> resource scope
  -> business state, validation, concurrency and transaction invariant
  -> response or mutation
~~~

จุดสำคัญที่ต้อง freeze ไว้:

- API legacy adapter ใช้ requireApiSession() และ requireAdminSession() เป็นแกนกลาง ค่าเริ่มต้นคือ unauthenticated 401 และ authenticated-but-not-admin 403 แต่บาง route ตั้ง response factory ให้ทั้งสองกรณีเป็น 403
- getApiAuthSession() ไม่ได้ตรวจแค่ account แต่ยังคง legacy contract ที่ต้องมี Employee ที่ ACTIVE และไม่ถูกลบ
- Dashboard layout ป้องกันการเข้าใช้งานโดยต้องได้ current active Employee projection แต่ role guard มีเฉพาะบาง page; navigation และการซ่อนปุ่มเป็น presentation เท่านั้น
- Routine มี semantics แบบ channel-aware: Admin ของ Dashboard-owned API ได้ admin scope แต่ Admin ที่ผ่าน LIFF_SELF_SERVICE ถูกปฏิบัติเหมือนผู้ใช้ self-service สำหรับ task operations
- Routine task work-item, summary, reference และ export paths ใช้ Routine adapter และ central resolver ผ่าน permanent additive composition แล้ว. USER ที่มีสิทธิ์ตาม baseline ยังคงได้ work-item/summary `scope=all` และ broad export ตาม policy ที่ล็อกไว้; reference ใช้ OWN baseline และ ALL ที่ตั้งค่าเพิ่มได้ตาม active-Employee rules. LIFF summary/reference ยังคง self-service และไม่ส่ง broad Employee list
- Stock server แยก requester ownership กับ processor/inventory ผ่าน central resolver, permanent Stock Default Domain Policy และ Stock-owned resource predicates; Stock presentation ใช้ granular projection จาก resolver/composition เดียวกันโดยยังไม่ใช่ server authority
- Leave ไม่ใช่ Admin-vs-User อย่างเดียว: approval ใช้ effective approver จาก exceptionApproverId หรือ approverId; Admin override มีเฉพาะบาง Dashboard/API workflow และถูกปิดสำหรับ LIFF
- `LeavePresentationCapabilities`, canApproveLeave, canViewLeaveReports และ LiffCapabilities เป็น projections สำหรับ presentation/entry-point behavior ไม่ใช่ authoritative server permission; capability eligibility ยังต้องประกอบกับ Leave resource/work relationship
- LIFF Routine reference และ summary routes กำหนด actor mode เป็น `LIFF_SELF_SERVICE` จาก trusted route boundary แล้ว; Routine adapter จึงใช้ LIFF authorization channel อย่างชัดเจน และ `serializeLiffRoutineReference()` ยังคงไม่ส่ง employee list ออกไป. Regression ของ USER/ADMIN ยืนยัน channel isolation และ response contract
- ระบบ authorization ปัจจุบันมี Team, TeamRole, TeamMembership และ persisted capability grants ได้แก่ TeamCapabilityGrant, TeamRoleCapabilityGrant และ UserCapabilityGrant รวมถึง code-owned Capability Registry, Scope Registry, AuthorizationActor และ central resolver แล้ว
- Registered capability ไม่ได้หมายความว่า query จะข้าม resource policy ได้: capability ทั้ง 11 รายการของ Routine มี runtime path ผ่าน `ROUTINE_CAPABILITIES`; `routine.task.export`, `routine.summary.read` และ `routine.reference.read` ใช้ policy ที่มี context/channel โดยตรง และมี projection ใหม่แยก operation. Structural authorization failures ยังคง propagate/fail closed
- ชื่อ Team และ TeamRole ไม่มี authority โดยตัวมันเอง; authority มาจาก effective capability grants ที่ central resolver ประเมิน
- Department / departmentId ยังไม่ถูกใช้เพื่ออนุมาน authorization
- Routine, Stock และ Leave server paths ใช้ central resolver พร้อม domain-owned resource semantics และ permanent Default Domain Policy + Phase 12B additive composition แล้ว. Department, Notification และ Employee ใช้ central resolver ร่วมกับ permanent Default Domain Policy เช่นกัน. Employee presentation และ complete-surface audit/regression hardening ของ current production surface ปิดแล้วใน Phase 8B/8C ตามลำดับ, Phase 9B presentation integration ของ Department/Audit/Notification ปิดแล้ว, และ Phase 9C closure audit ของ current migrated production surface ปิดแล้ว. รายละเอียด current Phase 12C.3 อยู่ใน [authorization-phase-12c3-routine-additive-migration.md](authorization-phase-12c3-routine-additive-migration.md), Phase 12C.4 อยู่ใน [authorization-phase-12c4-stock-additive-migration.md](authorization-phase-12c4-stock-additive-migration.md) และ Phase 12C.5 อยู่ใน [authorization-phase-12c5-leave-additive-migration.md](authorization-phase-12c5-leave-additive-migration.md)

## 1. Scope, terms and classification

### 1.1 Terms used by the current system

| Term | Current meaning | Boundary note |
|---|---|---|
| User | บัญชีที่ใช้ login, มี role, active/deleted state และ account identity | ไม่ใช่ตัวแทนของสิทธิ์ทุกอย่างหรือ workforce lifecycle ทั้งหมด |
| Employee | ตัวตนพนักงานที่เชื่อมกับ User และมีสถานะการทำงาน | เป็นเงื่อนไข workforce ของหลาย API/ธุรกรรม และเป็นเจ้าของ manager/participant relationship บางส่วน |
| Department | โครงสร้าง HR/องค์กร ใช้แสดงผล, filter, statistics และ reference data | ไม่พบการใช้ Department เป็นตัวอนุมาน authorization |
| ADMIN / USER | ค่า role ระบบจาก lib/ssot/permissions.ts และ User.role | ADMIN เป็น highest system role แต่ไม่ bypass domain invariants |
| DASHBOARD | Browser web route และ Dashboard API | Web Proxy/route guards กับ API guards เป็นคนละชั้น |
| API | /api/** ที่ใช้ hybrid access cookie | proxy.ts ไม่ครอบ /api; route ต้องเรียก server guard เอง |
| LIFF_SELF_SERVICE | LINE/LIFF route ที่ใช้ LIFF session cookie และ linked LINE identity | บาง domain โดยเฉพาะ Routine/Leave มี channel-specific restriction |
| SYSTEM | Cron, cleanup, webhook หรือ infrastructure endpoint | ใช้ shared secret/HMAC ไม่ได้ใช้ User role |

### 1.1.1 Entry-point surface vs authorization execution channel

ใน Current Authorization Matrix คอลัมน์ `Channel` ใช้เป็นการจัดกลุ่ม **entry-point / transport surface** ของพฤติกรรมปัจจุบัน จึงยังมีค่า `API` เพื่อบอกว่า decision ถูกบังคับใช้ใน HTTP route handler ภายใต้ `/api/**` การใช้ `API` ใน matrix ไม่ได้หมายความว่าอนาคตต้องมี `API` เป็นค่าใน `AuthorizationActor.channel`

ให้แยกคำสองชุดนี้ออกจากกัน:

- **Entry-point / transport surface:** `DASHBOARD`, `API`, `LIFF`, `SYSTEM endpoint`
- **Authorization execution channel:** `DASHBOARD`, `LIFF_SELF_SERVICE`, `SYSTEM`

หลาย `/api/**` routes เป็น server endpoints ที่ Dashboard เรียกใช้ ดังนั้น Phase 1 ต้อง derive execution context จาก caller/security context: Dashboard-owned API calls โดยปกติยังเป็น `DASHBOARD` context, LIFF routes ใช้ `LIFF_SELF_SERVICE`, และ trusted background/platform operations ใช้ `SYSTEM` หรือ system principal model ที่ได้รับอนุมัติโดยเฉพาะ ห้ามเพิ่ม `API` เป็น actor channel เพียงเพราะ route ใช้ HTTP transport นี้

### 1.2 Authentication vs Authorization Classification

การบันทึกใน matrix แยกชั้นดังนี้:

| Classification | ความหมายใน baseline นี้ |
|---|---|
| AUTHENTICATION | ยืนยันว่าคำขอมาจาก account/session/channel ที่ valid |
| ACCOUNT_LIFECYCLE | User active/deleted, Employee active/deleted/status และ linked identity |
| AUTHORIZATION | role หรือการตัดสินใจว่า actor มีอำนาจทำ operation หรือไม่ |
| RESOURCE_RELATIONSHIP | owner, creator, assignee, requester, approver, manager, participant หรือ resource query scope |
| BUSINESS_RULE | สถานะคำขอ, workflow, quota, active references, self-action, valid transition และ domain invariant |
| FEATURE_FLAG | เปิด/ปิด Leave หรือ Routine; ไม่ใช่ permission |
| PRESENTATION_ONLY | menu/button/tab/capability projection ที่ช่วย UX แต่ไม่ใช่ server authority |

Flow ที่พบใน mutation สำคัญโดยทั่วไปจึงมีหลายชั้น:

~~~text
valid session
  -> active account/workforce
  -> role/relationship authorization
  -> resource visibility
  -> business/workflow validation
  -> transaction and concurrency protection
~~~

## 2. Discovery method and evidence

การสำรวจทำจาก repository ปัจจุบัน โดย:

- อ่าน AGENTS.md, CONTEXT.md, docs/agents/domain.md และ architecture records ที่เกี่ยวข้อง ได้แก่ module-boundaries.md, dependency-rules.md, employee-migration.md, auth-session-identity-migration.md, leave-migration.md, routine-migration.md, stock-migration.md, audit-migration.md และ ADR 0001–0003
- ค้นหา repository-wide ทั้งคำตรงและ semantic call chains สำหรับ role, auth guards, ownership, creator/assignee/requester/approver/manager/participant, export/audit/recovery/settings, feature flags, 401/403/redirect/not-found และ query where clauses
- อ่าน implementation และ callers ของ route guards, service/application functions, transaction assertions, persistence queries และ presentation projections
- เทียบกับ tests ที่มีอยู่ โดยเฉพาะ route tests, application query/mutation tests, domain tests และ integration tests
- ไม่ได้เชื่อมต่อหรืออ่าน production database ใน Phase 0; query scope ด้านล่างเป็น static behavior ที่ trace ได้จาก code/test

Source entry points หลัก:

- Role: lib/ssot/permissions.ts:isAdminRole
- API auth: lib/auth/api.ts:requireApiSession, lib/auth/api.ts:requireAdminSession, lib/auth/server.ts:getApiAuthSession
- Workforce: lib/auth/workforce.ts:requireActiveWorkforceSession, lib/auth/workforce.ts:requireActiveWorkforceOrAdminSession, lib/auth/workforce-transaction.ts:assertActiveWorkforceInTransaction
- Dashboard projection/guards: app/_lib/auth/current-user.ts:getCurrentUserProjection, app/dashboard/_lib/route-access.ts:requireDashboardAuditCapability, requireDashboardEmployeeCapability และ requireDashboardEmailRequestAccess
- LIFF: modules/line/application/liff.ts:requireLiffWorkforceSession, modules/line/application/liff.ts:getLiffCapabilities
- Domain-specific rules: modules/routine/application/authorization.ts, modules/routine/application/queries.ts, modules/routine/application/mutations.ts, modules/stock/application/queries/queries.ts, modules/stock/application/requests/request-mutations.ts, modules/leave/application/approvals/**, modules/leave/application/cancellation/cancellation.ts, modules/leave/application/not-taken.ts
- Employee server authorization: modules/employee/application/authorization.ts เป็น adapter เดียวเหนือ central resolver; routes ใช้ requireApiSession() เป็น authentication/workforce eligibility แล้วให้ adapter ตัดสิน capability application authorization

## 3. Global current enforcement model

### 3.1 API session and role

requireApiSession() เรียก getApiAuthSession() ซึ่ง:

1. อ่าน hybrid access cookie
2. resolve account ด้วย resolveAuthenticatedAccount
3. ปฏิเสธ account ที่ไม่ valid, inactive หรือถูกลบผ่าน account identity boundary
4. เรียก hasEligibleCurrentEmployeeForUser ซึ่งต้องพบ Employee ที่ ACTIVE และ deletedAt = null
5. สร้าง ApiAuthSession และ UserContext

ดังนั้นใน production call chain ปัจจุบัน API session ที่ผ่าน requireApiSession() ต้องมีทั้ง account ที่ใช้งานได้และ current eligible Employee แม้บาง application helper จะออกแบบให้ Admin ไม่มี Employee ได้

requireAdminSession() ทำต่อจาก requireApiSession() และใช้ isAdminRole(auth.user.role):

- ไม่มี session หรือ account/workforce eligibility ไม่ผ่าน: 401 โดย default
- มี session แต่ role ไม่ใช่ ADMIN: 403 โดย default
- unauthorizedResponse และ forbiddenResponse ของ caller เปลี่ยน status/message ได้; จึงต้องดู route ประกอบ ไม่สรุปจากชื่อ helper อย่างเดียว

### 3.2 Active workforce

requireActiveWorkforceSession() เรียก API session อีกชั้น แล้ว re-read User/Employee:

- User ต้อง active และไม่ถูกลบ
- ต้องมี Employee
- Employee ต้อง ACTIVE และไม่ถูกลบ
- ไม่มี Employee: default 404 หรือ custom employee-profile response
- Employee inactive/deleted: 403

requireActiveWorkforceOrAdminSession() มี branch ระดับ helper ที่คืน Admin ได้โดยไม่ตรวจ active Employee ขณะที่ USER ต้องมี Employee ที่ ACTIVE; อย่างไรก็ตาม `requireApiSession()` ที่อยู่ก่อนหน้าเรียก `resolveAuthenticatedAccount()` และตรวจ current eligible Employee แล้ว ดังนั้นเส้นทาง HTTP production ที่เรียกผ่าน API session ปกติไม่เปิดทางให้ account-only Admin ผ่านได้. Stock transaction adapter ยังเก็บ Dashboard ADMIN account-only lifecycle branch เฉพาะที่ resolve ด้วย `employeeId = null` ได้สำหรับ `inventory.manage`, `request.process` และ `request.cancel`; Leave ยังคงมี Dashboard Admin account-only lifecycle branch ที่แคบของตนเอง. Routine ยังคง branch lifecycle ที่แคบสำหรับ approved Dashboard ADMIN account-only exception แต่ authority ของ enforced Routine capability ผ่าน central composition แล้ว. Branch เหล่านี้ยังควรถูกถือเป็น lifecycle seam ที่ต้องทดสอบในกรณี test seam และ race ระหว่าง lifecycle ไม่ใช่ authority ใหม่

Mutation ที่มีผลต่อข้อมูลสำคัญยัง re-check ใน transaction เช่น assertActiveWorkforceInTransaction, assertActiveRoutineActorInTransaction และ assertActiveAdminInTransaction พร้อม lock User/Employee หรือ resource row ตาม domain

### 3.3 Dashboard

- proxy.ts ตรวจ hybrid access token เฉพาะ web route เพราะ matcher ไม่ครอบ /api; ทำหน้าที่ authentication/routing ไม่ใช่ domain authorization
- app/dashboard/layout.tsx เรียก getCurrentUserProjection; ถ้าไม่มี current active Employee projection จะ redirect ไป login
- `requireDashboardEmailRequestAccess()` เป็น capability-aware redirect guard ของ Email Request; Audit ใช้ `requireDashboardAuditCapability()` และ Authorization Administration ยังคงใช้ ADMIN-only guard แยกต่างหาก
- DashboardProvider, constants/dashboard.ts และ DashboardSidebar กรอง menu/requiredRole/feature flag ฝั่ง client
- Dashboard page ที่มี server-side authorization guard ปัจจุบันแยกตาม surface: Audit ใช้ `requireDashboardAuditCapability()` จาก `auditCapabilities`, Email Request ใช้ `requireDashboardEmailRequestAccess()` จาก `emailRequestCapabilities`, Authorization Administration ยังคง ADMIN-only และ Employee New/Import ใช้ `requireDashboardEmployeeCapability()` ตาม capability ของตนเอง
- หน้า Employee Management, Leave, Routine และ Stock อาศัย layout/feature/API guards เป็นหลัก; การเห็นหรือไม่เห็น tab/button ไม่ใช่ server authorization

### 3.4 LIFF

requireLiffWorkforceSession():

- ไม่มีหรือ verify LIFF session ไม่ผ่าน: 401
- configuration verification failure: 500
- account inactive/deleted หรือ Employee ไม่ active/deleted: 403
- current LINE link ไม่ตรงกับ claim: 401
- re-read DB failure ตอนตรวจ link: 500
- สำเร็จเมื่อ account active, Employee active และ LINE identity ปัจจุบันตรงกัน

getLiffCapabilities() คืนค่า:

| Capability projection | Current source |
|---|---|
| stockCapabilities | `getStockPresentationCapabilities(..., LIFF_SELF_SERVICE)` จาก central resolver และ Phase 12B additive composition |
| canRequestStock | `stockCapabilities.canReadCatalog && stockCapabilities.canCreateRequests` (legacy alias) |
| canProcessStockRequests | `stockCapabilities.canProcessRequests` (legacy alias) |
| leaveCapabilities | `getLeavePresentationCapabilities(buildLeaveAuthorizationContext(session.user, session.employeeId, LIFF_SELF_SERVICE))` จาก central resolver และ permanent Leave additive composition; เป็น immutable granular Leave contract |
| canRequestLeave | `FEATURE_KEYS.leave && leaveCapabilities.canReadOwnRequests && leaveCapabilities.canCreateOwnRequests` (legacy alias) |
| canApproveLeave | `FEATURE_KEYS.leave && leaveCapabilities.canReadAssignedApprovals && getLiffLeaveRelationshipProjection(employeeId).hasActionableApproval` (legacy relationship-sensitive alias) |
| canCreateOwnRoutine | `FEATURE_KEYS.routine && routineCapabilities.canCreateTasks` |

ค่าเหล่านี้ใช้ home/UI projection; Leave own/assigned data requests ต้องผ่าน field read และ relationship hint ที่เกี่ยวข้อง และ route ที่ทำ mutation ยังตรวจ session, capability, relationship และ workflow เอง

## 4. Historical Authorization Matrix (pre-Phase 12H-I)

ตารางต่อไปนี้ใช้ field เดียวกันทุก domain โดย `Channel` ในตารางหมายถึง entry-point / transport surface ของ current implementation; ไม่ใช่ future `AuthorizationActor.channel`:

Module / Domain, Channel, Entry Point / Operation, Resource, Authentication Requirement, Account / Workforce Lifecycle Requirement, Current Authorization Rule, System Role Dependency, Resource / Domain Relationship, Current Effective Scope Semantics, Feature Flag Dependency, Enforcement Location, Presentation Projection, Unauthorized Outcome, Relevant Tests และ Migration Invariant / Notes

### 4.1 Cross-cutting guards and Dashboard

| Module / Domain | Channel | Entry Point / Operation | Resource | Authentication Requirement | Account / Workforce Lifecycle Requirement | Current Authorization Rule | System Role Dependency | Resource / Domain Relationship | Current Effective Scope Semantics | Feature Flag Dependency | Enforcement Location | Presentation Projection | Unauthorized Outcome | Relevant Tests | Migration Invariant / Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Cross-cutting API | API | Any route using requireApiSession() | User/account plus current workforce eligibility | Hybrid access cookie and authenticated account | Account active/not deleted; eligible Employee active/not deleted through legacy adapter | Authentication/workforce gate only; no role grant by itself | None | None | Actor identity only | None | lib/auth/api.ts, lib/auth/server.ts, modules/auth/application/account-identity.ts, modules/employee/infrastructure/persistence/employee-queries.ts | None | Default 401; caller may override | __tests__/api/hybrid-auth-routes.test.ts, __tests__/auth/workforce.test.ts | Preserve legacy API Employee eligibility until an explicit contract change |
| Cross-cutting API | API | Any route using requireAdminSession() | Admin operation selected by caller | Same as requireApiSession() | Same as API session | isAdminRole(role) must be true | ADMIN | Domain rules remain with caller/service | Usually all only where domain route allows | Caller-specific | lib/auth/api.ts | Admin menu/route hints are separate | Default non-admin 403; custom factories may collapse unauthenticated to 403 | __tests__/api/hybrid-auth-routes.test.ts, route-specific tests | Do not treat Admin as business/workflow bypass |
| Cross-cutting workforce | API | requireActiveWorkforceSession() | Current Employee identity | API session | User active/not deleted; Employee exists, ACTIVE, not deleted | Active workforce gate; no broad resource grant | None | Current User-to-Employee link | Current Employee only | None | lib/auth/workforce.ts | Current-user name projection | Missing profile 404 by default; inactive/deleted 403; unauthenticated normally 401 | __tests__/auth/workforce.test.ts, __tests__/auth/workforce-transaction.test.ts | Transaction variants must remain fail-closed |
| Dashboard | DASHBOARD | Shared /dashboard layout | Dashboard session | Hybrid access cookie resolved by getCurrentUserProjection() | Account active/not deleted and current Employee lifecycle eligible | Authenticated current workforce can enter shared shell; no Admin requirement in layout | None at layout | Current Employee projection | Current Employee only | None | app/dashboard/layout.tsx, app/_lib/auth/current-user.ts | DashboardProvider receives role plus Leave/Stock/Routine/Employee projections | Missing projection redirects to /login | __tests__/auth/current-user-projection.test.ts, __tests__/lib/dashboard-routes.test.ts | Shared layout protection is not equivalent to per-page Admin authorization |
| Dashboard | DASHBOARD | Audit page and Email Request page | Audit capability page / Email Request capability page | Shared Dashboard session | Current active Employee projection | Audit uses `requireDashboardAuditCapability()` and `auditCapabilities.canReadAuditLogs`; Email Request uses `requireDashboardEmailRequestAccess()` while its API remains independently authoritative through the centralized adapter | Audit: central `audit.read / ALL`; Email Request: `read OWN/ALL` and `create ALL` through the current resolver, with temporary legacy ADMIN compatibility | None beyond current workforce | Audit all logs after capability authorization; Email Request query breadth is selected by configured `OWN`/`ALL` | Surface-specific | app/dashboard/_lib/route-access.ts, app/dashboard/audit/page.tsx, app/dashboard/email-request/page.tsx, app/api/email-request/route.ts, lib/services/email-request/authorization.ts | Audit uses the Audit capability projection; Email Request uses `canReadRequests` / `canCreateRequests` and independently renders history/form | Missing Email Request capabilities redirect `/access-denied`; absent user `/login`; API still denies without configured authority | __tests__/lib/dashboard-routes.test.ts, Audit presentation/route tests, Email Request tests | Email Request menu/page/form/history are capability-projected; no client projection is a server authorization boundary |
| Dashboard | DASHBOARD | Employee Management page | Employee list/stats UI | Shared Dashboard session | Current active Employee projection | Trusted current-user Employee projection gates each presentation surface; no page role gate | No Employee presentation role gate | API list/stats remain server-authorized and organization-wide | List requires `canReadEmployees`; stats requires `canReadStats`; either can make the entry available | None | app/dashboard/employees/page.tsx, modules/employee/presentation/dashboard/EmployeeManagementSection.tsx, EmployeeProvider | `employeeCapabilities` independently gates list/stats/create/import/update/export; delete is projected but unused | UI access is not proof of API mutation/read authorization | Employee presentation tests, __tests__/api/employees-routes.test.ts, __tests__/dashboard-employee-pages.test.tsx | Phase 8C closes the main RSC boundary and complete current production-surface audit; broad data policy remains unchanged |
| Dashboard | DASHBOARD | Leave, Routine, Stock pages and tabs | Domain UI | Shared Dashboard session | Current active Employee projection | Page-level role gates are not the authoritative domain decision; feature and API routes decide | Domain-specific | Domain-specific | UI chooses default/self/admin tabs from projection | Leave/Routine flags | app/dashboard/leave/page.tsx, app/dashboard/routine/page.tsx, app/dashboard/stock/page.tsx and domain presentations | Leave uses `leaveCapabilities` plus existing Leave relationship/report projections; Stock uses stockCapabilities; Routine retains its existing projection; feature hides | UI hidden/redirect can differ from direct API result | Domain route/presentation tests | Never document hidden UI as server enforcement |
| Dashboard | DASHBOARD | Sidebar/menu click | Menu item | Already in authenticated shell | Current projection | Capability projections and feature checks are client-side navigation checks; `requiredRole = ADMIN` remains only for Authorization Administration | ADMIN only for the configured control-plane item | None | Domain-specific capability projection; menu visibility only | getAvailableMenuGroups() applies flags and projections | constants/dashboard.ts, components/dashboard/context/dashboard/DashboardProvider.tsx | Hidden menu or client `/access-denied` push | Hidden or client redirect only | __tests__/constants/dashboard-menu.test.ts, __tests__/context/DashboardProvider.test.tsx | Presentation-only; direct navigation/API must still be tested |

### 4.2 Employee, Department and account-adjacent operations

| Module / Domain | Channel | Entry Point / Operation | Resource | Authentication Requirement | Account / Workforce Lifecycle Requirement | Current Authorization Rule | System Role Dependency | Resource / Domain Relationship | Current Effective Scope Semantics | Feature Flag Dependency | Enforcement Location | Presentation Projection | Unauthorized Outcome | Relevant Tests | Migration Invariant / Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Employee | API | GET /api/employees | Employee records | requireApiSession() then `employee.read / ALL` | Legacy eligible active Employee | Employee adapter composes permanent normal-USER default `ALL` with central configured authority; valid configured grants are additive and cannot narrow the baseline | ADMIN uses central SYSTEM_ROLE authority; no role-derived Employee default | Query excludes deletedAt != null and configured bootstrap-admin emails | Organization-wide non-deleted list; optional status/search/pagination | None | app/api/employees/route.ts, modules/employee/application/authorization.ts, modules/employee/infrastructure/persistence/employee-queries.ts:listEmployees | Employee list/search/filter/pagination requires `canReadEmployees`; presentation is now Phase 12C.2 composition | Default/custom 401; capability deny 403; query errors 500 | __tests__/api/employees-routes.test.ts, modules/employee/application/authorization.test.ts, Employee presentation tests | Broad read query is preserved as permanent default policy; no OWN/TEAM/Department scope |
| Employee | API | GET /api/employees/stats | Employee aggregates | requireApiSession() then `employee.stats.read / ALL` | Legacy eligible active Employee | Employee adapter composes permanent normal-USER default `ALL` with central configured authority; valid configured grants are additive and cannot narrow the baseline | ADMIN uses central SYSTEM_ROLE authority; no role-derived Employee default | Counts are organization-wide; implementation counts status/admin/academic buckets without the list query's deleted/bootstrap filter | All persisted Employee counts as implemented | None | app/api/employees/stats/route.ts, modules/employee/application/authorization.ts, getEmployeeStats | Stats cards require `canReadStats`; presentation is now Phase 12C.2 composition | 401, capability deny 403 or service 500 | __tests__/api/employees-routes.test.ts, modules/employee/application/authorization.test.ts, Employee presentation tests | Aggregate query and its filtering difference are unchanged |
| Employee | API | GET /api/employees/export | Employee CSV | requireApiSession() then `employee.export / ALL` | Legacy eligible active Employee | Employee adapter composes permanent normal-USER default `ALL` with central configured authority; valid configured grants are additive and cannot narrow the baseline | ADMIN uses central SYSTEM_ROLE authority; no role-derived Employee default | createEmployeeWhereClause: non-deleted, excludes bootstrap-admin emails, optional status/search | Organization-wide filtered Employee export; no actor ownership scope | None | app/api/employees/export/route.ts, modules/employee/application/authorization.ts, modules/employee/infrastructure/export/employee-export.ts | Export control and handler require `canExportEmployees`; presentation is now Phase 12C.2 composition | 401, validation/limit 400, capability deny 403, service error 500 | __tests__/api/authorization-current-state.test.ts, modules/employee/application/authorization.test.ts, Employee presentation tests | Broad export is intentionally preserved as permanent default; no PII/privacy redesign in this phase |
| Employee | API | POST /api/employees (`employee.create`), PATCH /api/employees/:id (`employee.update`), DELETE /api/employees/:id (`employee.delete`), POST /api/employees/import (`employee.import`) | Employee lifecycle/data | requireApiSession() then corresponding Employee capability `/ ALL` | API eligible active Employee; update/delete mutation service rechecks transaction state | Employee adapter composes an empty normal-USER default; no-grant USER is denied and explicit valid `ALL` grants are honored | ADMIN uses central SYSTEM_ROLE authority; ADMIN is not manufactured by the default policy | Locks User/Employee; blocks self-offboarding, last active Admin removal, subordinate/Leave dependencies; account lifecycle may deactivate/revoke auth | Authorized actor may target selected Employee; no Team/Department authorization; import remains partial-success | None | Routes under app/api/employees/**, modules/employee/application/authorization.ts, modules/employee/application/mutations.ts, Auth lifecycle port | Add/import/edit presentation uses `canCreateEmployees`, `canImportEmployees`, and `canUpdateEmployees`; `canDeleteEmployees` is projected but unused because no delete UI exists | Existing custom/default 401/403; validation/domain conflicts 400/409; missing target 404 | __tests__/api/employees-routes.test.ts, Employee presentation tests, modules/employee/application/authorization.test.ts, modules/employee/application/mutations.test.ts, modules/employee/schemas/employee.test.ts | Empty default preserves no-grant denial; capability ALLOW never bypasses lifecycle/business/audit rules |
| Department | API | GET /api/departments | Department reference data | requireApiSession() then `department.read / ALL` | Legacy eligible active Employee | Department adapter composes permanent Default Domain Policy `ALL` with central configured authority; configured grants are additive and cannot narrow the baseline | ADMIN uses central SYSTEM_ROLE authority; no role-derived Department authority | Organization-wide department reference list | ALL departments returned | None | app/api/departments/route.ts, modules/department/application/authorization.ts, modules/department/application/queries.ts, central resolver + composer | Employee Add/Edit selectors use `departmentCapabilities.canReadDepartments`; unauthorized reference state is distinct from authorized-empty state; Phase 12C.1 projection uses the same composition path | Caller intentionally maps missing auth and capability denial to 403; otherwise 500 | __tests__/api/departments-route.test.ts, modules/department/application/authorization.test.ts | Department remains HR/reference data, not authorization input or Team substitute; existing order/shape unchanged |
| Account lifecycle | API | /api/auth/me, session listing/revoke/logout and account-link routes | User/account/session or linked LINE identity | Auth-specific access/refresh/CSRF/LINE verification | Current-user projection requires active Employee; session management is User-self scoped; account-link requires active workforce | These are authentication/account identity or self-management boundaries, not new domain permissions | Role not used for generic session self-management | Session operations target authenticated User's own records; account-link targets current User | OWN/self account/session | None | app/api/auth/**, app/api/line/account-link/route.ts, modules/auth/**, lib/auth/** | Auth status and session management UI | Mostly 401, validation 400, self-target not found/forbidden per route | __tests__/api/hybrid-auth-routes.test.ts, __tests__/auth/current-user-projection.test.ts, __tests__/integration/auth-session-concurrency.integration.test.ts | Out of Phase 0 authorization migration; preserve identity/session behavior |

Employee current authorization detail:

- `modules/employee/application/authorization.ts` เป็น Employee adapter เหนือ central resolver: ตรวจเฉพาะ registered capabilities และ scope `ALL`, compose default `ALL` ของ read/stats/export กับ configured authority และคง default ว่างของ create/update/delete/import; explicit `ALLOW` ของ normal `USER` เป็น authority โดยไม่ promote role
- `resolveEmployeeCapabilityInTransaction()` ใช้กับ update/delete เพื่อ lock และ re-read lifecycle ของ User/Employee ปัจจุบัน แล้ว re-resolve และ compose capability ใน transaction เดิม
- Employee routes ใช้ `requireApiSession()` สำหรับ authentication/workforce eligibility และใช้ Employee capability adapter สำหรับ application authorization; `requireAdminSession()` ไม่ใช่ mutation authority ปัจจุบันของ Employee

### 4.3 Routine

| Module / Domain | Channel | Entry Point / Operation | Resource | Authentication Requirement | Account / Workforce Lifecycle Requirement | Current Authorization Rule | System Role Dependency | Resource / Domain Relationship | Current Effective Scope Semantics | Feature Flag Dependency | Enforcement Location | Presentation Projection | Unauthorized Outcome | Relevant Tests | Migration Invariant / Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Routine | API | GET /api/routines/tasks | Active/inactive RoutineTask management list | `requireActiveWorkforceOrAdminSession()` | API eligibility; service transaction rules for mutations | `routine.task.read` uses the permanent Routine default/composition path before `buildRoutineTaskAccessWhere`; resource relationships remain domain-owned | Dashboard ADMIN uses central `SYSTEM_ROLE / ADMIN`; LIFF ADMIN uses the Routine self-service channel policy; explicit USER grants remain additive | createdById or current active task assignee for USER | Management default is `CREATED + ASSIGNED`; relationship query remains creator-or-current-task-assignee, not simply “mine” | routineFeatureGuard() | app/api/routines/tasks/route.ts, modules/routine/application/authorization.ts, modules/routine/application/queries.ts:buildRoutineTaskAccessWhere | `canReadTasks`, `canEdit`, `canDelete` | Feature disabled 404; malformed 400; capability/workforce denial 403 | __tests__/api/routines-tasks.test.ts, modules/routine/application/authorization.test.ts, modules/routine/application/queries.test.ts | Keep capability authority distinct from task-management relationship scope |
| Routine | API | GET /api/routines/tasks/:id | RoutineTask detail and occurrences | `requireActiveWorkforceOrAdminSession()` | Active workforce/admin actor checks | `routine.task.read` uses permanent additive composition, then the detail query applies the Routine-owned resource predicate | Dashboard ADMIN uses central `SYSTEM_ROLE / ADMIN`; LIFF ADMIN is constrained by the self-service channel policy; explicit USER grants can expand supported resource access | Creator/current task assignee; LIFF detail also preserves active occurrence-assignee access | Single resource filtered by relationship | Routine flag | app/api/routines/tasks/[id]/route.ts, modules/routine/application/authorization.ts, getRoutineTaskById | `canReadTasks`, `canEdit`, `canDelete` | Capability denial 403; unauthorized relation is domain not-found/error response | __tests__/api/routines-task-by-id.test.ts, modules/routine/application/authorization.test.ts, modules/routine/application/queries.test.ts | Do not turn capability booleans into a substitute for query scope |
| Routine | API | POST /api/routines/tasks | New RoutineTask | `requireActiveWorkforceOrAdminSession()` plus body/idempotency/rate guards | Transaction validates active User; normal USER needs active Employee; Dashboard ADMIN retains the approved account-only exception where applicable | `routine.task.create` uses permanent additive composition and is rechecked in the transaction; USER input is normalized to actor as OWNER | Dashboard ADMIN uses central `SYSTEM_ROLE / ADMIN`; explicit USER `ALL` is not administrative | USER ownership is actor; referenced assignees must be active | Default `OWN`; created task is actor-owned for normal USER; Dashboard ADMIN can choose assignees | Routine flag | Route plus modules/routine/application/authorization.ts, createRoutineTask and assertActiveRoutineActorInTransaction | UI offers own routine projection | 401/403, validation 400, domain conflict 409 | __tests__/api/routines-tasks.test.ts, modules/routine/application/authorization.test.ts, modules/routine/application/mutations.test.ts | Preserve self-service normalization and idempotency; capability ALLOW does not bypass lifecycle/business rules |
| Routine | API | PATCH /api/routines/tasks/:id | RoutineTask fields | `requireActiveWorkforceOrAdminSession()` plus validation/rate guard | Transaction locks/rechecks active actor and references | `routine.task.update` uses permanent additive composition and is rechecked in the transaction; creator/active-assignee edit rules remain domain-owned | Dashboard ADMIN uses central `SYSTEM_ROLE / ADMIN`; explicit USER `ALL` is not administrative | Creator vs current active task assignee; assignee is not equivalent to creator | Default `CREATED + ASSIGNED`; creator can change lifecycle, assignee can edit content only; inactive/deleted assignee denied | Routine flag | updateRoutineTask, buildRoutineTaskEditScope, modules/routine/application/authorization.ts, mutation transaction | Edit action flags | Capability/relation denial 403; state/validation errors 400/409 | __tests__/api/routines-task-by-id.test.ts, modules/routine/application/authorization.test.ts, modules/routine/application/queries.test.ts | Critical creator/assignee distinction remains after capability authorization |
| Routine | API | DELETE /api/routines/tasks/:id | RoutineTask | `requireActiveWorkforceOrAdminSession()` plus transaction checks | Transaction active actor and current capability | `routine.task.delete` uses permanent additive composition and is rechecked in the transaction; USER deletion remains creator-scoped | Dashboard ADMIN uses central `SYSTEM_ROLE / ADMIN`; explicit USER `ALL` is not administrative | Current assignee who is not creator cannot delete under the baseline relationship policy | Default `CREATED`; configured `ALL` may broaden target lookup; existing cleanup/invariants remain | Routine flag | deleteRoutineTask, buildRoutineTaskDeleteScope, modules/routine/application/authorization.ts | Delete button based on `canDelete` | Capability/relation denial 403; state/concurrency 404/409 domain mapping | modules/routine/application/delete.test.ts, __tests__/api/routines-task-by-id.test.ts | Preserve creator-only USER delete and transaction invariants |
| Routine | API | GET /api/routines/occurrences and GET /api/routines/occurrences/:id | RoutineOccurrence | `requireActiveWorkforceOrAdminSession()` | Active User/Employee context; active task required | `routine.occurrence.read` uses permanent additive composition before the occurrence query | Dashboard ADMIN uses central `SYSTEM_ROLE / ADMIN`; LIFF is structurally unsupported; explicit supported USER grants remain additive | Occurrence-level assignee, which can differ from task-level assignment | Default `ASSIGNED`; `ASSIGNED`/`ALL` capability scopes are translated at the occurrence layer | Routine flag | getRoutineOccurrences, getRoutineOccurrenceById, modules/routine/application/authorization.ts, buildWorkOccurrenceWhere | Occurrence list/detail and focus links | Capability denial 403; feature 404, relation not-found 404, validation 400 | __tests__/api/routines-occurrences.test.ts, __tests__/api/routines-occurrence-by-id.test.ts, modules/routine/application/queries.test.ts | Distinguish task assignee from task creation ownership |
| Routine | API | GET /api/routines/occurrences?view=tasks | RoutineTask operational work items | `requireActiveWorkforceOrAdminSession()` | Active context from route; query itself uses supplied actor/employee | `routine.task.read` with `taskReadView: "work-item"` uses permanent context-sensitive composition before `getRoutineTaskWorkItems`; scope != all filters current assignee | No independent role gate inside this query path; Routine default and configured authority are both composed | Current task assignee only when mine; focused occurrence has additional checks | Work-item default `ASSIGNED` for mine and intentionally `ALL` for all; focus path can allow occurrence-only assignment | Routine flag | app/api/routines/occurrences/route.ts, modules/routine/application/authorization.ts, modules/routine/application/queries.ts:getRoutineTaskWorkItems | Operational task cards and per-task capabilities | Route accepts valid scope; capability/workforce errors 403; no authorization error for the permanent USER all-scope default | modules/routine/application/queries.test.ts test “returns all active tasks for a regular user's all-task scope” | Phase 12A locks the work-item `scope=all` behavior; preserve it until a separate business-policy decision |
| Routine | API | GET /api/routines/summary | Routine KPI counts | Workforce/admin helper | Active context from route | Resolves `routine.summary.read` after validating `scope=mine|all`; Dashboard mine uses `ASSIGNED`, Dashboard all preserves broad `ALL`, and LIFF route forces mine/self-service | Dashboard ADMIN uses central `SYSTEM_ROLE / ADMIN`; LIFF ADMIN remains self-service | Task assignee scope when mine; all is available only in trusted Dashboard context with effective `ALL` | MINE or ALL according to validated server-owned view intent | Routine flag | app/api/routines/summary/route.ts, getRoutineSummary, modules/routine/application/authorization.ts | `canReadSummary`; KPI cards remain presentation-only | Feature 404, invalid scope 400, capability/configuration errors via Routine mapping | __tests__/api/routine-summary.test.ts, __tests__/api/line-routine-self-service-routes.test.ts, modules/routine/application/queries.test.ts | Phase 12D permanent context-sensitive policy; KPI/date/active-task semantics unchanged |
| Routine | API | GET /api/routines/reference | Units, categories, employee assignment references | Workforce/admin helper | Current API context | Resolves `routine.reference.read`; normal USER baseline is OWN/current linked active Employee, effective Dashboard ALL may expand eligible active Employees, and shared units/categories remain active reference data | Dashboard ADMIN uses central `SYSTEM_ROLE / ADMIN`; LIFF channel policy remains self-service | Current linked Employee vs all eligible active Employees; LIFF response omits employees | OWN or ALL only for the Employee portion; shared references remain available | Routine flag | app/api/routines/reference/route.ts, getRoutineReferenceData, modules/routine/application/authorization.ts | `canReadReference`; LIFF serialization omits employees | Feature/auth/domain errors | __tests__/api/routines-reference.test.ts, __tests__/api/line-routine-self-service-routes.test.ts, modules/routine/application/queries.test.ts | Phase 12D permanent policy; active/deleted Employee filtering and data minimization unchanged |
| Routine | API | GET /api/routines/export | RoutineTask XLSX | Workforce/admin helper | Current API helper plus export query actor | Resolves `routine.task.export` in the application query before the active all-scope task predicate; normal Dashboard USER receives permanent `ALL`, Dashboard ADMIN uses central `SYSTEM_ROLE / ADMIN` | No role/read-task borrowing; ADMIN authority comes from the central resolver | Broad active Routine task export as explicitly approved | ALL for eligible Dashboard users; LIFF is unsupported by the registry | Routine flag | app/api/routines/export/route.ts, modules/routine/application/queries.ts:getRoutineTaskExportData, modules/routine/infrastructure/reports/routine-export.ts | `canExportTasks`; API independently enforces the capability | 401, invalid/limit 400, capability/configuration/service errors via Routine mapping | __tests__/api/routine-export.test.ts, modules/routine/application/queries.test.ts, modules/routine/infrastructure/reports/routine-export.test.ts | Phase 12D permanent export policy; row limit, active filtering, batching, XLSX and audit behavior unchanged |
| Routine | API | Routine occurrence due-date/assignee/override mutations | Occurrence and occurrence assignees | `requireActiveWorkforceOrAdminSession()` plus validation/rate guard | Trusted Routine actor; `assertActiveRoutineActorInTransaction`; target Employees must be active | Route/service calls `assertRoutineCapability()` for `routine.occurrence.override`, `routine.occurrence.reassign` or `routine.occurrence.change_due_date`; transaction re-resolves the same capability before domain rules | Dashboard ADMIN uses central `SYSTEM_ROLE / ADMIN`; explicit supported USER grants remain reachable; LIFF is structurally unsupported | Active target assignees; row/version/reminder locks and occurrence business rules | Central-only capabilities have empty USER default and `ALL` only when authorized on DASHBOARD; domain target/state rules still apply | Routine flag | app/api/routines/occurrences/[id]/**, assertRoutineCapability, modules/routine/application/authorization.ts, modules/routine/application/mutations.ts | Occurrence controls use `canOverrideOccurrences`, `canReassignOccurrences` and `canChangeOccurrenceDueDate` | Capability denial 403; validation/state/concurrency 400/409 | __tests__/api/routines-occurrence-by-id.test.ts, __tests__/api/routines-legacy-occurrence-mutations.test.ts, modules/routine/application/mutations.test.ts | Capability authority and active target/business/transaction invariants all remain required; route is not generic Admin-only |
| Routine | LIFF_SELF_SERVICE | LIFF task list/create/detail/update/delete | RoutineTask and relevant occurrence | `requireLiffWorkforceSession()` | Active linked LINE workforce | `routine.task.read/create/update/delete` are resolved through the Routine adapter with the trusted `LIFF_SELF_SERVICE` actor mode; Admin is not elevated for task relationships/capabilities | Admin role is intentionally constrained by channel mode, not used as a client-supplied authority | Creator, current active task assignee, or active occurrence-only assignee for detail; create forces linked Employee OWNER | Task list/summary forced MINE; creator/assignee relationship for detail; creator delete; assignee content edit | Routine LIFF flag; disabled 404 | app/api/line/routine/tasks/**, modules/routine/application/authorization.ts, getLiffRoutineTaskById | `/api/line/home` gates module/task read with `canReadTasks`; create uses `canCreateTasks`; edit uses `canUpdateTasks && task.canEdit`; delete uses `canDeleteTasks && task.canDelete`; lifecycle remains resource-scoped; no occurrence-admin/import controls | LIFF session 401/403/500; capability/relation/domain errors 403/404/409 | __tests__/api/line-routine-routes.test.ts, __tests__/api/line-routine-self-service-routes.test.ts, modules/routine/application/mutations.test.ts | Critical channel-aware Admin invariant; server enforcement remains authoritative |
| Routine | LIFF_SELF_SERVICE | LIFF reference route | Active Employee reference data | LIFF workforce session | Active linked LINE workforce | Route creates an actor with explicit `LIFF_SELF_SERVICE` mode; reference serialization removes employees from the response | ADMIN does not select the Dashboard channel; no employee list is serialized to the LIFF client | Channel-aware internal query; client-visible response omits employees for both roles | Client-visible reference response contains units, categories, scheduleTypes and businessDayPolicies only | Routine LIFF flag | app/api/line/routine/reference/route.ts, getRoutineReferenceData, modules/routine/server/liff-serialization.ts:serializeLiffRoutineReference | serializeLiffRoutineReference | LIFF/auth/feature errors | __tests__/api/line-routine-self-service-routes.test.ts | Phase 9C closed the actor mode omission; preserve the no-employee-list response boundary |

| Routine | LIFF_SELF_SERVICE | LIFF summary route | Routine KPI counts | `requireLiffWorkforceSession()` | Active linked LINE workforce | Registered `routine.summary.read` remains intentionally deferred; route creates the actor with explicit `LIFF_SELF_SERVICE` mode and calls `getRoutineSummary` with server-derived `employeeId` and forced `scope: "mine"`; client scope/employeeId input is not authorization authority | ADMIN does not select the Dashboard channel | Linked LIFF Employee only | MINE | Routine LIFF flag | app/api/line/routine/summary/route.ts, getRoutineSummary | No Phase 9C capability projection; summary response only | LIFF/auth/feature errors | __tests__/api/line-routine-self-service-routes.test.ts, __tests__/api/routine-summary.test.ts | Deferred legacy/domain path; Phase 9C closes the missing actor mode without widening self-service data |
### 4.4 Stock

| Module / Domain | Channel | Entry Point / Operation | Resource | Authentication Requirement | Account / Workforce Lifecycle Requirement | Current Authorization Rule | System Role Dependency | Resource / Domain Relationship | Current Effective Scope Semantics | Feature Flag Dependency | Enforcement Location | Presentation Projection | Unauthorized Outcome | Relevant Tests | Migration Invariant / Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Stock | API | GET /api/stock/items, GET /api/stock/categories | Active/catalog StockItem, Variant, Category | requireActiveWorkforceOrAdminSession() then `stock.catalog.read` / DASHBOARD | Current API eligibility; catalog query filters active only where route asks | Central resolver plus permanent Stock default composition; no compatibility fallback | ADMIN authority comes from central `SYSTEM_ROLE`; explicit USER grants are additive | No requester relationship; catalog-wide | ALL catalog rows matching filters | None | Stock routes, modules/stock/application/authorization.ts and catalog queries | Dashboard browse uses `stockCapabilities.canReadCatalog` | Auth 401/403; capability denial 403; validation 400; query 500 | __tests__/api/stock-items-route.test.ts, modules/stock/__tests__/queries.test.ts, modules/stock/application/authorization.test.ts | Catalog visibility is not request visibility; default ALL is permanent |
| Stock | API | POST /api/stock/items, item PATCH/DELETE, category POST/DELETE, stock adjust | Inventory configuration and quantities | `requireActiveWorkforceOrAdminSession()` then `stock.inventory.manage` / DASHBOARD | Current API eligibility; Dashboard ADMIN account-only transaction lifecycle is limited to the approved capability set; granted USER requires active workforce | Central resolver plus empty USER default; explicit USER grants are supported and mutations revalidate in transaction | ADMIN authority comes from central `SYSTEM_ROLE`; no Stock default | Active variants, pending requests, non-negative/concurrency/foreign-key rules | ALL selected inventory records | None | Stock routes, modules/stock/application/authorization.ts, item/category mutation services | Inventory controls use `stockCapabilities.canManageInventory` | Non-authorized 403; validation/domain conflict 400/404/409 | __tests__/api/stock-items-route.test.ts, modules/stock/__tests__/mutations.test.ts | Keep inventory integrity separate from capability authorization; revocation denies when the default is empty |
| Stock | API | GET /api/stock/requests | StockRequest list | `requireActiveWorkforceOrAdminSession()` then `stock.request.read` / DASHBOARD | Current API eligibility | Central resolver plus permanent OWN default; `getRequests` consumes effective scopes and never treats client `scope=all` as authority | ADMIN authority comes from central `SYSTEM_ROLE`; explicit USER grants are additive | Stock-owned `requestedBy` predicate | Requested `all` uses organization-wide query only with effective ALL; otherwise requester-owned | None | app/api/stock/requests/route.ts, modules/stock/application/authorization.ts, modules/stock/application/queries/queries.ts:getRequests | Own/admin tabs use `canReadOwnRequests`/`canReadAllRequests`; process and cancel controls are separate | Invalid filters 400; capability denial 403; query 500 | __tests__/api/stock-requests-routes.test.ts, modules/stock/__tests__/queries.test.ts | OWN/ALL is translated by Stock; requestedScope is view intent, not authority |
| Stock | API | POST /api/stock/requests | New StockRequest | Size/idempotency/rate guards then `requireActiveWorkforceSession()` and `stock.request.create` / DASHBOARD | Active User/Employee and transaction-time workforce/authorization recheck | Central resolver plus permanent OWN default; requestedBy is always actor-derived | ADMIN uses central registered-scope authority and still requires active workforce; explicit USER grants are additive | Requester is actor; item/variant availability and pending reservations validated | OWN | None | Route plus Stock authorization adapter and createRequest transaction | Browse/cart controls use `stockCapabilities.canCreateRequests` | 401/403, capability denial 403, invalid 400, availability/conflict 409 | __tests__/api/stock-requests-routes.test.ts, modules/stock/__tests__/mutations.test.ts | Preserve requester attribution, idempotency and inventory checks |
| Stock | API | POST /api/stock/requests/:id/cancel | Pending StockRequest | Workforce/admin helper then `stock.request.cancel` / DASHBOARD | Active API session normally already has an eligible Employee; the Dashboard ADMIN account-only transaction branch can represent `employeeId = null` and rechecks account/role/lifecycle where required | Central resolver plus permanent OWN default; OWN requires requestedBy match, ALL may cancel any eligible pending request | ADMIN authority comes from central `SYSTEM_ROLE`; explicit USER ALL grants are additive | requestedBy relationship and pending status remain Stock-owned | OWN or ALL according to effective capability scopes | None | Route, Stock authorization adapter, executeCancelStockRequest, cancelRequest | Own/any cancel controls use `canCancelOwnRequests`/`canCancelAnyRequests` plus resource/state eligibility | Relation 403; absent 404; invalid state 409 | __tests__/api/stock-requests-routes.test.ts, modules/stock/__tests__/mutations.test.ts | Notification mode is derived after request load; account-only lifecycle remains limited to the approved capability set |
| Stock | API | POST /api/stock/requests/:id/review, /issue | StockRequest processing | Workforce/admin helper then `stock.request.process` / DASHBOARD for issue; review cancel uses `stock.request.cancel` | Active API session normally already has an eligible Employee; the Dashboard ADMIN account-only transaction branch can represent `employeeId = null` for process/cancel; USER/LIFF actors require active workforce; stock/request state checks remain required | Central resolver plus empty USER default protects the application transaction boundary; review remains a Stock action router | ADMIN authority comes from central `SYSTEM_ROLE`; explicit USER ALL grants are additive | Pending request, active item/variant, sufficient stock, atomic claim | ALL pending requests | None | app/api/stock/requests/[id]/review/route.ts, [id]/issue/route.ts, Stock authorization adapter and mutation services | Processing and any-request cancellation controls are independent projection gates | Non-authorized 403; state/stock errors 400/409; missing 404 | __tests__/api/stock-requests-routes.test.ts, modules/stock/__tests__/mutations.test.ts | Processing is distinct from read-all/cancel; grant revocation denies; optional-workforce behavior is lifecycle policy |
| Stock | API | GET /api/stock/reports/export | Stock balances and request report | `requireActiveWorkforceOrAdminSession()` then `stock.report.export` / DASHBOARD | Current API eligibility; granted USER path still requires active workforce | Central resolver plus empty USER default; explicit grants are additive | ADMIN authority comes from central `SYSTEM_ROLE`; no Stock default | Report is organization-wide stock/request data | ALL | None | app/api/stock/reports/export/route.ts, stock report infrastructure, Stock authorization adapter | Report tab/export controls use `stockCapabilities.canExportReports` | Non-authorized 403; query/limit 400; service errors | __tests__/api/stock-reports-export-route.test.ts, modules/stock/__tests__/report-export.test.ts | Preserve filters, row limits and XLSX behavior; no LIFF channel support |
| Stock | LIFF_SELF_SERVICE | LIFF catalog, availability and requester list/create | Stock catalog, availability, own requests | `requireLiffWorkforceSession()` then capability resolution in `LIFF_SELF_SERVICE` | Active linked LINE workforce | Central resolver plus permanent catalog/requester defaults; requester list is always forced to `mine` | ADMIN uses central authority where the registry supports the capability; processor elevation is separate | requestedBy is current LIFF User; catalog is organization-wide | Catalog/availability ALL; requests OWN | None | LIFF Stock routes, Stock authorization adapter and Stock queries | `stockCapabilities` drives module, browse, mine and create presentation; `canRequestStock` is a derived alias | LIFF 401/403/500; capability denial 403; invalid 400; domain 404/409 | __tests__/api/line-stock-routes.test.ts, modules/stock/__tests__/liff-app.test.tsx, modules/stock/application/authorization.test.ts | LIFF requester behavior is not the processor behavior |
| Stock | LIFF_SELF_SERVICE | LIFF request detail/cancel | StockRequest | LIFF workforce session then independent `stock.request.read` / `stock.request.cancel` decisions | Active linked LINE workforce | Read ALL permits detail access to another requester; OWN-only unrelated detail remains not-found; cancel uses its own effective scopes | ADMIN authority is represented by central decisions, not `isAdminRole`; LIFF channel restrictions remain structural | requestedBy for OWN; pending status for cancel | Read and cancel each use their own OWN/ALL decision | None | app/api/line/stock/requests/[id]/**, Stock authorization adapter, getRequestById and cancel command | Requester vs Processor actions are projected from effective process/cancel decisions | Unrelated 404; relation 403 on action; state 409 | __tests__/api/line-stock-routes.test.ts | Preserve 404 hiding and do not infer process from read ALL |
| Stock | LIFF_SELF_SERVICE | LIFF processing queue and issue | Pending StockRequest | Verified LIFF workforce first, then `stock.request.process` / LIFF_SELF_SERVICE | Active linked LINE workforce | Central capability-aware processor guard plus empty USER default; explicit USER ALL grants are supported | ADMIN authority comes from central `SYSTEM_ROLE`; Stock intentionally permits this privileged LIFF capability | Pending status and atomic inventory rules | ALL pending requests | None | modules/stock/presentation/liff-stock-auth.ts, LIFF processing/issue routes, Stock authorization adapter and queries | Processing tab/actions use `stockCapabilities.canProcessRequests`; `canProcessStockRequests` is a derived alias | Non-authorized 403; auth 401/403/500; state errors 404/409 | __tests__/api/line-stock-routes.test.ts, modules/stock/__tests__/mutations.test.ts | Unlike Routine, LIFF Stock ADMIN remains an intentional processor |

### 4.5 Leave

| Module / Domain | Channel | Entry Point / Operation | Resource | Authentication Requirement | Account / Workforce Lifecycle Requirement | Current Authorization Rule | System Role Dependency | Resource / Domain Relationship | Current Effective Scope Semantics | Feature Flag Dependency | Enforcement Location | Presentation Projection | Unauthorized Outcome | Relevant Tests | Migration Invariant / Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Leave | API | POST /api/leave/request | New LeaveRequest | Feature, pre-auth/body/rate guards then requireActiveWorkforceSession() and `leave.request.create` / DASHBOARD | Active User/Employee; transaction rechecks identity/capability and manager/approver eligibility | Central resolver plus permanent Leave default/composed configured authority; manager must exist and be active leave approver with usable email | No Admin bypass needed | Employee owner is actor; overlap, quota, working-day, special-reason and idempotency rules | OWN/current Employee | FEATURE_KEYS.leave; disabled 404 | Route, Leave authorization adapter, createLeaveRequest transaction | `leaveCapabilities.canCreateOwnRequests` plus existing form/domain rules | Unauthenticated/workforce 401/403/404; capability/validation 400; business 409 | __tests__/api/leave-request.test.ts, modules/leave/application/requests/** tests | Preserve manager/approver and quota rules outside generic auth |
| Leave | API | GET /api/leave/me | Current Employee leave profile/history/quota | requireActiveWorkforceSession() then `leave.request.read` / DASHBOARD | Active User/Employee | Central resolver first; query still receives only auth.employeeId; no client employee ID | No Admin resource bypass | Self current Employee | OWN/current Employee; history/query filters operate inside own profile | Leave flag | app/api/leave/me/route.ts, Leave authorization adapter, modules/leave/application/queries/profile-queries.ts | `leaveCapabilities.canReadOwnRequests` gates profile/history loading | 401/403/404; invalid page/filter 400 | __tests__/api/leave-me.test.ts, modules/leave/application/queries/active-employee-session.test.ts | Keep self scope server-derived; this does not replace participant/detail/attachment access |
| Leave | API | GET /api/leave/approvals | Actionable/history/cancellation approval list | requireActiveWorkforceSession() then `leave.approval.read` / DASHBOARD | Active User/Employee | Central resolver first; query still scopes to managerId = auth.employeeId via effective approver relationship | No broad Admin bypass; explicit grant must still use assigned query | Employee is effective approver: exception approver takes precedence, otherwise original approver; owner excluded | ASSIGNED_APPROVER; actionable states plus assigned history | Leave flag | app/api/leave/approvals/route.ts, Leave authorization adapter, getLeaveApprovalList, getAssignedLeaveApproverWhere | `leaveCapabilities.canReadAssignedApprovals` AND existing `canApproveLeave` relationship/work hint | Auth 401/403; invalid page/filter 400; query 500 | __tests__/api/leave-approvals.test.ts, modules/leave/application/approvals/approval-queries.test.ts, modules/leave/application/authorization.test.ts | managerId parameter is historical naming, not proof of manager-only policy |
| Leave | API | POST /api/leave/decision | Pending LeaveRequest approve/reject | requireActiveWorkforceSession() plus schema/rate/body guards and `leave.request.approve` / DASHBOARD | Transaction rechecks active actor/capability | Central resolver is prerequisite; Leave still requires ASSIGNED_APPROVER; owner, unrelated User and Admin not assigned are forbidden | No role bypass; explicit grant cannot bypass relationship; function retains isAdmin=false | Effective approver assignment; owner cannot approve own request | ASSIGNED_APPROVER only; PENDING state | Leave flag | app/api/leave/decision/route.ts, Leave authorization adapter, modules/leave/application/approvals/decision.ts | Approval action buttons | 403 unauthorized; 404 missing; 409 already processed/quota/special-reason | __tests__/api/leave-decision.test.ts, modules/leave/application/approvals/exception-approver.test.ts, modules/leave/application/authorization.test.ts | Important: ADMIN is not universal approval authority here |
| Leave | API | POST /api/leave/cancel | Own LeaveRequest cancellation request | requireActiveWorkforceSession() then `leave.request.cancel` / DASHBOARD | Active User/Employee; transaction rechecks identity/capability | Central resolver first; Leave still permits only request owner and valid state/date | No Admin branch for owner request | employeeId = actor.employeeId | OWN; PENDING may cancel directly, APPROVED before start becomes cancellation requested | Leave flag | app/api/leave/cancel/route.ts, Leave authorization adapter, cancellation application | `leaveCapabilities.canCancelOwnRequests` plus existing available-action/state rule | Owner/status/date domain errors 403/404/409 | __tests__/api/leave-cancel.test.ts, Leave cancellation integration tests | Preserve owner and state transition invariants |
| Leave | API | PUT /api/leave/cancel | Cancellation decision | Active workforce plus schema/rate guards and `leave.cancellation.decide` / DASHBOARD | Transaction rechecks active actor/capability | Central resolver is prerequisite; assigned effective approver may confirm/reject; Leave-specific Admin override remains only when effective approver is unavailable and reason is supplied; owner forbidden | ADMIN only for unavailable-approver override; not represented as generic ALL | Effective approver; owner excluded; pre-start required for confirmation | ASSIGNED_APPROVER normally; Leave-specific ADMIN recovery override when unavailable | Leave flag | app/api/leave/cancel/route.ts, Leave authorization adapter, getCancellationDecisionRequest, confirmLeaveCancellation, rejectLeaveCancellation | Dashboard controls use `leaveCapabilities.canDecideAssignedCancellations` plus existing resource/state eligibility | 403 relation; 409 status/date; override reason missing 400 | __tests__/api/leave-cancel.test.ts, modules/leave/application/approvals/exception-approver.test.ts | Dashboard/API override differs from LIFF; `leave.cancellation.decide` is not a LIFF capability |
| Leave | API | POST /api/leave/not-taken | Request not-taken confirmation workflow | Active workforce plus feature/body/rate guards and `leave.request.not_taken` / DASHBOARD | Active actor Employee; transaction rechecks identity/capability; approved and after end date | Central resolver is prerequisite; `OWN` authorizes the owner request and `ASSIGNED` authorizes approver confirmation; Admin recovery remains Leave-specific when effective approver is unavailable with reason | ADMIN only for Dashboard recovery; explicit scopes do not bypass relationship | Owner, effective approver, fallback approver, unavailable approver state | OWN for request; ASSIGNED_APPROVER or recovery Admin for confirmation | Leave flag | app/api/leave/not-taken/route.ts, Leave authorization adapter, modules/leave/application/not-taken.ts, exception approver resolver | Own request uses `canRequestOwnNotTaken`; assigned confirmation uses `canConfirmAssignedNotTaken`; recovery remains Admin-specific | 403/404/409; override reason 400 | __tests__/api/leave-not-taken.test.ts, modules/leave/application/approvals/exception-approver.test.ts | Preserve quota/status/audit and fallback approver rules; LIFF recovery override remains disabled |
| Leave | API | GET /api/leave/admin/recovery | Recovery candidate list | requireActiveWorkforceSession() then explicit Admin check | Active User/Employee | Admin only; returns requests whose effective approver is unavailable and excludes work assigned to current Admin | ADMIN | Unavailable original/effective approver; owner/current assignment excluded | Recovery subset, not normal approval workload | Leave flag | app/api/leave/admin/recovery/route.ts, getAdminLeaveRecoveryData, getAdminLeaveRecoveryCandidateWhere | Admin Recovery tab remains shown by the existing Admin-only presentation rule; not a generic capability | Non-admin 403; feature 404; invalid page 400 | __tests__/api/leave-admin-recovery.test.ts, modules/leave/application/approvals/approval-queries.test.ts | Recovery scope is intentionally narrower than Admin-all |
| Leave | API | GET/PUT /api/leave/approvers | Leave manager/approver assignment | `requireActiveWorkforceOrAdminSession()` then `leave.approver.manage` / DASHBOARD; GET retains 403 behavior for unauthenticated access | Active User account; Employee optional only for the established Dashboard ADMIN account-only path, active Employee required for an explicit normal USER grant | Central resolver first; this capability has no USER default, ADMIN uses central `SYSTEM_ROLE`, and valid explicit USER `ALL` grants are supported; assignment service validates active target/user, usable email, no self-assignment, pending-request lock | ADMIN only through central `SYSTEM_ROLE`; explicit USER `ALL` grant is supported without role promotion | Employee hierarchy/manager relation and pending Leave dependencies | `ALL` capability prerequisite plus selected-assignment domain rules; not a generic team grant | Leave flag | app/api/leave/approvers/route.ts, Leave authorization adapter, assignLeaveApprovers | Approver settings tab uses `leaveCapabilities.canManageApprovers` | 403; validation/domain 400/409 | __tests__/api/leave-approvers.test.ts, modules/leave/application/approvals/approver-assignment.test.ts, modules/leave/application/authorization.test.ts | Manager assignment is a Leave-owned relationship/business rule; established account-only Dashboard Admin lifecycle is intentionally preserved |
| Leave | API | GET /api/leave/export | Leave report XLSX/meta/years | requireActiveWorkforceSession() | Active User/Employee | No explicit role or canViewLeaveReports check; scope is selected by route and query | None | current-team: direct active Employees with managerId = currentEmployeeId; approver-history: original approverId = currentEmployeeId | Current team or original approver history; exception approver is not counted by history scope | Leave flag | app/api/leave/export/route.ts, modules/leave/infrastructure/reports/report-export.ts | canViewLeaveReports hides report tab only | Auth 401/403; invalid scope/year/format/limit 400; errors 500 | __tests__/api/leave-export.test.ts, modules/leave/infrastructure/reports/report-export.test.ts | Projection and endpoint authority differ; report scope needs Phase 1 policy decision |
| Leave | API | GET /api/leave/attachments/:attachmentId | Leave evidence attachment | Workforce-or-admin helper plus ID validation | Current API legacy eligibility; active workforce/admin helper | Admin bypasses resource relationship; USER must be owner, original approver or exception approver according to dashboard query | ADMIN relationship bypass | Leave owner/original/effective approver | PARTICIPANT or Admin ALL | Leave flag | app/api/leave/attachments/[attachmentId]/route.ts, getAuthorizedLeaveAttachmentForViewer | Attachment button/viewer | Unauthorized relation/missing storage 404; invalid content/storage 500 | __tests__/api/leave-attachment.test.ts, __tests__/integration/leave-attachment-access.integration.test.ts | Admin bypasses relationship, not active-account/API preconditions |
| Leave | LIFF_SELF_SERVICE | LIFF my leave/request/cancel/not-taken | Current Employee LeaveRequest | requireLiffWorkforceSession() and registered Leave capability resolution where registered | Active linked LINE workforce | `leave.request.read/create/cancel` use `OWN`; `leave.request.not_taken` keeps owner request vs assigned confirmation distinct; the existing LIFF effective-approver cancellation decision remains Leave-domain-authorized because Dashboard-only `leave.cancellation.decide` is not registered for LIFF | Admin does not receive Dashboard recovery override in LIFF | Current Employee owner/effective approver | OWN or ASSIGNED_APPROVER; no Dashboard Admin recovery override | Leave LIFF flag; disabled 404 | app/api/line/leave/me, request, cancel, not-taken, Leave authorization adapter | `leaveCapabilities` gates reads/actions; legacy `canRequestLeave` is a derived read+create alias; server `availableActions` remains the relationship/state hint | LIFF 401/403/500; relation/status 403/404/409 | __tests__/api/line-leave-routes.test.ts, __tests__/api/leave-me.test.ts, __tests__/api/leave-request.test.ts, __tests__/api/leave-cancel.test.ts, __tests__/api/leave-not-taken.test.ts | Explicit channel restriction: LIFF cancellation decision is intentionally not centrally migrated; LIFF cannot use Admin recovery override |
| Leave | LIFF_SELF_SERVICE | LIFF approvals and decision | Assigned LeaveRequest approval | LIFF workforce plus `leave.approval.read` / `leave.request.approve` resolution | Active linked LINE workforce | Approval list is effective-approver scoped; decision service still requires assigned approver and passes no Admin override | No broad Admin bypass | Effective approver; owner excluded | ASSIGNED_APPROVER actionable only; history excluded from LIFF response | Leave LIFF flag | app/api/line/leave/approvals/route.ts, app/api/line/leave/decision/route.ts, Leave authorization adapter, modules/leave/application/approvals/approval-queries.ts | `leaveCapabilities.canReadAssignedApprovals` plus actionable relationship gates the list; action fields independently gate approve/not-taken controls | 401/403/404/409 | __tests__/api/line-leave-routes.test.ts, modules/leave/application/approvals/approval-queries.test.ts | Preserve server relationship check regardless of capability boolean |
| Leave | LIFF_SELF_SERVICE | LIFF request detail/attachment | LeaveRequest/attachment participant view | LIFF workforce plus feature | Active linked LINE workforce | Owner or effective approver may view; unrelated caller receives not-found style response | Admin is not a blanket participant bypass in LIFF participant query | Owner/effective approver | PARTICIPANT only | Leave LIFF flag | app/api/line/leave/requests/[id]/route.ts, app/api/line/leave/attachments/[id]/route.ts, participant-access.ts | Serialized viewer role REQUESTER/APPROVER; internal IDs stripped | Unrelated 404; auth 401/403; storage 404/500 | __tests__/api/line-leave-routes.test.ts, __tests__/api/leave-attachment.test.ts | Preserve participant privacy and server-side serialization |

### 4.6 Audit, export, email request, settings and notifications

| Module / Domain | Channel | Entry Point / Operation | Resource | Authentication Requirement | Account / Workforce Lifecycle Requirement | Current Authorization Rule | System Role Dependency | Resource / Domain Relationship | Current Effective Scope Semantics | Feature Flag Dependency | Enforcement Location | Presentation Projection | Unauthorized Outcome | Relevant Tests | Migration Invariant / Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Audit | API/DASHBOARD | GET /api/audit-logs, Dashboard Audit page | AuditLog records | API uses `requireApiSession()` then `audit.read / ALL`; page uses `requireDashboardAuditCapability()` | API current eligible Employee; page current projection | Audit adapter resolves centrally; ADMIN authority comes from the resolver, explicit normal USER `audit.read / ALL` is accepted, and an ungranted USER remains denied | ADMIN through central resolver; explicit USER/Team/TeamRole grants are additive | No per-log resource scope at query layer | ALL audit logs with filters/pagination | None | app/api/audit-logs/route.ts, modules/audit/application/authorization.ts, modules/audit/application/queries.ts, app/dashboard/_lib/route-access.ts, app/dashboard/audit/page.tsx | `auditCapabilities.canReadAuditLogs` drives the Audit page/menu projection; it is not server authority | API unauthenticated/capability-forbidden outcomes remain 403; page redirects to login/access-denied through the capability guard | __tests__/api/audit-log-route.test.ts, modules/audit/application/authorization.test.ts, modules/audit/application/queries.test.ts, modules/audit/presentation/dashboard/AuditLogsSection.test.tsx | Audit direct route and presentation are capability-driven; cleanup and export-event remain separate boundaries |
| Audit export logging | API | POST /api/audit-logs/export | AuditLog data-export event | requireApiSession() with unauthenticated override to 403 | Legacy eligible active Employee | Any authenticated API user can submit entityType, recordCount, filters; route does not role-check or schema-validate body before scheduling audit | None | Audit actor is authenticated User; payload fields are caller-provided | No data read scope; writes a caller-attributed export event | None | app/api/audit-logs/export/route.ts, lib/server/audit.ts | Export UI may call it after data export | Unauthenticated 403; malformed/DB failure generally 500 | __tests__/api/authorization-current-state.test.ts | High-risk audit integrity/authorization boundary; actual data export routes have separate guards |
| Audit retention | SYSTEM | POST /api/audit-logs/cleanup | Expired AuditLog rows | x-cleanup-secret shared secret | System configuration only | Secret match; no User role | None | System-wide retention operation | ALL rows older than retention cutoff | None | app/api/audit-logs/cleanup/route.ts, audit retention application | None | Missing config 503; wrong secret 403; operation error 500 | __tests__/api/audit-log-cleanup-route.test.ts | System secret is separate from User authorization |
| Employee export | API | See Employee matrix | Employee CSV | requireApiSession() then `employee.export / ALL` | Legacy eligible active Employee | Employee adapter composes permanent `ALL` default with central configured authority; explicit valid grants are additive | ADMIN uses central SYSTEM_ROLE authority; no role-derived Employee default | No owner/team relation | ALL non-deleted non-bootstrap rows matching filters | None | Employee export route, Employee authorization adapter and infrastructure | UI export button may be role-shaped but API is authoritative | 401/400/403/500 as above | __tests__/api/authorization-current-state.test.ts, modules/employee/application/authorization.test.ts, modules/employee/infrastructure/export/employee-export.test.ts | Broad export is intentionally preserved; PII/HR visibility remains a separate policy decision |
| Routine export | API | See Routine matrix | RoutineTask XLSX | Workforce/admin helper | Current route helper | USER current implementation can export all operational task rows | No Admin gate in export route | No actor scope passed to exporter; all-scope query | ALL as currently implemented | Routine flag | Routine export route/infrastructure | UI export action | 401/400/500 | __tests__/api/routine-export.test.ts | Do not accidentally change during resolver migration |
| Stock export | API | See Stock matrix | Stock reports | `requireActiveWorkforceOrAdminSession()` then Stock authorization context | API current eligible Employee for USER; approved Dashboard ADMIN account-only lifecycle does not include report export | `stock.report.export / ALL` is checked by the Stock adapter and central resolver; explicit valid USER grants are reachable | ADMIN authority comes from central `SYSTEM_ROLE`; no Stock default | Organization-wide report | ALL after capability authorization | None | app/api/stock/reports/export/route.ts, modules/stock/application/authorization.ts | `stockCapabilities.canExportReports` drives report controls | Capability denial 403; validation/report errors remain route/domain outcomes | __tests__/api/stock-reports-export-route.test.ts, Stock authorization tests | Preserve report limits and domain rules; report remains Dashboard-only |
| Leave export | API | See Leave matrix | Leave reports | requireActiveWorkforceSession() | Active Employee | Any active workforce with corresponding manager/original-approver relationship; no role route guard | None | Manager/current-team or original approver history | Relationship-derived subset | Leave flag | Leave report route/infrastructure | canViewLeaveReports is only visibility hint | Auth/domain/validation errors | __tests__/api/leave-export.test.ts | Capability projection is not endpoint authorization |
| Email Request | API/DASHBOARD | POST /api/email-request; GET /api/email-request | Employee email/request administration | `requireApiSession()` | Legacy API eligibility plus Email Request capability decision | POST requires `email.request.create / ALL`; GET requires `email.request.read / OWN|ALL`, with requester ownership retained for OWN | No direct role gate; current resolver may supply temporary ADMIN compatibility authority | Requester ownership for `OWN` GET | `OWN` requester rows; `ALL` broad rows; create always uses authenticated requester | None | app/api/email-request/route.ts, lib/services/email-request/queries.ts, lib/services/email-request/authorization.ts | `emailRequestCapabilities` independently gates page/menu/form/history | Capability denial 403; GET/POST validation and persistence errors remain route outcomes | __tests__/api/email-request.test.ts, __tests__/services/email-request/queries.test.ts, __tests__/services/email-request/mutations.test.ts, Email Request presentation tests | Preserve ownership query, idempotency, audit and server capability enforcement |
| Settings | DASHBOARD/API | Routine settings tab and Leave approver settings | Configuration/assignment | Shared Dashboard plus route-specific APIs | Current projection/API session; approver mutation requires active workforce | No general settings API found; Routine settings UI is Admin-shaped; Leave approver settings resolves `leave.approver.manage / ALL` through central authority and supports explicit USER grants | ADMIN through central `SYSTEM_ROLE`; explicit USER grant can authorize server operation | Leave assignment domain relationship | Configuration-specific; Leave capability is not a generic team scope | Routine/Leave flags as applicable | modules/routine/presentation/dashboard/RoutineSection.tsx, app/api/leave/approvers/route.ts, Leave authorization adapter | Tabs/buttons hidden for USER | UI hidden is not enough; approver API remains authoritative | Routine/Leave presentation and route tests | Do not create settings.manage semantics from UI alone |
| Notifications | API/DASHBOARD | GET `/api/notifications`, GET `/api/notifications/all`, PATCH `/api/notifications/[id]/read`, POST `/api/notifications/mark-all-read` and Notification page | In-app Notification | `requireApiSession()` then `notification.inbox.read / OWN` or `notification.inbox.update / OWN` | Legacy eligible active Employee | Notification adapter composes permanent Default Domain Policy `OWN` with central configured authority; read/update remain independent | ADMIN uses central SYSTEM_ROLE semantics within the registered OWN scope; Team/TeamRole/direct User grants do not change actor ownership | Owner is trusted actor `userId`; repository query/update predicates retain `userId` | OWN/current actor User only | None | app/api/notifications/**, modules/notification/application/authorization.ts, modules/notification/application/**, repository queries | Notification page/Navbar use `notificationCapabilities.canReadInbox`; read/update controls use independent `canUpdateInbox`; Phase 12C.1 projection uses the same composition path | Unauthenticated 401; invalid session 400; capability denial 403; persistence 500 | __tests__/api/notifications.test.ts, modules/notification/application/authorization.test.ts, modules/notification/application/queries.test.ts, modules/notification/application/commands.test.ts, modules/notification/infrastructure/persistence/repository.test.ts | Client user IDs are ignored; registry remains OWN-only; query/update ownership remains before data leaves persistence |

### 4.7 LIFF home, public/system and adjacent boundaries

| Module / Domain | Channel | Entry Point / Operation | Resource | Authentication Requirement | Account / Workforce Lifecycle Requirement | Current Authorization Rule | System Role Dependency | Resource / Domain Relationship | Current Effective Scope Semantics | Feature Flag Dependency | Enforcement Location | Presentation Projection | Unauthorized Outcome | Relevant Tests | Migration Invariant / Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| LIFF home | LIFF_SELF_SERVICE | GET /api/line/home | Module availability and capability projection | requireLiffWorkforceSession() | Active linked LINE workforce | Returns module flags and granular Stock/Routine/Leave capability projections; does not itself grant operations | Stock ADMIN remains processor-capable through central authority; aliases are derived from stockCapabilities | Leave approvals query is effective-approver/actionable work | Capability projection only | Leave/Routine flags; Stock module uses usable Stock surfaces | app/api/line/home/route.ts, modules/line/application/liff.ts, home.ts | Liff home cards/tabs consume server-produced module state and stockCapabilities | 401/403/500; disabled modules returned unavailable | __tests__/api/line-home-route.test.ts, __tests__/auth/liff-capabilities.test.ts, __tests__/components/LiffHome.test.tsx | Capability data is non-authoritative |
| Uploads | API | POST /api/uploads/image | Stock item/variant image upload | `requireActiveWorkforceOrAdminSession()` then `stock.inventory.manage` / DASHBOARD | Normal API session has current eligible Employee; approved Dashboard ADMIN account-only lifecycle branch remains capability-limited | Stock adapter and central resolver decide the capability; explicit valid USER grants are supported, while scope/File/storage validation remains route-owned | ADMIN authority comes from central `SYSTEM_ROLE`; no Stock default | Storage scope is the selected item/variant namespace; no resource ownership relation | Capability prerequisite plus validated upload namespace | None | app/api/uploads/image/route.ts, modules/stock/application/authorization.ts, local upload adapter | Admin inventory image controls use the projected Stock surface | Non-authorized 403; invalid file/scope 400 | __tests__/uploads/local.test.ts, Stock route tests | Preserve central inventory capability and storage validation; file write is a non-transactional side effect |
| Uploads | API/public GET | GET /api/uploads/[...path] | Public upload file | No User session; path is public by design | None | No role authorization; rejects private, traversal and unsafe segments | None | Public path safety only | Public files addressed by safe path | None | app/api/uploads/[...path]/route.ts | Public image rendering | Unsafe/missing 404 | __tests__/api/uploads-route.test.ts | Private Leave attachments use separate participant/Admin-authorized route |
| Notification worker | SYSTEM | POST /api/cron/notification-outbox | Outbox dispatch | x-outbox-secret shared secret | Secret/config only | Shared secret match | None | System-wide outbox | ALL queued outbox records | None | app/api/cron/notification-outbox/route.ts | None | Missing config 503; wrong secret 403; worker error 500 | __tests__/api/notification-outbox-cron.test.ts | System execution is not a User grant |
| Routine scheduler | SYSTEM | POST /api/cron/routine-scheduler | Routine occurrences/reminders | x-routine-secret shared secret | Secret/config only | Shared secret; feature-disabled returns successful empty result | None | System-wide scheduler | ALL eligible scheduled tasks | Routine flag | app/api/cron/routine-scheduler/route.ts, runRoutineScheduler | None | Missing config 503; wrong secret 403; errors 500 | __tests__/api/routine-scheduler-cron.test.ts | Feature flag changes system work, not user permission |
| Leave attachment cleanup | SYSTEM | POST /api/leave/attachments/cleanup | Orphaned attachment files | x-cleanup-secret shared secret | Secret/config only | Shared secret and dry-run validation | None | Orphan relation/storage cleanup | ALL orphan candidates | None | app/api/leave/attachments/cleanup/route.ts | None | Missing config 503; wrong secret 403; invalid dry-run 400 | __tests__/api/leave-attachment-cleanup-route.test.ts | System retention boundary |
| LINE webhook | SYSTEM | POST /api/line/webhook | LINE platform event | HMAC signature/channel secret | LINE configuration only | Signature verification; no User role | None | Platform event identity, not current User session | System event scope | None | app/api/line/webhook/route.ts, signature verifier | None | Missing/invalid signature 401; missing config 500 | __tests__/api/line-webhook-route.test.ts | Authentication/integration boundary, out of authorization migration |

## 5. Historical Authorization Decision Inventory (pre-Phase 12H-I)

### 5.1 System-level role checks

- lib/ssot/permissions.ts:isAdminRole เป็น helper กลางที่เปรียบเทียบ role กับ ADMIN; USER_ROLES มี ADMIN และ USER
- lib/auth/api.ts:requireAdminSession เป็น generic route guard ระดับ role แต่ไม่แทนที่ domain relationship/business checks
- app/dashboard/_lib/route-access.ts: `requireDashboardEmailRequestAccess` เป็น capability-based redirect guard ของ Email Request; `requireDashboardAuditCapability` และ `requireDashboardEmployeeCapability` เป็น capability-based redirect guards ของ migrated Dashboard pages
- constants/dashboard.ts และ DashboardProvider ใช้ `requiredRole: ADMIN` เฉพาะ Authorization Administration control plane; Email Request, Leave recovery และ Routine business surfaces ใช้ capability projections
- modules/stock/application/authorization.ts แปลง trusted server identity เป็น `AuthorizationActor`, เรียก central resolver และ compose permanent Stock Default Domain Policy ผ่าน `composeAuthorizationAuthority()`; ไม่มี Stock compatibility fallback
- modules/stock/presentation/liff-stock-auth.ts:requireLiffStockProcessorSession ตรวจ LIFF workforce ก่อน แล้วจึงใช้ `stock.request.process`/`LIFF_SELF_SERVICE`; ไม่ใช้ role เป็น authority โดยตรง
- modules/routine/application/authorization.ts ใช้ `ROUTINE_CAPABILITIES`, central resolver, additive default composition และ Routine channel policy; Dashboard broad presentation/mutation behavior มาจาก effective `ALL` scopes, ส่วน LIFF ยังคง self-service-constrained
- Leave registered server capabilities use the adapter at `modules/leave/application/authorization.ts`; permanent normal-USER defaults compose only with valid configured/system authority, while recovery candidate and Leave-owned relationship checks remain domain-specific
- Stock presentation Phase 6B ใช้ `stockCapabilities` จาก central resolver สำหรับ menu, route, tabs, queries และ migrated action controls; `isAdmin` ที่เหลือใน Stock UI ใช้ได้เฉพาะ descriptive role text และไม่ใช่ authority

### 5.2 Dashboard guards and projections

- Authentication/routing: proxy.ts
- Current workforce projection: app/_lib/auth/current-user.ts:getCurrentUserProjection
- Page access guards: app/dashboard/_lib/route-access.ts:requireDashboardAuditCapability, requireDashboardEmployeeCapability และ `requireDashboardEmailRequestAccess`; Authorization Administration ใช้ ADMIN-only guard; `/dashboard/employees` ใช้ `canAccessEmployeeDashboard()` จาก trusted projection
- Role/feature navigation: constants/dashboard.ts:getAvailableMenuGroups, components/dashboard/context/dashboard/DashboardProvider.tsx:handleMenuClick
- Leave presentation projections: modules/leave/application/approvals/approval-queries.ts:getCurrentEmployeeLeaveProjection, modules/leave/presentation/dashboard/LeaveManagementSection.tsx
- Employee UI action hints: modules/employee/presentation/dashboard/EmployeeTable.tsx, EmployeeManagementSection.tsx
- Stock presentation projection: modules/stock/application/authorization.ts:getStockPresentationCapabilities; Dashboard current-user contract, StockProvider and StockSection consume `stockCapabilities`
- Routine task/occurrence management and export behavior: modules/routine/presentation/dashboard/RoutineSection.tsx and the Routine task/occurrence presentation components

### 5.3 API guards

ใน inventory นี้ `API` หมายถึง transport surface ของ route เท่านั้น ไม่ใช่ค่าใน future `AuthorizationActor.channel`; ต้องดูว่า caller/security context เป็น Dashboard, LIFF หรือ SYSTEM ก่อนกำหนด execution channel

- Generic session: lib/auth/api.ts:requireApiSession
- Admin role: lib/auth/api.ts:requireAdminSession
- Active Employee: lib/auth/workforce.ts:requireActiveWorkforceSession
- Workforce-or-Admin route compatibility (Phase 12H-A business-authority migration debt): lib/auth/workforce.ts:requireActiveWorkforceOrAdminSession
- Transaction rechecks: lib/auth/workforce-transaction.ts:assertActiveWorkforceInTransaction, Routine active actor/admin assertions, Leave capability/active User-Employee rechecks in `modules/leave/application/authorization.ts` plus existing Leave relationship checks, Stock request transaction checks
- Stock server authorization: modules/stock/application/authorization.ts, Stock route adapters and transaction-boundary mutation checks
- Domain routes must still parse/validate input, enforce rate/body/idempotency controls and validate state; those checks are not collapsed into authorization

### 5.4 LIFF guards and capability projections

- LIFF session and linked identity: modules/line/application/liff.ts:requireLiffWorkforceSession
- Active linked workforce identity: findActiveLiffWorkforceIdentity
- Home projection: getLiffCapabilities
- Stock processor capability guard: requireLiffStockProcessorSession verifies LIFF workforce first, then resolves `stock.request.process`
- Routine channel mode: createLiffRoutineActor(..., { mode: LIFF_SELF_SERVICE })
- LIFF Routine reference/summary routes ส่ง `{ mode: "LIFF_SELF_SERVICE" }` ให้ `createRoutineCommandActor()` จาก trusted route boundary; `serializeLiffRoutineReference()` ยังคงส่งออกเฉพาะ units, categories, scheduleTypes และ businessDayPolicies โดยไม่ส่ง employees
- Leave capability: `getLiffCapabilities()` projects registered Leave capabilities through the canonical Leave adapter after the LIFF workforce check; `getLiffLeaveRelationshipProjection()` supplies the actionable assigned effective-approver relationship, not role, and the deprecated `getLiffLeaveCapabilities()` helper/type has been removed
- Leave/Routine LIFF routes independently enforce relationship/status after projection; Leave keeps Dashboard-only cancellation-decision and Admin-recovery boundaries, while migrated Stock LIFF routes resolve Stock capabilities after the LIFF workforce check and retain Stock-owned relationship/status rules

### 5.5 Routine domain authorization

- Routine capability adapter/channel policy: Dashboard ADMIN ใช้ central `SYSTEM_ROLE / ADMIN`; LIFF task/summary/reference behavior ถูกจำกัดด้วย registry channel และ self-service policy ตาม capability
- buildRoutineTaskEditScope: Admin all; USER creator or current Employee task assignee
- buildRoutineTaskDeleteScope: Admin all; USER creator only
- resolveRoutineTaskCapabilities: creator edit/delete, active task assignee edit-only, unrelated/inactive/deleted assignee no access
- buildRoutineTaskAccessWhere: management list/detail scope
- buildWorkOccurrenceWhere: occurrence-level assignee scope; normal USER is mine even when requested all
- buildTaskAssigneeWhere and buildTaskWhere: operational task path permits unscoped all when scope=all, without role predicate
- buildLiffRoutineTaskAccessWhere: creator, current task assignee or occurrence-only assignee; active checks for assignment paths
- getRoutineReferenceData plus serializeLiffRoutineReference: the LIFF reference route carries explicit `LIFF_SELF_SERVICE` mode, so ADMIN does not select Dashboard/Admin query semantics; the serializer continues to omit employees from the response
- Mutation transactions enforce active actor, active target Employees, version/reminder locks and creator-vs-assignee field restrictions

### 5.6 Stock domain authorization

- `modules/stock/application/authorization.ts` is the permanent Stock adapter over the central resolver. It builds the trusted `AuthorizationActor` and composes the resolver decision with the Stock Default Domain Policy through `composeAuthorizationAuthority()`; it has no Stock compatibility fallback.
- The seven registered capabilities are enforced on Stock server paths: `stock.catalog.read`, `stock.inventory.manage`, `stock.request.read`, `stock.request.create`, `stock.request.cancel`, `stock.request.process` and `stock.report.export`.
- Stock Default Domain Policy gives an eligible normal USER `stock.catalog.read / ALL`, `stock.request.read / OWN`, `stock.request.create / OWN`, and `stock.request.cancel / OWN`; inventory, process, and report defaults are empty. ADMIN receives no Stock default and must be authorized by central `SYSTEM_ROLE` semantics.
- `getRequests` consumes `{ userId, scopes }`; `scope=all` is honored only when effective scopes contain `ALL`, otherwise Stock applies `requestedBy = userId`. `requestedScope` is view intent, never authority, and LIFF requester lists explicitly request `mine`.
- `createRequest` and `executeIssueStockRequest` revalidate the actor/capability in the transaction before applying Stock invariants. Requester attribution remains actor-derived, and issue retains atomic pending claim, active item/variant and stock checks.
- `cancelRequest` uses effective `OWN`/`ALL` scopes and Stock-owned requester/status predicates. It derives notification mode inside the transaction after loading the request: ADMIN keeps processor semantics, own USER cancellation keeps requester semantics, and explicit USER `ALL` cancellation of another request uses processor semantics. Routes cannot choose the mode.
- Transaction lifecycle is operation-specific: `stock.request.create` and USER/LIFF actors require active Employee status; the Dashboard ADMIN account-only lifecycle exception for `stock.inventory.manage`, `stock.request.process` and `stock.request.cancel` revalidates the active account and may resolve with `employeeId = null`. It is a Stock lifecycle rule, not default authority, and does not include request creation. Stock mutation routes map `WorkforceAuthorizationError` to 403.
- `requireLiffStockProcessorSession` verifies the LIFF workforce first and then resolves `stock.request.process` in `LIFF_SELF_SERVICE`; a valid explicit USER grant can process, and central SYSTEM_ROLE authority keeps LIFF ADMIN processing available. Stock does not apply the Routine LIFF ADMIN clamp.
- LIFF request detail resolves read, process and cancel independently. Read `ALL` does not imply process, and an OWN-only unrelated detail keeps the not-found response boundary.
- Phase 6B Stock presentation uses immutable `StockPresentationCapabilities` from `getStockPresentationCapabilities()`. Dashboard uses `DASHBOARD`; LIFF home uses `LIFF_SELF_SERVICE`. The projection batches the seven registry decisions with `resolveMany()` and keeps read OWN/ALL, create, cancel OWN/ALL, process, inventory and export independent.
- Dashboard menu and `/dashboard/stock` require a usable projected surface. Stock tabs and query scope are capability-driven; `scope=all` is requested only with `canReadAllRequests`. Create, own/any cancel, process, inventory and report controls repeat the capability gate before initiating mutations.
- LIFF `/api/line/home` exposes `stockCapabilities`; `canRequestStock` and `canProcessStockRequests` are compatibility aliases derived from it. `LiffStockApp` waits for this contract before loading catalog, own-request or processing data, gates deep links/mutations, and refreshes the contract after ambiguous session recovery.
- LIFF Stock keeps processor support intentionally separate from requester defaults: an ADMIN remains processor-capable after a valid LIFF workforce check, while Dashboard-only inventory and report capabilities are structurally unavailable in `LIFF_SELF_SERVICE`. Read ALL never implies process or cancel ALL. Presentation remains non-authoritative; Stock routes and transaction-time checks remain required.

### 5.7 Leave domain authorization

- getAssignedLeaveApproverWhere: effective assignment is exception approver first, original approver otherwise; owner excluded
- getActionableLeaveApprovalWhere: PENDING, approved-not-taken pending confirmation and cancellation requested
- getLeaveDecisionAuthorization: OWNER, ASSIGNED_APPROVER, ADMIN_OVERRIDE or FORBIDDEN
- Phase 12C.5 Leave adapter resolves the eight registered capabilities through permanent defaults plus configured/system authority; it does not create generic participant, report or recovery scopes
- Normal decideLeaveRequest requires `leave.request.approve / ASSIGNED` and then explicitly requires ASSIGNED_APPROVER with isAdmin=false
- Cancellation decision requires `leave.cancellation.decide / ASSIGNED` on Dashboard; the unavailable-approver Admin override remains a Leave-specific recovery path, not generic ASSIGNED/ALL authority
- The existing LIFF cancellation decision remains Leave-domain-authorized while `leave.cancellation.decide` is Dashboard-only in the registry; this is a deferred authorization-contract/policy decision, not a `CHANNEL_NOT_SUPPORTED` bridge
- Not-taken uses `leave.request.not_taken / OWN` for owner request and `/ ASSIGNED` for confirmation; Dashboard Admin recovery remains Leave-specific and LIFF cannot use it
- getAdminLeaveRecoveryCandidateWhere: only unavailable effective approver candidates and excludes Admin's assigned workload
- `getLeavePresentationCapabilities`: immutable nine-field projection from one `authorization.resolveMany()` call over the eight registered Leave capabilities, using the Phase 12C.5 additive composition path
- `getCurrentEmployeeLeaveProjection` and `getLiffLeaveRelationshipProjection`: relationship/work projections derived from actionable/history queries; they are not capability booleans
- LIFF `canRequestLeave` and `canApproveLeave` remain legacy aliases derived from granular capabilities plus feature/relationship conditions
- Report scope is implemented independently in report-export.ts; current-team uses current manager relation, approver-history uses original approver relation
- State/date/quota/overlap/approver email/assignment/concurrency constraints remain Leave domain/business rules

### 5.8 Employee, Department, Audit, notifications, export and settings

- Employee server operations use `requireApiSession()` for the existing eligible API workforce boundary, then the Employee adapter resolves the corresponding registered capability through the central resolver; `NO_APPLICABLE_GRANT` preserves the legacy broad read/export or Admin-only mutation floor
- Employee update/delete re-read current User/Employee lifecycle and re-resolve capability inside their existing serializable transaction; offboarding still calls Leave dependency provider and Auth account-lifecycle port
- Employee list/stats/export remain organization-wide according to their existing query implementations; explicit USER ALLOW is honored without changing query scope. Phase 8B only gates Dashboard presentation and data loading with `employeeCapabilities`
- Department `GET /api/departments` uses the Department adapter and central `department.read / ALL` decision after `requireApiSession()`; the eligible USER baseline is supplied as permanent Default Domain Policy and the reference query/order/shape remain Department-owned
- Audit `GET /api/audit-logs` uses the Audit adapter and central `audit.read / ALL` decision after `requireApiSession()`; ADMIN resolution and explicit normal USER grants are accepted, while an ungranted USER remains denied. Audit cleanup and audit export-event routes remain separate boundaries
- Notification latest/history reads use `notification.inbox.read / OWN`, and read-state mutations use `notification.inbox.update / OWN`; the adapter composes the permanent OWN defaults while Notification queries/updates retain actor-derived `userId` predicates
- Stock report export server enforcement remains resolver-backed; Dashboard report presentation uses `stockCapabilities.canExportReports`, so a valid non-admin grant can expose the report. Leave report export is active-workforce plus relationship scope; Routine and Employee exports are broad authenticated paths
- Leave approver settings uses `leave.approver.manage / ALL` on Dashboard; the established Admin account-only lifecycle branch remains account-based and Employee-optional, while the real API-session chain normally requires an eligible Employee. An explicit normal USER grant can authorize it only subject to active workforce and Leave assignment invariants
- Email Request POST is Admin-only; GET has Admin all vs USER requester-owned query scope

### 5.9 Resource/query authorization

Query and persistence scopes found include:

- createdById / creator scope in Routine
- current active task assignee and current occurrence assignee in Routine
- requestedBy requester scope in Stock
- current Employee self scope in Leave profile
- effective approver and original approver scopes in Leave
- manager direct-report scope in Leave current-team report
- owner/effective approver participant scope in Leave detail and attachments
- actor-derived User-owned Notification scope in notification repository; latest/history reads and single/mark-all updates apply the predicate before rows leave persistence
- Department and Audit read are organization-wide `ALL` reference/log queries with no invented per-record ownership scope
- requestedBy scope in Email Request query
- organization-wide query with no actor scope in Employee list/stats/export, stock catalog/reports and current Routine all-scope work-item/export paths

### 5.10 Classification ledger

เพื่อไม่ให้คำว่า “guard” กลบความหมายของแต่ละชั้น ตารางนี้จัดประเภท decision point สำคัญที่พบจาก call chain:

| Decision point | Classification |
|---|---|
| proxy.ts hybrid token check | AUTHENTICATION และ routing; ไม่ใช่ AUTHORIZATION ของ domain |
| resolveAuthenticatedAccount และ getApiAuthSession | AUTHENTICATION + ACCOUNT_LIFECYCLE |
| requireApiSession | AUTHENTICATION + ACCOUNT_LIFECYCLE |
| requireAdminSession และ isAdminRole | AUTHENTICATION + ACCOUNT_LIFECYCLE + AUTHORIZATION |
| requireActiveWorkforceSession | AUTHENTICATION + ACCOUNT_LIFECYCLE |
| requireActiveWorkforceOrAdminSession | Legacy AUTHENTICATION/ACCOUNT_LIFECYCLE seam with an ADMIN branch classified by Phase 12H-A as BUSINESS_AUTHORITY_MIGRATE; callers must be role-neutralized |
| assertActiveWorkforceInTransaction และ active User/Employee re-reads | ACCOUNT_LIFECYCLE + BUSINESS_RULE + DATA_INTEGRITY/CONCURRENCY |
| requireDashboardEmailRequestAccess | AUTHENTICATION + ACCOUNT_LIFECYCLE + Email Request capability AUTHORIZATION; outcome เป็น redirect |
| requireDashboardAuditCapability และ requireDashboardEmployeeCapability | AUTHENTICATION + ACCOUNT_LIFECYCLE + capability AUTHORIZATION ของ Dashboard surface; outcome เป็น redirect |
| DashboardProvider, requiredRole, LeavePresentationCapabilities, EmployeePresentationCapabilities, canApproveLeave, canViewLeaveReports และ LiffCapabilities | PRESENTATION_ONLY; บางค่าคำนวณจาก AUTHORIZATION eligibility, RESOURCE_RELATIONSHIP หรือ FEATURE_FLAG แต่ไม่ใช่ authority |
| Routine capability adapter and channel policy | AUTHORIZATION + channel restriction; resource/query predicates remain domain-owned |
| LIFF Routine reference/summary route actors and Routine reference serializer | Route-derived LIFF channel is AUTHORIZATION/channel-context behavior; the no-employee-list response remains a client-visible response contract |
| Routine build*AccessScope/Where และ creator-assignee checks | RESOURCE_RELATIONSHIP + ACCOUNT_LIFECYCLE สำหรับ active relation; query scope ไม่ใช่ generic capability |
| Stock Admin processor/inventory route guards | AUTHENTICATION + ACCOUNT_LIFECYCLE + AUTHORIZATION |
| Stock requester/processor query and command ownership checks | RESOURCE_RELATIONSHIP + BUSINESS_RULE + DATA_INTEGRITY/CONCURRENCY |
| Leave effective-approver, owner, participant and manager queries | RESOURCE_RELATIONSHIP + ACCOUNT_LIFECYCLE ของ approver + BUSINESS_RULE |
| Leave Admin recovery/override checks | AUTHORIZATION + RESOURCE_RELATIONSHIP + BUSINESS_RULE; ต้องมี workflow state และเหตุผลตามกรณี |
| Employee Admin mutation and offboarding composition | AUTHORIZATION + ACCOUNT_LIFECYCLE + RESOURCE_RELATIONSHIP + BUSINESS_RULE + DATA_INTEGRITY/CONCURRENCY |
| Leave/Routine feature guards | FEATURE_FLAG; ไม่ใช่ AUTHORIZATION |
| Public upload path safety and private attachment access | RESOURCE_RELATIONSHIP หรือ path-safety ตาม endpoint; ไม่สรุปจาก public upload เป็น User grant |
| Cron/cleanup secret and LINE webhook HMAC | AUTHENTICATION ของ SYSTEM/platform principal; ไม่ใช่ User AUTHORIZATION |

## 6. Resource Scope Baseline

ตารางนี้บันทึก semantics ที่มีอยู่จริง ไม่ได้บังคับให้เป็น future generic scope:

| Current behavior | Current source/shape | Current resources | Non-binding Phase 1 candidate | Status / caution |
|---|---|---|---|---|
| Current User / Employee self | Auth-derived user.id, employeeId; client IDs are ignored or re-derived | Leave profile/create/cancel, Stock create/list, Notifications, Email Request USER GET | OWN | Candidate is clear for self-owned records; still define per capability |
| Created by actor | RoutineTask.createdById = actor.id | Routine task edit/delete/list/detail | CREATED for edit/delete/read where domain approves | Creator is not equivalent to assignee |
| Current task assignee | RoutineTask.assignees.some.employeeId with active employee relation | Routine task management/read/edit | ASSIGNED | Task-level and occurrence-level assignment differ |
| Current occurrence assignee | RoutineOccurrence.assignees.some.employeeId | Routine occurrence read/focus | ASSIGNED | Must remain a domain-owned translation, not generic capability alone |
| Requested by | StockRequest.requestedBy = userId | Stock request list/detail/cancel | OWN | Admin all is a separate role/domain branch |
| Effective approver | exceptionApproverId ?? approverId | Leave approval, cancellation, not-taken, participant detail | ASSIGNED candidate | Requires Leave-specific effective-approver and workflow translation; OPEN — requires Phase 1/domain review |
| Original approver history | LeaveRequest.approverId = employeeId | Leave approver-history report | OPEN | Not the same as effective approver after exception reassignment |
| Direct reports/current team | Employee managerId = currentEmployeeId, active/deleted filters | Leave current-team report | TEAM candidate only if domain defines it | Do not equate HR manager relation with Team membership or Team-derived authority |
| Participant | Leave owner/original/effective approver query branches | Leave detail and attachments | OPEN | Participant is a domain relation, not a universal scope |
| Organization-wide | Empty or broad Prisma where after Admin/query path | Audit read, Stock catalog/reports, Employee list/export, Routine all work items/export | ALL only where approved | Current broad USER surfaces require explicit policy decision |
| Recovery candidate | Effective approver unavailable plus exclusions | Leave Admin recovery | OPEN | Special recovery operation; do not collapse into ordinary ALL |
| System execution | Shared secret/HMAC | Cron, cleanup, webhook | Not a User scope | Separate system principal model is out of Phase 0 |
| LIFF Routine reference query | Route actor explicitly carries `LIFF_SELF_SERVICE`; serializer omits employees from the response | Internal employee reference query only; LIFF response reference metadata | Not a client-visible employee scope | Closed in Phase 9C for the channel-context omission; preserve the response boundary |

Current authority is not inferred from departmentId, Department name, Team name or magic TeamRole name. Team and TeamRole participation contributes authority only through persisted capability grants evaluated by the central resolver. No future Team/Capability mapping is binding in this document.

## 7. Authorization Compatibility Invariants

Later migration phases must preserve these behaviors until a policy change is explicitly approved and separately documented:

1. **API authentication and status distinction** — default missing/invalid API session is 401; authenticated non-Admin against requireAdminSession() is 403; route-specific response factories can intentionally map both to 403, notably Audit, Email Request and Department paths.
2. **Legacy API workforce eligibility** — current API session resolution requires an active, non-deleted account and an eligible active, non-deleted Employee before route-level authorization.
3. **Admin is not a universal bypass** — Admin still passes active account/workforce, input validation, resource/business relationship where the domain requires it, valid workflow state and transaction/concurrency rules.
4. **Routine channel behavior and LIFF reference response** — Dashboard-owned Routine capabilities resolve Dashboard ADMIN through central `SYSTEM_ROLE / ADMIN`; LIFF self-service ADMIN is clamped by Routine channel policy for task, summary, and reference behavior. The LIFF Routine reference response must not expose the employee reference list, including for an authenticated LIFF ADMIN; `serializeLiffRoutineReference()` enforces that boundary. Reference and summary routes derive `LIFF_SELF_SERVICE` explicitly at the trusted route boundary, with regression coverage for both USER and ADMIN.
5. **Routine creator/assignee behavior** — USER creator can edit/delete; active task assignee can edit allowed content but cannot delete, change assignees/source or change lifecycle; occurrence-only assignment is a separate read/focus relationship.
6. **Routine all-scope current behavior** — operational task work-item, Dashboard summary `scope=all`, and export paths intentionally retain broad normal-USER behavior through explicit permanent default policy; reference uses OWN baseline and configured ALL may expand only the established active-Employee query. Any later narrowing is an approved behavior change, not an incidental resolver refactor.
7. **Stock requester/processor separation** — Stock server decisions now resolve the registered capability and compose permanent requester defaults; normal requester reads/cancels own pending requests, effective `ALL` can broaden the relevant operation, LIFF processor queue/issue retains central ADMIN or explicit USER authority, and unrelated LIFF request detail is hidden with not-found behavior.
8. **Stock data integrity** — requester attribution is server-derived; issue/cancel/inventory mutations revalidate the actor and capability at their transactional application boundary where applicable, then use status claims, stock availability, active references and transaction rules; these remain separate from capability authorization.
9. **Leave effective approver** — exception approver takes precedence over original approver for current actionable approval and participant access; owner cannot approve or confirm their own workflow.
10. **Leave Admin override boundaries** — Dashboard/API cancellation and not-taken flows can use the Leave-specific Admin recovery override only when the trusted Dashboard capability context, effective-approver availability and reason requirements permit it; LIFF channel resolution cannot use that override.
11. **Leave normal approval** — decideLeaveRequest requires assigned effective approver and does not give Admin a broad approval bypass.
12. **Leave reporting semantics** — current-team report uses active direct reports by managerId; approver-history report uses original approverId, not exception approver assignment; report tab projections do not replace endpoint checks.
13. **Active/deleted identity handling** — inactive/deleted User, inactive/deleted Employee, invalid LIFF identity and stale LINE link continue to fail closed with their current 401/403 behavior.
14. **Feature-disabled behavior** — Leave/Routine API and LIFF routes return feature-specific not-found behavior; Dashboard/menu and LIFF home hide or mark modules unavailable. Feature flags are not role grants.
15. **Presentation is not authority** — hidden menu, requiredRole, canApproveLeave, canViewLeaveReports, LiffCapabilities and per-resource canEdit/canDelete must not be treated as server authorization without the corresponding route/domain enforcement.
16. **Employee lifecycle safeguards** — Employee mutation authorization does not bypass self-offboarding, last active Admin, subordinate and Leave dependency checks, linked account lifecycle, locks or transaction behavior; these remain enforced after capability authorization, including for explicit USER grants.
17. **Leave workflow safeguards** — approval assignment, quota, overlap, date, notification action version, cancellation/not-taken state transitions and concurrency rules remain domain-owned.
18. **Private attachment access** — Dashboard Admin relationship bypass and Leave participant access are distinct from public upload file reads; private files remain behind their authorized route.
19. **Self-scoped notifications and Email Request reads** — notification commands/queries always use authenticated User ID; non-admin Email Request query is requester-owned.
20. **System endpoint separation** — cron/cleanup/webhook operations remain secret/HMAC-protected system boundaries, not User role checks.
21. **Leave presentation projection** — the historical Phase 7B projection used compatibility translation; the current `LeavePresentationCapabilities` is server-derived through one batched resolver call and Phase 12C.5 permanent additive composition. Each capability remains separate from effective-approver/resource/workflow relationships, all presentation booleans remain non-authoritative, report visibility and Admin recovery remain deferred, and LIFF cancellation decisions remain Leave-domain-authorized because the registered capability is Dashboard-only.
22. **Leave complete-surface closure** — the historical Phase 7C boundary established the canonical adapter/resolver path for all registered operations; Phase 12C.5 now replaces the temporary Leave fallback with explicit permanent defaults plus additive configured authority. Dashboard availability and deep links use `canAccessLeaveDashboard()` plus tab normalization; transaction mutations revalidate current User/Employee lifecycle and capability; LIFF cancellation decision, reports/export, participant/detail, attachments and Admin recovery remain explicit deferred/domain-owned boundaries.
23. **Employee Phase 8A server closure** — the seven registered Employee capabilities use the Employee adapter and central resolver on the seven Employee server operations with `DASHBOARD` execution context; explicit ALLOW is authoritative for normal USER actors, only `NO_APPLICABLE_GRANT` invokes the recorded compatibility floor, and all existing Employee query, import, audit, lifecycle, lock and concurrency invariants remain unchanged.
24. **Employee Phase 8B presentation closure** — `EmployeePresentationCapabilities` is server-derived through one `authorization.resolveMany()` call over the seven registered capabilities and reuses the Phase 8A compatibility translation. Dashboard current-user projection uses the authenticated account, active Employee ID and `DASHBOARD` actor; list/stats loading, navigation, add/import/edit/export controls use independent fields, while delete is projected but unused because no existing delete UI was found. Presentation remains non-authoritative and broad list/stats/export policy is unchanged.
25. **Employee Phase 8C complete-surface closure** — `/dashboard/employees` now has the trusted server-side `getCurrentUserProjection()` boundary using the same `canAccessEmployeeDashboard()` predicate as menu availability and `handleMenuClick()`. Direct Add/Import routes retain independent capability guards; explicit normal USER grants remain reachable without role promotion; all seven Employee API/application production paths, transaction revalidation, route ordering, conditional loading/revalidation, role-derived presentation checks, export/read reachability and delete-surface evidence were audited. No bypass or existing delete/offboarding UI was found, and focused regression hardening passed. Employee authorization migration is closed for the current production surface; broad data policy and Department/Team decisions remain unchanged/deferred.
26. **Phase 9A Department server closure** — `GET /api/departments` resolves `department.read / ALL` through the Department adapter and central resolver after the unchanged `requireApiSession()` eligibility boundary. Explicit ALLOW is authoritative; only `NO_APPLICABLE_GRANT` maps to the legacy eligible-user compatibility floor. Department remains reference data and is never mapped to Team or used to infer authority.
27. **Phase 9A Audit server closure** — `GET /api/audit-logs` resolves `audit.read / ALL` through the Audit adapter and central resolver. ADMIN authority is central, explicit normal USER grants are accepted, and an ungranted USER remains denied. Query filters/pagination and Audit ownership remain unchanged; `/api/audit-logs/cleanup` and `/api/audit-logs/export` are separate system/instrumentation boundaries and are not `audit.read` routes.
28. **Phase 9A Notification server closure** — all four Notification inbox routes resolve their exact registered read or update capability with `DASHBOARD` and require `OWN`; only `NO_APPLICABLE_GRANT` uses the eligible-user compatibility floor. The authenticated session supplies the actor user ID, and Notification persistence continues to enforce `userId` in read/update predicates. Read and update capabilities remain independent, and no UI migration occurred.
29. **Phase 9A/9B/9C Email Request deferral** — `email.request.read`, `email.request.create` and `app/api/email-request/**` remain registered but deferred for the future IT module. Phase 9A/9B/9C do not activate, remove, rename or otherwise migrate them.

## 8. Characterization tests

### 8.1 Existing tests relied upon

| Area | Relevant existing tests | What they freeze |
|---|---|---|
| API auth/workforce | __tests__/api/hybrid-auth-routes.test.ts, __tests__/auth/workforce.test.ts, __tests__/auth/workforce-transaction.test.ts | API authentication, role response behavior, active/inactive workforce and transaction re-checks |
| LIFF session | __tests__/auth/liff.test.ts, __tests__/auth/liff-capabilities.test.ts, __tests__/api/line-home-route.test.ts | missing/invalid/expired/config/stale-link/lifecycle outcomes and capability projection |
| Dashboard | __tests__/lib/dashboard-routes.test.ts, __tests__/constants/dashboard-menu.test.ts, __tests__/context/DashboardProvider.test.tsx | route/menu projection and feature/role presentation behavior; not a substitute for server guards |
| Employee | __tests__/api/employees-routes.test.ts, modules/employee/application/mutations.test.ts, modules/employee/infrastructure/persistence/employee-queries.test.ts, modules/employee/infrastructure/export/employee-export.test.ts | Admin mutation/lifecycle, query filters, export shape and lifecycle rules |
| Routine role/relationship | modules/routine/domain/capabilities.test.ts, modules/routine/application/delete.test.ts, modules/routine/application/mutations.test.ts, modules/routine/application/queries.test.ts | Admin/creator/assignee/inactive/deleted behavior, scopes, source redaction and channel mode |
| Routine API/channel | __tests__/api/routines-tasks.test.ts, __tests__/api/routines-task-by-id.test.ts, __tests__/api/routines-occurrences.test.ts, __tests__/api/routines-occurrence-by-id.test.ts, __tests__/api/routine-summary.test.ts, __tests__/api/routine-export.test.ts, __tests__/api/line-routine-routes.test.ts, __tests__/api/line-routine-self-service-routes.test.ts | route authentication, current all/mine behavior, LIFF self-service, Admin distinction, export behavior and no-employee-list reference responses for USER and ADMIN LIFF sessions |
| Stock | modules/stock/application/authorization.test.ts, __tests__/api/stock-requests-routes.test.ts, __tests__/api/line-stock-routes.test.ts, __tests__/api/stock-items-route.test.ts, __tests__/api/stock-reports-export-route.test.ts, modules/stock/__tests__/queries.test.ts, modules/stock/__tests__/mutations.test.ts | additive default/composed resolver decisions, explicit grants, channel behavior, requester/processor scope, Dashboard ADMIN lifecycle, LIFF queue, 404 hiding, stock/concurrency invariants |
| Leave | __tests__/api/leave-request.test.ts, leave-me.test.ts, leave-approvals.test.ts, leave-decision.test.ts, leave-cancel.test.ts, leave-not-taken.test.ts, leave-export.test.ts, leave-approvers.test.ts, leave-admin-recovery.test.ts, leave-attachment.test.ts, __tests__/api/line-leave-routes.test.ts | owner/approver/manager/participant/recovery/report/channel behavior and status outcomes |
| Leave domain | modules/leave/application/approvals/approval-queries.test.ts, exception-approver.test.ts, approver-assignment.test.ts, offboarding-responsibilities.test.ts, modules/leave/domain/approver-eligibility.test.ts, modules/leave/domain/action-availability.test.ts, Leave request/cancellation integration tests | effective approver, unavailable fallback, actionable states, assignments, lifecycle and workflow invariants |
| Audit/email/notifications | __tests__/api/audit-log-route.test.ts, audit-log-cleanup-route.test.ts, __tests__/api/email-request.test.ts, __tests__/services/email-request/queries.test.ts, __tests__/api/notifications.test.ts, modules/audit/application/authorization.test.ts, modules/department/application/authorization.test.ts, modules/notification/application/authorization.test.ts, modules/notification/application/queries.test.ts, commands.test.ts, repository.test.ts | Phase 9A central Audit read, Department reference read, self-scoped Notification inbox, separate system cleanup, and deferred Email Request ownership behavior |

### 8.2 Tests added in Phase 0

เพิ่ม characterization test ใหม่ 1 ไฟล์:

- __tests__/api/authorization-current-state.test.ts
  - ยืนยันว่าปัจจุบัน USER ที่ผ่าน requireApiSession() เรียก Employee export route สำเร็จและ route ส่งต่อไป createEmployeeExport
  - ยืนยันว่าปัจจุบัน USER ที่ผ่าน requireApiSession() เรียก audit export logging endpoint สำเร็จและ endpoint บันทึก event ด้วย actor จาก session

การทดสอบทั้งสองกรณีตั้งใจ freeze current behavior ที่มีความเสี่ยง ไม่ได้แปลว่า policy นี้เป็น target policy และไม่ได้แก้ production code

### 8.3 Phase 7B Leave presentation tests

เพิ่ม focused regression tests สำหรับ presentation projection และการประกอบ
Dashboard/LIFF:

- `modules/leave/application/presentation-capabilities.test.ts`
  - ยืนยันว่า Leave capability inventory ทั้งแปดรายการ resolve ด้วย `resolveMany()` เพียงครั้งเดียว
  - ยืนยัน permanent USER defaults, central ADMIN authority, field independence, LIFF `CHANNEL_NOT_SUPPORTED` cancellation decision และ error propagation
- `__tests__/auth/current-user-projection.test.ts`, `__tests__/auth/liff-capabilities.test.ts`, `__tests__/api/line-home-route.test.ts`, `__tests__/lib/liff-home.test.ts`
  - ยืนยัน trusted Dashboard/LIFF actor projection, `leaveCapabilities`, legacy aliases และ capability-aware Leave module contract
- `modules/leave/presentation/dashboard/**` tests
  - ยืนยัน capability + relationship tab visibility, granular employee/approver controls, explicit USER approver settings, deferred Admin recovery/reports และ stale dialog/form guards
- `modules/leave/presentation/liff/**` tests
  - ยืนยัน home-first loading, read/create/operation action filtering, actionable relationship requirement, participant deep-link preservation, cancellation decision exception และ session-recovery refresh behavior

These tests verify presentation behavior only; existing Leave route/application
authorization tests remain the authority for server enforcement.

### 8.4 Phase 7C Leave closure and regression-hardening tests

เพิ่มหรือ consolidate focused tests สำหรับ closure โดยไม่เปลี่ยน policy:

- `modules/leave/application/presentation-capabilities.test.ts`
  - ยืนยันว่าแต่ละ registered capability แสดงผลเฉพาะ granular field ของตัวเอง
    รวมทั้ง `not_taken / OWN` และ `not_taken / ASSIGNED` ที่เป็นอิสระกัน
- `__tests__/constants/dashboard-menu.test.ts`,
  `__tests__/context/DashboardProvider.test.tsx` และ
  `__tests__/dashboard-leave-page.test.tsx`
  - ยืนยัน Leave availability แบบ own-read, assigned-read + relationship,
    reports, Admin recovery, explicit USER approver management, feature flag,
    menu/direct-route denial และ inaccessible-tab normalization
- Leave application/route/domain suites ที่มีอยู่
  - ยืนยัน trusted identity, direct-input spoof resistance, effective approver
    exception precedence, owner exclusion, lifecycle/transaction revalidation,
    LIFF channel isolation, participant/detail/attachment/report/recovery
    deferred policy และ session-recovery no-retry behavior

Focused invocation ที่รันจริง (32 files, 308 tests ผ่าน):

```text
modules/leave/application/authorization.test.ts
modules/leave/application/presentation-capabilities.test.ts
modules/leave/application/approvals/approval-queries.test.ts
modules/leave/application/approvals/exception-approver.test.ts
modules/leave/application/approvals/approver-assignment.test.ts
modules/leave/application/approvals/offboarding-responsibilities.test.ts
modules/leave/application/queries/active-employee-session.test.ts
modules/leave/server/request-api.test.ts
modules/leave/presentation/dashboard/LeaveManagementSection.test.tsx
modules/leave/presentation/dashboard/ManagerApprovalDashboard.test.tsx
modules/leave/presentation/dashboard/hooks/useManagerApprovalModel.test.ts
modules/leave/presentation/dashboard/hooks/useEmployeeLeaveDashboardModel.test.ts
modules/leave/presentation/liff/LiffLeaveApp.test.tsx
modules/leave/presentation/liff/LiffLeaveComponents.test.tsx
__tests__/auth/current-user-projection.test.ts
__tests__/auth/liff-capabilities.test.ts
__tests__/api/line-home-route.test.ts
__tests__/lib/liff-home.test.ts
__tests__/api/leave-request.test.ts
__tests__/api/leave-me.test.ts
__tests__/api/leave-approvals.test.ts
__tests__/api/leave-decision.test.ts
__tests__/api/leave-cancel.test.ts
__tests__/api/leave-not-taken.test.ts
__tests__/api/leave-approvers.test.ts
__tests__/api/leave-admin-recovery.test.ts
__tests__/api/leave-attachment.test.ts
__tests__/api/leave-export.test.ts
__tests__/api/line-leave-routes.test.ts
__tests__/constants/dashboard-menu.test.ts
__tests__/context/DashboardProvider.test.tsx
__tests__/dashboard-leave-page.test.tsx
```

คำสั่ง focused ที่ใช้จริงคือ:

```text
npm.cmd run test:run -- modules/leave/application/authorization.test.ts modules/leave/application/presentation-capabilities.test.ts modules/leave/application/approvals/approval-queries.test.ts modules/leave/application/approvals/exception-approver.test.ts modules/leave/application/approvals/approver-assignment.test.ts modules/leave/application/approvals/offboarding-responsibilities.test.ts modules/leave/application/queries/active-employee-session.test.ts modules/leave/server/request-api.test.ts modules/leave/presentation/dashboard/LeaveManagementSection.test.tsx modules/leave/presentation/dashboard/ManagerApprovalDashboard.test.tsx modules/leave/presentation/dashboard/hooks/useManagerApprovalModel.test.ts modules/leave/presentation/dashboard/hooks/useEmployeeLeaveDashboardModel.test.ts modules/leave/presentation/liff/LiffLeaveApp.test.tsx modules/leave/presentation/liff/LiffLeaveComponents.test.tsx __tests__/auth/current-user-projection.test.ts __tests__/auth/liff-capabilities.test.ts __tests__/api/line-home-route.test.ts __tests__/lib/liff-home.test.ts __tests__/api/leave-request.test.ts __tests__/api/leave-me.test.ts __tests__/api/leave-approvals.test.ts __tests__/api/leave-decision.test.ts __tests__/api/leave-cancel.test.ts __tests__/api/leave-not-taken.test.ts __tests__/api/leave-approvers.test.ts __tests__/api/leave-admin-recovery.test.ts __tests__/api/leave-attachment.test.ts __tests__/api/leave-export.test.ts __tests__/api/line-leave-routes.test.ts __tests__/constants/dashboard-menu.test.ts __tests__/context/DashboardProvider.test.tsx __tests__/dashboard-leave-page.test.tsx
```

ผล closure ต้องอ่านคู่กับ exact commands/results ใน Phase 7C section ของ
`authorization-leave-migration.md`; tests ที่เป็น presentation ไม่ถูกใช้แทน
server authorization tests.

### 8.5 Phase 8A Employee server migration tests

เพิ่ม focused regression tests สำหรับ Employee server authorization migration:

- `modules/employee/application/authorization.test.ts`
  - ยืนยัน registered inventory ทั้งเจ็ด, trusted `DASHBOARD` actor, broad
    USER read/stats/export compatibility, Admin mutation compatibility,
    explicit USER grants, exact `NO_APPLICABLE_GRANT` fallback และ fail-closed
    behavior ของ denial/configuration failures
  - ยืนยัน scope `ALL`, current User/Employee lifecycle re-read, row locks และ
    `authorization.resolveInTransaction()` ด้วย persisted role ปัจจุบัน
- `__tests__/api/employees-routes.test.ts`
  - ยืนยัน list/stats/read capability entry points, explicit USER mutation
    reachability, `EmployeeCapabilityDeniedError` ที่คืน 403 โดยไม่เรียก
    mutation/import service หรือ schedule audit, existing validation/id/auth-before-body
    ordering และ 1,000-row/partial import boundary
- `__tests__/api/authorization-current-state.test.ts`
  - ยืนยัน USER export ยังคงผ่าน adapter และบันทึก audit actor เดิม
- `modules/employee/application/mutations.test.ts` และ Employee integration
  concurrency fixtures
  - ยืนยัน lifecycle/business invariants, account/session synchronization,
    locking, rollback และ existing concurrent identity/session behavior ยังคง
    ใช้ authorized command actor

Focused invocation ที่รันจริงใน Phase 8A:

```text
npm.cmd run test:run -- modules/employee/application/authorization.test.ts modules/employee/application/mutations.test.ts __tests__/api/employees-routes.test.ts __tests__/api/authorization-current-state.test.ts
```

ผลที่ยืนยันแล้ว: 4 test files และ 100 tests ผ่าน; `npm.cmd run typecheck` ผ่าน

### 8.6 Phase 8B Employee presentation migration tests

เพิ่ม focused regression tests สำหรับ Employee presentation projection และ
Dashboard surfaces:

- `modules/employee/application/presentation-capabilities.test.ts`
  - ยืนยัน one-call `resolveMany()` ด้วย inventory ทั้งเจ็ด, exact
    `NO_APPLICABLE_GRANT` USER/ADMIN compatibility, explicit USER grant
    independence, expected denial, structural/error propagation และ frozen
    seven-field contract
- `__tests__/auth/current-user-projection.test.ts`
  - ยืนยัน current Employee ID, trusted Employee authorization builder,
    `DASHBOARD` actor และการคง Leave/Routine/Stock projection เดิม
- `__tests__/constants/dashboard-menu.test.ts`,
  `__tests__/context/DashboardProvider.test.tsx` และ
  `__tests__/dashboard-employee-pages.test.tsx`
  - ยืนยัน read-surface availability, independent create/import navigation,
    unrelated Admin role gates และ login/access-denied/render outcomes ของ
    direct Add/Import routes
- `modules/employee/presentation/dashboard/EmployeeManagementSection.test.tsx`,
  `EmployeeSearchControls.test.tsx`, `EmployeeTable.test.tsx` และ
  `context/EmployeeProvider.test.tsx`
  - ยืนยัน list/stats separation, granular create/import/update/export gates,
    desktop/mobile edit controls, conditional SWR keys, permitted refresh,
    denied export/update handlers และ stale edit closure

Focused invocation ที่รันจริงใน Phase 8B:

```text
npm.cmd run test:run -- __tests__/constants/dashboard-menu.test.ts __tests__/context/DashboardProvider.test.tsx __tests__/dashboard-employee-pages.test.tsx modules/employee/application/presentation-capabilities.test.ts modules/employee/presentation/dashboard/EmployeeManagementSection.test.tsx modules/employee/presentation/dashboard/EmployeeSearchControls.test.tsx modules/employee/presentation/dashboard/context/EmployeeProvider.test.tsx modules/employee/presentation/dashboard/EmployeeTable.test.tsx __tests__/auth/current-user-projection.test.ts
```

ผลที่ยืนยันแล้ว: 9 test files และ 71 tests ผ่าน; `npm.cmd run typecheck` ผ่าน
และยังคงใช้ server Employee route/application tests จาก Phase 8A เป็น
authority tests แยกจาก presentation tests

### 8.7 Phase 8C Employee complete-surface audit and regression hardening

Phase 8C เพิ่ม trusted RSC entry boundary ให้
`app/dashboard/employees/page.tsx`: ไม่มี current-user projection จะ redirect
ไป `/login`; projection ที่ไม่มีทั้ง `canReadEmployees` และ `canReadStats` จะ
redirect ไป `/access-denied`; list-only, stats-only และ normal USER default policy
ยัง render ได้. Predicate นี้เป็น `canAccessEmployeeDashboard()` เดียวกับ menu
และ `DashboardProvider.handleMenuClick()`. Direct Add/Import pages ยังคงใช้
capability เฉพาะของตนเอง ดังนั้น explicit normal USER create/import grant ใช้
เข้าหน้าได้โดยไม่ promote role และ mutation-only actor ไม่ได้สิทธิ์หน้า
ข้อมูล Employee โดยอัตโนมัติ.

Final production search ครอบคลุม role-derived checks, Employee capability
inventory, API routes, application commands, helper call sites และ hard-coded
Employee paths. พบว่า Employee API ทั้งเจ็ด operation ผ่าน adapter/resolver;
update/delete มี transaction revalidation; ไม่พบ production bypass หรือ
Employee presentation authority ที่อิง ADMIN. ใน snapshot ของ Phase 8C role
matches ที่เหลือเป็น Admin-only Audit/Email Request, Leave/generic Dashboard
behavior หรือ descriptive audit/display fields; หลัง Phase 9A Audit เปลี่ยนเป็น
capability-driven แล้ว และ Email Request ยังคงเป็น deferred Admin surface. ไม่พบ
production Employee delete/offboarding UI จึงคง `canDeleteEmployees` ไว้ใน
projection/tests และไม่สร้าง control ใหม่.

EmployeeProvider ไม่สร้าง SWR request เมื่อ list/stats capability ไม่มี และ
revalidate เฉพาะ resource ที่ projection อนุญาต. Global `mutate()` นอก provider
มีเฉพาะ Add/Import success handlers ซึ่ง revalidate stats เมื่อ
`canReadStats` เป็นจริงเท่านั้น. Export ยังคงเป็น capability อิสระ; ภายใต้
registry/default policy ปัจจุบัน state export=true/read=false ไปไม่ถึง เพราะ
eligible USER ที่ไม่มี read grant ได้ permanent `ALL` read default และ
ไม่มี DENY ที่จะลบ read ออก. จึงคง export control ใน list surface โดยไม่สร้าง
หน้าใหม่หรือผูก policy read/export เข้าด้วยกัน.

Focused Phase 8C invocation ที่รันจริง (รวม suites ของ Phase 8A/8B):

```text
npm.cmd run test:run -- modules/employee/application/authorization.test.ts modules/employee/application/presentation-capabilities.test.ts modules/employee/application/mutations.test.ts __tests__/api/employees-routes.test.ts __tests__/api/authorization-current-state.test.ts __tests__/auth/current-user-projection.test.ts __tests__/constants/dashboard-menu.test.ts __tests__/context/DashboardProvider.test.tsx __tests__/dashboard-employee-pages.test.tsx modules/employee/presentation/dashboard/EmployeeManagementSection.test.tsx modules/employee/presentation/dashboard/EmployeeSearchControls.test.tsx modules/employee/presentation/dashboard/EmployeeTable.test.tsx modules/employee/presentation/dashboard/context/EmployeeProvider.test.tsx
```

ผล: **13 test files และ 177 tests ผ่าน**; focused route test
`__tests__/dashboard-employee-pages.test.tsx` รันแยกได้ **1 test file และ
13 tests ผ่าน**. `npm.cmd run typecheck`, `npm.cmd run lint:strict` และ
`npm.cmd run architecture:check` ผ่านทั้งหมด.

### 8.8 Phase 9A remaining server authorization migration

Phase 9A ปิดการย้าย server authorization ของสาม bounded contexts ที่เหลือใน
ขอบเขตนี้:

- Department: `GET /api/departments` ผ่าน `department.read / ALL` และคง
  eligible-user compatibility สำหรับ `NO_APPLICABLE_GRANT`; Department query
  ยังคงคืน reference list ทั้งหมดตามลำดับและ representation เดิม
- Audit: `GET /api/audit-logs` ผ่าน `audit.read / ALL`; ADMIN ได้สิทธิ์จาก
  central resolver, explicit normal USER grant ใช้ได้ และ USER ที่ไม่มี grant
  ยังคงถูกปฏิเสธ
- Notification: latest/history ผ่าน `notification.inbox.read / OWN` และ
  single/mark-all read state update ผ่าน `notification.inbox.update / OWN`;
  compatibility ใช้เฉพาะ `NO_APPLICABLE_GRANT` และ ownership predicate ยังคง
  ใช้ actor-derived `userId` ใน Notification query/update layer

ทุก route ใช้ trusted `DASHBOARD` actor หลัง `requireApiSession()` จึงยังคง
active account/eligible workforce prerequisite และ route-specific HTTP behavior.
ไม่มีการเปลี่ยน query filters, pagination, cursor, response shape, persistence,
business workflow หรือ presentation. Audit cleanup ใช้ shared secret และ Audit
export-event ใช้ authenticated instrumentation boundary จึงไม่ถูกแปลงเป็น
`audit.read`. Email Request capabilities และ routes ยังคง registered-but-deferred
สำหรับ future IT module.

Focused Phase 9A invocation ที่รันจริง:

```text
npm.cmd run test:run -- modules/authorization/application/resolver.test.ts modules/department/application/authorization.test.ts modules/audit/application/authorization.test.ts modules/notification/application/authorization.test.ts __tests__/api/departments-route.test.ts __tests__/api/audit-log-route.test.ts __tests__/api/audit-log-cleanup-route.test.ts __tests__/api/notifications.test.ts modules/department/application/queries.test.ts modules/audit/application/queries.test.ts modules/notification/application/queries.test.ts modules/notification/application/commands.test.ts modules/notification/infrastructure/persistence/repository.test.ts
```

ผล: **13 test files และ 122 tests ผ่าน**. รายละเอียด implementation,
compatibility, excluded boundaries และ Email Request deferral อยู่ใน
[authorization-remaining-server-migration.md](authorization-remaining-server-migration.md);
รายละเอียด Phase 9B presentation closure อยู่ใน
[authorization-remaining-presentation-migration.md](authorization-remaining-presentation-migration.md)

## 9. Risks / Ambiguities / Carried-forward policy inputs

หัวข้อนี้เป็น risk register ที่สืบทอดจาก Phase 0/Phase 1 และเป็นหลักฐานของ current implementation, deferred domain decisions และ policy inputs. Phase 12A ได้ล็อก no-grant USER behavior เป็น Default Domain Policy ถาวรแล้ว; รายการนี้ไม่ใช่การเปิดทางให้ configured grant narrow baseline. Current phase status และการจัดประเภทล่าสุดอยู่ใน [authorization-phase-12a-additive-policy-contract.md](authorization-phase-12a-additive-policy-contract.md) และ historical closure อยู่ใน Phase 11D closure กับ [authorization-phase-11a-audit.md](authorization-phase-11a-audit.md)

### Resolved in Phase 9C

- **Routine LIFF channel context** — `app/api/line/routine/reference/route.ts` and
  `app/api/line/routine/summary/route.ts` now construct Routine actors with
  `{ mode: "LIFF_SELF_SERVICE" }`. The reference response still omits employees,
  and focused USER/ADMIN tests prove the route passes the LIFF mode to the
  Routine service. The actor mode is route-derived and cannot be supplied by
  request input.

### High risk (historical inventory before Phase 12D)

The Routine summary/reference/export entry below records the risk that existed
before Phase 12D. The current resolution is recorded in the Phase 12D section
above and in [authorization-phase-12d-routine-deferred-migration.md](authorization-phase-12d-routine-deferred-migration.md).

1. **Routine all-scope data exposure candidate** — GET /api/routines/summary?scope=all และ /api/routines/export ใช้ deferred legacy/domain path; GET /api/routines/occurrences?view=tasks&scope=all ผ่าน `routine.task.read` แบบ context-sensitive และ normal USER ที่ไม่มี grant ใช้ permanent Default Domain Policy `ALL`, ทำให้ `buildTaskAssigneeWhere` ไม่มี assignee filter. Tests ใน modules/routine/application/queries.test.ts และ __tests__/api/routine-summary.test.ts รวมทั้ง export route test ยืนยัน current behavior. สำหรับ routine.task.read path นี้ behavior เดิมถูกบันทึกเป็น Default Domain Policy ถาวรใน Phase 12A/12C.3; summary/reference/export ยังคงเป็น deferred Routine policy family และต้องมี policy phase แยกก่อนเปลี่ยน
2. **Employee organization-wide read/export Default Domain Policy** — Employee list, stats และ CSV export ผ่าน Employee adapter/central resolver และ permanent no-grant USER default เมื่อเป็น `NO_APPLICABLE_GRANT` ยังคง broad ตาม current behavior โดยไม่มี Admin/relationship scope; export มีชื่อ, ตำแหน่ง, สังกัด, แผนก, email/phone ตาม query. Phase 12A/12C.2 บันทึกและคง behavior นี้เป็น permanent default และไม่ได้ตัดสิน PII/HR redesign หรือทำ policy narrowing
### Medium risk / ambiguity

4. **Audit export endpoint is not a data-export authority** — POST /api/audit-logs/export เพียงบันทึก audit event แต่ authenticated USER ส่ง entityType, recordCount และ filters ได้โดยไม่มี body schema/role guard. Actual data export endpoints มี policy ต่างกัน; ต้องแยก “เริ่ม export” กับ “บันทึก export event” ใน future policy phase แยกต่างหาก
5. **requireActiveWorkforceOrAdminSession business-route migration seam** — helper branch อนุญาต Admin ที่ไม่มี Employee ขณะที่ USER ต้องผ่าน active-workforce check. `requireApiSession()` upstream อาจจำกัด reachability ในบาง HTTP chain แต่ไม่ทำให้ helper นี้ role-neutral; direct application/test callers และ race ระหว่าง lifecycle ยังเห็น semantic ต่างกัน. Stock, Routine, Leave และ upload callers ต้องย้ายไป trusted role-neutral workforce boundary ตาม AL-03 ก่อน retire/role-neutralize ADMIN branch. Phase 11C/11D บันทึกการคง helper ไว้เป็น historical compatibility seam; Phase 12H-A จัด seam นี้เป็น BUSINESS_AUTHORITY_MIGRATE ไม่ใช่ allowlisted lifecycle primitive
6. **Role checks กระจายหลายชั้น** — isAdminRole, literal ADMIN ใน Routine/Leave query, route guards, capability projection และ caller-supplied flags ยังพบในระบบ แต่ใน migrated paths ใช้เป็น lifecycle, channel policy, domain/workflow หรือ presentation identity ตาม classification; ไม่ใช่ independent authority แทน adapter/resolver. Routine Dashboard ADMIN ใช้ central `SYSTEM_ROLE` และ LIFF ADMIN ใช้ channel policy; Stock server authority ถูกย้ายไปที่ adapter/resolver แล้ว, Stock presentation Phase 6B และ Employee Dashboard presentation Phase 8B ใช้ granular projection โดย role checks ที่เหลือใน Employee Dashboard เป็นของ unrelated Admin-only surfaces หรือ descriptive behavior เท่านั้น
7. **Service commands บางตัวเชื่อ caller** — ประเด็น Stock issue/cancel ที่เคยพึ่ง route composition ถูกแก้ใน Phase 6A ด้วย authorized command actor และ transaction-boundary revalidation; โดเมนอื่นยังต้องประเมินตาม migration ของตนเอง
8. **Presentation projection ปะปนกับ authority ในชื่อ** — `LeavePresentationCapabilities`, canApproveLeave, canViewLeaveReports, LiffCapabilities, Routine canEdit/canDelete มีประโยชน์ต่อ UX แต่ไม่เป็น guarantee ว่า route จะผ่าน; capability eligibility ยังไม่ใช่ resource/work relationship
9. **Leave report role semantics ยังไม่ชัด** — route ให้ active workforce ทุกคนเรียกได้ ถ้ามี manager/original-approver relationship; canViewLeaveReports เป็นเพียง projection. ต้องตัดสิน whether report is relationship capability or Admin/Team capability
10. **Leave original vs effective approver history** — operational approval ใช้ effective approver แต่ report history ใช้ original approver. ไม่ควร map ทั้งสองเป็น ASSIGNED โดยไม่คุยกับ Leave owner
11. **Leave manager terminology** — getLeaveApprovalList รับ managerId แต่ query ใช้ effective approver relation รวม exception approver; อย่าใช้ชื่อนี้เป็นหลักฐานว่า manager เป็น authorization role
12. **Dashboard page/API divergence** — Employee Phase 8C ปิด divergence ของ current production surface แล้ว: management page มี trusted RSC guard, Add/Import มี direct capability guards, และ menu/handleMenuClick ใช้ predicate เดียวกัน. Email Request ซึ่งยัง deferred ยังคง guard ที่ page ด้วย Admin role; Audit ใช้ capability guard ส่วน domain pages อาศัย APIs; direct URL และ direct API ยังต้องคงการตรวจของแต่ละ domain
13. **Feature flag behavior varies by channel** — Leave/Routine disabled คืน not-found ใน APIs/LIFF และ redirect/hide ใน Dashboard; defaults เปิดนอก production. ไม่ใช่ permission state
14. **Public upload vs private attachment** — public upload GET ไม่มี User auth ตาม design path; private Leave attachment route มี participant/Admin relationship. ต้องรักษา namespace boundary
15. **Audit query ownership** — getAuditEntityHistory เป็น generic reader ที่ feature query เรียกหลัง resource authorization; ไม่พบ generic per-caller guard จึงต้อง audit callers ต่อเมื่อเพิ่ม consumer
16. **Test coverage gaps** — Employee Phase 8C complete-surface audit และ focused regression hardening ปิดแล้วสำหรับ current production graph พร้อม 13 test files/177 tests, typecheck, strict lint และ architecture check. Phase 12A ล็อก broad read/export behavior เป็น default baseline และไม่มีการเปลี่ยน policy ดังกล่าว; future tests ต้องยืนยันว่า configured grant ไม่สามารถ narrow baseline ได้
17. **Department/Team boundary** — Department เป็น HR/reference structure ไม่ใช่ Team และไม่ใช่ authorization grouping. ระบบมี Team, TeamRole, TeamMembership และ persisted Team/TeamRole/direct User capability grants แล้ว แต่ authority จาก Team, TeamRole และ direct User grants ต้องผ่าน central authorization resolver เท่านั้น; ชื่อ Team หรือ TeamRole ไม่ได้ grant authority โดยตัวมันเอง และห้ามใช้ชื่อแผนก/หน่วยงาน/ทีมอนุมาน grant
18. **Manager projection versus manager authority** — getCurrentEmployeeProjection() ใช้การมี subordinate relation เพื่อคำนวณ isManager แต่ query นี้ไม่ได้ใช้ active/deleted filter แบบเดียวกับ Leave report query; จึงอาจทำให้ tab/capability projection กว้างกว่า actionable server result. API approval/report ยังใช้ query scope ของตนเอง

### Migration notes

- ก่อนสร้าง Capability Contract ต้องแยก operation ที่เป็น read all, export all, relationship read, mutation และ workflow decision ออกจากกัน
- ทุก capability ใน Phase 1 ต้องระบุ **authorization execution channel** ที่รองรับ (`DASHBOARD`, `LIFF_SELF_SERVICE`, `SYSTEM` ถ้าจำเป็น) และต้องชี้กลับมายัง domain relationship/business rule ที่ยังคงอยู่; ให้บันทึก `API` แยกเป็น entry-point / transport surface เท่านั้น ไม่ใช่ actor channel
- Broad current behavior ที่มี test freeze ไม่ควรถูกเปลี่ยนเพียงเพราะย้าย helper; หากต้องแก้ให้เป็น approved policy/security remediation แยกจาก migration
- สำหรับ LIFF Routine reference และ summary ให้ preserve route-derived `LIFF_SELF_SERVICE` actor mode และ response contract ที่ไม่เปิดเผย employee list; Phase 9C ปิด mode omission แล้ว. Routine all-scope, Employee broad read/export, Audit export-event และ Leave report/recovery policy ยังคงเป็น policy work ที่ต้องไม่ถูกเปลี่ยนนอก phase ของตนเอง; Employee broad read/export ถูกล็อกเป็น permanent default ใน Phase 12C.2
- มี regression tests สำหรับ Employee adapter และ broad export/read default policy แล้ว; ก่อนแก้ Routine all-scope, Employee export/read หรือ audit export semantics ต้องมี intended policy แยกต่างหาก
- Phase 6A ย้าย Stock server enforcement แล้ว และ Phase 6B ย้าย Dashboard/LIFF presentation ไปยัง `stockCapabilities`; Phase 12C.4 ย้าย Stock จาก historical compatibility floor มาเป็น permanent additive composition โดยคง behavior และ invariant เดิม. รายละเอียด historical อยู่ใน [authorization-stock-migration.md](authorization-stock-migration.md), ส่วน current policy อยู่ใน [authorization-phase-12c4-stock-additive-migration.md](authorization-phase-12c4-stock-additive-migration.md) และ [authorization-presentation-projection.md](authorization-presentation-projection.md)
- Phase 7A ย้าย Leave server enforcement แล้ว และ Phase 7B ย้าย Dashboard/LIFF presentation ไปยัง `leaveCapabilities` โดยใช้ `resolveMany()` batch เดียวและ compatibility translation ร่วมกับ server; เอกสารดังกล่าวเป็น historical boundary record. ปัจจุบัน Phase 12C.5 แทนที่ compatibility translation ด้วย permanent additive composition ส่วน report, recovery, participant/detail และ attachment policy ยังคงเป็น Leave-owned/deferred ตาม [authorization-leave-migration.md](authorization-leave-migration.md), [authorization-phase-12c5-leave-additive-migration.md](authorization-phase-12c5-leave-additive-migration.md) และ [authorization-presentation-projection.md](authorization-presentation-projection.md)
- Phase 8A ย้าย Employee server enforcement แล้ว, Phase 8B ย้าย Employee Dashboard presentation ไปยัง `employeeCapabilities` โดยใช้ `resolveMany()` batch เดียว และ Phase 8C ปิด complete-surface audit/regression hardening แล้ว; Phase 12C.2 ย้าย Employee adapter และ presentation ไปยัง permanent additive composition โดย broad list/stats/export policy ไม่เปลี่ยน, delete capability ยัง projected-but-unused ตาม [authorization-phase-12c2-employee-additive-migration.md](authorization-phase-12c2-employee-additive-migration.md) และ [authorization-presentation-projection.md](authorization-presentation-projection.md)

## 9.1 Phase 12B additive composition core

Phase 12B เพิ่มเฉพาะ reusable application-layer composition primitive
`composeAuthorizationAuthority(actor, capability, defaultScopes,
configuredDecision, registry?)`. Domain code supplies trusted default scopes;
the central resolver supplies the configured/system-role decision. The result
keeps normalized effective scopes, normalized default scopes, the exact
resolver decision, and configured grants as separate read-only values.

For a normal USER, only a valid `NO_APPLICABLE_GRANT` decision may fall through
to the default policy. A configured ALLOW is unioned with the default and cannot
narrow it. `UNKNOWN_CAPABILITY`, `CHANNEL_NOT_SUPPORTED`, an unqualified
denial, and configuration failures remain fail-closed. Default scopes are
validated against the code-owned registry, and originless default `TEAM` is a
configuration error. ADMIN uses the resolver's `SYSTEM_ROLE` decision without
applying USER default policy.

The composition result carries configured Team and TeamRole grant provenance
unchanged. Only a configured grant whose scope is `TEAM` carries its trusted
origin constraint; a non-TEAM Team or TeamRole grant does not gain one through
composition. Phase 12C.1 migrated Department + Notification, Phase 12C.2
migrated Employee, Phase 12C.3 migrated the enforced Routine surfaces, and
Phase 12C.4 migrated Stock to this seam. Leave remains on its documented
compatibility mechanics until Phase 12C.5.

## 9.2 Phase 12C.1 Department + Notification additive migration

Phase 12C.1 is closed for the first two production domains. Department and
Notification now call the unchanged central resolver and pass its decision,
plus their trusted permanent USER default, through
`composeAuthorizationAuthority()`. Department keeps `department.read / ALL`;
Notification keeps independent `notification.inbox.read / OWN` and
`notification.inbox.update / OWN`. `NO_APPLICABLE_GRANT` is no longer a
domain-local compatibility fallback in either adapter.

The administration catalog classifies exactly these three capabilities as
`CENTRAL_WITH_DEFAULT_POLICY` and `GRANTABLE`; all ordinary Team, TeamRole, and
direct User add/remove commands use the existing generic mutation path. The
remaining compatibility-backed capabilities are still
`CENTRAL_WITH_COMPATIBILITY` and `POLICY_ACTIVATION_REQUIRED`. The current
inventory is `3 / 19 / 13 / 5` by runtime mode and `16 / 19 / 5` by readiness.

Notification remains strictly actor-owned: the registry supports only `OWN`,
and latest/history reads, single updates, and mark-all updates retain the
trusted authenticated `userId` in their repository predicates. Department is
still reference data and is never converted into Team membership or authority.
At the Phase 12C.1 boundary, the Administration inspector was still a central
resolver/configured-authority view; the complete Default + Additional +
Effective operator view is now recorded in Phase 12E below. The exact closure
record and verification are in
[authorization-phase-12c1-department-notification-additive-migration.md](authorization-phase-12c1-department-notification-additive-migration.md).

## 9.3 Phase 12C.2 Employee additive default policy migration

Phase 12C.2 is closed for all seven registered Employee capabilities. The
Employee adapter now calls the central resolver and passes its decision plus
the one permanent default matrix through `composeAuthorizationAuthority()`.
Read, stats, and export provide `ALL` to an eligible normal USER with no
configured grant; create, update, delete, and import provide an empty default
and therefore remain denied without an explicit grant. An ADMIN is authorized
by the resolver's `SYSTEM_ROLE / ADMIN` decision, never by the Employee
default function.

The same composition function is used by route authorization, the batched
Employee presentation projection, and transaction-time update/delete
authorization. The latter still locks and re-reads the acting User and
Employee, revalidates active lifecycle state, calls `resolveInTransaction()`
inside the existing serializable transaction, and only then asserts `ALL`.
Employee mutation/business invariants, query filters, pagination, stats,
export, import, audit, and account/session lifecycle behavior are unchanged.
An explicit USER grant supplies capability authority but does not bypass those
invariants. Employee read/stats/export remain organization-wide by deliberate
policy; no OWN, TEAM, Department, manager, or PII redesign was introduced.

The catalog now reports `11 / 11 / 13 / 5` for
`CENTRAL_WITH_DEFAULT_POLICY / CENTRAL_WITH_COMPATIBILITY / CENTRAL_ONLY /
DEFERRED`, and `24 / 11 / 5` for
`GRANTABLE / POLICY_ACTIVATION_REQUIRED / DEFERRED`. All seven Employee
capabilities are administratively grantable through the existing generic Team,
TeamRole, and direct User commands. Stock is covered by Phase 12C.4 and Leave
remains compatibility-backed; the nine enforced Routine capabilities are
covered by Phase 12C.3. Deferred
Routine surfaces and Email Request/future IT remain outside this phase. At the
Phase 12C.2 boundary, the Administration inspector still showed
resolver/configured authority rather than the final composed Employee
effective result; Phase 12E now provides that bounded inspection. Evidence is
in
[authorization-phase-12c2-employee-additive-migration.md](authorization-phase-12c2-employee-additive-migration.md).

## 9.4 Historical Phase 12C.3 Routine additive default policy migration

At the historical Phase 12C.3 boundary, the nine enforced Routine capabilities
were closed. The Routine
adapter now composes the central resolver decision with a permanent,
context-sensitive normal-USER Default Domain Policy. The defaults are
management task read `CREATED + ASSIGNED`, work-item task read `ASSIGNED` for
`mine` and `ALL` for `all`, task create `OWN`, task update `CREATED + ASSIGNED`,
task delete `CREATED`, and occurrence read `ASSIGNED`. Occurrence override,
reassign, due-date change, and import management remain central-only with an
empty normal-USER default. Configured Team, TeamRole, and direct User grants
compose additively; a narrower grant cannot remove a default relationship.

Routine keeps its domain-owned resource policies. Dashboard ADMIN receives
central `SYSTEM_ROLE / ADMIN` authority and remains administrative. An ADMIN
using `LIFF_SELF_SERVICE` is instead constrained by the Routine self-service
channel policy after composition, so the actor is not administrative and task
detail remains limited to creator, active task-assignee, or active
occurrence-assignee relationships. A normal USER's configured `ALL` can expand
resource access but never sets `isAdministrative` or bypasses task
create/update normalization, source metadata redaction, lifecycle rules, or
other business invariants. The work-item `scope=all` no-grant behavior remains
the Phase 12A permanent default and is not narrowed here.

Mutation services still lock and re-read the current User/Employee and resolve
the current capability inside the existing serializable transaction. Revoking
a grant therefore restores a baseline-backed scope, while revoking a grant for
a central-only operation denies it. Occurrence assignment, target Employee
validation, version/reminder concurrency, idempotency, import batch/state,
outbox, audit, and cleanup invariants remain domain-owned.

`routine.task.export`, `routine.summary.read`, and `routine.reference.read`
remain `DEFERRED`; the exporter still uses `DEFERRED_EXPORT`, and deferred
summary/reference callers may still require `isRoutineAdminActor()`. The
Administration inspector is intentionally not a Phase 12E effective-policy
visualization: task-read effective access requires trusted management or
work-item context. The catalog is now `11 / 11 / 13 / 5` by runtime mode and
`24 / 11 / 5` by readiness. The next handoff is Phase 12C.4 — Stock Additive
Default Policy Migration. Full evidence is in
[authorization-phase-12c3-routine-additive-migration.md](authorization-phase-12c3-routine-additive-migration.md).

## 9.5 Phase 12C.4 Stock additive default policy migration

Phase 12C.4 is closed for all seven registered Stock capabilities. The Stock
adapter, presentation projection, Dashboard routes, LIFF routes, image upload,
request services, inventory mutation services and report route now use the
permanent `composeAuthorizationAuthority()` path. The old Stock
`NO_APPLICABLE_GRANT` compatibility fallback, migration-only result field and
migration-only capability names were removed from living Stock code. The
registry scopes and channels are unchanged.

The permanent normal-USER defaults are catalog `ALL`, request read `OWN`,
request create `OWN`, request cancel `OWN`, and empty defaults for inventory
management, request processing and report export. `requestedScope` remains
view intent and cannot add authority. Request list/detail ownership predicates,
server-owned request attribution, cancellation state/claim rules,
notification modes, idempotency, serializable processing, inventory locks,
conditional decrements, ledger/audit/outbox behavior and low-stock rules are
unchanged. Transaction-time User role/lifecycle revalidation remains the
authoritative boundary; the Dashboard ADMIN employee-optional path is limited
to inventory.manage, request.process and request.cancel. Stock LIFF processing
remains a real privileged capability surface, while LIFF inventory and report
access remain structurally unsupported.

The catalog is now `15 / 7 / 13 / 5` for
`CENTRAL_WITH_DEFAULT_POLICY / CENTRAL_WITH_COMPATIBILITY / CENTRAL_ONLY /
DEFERRED`, and `28 / 7 / 5` for
`GRANTABLE / POLICY_ACTIVATION_REQUIRED / DEFERRED`. The seven remaining
compatibility capabilities are exactly the Leave family. Routine export,
summary and reference remain deferred, as do Email Request and future IT.
The existing generic Team, TeamRole and direct User administration commands
now accept all seven Stock capabilities; no Stock-specific endpoint, seed,
backfill or database migration was added. At the Phase 12C.4 boundary, the
Administration inspector was still a resolver/configured-authority view;
Phase 12E now provides complete Stock Default + Additional + Effective
inspection.

Evidence and the complete test/invariant inventory are in
[authorization-phase-12c4-stock-additive-migration.md](authorization-phase-12c4-stock-additive-migration.md).
At that Phase 12C.4 boundary, the next handoff was Phase 12C.5 — Leave
Additive Default Policy Migration; the current handoff is recorded below.

## 9.6 Historical Phase 12C.5 Leave additive default policy migration

Phase 12C.5 is closed for all eight registered Leave capabilities. The Leave
adapter, presentation projection, Dashboard and LIFF registered Leave routes,
request/approval/cancellation/not-taken mutations, and approver-management
path now use the permanent `composeAuthorizationAuthority()` seam. The
temporary Leave `NO_APPLICABLE_GRANT` compatibility bridge, migration-only
capability names, and migration-only result marker were removed from living
Leave code. Resolver provenance, Leave defaults, and effective scopes remain
separate in the adapter result.

The permanent normal-USER defaults are request read/create/cancel `OWN`,
approval read and request approve `ASSIGNED`, Dashboard cancellation decision
`ASSIGNED`, not-taken `OWN + ASSIGNED`, and empty approver-management default.
ADMIN has no Leave default and receives authority only from central
`SYSTEM_ROLE`. Configured Team, TeamRole, and direct User grants are additive;
revoking an additional grant restores the relevant default rather than
denying the baseline. `leave.approver.manage` remains central-only but
grantable through the existing generic administration commands.

Leave continues to enforce actor-derived ownership, effective approver
relationship and exception-approver precedence, owner exclusion, pending and
current-action checks, workflow/state/date/quota rules, action-version and
atomic-claim behavior, participant/detail/attachment/report boundaries,
Dashboard-only Admin recovery, account-only Dashboard Admin approver lifecycle,
transaction-time identity/role/capability revalidation, row locks,
serializable/concurrency behavior, audit, outbox, and notifications. The
Dashboard-only `leave.cancellation.decide` registry contract is unchanged;
LIFF does not receive a fake capability or a channel bridge, and its existing
effective-approver cancellation path remains Leave-domain-authorized/deferred.

The catalog now reports `22 / 0 / 13 / 5` for
`CENTRAL_WITH_DEFAULT_POLICY / CENTRAL_WITH_COMPATIBILITY / CENTRAL_ONLY /
DEFERRED`, and `35 / 0 / 5` for
`GRANTABLE / POLICY_ACTIVATION_REQUIRED / DEFERRED`. The seven migrated Leave
capabilities are accepted by the existing generic Team, TeamRole, and direct
User grant commands; no Leave-specific endpoint, persistence, seed, backfill,
or database migration was added. The projection still uses one batched
`authorization.resolveMany()` call and remains a presentation prerequisite,
not a resource/action authorization boundary.

Evidence and the complete test/invariant inventory are in
[authorization-phase-12c5-leave-additive-migration.md](authorization-phase-12c5-leave-additive-migration.md).
The exact next handoff is Phase 12D — remaining explicitly deferred non-IT
authorization surfaces; Email Request/future IT remains outside that boundary.

## 9.7 Historical Phase 12D Routine deferred capability migration

Phase 12D is closed for the three remaining registered Routine capabilities at
its historical boundary. Its recorded defaults below are retained as evidence;
the Phase 12H-C closure in section 9.12 supersedes the selected broad defaults
for the current target:
`routine.task.export`, `routine.summary.read`, and `routine.reference.read`.
The source and tests confirmed that the export route previously used the
broad authenticated workforce/Admin boundary and a `DEFERRED_EXPORT` work-item
query, the Dashboard summary accepted validated `mine` and `all` views (with a
normal USER able to use the broad `all` view), and the reference query always
returned active units/categories while limiting normal-user employees to the
current linked active Employee and allowing Dashboard ADMIN to see eligible
active Employees. LIFF summary forced `mine`, and LIFF reference serialization
already omitted the Employee list.

The permanent Default Domain Policy is now:

- `routine.task.export`: eligible normal Dashboard USER `ALL`; Dashboard ADMIN
  has an empty default and relies on central `SYSTEM_ROLE / ADMIN`; LIFF is
  unsupported by the registry and fails closed.
- `routine.summary.read`: Dashboard `mine` is `ASSIGNED`, Dashboard `all` is
  `ALL` for an eligible normal USER, and LIFF is always self-service
  `ASSIGNED`. The requested view is validated and the channel is derived by
  the server before policy composition; a configured narrow grant cannot
  narrow Dashboard `all`, and LIFF ADMIN/configured `ALL` cannot broaden LIFF.
- `routine.reference.read`: normal Dashboard USER defaults to `OWN`, which
  retains current linked/current active Employee semantics; Dashboard ADMIN
  has an empty default and central `ALL`; a configured normal-user `ALL` may
  expand only the existing active-Employee query. Active shared
  units/categories remain available independently. LIFF is clamped to `OWN`
  and continues to omit the broad Employee list during serialization.

The export authorization now resolves `routine.task.export` in the Routine
application query before constructing the active all-scope task predicate.
The XLSX workbook remains infrastructure-owned. The old `DEFERRED_EXPORT`
option and bypass were removed; task-read, role identity, and per-task
`canReadTasks`/mutation projections are not used as export authority. The
feature guard, workforce lifecycle/authentication boundary, `xlsx` format
validation, 2,000-row maximum, active-task filter, batching/order, source
field omission, workbook serialization, response errors, and after-response
export audit logging remain unchanged.

Summary keeps its established active-task, relevant-occurrence, date-window,
and KPI calculations. Reference keeps active/deleted Employee filtering and
notification-readiness projection. All three operations use the permanent
`composeAuthorizationAuthority()` seam and preserve configured decision,
grant provenance, default scopes, effective scopes, and relevant LIFF policy
state. Configured Team, TeamRole, and direct User grants are accepted through
the existing generic Administration commands according to registry scopes;
they are additive and never narrow a baseline.

`RoutinePresentationCapabilities` now projects `canExportTasks`,
`canReadSummary`, and `canReadReference` from one bounded batch over all 11
Routine capabilities. Dashboard export visibility uses `canExportTasks`.
Dashboard/LIFF summary and reference loaders use their operation projections
only to avoid unsupported requests; scope and resource authorization remain
server-owned.

The exact closure record, pre-migration trace, verification record, and
remaining Leave-owned boundaries are in
[authorization-phase-12d-routine-deferred-migration.md](authorization-phase-12d-routine-deferred-migration.md).
Leave report/export, participant/detail, attachment, unavailable-approver
recovery, and the LIFF cancellation decision contract remain intentionally
domain-owned/unregistered. Email Request remains the only registered
deferred family. At the Phase 12D boundary, the next phase was **Phase 12E —
Authorization Administration effective-access UX completion**; its closure is
recorded in the section below and in
[authorization-phase-12e-effective-access-ux.md](authorization-phase-12e-effective-access-ux.md).

## 9.8 Phase 12E Authorization Administration effective-access UX completion

Phase 12E is closed from starting commit
`3b6b8ac635b6121ca712b3a88d71a5837e3a7962`. The User inspector now composes a
domain-owned Default Domain Policy with the central resolver's Additional /
configured authority and shows the resulting Effective capability authority.
The raw `resolverEffectivePermissionStatus` and
`resolverEffectivePermissions` fields remain central-resolver evidence and are
available under advanced disclosure; they were not renamed to mean final
access.

The generic Authorization Administration contract defines a narrow effective-
access provider port. Domain inspectors are bound by the outer API composition
layer and reuse each domain's runtime `composeAuthorizationAuthority()` and
channel policy. Authorization core and React do not contain a second default
scope matrix. Dashboard and `LIFF_SELF_SERVICE` rows are emitted only for
registered, trusted contexts. Routine task-read, summary, reference, and
export cases retain explicit context variants; Stock retains its intentional
LIFF processor semantics; Leave preserves Dashboard-only cancellation
decision. Email Request remains `DEFERRED`.

The UI distinguishes Default, Additional, and Effective authority, preserves
SYSTEM_ROLE/TEAM/TEAM_ROLE/USER provenance and TEAM constraints, identifies
redundant additive grants, exposes domain-owned limitations, preserves
lifecycle caveats, and refreshes the read model after direct User grant add or
remove. Invalid central configuration remains fail-closed and does not receive
manufactured Default access. This is a capability inspection, not a resource
simulator or final workflow decision.

The closure record, implementation boundary, context inventory, and verification
details are in
[authorization-phase-12e-effective-access-ux.md](authorization-phase-12e-effective-access-ux.md).
That section is the historical Phase 12E handoff record; Phase 12F supersedes
its next-phase statement.

## 9.9 Phase 12F full authorization regression / security matrix

Phase 12F is closed at audit baseline
`4646e259bcb2e5900aa1a679ccc78aaae6cbe186`.
The authoritative current regression matrix is
[authorization-phase-12f-security-regression-matrix.md](authorization-phase-12f-security-regression-matrix.md),
with its closure summary in
[authorization-phase-12f-closure.md](authorization-phase-12f-closure.md).

The current source-derived inventory is 40 registered capabilities:
`25 DEFAULT_POLICY_AUTHORIZATION`, `0 CENTRAL_WITH_COMPATIBILITY`,
`13 CENTRAL_ONLY_AUTHORIZATION`, and `2 DEFERRED_AUTHORIZATION_SURFACE`; the
readiness split is `38 GRANTABLE`, `0 POLICY_ACTIVATION_REQUIRED`, and
`2 DEFERRED`. The matrix contains 86 current operation-ledger rows, including
83 protected migrated route/capability rows with DIRECT route evidence and
three Stock presentation-only rows, plus 17 DIRECT Administration rows.
Cross-cutting arithmetic is `58 = 53 DIRECT + 2 INDIRECT + 0 MISSING + 3 N/A`.

This closure establishes code/runtime regression evidence only. It did not
query or mutate production authorization configuration, create Teams/Role or
grants, seed defaults, backfill data, or begin rollout. Phase 12G-A is the
presentation/interaction simplification recorded in
[authorization-phase-12ga-ux-simplification.md](authorization-phase-12ga-ux-simplification.md).

## 9.10 Phase 12G-A Authorization Administration UX Simplification

Phase 12G-A is **CLOSED** from the final closure-correction baseline
`14a300d03a8bd9803afcf0bce8258ae7bd08e4d4` (`fix(auth): harden user permission
management UX`). The primary Authorization Administration experience uses
administrator-facing Thai business vocabulary: กลุ่มผู้ใช้งาน, บทบาทในกลุ่ม,
สิทธิ์เฉพาะบุคคล, สิทธิ์พื้นฐาน, สิทธิ์ที่เพิ่มให้ and สิทธิ์ที่ใช้งานได้.
Permission selection is grouped by business domain, searchable using business
language, limited to the authoritative administratively grantable capabilities,
and followed by plain-language impact confirmation. Scope, channel, trusted
context and limitation labels are presented from one presentation catalog; raw
keys, enum values, runtime evidence, configuration issue codes and resolver
evidence remain behind Advanced disclosures.

For a selected User, **สิทธิ์ที่ใช้งานได้** is the primary permission-management
surface as well as the inspection surface. Domain headings are rendered once per
domain, while effective-access rows remain grouped by exact capability key for
presentation only; every trusted context remains visible inside its capability
card without flattening or simulating authorization. Grantable capability cards
start with their direct User editor collapsed. The compact summary matches
`user.directGrants` by `capabilityKey`, counts only `VALID` records, and shows
human-readable scopes or **ยังไม่มีสิทธิ์เฉพาะบุคคล**. Invalid persisted records
are never presented as valid access and remain available as raw technical
evidence under Advanced diagnostics.

Clicking **ปรับสิทธิ์เฉพาะบุคคล** expands the existing editor inside that same
capability card; **ปิดการแก้ไข** collapses it again. Expanded cards preserve
effective contexts, exact direct grants, available scopes, inline add/remove
confirmation, local mutation errors and authoritative refresh after mutation.
`TEAM` remains excluded for User source, and add/remove operations use the
existing mutation APIs. There is no second large primary direct-grant list at the
bottom of the User page. **เพิ่มสิทธิ์อื่น** remains next to the User permission
heading for a different capability, while Team/TeamRole permission management
remains source-specific.

When either `resolverEffectivePermissionStatus.status` or
`effectiveAccessStatus.status` is `INVALID_CONFIGURATION`, the User
permission-management surface is read-only/fail-closed: **เพิ่มสิทธิ์อื่น**,
**ปรับสิทธิ์เฉพาะบุคคล**, scope radios, add confirmations and remove controls are
not rendered, and the fallback chooser cannot be reached. The existing fail-closed
message and technical evidence remain available.

The permission review dialog retains its fixed header, scrollable middle,
persistent footer outside the scroll region, desktop selector/editor split and
mobile vertical degradation. Team/TeamRole/User mutation payloads and
server-owned authorization semantics are unchanged. User effective access
continues to refresh from the authoritative read model after mutation, redundant
additional authority remains visible, and no production configuration was seeded
or changed. Phase 12G-B was not started.

Final Phase 12G-A verification: focused presentation tests **8 files / 32 tests**;
`npm run architecture:check` passed with 1,140 source files checked;
`npm run lint:strict` passed; `npm run typecheck` passed; `npm run test:run`
passed with **324 files / 2,973 tests**; `npm run test:integration:mysql` passed
with **16 files / 104 tests**; and `git diff --check` passed.

The implementation and verification record is in
[authorization-phase-12ga-ux-simplification.md](authorization-phase-12ga-ux-simplification.md).
The historical next phase was **Phase 12G-B — First Production Capability
Deployment Readiness**. Its live implementation status and production-only
gates are recorded below.

## 9.11 Phase 12G-B live handoff

Phase 12G-B is **implementation complete / awaiting production operational
acceptance** from baseline `c49caec5f14569655d1e385c1706dc7e9e22c0a8`; its
corrective readiness revision starts at `5426be5e9ed3d243f8117e9c1c10dce816fa1d72`.
It adds the read-only command `npm run authorization:production:preflight`, the
deterministic readiness model, explicit canary-plan validation (including
workforce-eligible observers, same-context effective-authority delta through
the authoritative outer effective-access provider, and matching warning
review/disposition), and the operator runbook in
[authorization-phase-12gb-production-readiness.md](authorization-phase-12gb-production-readiness.md).

The implementation does not select a production business target and does not
mutate production authorization. Required migration readback, production
inventory, target approval, canary mutation, post-canary verification, rollback
and observation-window evidence are all **NOT RUN** until an authorized
operator performs them.

## 9.12 Phase 12H-C Domain Default Policy Rebaseline

Phase 12H-C is **COMPLETE** against baseline `9d2b41c03b29a6f9fb6175f6ce7027d0e520b3d1` (`docs(auth): align compatibility seam lifecycle with rollout roadmap`). The phase rebaselines the domain-provided Default Domain Policy so equivalent trusted USER and ADMIN context receives the same default scopes. It does not replace the production resolver singleton and does not remove the legacy ADMIN compatibility seam.

The role-neutral default matrix is:

| Domain | Capability | Default Domain Policy |
| --- | --- | --- |
| Employee | `employee.read`, `employee.stats.read`, `employee.export` | `ALL` |
| Employee | `employee.create`, `employee.update`, `employee.delete`, `employee.import` | none |
| Department | `department.read` | `ALL` |
| Routine | `routine.task.read` | `CREATED + ASSIGNED`; `work-item` `mine` remains `ASSIGNED`; requested `all` does not create `ALL` |
| Routine | `routine.task.create` / `update` / `delete` | `OWN` / `CREATED + ASSIGNED` / `CREATED` |
| Routine | `routine.occurrence.read` | `ASSIGNED` |
| Routine | `routine.occurrence.override`, `reassign`, `change_due_date`, `routine.task.export` | none |
| Routine | `routine.summary.read` | `ASSIGNED`, independent of requested summary view |
| Routine | `routine.reference.read` | `OWN`; configured `ALL` can broaden Dashboard reference data only |
| Stock | `stock.catalog.read` | `ALL` |
| Stock | `stock.request.read`, `create`, `cancel` | `OWN` |
| Stock | `stock.inventory.manage`, `request.process`, `report.export` | none |
| Leave | `leave.request.read`, `create`, `cancel` | `OWN` |
| Leave | `leave.approval.read`, `request.approve` | `ASSIGNED` |
| Leave | `leave.cancellation.decide` | `ASSIGNED` on Dashboard; none on unsupported channels |
| Leave | `leave.request.not_taken` | `OWN + ASSIGNED` |
| Leave | `leave.approver.manage` | none |
| Audit | `audit.read` | none; configured `ALL` is required |
| Notification | `notification.inbox.read`, `notification.inbox.update` | `OWN` |

Routine narrowing is enforced at the authorization/query boundary. A requested task `scope=all` is a view intent, not authority; without configured `ALL`, the task query uses the actor's `CREATED` / `ASSIGNED` relationship predicates, while a requested `assigneeId` remains an additional filter in both narrowed and configured-`ALL` branches. Summary defaults to `mine` in the application query path, and an explicit `all` request is also constrained to the assigned relationship unless effective configured `ALL` exists. Export has no default and therefore denies a normal actor without configured `routine.task.export / ALL`; an existing configured `ALL` still reaches the existing exporter and its limits, batching, field projection, and audit behavior. LIFF remains a self-service channel: the channel policy is applied to equivalent USER and ADMIN actors, and configured broad grants cannot turn LIFF task/reference access into a Dashboard administrative surface.

The phase intentionally preserves active-account/workforce checks, ownership and relationship predicates, query pagination/filtering, resource and lifecycle rules, transactions/locks, validation, idempotency, notifications, audit behavior, export limits and data minimization. Department remains reference data and does not infer Team, TeamRole, or capability authority.

At the Phase 12H-C boundary, production behavior was intentionally mixed
during the rollout: normal USER paths used the rebaselined defaults while
Dashboard ADMIN paths still used the temporary comparison seam. That historical
behavior is superseded by the Phase 12H-G cutover and Phase 12H-I cleanup
recorded below. The Auth control-plane role and the domain-owned
recipient/lifecycle policies remain separate from business capability
authority.

Explicitly deferred: `leave.recovery.manage`, Email Request completion, grant/readiness data changes, schema/migration/seed/backfill work, broad presentation and route ADMIN-gate migration, and final role-neutral production enforcement cutover. Those belong to Phase 12H-D, 12H-F, 12H-E/readiness work, and 12H-G as applicable. Historical sections 9.4, 9.7, and earlier phase closure documents retain the behavior recorded at their boundaries; this section supersedes their selected Routine broad-default claims for the current target.

Verification evidence for this closure is recorded in [authorization-phase-12hc-domain-default-policy-rebaseline.md](authorization-phase-12hc-domain-default-policy-rebaseline.md). Next: **Phase 12H-D — Missing/deferred capability completion**.

## 9.13 Phase 12H-D Missing / Deferred Business Capability Completion

Phase 12H-D is **COMPLETE** against baseline
`2380d23e867d2d4a124bce8623dd06003c789da2`.

The current target inventory is 41 registered capabilities:
`25 CENTRAL_WITH_DEFAULT_POLICY`, `16 CENTRAL_ONLY`, `0
CENTRAL_WITH_COMPATIBILITY`, and `0 DEFERRED`. All 41 capabilities are
`GRANTABLE`; `POLICY_ACTIVATION_REQUIRED` is `0` and `DEFERRED` is `0`.
The role-neutral configured core is **IMPLEMENTED** and the domain defaults
are **REBASELINED**. Production role-neutral enforcement is **NOT CUT OVER**;
the production resolver singleton, `SYSTEM_ROLE` support, and legacy ADMIN
business compatibility remain intentionally active during the transition.

The reviewed `leave.recovery.manage` capability is registered as
`CENTRAL_ONLY`, with `ALL` and `DASHBOARD` as its only supported scope and
channel. It has no Default Domain Policy and grants entry to a recovery path
only. Cancellation and not-taken recovery still require the existing Leave
workflow state, owner exclusion, unavailable effective approver, required
reason, date/timing, quota, transaction/lock/revalidation, notification, audit,
and idempotency/current-action invariants. Normal cancellation and not-taken
confirmation continue to use their assigned-approver relationship authority.
The recovery decision is based on the explicit capability result, not
`actor.systemRole`; role identity remains provenance metadata only.

Owner-side initiation does not abort when no effective approver is available.
Not-taken initiation persists the canonical `APPROVED` plus
`notTakenRequestedAt` pending state, while approved cancellation initiation
persists `CANCELLATION_REQUESTED`. Unavailable owner initiation leaves no
current exception approver relationship unless a fresh valid relationship was
resolved; stale relationship state and its assignment timestamp are cleared,
with action-generation invalidation when the effective assignment changes.
The resulting unavailable requests are discoverable by the recovery candidate
query. Employee-facing notification and audit behavior remains available, but
approver-targeted outbox delivery is omitted when no valid recipient exists.
No ADMIN fallback or manufactured approver is restored; the later decision must use
`leave.recovery.manage / ALL`.

Leave exception-approver resolution no longer searches for or persists an
active Employee merely because its User has `role = ADMIN`. The approved
relationship order is reusable active exception approver, active original
approver, active current manager, then unavailable (`null`). An unavailable
approver does not block owner initiation; the request remains pending with no
manufactured approver and is handled later through the explicit recovery
capability rather than an implicit global ADMIN fallback.

Email Request is now centralized configured authorization only. The adapter
fixes the channel to `DASHBOARD`, builds its actor from trusted authenticated
server state, exposes only registered Email Request capabilities, and has no
default scopes. `email.request.read / OWN` constrains the query to
`requestedBy = authenticated user id`; `ALL` selects the authorized broad
query. `email.request.create / ALL` is checked before idempotency state or
mutation work, while `requestedBy` remains the authenticated user. Email
Request presentation/menu and remaining Dashboard route role gates are still
transitional and are intentionally scheduled for Phase 12H-F; server
authorization is authoritative.

The effective-access inspector now reports real configured decisions for Email
Request and Leave recovery. It does not manufacture deferred Email rows or
default authority. Ordinary Authorization Administration grant commands can
grant all 41 registered capabilities, subject to the existing origin and
validation rules.

This phase did not switch the production singleton, remove the legacy ADMIN
compatibility seam, seed or backfill Team/grant data, migrate broad UI/menu
role visibility, remove the recovery route's legacy ADMIN gate, migrate
Routine presentation semantics, or perform the final enforcement cutover.
Those remain scheduled for the later lifecycle. The exact completion record and
verification evidence are in
[authorization-phase-12hd-missing-deferred-capability-completion.md](authorization-phase-12hd-missing-deferred-capability-completion.md).
The historical next handoff was **Phase 12H-E — Production Team/grant
preparation and effective-access reconciliation**; its current completion
record follows.

## 9.14 Phase 12H-E Production Team/Grant Preparation and Effective-Access Reconciliation

Phase 12H-E is **COMPLETE for repository target-readiness implementation and
verification** against baseline
`0ac8d1bcb30e23b96c413c5166bb833954a3484b`.

The production-readiness model is explicitly labeled `ROLE_NEUTRAL_TARGET`.
Configured business authority is reconciled identically for active USER and
ADMIN accounts from active Team membership plus Team grants, active same-Team
TeamRole membership plus TeamRole grants, and exceptional direct User grants.
The unique configured authority identity is `userId + capabilityKey + scope`,
with `TEAM`, `TEAM_ROLE`, and `USER` provenance retained for duplicate-source
warnings. `ADMIN_PERSISTED_GRANT_REDUNDANT` is obsolete in the current
readiness contract; an ADMIN direct grant is not inherently redundant.

Hypothetical canary resolution uses the Phase 12H-B role-neutral resolver
factory and therefore does not manufacture `SYSTEM_ROLE` grants. Before/after
effective-access comparison still goes through the existing Administration
effective-access provider and domain-owned inspectors. A generic business
canary observer requires an active User, active linked Employee, and a
non-deleted/non-suspended Employee for both USER and ADMIN. Direct User
canaries retain `observerUserId === targetId`; effective redundancy is decided
from Default Domain Policy plus configured target authority.

The preflight remains read-only and communicates that current production may
still use the temporary ADMIN compatibility seam. The production
`authorization` singleton, current domain adapter compatibility wrapper,
control-plane ADMIN-only boundary, empty `AUTHORIZATION_SEED_CONFIGURATION`,
schema, migrations, and production authorization data are unchanged. No
production Team, TeamRole, membership, grant, seed, backfill, or live canary
was created or executed. Production migration/inventory, operator target,
mutation, post-canary, rollback, and observation gates remain **NOT RUN**.

The current registry contains 41 accounted-for capabilities with no
`DEFERRED` administration status. The complete implementation record is in
[authorization-phase-12he-production-grant-effective-access-reconciliation.md](authorization-phase-12he-production-grant-effective-access-reconciliation.md).

Phase 12H-E verification evidence:

- production-readiness focused suite: **1 file / 67 tests passed**;
- related authorization/domain regression selection: **12 files / 306 tests passed**;
- full repository suite: **326 files / 3,091 tests passed**;
- `npm.cmd run typecheck`: passed;
- `npm.cmd run lint:strict`: passed;
- `npm.cmd run architecture:check`: passed, 1,147 source files checked;
- `git diff --check`: passed.

At the Phase 12H-E closure, the next handoff was **Phase 12H-F —
Presentation/route role-authority removal**. Production enforcement cutover remains Phase 12H-G, live rollout
validation remains Phase 12H-H, and compatibility-debt removal remains Phase
12H-I.

## 9.15 Phase 12H-F Presentation and Route Role-Authority Removal

Phase 12H-F is **CLOSED** against the reviewed baseline
`f425a251249932384e0e9b52669581ebaa3cf2bc`. Phase 12H-E was accepted and
closed before this work. This phase removes direct `systemRole = ADMIN`
business decisions from presentation and route-entry surfaces while preserving
the current production resolver and its temporary ADMIN compatibility seam.
It does not perform the Phase 12H-G production resolver cutover, mutate grants,
seed/backfill authorization data, access a live database, or make a production
rollout claim.

Email Request now projects `email.request.read` (`OWN` or `ALL`) and
`email.request.create` (`ALL`) through the existing adapter and current-user
pipeline:

```text
getCurrentUserProjection()
  -> AuthenticatedUser
  -> DashboardUser
  -> DashboardProvider / Email Request page
```

The menu and page require at least one usable capability. The form and history
are independently rendered, and `EmailRequestProvider` disables its list SWR
key when read authority is absent. Therefore create-only actors do not issue
an unauthorized history GET, read-only actors do not receive a form, and the
server API remains authoritative for both operations. The Email Request
`requiredRole: ADMIN` menu/page gate and `requireDashboardAdmin()` caller were
removed.

Leave recovery now exposes `canManageRecovery` only when the effective
`leave.recovery.manage` decision contains `ALL` for `DASHBOARD`. The recovery
tab and availability projection use that field, and
`GET /api/leave/admin/recovery` checks the active workforce session,
capability/scope/channel, candidate predicate, owner exclusion, unavailable
effective approver, and pagination before querying candidates. No direct role
gate remains, so a configured USER recovery operator receives the same valid
recovery path. The private Leave attachment participant `isAdmin` bypass is
explicitly deferred to the later enforcement/domain-policy work; it was not
mapped to an unrelated Leave capability.

Routine presentation no longer chooses a business mode from ADMIN versus
SELF_SERVICE. Its projections expose the relevant granular capabilities and
effective broad scopes, including broad task read/create/update/delete and
reference read where the domain contract requires them. CREATE `OWN` keeps
self-service assignee behavior, while CREATE `ALL` enables the approved broad
assignee behavior. UPDATE, DELETE, status, occurrence, export, resource,
version, state, concurrency, idempotency, audit, notification, and LIFF
self-service constraints remain independently enforced. Routine application
code uses scope-derived `hasBroadAuthority` for the operation being performed;
it does not use an unrelated broad capability as a global admin bit.

H2A.1 permanently retired Routine Import runtime behavior and removed all live
application consumers of task import provenance. After previous processes were
confirmed retired, H2A.2 removed the Import tables and `RoutineTask` provenance
columns and relations from the database and Prisma schema. The Phase 12H-F
provenance restrictions below describe the former runtime implementation and
remain historical security evidence. Historical AuditAction display remains.

Authorization Administration remains the explicit ADMIN-only control plane:
its menu visibility, page/API guards, `requireDashboardAuthorizationAdministration()`,
`assertAuthorizationAdministrationAccess()`, administration APIs, and ADMIN
bootstrap assignment remain unchanged. Identity labels such as
`ผู้ดูแลระบบ`/`ผู้ใช้งาน`, Stock role badges, authentication/lifecycle ADMIN
branches, and historical provenance are not business grants. At the Phase 12H
closure point, Routine and Stock `Role.ADMIN` notification recipient selection
remained a separate recipient policy and was intentionally unchanged. Phase
13A subsequently migrated those audiences to configured business capabilities;
see [notification-capability-recipient-migration.md](notification-capability-recipient-migration.md).

The final semantic search classified remaining direct role matches as follows:

| Classification | Remaining examples | Decision |
|---|---|---|
| `CONTROL_PLANE_KEEP` | Authorization Administration guards/APIs, administration menu, `requireAdminSession`, `isAdminRole` control-plane checks | Retained; permission administration is not a business capability surface |
| `AUTHENTICATION_LIFECYCLE_KEEP` | Bootstrap ADMIN assignment, workforce-or-admin helper, narrow Routine/Stock account-lifecycle branches | Retained for lifecycle compatibility; broad caller audit belongs to 12H-G |
| `PRESENTATION_IDENTITY_ONLY` | Dashboard/Stock identity labels and role badges | Retained because they display identity and grant no authority |
| `DOMAIN_RECIPIENT_POLICY` | Routine/Stock `Role.ADMIN` notification audiences | Retained at the historical 12H closure point; migrated by Phase 13A |
| `COMPATIBILITY_DEBT_12H_G_OR_I` | Legacy ADMIN business-authority compatibility seam and Stock compatibility semantics | Retained until the enforcement/cutover phases |
| Explicitly deferred domain policy | Leave private-attachment participant ADMIN bypass | Not remapped; requires separately approved policy |

There is no remaining unclassified ordinary business presentation or route-entry
role gate in the reviewed production surface. The production authorization
resolver remains compatibility-backed. The next phase is **12H-G — production
enforcement cutover and full enforcement/security regression**.

Phase 12H-F verification evidence:

- Email/Leave/Dashboard projection and route-entry selection: **10 files / 82 tests passed**;
- Routine authorization/query/mutation/presentation/form selection: **12 files / 212 tests passed**;
- Authorization Administration control-plane selection: **8 files / 65 tests passed**;
- Email API and Leave authorization/API selection: **5 files / 83 tests passed**;
- Leave route projection regression: **1 file / 11 tests passed**;
- full repository suite: **328 files / 3,106 tests passed**;
- `npm.cmd run typecheck`: passed;
- `npm.cmd run lint:strict`: passed;
- `npm.cmd run architecture:check`: passed, 1,149 source files checked;
- `git diff --check`: passed.

Historical post-closure verification for the Routine import-provenance
runtime boundary ran against `4e7236ef9d6d9a6b33cdf495544595a0ae4f9b67`, before
H2A.1 retired the Import workflow. It predates the current H2A.1 Prisma/DB
compatibility representation and does not establish physical contraction:

- Routine mutation, idempotency, import/staging/apply, query, authorization,
  and presentation selection: **20 files / 273 tests passed**;
- full repository suite: **328 files / 3,110 tests passed**;
- typecheck, strict lint, architecture check (1,149 source files), and
  `git diff --check`: passed.

This is an appended corrective result and does not rewrite the historical
Phase 12H-F verification total.

No development server or production build was run. No production grant, seed,
backfill, migration, live preflight, canary, or authorization rollout was
performed.

## 10. Explicit non-goals for Phase 0

Phase 0 ไม่ได้ทำและไม่ควรตีความว่าได้อนุมัติสิ่งต่อไปนี้:

- สร้าง Team, TeamRole, TeamMembership, TeamCapabilityGrant, TeamRoleCapabilityGrant, UserCapabilityGrant
- สร้าง Capability Registry, Scope Registry, AuthorizationActor contract, generic resolver, authorization.can(), authorization.require() หรือ authorization.resolve()
- สร้าง Team-based policy, Department-based authorization, explicit DENY, wildcard permission, policy DSL หรือ general ABAC engine
- แทนที่ requireAdminSession, requireApiSession, workforce guards หรือ domain checks เดิม
- เปลี่ยน Prisma schema, migration, production authorization outcome หรือ authentication/session/refresh/password/LINE/LIFF identity infrastructure
- แก้ broad export/read risk ที่ค้นพบในเอกสารนี้
- เปลี่ยน UI styling หรือสร้าง authorization administration UI/permission API

## 11. Historical Phase 1 recommendation — Capability Contract & Registry

ส่วนนี้เป็น historical Phase 1 recommendation ที่ถูก supersede โดย implementation และ closure records ของ Phase 2–10; ไม่ใช่ขอบเขตปัจจุบันของ Phase 11A:

1. กำหนด capability identifiers ที่ตรงกับ operation จริง เช่น employee.read, employee.export, routine.task.read, routine.task.create, routine.task.update, routine.task.delete, routine.occurrence.reassign, routine.occurrence.change_due_date, stock.request.create/read/cancel/process, stock.inventory.read/manage, leave.request.create/read/cancel, leave.request.approve, leave.manage, audit.read, data.export และ capability สำหรับ configuration เฉพาะที่พิสูจน์จาก route แล้ว
2. สำหรับแต่ละ capability ระบุ supported **authorization execution channels** (`DASHBOARD`, `LIFF_SELF_SERVICE`, `SYSTEM` ถ้าจำเป็น), authentication/workforce precondition, current unauthorized outcome และ whether it is a read, mutation, export, workflow decision or system operation; บันทึก entry-point / transport surface แยกต่างหาก โดยไม่สร้าง `API` เป็น actor channel เพียงเพราะ route อยู่ใต้ `/api/**`. Dashboard-owned API calls โดยปกติยังคงเป็น `DASHBOARD` context, LIFF routes ใช้ `LIFF_SELF_SERVICE`, และ trusted background/platform operations ใช้ `SYSTEM` หรือ system principal model ที่ได้รับอนุมัติ
3. ระบุ supported scope อย่าง explicit: self/created/assigned/team/all ตาม current semantics; ใช้ OPEN — requires Phase 1/domain review สำหรับ effective approver, participant, recovery และ report-history cases ที่ generic scope แปลไม่ได้ตรง ๆ
4. เก็บ domain-owned predicates แยกจาก capability grant: active User/Employee, creator/assignee/requester/effective approver/manager, valid Leave/Stock/Routine state, quota, concurrency, active target references และ transaction rules
5. สร้าง registry record จาก matrix ก่อนสร้าง resolver โดยห้ามอนุมาน grant จาก Department, Department name, Team name หรือ magic role name
6. ตัดสิน policy อย่างเป็นลายลักษณ์อักษรสำหรับ Routine USER all-scope, Employee broad read/export, Audit export event endpoint และ Leave report visibility ใน policy-activation/hardening phase ถัดไป; Phase 9C ได้ยืนยัน route-derived LIFF channel และคง response boundary ที่ไม่ส่ง employee list แล้ว
7. เมื่อ contract ถูก review แล้วจึงออกแบบ mapping ของ ADMIN และ normal-user grants แบบ additive ALLOW โดยคง default DENY ของ future generic layer และคง channel restriction ของ LIFF

ข้อเสนอข้างต้นเป็นขอบเขตสำหรับการออกแบบ Phase 1 เท่านั้น เอกสารนี้ไม่ได้เริ่ม implementation ของ Phase 1

## Phase 12H-G historical closure

Phase 12H-G cuts over the repository's normal production business path to
role-neutral configured authority. `authorization` and
`createAuthorizationResolver()` load direct User, Team, and TeamRole grants
for both USER and ADMIN. Equivalent trusted contexts therefore receive the
same Default Domain Policy, and ADMIN without configured authority is denied
the catalog's central-only capabilities.

Normal domain adapters use `composeAuthorizationAuthority()`; at the H-G
boundary the legacy resolver/evaluator and composition wrapper were retained
only for the explicitly named Phase 12H-H snapshot-comparison seam. The old
mixed workforce helper was retired, and Routine, Stock, Leave approver
management, and private Leave attachment access required the same active
workforce/participant context for both roles. Stock cancellation notification
mode was relationship-based, while Routine/Stock ADMIN recipient policies
remained separate domain policies.

Authorization Administration, bootstrap/last-ADMIN lifecycle, identity and
audit provenance, and approved recipient policies remained ADMIN/system-role
uses. None was an ordinary business ALLOW/DENY source at that boundary. The
detailed historical closure and verification record is in
[authorization-phase-12hg-enforcement-cutover-security-regression.md](authorization-phase-12hg-enforcement-cutover-security-regression.md).

## Phase 12H-H historical operational status

Phase 12H-H is **CLOSED / ACCEPTED** from the operator-confirmed evidence in
[authorization-phase-12hh-production-snapshot-live-rollout-validation.md](authorization-phase-12hh-production-snapshot-live-rollout-validation.md).
The existing read-only production preflight, production-readiness evaluator,
safe persistence projection, Administration effective-access provider, audited
Authorization Administration mutation boundary, and canary-plan validator were
reused. No second scanner, capability evaluator, direct SQL/Prisma production
mutation path, automatic ADMIN backfill, seed, or repair path was introduced.

The H record distinguishes repository evidence, real MySQL concurrency
evidence, and live operator observations. Production deployment SHA and exact
operator metadata were not independently recorded.

The retained legacy resolver/evaluator/composition seam was intentionally
comparison-only through H. Phase 12H-I subsequently removed that business
authority compatibility seam; the H record preserves the historical boundary
and evidence provenance.

## Phase 12H-I current closure

Phase 12H-I is **CLOSED**. The final model is:

- `Role.ADMIN` and `User.role` remain Auth/control-plane identity and remain
  authoritative for Authorization Administration access, bootstrap, role
  management, and last-eligible-ADMIN protections.
- Business authority is the domain Default Domain Policy plus configured
  `TEAM`, `TEAM_ROLE`, and exceptional `USER` grants.
- The canonical resolver loads configured persistence for USER and ADMIN
  equally and never creates a business grant from `systemRole`.
- Administration presents the account/system role separately from business
  grant sources; historical Audit JSON is readable without rewriting it.

The implementation and regression evidence are recorded in
[authorization-phase-12hi-compatibility-debt-removal.md](authorization-phase-12hi-compatibility-debt-removal.md).

## Phase 13A / 13A.1 current state

Phase 13A aligns business notification audiences with configured capability
authority. Routine, Stock, and Email Request no longer use `User.role` or an
environment email allowlist for the migrated audiences. The Authorization
recipient lookup remains deliberately limited to explicit configured grants and
does not replace domain authorization or Default Domain Policy evaluation. The
lookup now evaluates each candidate through the canonical configured evaluator
and excludes principals whose persisted configuration is malformed.

Phase 13A.1 historically kept the Routine recipient database enum expanded for
rollout compatibility. H2B / Phase 13A.2 is now CLOSED: the forward migration
backfills `ADMINS` to `ALL_READERS` and `ASSIGNEES_AND_ADMINS` to
`ASSIGNEES_AND_ALL_READERS`, asserts zero legacy rows, and contracts MySQL to
the three canonical values. Prisma and application reads/writes use the same
canonical-only vocabulary, and the persistence compatibility normalizer is
removed. The operator confirmed the production collision preflight and
migration deployment PASSED. The Routine recipient persistence transition is
CLOSED.

## Pre-IT Authorization Administration security hardening

The focused Pre-IT hardening closes H0-AUTH-01 and H0-SEC-01 from the audited
H0 baseline. All 14 Authorization Administration POST/PATCH/DELETE handlers
use the shared trusted-mutation contract; the four GET/read handlers remain
outside that gate. The request boundary still derives the ADMIN principal from
the authenticated server session. Inside each Team, TeamRole, membership, or
grant serializable transaction, the mutation locks the linked Employee row and
actor User row in that order, then re-reads persisted role, account, and
Employee lifecycle before running the write callback. The Auth-owned
system-role transaction locks actor and target Employee rows before actor and
target User rows, each in deterministic order, and performs the same current
actor eligibility check before changing role state. Successful writes and
Audit remain atomic.

Actor eligibility requires a present ADMIN User that is active and not
soft-deleted, with a linked ACTIVE Employee that is not soft-deleted. These
paths and the existing Leave, Stock, Routine, and shared workforce actor
guards follow Employee-then-User locking. Related Employee IDs read before the
transaction determine lock order only; the User-to-Employee link is checked
again inside the transaction after locking. The security change adds no schema
or migration and does not claim production deployment evidence.
Focused API, application, and real-MySQL regression evidence is recorded in
[pre-it-hardening-h0-baseline.md](pre-it-hardening-h0-baseline.md).

## IT9A channel policy current state

IT9A extends the central IT capability registry by channel:

| Capability | `DASHBOARD` | `LIFF_SELF_SERVICE` | `SYSTEM` |
| --- | --- | --- | --- |
| `it.ticket.read` | Supported | Supported, effective scope clamped to `OWN` | Unsupported |
| `it.ticket.create` | Supported | Supported, effective scope clamped to `OWN` | Unsupported |
| `it.ticket.comment` | Supported | Supported, effective scope clamped to `OWN` | Unsupported |
| `it.ticket.manage` | Supported | Unsupported | Unsupported |
| `it.analytics.read` | Supported | Unsupported | Unsupported |

The IT Default Domain Policy supplies `read/create/comment / OWN` to eligible
active workforce through both Dashboard and LIFF, independent of `systemRole`.
`manage` and `analytics.read` have no defaults. Dashboard continues composing
configured Team, TeamRole, and direct User authority additively. In the LIFF
channel, IT applies its own requester policy after central resolver and default
composition: the effective scope for read/create/comment is `OWN`, even when
configured authority resolves to `ALL`. The configured decision remains
available as configured evidence and is not rewritten to claim that a grant
originated from the default policy. USER and ADMIN follow the same rule.

This narrowing is IT channel policy; the central resolver knows only that the
three requester capabilities are registered for `LIFF_SELF_SERVICE`. IT
`SYSTEM` actors remain unsupported, and `systemRole` alone never grants IT
business authority. `/api/line/it/**` builds context from the verified LIFF
workforce session and calls the same IT application operations as Dashboard.
The requester query and mutation resource predicates remain authoritative; a
LIFF operator with configured ALL cannot read or comment on another
requester's Ticket or attachment. Dashboard configured ALL remains available
according to existing operator rules.

The IT9A requester API surface is:

- `GET` and `POST /api/line/it/tickets`
- `GET /api/line/it/tickets/:id`
- `GET /api/line/it/tickets/:id/timeline`
- `POST /api/line/it/tickets/:id/comments`
- `GET /api/line/it/attachments/:id`

Every route uses `requireLiffWorkforceSession()` and invokes the shared IT
requester commands/queries for tickets, timelines, comments, and attachments.
IT9A does not include a `/liff/it` UI, LIFF Home entry, Bottom Nav entry, Rich
Menu integration, Ticket LINE notifications, operator LIFF, or analytics LIFF.

## Current IT requester LIFF phase status

IT9A is **CLOSED** and owns the requester-only LIFF authorization/API
foundation described above. IT9B requester presentation exists at `/liff/it`
and `/liff/it/[ticketId]` through the browser-safe `@/modules/it/client` entry
and is **CLOSED** after independent review and final verification. IT9C is
**CLOSED** after independent review and owns the shared LIFF Home/module
projection, service card, navigation, canonical requester deep links, and
Unified Rich Menu integration. The review confirmed the fixed
`LIFF_SELF_SERVICE` IT capability projection and that IT9C changed no
authorization capability or API enforcement.
IT9D is **CLOSED** after independent review and adds requester-only Ticket
personal LINE without changing authorization capabilities or API enforcement.
IT9E-A repository E2E/acceptance readiness is **COMPLETE**; IT9E-B
Android/iPhone device acceptance is **NOT RUN / next human acceptance step**.
IT9E remains in progress and IT10 hardening remains **OPEN / deferred**. IT9E-A
made no authorization capability, policy, or enforcement changes.
