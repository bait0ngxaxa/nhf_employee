# Leave Authorization Migration — Phase 7A

สถานะ: Phase 7A — Leave Server Authorization Migration  
วันที่: 2026-09-12

เอกสารนี้บันทึกการย้าย authorization ฝั่ง server ของ Leave ไปยัง central authorization resolver โดยคง relationship, workflow, business rule, transaction และ channel behavior ของ Leave เดิมไว้ ไม่ใช่ policy ใหม่และไม่ใช่ Phase 7B presentation projection

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

ไม่มีการเพิ่มหรือเปลี่ยน capability key, scope, Prisma authorization schema หรือ seed grant ใน phase นี้

## Leave adapter and compatibility floor

`modules/leave/application/authorization.ts` เป็น boundary เดียวของ Leave สำหรับ:

- สร้าง `AuthorizationActor` จาก authenticated User/Employee ที่ server เชื่อถือเท่านั้น
- กำหนด `DASHBOARD` หรือ `LIFF_SELF_SERVICE` จาก route family; client ไม่สามารถเลือก channel ได้
- เรียก central resolver และแปลผล capability/scopes ให้ use case ของ Leave
- ใช้ compatibility floor เฉพาะเมื่อ resolver ตอบ `NO_APPLICABLE_GRANT`
- ปฏิเสธและไม่ fallback เมื่อเป็น `UNKNOWN_CAPABILITY`, `CHANNEL_NOT_SUPPORTED`, invalid persisted authorization configuration หรือ structural resolver/persistence failure
- re-read และ lock active User/Employee ก่อน resolve capability ใน transaction

Compatibility floor ของ Leave ไม่ได้หมายความว่า Admin มีสิทธิ์ทุกอย่าง:

- `request.read`, `request.create`, `request.cancel` แปลเป็น `OWN`
- `approval.read`, `request.approve`, `cancellation.decide` (Dashboard) แปลเป็น `ASSIGNED`
- `request.not_taken` แปลได้ทั้ง `OWN` และ `ASSIGNED` เพราะ owner request กับ approver confirmation เป็นคนละ operation
- `approver.manage` แปลเป็น `ALL` เฉพาะ Admin ใน compatibility path และเฉพาะ Dashboard

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
- Not-taken request and confirmation use `leave.request.not_taken` with `OWN` and `ASSIGNED` separately. The application does not treat the route option or request data as Admin authority.
- Approver settings use `leave.approver.manage / ALL` on Dashboard. The route no longer makes `requireAdminSession()` the final authorization decision; assignment eligibility, hierarchy, pending-request and concurrency invariants remain in Leave.

All protected mutations revalidate relevant capability and trusted active identity inside their existing transaction boundary. Existing serializable transactions, row locks, action-version checks, atomic claims, quota reconciliation, audit and outbox semantics are retained.

## Dashboard and LIFF isolation

The route constructs the channel server-side. Dashboard Admin recovery behavior is not inherited by LIFF:

- cancellation recovery override is available only through the existing Dashboard Leave-specific path when effective approver availability and existing recovery conditions permit it;
- not-taken Admin recovery follows the same Dashboard-only compatibility path and requires the existing recovery reason/relationship checks;
- LIFF passes `LIFF_SELF_SERVICE`, so `leave.cancellation.decide` is not supported there and no Admin recovery override is enabled for not-taken confirmation;
- normal LIFF approval still requires `leave.request.approve / ASSIGNED` and effective assignment.

## Intentionally deferred boundaries

Phase 7A does not add generic policy for these surfaces:

- Leave report/export: current-team visibility, original-approver history and existing export behavior remain unchanged. There is no `leave.report.export` capability.
- Participant/detail access: owner, effective approver, original approver and Admin behavior remain Leave-owned.
- Attachments: participant/Admin authorization remains unchanged and is not replaced by `leave.request.read`.
- `GET /api/leave/admin/recovery`: remains Dashboard-only, active-workforce, Admin-only and filtered by unavailable effective approver plus current-Admin workload exclusion. There is no generic recovery capability.
- manager/direct-report, original-approver history, exception approver precedence, quota, dates, workflow state, concurrency, attachments, notifications and audit semantics remain Leave-domain responsibilities.

Existing presentation projections such as `canApproveLeave`, `canViewLeaveReports` and `LiffLeaveCapabilities` remain behavior-compatible and are not authoritative server permissions. Phase 7B owns their granular projection migration.
