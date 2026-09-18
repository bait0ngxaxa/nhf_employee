# Phase 12G-A — Authorization Administration UX Simplification

สถานะ: **CLOSED**

Final closure-correction baseline: `14a300d03a8bd9803afcf0bce8258ae7bd08e4d4` (`fix(auth): harden user permission management UX`)

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
2. **ผู้ใช้และสิทธิ์** — ค้นหาผู้ใช้ ดูสิทธิ์ที่ใช้งานได้ จัดการสิทธิ์เฉพาะบุคคลจากการ์ดความสามารถเดียวกัน และดูกลุ่มที่อยู่
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

1. กด **เพิ่มสิทธิ์** ในกลุ่มหรือบทบาท; สำหรับผู้ใช้ให้เริ่มจาก **ปรับสิทธิ์เฉพาะบุคคล** ในการ์ดความสามารถ
2. ค้นหาและเลือก action จากรายการที่จัดกลุ่มตามหมวดงาน
3. เลือกขอบเขตที่ capability/source รองรับ พร้อม label และคำอธิบาย
4. ดูหน้าตรวจสอบการเปลี่ยนแปลง
5. ยืนยันเพิ่มสิทธิ์

Chooser แสดงเฉพาะรายการที่ `administrativelyGrantable` จาก server และค้นหา
ด้วยภาษาไทย เช่น `เบิก`, `คลัง`, `ลา`, `อนุมัติ`, `พนักงาน`, `งานประจำ`
รายการ deferred หรือไม่พร้อมจัดการไม่เป็น actionable option ใน flow ปกติ

ก่อน submit primary confirmation แสดง target, action และขอบเขตที่มนุษย์อ่านได้
พร้อมข้อความว่า `หลังบันทึก ระบบจะคำนวณสิทธิ์ที่ใช้งานได้ใหม่ และโหลดข้อมูลล่าสุดให้อัตโนมัติ` Technical details
ที่ยุบอยู่จะแสดง `capabilityKey`, raw `scope` และ `source` เมื่อจำเป็น

Payload ที่ส่งยังเป็น contract เดิม:

```ts
{
  capabilityKey,
  scope,
}
```

ไม่มี client-side authorization simulator หรือ policy matrix ใหม่

### User permission-management surface

สำหรับผู้ใช้ **สิทธิ์ที่ใช้งานได้** เป็นพื้นที่หลักทั้งสำหรับตรวจสอบและจัดการ
สิทธิ์เฉพาะบุคคล การแสดงผลจัดกลุ่มแถวตาม `capability.key` เพื่อไม่ให้ action เดิม
ซ้ำเต็มหน้า แต่ยังแสดงทุก trusted context เป็นรายการแยกภายในการ์ดโดยไม่ union
หรือคำนวณผลลัพธ์ใหม่ใน client

การ์ด capability ถูกจัดกลุ่มใต้หัวข้อหมวดงานหนึ่งครั้ง และแต่ละ capability ยังคง
มีการ์ดแยกกับ context rows ของตนเอง. การ์ดที่ administratively grantable เริ่มต้น
ด้วย editor แบบ collapsed จึงไม่แสดง radio หรือ mutation controls จนกว่าผู้ดูแลจะกด
**ปรับสิทธิ์เฉพาะบุคคล**. สถานะสรุปที่ยุบอยู่ใช้ `user.directGrants` ที่ match
ด้วย `capabilityKey` และนับเฉพาะรายการ `VALID` พร้อมแสดงจำนวนและชื่อขอบเขตที่อ่านได้;
ถ้าไม่มีรายการที่ใช้ได้จะแสดง **ยังไม่มีสิทธิ์เฉพาะบุคคล**. รายการ invalid ไม่ถูก
นำเสนอเป็น access และหลักฐาน raw อยู่ใน **รายละเอียดทางเทคนิค · หลักฐานจากระบบสิทธิ์**
เท่านั้น.

เมื่อเปิด editor จะยังอยู่ใน capability card เดิมและแสดง context ที่ใช้งานได้,
direct User scopes ที่บันทึกไว้, ขอบเขตที่เพิ่มได้จากข้อมูล authoritative โดยตัด
`TEAM` สำหรับแหล่ง User และไม่เสนอคู่ `(capabilityKey, scope)` ซ้ำ. ปุ่ม **ปิดการแก้ไข**
ยุบ editor กลับเป็น summary. การนำออกใช้การยืนยันแบบ destructive พร้อมเตือนว่าสิทธิ์
พื้นฐานหรือสิทธิ์จากกลุ่ม/บทบาทอาจยังคงทำให้เข้าถึงรายการได้ การเปลี่ยนแปลงทุกครั้ง
เรียก API เดิมและโหลด User read model ล่าสุดหลัง mutation โดยคง editor ไว้เปิดเพื่อเห็น
สถานะ authoritative ที่ refresh แล้ว ไม่มี GrantList แยกขนาดใหญ่ท้ายหน้า

