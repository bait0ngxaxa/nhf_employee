# Leave special-reason audit data-at-rest remediation

สถานะ: **แผนที่ต้อง review — ยังไม่ได้รันกับ production และห้ามรันโดยไม่ได้รับอนุมัติ**

## ปัญหา

Commit `102846a4` (เผยแพร่บน `origin/main` แล้ว) บันทึก Audit event
`LEAVE_REQUEST_SPECIAL_REASON_UPDATE` โดยเก็บข้อความเหตุผลพิเศษดิบไว้ใน `audit_logs.details`:

```json
{ "before": { "status": "PENDING", "specialReason": "<ข้อความเดิม>" },
  "after":  { "status": "PENDING", "specialReason": "<ข้อความใหม่>" },
  "metadata": { "leaveRequestId": "…", "...": "…" } }
```

ผู้ที่มี `audit.read` ระดับ ALL ไม่จำเป็นต้องเป็นผู้ยื่นหรือผู้อนุมัติคำขอลานั้น จึงอยู่นอกขอบเขตสิทธิ์ของ Leave

## การป้องกันที่ใช้แล้วใน application (ไม่ต้องแก้ข้อมูล)

- Writer ใหม่บันทึกเพียง `hasSpecialReason`, `changedField: "specialReason"` และ `changeType: "ADDED" | "UPDATED"`
- `modules/audit/application/details-projection.ts` สร้าง details ของ action นี้ใหม่จาก allowlist ก่อนส่งออกจาก
  `getAuditLogs()` (`/api/audit-logs`) และ `getAuditEntityHistory()` record เก่าจึงไม่ถูกส่งค่า `specialReason` ออกไป
  และถ้ารูปแบบไม่ตรงที่คาดไว้ จะคืน `details: null`
- ไม่มี generic Audit export และไม่มี persistent cache ของ audit response (`react.cache` มีผลเฉพาะภายใน request)

ดังนั้นการแก้ข้อมูลเก่าจึง **ไม่จำเป็นต่อการปิดช่องทางรั่วผ่าน API** แต่ยังแนะนำให้ทำเพื่อหลัก data minimization
เพราะข้อความยังอยู่ใน database, database backup และอาจถูกอ่านผ่าน SQL โดยตรง

## ขอบเขตที่จะแก้

- ตาราง: `audit_logs`
- เงื่อนไข: `action = 'LEAVE_REQUEST_SPECIAL_REASON_UPDATE'` และ details เป็น JSON ที่มี
  `$.before.specialReason` หรือ `$.after.specialReason`
- คงไว้: `id`, `action`, `entityType`, `entityId`, `userId`, `userEmail`, `ipAddress`, `userAgent`, `createdAt`,
  `before.status`, `after.status` และ metadata อื่นทั้งหมด (ลบเฉพาะ `metadata.reason` ถ้ามี)
- ไม่ต้องใช้ schema migration

## ขั้นตอน (ต้องมีผู้ review และอนุมัติก่อน)

### 1. สำรวจโดยไม่อ่านเนื้อหา

```sql
SELECT COUNT(*) AS affected,
       SUM(JSON_VALID(details) = 0) AS invalid_json
FROM audit_logs
WHERE action = 'LEAVE_REQUEST_SPECIAL_REASON_UPDATE'
  AND details IS NOT NULL
  AND (JSON_VALID(details) = 0
       OR JSON_CONTAINS_PATH(details, 'one', '$.before.specialReason', '$.after.specialReason'));
```

ถ้า `affected = 0` ให้หยุดและบันทึกผลว่าไม่ต้องแก้ข้อมูล

### 2. Backup แบบจำกัดสิทธิ์ (สำหรับ rollback)

ทำ full database backup ตาม deployment policy ก่อน แล้วสร้าง backup เฉพาะแถว:

```sql
CREATE TABLE audit_logs_special_reason_backup_20261101 AS
SELECT id, details
FROM audit_logs
WHERE action = 'LEAVE_REQUEST_SPECIAL_REASON_UPDATE'
  AND JSON_VALID(details) = 1
  AND JSON_CONTAINS_PATH(details, 'one', '$.before.specialReason', '$.after.specialReason');
```

ตาราง backup นี้มีข้อมูลอ่อนไหว ต้องจำกัดสิทธิ์ให้เฉพาะ DBA และกำหนดวันลบ (เช่น 14 วันหลังยืนยันผล)

### 3. Rewrite ใน transaction

```sql
START TRANSACTION;

UPDATE audit_logs
SET details = JSON_SET(
        JSON_REMOVE(details, '$.before.specialReason', '$.after.specialReason', '$.metadata.reason'),
        '$.before.hasSpecialReason',
        IF(JSON_TYPE(JSON_EXTRACT(details, '$.before.specialReason')) = 'STRING'
               AND JSON_UNQUOTE(JSON_EXTRACT(details, '$.before.specialReason')) <> '',
           CAST('true' AS JSON), CAST('false' AS JSON)),
        '$.after.hasSpecialReason', CAST('true' AS JSON),
        '$.metadata.changedField', 'specialReason',
        '$.metadata.changeType',
        IF(JSON_TYPE(JSON_EXTRACT(details, '$.before.specialReason')) = 'STRING'
               AND JSON_UNQUOTE(JSON_EXTRACT(details, '$.before.specialReason')) <> '',
           'UPDATED', 'ADDED'))
WHERE id IN (SELECT id FROM audit_logs_special_reason_backup_20261101);

-- ต้องเท่ากับจำนวนแถวใน backup และต้องได้ 0 ก่อน COMMIT
SELECT COUNT(*) FROM audit_logs
WHERE action = 'LEAVE_REQUEST_SPECIAL_REASON_UPDATE'
  AND JSON_VALID(details) = 1
  AND JSON_CONTAINS_PATH(details, 'one', '$.before.specialReason', '$.after.specialReason', '$.metadata.reason');

COMMIT; -- หรือ ROLLBACK หากผลไม่ตรง
```

แถวที่ `invalid_json > 0` ไม่ถูกแก้โดยคำสั่งนี้ (API คืน `details: null` อยู่แล้ว) ให้ตัดสินใจแยกเป็นรายแถวร่วมกับผู้ดูแลข้อมูล

### 4. ยืนยันผล

- นับแถว action นี้ทั้งหมดก่อนและหลังต้องเท่ากัน (ไม่มีการลบ audit)
- `createdAt`, `userId`, `userEmail` ของแถวที่แก้ต้องตรงกับก่อนแก้
- เปิด `/dashboard/audit` กรอง action "แก้ไขเหตุผลพิเศษคำขอลา" ต้องเห็นรายการเดิมพร้อม "เหตุผลพิเศษได้รับการแก้ไข/เพิ่ม"
- ค่า `leave_requests.specialReason` ไม่ถูกแตะ

### 5. Rollback

```sql
UPDATE audit_logs a
JOIN audit_logs_special_reason_backup_20261101 b ON b.id = a.id
SET a.details = b.details;
```

หลังพ้นช่วง rollback ที่ตกลงกันแล้วให้ `DROP TABLE audit_logs_special_reason_backup_20261101;`
และบันทึกว่า database backup รอบก่อนหน้ายังมีข้อมูลเดิมตาม retention ของ backup
