# Leave Authorization Migration — Phase 7A / Phase 7B / Phase 7C

สถานะ: Phase 7A — CLOSED; Phase 7B — CLOSED; Phase 7C — CLOSED; Leave authorization migration — CLOSED
วันที่: 2026-09-13

เอกสารนี้บันทึกการย้าย authorization ฝั่ง server ของ Leave ไปยัง central authorization resolver, การย้าย presentation projection ใน Phase 7B และการ complete-surface audit/regression hardening ใน Phase 7C โดยคง relationship, workflow, business rule, transaction และ channel behavior ของ Leave เดิมไว้ ไม่ใช่ policy ใหม่และไม่ใช่การเริ่ม Employee authorization migration

## Scope

Phase 7A บังคับใช้ capability ที่มีอยู่ใน registry เท่านั้น:

| Capability | Scope ที่ registry รองรับ | Channel |
|---|---|---|
| `leave.request.read` | `OWN` | `DASHBOARD`, `LIFF_SELF_SERVICE` |
| `leave.approval.read` | `ASSIGNED` | `DASHBOARD`, `LIFF_SELF_SERVICE` |
| `leave.request.create` | `OWN` | `DASHBOARD`, `LIFF_SELF_SERVICE` |
| `leave.request.cancel` | `OWN` | `DASHBOARD`, `LIFF_SELF_SERVICE` |
| `leave.request.approve` | `ASSIGNED` | `DASHBOARD`, `LIFF_SELF_SERVICE` |
| `leave.cancellation.decide` | `ASSIGNED` | `DASHBOARD` |
| `leave.request.not_taken` | `OWN`, `ASSIGNED` | `DASHBOARD`, `LIFF_SELF_SERVICE` |
| `leave.approver.manage` | `ALL` | `DASHBOARD` |

ไม่มีการเพิ่มหรือเปลี่ยน capability key, scope, Prisma authorization schema หรือ seed grant ใน Phase 7A/7B

## Leave adapter and compatibility floor

`modules/leave/application/authorization.ts` เป็น boundary เดียวของ Leave สำหรับ:

- สร้าง `AuthorizationActor` จาก authenticated User/Employee ที่ server เชื่อถือเท่านั้น
- กำหนด `DASHBOARD` หรือ `LIFF_SELF_SERVICE` จาก route family; client ไม่สามารถเลือก channel ได้
- เรียก central resolver และแปลผล capability/scopes ให้ use case ของ Leave
- ให้ `getLeavePresentationCapabilities()` ใช้การแปลผลเดียวกันกับ server enforcement โดยเรียก `authorization.resolveMany()` เพียงครั้งเดียวต่อ projection
- ใช้ compatibility floor เฉพาะเมื่อ resolver ตอบ `NO_APPLICABLE_GRANT`
- ปฏิเสธและไม่ fallback เมื่อเป็น `UNKNOWN_CAPABILITY`, `CHANNEL_NOT_SUPPORTED`, invalid persisted authorization configuration หรือ structural resolver/persistence failure
- re-read และ lock active User/Employee ก่อน resolve capability ใน transaction

Compatibility floor ของ Leave ไม่ได้หมายความว่า Admin มีสิทธิ์ทุกอย่าง:

- `request.read`, `request.create`, `request.cancel` แปลเป็น `OWN`
- `approval.read`, `request.approve`, `cancellation.decide` (Dashboard) แปลเป็น `ASSIGNED`
- `request.not_taken` แปลได้ทั้ง `OWN` และ `ASSIGNED` เพราะ owner request กับ approver confirmation เป็นคนละ operation
- `approver.manage` แปลเป็น `ALL` เฉพาะ Admin ใน compatibility path และเฉพาะ Dashboard โดย compatibility เดิมของ Dashboard Admin ยังคงอิง active User account และไม่บังคับ Employee profile; explicit normal `USER` grant ยังคงต้องมี active workforce

