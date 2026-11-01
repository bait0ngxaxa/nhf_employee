# ปฏิทินเลือกวันที่ลาพร้อมข้อมูลวันหยุดภาษาไทย

ขั้นตอน 1 ของ Dashboard Dialog และ LIFF Sheet ใช้ LeaveDateCalendar ผ่าน shared fields แทน native date inputs และ dialog วันหยุดเดิม ปฏิทินใช้ React DayPicker 10.0.2 พร้อม lockfile เพื่อใช้ grid, keyboard navigation และ focus management ที่มีอยู่แล้ว แสดงภาษาไทย ปี พ.ศ. และ Asia/Bangkok โดยใช้ documented custom selection (onDayClick + modifiers) ไม่ใช้ excludeDisabled

## ฟอร์มและกฎธุรกิจ

React Hook Form ใน useLeaveRequestFormModel ยังคงเป็นเจ้าของ startDate/endDate/period และข้อมูลคำขอทั้งหมด model เดิมเก็บ draft วันที่เท่านั้น ปุ่ม **ยืนยันวันที่ลา** ตรวจ evaluateLeaveSelection แล้วอัปเดตผ่าน handler/setValue เดิม ตั้ง dirty/touched และ validate หลังอัปเดตทั้งสองวัน การคำนวณระยะเวลา โควตา และเหตุผลลาย้อนหลังจึงใช้เส้นทางเดิม

- วันเดียว: เลือกวันทำงาน ยืนยัน start/end วันเดียวกัน รองรับเต็มวัน เช้า บ่าย
- หลายวัน: คลิกแรกเริ่มช่วง คลิกถัดไปจบช่วง คลิกหลังช่วงสมบูรณ์เริ่มใหม่ คลิกก่อนวันเริ่มจะเริ่มช่วงใหม่ ณ วันนั้น
- เปลี่ยนเป็นหลายวัน: ตั้งเต็มวันตามพฤติกรรมเดิมและเริ่ม draft ว่าง; กลับวันเดียว: ยกเลิก draft และใช้วันเริ่มที่ยืนยันไว้
- ยืนยันไม่ได้เมื่อช่วงไม่ครบหรือผิดกฎ; goToReview และ submit ปฏิเสธ draft ที่ต่างจาก committed แม้เรียกโดยตรงหรือส่งฟอร์มผ่าน Enter
- **ยกเลิกวันที่ที่กำลังเลือก** คืนวันที่และเดือนที่แสดงตาม committed โดยไม่แตะประเภทลา เหตุผล ไฟล์แนบ หรือโควตา กลับจากขั้นตอน 2 คืนเดือนที่ยืนยันไว้โดย remount เฉพาะ calendar และรักษาฟอร์มเดิม การเลื่อนเดือนระหว่างเลือกช่วงไม่ถูกรีเซ็ต
- เสาร์–อาทิตย์เลือกเป็นขอบช่วงไม่ได้ แต่รวมใน highlight ได้ ศุกร์–จันทร์คิดลา 2 วันตาม domain เดิม
- ไม่จำกัดวันย้อนหลังเพิ่ม ไม่อนุญาตช่วงข้ามปี และไม่เปลี่ยน server-side leave validation
- Google events เป็นข้อมูลแสดงผลเท่านั้น ไม่มีผลต่อสูตรวันลา สิทธิ์ลา การตรวจซ้อน การอนุมัติ หรือ persistence

## รายละเอียดและ accessibility

วันนี้มีขีดใต้ วันที่เลือกมีพื้นเน้นและ aria-pressed ช่วงต่อเนื่องมี highlight เสาร์–อาทิตย์มีพื้นเทาและข้อความว่าเลือกไม่ได้ ตัวบ่งชี้แยกรูปร่าง: ขีดทึบ (public holiday), วงกลมโปร่ง (observance), กรอบเส้นประ (unverified)