ถ้า `resolverEffectivePermissionStatus` หรือ `effectiveAccessStatus` เป็น
`INVALID_CONFIGURATION`, พื้นที่จัดการสิทธิ์ของ User จะเป็น read-only/fail-closed:
ไม่แสดง **เพิ่มสิทธิ์อื่น**, **ปรับสิทธิ์เฉพาะบุคคล**, radio เพิ่ม scope หรือปุ่ม
ยืนยัน/นำออก. Fallback chooser จึงเปิดไม่ได้จาก state นี้ และ technical evidence กับ
ข้อความ fail-closed ยังคงอยู่ใน disclosure เดิม.

ปุ่ม **เพิ่มสิทธิ์อื่น** อยู่ใกล้หัวข้อสิทธิ์สำหรับกรณีที่ต้องการเลือกความสามารถอื่น
และยังใช้ chooser กลางเดิม ส่วน Team/TeamRole ยังคงจัดการตาม source ของตนเอง

## Permission removal flow

Grant list ใช้คำว่า **นำสิทธิ์ออก** พร้อม action label และ scope label เช่น
`นำสิทธิ์ "ดูงานประจำ · ทั้งหมด" ออกจากสิทธิ์ของบทบาทในกลุ่มหรือไม่?`

Confirmation แสดงแหล่งสิทธิ์ในภาษาธุรกิจ และบอกว่า **สิทธิ์พื้นฐานของระบบหรือ
สิทธิ์จากแหล่งอื่นอาจยังคงอยู่** หลังนำสิทธิ์เพิ่มเติมออก การกดยืนยันส่ง
`capabilityKey` และ `scope` เดิมให้ API และ refresh authoritative read model
หลัง mutation

## Effective access presentation

User page เริ่มด้วยคำตอบว่า “ผู้ใช้นี้ทำอะไรได้” โดยจัดกลุ่มตามความสามารถทางธุรกิจ
ภายในหมวดงาน และใช้ action label, context label, scope label, channel label และ
state label:

- `AVAILABLE` → **ใช้งานได้**
- `UNAVAILABLE` → **ยังไม่มีสิทธิ์**
- `UNSUPPORTED` → **ช่องทางนี้ไม่รองรับ**
- `DEFERRED` → **ยังไม่เปิดให้จัดการ**

หัวข้อหมวดงานแสดงครั้งเดียวต่อ domain และการ์ดหนึ่งใบเก็บทุก context row ที่ระบบส่งมา
แยกกัน โดยแสดง **สิทธิ์พื้นฐาน**,
**สิทธิ์ที่เพิ่มให้**, และ **สิทธิ์ที่ใช้งานได้** ของแต่ละบริบท พร้อมคำเตือน redundant
เป็นภาษาคนว่า `สิทธิ์นี้ไม่ได้เพิ่มการเข้าถึง` โดยไม่ลบ provenance หรือเปลี่ยนผลลัพธ์

Context และ limitation ที่ domain ส่งมายังคงไม่ถูกแก้ไข แต่ primary UI ใช้ metadata
การนำเสนอ เช่น **การจัดการงาน**, **งานที่รับผิดชอบ**, และคำอธิบายเงื่อนไขข้อมูลที่
ผู้ดูแลอ่านได้ ส่วน context key, label เดิม, limitation code และ label เดิมอยู่ใน
**รายละเอียดทางเทคนิค**

## Permission chooser interaction hardening

Chooser กลางของ Team, TeamRole และ **เพิ่มสิทธิ์อื่น** ใช้ dialog ที่มี header คงที่,
พื้นที่เนื้อหากลางที่ scroll ได้ และ footer คงที่อยู่นอก scroll region ปุ่ม
**ยกเลิก**, **ย้อนกลับ**, **ตรวจสอบการเปลี่ยนแปลง** และ **ยืนยันเพิ่มสิทธิ์** จึงยัง
เข้าถึงได้โดยไม่ต้องเลื่อนไปท้ายรายการ บน desktop รายการความสามารถและ editor ขอบเขต
อยู่คนละคอลัมน์; บนหน้าจอแคบจะเรียงเป็นขั้นตอนแนวตั้งตามพื้นที่ที่มี

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

The focused tests cover business-language search, one-heading domain grouping,
collapsed/expanded inline User editors, compact exact direct-scope summaries,
grantable-only actions, source-specific scope filtering, exact mutation payloads,
business-readable removal confirmation, post-mutation refresh, fail-closed
invalid configuration for both inspection statuses, effective states, provenance,
redundant authority and technical disclosure. Dialog tests retain coverage for the
fixed header, scrollable middle, persistent footer, desktop split and mobile stack.

Verification completed for this phase:

- focused Phase 12G-A presentation tests: **8 files / 32 tests passed**;
- `npm run architecture:check`: passed, 1,140 repository source files checked;
- `npm run lint:strict`: passed;
- `npm run typecheck`: passed;
- `npm run test:run`: passed, **324 files / 2,973 tests**;
- `npm run test:integration:mysql`: passed, **16 files / 104 tests**;
- `git diff --check`: passed.

These results are from the final working tree after the UX hardening correction.
The checks are repository verification only and must not be interpreted as
production deployment or Phase 12G-B work.
