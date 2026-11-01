# NHF Employee — Leave corrective engineering

Baseline: `45083b920653e6ff67c2559ef2a41ad65e07e9cb`
วันที่ตรวจ: 1 พฤศจิกายน 2026
ขอบเขต: findings ทั้งห้ารายการของ Leave; ไม่มีการ push หรือ deploy

## Commits และไฟล์ที่เปลี่ยน

SHA ของ commit ที่ 4 อยู่ในข้อความส่งมอบ และตรวจได้ด้วย `git log -4 --oneline` จาก commit ที่มีเอกสารนี้

### Commit 1: `58296076642dd2fd049abd951b4a103e95e16d05`

`fix(leave): provide accurate read-only quota projections by year`

```text
M	__tests__/api/leave-me.test.ts
M	__tests__/integration/leave-quota-concurrency.integration.test.ts
M	app/api/leave/me/route.ts
M	app/api/line/leave/me/route.ts
M	modules/leave/application/queries/profile-queries.ts
A	modules/leave/application/queries/quota-projection.test.ts
A	modules/leave/application/queries/quota-projection.ts
M	modules/leave/index.ts
M	modules/leave/presentation/LeaveRequestSummary.tsx
M	modules/leave/presentation/dashboard/components/LeaveRequestFormFields.tsx
A	modules/leave/presentation/dashboard/hooks/quota-preview.test.ts
M	modules/leave/presentation/dashboard/hooks/useLeaveRequestFormModel.test.ts
M	modules/leave/presentation/dashboard/hooks/useLeaveRequestFormModel.ts
M	modules/leave/presentation/liff/LiffLeaveRequestForm.tsx
A	modules/leave/presentation/quota-client.ts
A	modules/leave/schemas/query-year.ts
```

### Commit 2: `102846a4304c6a53b319dc97c66a0222a9f01215`

`fix(leave): support pending over-quota reason amendments`

```text
A	__tests__/api/leave-corrective-routes.test.ts
M	__tests__/integration/leave-quota-concurrency.integration.test.ts
M	lib/security/mutation-rate-limit.ts
M	lib/ssot/routes.ts
M	modules/audit/presentation/dashboard/display.ts
M	modules/audit/presentation/dashboard/registry.ts
M	modules/leave/application/approvals/current-action-validation.ts
M	modules/leave/application/approvals/decision.ts
A	modules/leave/application/requests/amend-special-reason.test.ts
A	modules/leave/application/requests/amend-special-reason.ts
M	modules/leave/domain/audit.ts
M	modules/leave/index.ts
A	modules/leave/presentation/PendingSpecialReasonEditor.test.tsx
A	modules/leave/presentation/PendingSpecialReasonEditor.tsx
M	modules/leave/presentation/dashboard/EmployeeLeaveDashboard.tsx
M	modules/leave/presentation/dashboard/components/EmployeeLeaveHistoryList.tsx
M	modules/leave/presentation/liff/LiffLeaveApp.tsx
M	modules/leave/presentation/liff/LiffLeaveRequestDetail.tsx
M	modules/leave/schemas/leave.ts
A	modules/leave/server/special-reason-api.ts
A	prisma/migrations/20261101070000_leave_special_reason_audit/migration.sql
M	prisma/schema.prisma
```

### Commit 3: `c906a116a5255efe936e29735b621984536b3de9`

`feat(leave): add accessible calendar month and year navigation`

```text
M	__tests__/helpers/leave-calendar.ts
M	modules/leave/presentation/LeaveDateCalendar.test.tsx
M	modules/leave/presentation/LeaveDateCalendar.tsx
A	scripts/check-leave-calendar.mjs
```

### Commit 4: commit ที่มีรายงานฉบับนี้

`fix(leave): enforce strict report parameters and close regressions`

รวม strict export validation, route adapters ของ amendment, การตรวจเหตุผลที่ผู้อนุมัติเห็น, regression closure และรายงานนี้