Explicit resolver `ALLOW` ใช้ scopes จาก resolver โดยตรง ดังนั้น normal `USER` ที่ได้รับ explicit grant เช่น `leave.approver.manage / ALL` สามารถผ่าน capability ได้โดยไม่ถูกเลื่อน role เป็น Admin แต่ยังต้องผ่าน active workforce และ Leave-owned domain constraints

## Resource relationship semantics

### OWN

`OWN` ถูกแปลโดย Leave จาก trusted active Employee identity ไม่ใช่ `employeeId` ใน request payload และไม่ใช่ client-supplied owner. Create สร้างคำขอให้ current Employee ของ actor เท่านั้น; read/cancel และ not-taken request ยังคงตรวจ owner/status/date/quota/idempotency และ workflow rules เดิม

`leave.request.read / OWN` ถูกต่อเข้ากับ self profile/history surfaces ที่เป็น owner-scoped เท่านั้น. Participant/detail และ attachment access ไม่ได้ถูกลดรูปเป็น OWN

### ASSIGNED

`ASSIGNED` เป็น prerequisite เท่านั้น; Leave ยังคงตัดสิน resource relationship ด้วย effective approver predicate เดิม (`getAssignedLeaveApproverWhere` หรือ canonical equivalent):

```text
exceptionApproverId เมื่อมีค่า
otherwise approverId
```

owner, unrelated Employee และ original approver ที่ถูก supersede โดย exception approver ไม่สามารถกระทำได้จาก capability อย่างเดียว. `leave.approval.read` ไม่เท่ากับ `leave.request.approve`, และ list visibility ไม่ถูกใช้เป็น approval authority

Normal approve/reject, cancellation decision และ not-taken confirmation ยังคงตรวจ self-action, current status/action version, effective assignment และ atomic claim ภายใน Leave

## Migrated server paths

- Self Leave profile/history routes use `leave.request.read / OWN`; existing query remains employee-derived.
- Approval list routes use `leave.approval.read / ASSIGNED`; `getLeaveApprovalList` still applies the effective-assignment query and actionable/history distinctions.
- Request creation uses `leave.request.create / OWN`; actor-derived ownership, date/overlap/year/quota/attachment/idempotency/audit/outbox behavior remains unchanged.
- Employee cancellation uses `leave.request.cancel / OWN`; owner, status/date, quota, audit, notifications, row locks and concurrency behavior remain Leave-owned.
- Normal approve/reject uses `leave.request.approve / ASSIGNED`; transaction-time effective-assignment, pending/current-action, quota and atomic claim checks remain authoritative.
- Normal cancellation decisions use `leave.cancellation.decide / ASSIGNED` on Dashboard; normal effective approver behavior remains unchanged.
- The existing LIFF effective-approver cancellation decision remains temporarily Leave-domain-authorized because the registry defines `leave.cancellation.decide` as Dashboard-only. Phase 7A intentionally preserves this production workflow without adding `LIFF_SELF_SERVICE`, inventing a capability, or bridging `CHANNEL_NOT_SUPPORTED`; it remains a future authorization-contract/policy decision and is not centrally migrated.
- Not-taken request and confirmation use `leave.request.not_taken` with `OWN` and `ASSIGNED` separately. The application does not treat the route option or request data as Admin authority.
- Approver settings use `leave.approver.manage / ALL` on Dashboard. The legacy Admin compatibility path remains account-based and Employee-optional; an explicit normal `USER` grant requires active workforce. The route no longer makes `requireAdminSession()` the final authorization decision; assignment eligibility, hierarchy, pending-request and concurrency invariants remain in Leave.

All protected mutations revalidate relevant capability and trusted active identity inside their existing transaction boundary. Existing serializable transactions, row locks, action-version checks, atomic claims, quota reconciliation, audit and outbox semantics are retained.

## Dashboard and LIFF isolation

The route constructs the channel server-side. Dashboard Admin recovery behavior is not inherited by LIFF:

