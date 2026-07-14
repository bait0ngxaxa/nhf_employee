# ส่งอีเมลแจ้งเตือนการลาผ่าน outbox และสร้าง confirmation ในระบบทันที

## นโยบายผู้อนุมัติคำขอลา

ห้ามเปลี่ยนผู้อนุมัติของคำขอลาที่มีสถานะ `PENDING` เด็ดขาด พนักงานต้องยกเลิกคำขอเดิมให้สำเร็จก่อน จากนั้นผู้ดูแลระบบจึงเปลี่ยนผู้อนุมัติได้ และพนักงานต้องส่งคำขอใหม่ คำขอที่อนุมัติแล้วคง `approverId` เดิมไว้ การจัดการผู้อนุมัติทั่วไปห้ามแก้ค่า `approverId` ของคำขอเหล่านั้น

หากผู้อนุมัติเดิมของคำขอที่อนุมัติแล้วพ้นสภาพ ให้ผู้ดูแลระบบตรวจสอบและกู้คืน Employee ให้เป็น `ACTIVE`, ไม่ถูก soft-delete, มี User ที่ active และไม่ถูก soft-delete พร้อมอีเมลใช้งานได้ จากนั้นให้ผู้อนุมัติเดิมเป็นผู้ยืนยันรายการไม่ได้ใช้วันลาเดิม หากไม่สามารถกู้คืนได้ ให้ผู้ดูแลระบบดำเนินการตามขั้นตอนกู้คืนข้อมูลที่ได้รับอนุมัติและเก็บ audit เพิ่มเติม ห้ามเปลี่ยนผู้อนุมัติผ่านหน้าจอจัดการทั่วไป

การสร้างคำขอลาใหม่กับการเปลี่ยนผู้อนุมัติใช้ `Employee` row lock เดียวกัน จึงถูก serialize ตามลำดับที่ได้ lock: คำขอที่สร้างและ commit เป็น `PENDING` ก่อนจะทำให้การเปลี่ยนผู้อนุมัติได้ `409` ส่วนการเปลี่ยนผู้อนุมัติที่ commit ก่อนจะทำให้คำขอใหม่อ่าน manager และ User ล่าสุด คำขอเดิมไม่ถูกแก้ `approverId` จากการจัดการผู้อนุมัติทั่วไป

Worker ของ `LEAVE_ACTION` และการยกเลิกคำขอใช้ `LeaveRequest` row lock เดียวกัน การตรวจสถานะปัจจุบันและการสร้าง `LEAVE_REQUESTED` in-app อยู่ใน transaction เดียวกันกับ lock เมื่อ cancel commit ก่อน worker ต้อง mark outbox เป็น `SUPERSEDED` และไม่สร้าง notification หรือส่งอีเมลใหม่ เมื่อ worker commit ก่อน cancel จะ mark notification เดิม เป็นอ่านแล้วหลังเปลี่ยนคำขอเป็น `CANCELLED`

การตรวจสิทธิ์ซ้ำใน transaction เป็น fail closed: ต้อง lock แถว Employee แล้วตรวจ User ที่ active ไม่ถูก soft-delete และ Employee ที่มีสถานะ `ACTIVE` ไม่ถูก soft-delete ด้วย Prisma transaction client โดยตรง หากตรวจไม่ได้หรือ transaction client ไม่ครบ ห้าม fallback ไปตรวจเฉพาะ Employee และห้ามทำ business write ต่อ

เหตุการณ์แจ้งเตือนการลาที่มีอีเมลต้องถูกบันทึกลง outbox ก่อน แล้วให้ processor ส่งอีเมลและสร้าง in-app notification ให้ผู้รับหลักภายหลัง ส่วน confirmation ในระบบที่ส่งกลับถึงผู้กระทำเหตุการณ์เองให้สร้างใน transaction ของ action นั้นได้ทันที เพราะเป็นข้อมูลภายในระบบและควรเกิดพร้อมการเปลี่ยนสถานะ

เราเลือกแนวทางนี้แทนการส่งอีเมลตรงจาก route เพราะอีเมลเป็น external side effect ที่อาจล้มเหลวหรือช้าได้ จึงควร retry แยกจาก transaction ธุรกิจ ในขณะเดียวกัน confirmation ภายในระบบไม่ควรถูกรอด้วย SMTP และไม่ควรถูก retry ซ้ำจนเกิดการแจ้งเตือนซ้ำโดยไม่จำเป็น

การสร้าง in-app notification จาก processor ต้องทำแบบ idempotent ด้วย `dedupeKey` เฉพาะการลา ซึ่งประกอบจากผู้รับ ประเภทการแจ้งเตือน และคำขอลาที่อ้างอิง เพื่อไม่สร้างการแจ้งเตือนซ้ำเมื่อ outbox retry เหตุการณ์เดิม โดยไม่ล็อก notification ประเภทอื่นที่อาจมีหลายรายการต่อ reference เดียว ส่วนการกันอีเมลซ้ำแบบสมบูรณ์ถือเป็นขอบเขตที่ใหญ่กว่าและต้องมี delivery log รายช่องทางแยกต่างหาก