```text
M	__tests__/api/leave-export.test.ts
M	app/api/leave/export/route.ts
A	app/api/leave/special-reason/route.ts
A	app/api/line/leave/special-reason/route.ts
R073	__tests__/integration/leave-quota-concurrency.integration.test.ts	modules/leave/__tests__/integration/leave-quota-concurrency.integration.test.ts
M	modules/leave/application/approvals/current-action-recipient.test.ts
M	modules/leave/application/approvals/decision.ts
M	modules/leave/index.ts
M	modules/leave/presentation/LeaveDateCalendar.tsx
M	modules/leave/presentation/dashboard/api.ts
M	modules/leave/presentation/dashboard/hooks/quota-preview.test.ts
M	modules/leave/presentation/dashboard/hooks/useLeaveRequestFormModel.ts
M	modules/leave/presentation/dashboard/hooks/useManagerApprovalModel.test.ts
M	modules/leave/presentation/dashboard/hooks/useManagerApprovalModel.ts
M	modules/leave/presentation/liff/LiffLeaveApp.tsx
M	modules/leave/presentation/liff/LiffLeaveDecisionSheet.tsx
M	modules/leave/presentation/liff/api.ts
M	modules/leave/schemas/leave.ts
R092	__tests__/api/leave-corrective-routes.test.ts	modules/leave/server/corrective-routes.test.ts
M	prisma/schema.prisma
M	scripts/check-leave-calendar.mjs
A	docs/verification/leave-corrective-engineering.md
```

## Root cause และผลแก้ไข

| Finding | สาเหตุ | การแก้ไข |
| --- | --- | --- |
| LEAVE-P2-01 | ฟอร์มหา quota ของปีที่เลือกไม่พบแล้วคำนวณ over-quota เป็น 0 | เพิ่ม quota projection แยกตามปี; unknown เป็น null และห้ามผ่านขั้นตรวจสอบ/ส่งคำขอจนทราบ quota |
| LEAVE-P2-02 | pending ไม่สำรอง quota; เมื่อรายการอื่นอนุมัติก่อน ไม่มีทางเพิ่มเหตุผลให้รายการเดิม | เจ้าของแก้ specialReason ของ PENDING ได้ พร้อม optimistic precondition, row lock และ audit; ผู้อนุมัติ retry ตาม flow เดิม |
| LEAVE-P3-01 | profile GET เรียก ensure/upsert และ forward reconciliation | เปลี่ยนเป็น read-only projection; initialization/reconciliation ยังอยู่ใน mutation transactions เดิม |
| LEAVE-P3-02 | ปฏิทินต้องเลื่อนทีละเดือน | เพิ่ม native month/year dropdown ผ่าน DayPicker 10 APIs; เดือนภาษาไทย ปีแสดง พ.ศ. และค่าภายในเป็น ค.ศ. |
| LEAVE-P3-03 | parseInt ยอมรับส่วนต้นของ string และแยก absent/empty ไม่ได้ | ใช้ strict four-digit schema ช่วง 2000–2100; ปฏิเสธ empty/duplicate/malformed parameters |

## Read-only quota และปีที่เลือก

- `getEmployeeLeaveQuotaProjection` ใช้ `leaveQuota.findMany` เพียงการอ่านหนึ่งชุดของเจ้าของและปีไม่เกินปีเป้าหมาย ไม่มี create/update/upsert, audit หรือ outbox write
- ยอดใช้มาจากแถวปีเป้าหมาย; default entitlement มาจาก constants เดิม และ opening carry ใช้ `calculateOpeningCarryBalanceHalfDays` เดิม จาก quota ปีก่อนหน้าล่าสุด
- คำนวณเหมือน `ensureLeaveQuotaForYear`: normalize สิทธิประจำปีตาม default เดิม, ใช้ signed carry และคิด missing intermediate years ตาม domain helper เดิม ไม่เพิ่ม entitlement formula ชุดใหม่
- PERSONAL/VACATION รองรับ carry บวกและลบ; SICK carry เป็น 0; หน่วยคำนวณยังเป็น half-day integers ก่อนแปลงเป็น days สำหรับ response
- ถ้าไม่มีแถวก่อนหน้า จะใช้ annual entitlement โดยไม่สร้างประวัติย้อนหลังสมมติ; ถ้ามีแถวก่อนหน้า จะคำนวณข้ามปีที่ขาดตามกฎเดิม ปีเป้าหมายที่มีแถวอยู่ยังใช้ usedHalfDays ที่บันทึกไว้
- ปีปัจจุบันใช้ Asia/Bangkok รวมจุดเปลี่ยนปี; current/historical/future ใช้กฎเดียวกัน ฟอร์มไม่ใช้ quota ต่างปีแทนกัน
- profile response ยังมี quotas/history/metadata เดิม; quota ที่ยังไม่ persist มี render identity `projection-{year}-{leaveType}` และยอดที่คำนวณได้ จึงแสดง current-year cards ได้โดยไม่เขียนฐานข้อมูล