- cancellation recovery override is available only through the existing Dashboard Leave-specific path when effective approver availability and existing recovery conditions permit it;
- not-taken Admin recovery follows the same Dashboard-only compatibility path and requires the existing recovery reason/relationship checks;
- LIFF passes `LIFF_SELF_SERVICE`; the existing effective-approver cancellation decision is therefore kept in the Leave domain because `leave.cancellation.decide` is not registered for LIFF, and no Admin recovery override is enabled for that path or for not-taken confirmation;
- normal LIFF approval still requires `leave.request.approve / ASSIGNED` and effective assignment.

## Intentionally deferred boundaries

Phase 7A does not add generic policy for these surfaces:

- Leave report/export: current-team visibility, original-approver history and existing export behavior remain unchanged. There is no `leave.report.export` capability.
- Participant/detail access: owner, effective approver, original approver and Admin behavior remain Leave-owned.
- Attachments: participant/Admin authorization remains unchanged and is not replaced by `leave.request.read`.
- `GET /api/leave/admin/recovery`: remains Dashboard-only, active-workforce, Admin-only and filtered by unavailable effective approver plus current-Admin workload exclusion. There is no generic recovery capability.
- manager/direct-report, original-approver history, exception approver precedence, quota, dates, workflow state, concurrency, attachments, notifications and audit semantics remain Leave-domain responsibilities.

Existing presentation projections such as `canApproveLeave` and `canViewLeaveReports` remain behavior-compatible and are not authoritative server permissions. Phase 7B adds the granular `LeavePresentationCapabilities` projection while retaining these legacy fields as compatibility aliases/deferred relationship projections. The canonical LIFF relationship contract is `getLiffLeaveRelationshipProjection()`; the deprecated `getLiffLeaveCapabilities()` helper and `LiffLeaveCapabilities` type were removed after a repository-wide production-consumer audit.

## Phase 7B — Leave capability-driven presentation projection

### Contract and one batched resolver projection

`modules/leave/application/types.ts` เป็นเจ้าของ immutable serializable contract:

```ts
export interface LeavePresentationCapabilities {
    readonly canReadOwnRequests: boolean;
    readonly canReadAssignedApprovals: boolean;

    readonly canCreateOwnRequests: boolean;
    readonly canCancelOwnRequests: boolean;

    readonly canApproveAssignedRequests: boolean;
    readonly canDecideAssignedCancellations: boolean;

    readonly canRequestOwnNotTaken: boolean;
    readonly canConfirmAssignedNotTaken: boolean;

    readonly canManageApprovers: boolean;
}
```

`getLeavePresentationCapabilities(context)` เรียก
`authorization.resolveMany(actor, LEAVE_MIGRATED_CAPABILITIES)` เพียงครั้งเดียว
สำหรับ capability ที่ลงทะเบียนไว้ทั้งแปดรายการใน Phase 7A แล้วแปลผลเป็นเก้าฟิลด์
โดย `leave.request.not_taken` decision เดียวให้ทั้ง `OWN` และ `ASSIGNED` field.
การแปลผลใช้ `buildLeaveCapabilityAuthorization()` ภายใน boundary เดียวกับ
server enforcement จึง reuse `NO_APPLICABLE_GRANT` compatibility floor เดิมและ
ไม่สร้าง compatibility table ชุดที่สอง. Expected authorization/channel denial
จะเป็น `false`; `UNKNOWN_CAPABILITY`, configuration/persistence/structural และ
system failure จะ propagate ไม่ถูกแปลงเป็น all-false.

### Capability กับ relationship ต้องแยกกัน

Capability เป็นเพียง eligibility ระดับ operation. `ASSIGNED` ไม่ได้แปลว่า actor
ถูก assign ให้ทุกคำขอหรือมีงานที่ต้องทำอยู่จริง. Leave ยังคงใช้
`getAssignedLeaveApproverWhere()`, exception-approver precedence, owner exclusion,
available actions และ workflow state เป็น resource/work relationship แยกต่างหาก.
ดังนั้น approval surface ใช้ทั้ง assigned-read capability และ existing actionable
relationship hint; `canReadAssignedApprovals` ไม่ได้ imply approve, cancellation
decision หรือ not-taken confirmation และ `canManageApprovers` ไม่ได้ imply approval
หรือ recovery authority.