HolidayDetails ใช้ Radix Popover จาก radix-ui เดิม เป็น non-modal ไม่ย้าย focus เมื่อเปิด มี collision handling และขนาดตาม viewport ปิดเมื่อ Escape, คลิกภายนอก, เลือกวันอื่น หรือเปลี่ยนเดือน Escape คืน focus ไปวันที่เดิมและไม่ส่งต่อไป parent modal วาง popover นอกพื้นที่ grid โดยยึดขอบปฏิทิน เพื่อให้ยังเลือกขอบช่วงถัดไปได้ เนื้อหารับ pointer interaction และเลื่อนด้วย wheel/touch/keyboard ได้จริง มีปุ่มปิดที่คงอยู่เหนือรายการเลื่อน ประกาศรายละเอียดผ่าน aria-live รายการทั้งปีเป็น details แบบ read-only จัดกลุ่มตามเดือนและใช้ข้อมูลชุดเดียวกัน

เอกสารที่ใช้: [DayPicker custom selection](https://daypicker.dev/guides/custom-selections), [Radix Popover](https://www.radix-ui.com/primitives/docs/components/popover)

## ตรวจ feed จริง: 1 พฤศจิกายน 2569

| แหล่งข้อมูล | HTTP / Content type | ขนาด | ปี 2026 |
| --- | --- | --- | --- |
| [Google Thai ICS](https://calendar.google.com/calendar/ical/th.th%23holiday%40group.v.calendar.google.com/public/basic.ics) | 200 / text/calendar; charset=utf-8 | 153,251 bytes | 28 รายการ |
| [Google English ICS](https://calendar.google.com/calendar/ical/en.th%23holiday%40group.v.calendar.google.com/public/basic.ics) | 200 / text/calendar; charset=utf-8 | 114,785 bytes | 28 รายการ |

ทั้งสอง feed เป็น iCalendar 2.0 มี 322 VEVENT ครอบคลุม 2021–2031 วันที่และจำนวนรายการต่อวันตรงกัน ปี 2026 เริ่ม 1 มกราคมถึง 31 ธันวาคม ครบสี่ไตรมาส ผ่าน parser ของโครงการจริง ทุก DTSTART เป็น all-day date จึงไม่เลื่อน business date ตัวอย่างวันที่ตรงกัน: วันจักรี 6 เมษายน และวันปิยมหาราช 23 ตุลาคม การตรวจนี้ยืนยันความสอดคล้องระหว่างสองแหล่ง ไม่รับรองว่าครบทุกวันหยุดราชการ

ใช้ Thai feed ก่อน หาก network/timeout/parse/coverage ไม่ผ่าน ลอง English feed ซึ่งต้องผ่าน safeguards เดียวกันแยกต่างหาก ไม่ผสมข้อมูลที่ไม่ครบจากสอง feed:

- DESCRIPTION วันหยุดนักขัตฤกษ์ / Public holiday → public-holiday
- บรรทัดแรก วันสำคัญ / Observance → observance
- คำอื่น → unverified; ไม่ใช้ SUMMARY หรือชื่อแปลในการจัดประเภท

เก็บ name จาก source ไว้ตามเดิม holidayDisplayName ใช้เฉพาะ exact-name mappings ที่ตรวจเทียบ เช่น Chakri Day → วันจักรี ชื่อที่ไม่รู้จักคงภาษาอังกฤษ ชื่อไทยคงต้นฉบับแม้แหล่งข้อมูลสะกดคลาดเคลื่อน ไม่มี runtime LLM และไม่รวมรายการตามชื่อที่แปลแล้ว thai-reference.ics เป็นตัวอย่างสี่รายการจาก Thai feed จริงสำหรับ regression tests

## API, cache และ failure isolation

- GET /api/leave/holidays?year=YYYY ใช้ Dashboard workforce session; /api/line/leave/holidays?year=YYYY ใช้ LIFF workforce session แยกกัน คง authentication และ feature gates เดิม
- ไม่ระบุปีใช้ปีปัจจุบัน Bangkok รับปีสี่หลักเพียงค่าเดียว ช่วงปีปัจจุบัน −2 ถึง +2 ตรวจทั้ง server/client ไม่รับ source URL จากผู้ใช้
- นอกช่วงยังเลือกวันลาได้ แต่ไม่ร้องขอ holiday API และแสดงข้อจำกัด ไม่เปลี่ยน leave eligibility
- normalized cache แยก key ตามปี อายุ 24 ชั่วโมง เฉพาะข้อมูลที่ตรวจผ่าน ใช้ namespace v2-th; response private, no-store
- คง timeout 8 วินาทีต่อ source, 512 KiB, redirect:error, strict UTF-8, 2,000 source/normalized records และ 10,000 occurrences/expanded days
- คง coverage guard: ต้องมี occurrence เริ่มในทุกไตรมาสของปีเป้าหมาย วันจาก duration เดียวไม่เติม coverage ไตรมาสอื่น คิดหลัง exceptions/cancellations และยังแสดงคำเตือนว่าอาจไม่ครบ
- ข้อมูลล้มเหลว/ไม่ครบ/ปีไม่ตรง: ซ่อน indicators และ annual list แสดงคำเตือนพร้อม **ลองใหม่** ปฏิทินและการยืนยันวันที่ทำงานในเครื่องโดยไม่รอ Google

## การตรวจสอบ

Focused tests ครอบคลุม model, ฟอร์มทั้งสองช่องทาง, domain, Thai/English fallback, parser/resource limits, auth routes และ year validation ใช้ข้อมูลจำลอง ไม่ส่งคำขอลาจริง

node scripts/check-leave-holiday-calendar.mjs bundle ฟอร์ม/CSS จริงด้วย mocked HTTP ไม่ต้องเปิด Next server หรือใช้ฐานข้อมูล ทดสอบ Dashboard/LIFF × 320/390/768/1280px รวมวัน/ช่วง เสาร์–อาทิตย์ popover, keyboard, focus, nested modals, overflow, กลับจาก Step 2, ค่าเดิม และ holiday failure สร้าง screenshots ใน temporary directory ที่รายงานเมื่อจบ

Chromium smoke ไม่เท่ากับการทดสอบ LINE WebView บนอุปกรณ์จริง ไม่มี deployment หรือการส่ง Leave Request อัตโนมัติ

## ผลตรวจส่งมอบฟีเจอร์เดิม (ก่อนแก้ findings P2/P3)

- npm run typecheck: ผ่าน
- npm run lint: ผ่าน ไม่มี warning
- npm run architecture:check: ผ่าน ตรวจ 1,379 source files ไม่พบการละเมิด boundary
- Focused calendar/form-model/domain regression run ล่าสุด: 108 เคสผ่าน; ชุด parser, localization, auth/year API และฟอร์มเดิมผ่านใน focused runs แยกกัน
- Chromium smoke: ผ่าน 8 ชุด (Dashboard/LIFF × 320/390/768/1280px) รวม parent-modal clipping assertions, Tab containment, Escape/focus, ช่วงศุกร์–จันทร์, Step 2 round trip และ API failure isolation
- ตรวจภาพยืนยัน: ข้อบกพร่อง popover ถูกตัดแก้แล้วในขนาดที่พบปัญหาและ 320px ทั้งสองช่องทาง
- npm test เต็ม repository: **4,231 ผ่าน, 4 timeout, 1 skipped** จาก 413 test files (410 ผ่าน, 3 ไม่ผ่าน) จึงไม่ถือว่าชุดเต็มเป็นสีเขียว
- รันแยกหลังชุดเต็ม: calendar Friday–Monday ทั้ง Dashboard/LIFF ผ่าน (3.1s / 2.4s); summary parity ผ่าน (2.8s) เทียบกับ timeout 5s ระหว่างชุดเต็ม
- architecture test ชื่อ “allows the current Routine browser graph” เรียก checker ทั้ง repository และยัง timeout 30s เมื่อรันแยก (34.5s) แม้ architecture:check ผ่าน ไม่ได้แก้ checker หรือเพิ่ม timeout เพื่อทำให้ผลเขียว และยังไม่ยืนยันว่า timeout นี้มีอยู่ใน base commit
- ไม่รัน production build เพราะไม่มี framework/config/routing convention change; ไม่ทดสอบ LINE WebView บนอุปกรณ์จริง ไม่มีการส่งคำขอลาจริงหรือ deployment

## ไฟล์ที่เปลี่ยน

29 ไฟล์ รวมไฟล์ที่นำออก:

- UI: modules/leave/presentation/LeaveDateCalendar.tsx, HolidayDetails.tsx, holiday-display.ts, useHolidayReference.ts, holiday-reference-client.ts
- Shared form: modules/leave/presentation/dashboard/components/LeaveRequestFormFields.tsx, dashboard/hooks/useLeaveRequestFormModel.ts
- Source/API: modules/leave/infrastructure/holidays/google-holiday-reference.ts, application/queries/holiday-reference.ts, schemas/holiday-reference.ts, server/holiday-reference-api.ts, app/api/leave/holidays/route.ts, app/api/line/leave/holidays/route.ts
- Tests/fixtures: modules/leave/presentation/LeaveDateCalendar.test.tsx, holiday-display.test.ts, LeaveRequestSummary.test.tsx, dashboard/LeaveRequestForm.test.tsx, dashboard/hooks/leave-date-draft.test.ts; modules/leave/infrastructure/holidays/google-holiday-reference.test.ts และ fixtures/thai-reference.ics; modules/leave/server/holiday-reference-api.test.ts; __tests__/api/leave-holiday-routes.test.ts; __tests__/helpers/leave-calendar.ts
- Browser/dependency/docs: scripts/check-leave-holiday-calendar.mjs, package.json, package-lock.json, docs/features/leave-holiday-reference.md
- นำออก: modules/leave/presentation/HolidayReferenceViewer.tsx และ HolidayReferenceViewer.test.tsx โดยย้ายความรับผิดชอบและ regression coverage ไปยัง primary calendar

## Regression ของ findings P2/P3

- Dirty tracking ใช้ hasPendingDates แทน draft exists การคลิกวันเดิมไม่ทำให้ต้องยืนยันการทิ้งข้อมูล แต่การแก้ฟอร์มจริงและไฟล์แนบยังคงทำให้ dirty
- Browser fixture เพิ่ม 24 events ในวันเดียวกัน ใช้ mouse wheel และ touchStart/touchMove/touchEnd จริงใน Chromium ยืนยัน scrollTop เปลี่ยนและเลื่อนไปจนรายการสุดท้ายอยู่ในกรอบที่มองเห็น ไม่ใช้การกำหนด scrollTop เพื่อทำให้เทสต์ผ่าน
- ตรวจว่า popover ไม่ทับ grid และยังคลิกปลายช่วงหลังเลือกวันหยุดเป็นวันเริ่มได้ โดย parent Dialog/Sheet ไม่ปิด
- ทดสอบทั้ง Dashboard/LIFF ที่ 320, 390, 768 และ 1280px พร้อมภาพรายการยาวและสถานะเลือกช่วง

ผลตรวจรอบแก้ findings: calendar/form integration 34 เคสและ form model 44 เคสผ่าน รวม 78 เคส; Chromium wheel/touch smoke ผ่านทั้ง 8 ชุด พร้อมภาพรายการยาวและการตรวจ grid ไม่ถูกบัง; typecheck, lint และ architecture:check ผ่าน ไม่มีการเปลี่ยน domain/schema/authentication หรือกฎโควตา

ช่วงรัน focused tests พร้อม browser เคยพบ timeout ใน UI tests จึงแยกรันจนผ่าน โดยไม่เพิ่ม timeout หรือลด assertions ไม่รัน full repository suite ซ้ำสำหรับการแก้ UI/form-state เฉพาะจุดนี้ ผล full suite ก่อนหน้ายังบันทึกแยกไว้ข้างต้น การจำลอง touch ใน Chromium ไม่ใช่การตรวจ LINE WebView บนอุปกรณ์จริง
