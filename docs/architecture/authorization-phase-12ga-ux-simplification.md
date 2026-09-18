# Phase 12G-A — Authorization Administration UX Simplification

สถานะ: **CLOSED**

Starting baseline: `a44d5b19a66f63f196f6471897473b9317d8ca97` (`audit(auth): close Phase 12F security regression matrix`)

Phase ถัดไป: **Phase 12G-B — First Production Capability Deployment Readiness**

เอกสารนี้บันทึกการปรับ presentation และ interaction ของ Authorization
Administration เท่านั้น ไม่ใช่การเปลี่ยน policy หรือการเริ่ม production readiness

## Problem statement

หน้าเดิมทำให้ผู้ดูแลระบบทั่วไปต้องเข้าใจคำศัพท์และโครงสร้างภายใน เช่น Capability,
Grant, Scope, Resolver, Default Domain Policy และ Effective Authority ก่อนจึงจะ
เพิ่มหรือนำสิทธิ์ออกได้ Phase 12G-A เปลี่ยน primary experience ให้ตอบคำถามของ
ผู้ดูแลระบบว่าใครกำลังถูกจัดการ ทำอะไรได้ สิทธิ์มาจากไหน และการเปลี่ยนแปลงมีผล
อย่างไร โดยไม่ลบหลักฐานที่จำเป็นสำหรับ IT/operator

## Operator mental model

Primary UI ใช้ mental model นี้:

- **กลุ่มผู้ใช้งาน** รวมคนที่ควรได้รับสิทธิ์ร่วมกัน
- **บทบาทในกลุ่ม** แยกหน้าที่ของสมาชิกภายในกลุ่ม
- **สิทธิ์ของกลุ่ม** มีผลกับสมาชิกทุกคนในกลุ่ม
- **สิทธิ์ของบทบาท** มีผลเฉพาะสมาชิกที่มีบทบาทนั้น
- **สิทธิ์เฉพาะบุคคล** เป็นข้อยกเว้นสำหรับผู้ใช้รายเดียว และโดยปกติควรใช้กลุ่ม
  หรือบทบาทเป็นหลัก
- **สิทธิ์พื้นฐาน**, **สิทธิ์ที่เพิ่มให้**, และ **สิทธิ์ที่ใช้งานได้** แยกกัน
  อย่างชัดเจน

การแสดง “สิทธิ์ที่ใช้งานได้” เป็นขอบเขตการใช้งานโดยรวม ไม่ใช่ผลจำลองของ
resource predicate หรือ workflow ทั้งหมด การทำรายการจริงยังตรวจเจ้าของข้อมูล
ผู้รับผิดชอบ สถานะรายการ และขั้นตอนการทำงานที่ domain เป็นเจ้าของ

## Business vocabulary

Presentation vocabulary อยู่ที่
`modules/authorization/presentation/dashboard/permission-presentation.ts` เป็น
SSOT สำหรับคำอธิบายผู้ดูแลระบบ ประกอบด้วยชื่อหมวดงาน ชื่อ action คำอธิบาย
ขอบเขต และชื่อช่องทาง ตัวอย่างเช่น:

| Internal value | Primary UI |
| --- | --- |
| employee.read | ดูข้อมูลพนักงาน |
| routine.task.read | ดูงานประจำ |
| stock.request.process | ดำเนินการคำขอเบิก |
| leave.request.approve | อนุมัติคำขอลา |
| audit.read | ดูบันทึกการใช้งานระบบ |
| OWN / CREATED / ASSIGNED / TEAM / ALL | เฉพาะของตัวเอง / รายการที่สร้าง / รายการที่รับผิดชอบ / ภายในกลุ่มนี้ / ทั้งหมด |
| DASHBOARD / LIFF_SELF_SERVICE / SYSTEM | เว็บระบบ / LINE / บริการตนเอง / ระบบ |

Catalog นี้ไม่เก็บ `supportedScopes`, `supportedChannels`, grantability,
runtime mode หรือ policy decision ข้อมูลเหล่านั้นยังมาจาก registry และ
server-owned administration model เดิมเสมอ

Type `Record<RegisteredCapabilityKey, CapabilityPresentationMetadata>` และ
test ที่เทียบกับ `CAPABILITY_REGISTRY` ทำให้ capability ใหม่ไม่สามารถปรากฏใน
primary chooser โดยไม่มี copy สำหรับผู้ดูแลระบบ