### Dashboard flow

Dashboard current-user projection สร้าง Leave actor จาก authenticated account และ
active Employee ที่ server เชื่อถือ (`userId`, `systemRole`, `employeeId`,
`DASHBOARD`) แล้วเรียก capability projection เดียวกัน ก่อนส่งต่อผ่าน
`CurrentUserProjection` / `AuthenticatedUser` / `DashboardUser`.

- My Leave โหลด profile/history เมื่อ `canReadOwnRequests` เท่านั้น
- create, own cancellation และ own not-taken request ใช้ capability ที่ตรงกันร่วมกับ domain available-action/state rule
- approval list ใช้ `canReadAssignedApprovals` ร่วมกับ existing `canApproveLeave` relationship/work hint
- approve/reject, not-taken confirmation และ Dashboard cancellation decision ใช้ capability ของ operation นั้นร่วมกับ effective-assignment/resource/state rule
- stale form/dialog ถูกปิดหรือทำให้ใช้งานไม่ได้ และ mutation handler ตรวจ capability ซ้ำที่ presentation boundary; server route ยังเป็น authority
- Approver settings ใช้ `canManageApprovers`; normal USER ที่มี explicit `leave.approver.manage / ALL` จึงเห็น settings ได้โดยไม่ถูกเลื่อนเป็น Admin

`canApproveLeave` ยังคงเป็น legacy alias ที่ derive จาก assigned-read capability และ
existing Leave approval-surface relationship. `canViewLeaveReports` ยังคงมาจาก
manager/direct-report และ original-approver-history relationship projection เดิม.
Reports ไม่มี generic `leave.report.export` capability ใน phase นี้.

Admin recovery ยังคงใช้ existing Admin-only presentation rule และไม่ derive จาก
`canManageApprovers` หรือ capability การอนุมัติใด ๆ. USER ที่ได้รับ approver-manage
จึงไม่เห็น recovery.

### LIFF flow

`getLiffCapabilities()` สร้าง trusted Leave actor จาก `session.user`,
`session.employeeId` และ `LIFF_SELF_SERVICE` แล้วเรียก
`getLeavePresentationCapabilities()` เดียวกับ Dashboard. `/api/line/home` จึง
เป็น capability contract ที่ `LiffLeaveApp` โหลดก่อน own profile/history หรือ
approval data. Leave module ใน LIFF available เมื่อ feature เปิดและ
`canReadOwnRequests || canReadAssignedApprovals`.

Legacy LIFF aliases ยังคงไว้ดังนี้:

```text
canRequestLeave
    = Leave feature enabled
      AND canReadOwnRequests
      AND canCreateOwnRequests

canApproveLeave
    = Leave feature enabled
      AND canReadAssignedApprovals
      AND existing actionable effective-approver relationship hint
```

Own profile โหลดเฉพาะเมื่อ own-read; approval list โหลดเฉพาะเมื่อ assigned-read
และมี actionable effective-approver relationship. LIFF กรอง server-provided
`availableActions` กับ capability ที่ตรงกันสำหรับ CANCEL/
REQUEST_CANCELLATION, REQUEST_NOT_TAKEN, APPROVE/REJECT และ CONFIRM_NOT_TAKEN.

### LIFF cancellation exception and deferred detail policy

`leave.cancellation.decide` ยังคงรองรับเฉพาะ Dashboard ดังนั้น
`leaveCapabilities.canDecideAssignedCancellations === false` ใน LIFF เป็นผลที่
คาดหมาย. ห้ามใช้ค่านี้ซ่อนหรือ disable `CONFIRM_CANCELLATION` และ
`REJECT_CANCELLATION` ที่ server ส่งกลับใน `availableActions`; สอง action นี้ยังใช้
effective-approver relationship และ Leave-domain/Phase 7A server enforcement.
ไม่มีการเพิ่ม LIFF channel, fake capability หรือ bridge `CHANNEL_NOT_SUPPORTED`.