API ใหม่ใน read route เดิม:

```text
GET /api/leave/me?quotaYear=YYYY
GET /api/line/leave/me?quotaYear=YYYY
```

ทั้งสองใช้ session ของช่องทางนั้น, `leave.request.read` แบบ OWN, feature gate เดิม และ identity จาก session ไม่มี employee ID หรือ entitlement ที่ client กำหนดได้ Response แยก quotas เท่านั้น ไม่ดึง Leave history และใช้ private/no-store

ฟอร์มร่วม Dashboard/LIFF แยก available/loading/unavailable/error และแสดง over-quota จากค่าที่ทราบจริง ช่วง unknown จะไม่เป็นศูนย์ ปี/channel/retry แต่ละรอบมี key ใหม่ จึงไม่รับ response เก่าหรือ revive ยอดเดิมเมื่อสลับปีกลับระหว่างโหลด การยืนยัน draft วันที่ยังเป็นเงื่อนไขเดิม และไม่ reset เหตุผลหรือไฟล์แนบ

## Pending amendment, authorization และ concurrency

```text
PUT /api/leave/special-reason
PUT /api/line/leave/special-reason

{ leaveId, specialReason, expectedSpecialReason }
```

- ใช้ active workforce session แยก Dashboard/LIFF พร้อม trusted Origin, AJAX header, body limit 32 KiB และ rate limits ตามโครงสร้างเดิม
- strict object รับเฉพาะสามฟิลด์ข้างต้น; เหตุผล trim แล้วต้องยาว 5–1000 ตัวอักษร ไม่อนุญาตให้ลบจนเป็นค่าว่าง
- resolve `leave.request.create` แบบ OWN อีกครั้งใน Serializable transaction จาก user/employee ที่ยัง active และตรวจ exact owner ของคำขอ การเป็น approver/admin ไม่ให้สิทธิ์แก้เหตุผลของผู้อื่น
- ล็อก Leave request row ทั้ง amendment และ approval ก่อนอ่านสถานะ/เหตุผล ใช้ conditional update ที่มี owner, PENDING และค่าเหตุผลเดิม ป้องกันการเขียนทับจากหน้าที่เปิดค้าง
- เมื่อ approval/rejection/cancellation ชนะก่อน amendment จะคืน conflict; เมื่อ amendment ชนะ approval จะอ่านเหตุผลที่ persist ล่าสุด การตัด quota ยังตรวจสิทธิ์ authoritative ภายใน transaction และ rollback เมื่อไม่ผ่าน
- identical retry ขณะยัง PENDING เป็น no-op ไม่มี audit/outbox ซ้ำ; retry หลังเปลี่ยนสถานะคืน conflict
- mutation แก้เพียง specialReason และ updatedAt อัตโนมัติของ ORM ไม่เปลี่ยน type/date/period/duration/reason/attachments/owner/approver/status/quota
- Dashboard history และ LIFF requester detail มี inline editor ที่ label ชัดเจน ใช้งานมือถือได้ แสดง error ที่แก้ต่อได้ และ refresh รายการหลังบันทึก
- approval 409 อธิบายเป็นภาษาไทยว่าผู้ยื่นต้องเพิ่มเหตุผลกรณีลาเกินสิทธิ์แล้วให้ผู้อนุมัติลองอีกครั้ง ไม่เปลี่ยน status หรือ deduct quota
- UI ทั้งสองส่ง `expectedSpecialReason` ตอนอนุมัติ หากเหตุผลเปลี่ยนจากที่ผู้อนุมัติเห็น จะ conflict ให้ refresh/อ่านใหม่ LIFF confirmation แสดงเหตุผลจากผู้ยื่นด้วย ฟิลด์นี้ optional สำหรับ API clients เดิมเพื่อคง backward compatibility

