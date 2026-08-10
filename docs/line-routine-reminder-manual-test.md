# LINE Routine Reminder — Manual Acceptance Test

ใช้กับ staging/dev ที่มีการตั้งค่า LINE Routine Messaging API และ LIFF แล้ว

## ก่อนเริ่ม

- ตั้งค่า `LINE_ROUTINE_CHANNEL_ACCESS_TOKEN` และ `NEXT_PUBLIC_LINE_ROUTINE_LIFF_ID`
- รัน migration ล่าสุดด้วย `npx prisma migrate deploy`
- เปิด Routine feature flag
- ผู้ทดสอบเพิ่ม NHF Official Account เป็นเพื่อนใน LINE แล้ว
- ผู้ทดสอบเชื่อมบัญชี NHF กับ LINE ใน `/liff/routine` สำเร็จ

## กรณีผู้รับที่เชื่อม LINE แล้ว

1. Link Employee A กับ LINE Account A
2. สร้างหรือมอบหมาย Routine Task X ให้ Employee A
3. ตั้ง reminder rule ให้ถึงเวลาทดสอบ และใช้ recipient scope ที่รวม assignee
4. เรียก Routine scheduler ตามวิธีปกติ
5. เรียก notification outbox processor ตามวิธีปกติ
6. ตรวจสอบว่า Employee A ได้รับ in-app notification, email และ LINE push
7. กดปุ่ม `เปิดดูงาน` ใน LINE
8. ตรวจสอบว่า LIFF เปิดและนำงาน X ขึ้นด้านบน
9. ตรวจสอบว่างานที่แสดงยังเป็นเฉพาะงานของ Employee A

## กรณีผู้รับยังไม่เชื่อม LINE

1. ใช้ผู้รับอีกคนที่ไม่มี `LineAccountLink`
2. ตั้งค่า Routine reminder เดียวกัน
3. รัน scheduler และ outbox processor
4. ตรวจสอบว่า in-app และ email ยังส่งตามปกติ
5. ตรวจสอบว่าไม่มี `ROUTINE_REMINDER_LINE` child outbox สำหรับผู้รับคนนั้น

## กรณี admin-only

ทดสอบ reminder scope `ADMINS` กับ admin ที่ไม่ได้เป็น assignee และตรวจสอบว่าปุ่มเปิดงานพาไป Dashboard Routine ไม่ใช่ LIFF My Routine

หมายเหตุ: LINE API ตอบรับสำเร็จไม่ได้รับประกันว่าผู้ใช้เห็นข้อความ หากผู้ใช้บล็อก Official Account หรือยังไม่ได้เพิ่มเป็นเพื่อน