เหตุการณ์แจ้งเตือนการลาที่มีผู้รับ ข้อความ หรือ call-to-action ต่างกันให้ใช้ประเภทแยกตามเหตุการณ์ธุรกิจ ไม่ reuse ประเภทเดิมแบบกว้าง ๆ เพราะประเภทการแจ้งเตือนเป็นส่วนหนึ่งของตัวตนที่ใช้ dedupe และช่วยให้ handler กับ test อ่านตรงกับ flow ธุรกิจ

ประเภทเดิมของระบบลาให้คงไว้เพื่อไม่เพิ่ม migration ย้อนหลังที่ไม่จำเป็น ได้แก่ `LEAVE_ACTION`, `LEAVE_RESULT`, `LEAVE_REQUESTED`, `LEAVE_APPROVED`, และ `LEAVE_REJECTED` ส่วนเหตุการณ์ใหม่ให้เพิ่มประเภทใหม่ตาม event ธุรกิจ เช่น ยกเลิกคำขอ, แจ้งไม่ได้ใช้วันลา, และยืนยันไม่ได้ใช้วันลา

ข้อความ in-app notification ต้องเป็นสรุปสั้นที่ไม่ใส่เหตุผลการลาเต็ม เหตุผลฉุกเฉินเต็ม หรือเหตุผลพิเศษเต็ม เพราะเป็นพื้นที่ที่เห็นได้ง่ายและไม่เหมาะกับข้อมูลส่วนตัว รายละเอียดครบให้แสดงในอีเมลถึงผู้เกี่ยวข้องหลักและในหน้ารายละเอียด/หน้าทำงานของระบบแทน

เมื่อเหตุการณ์ทำให้งานค้างของผู้อนุมัติสิ้นสุด เช่น อนุมัติ, ไม่อนุมัติ, ยกเลิกคำขอ, หรือยืนยันไม่ได้ใช้วันลา ให้ mark in-app notification เดิมเป็นอ่านแล้วแทนการลบ เพื่อรักษาประวัติแต่ไม่ทำให้ตัวนับแจ้งเตือนค้างอยู่ การส่งคำขอลาใหม่ไม่ต้องสร้าง self notification ให้พนักงาน เพราะผู้ส่งเห็นผลลัพธ์ในหน้าจอและประวัติของตนเองทันที

Outbox payload ของเหตุการณ์การลาต้องเก็บ snapshot ของผู้รับหลักและข้อมูลที่ใช้แสดงผล ณ ตอนเกิดเหตุการณ์ สำหรับ `LEAVE_ACTION` ให้กำหนด delivery identity เป็น `leaveId:approverUserId` และคง identity ของ row หลัง worker claim แล้ว stale หรือ legacy outbox ที่ identity ไม่ตรงต้องถูกปิดเป็น `SUPERSEDED`

ก่อน dispatch `LEAVE_ACTION` ทุกครั้ง processor ต้องยืนยันว่า outbox ยังเป็น `PROCESSING`, คำขอยังรออนุมัติ, ผู้อนุมัติปัจจุบันยัง eligible และ delivery identity ตรงกับ `approverUserId` ปัจจุบัน หากไม่ตรงให้ mark row เป็น `SUPERSEDED` และไม่ส่ง snapshot เก่า การตรวจและการสร้าง `LEAVE_REQUESTED` in-app ทำใน transaction เดียวกัน แล้ว commit ก่อนเรียก SMTP หาก processor พบว่า in-app notification เดิมมีอยู่แล้วจากการ dedupe หรือ unique constraint ให้ถือว่าส่วน in-app สำเร็จแบบ no-op ไม่ทำให้ outbox failed

ผลการส่งอีเมลที่ไม่สำเร็จต้องทำให้ outbox failed และ retry แม้ email service จะคืนค่า `false` แทนการ throw error เพราะ outbox มีหน้าที่รับประกัน delivery ของช่องทางอีเมล ส่วน in-app notification ที่ถูกสร้างสำเร็จไปแล้วต้องไม่ซ้ำในรอบ retry

Delivery semantics ของ outbox คือ **at-least-once** ไม่ใช่ exactly-once เพราะ process อาจล้มหลัง provider รับอีเมลสำเร็จแต่ก่อนฐานข้อมูลถูก mark เป็น `SENT` แล้ว worker จะ retry delivery เดิม การสร้าง in-app notification ป้องกันซ้ำด้วย `dedupeKey` และ unique constraint ส่วนอีเมล `LEAVE_ACTION` ใช้ `Message-ID` คงที่จาก event, `leaveId` และ `approverUserId`: retry ผู้รับเดิมจึงใช้ค่าเดิม แต่เมื่อเปลี่ยนผู้อนุมัติจะได้ค่าใหม่ `Message-ID` เป็นเพียง best-effort idempotency hint ที่ Nodemailer/SMTP รองรับและ provider ไม่รับประกันว่าจะ deduplicate จึงห้ามอ้างว่าอีเมลส่งแบบ exactly-once