## Audit และ notifications

ใช้ specialReason column เดิม ไม่มีการเพิ่ม request/quota column มี migration เดียว `20261101070000_leave_special_reason_audit` เพื่อเพิ่ม audit action `LEAVE_REQUEST_SPECIAL_REASON_UPDATE` เพราะ enum เดิมไม่มีเหตุการณ์แก้คำขอลา การใช้ CREATE/APPROVE แทนจะให้ความหมายประวัติผิด

SQL append enum ใหม่ไว้ท้ายสุดและรักษาค่า/ลำดับเก่าทั้งหมด Prisma declaration จัดให้ตรง SQL แล้ว ทดลองใช้ migration ทั้งหมด 83 รายการกับ MySQL 8.0.46 จริง และ `prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma --script` แสดง empty migration

Audit บันทึก before/after reason ใน transaction พร้อม userId ของ requester และมี label/formatter ภาษาไทย ไม่อ้างว่า approver เป็นผู้แก้เหตุผล ไม่สร้าง notification ใหม่จาก amendment เพื่อลด consequential events ซ้ำ Current-action outbox ที่ resolve หลัง amendment จะอ่าน specialReason ล่าสุดจากฐานข้อมูล และยังผ่าน validation/recipient/delivery identity เดิม การแจ้งเตือนที่ส่งไปแล้วไม่แก้ย้อนหลัง ไม่มีการส่ง transport โดยตรงใน transaction

## Calendar และ report validation

Calendar ใช้ captionLayout dropdown และ native select ผ่าน documented Dropdown component ของ installed DayPicker มี Thai labels สำหรับ screen reader และ target สูงอย่างน้อย 44px ช่วงปีใน selector เลื่อนตามปีที่เปิดดู (รอบละ ±100 ปี) จึงไม่มี hard eligibility boundary ใหม่ เดือน/ปี wrap เมื่อจอแคบเพื่อให้เห็นชื่อเดือนและตัวเลข พ.ศ. ครบ

การเลื่อนเดือน/ปีไม่ยืนยันวันที่ ไม่ล้าง draft/incomplete range และไม่อิงความพร้อมของ Google ICS การ discard และการกลับจาก Step 2 คืนไปเดือนของ committed date ตามเดิม Friday–Monday, cross-year rejection, backdate, half-day และ weekend rules ยังคงเดิม

Report year รับเฉพาะปีสี่หลัก 2000–2100; absent ใช้ current Bangkok year แต่ empty ไม่ใช่ absent ปฏิเสธ suffix, decimal, negative, NaN, Infinity, out-of-range และ duplicate year รวมกรณี yearsOnly ที่ส่ง year ผิด Valid yearsOnly/metaOnly/format/scope และ report authorization/query/workbook implementation เดิมคงอยู่ ตรวจ history/holiday parsing แล้วคงแยก semantics ของ filter และ holiday window ตามเดิม ไม่ขยายไปแก้ pagination หรือ API อื่น

## พฤติกรรมเดิมที่รักษาไว้

Pending ไม่สำรองหรือตัด quota; quota ถูกตัดเมื่ออนุมัติสำเร็จเท่านั้น Approval recalculates ภายใน transaction และการเกินสิทธิ์ต้องมี special reason ไม่มีการเพิ่มสิทธิ์หรือ auto-approve ค่า default, signed carry ของ PERSONAL/VACATION, SICK no-carry, half-day units, weekend exclusion, cross-year prohibition, emergency backdate limit, overlap checks, approved cancellation, not-taken restoration, forward reconciliation, recovery/exception approver, request idempotency และ audit/outbox invariants เดิมยังอยู่ Google holiday เป็นข้อมูลอ้างอิง ไม่เปลี่ยน duration

## Verification ที่รันจริง

