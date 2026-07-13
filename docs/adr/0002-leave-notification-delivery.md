# ส่งอีเมลแจ้งเตือนการลาผ่าน outbox และสร้าง confirmation ในระบบทันที

เหตุการณ์แจ้งเตือนการลาที่มีอีเมลต้องถูกบันทึกลง outbox ก่อน แล้วให้ processor ส่งอีเมลและสร้าง in-app notification ให้ผู้รับหลักภายหลัง ส่วน confirmation ในระบบที่ส่งกลับถึงผู้กระทำเหตุการณ์เองให้สร้างใน transaction ของ action นั้นได้ทันที เพราะเป็นข้อมูลภายในระบบและควรเกิดพร้อมการเปลี่ยนสถานะ

เราเลือกแนวทางนี้แทนการส่งอีเมลตรงจาก route เพราะอีเมลเป็น external side effect ที่อาจล้มเหลวหรือช้าได้ จึงควร retry แยกจาก transaction ธุรกิจ ในขณะเดียวกัน confirmation ภายในระบบไม่ควรถูกรอด้วย SMTP และไม่ควรถูก retry ซ้ำจนเกิดการแจ้งเตือนซ้ำโดยไม่จำเป็น

การสร้าง in-app notification จาก processor ต้องทำแบบ idempotent ด้วย `dedupeKey` เฉพาะการลา ซึ่งประกอบจากผู้รับ ประเภทการแจ้งเตือน และคำขอลาที่อ้างอิง เพื่อไม่สร้างการแจ้งเตือนซ้ำเมื่อ outbox retry เหตุการณ์เดิม โดยไม่ล็อก notification ประเภทอื่นที่อาจมีหลายรายการต่อ reference เดียว ส่วนการกันอีเมลซ้ำแบบสมบูรณ์ถือเป็นขอบเขตที่ใหญ่กว่าและต้องมี delivery log รายช่องทางแยกต่างหาก

เหตุการณ์แจ้งเตือนการลาที่มีผู้รับ ข้อความ หรือ call-to-action ต่างกันให้ใช้ประเภทแยกตามเหตุการณ์ธุรกิจ ไม่ reuse ประเภทเดิมแบบกว้าง ๆ เพราะประเภทการแจ้งเตือนเป็นส่วนหนึ่งของตัวตนที่ใช้ dedupe และช่วยให้ handler กับ test อ่านตรงกับ flow ธุรกิจ

ประเภทเดิมของระบบลาให้คงไว้เพื่อไม่เพิ่ม migration ย้อนหลังที่ไม่จำเป็น ได้แก่ `LEAVE_ACTION`, `LEAVE_RESULT`, `LEAVE_REQUESTED`, `LEAVE_APPROVED`, และ `LEAVE_REJECTED` ส่วนเหตุการณ์ใหม่ให้เพิ่มประเภทใหม่ตาม event ธุรกิจ เช่น ยกเลิกคำขอ, แจ้งไม่ได้ใช้วันลา, และยืนยันไม่ได้ใช้วันลา

ข้อความ in-app notification ต้องเป็นสรุปสั้นที่ไม่ใส่เหตุผลการลาเต็ม เหตุผลฉุกเฉินเต็ม หรือเหตุผลพิเศษเต็ม เพราะเป็นพื้นที่ที่เห็นได้ง่ายและไม่เหมาะกับข้อมูลส่วนตัว รายละเอียดครบให้แสดงในอีเมลถึงผู้เกี่ยวข้องหลักและในหน้ารายละเอียด/หน้าทำงานของระบบแทน

เมื่อเหตุการณ์ทำให้งานค้างของผู้อนุมัติสิ้นสุด เช่น อนุมัติ, ไม่อนุมัติ, ยกเลิกคำขอ, หรือยืนยันไม่ได้ใช้วันลา ให้ mark in-app notification เดิมเป็นอ่านแล้วแทนการลบ เพื่อรักษาประวัติแต่ไม่ทำให้ตัวนับแจ้งเตือนค้างอยู่ การส่งคำขอลาใหม่ไม่ต้องสร้าง self notification ให้พนักงาน เพราะผู้ส่งเห็นผลลัพธ์ในหน้าจอและประวัติของตนเองทันที

Outbox payload ของเหตุการณ์การลาต้องเก็บ snapshot ของผู้รับหลักและข้อมูลที่ใช้แสดงผล ณ ตอนเกิดเหตุการณ์ แต่ `LEAVE_ACTION` เป็นข้อยกเว้นด้าน authorization: ก่อน dispatch ทุกครั้ง processor ต้อง lock แถว `LeaveRequest` ด้วย `FOR UPDATE`, ยืนยันว่า outbox ที่ claim ยังเป็น `PROCESSING`, อ่าน approver ปัจจุบัน และตรวจว่าทั้ง Employee และ User ยัง active และไม่ถูก soft-delete แล้ว rebuild ผู้รับจากข้อมูลปัจจุบัน โดยถือ lock จน dispatch จบเพื่อ serialize กับ transaction โอนผู้อนุมัติ ถ้า transfer commit ก่อน worker ได้ lock จะส่งให้ผู้อนุมัติใหม่ ถ้า worker ได้ lock ก่อน การส่งเดิมต้องจบก่อน transfer commit จึงไม่มีการส่งหา approver เดิมหลัง request ถูกโอนแล้ว ถ้าคำขอไม่รออนุมัติ, outbox ถูก supersede, หรือไม่มีผู้อนุมัติที่ยังมีสิทธิ์ ให้ปิด event แบบ no-op โดยไม่ส่งหา recipient ใน snapshot เก่า การเปลี่ยนผู้อนุมัติต้อง rewrite outbox ที่ยังไม่ `SENT` รวมถึงสถานะ `PROCESSING`, เลือกหนึ่ง row เป็น canonical และ mark row ซ้ำเป็น superseded หาก processor พบว่า in-app notification เดิมมีอยู่แล้วจากการ dedupe หรือ unique constraint ให้ถือว่าส่วน in-app สำเร็จแบบ no-op ไม่ทำให้ outbox failed

ผลการส่งอีเมลที่ไม่สำเร็จต้องทำให้ outbox failed และ retry แม้ email service จะคืนค่า `false` แทนการ throw error เพราะ outbox มีหน้าที่รับประกัน delivery ของช่องทางอีเมล ส่วน in-app notification ที่ถูกสร้างสำเร็จไปแล้วต้องไม่ซ้ำในรอบ retry

Delivery semantics ของ outbox คือ **at-least-once** ไม่ใช่ exactly-once เพราะ process อาจล้ม หรือ transaction ที่ถือ lock อาจ timeout หลัง provider รับอีเมลสำเร็จแต่ก่อนฐานข้อมูลถูก mark เป็น `SENT` แล้ว worker จะ retry event เดิม การสร้าง in-app notification ป้องกันซ้ำด้วย `dedupeKey` และ unique constraint ส่วนอีเมลการลาใช้ `Message-ID` คงที่ต่อ event และคำขอลาเป็น best-effort idempotency hint ที่ Nodemailer/SMTP รองรับ แต่ provider ไม่รับประกันว่าจะ deduplicate จึงห้ามอ้างว่าอีเมลส่งแบบ exactly-once