Participant/detail deep link และ attachment policy ยังคงให้ server participant
boundary, `viewerRole` และ `availableActions` เป็น authority; ไม่ reject detail
เพียงเพราะ generic own-read/assigned-read เป็น false. หลัง ambiguous session
recovery LIFF refresh `/api/line/home` ก่อน, แทนที่ capability snapshot, refresh
เฉพาะ surface ที่ยังได้รับอนุญาต และไม่ retry mutation ด้วย snapshot เดิม.

### Phase 7B boundary

Phase 7B เป็น presentation/UX capability projection เท่านั้น. ไม่ได้เพิ่ม
capability key หรือ scope และไม่ migrate report/export, participant/detail,
attachments, Admin recovery, manager/direct-report scope, Team policy หรือ Leave
server authorization. Presentation booleans ทั้งหมดไม่ใช่ security boundary;
authentication, authorization, relationship, workflow, business rule,
transaction และ concurrency checks ฝั่ง server ยังคง authoritative.

## Phase 7C — Leave authorization migration closure and regression hardening

สถานะ: **Phase 7A — CLOSED; Phase 7B — CLOSED; Phase 7C — CLOSED; Leave
authorization migration — CLOSED**

Phase 7C ตรวจ production surface แบบ end-to-end และยืนยันเส้นทาง authoritative
ดังนี้:

```text
registered Leave capability
    -> central resolver
    -> Leave authorization adapter
    -> Leave-owned resource relationship
    -> Leave workflow/business invariant
    -> transaction/lifecycle validation
    -> Dashboard/LIFF presentation projection
```

### Complete production-surface audit

ตรวจครบ `app/api/leave/**`, `app/api/line/leave/**`,
`app/dashboard/leave/**`, `app/liff/leave/**`, `modules/leave/**`, Leave
composition ใต้ `modules/line/**`, `app/_lib/auth/current-user.ts`, Dashboard
menu/route composition, `/api/auth/me` และ `/api/line/home` รวมทั้ง callers และ
tests ที่เกี่ยวข้องกับ request, approval, cancellation, not-taken, approver
management, participant/detail, attachment, report/export และ Admin recovery.

การตรวจ role/boolean จัดประเภทได้ดังนี้:

- **A — migrated authorization:** request read/create/cancel, approval read,
  approve/reject, Dashboard cancellation decision, not-taken owner/confirmation
  และ approver management ใช้ Leave capability adapter ที่เรียก central resolver
  ตาม registered inventory
- **B — intentionally deferred Leave policy:** reports/export,
  participant/detail, attachments, Admin recovery และ LIFF cancellation decision
  ยังคงใช้ Leave-owned relationship/domain boundary ตามที่ระบุด้านล่าง
- **C — compatibility floor:** `NO_APPLICABLE_GRANT` และ account-only Dashboard
  Admin approver-management exception อยู่ภายใน Leave adapter เท่านั้น
- **D — descriptive/presentation identity:** `role`, `isAdmin`,
  `canApproveLeave`, `canViewLeaveReports` และ LIFF aliases ใช้เป็น identity หรือ
  projection ที่ไม่ใช่ server authority
- **E — obsolete bypass:** ไม่พบ migrated operation ที่ใช้ role หรือ client input
  เป็น authority หลัง audit; Dashboard Leave menu/direct-route gap และ deprecated
  LIFF helper residue ถูกแก้ใน Phase 7C