| คำสั่ง/ชั้นทดสอบ | ผล |
| --- | --- |
| `npm run typecheck` | ผ่าน; production build ตรวจ TypeScript ของโค้ดสุดท้ายผ่านอีกครั้ง |
| `npm run lint` | ผ่าน ไม่มี warning; หลังปรับเฉพาะจุดตรวจ eslint ของไฟล์ที่ได้รับผลเพิ่มผ่าน |
| `npm run architecture:check` | ผ่านครั้งสุดท้าย ตรวจ 1,393 source files รวม module-owned tests และ public API ที่ลดแล้ว |
| Focused quota/profile/form tests | ผ่าน รวม domain projection, half-day, signed carry, missing years, unknown/loading/error, stale response และ Dashboard/LIFF parity |
| Focused amendment/API/editor/audit tests | ผ่าน รวม owner/status/input/capability-denied/CSRF/body limit/retry/optimistic conflict และ reason ที่ current-action worker อ่าน |
| `npm test -- __tests__/api/leave-export.test.ts modules/leave/infrastructure/reports/report-workbook.test.ts modules/leave/server/corrective-routes.test.ts` | ผ่าน 3 files / 61 tests ระหว่างการแก้; API test ย้ายเข้าขอบเขตโมดูลและตรวจซ้ำแล้ว |
| `npm run test:integration:mysql` | ผ่าน 24 files / 205 tests ใน MySQL 8.0.46 ที่แยกไว้ รวม SQL migration coverage |
| MySQL Leave quota/amendment focused run หลังย้าย test/ปรับ fixture | ผ่าน 9/9; overlap/cancellation focused run ก่อนหน้านั้นรวมผ่าน 36 tests |
| `node scripts/check-leave-calendar.mjs` | ผ่าน 4/4: Dashboard/LIFF × 320/390px; native keyboard, Thai BE year, December/January, draft retention/discard, layout/touch targets และไม่มี browser runtime error |
| Impeccable detector | ผ่าน ไม่มี findings ใน changed UI targets ที่ตรวจ |
| `npm test` (รัน full suite หนึ่งครั้ง) | 416 files ผ่าน / 2 files ล้ม; 4,333 tests ผ่าน / 16 timeout / 1 skipped; 430.18s — ชุดรวมยังไม่ผ่าน |
| Focused rerun ของ Summary หลัง full suite | ผ่าน 3/3, test execution 2.40s; ผ่านซ้ำพร้อม registry/API รวม 44 tests |
| Focused rerun ของ Calendar หลัง full suite | ผ่าน 36/36, test execution 44.42s; 49.53s รวม startup/import |
| `npm run build` | ผ่านด้วย Leave flag เปิดและ DATABASE_URL ชี้ integration DB; compile 32.4s, TypeScript 44s, static pages 107/107 |

MySQL tests ครอบคลุม A (pending ไม่ consume และอนุมัติได้เมื่อพอ), B (สอง pending ผ่าน submission ด้วย balance เดียวกัน → A approve → B conflict → requester amend → retry สำเร็จ), C (race ทั้งภายในสิทธิ์และกรณีเกินสิทธิ์ ไม่มี double deduction), D/E (owner, invalid input และสถานะที่หมดสิทธิ์แก้ แยก route Dashboard/LIFF), F (identical retry มี amendment audit เพียงหนึ่งรายการ) กรณี unauthenticated/capability-denied และ oversized body มี unit/route seam tests; ไม่สร้าง deny policy ใหม่เพื่อทดสอบกับ MySQL เพราะ active workforce เดิมมี default OWN ตาม authorization design

## Full-suite timeout: รายการที่ล้มและการวินิจฉัย

ทั้งหมดเป็น `Test timed out in 5000ms` ไม่ใช่ assertion mismatch ด้านผลลัพธ์

ไฟล์ `modules/leave/presentation/LeaveDateCalendar.test.tsx`:

| Test title | describe/channel ที่ล้ม | จำนวน |
| --- | --- | --- |
| jumps month and BE year without committing dates or losing incomplete ranges | dashboard primary date calendar; liff primary date calendar | 2 |
| returns to the committed month after review without resetting form values | ทั้งสองช่องทาง | 2 |
| hides confirmation after committing and restores it only for changed drafts (multi-day: true) | ทั้งสองช่องทาง | 2 |
| highlights Friday through Monday including weekends, charges two days and preserves Step 2 round trip | ทั้งสองช่องทาง | 2 |
| keeps selection operational during unavailable/incomplete reference data (false), with retry | ทั้งสองช่องทาง | 2 |
| keeps selection operational during unavailable/incomplete reference data (true), with retry | ทั้งสองช่องทาง | 2 |
| keeps the existing ครึ่งวันเช้า control and quota preview functional | ทั้งสองช่องทาง | 2 |
| keeps the existing ครึ่งวันบ่าย control and quota preview functional | liff primary date calendar | 1 |

