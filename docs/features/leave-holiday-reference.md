# ปฏิทินวันหยุดอ้างอิงสำหรับ Leave

ปุ่ม **ดูปฏิทินวันหยุด** อยู่ใกล้ช่องวันที่ในขั้นตอนที่ 1 ของ Dashboard Dialog และ LIFF Sheet เปิดปฏิทินรายเดือนและรายการทั้งปีจากชุดข้อมูลเดียวกัน ปีและเดือนเริ่มต้นอิง Asia/Bangkok แสดงปี พ.ศ. ข้อมูลไม่ถูกส่งเข้าโมเดลฟอร์ม การคำนวณวันลา โควตา การตรวจวันซ้อน หรือการบันทึกคำขอ

## แหล่งข้อมูลที่ตรวจสอบ

ตรวจจาก development environment วันที่ 1 พฤศจิกายน 2569 ผ่าน Node fetch และผ่าน service ที่เพิ่มในงานนี้:

- [Google Calendar — Holidays in Thailand (ICS)](https://calendar.google.com/calendar/ical/en.th%23holiday%40group.v.calendar.google.com/public/basic.ics): HTTP 200, `text/calendar; charset=utf-8`, 114,785 bytes
- iCalendar 2.0 มี 322 VEVENT ครอบคลุมปี ค.ศ. 2021–2031 โดยปี 2026 มี 28 รายการ เริ่ม 1 มกราคม ถึง 31 ธันวาคม
- ทุก DTSTART เป็น `VALUE=DATE`; DTEND เป็นวันถัดไปแบบ exclusive; `X-WR-TIMEZONE:UTC` ไม่เปลี่ยน business date ของ all-day events
- ไม่พบ RRULE, RDATE, EXDATE, RECURRENCE-ID หรือ TZID ใน VEVENT ของ feed ที่ตรวจสอบ
- ชื่อ SUMMARY เป็นภาษาอังกฤษ แสดงตามต้นฉบับโดยไม่แปลหรือเติมวันหยุดเอง
- DESCRIPTION ระบุ `Public holiday` 22 รายการในปี 2026 และ `Observance` ตามด้วยคำแนะนำการซ่อน observances 6 รายการ ใช้ข้อความนี้จำแนกประเภท ส่วน `CLASS:PUBLIC` หมายถึงการเปิดเผยกิจกรรม ไม่ใช่ประเภทวันหยุด

ประเภทที่ไม่ตรงกับคำศัพท์ที่ตรวจสอบจะแสดงเป็น **ยังไม่ยืนยันประเภท** UI ใช้คำว่า **วันหยุดตาม Google** และ **วันสำคัญ** พร้อมแจ้งว่าบางวันอาจไม่ใช่วันหยุดราชการ ข้อมูลอาจไม่ครบถ้วน และไม่มีผลต่อสิทธิ์ลาของ NHF

## การรับข้อมูลและขอบเขต

- GET `/api/leave/holidays` ใช้ Dashboard active workforce session; GET `/api/line/leave/holidays` ใช้ LIFF workforce session ทั้งคู่ตรวจ feature flag ก่อนโหลดข้อมูล ไม่รับ URL หรือปีจากผู้เรียก และไม่ส่งข้อมูลพนักงานกลับ
- Service ใช้ URL คงที่ ไม่ติดตาม redirect จำกัดเวลา fetch รวมการอ่าน body ที่ 8 วินาที และขนาด body ที่ 512 KiB ตรวจชนิดข้อมูล UTF-8 และโครงสร้าง ICS ก่อน normalize
- ใช้ `ical.js` สำหรับ folded properties, escaped text, all-day spans และ recurrence พร้อม EXDATE/RDATE/exception รองรับ timezone จาก VTIMEZONE และ UTC; floating dates/times อิงวันที่ Bangkok โดยไม่ใช้ timezone ของเครื่อง หาก TZID ไม่มีนิยามจะไม่แสดงข้อมูลที่อาจคลาดเคลื่อน
- จำกัด VEVENT/ผลลัพธ์ 2,000 รายการและ recurrence expansion รวม 10,000 ครั้ง ไม่รับ subdaily recurrence; เมื่อเกินขอบเขตจะแสดง unavailable แทนผลลัพธ์บางส่วน
- ตรวจ raw dates ก่อน ICAL.Time เพื่อไม่ให้วันที่ผิด เช่น 30 กุมภาพันธ์ ถูกเลื่อนไปวันอื่น คงหลายรายการในวันเดียวกันและตัดเฉพาะรายการซ้ำที่มี date/name/classification เหมือนกัน
- Feed ไม่มี metadata ที่ยืนยันว่าเป็นปีว่างจริง จึงต้องมี events ในปีที่ต้องการ และช่วงวันที่จาก source ต้องคร่อม 1 มกราคม–31 ธันวาคม เป็นหลักฐานขั้นต่ำของช่วงข้อมูล ไม่ใช่หลักฐานว่าครบทุกวันหยุดราชการ ผลลัพธ์ว่าง/ช่วงข้อมูลไม่ครบส่ง HTTP 503 พร้อม `HOLIDAY_DATA_INCOMPLETE`; network/timeout/parse failure ส่ง unavailable โดยไม่เปิดเผยรายละเอียดภายใน
- Next `unstable_cache` เก็บเฉพาะผลลัพธ์ normalized ที่ตรวจผ่าน แยก key ตามปี revalidate 24 ชั่วโมง เลือก API นี้เพราะโครงการยังไม่ได้เปิด Cache Components ไม่มีการเปลี่ยน Next configuration และไม่ cache ข้อมูล session หรือ failure
- UI โหลดเมื่อเปิดเท่านั้น ใช้ SWR ร่วมกับ cache ฝั่ง server เปิดซ้ำเมื่อโหลดสำเร็จไม่เรียกซ้ำ; failure ลองใหม่ได้ การตอบกลับ HTTP เป็น `private, no-store` เพื่อคง auth boundary

## การตรวจสอบ

```sh
npm test -- modules/leave/infrastructure/holidays/google-holiday-reference.test.ts modules/leave/presentation/HolidayReferenceViewer.test.tsx modules/leave/server/holiday-reference-api.test.ts __tests__/api/leave-holiday-routes.test.ts
node scripts/check-leave-holiday-calendar.mjs
```

Automated tests ใช้ deterministic ICS fixtures และ mocked network ไม่พึ่ง Google หรือฐานข้อมูล ทดสอบ parser, timezone, recurrence, malformed/empty/incomplete data, fetch limits, auth/feature gates และฟอร์มจริงทั้งสองช่องทาง รวมการรักษาค่า ระยะเวลาลา quota preview และความถูกต้องของ Step 2 ทั้งกรณีโหลดปฏิทินสำเร็จและล้มเหลว

Browser smoke ใช้ components/CSS จริงกับ mocked HTTP ที่ 320, 390, 768, 1280px ทั้ง Dashboard และ LIFF ตรวจขอบเขต dialog, overflow, Tab focus containment, Escape/focus restoration, ค่าเดิมหลังปิด และการเปิดซ้ำ บันทึก screenshots ใน temporary directory ที่รายงานเมื่อจบ ไม่เปิด Next server หรือเชื่อมฐานข้อมูล การตรวจนี้ไม่ใช่การทดสอบ LINE WebView บนอุปกรณ์จริง