Role checks ที่คงไว้จำกัดอยู่ที่ Dashboard Admin recovery, participant/detail/
attachment Admin relationship, approver-management compatibility exception และ
descriptive presentation identity เท่านั้น. `canApproveLeave` ยังคงเป็น
relationship-sensitive hint; `canViewLeaveReports` ยังคงเป็น deferred report
projection. ไม่พบการใช้ `requireAdminSession`, client-provided role,
`employeeId`, owner, scope หรือ permission boolean เพื่อสร้าง authority ของ
migrated Leave operation.

### Dashboard menu, direct route และ tab closure

`constants/dashboard.ts` เป็นเจ้าของ helper กลาง
`canAccessLeaveDashboard()` และ tab visibility/normalization contract. Leave
Dashboard มี usable surface เมื่ออย่างน้อยหนึ่งข้อต่อไปนี้เป็นจริง:

```text
canReadOwnRequests
OR (canReadAssignedApprovals AND existing canApproveLeave relationship hint)
OR canViewLeaveReports
OR existing Admin recovery surface
OR canManageApprovers
```

Menu และ `DashboardProvider` ใช้ helper เดียวกัน จึงไม่ใช้ broad Admin shortcut;
normal USER ที่มี `leave.approver.manage / ALL` เห็น Leave entry และ
approver-settings ได้ แต่ไม่เห็น recovery. Direct `/dashboard/leave` ตรวจตามลำดับ
feature flag -> trusted current-user projection -> login redirect -> Leave
availability -> access-denied redirect -> safe tab normalization -> render.
Query `leaveTab` ไม่ใช่ authorization input: tabs ที่ไม่ visible จะ normalize
ไปยัง visible surface แรก และ route จะ deny หากไม่มี surface ใดเลย. ฝั่ง
`LeaveManagementSection` คง normalization เป็น defense-in-depth.

Visibility สุดท้ายยังเป็น:

```text
my-leave          -> canReadOwnRequests
approvals         -> canReadAssignedApprovals AND canApproveLeave relationship
recovery          -> existing Dashboard Admin-only recovery policy
reports           -> canViewLeaveReports
approver-settings -> canManageApprovers
```

### Server capability, resource/query และ transaction closure

ทุก migrated server operation derive identity จาก trusted session และใช้ Leave
adapter; active Employee/workforce เป็นเงื่อนไขตาม operation ยกเว้น exact
account-only Dashboard Admin `leave.approver.manage` compatibility path. OWN
แปลเป็น owner predicate ของ current Employee และ ASSIGNED ใช้
canonical effective-approver predicate ที่ exception approver supersedes original
approver และ owner ถูกกันออก. Approval list/detail ที่อยู่ใน scope นี้ยังคงใช้
query-level effective assignment เมื่อปลอดภัย. Participant/detail และ attachment
ยังคงใช้ Leave-owned participant/Admin relationship; reports ยังคงใช้
manager/direct-report และ original-approver history; recovery candidates ไม่ถูก
แทนที่ด้วย ASSIGNED.

Create, own cancel, approve/reject, cancellation decision, not-taken และ
approver-management mutations แยก route preflight ออกจาก transaction
authorization. Transaction boundary re-reads and locks current User และ
Employee เมื่อ operation บังคับ workforce (หรือใช้ account-only exception ตาม
ขอบเขตข้างต้น), ตรวจ active/not-deleted/linkage และ resolve capability ใหม่ก่อน
protected write;
resource relationship, current action/status, owner exclusion, exception
precedence, quota, row locks, serializable/retry, atomic claim/update, audit,
outbox และ notification behavior เดิมยังคงอยู่. การ deactivation/deletion,
Employee suspension/deletion, role/grant revocation หรือ assignment/exception
change ระหว่าง preflight กับ transaction จึง fail closed.

### Presentation and channel isolation