ไฟล์ `modules/leave/presentation/LeaveRequestSummary.test.tsx`:

- `Leave request summary > keeps the summary for the review step and shows the same summary in Dashboard and LIFF` — 1 timeout

Focused reruns ผ่านด้วย timeout เดิม รวม Calendar ที่ผ่านหลายรอบระหว่างงาน จึงยังไม่พบ deterministic behavior failure ที่ทำซ้ำได้ ช่วง broad run วัดได้ 11 Node processes บนเครื่อง 8 logical cores / RAM ประมาณ 8 GB; probable cause คือ CPU contention กับชุด DOM/time-zone rendering ระหว่าง file parallelism ไม่ได้พิสูจน์ว่าเป็น failure เดิมจาก baseline เพราะไม่ได้รัน baseline full suite เปรียบเทียบ ไม่เพิ่ม timeout ไม่ลบ assertion ไม่แก้ Vitest configuration และไม่รัน full suite ซ้ำเพียงเพื่อให้ได้ผลเขียว

หนึ่ง skipped test เป็นของเดิมใน `modules/it/infrastructure/attachments/cleanup-orphans.test.ts`: `does not follow a ticket-directory symlink outside IT storage` ซึ่ง skip บน win32 ไม่ได้แก้ในงานนี้ มี React act warnings ระหว่าง broad Calendar run ด้วย

หลัง full suite ปรับเพียง test ownership/import-export และลำดับ audit enum declaration ให้ตรง migration แล้วตรวจ focused MySQL, registry/API, eslint, architecture และ production build เพิ่ม ไม่มีการเปลี่ยน quota/approval business behavior หลังผล broad run

## ข้อจำกัดและสิ่งที่ไม่ได้ทดสอบ

- Full unit/component suite ยังมี 16 broad-only timeouts ตามรายการข้างต้น จึงไม่อ้างว่า full suite ผ่าน
- Browser smoke ใช้ component และ CSS จริง แต่ stub transport ไม่ใช่ authenticated Next.js → LINE OAuth → external notification delivery E2E; ไม่มีการส่งอีเมลหรือ LINE จริงในการทดสอบนี้
- Legacy API clients ที่ไม่ส่ง expectedSpecialReason ยังใช้ approval-time authoritative validation เดิม แต่ไม่มี stale-view precondition เพิ่ม UI รุ่นนี้ทั้งสองช่องทางส่งฟิลด์ดังกล่าวแล้ว
- Build มี Turbopack filesystem-tracing warnings 7 จุดใน `modules/it/infrastructure/attachments/storage.ts` ที่ไม่ได้แก้ไข: lines 81, 132, 150, 173, 189, 210, 236 เป็นหนี้เทคนิคต่างโมดูล จึงไม่แตะในงาน Leave
- มีเพียง audit enum migration ใหม่ ต้องใช้ในกระบวนการ release ก่อนให้โค้ดเขียน action ใหม่ งานนี้ใช้ migration เฉพาะฐานทดสอบ ไม่มี production migration/push/deploy
- MySQL เริ่มต้นเชื่อมต่อไม่ได้ (P1001) จึงใช้ portable runtime ใน TEMP ที่ localhost:3309 ตรวจ datadir ก่อน shutdown และปิดสำเร็จแล้ว ไฟล์ runtime/ZIP ยังอยู่ใน TEMP เพราะ automatic approval review ปฏิเสธคำสั่ง recursive cleanup ด้วยข้อความ blocked by policy ไม่มีไฟล์ใน repository ที่ค้างเป็น debug/temporary implementation

Browser artifacts ของรอบสุดท้าย: `C:/Users/Yingyot/AppData/Local/Temp/nhf-leave-calendar-q0RlGy`
Runtime ที่หยุดแล้ว: `C:/Users/Yingyot/AppData/Local/Temp/nhf-leave-mysql-runtime`
Archive: `C:/Users/Yingyot/AppData/Local/Temp/nhf-mysql-8.0.46.zip`