## Information architecture

หน้า `/dashboard/authorization` ใช้โครงสร้างหลัก:

1. **กลุ่มและบทบาท** — สร้างกลุ่ม ดูสมาชิก เลือกบทบาท และจัดการสิทธิ์ในบริบทเดียวกัน
2. **ผู้ใช้และสิทธิ์** — ค้นหาผู้ใช้ ดูสิทธิ์ที่ใช้งานได้ กลุ่มที่อยู่ และสิทธิ์เฉพาะบุคคล
3. **ขั้นสูง** — ข้อมูลสิทธิ์ของระบบสำหรับ IT/operator

Header อธิบายงานด้วยข้อความ `การจัดการสิทธิ์` และ
`จัดกลุ่มผู้ใช้งาน กำหนดบทบาท และเพิ่มสิทธิ์ที่จำเป็นสำหรับการทำงาน`
ไม่ใช้คำอธิบายเกี่ยวกับ server boundary เป็น primary copy

## Group and role UX

Team ถูกนำเสนอเป็น **กลุ่มผู้ใช้งาน** และ TeamRole เป็น **บทบาทในกลุ่ม**
หน้ารายละเอียดใช้สามส่วน: **รายละเอียด**, **สมาชิก**, และ **บทบาทและสิทธิ์**

ส่วนบทบาทและสิทธิ์แสดงสิทธิ์ของกลุ่มก่อน และให้เลือกบทบาทเพื่อดู/จัดการสิทธิ์
ของบทบาทนั้นในบริบทเดียวกัน ไม่ต้องสลับไปมาระหว่างแท็บที่แยกจากกันเพื่อเทียบ
แหล่งสิทธิ์

ชื่อกลุ่มและชื่อบทบาทเป็น primary fields ส่วน key อยู่ใน disclosure
**ขั้นสูง · รหัสทางเทคนิค** รหัสยังส่งผ่าน contract เดิม มี validation และ
uniqueness จาก server และไม่ถูกใช้เพื่อคำนวณ authority ไม่ทำ Department,
manager, position หรือ employee hierarchy ให้กลายเป็นกลุ่มโดยอัตโนมัติ

## Permission assignment flow

การเพิ่มสิทธิ์ใช้ flow:

1. กด **เพิ่มสิทธิ์** ในกลุ่ม บทบาท หรือสิทธิ์เฉพาะบุคคล
2. ค้นหาและเลือก action จากรายการที่จัดกลุ่มตามหมวดงาน
3. เลือกขอบเขตที่ capability/source รองรับ พร้อม label และคำอธิบาย
4. ดูหน้าตรวจสอบการเปลี่ยนแปลง
5. ยืนยันเพิ่มสิทธิ์

Chooser แสดงเฉพาะรายการที่ `administrativelyGrantable` จาก server และค้นหา
ด้วยภาษาไทย เช่น `เบิก`, `คลัง`, `ลา`, `อนุมัติ`, `พนักงาน`, `งานประจำ`
รายการ deferred หรือไม่พร้อมจัดการไม่เป็น actionable option ใน flow ปกติ

ก่อน submit primary confirmation แสดง target, action และขอบเขตที่มนุษย์อ่านได้
พร้อมแจ้งว่าหลังบันทึก server จะคำนวณสิทธิ์ที่ใช้งานได้ใหม่ Technical details
ที่ยุบอยู่จะแสดง `capabilityKey`, raw `scope` และ `source` เมื่อจำเป็น

Payload ที่ส่งยังเป็น contract เดิม:

```ts
{
  capabilityKey,
  scope,
}
```

ไม่มี client-side authorization simulator หรือ policy matrix ใหม่

## Permission removal flow

Grant list ใช้คำว่า **นำสิทธิ์ออก** พร้อม action label และ scope label เช่น
`นำสิทธิ์ "ดูงานประจำ · ทั้งหมด" ออกจากสิทธิ์ของบทบาทในกลุ่มหรือไม่?`

Confirmation แสดงแหล่งสิทธิ์ในภาษาธุรกิจ และบอกว่า **สิทธิ์พื้นฐานของระบบหรือ
สิทธิ์จากแหล่งอื่นอาจยังคงอยู่** หลังนำสิทธิ์เพิ่มเติมออก การกดยืนยันส่ง
`capabilityKey` และ `scope` เดิมให้ API และ refresh authoritative read model
หลัง mutation