Dashboard และ LIFF ใช้ granular capability eligibility ร่วมกับ Leave resource
และ state/action relationship. LIFF own profile/history ต้องมี own-read;
approval list ต้องมี assigned-read และ actionable effective relationship; action
controls intersect capability ที่ตรงกับ operation กับ server `availableActions`.
`CONFIRM_CANCELLATION` และ `REJECT_CANCELLATION` ใน LIFF ยังคงเป็น explicit
Leave-domain exception เพราะ `leave.cancellation.decide / ASSIGNED` รองรับเฉพาะ
Dashboard. ไม่เพิ่ม LIFF channel, ไม่จับ `CHANNEL_NOT_SUPPORTED` แล้ว bypass และ
ไม่เปิด Admin recovery ใน LIFF. Effective/exception approver ใช้งานได้ตามเดิม;
owner, superseded original approver, unrelated Employee และ unrelated Admin ยัง
ถูกปฏิเสธ.

Compatibility bridge ยังคงมีเพียง:

```text
resolver ALLOW        -> ใช้ scopes จาก resolver
NO_APPLICABLE_GRANT   -> Leave compatibility floor
ทุก denial/configuration/system อื่น -> fail closed หรือ propagate
```

`CHANNEL_NOT_SUPPORTED`, `UNKNOWN_CAPABILITY`, invalid persisted authorization,
resolver structural failure และ database/configuration failure ไม่ fallback ไปยัง
role behavior.

### Compatibility aliases and removed helper

Dashboard `canApproveLeave` และ `canViewLeaveReports` ถูกเก็บไว้เพราะยังเป็น
active relationship/deferred-policy contracts; ไม่ใช่ registered capability.
LIFF `/api/line/home` ยังคง `canRequestLeave` และ `canApproveLeave` เพื่อ response
compatibility. ทั้งหมด derive จาก trusted projection/relationship และไม่ถูกใช้
เป็น server authority. Audit ไม่พบ production consumer ของ
`getLiffLeaveCapabilities()` หรือ `LiffLeaveCapabilities` นอก definition/export/
docs จึงลบ deprecated helper/type/export และเก็บ canonical
`getLiffLeaveRelationshipProjection()` ไว้.

### Explicitly deferred boundaries

Phase 7C **ไม่ได้** migrate และไม่ควรอ่านว่า migrated แล้ว:

- reports/export และ audit/report relationship policy; ยังไม่มี
  `leave.report.export`
- participant/detail และ original/effective approver/Admin participant rules
- attachment participant/Admin access
- Dashboard Admin recovery และ recovery candidate policy; ไม่มี generic
  `leave.recovery.*` หรือ `RECOVERY` scope
- LIFF `leave.cancellation.decide`; ยังคง Leave-domain exception และ registry
  ยังคง Dashboard-only

### Regression evidence

Focused regression coverage ครอบคลุม adapter/projection independence, transaction
identity/lifecycle revalidation, request read/create/cancel, approval read/decision,
cancellation, not-taken, approver management, participant/detail/attachments,
reports/export, Dashboard current-user/menu/direct route/tabs/actions, LIFF home,
Leave route/presentation/session recovery และ cross-user/effective-approver,
channel-isolation, direct-input spoofing cases.

ผลคำสั่งตรวจสอบที่รันจริง:

- `npm.cmd run architecture:check` — passed; ตรวจ 1,045 source files
- `npm.cmd run lint:strict` — passed; zero warnings
- `npm.cmd run typecheck` — passed
- focused Leave/Dashboard/LIFF Vitest invocation — passed; 32 files, 308 tests
- `npm.cmd run check` — passed; architecture, lint, typecheck และ full Vitest
  285 files, 2,472 tests
- `git diff --check` — passed; ไม่มี whitespace error หรือ encoding/mojibake finding

Focused command ที่ใช้คือ `npm.cmd run test:run --` ตามรายการ test files ใน
`authorization-current-state.md` section 8.4 และครอบคลุมทุก surface ที่ระบุใน
ย่อหน้าข้างต้น.

Phase 7C จึงปิด Leave authorization migration โดยไม่เปลี่ยน capability
inventory, scope vocabulary, deferred Leave policy, workflow หรือเริ่ม Employee
authorization migration.
