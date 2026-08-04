# NHF Routine Phase 3: Excel migration

เอกสารนี้อธิบาย one-time migration pipeline สำหรับไฟล์ `NHF Routine list_cost_update270625.xls` โดย default เป็น preview และไม่เขียนฐานข้อมูล การเขียนข้อมูลต้องใช้ `--apply` พร้อม manifest ที่ผ่านการตรวจแล้วเท่านั้น

## ช่องทางหลักใน Phase 3

การนำเข้าผ่านหน้าเว็บเป็นช่องทางหลัก: Admin เปิด `NHF Routine` → `นำเข้าจาก Excel` ระบบจะรับไฟล์, สร้าง staging batch, แสดง preview และต้องยืนยันก่อน apply เฉพาะชีต `มสช.` เท่านั้น ชุด API อยู่ที่ `/api/routines/imports/*` และตรวจสิทธิ์ Admin ฝั่ง server ทุก endpoint

สคริปต์ด้านล่างเป็น legacy pipeline สำหรับงานตรวจสอบ/กู้คืนแบบ one-time เท่านั้น ไม่ใช่ช่องทางหลักของ UI และไม่ถูกใช้โดยปุ่มอัปโหลด

## โครงสร้าง workbook ที่ตรวจพบ

ตรวจไฟล์จริงเมื่อวันที่ 3 สิงหาคม 2569:

| Sheet | Range | Candidate rows | Merged regions | Formula/date-serial ในข้อมูล |
| --- | --- | ---: | ---: | --- |
| มสช. | A1:AF86 | 67 | 25 | ไม่พบ |
| ม.สคส. | A1:Q28 | 16 | 6 | ไม่พบ |
| มสส. | A1:Q32 | 20 | 6 | ไม่พบ |
| มส.ผส. | A1:Q26 | 15 | 5 | ไม่พบ |

ทุก sheet มีหัวตารางผู้รับผิดชอบ/รายการ/กำหนดชำระ/กำหนดสัญญา โดยบาง sheet มีแถว `รอบวางบิล` ต่อเนื่อง มี category rows, blank rows, footer rows และ blank owner ที่ต้องสืบทอดภายใน category เดียวกัน ตัว parser เก็บ merged regions, header rows, blank rows, repeated headers, formula cells และ date-like cells ไว้ใน manifest inspection

ข้อมูลจริงมี 118 candidate rows รวมทั้งหมด การ preview ที่ไม่มี owner mapping จะกัน row ที่มีผู้รับผิดชอบไว้ ไม่สร้าง task โดยอัตโนมัติ

## Owner mapping

ต้องส่ง mapping ที่ Admin ตรวจเองเป็น JSON โดย key ต้องตรงกับข้อความ owner หลังแบ่งหลายคนด้วย `/`, `,` หรือ `และ` และ value ต้องเป็น Employee ID:

```json
{
  "ชื่อใน Excel แบบตรงตัว": 123
}
```

ระบบไม่ fuzzy match และไม่เลือก candidate ให้อัตโนมัติ หาก mapping ไม่พบ, Employee ไม่มีอยู่จริง, inactive หรือ soft-deleted row จะไม่ถูกเสนอเป็น active task

## คำสั่ง

สร้าง manifest และ preview:

```text
npm run routine:import -- --preview --file="C:\path\NHF Routine list_cost_update270625.xls" --owner-mapping="C:\path\routine-owner-mapping.json" --manifest="C:\path\routine-import-manifest.json" --report="C:\path\routine-import-report.json"
```

`--preview` เป็น optional เพราะไม่มี `--apply` ก็จะเป็น preview อยู่แล้ว `--manifest` และ `--report` เป็นไฟล์ output แบบ UTF-8; workbook ต้นฉบับไม่ถูกแก้ไข

หลัง Admin ตรวจ manifest แล้วจึง apply:

```text
npm run routine:import -- --apply --manifest="C:\path\routine-import-manifest.json" --file="C:\path\NHF Routine list_cost_update270625.xls" --admin-user-id=123 --report="C:\path\routine-import-apply.json"
```

`--file` ตอน apply เป็น optional แต่ถ้าระบุจะตรวจ SHA-256 กับ manifest ก่อนเริ่มเขียนข้อมูล `--admin-user-id` ต้องเป็น User ที่มีสิทธิ์ Admin และ active; script ไม่รับ role จาก client

## Apply safety

- `RoutineImportLedger` unique ต่อ `sourceFileName + sourceSheet + sourceRow` และเก็บ SHA-256 ของ source row
- apply ซ้ำด้วย fingerprint เดิมจะ skip; fingerprint เปลี่ยนหรือพบ task เดิมโดยไม่มี ledger จะเป็น conflict และไม่ overwrite
- แต่ละ row ใช้ transaction เดียวกับ unit/category upsert, task, assignee snapshot, occurrence generation, audit log และ ledger
- `ACTIVE` อนุญาตเฉพาะ row ที่ schedule/owner/reference ผ่านทั้งหมดและไม่มี review reason
- `INACTIVE` สร้างเป็นข้อมูลอ้างอิงโดยไม่ generate occurrence
- `HISTORY_ONLY` เขียน ledger เป็น skipped เท่านั้น ไม่สร้าง task
- ไม่สร้าง reminder rules จาก Excel อัตโนมัติ เพราะ workbook ไม่มี policy ที่ชัดเจน
- occurrence ใช้ generation horizon ของ Phase 1 (เดือนปัจจุบันและล่วงหน้า 2 เดือน) จึงไม่สร้าง overdue ย้อนหลังจำนวนมาก

## Schedule และวันที่

รองรับเฉพาะข้อความที่ normalize ได้อย่างชัดเจน เช่น วันที่ N ของเดือน, เดือนถัดไป, สิ้นเดือน, วันที่ของทุกปี และ interval ที่มี anchor date ชัดเจน ข้อความเช่น `วันที่ 16 หรือ 23`, `เมื่อแจ้งหนี้ครบ`, `ตามความเหมาะสม` หรือ event-driven จะเป็น manual/review

ปี พ.ศ. ถูกแปลงเป็น ค.ศ. แบบ explicit เช่น 2568 → 2025 และ 2569 → 2026 ส่วน contract text ที่เป็นช่วงวันที่จะเก็บข้อความเดิมและแยกวันที่ที่ parse ได้ไว้ด้วย ถ้าไม่ครบหรือขัดแย้งจะไม่เดา

ก่อนใช้งาน production ต้อง deploy migration และ generate Prisma Client:

```text
npx prisma migrate deploy
npx prisma generate
```