## Effective access presentation

User page เริ่มด้วยคำตอบว่า “ผู้ใช้นี้ทำอะไรได้” โดยจัดแถวตามหมวดงานและใช้
action label, scope label, channel label และ state label:

- `AVAILABLE` → **ใช้งานได้**
- `UNAVAILABLE` → **ยังไม่มีสิทธิ์**
- `UNSUPPORTED` → **ช่องทางนี้ไม่รองรับ**
- `DEFERRED` → **ยังไม่เปิดให้จัดการ**

แต่ละแถวแยก **สิทธิ์พื้นฐาน**, **สิทธิ์ที่เพิ่มให้**, และ **สิทธิ์ที่ใช้งานได้**
พร้อมคำเตือน redundant เป็นภาษาคนว่า `สิทธิ์นี้ไม่ได้เพิ่มการเข้าถึง` โดยไม่
ลบ provenance หรือเปลี่ยนผลลัพธ์

## Permission source and provenance

เมื่อมี configured source จริง UI แสดง disclosure **ที่มาของสิทธิ์** และแสดง
เฉพาะ source ที่มีอยู่จริง เช่น:

- สิทธิ์ระดับผู้ดูแลระบบ
- กลุ่มผู้ใช้งาน: ชื่อกลุ่ม
- บทบาทในกลุ่ม: ชื่อบทบาท
- สิทธิ์เฉพาะบุคคล

Default policy ไม่ถูกแสดงเป็น persisted grant และไม่ถูกสร้าง origin ปลอม
Technical origin, constraint และ raw source อยู่ใน disclosure ชั้นถัดไป

## Advanced diagnostics boundary

ข้อมูลต่อไปนี้ยังคงอยู่แต่ยุบไว้หรืออยู่ในแท็บ **ขั้นสูง**:

- capability key และ raw scope/channel
- runtime mode และ administrative status
- configuration issue code และ persisted identifiers
- resolver status, reason, raw scopes และ grant origin
- system role และ technical account identifiers
- รายละเอียดของ Capability Registry ในชื่อ **ข้อมูลสิทธิ์ของระบบ**

ส่วน Advanced ติดป้ายว่า **สำหรับผู้ดูแลระบบด้านเทคนิค** และไม่ถูกทำให้เป็น
ขั้นตอนหลักของการเพิ่มหรือนำสิทธิ์ออก

## Security invariants preserved

Phase นี้ไม่เปลี่ยน:

- trusted identity, server-side ADMIN boundary หรือ authentication
- capability keys, registered scopes, channels หรือ registry
- Default Domain Policy และ additive composition
- Team/TeamRole/User origin semantics และ direct User `TEAM` restriction
- ADMIN behavior, resolver behavior หรือ domain resource/workflow predicates
- grant persistence schema, API routes หรือ mutation payload
- fail-closed handling ของ invalid configuration
- server refresh หลัง mutation

Presentation code อ่าน metadata ที่ server ส่งมา ไม่ตัดสิน grantability,
scope union, channel clamp, resource predicate, Team origin หรือ workflow rule
เอง

## Verification

Focused presentation coverage includes:

- `AuthorizationAdministrationWorkspace`
- `AuthorizationSummary`
- `AuthorizationDialogs`
- `GrantList`
- `TeamAdministration`
- `UserAccessPanel`
- `CapabilityRegistry` / Advanced system view
- presentation vocabulary metadata

The focused tests cover business-language search, grouped capabilities,
grantable-only actions, source-specific scope filtering, exact mutation payloads,
business-readable removal confirmation, post-mutation refresh, fail-closed
invalid configuration, effective states, provenance, redundant authority and
technical disclosure.

Verification completed for this phase:

- focused presentation tests: **8 files / 22 tests passed**;
- `npm run architecture:check`: passed, 1,139 repository source files checked;
- `npm run lint:strict`: passed;
- `npm run typecheck`: passed;
- `npm run test:run`: passed, **324 files / 2,963 tests**;
- `npm run test:integration:mysql`: passed, **16 files / 104 tests**;
- `git diff --check`: passed.

The full suite was rerun after an isolated architecture-test run because the
first parallel full-suite attempt hit the existing 30-second timeout in the
Routine browser-graph architecture test; the final full-suite run passed
without test failures. These checks are repository verification only and must
not be interpreted as production deployment or Phase 12G-B work.
