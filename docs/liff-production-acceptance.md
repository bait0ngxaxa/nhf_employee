# Unified LIFF Production Acceptance

เอกสารนี้เป็น acceptance matrix สำหรับ human operator ของ Phase 5B ใช้คู่กับ [NHFapp Unified LINE / LIFF Production Runbook](./line-routine.md)

รายการ manual/production/smartphone ทุกแถวเริ่มเป็น `NOT RUN` ห้ามเปลี่ยนเป็น `PASS` จนกว่าจะทดสอบจริงและแนบ evidence

## 1. วิธีบันทึกผล

ใช้ผลลัพธ์ดังนี้:

| Result | ความหมาย |
| --- | --- |
| `PASS` | ทดสอบตาม scenario แล้ว expected behavior ถูกต้อง พร้อม evidence |
| `FAIL` | ทดสอบแล้วไม่ตรง expected หรือพบ defect |
| `BLOCKED` | ทดสอบต่อไม่ได้เพราะ dependency/สิทธิ์/ข้อมูลทดสอบไม่พร้อม; ต้องบันทึก blocker |
| `NOT RUN` | ยังไม่ได้ทดสอบ |
| `AUTOMATED COVERAGE` | ใช้ได้เฉพาะแถวที่อ้างอิง repository test ไม่ใช่ผลยืนยัน production หรือ smartphone |

Evidence ควรเป็น commit/log/response status/screenshot/หน้าจอ device/เวลา/ผู้ทดสอบ โดยห้ามแนบ secret, ID token, session cookie, password หรือ Authorization header

## 2. Acceptance metadata

กรอกหลัง operator เตรียม production แล้ว:

| Field | Value / Evidence |
| --- | --- |
| Production commit SHA |  |
| Deployment timestamp (timezone) |  |
| Operator |  |
| Environment / production domain |  |
| LIFF ID suffix (non-secret identifier) |  |
| LINE Provider display name/identifier (non-secret) |  |
| LINE Login Channel ID (non-secret) |  |
| NHFapp Messaging API Channel ID (non-secret) |  |
| Stock Messaging API Channel ID (non-secret, if enabled) |  |
| IT Messaging API Channel ID (non-secret, if enabled) |  |
| Previous default `richMenuId` |  |
| New `richMenuId` |  |
| Monitoring window |  |
| Final decision (`GO` / `NO-GO`) |  |

## 3. Test identities and data setup

ให้ operator จัดเตรียมหรือ map identities ที่ผ่าน policy แล้ว ห้าม seed fake production account/record อัตโนมัติ:

- [ ] Test Employee — มี Stock request, Leave history และ Routine task ที่ใช้ทดสอบได้
- [ ] Test Leave Approver — เป็น approver ตาม domain rule ของ test employee
- [ ] Test Stock Processor — มีสิทธิ์ processor ตาม role ที่ระบบใช้จริง
- [ ] Employee-linked ADMIN — มี employee profile และทดสอบว่า admin ไม่ได้ override workflow ที่ domain ไม่อนุญาต
- [ ] Inactive Employee — user/employee inactive ตามกรณีที่ต้องการตรวจ
- [ ] Unlinked LINE User — LINE identity ที่ยังไม่มี `LineAccountLink`
- [ ] Dedicated Routine task/occurrence สำหรับ reminder, email และ LINE test
- [ ] Dedicated test images บน Android และ iPhone สำหรับ Leave attachment

## 4. Release, configuration และ operational gate

| ID | Surface | Scenario | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| REL-01 | Release | Deploy artifact ตรงกับ production commit SHA ที่บันทึก | SHA ตรงกัน | `NOT RUN` |  |
| REL-02 | Database | Backup database และ `.uploads/private/leave` ก่อน migration | Backup สำเร็จและ timestamp สอดคล้องกัน | `NOT RUN` |  |
| REL-03 | Database | รัน `npx prisma migrate deploy` | migration สำเร็จ; ไม่มี Phase 5B migration ใหม่ | `NOT RUN` |  |
| REL-04 | Application | ตรวจ process/service health และ origin health check | Next.js healthy, public HTTPS ตอบตาม policy | `NOT RUN` |  |
| REL-05 | Environment | ตรวจ LIFF, Login channel, `LINE_APP` และ enabled legacy LINE token/secret, session config และ cron secrets แบบ redacted | แสดงเพียง configured/valid; ไม่มีค่า secret ออกมา | `NOT RUN` |  |
| REL-06 | Feature flags | ตรวจ Leave/Routine ที่ตั้งก่อน build | Home และ direct API/route ใช้ state เดียวกัน | `NOT RUN` |  |
| REL-07 | LINE Console | ตรวจ Provider, channel, LIFF ID, `openid`, endpoint และ HTTPS | ตรงกับ production application | `NOT RUN` |  |
| REL-08 | LINE Provider | Verify LINE Login Channel และ NHFapp Messaging API Channel Provider | ทั้งสอง channel อยู่ใต้ LINE Provider เดียวกัน; ต่าง Provider = `NO-GO` | `NOT RUN` |  |
| REL-09 | Rich Menu | รัน `npm run line:richmenu:status` | อ่าน current default/config โดยไม่ mutate | `NOT RUN` |  |
| REL-10 | Rich Menu | รัน `npm run line:richmenu:provision` | dry-run validate สำเร็จหรือบันทึก missing local config; ไม่เรียก mutation | `NOT RUN` |  |
| REL-11 | Rich Menu | ก่อน activation capture previous/new ID, timestamp, operator และ SHA | rollback evidence ครบ | `NOT RUN` |  |
| REL-12 | Rich Menu | ยืนยันว่า `provision -- --apply` ยังไม่ถูกใช้ก่อน smartphone acceptance | เมนูใหม่ยังไม่เปิดเป็น default | `NOT RUN` |  |

Provider evidence ต้องเป็น safe identifiers เท่านั้น เช่น Provider display name/identifier, LINE Login Channel ID และ NHFapp Messaging API Channel ID ห้ามใส่ channel secret, access token หรือ ID token

## 5. Scheduler และ notification outbox acceptance

| ID | Surface | Scenario | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| OPS-01 | Scheduler | `POST /api/cron/routine-scheduler` โดยไม่ตั้ง secret | HTTP `503` | `NOT RUN` |  |
| OPS-02 | Scheduler | ส่ง `x-routine-secret` ผิด | HTTP `403` | `NOT RUN` |  |
| OPS-03 | Scheduler | Routine disabled + secret ถูกต้อง | successful no-op, `success: true`, `featureEnabled: false`, counters เป็นศูนย์ | `NOT RUN` |  |
| OPS-04 | Scheduler | Routine enabled + secret ถูกต้อง | executes และคืน `success: true` เมื่อไม่มี error | `NOT RUN` |  |
| OPS-05 | Scheduler | ตรวจ response fields | มี `occurrencesCreated`, `remindersConsidered`, `outboxEnqueued`, `duplicatesSkipped`, `inactiveSkipped`, `noRecipientSkipped`, `errors` | `NOT RUN` |  |
| OPS-06 | Scheduler | ตรวจ current contract counters | มี/บันทึก `contractRemindersConsidered`, `contractOutboxEnqueued`, `contractDuplicatesSkipped`, `contractNoRecipientSkipped` | `NOT RUN` |  |
| OPS-07 | Scheduler | จำลอง/ใช้ test task ที่เกิด scheduler error ตามวิธีที่ปลอดภัย | HTTP `500`, `success: false`, `errors > 0` และไม่มี stack trace ออก client | `NOT RUN` |  |
| OPS-08 | Outbox | `POST /api/cron/notification-outbox` โดยไม่ตั้ง secret | HTTP `503` | `NOT RUN` |  |
| OPS-09 | Outbox | ส่ง `x-outbox-secret` ผิด | HTTP `403` | `NOT RUN` |  |
| OPS-10 | Outbox | ส่ง secret ถูกต้อง | เรียก `processOutbox()` และคืน `success`, `processed`, `failed` | `NOT RUN` |  |
| OPS-11 | Ownership | ตรวจ scheduler owner และ outbox owner | มี external owner เดียวต่อ job ไม่เกิด duplicate invocation | `NOT RUN` |  |
| OPS-12 | Monitoring | ตรวจ HTTP success/failure และ timeout ของทั้งสอง job | alert/record แยกกัน และ timeout สอดคล้องกับ deployment | `NOT RUN` |  |
| OPS-13 | Reminder | occurrence generated → scheduler → parent outbox → outbox worker | parent work ถูก enqueue และ worker process ได้ | `NOT RUN` |  |
| OPS-14 | Routine reminder | ตรวจ in-app delivery | notification ปรากฏในบัญชีผู้รับที่ถูกต้อง | `NOT RUN` |  |
| OPS-15 | Routine reminder | ตรวจ email เมื่อ SMTP/recipient configured | email ถึงผู้รับและลิงก์ถูกต้อง | `NOT RUN` |  |
| OPS-16 | Routine reminder | ตรวจ targeted LINE เมื่อ recipient linked และเป็นเพื่อน OA | `LINE_APP_CHANNEL_ACCESS_TOKEN` ส่ง Routine LINE push ถึง test user และเปิด deep link ถูกต้อง | `NOT RUN` |  |
| OPS-17 | Stock integration | ตรวจ existing Stock request/low-stock LINE broadcast เมื่อ workflow เปิดใช้ | ใช้ `LINE_STOCK_CHANNEL_ACCESS_TOKEN` แยกจาก `LINE_APP`; broadcast ทำงานถูกต้อง | `NOT RUN` |  |
| OPS-18 | IT integration | ตรวจ existing IT/email-request LINE notification เมื่อ workflow เปิดใช้ | ใช้ `LINE_IT_CHANNEL_ACCESS_TOKEN` แยกจาก `LINE_APP`; delivery ทำงานถูกต้อง | `NOT RUN` |  |
| OPS-19 | Leave notification | ตรวจ Leave notification ปัจจุบัน | in-app และ email ทำงาน; ไม่คาดหวัง Leave targeted LINE push | `NOT RUN` |  |
| OPS-20 | Routine reminder | recipient ไม่มี `LineAccountLink` | ช่องทางอื่นที่เปิดยังทำงาน และไม่มี Routine LINE child event สำหรับผู้รับนั้น | `NOT RUN` |  |
| OPS-21 | Outbox health | ตรวจ pending/failed/retry/DEAD เมื่อ observable | backlog ไม่โตผิดปกติ; error มี owner follow-up | `NOT RUN` |  |

## 6. Identity และ account-link acceptance

| ID | Surface | Scenario | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| ID-01 | Unlinked LINE | เปิด LIFF ด้วย LINE identity ที่ยังไม่ link | LINE identity recognized → NHF account-link flow แสดง | `NOT RUN` |  |
| ID-02 | Unlinked LINE | login NHF แล้วกดเชื่อมบัญชี | link สำเร็จ และกลับไป destination เดิม | `NOT RUN` |  |
| ID-03 | Returning user | เปิด LIFF ด้วย linked LINE user | ไม่ถาม NHF login ซ้ำ และโหลด workforce session | `NOT RUN` |  |
| ID-04 | Inactive employee | ใช้ user ที่ employee inactive | fail closed; ไม่ได้ workforce session/ข้อมูล module | `NOT RUN` |  |
| ID-05 | Disabled user | ใช้ user ที่ `isActive=false` | fail closed | `NOT RUN` |  |
| ID-06 | Deleted user | ใช้ user/employee ที่ deleted ตามกรณีที่มี | fail closed | `NOT RUN` |  |
| ID-07 | Link conflict | LINE identity ถูก link กับ NHF user อื่นแล้ว | HTTP/UI แสดง conflict และห้าม overwrite link เดิม | `NOT RUN` |  |
| ID-08 | Authorization | Employee A เปิดข้อมูลของ Employee B ผ่าน direct URL/API | ปฏิเสธหรือ concealment ตาม contract; ไม่มีข้อมูลรั่ว | `NOT RUN` |  |
| ID-09 | Admin boundary | Employee-linked ADMIN เปิด Leave approval ที่ไม่ได้รับมอบหมาย | ไม่มี magical approval override; เป็นไปตาม domain rule | `NOT RUN` |  |

## 7. LIFF session acceptance

| ID | Surface | Scenario | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| SES-01 | Normal session | linked user เปิด Home และ module ที่เปิด | request ทำงานด้วย HttpOnly LIFF session | `NOT RUN` |  |
| SES-02 | Expired GET | ทำให้ LIFF session หมดอายุ แล้วเรียก read/GET | `401` → session re-established → GET replayed ครั้งเดียว → screen recover | `NOT RUN` |  |
| SES-03 | Expired mutation | ทำให้ session หมดอายุระหว่าง Stock/Leave/Routine mutation | re-establish ได้แต่ mutation ไม่ replay อัตโนมัติ; refresh authoritative state | `NOT RUN` |  |
| SES-04 | Recovery failure | ทำให้ rebootstrap/session recovery ล้มเหลวบน deep link | reload/rebootstrap ครั้งเดียว รักษา valid internal destination และไม่ loop | `NOT RUN` |  |
| SES-05 | Provider markers | เปิด link ที่มี `liff.*`, `lineLogin`, `link` หรือ `loginReturn` หลัง bootstrap | marker ไม่ทำให้ deep-link context รั่ว/ซ้ำ และ URL ปลอดภัย | `NOT RUN` |  |

## 8. Stock smartphone acceptance

| ID | Surface | Scenario | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| STK-01 | Employee | เปิด Stock จาก Home/Rich Menu | Stock โหลดใน LIFF และ active navigation ถูกต้อง | `NOT RUN` |  |
| STK-02 | Employee | browse catalog, search และ filter | ผลลัพธ์/empty state ถูกต้อง | `NOT RUN` |  |
| STK-03 | Employee | เปิด item และเลือก variant | variant/availability แสดงถูกต้อง | `NOT RUN` |  |
| STK-04 | Employee | add to cart และแก้ quantity | cart state ถูกต้องและ quantity ไม่เกิน availability | `NOT RUN` |  |
| STK-05 | Employee | availability เปลี่ยนหลัง add cart | cart reconciliation แจ้ง/ปรับ state อย่างถูกต้องก่อน submit | `NOT RUN` |  |
| STK-06 | Employee | submit request | สร้าง request หนึ่งรายการพร้อมสถานะถูกต้อง | `NOT RUN` |  |
| STK-07 | Idempotency | กด/ส่ง logical submission ซ้ำด้วยการ retry | ไม่สร้าง duplicate request | `NOT RUN` |  |
| STK-08 | Employee | เปิด My Requests, detail และ request history | เห็นเฉพาะ request ของตัวเองและ detail ถูกต้อง | `NOT RUN` |  |
| STK-09 | Employee | cancel eligible request | confirmation, mutation และ list refresh ถูกต้อง | `NOT RUN` |  |
| STK-10 | Processor | ใช้ Test Stock Processor เปิด processing tab/queue/detail | tab, queue และ detail โหลดได้ | `NOT RUN` |  |
| STK-11 | Processor | issue request | inventory update สำเร็จและรายการ completed หายจาก queue | `NOT RUN` |  |
| STK-12 | Unauthorized | employee ปกติเรียก processing API/deep link โดยตรง | ไม่มี processor access หรือ mutation privilege | `NOT RUN` |  |

## 9. Leave smartphone acceptance

| ID | Surface | Scenario | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| LEV-01 | Employee | เปิด Leave และโหลด quota | quota/profile แสดงถูกต้อง | `NOT RUN` |  |
| LEV-02 | Employee | create leave request | form ส่งได้ด้วยข้อมูลที่ถูกต้อง | `NOT RUN` |  |
| LEV-03 | Validation | date/period, emergency และ past-date reason | validation/reason behavior ตรง domain rule | `NOT RUN` |  |
| LEV-04 | Validation | over-quota/special reason behavior | warning/requirement/decision ตรง implementation | `NOT RUN` |  |
| LEV-05 | Attachment | เลือก JPG/PNG/WEBP จาก smartphone แล้ว upload | upload, WebP retrieval และ preview ทำงาน | `NOT RUN` |  |
| LEV-06 | Attachment | file ใหญ่เกิน 8 MB หรือรวมเกิน 20 MB | reject อย่างปลอดภัย | `NOT RUN` |  |
| LEV-07 | Attachment | ส่งเกิน 3 files หรือ request body เกิน boundary | reject อย่างปลอดภัย | `NOT RUN` |  |
| LEV-08 | Employee | submit แล้ว refresh history/detail | request ปรากฏและ detail ถูกต้อง | `NOT RUN` |  |
| LEV-09 | Employee | cancel เมื่อ applicable | confirmation, mutation และ history refresh ถูกต้อง | `NOT RUN` |  |
| LEV-10 | Employee | not-taken request/confirmation เมื่อ applicable | flow และ state transition ถูกต้อง | `NOT RUN` |  |
| LEV-11 | Approver | Test Leave Approver เปิด approval tab/pending request/detail | tab แสดงเมื่อมีสิทธิ์ และรายการถูกต้อง | `NOT RUN` |  |
| LEV-12 | Approver | approve request | action สำเร็จและ pending list refresh | `NOT RUN` |  |
| LEV-13 | Approver | reject พร้อม reason | reason required/แสดงผลถูกต้อง | `NOT RUN` |  |
| LEV-14 | Approver | cancellation decision | approve/reject cancellation ตาม domain rule | `NOT RUN` |  |
| LEV-15 | Approver | not-taken confirmation | decision และ state refresh ถูกต้อง | `NOT RUN` |  |
| LEV-16 | Authorization | employee อื่นเปิด attachment ของ request ที่ไม่เกี่ยวข้อง | ปฏิเสธ/concealment และไม่เปิด storage internals | `NOT RUN` |  |
| LEV-17 | Authorization | employee-linked ADMIN ที่ไม่ใช่ approver เปิด approval mutation | ปฏิเสธตาม domain rule ไม่มี override พิเศษ | `NOT RUN` |  |

## 10. Routine smartphone acceptance

| ID | Surface | Scenario | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| ROT-01 | Read | summary เปิดและข้อมูลตรงกับ user | summary โหลดได้ | `NOT RUN` |  |
| ROT-02 | Read | timing filters | filter เปลี่ยนผลลัพธ์อย่างถูกต้อง | `NOT RUN` |  |
| ROT-03 | Read | pagination/load more | โหลดหน้าถัดไปและไม่ซ้ำ/หายผิดปกติ | `NOT RUN` |  |
| ROT-04 | Read | เปิด task detail และ occurrence assignment detail | detail ถูกต้องและ access ตรงสิทธิ์ | `NOT RUN` |  |
| ROT-05 | Read | assigned task อ่านแบบ read-only | ไม่มี control แก้ไข/ลบที่ไม่ควรมี | `NOT RUN` |  |
| ROT-06 | Create | create own Routine พร้อม schedule/reminder | บันทึกสำเร็จและไม่มี assignee picker | `NOT RUN` |  |
| ROT-07 | Create | หลัง save list/summary refresh | task/occurrence ใหม่ปรากฏถูกต้อง | `NOT RUN` |  |
| ROT-08 | Edit | creator แก้ไข task ด้วย current version | save สำเร็จและ refresh state | `NOT RUN` |  |
| ROT-09 | Conflict | ใช้ stale version ให้เกิด `409` | latest detail โหลด, draft ไม่ถูก overwrite เงียบ ๆ และผู้ใช้ต้อง reconcile เอง | `NOT RUN` |  |
| ROT-10 | Delete | confirmation แล้ว delete own task | delete สำเร็จและ list refresh | `NOT RUN` |  |
| ROT-11 | Delete | กด delete ซ้ำ/ส่ง duplicate delete | ไม่เกิด error/data transition ซ้ำที่ไม่ควรเกิด | `NOT RUN` |  |
| ROT-12 | Authorization | Employee-linked ADMIN แก้/ลบ task ของ user อื่นผ่าน LIFF | ปฏิเสธ; creator-only boundary ยังคงอยู่ | `NOT RUN` |  |

## 11. Deep-link acceptance

ทดสอบจากลิงก์ที่สร้างโดย notification หรือ Rich Menu เท่านั้น และทำซ้ำโดยเปิด module ใหม่หลังจากเคยเปิดลิงก์ก่อนหน้า เพื่อยืนยันว่า context ไม่รั่ว

| ID | Surface | Scenario | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| DL-01 | Stock | `/liff/stock?requestId=<own-id>&action=<supported-intent>` | เปิด request ของ employee และเลือก intent ที่ถูกต้อง | `NOT RUN` |  |
| DL-02 | Stock | processor เปิด `/liff/stock?requestId=<id>&action=<supported-intent>` | processor ที่มีสิทธิ์เห็น context และ action ที่อนุญาต | `NOT RUN` |  |
| DL-03 | Stock | request ของผู้อื่น, malformed ID หรือ unsupported intent | ปฏิเสธ/concealment อย่างปลอดภัย ไม่เห็นข้อมูลหรือ action เกินสิทธิ์ | `NOT RUN` |  |
| DL-04 | Stock | เปิด request ใหม่หลังเคยเปิด deep link | action/context เดิมไม่รั่วไปยัง request ใหม่ | `NOT RUN` |  |
| DL-05 | Leave | `/liff/leave?requestId=<own-id>&action=<supported-intent>` | เปิด Leave request ที่เข้าถึงได้และเลือก intent ถูกต้อง | `NOT RUN` |  |
| DL-06 | Leave | request ของผู้อื่น, malformed ID หรือ unsupported intent | ปฏิเสธ/concealment อย่างปลอดภัย | `NOT RUN` |  |
| DL-07 | Leave | เปิด request ใหม่หลังเคยเปิด deep link | action/context เดิมไม่รั่วไปยัง request ใหม่ | `NOT RUN` |  |
| DL-08 | Routine | `/liff/routine?taskId=<id>&occurrenceId=<id>` | focus task ที่ถูกต้องและ occurrence ที่ระบุ | `NOT RUN` |  |
| DL-09 | Routine | task/occurrence ที่เข้าถึงไม่ได้หรือ malformed ID | ปฏิเสธ/concealment โดยไม่เปิดข้อมูล | `NOT RUN` |  |
| DL-10 | Routine | occurrence ของ task A แล้วเปิด task B | occurrence focus ของ task A ไม่รั่วไป task B | `NOT RUN` |  |

## 12. Feature flags และ cross-module navigation

| ID | Surface | Scenario | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| FF-01 | Leave | production build ตั้ง `NEXT_PUBLIC_FEATURE_LEAVE=false` | Home แสดง unavailable, direct `/liff/leave` และ Leave API ปฏิเสธ/disabled สอดคล้องกัน | `NOT RUN` |  |
| FF-02 | Routine | production build ตั้ง `NEXT_PUBLIC_FEATURE_ROUTINE=false` | Home, direct `/liff/routine` และ Routine API disabled สอดคล้องกัน; scheduler successful no-op | `NOT RUN` |  |
| FF-03 | Stock | ตรวจ configuration ที่ไม่มี Stock flag | Stock ยัง available ตาม implementation ปัจจุบัน ไม่สร้าง assumption ว่ามี flag | `NOT RUN` |  |
| NAV-01 | Mobile LIFF | Home → Stock → Leave → Routine → Home | route, active bottom-nav state และ back/navigation behavior ถูกต้องตาม feature state | `NOT RUN` |  |
| NAV-02 | Mobile LIFF | สลับ module หลังเปิด sheet/dialog หรือมี toast | ไม่มี stuck sheet/dialog, body-scroll lock leakage หรือ stale toast จาก module เดิม | `NOT RUN` |  |
| NAV-03 | Mobile LIFF | ตรวจแต่ละ module ที่มี form/cart | ไม่มี horizontal overflow, primary action ไม่ถูกบังด้วย LINE/browser chrome | `NOT RUN` |  |

## 13. Android, iOS และ viewport acceptance

การยืนยัน device ต้องเป็นการทดสอบจริงใน LINE in-app LIFF; external browser เป็น fallback/secondary evidence และห้ามอ้างว่า PASS หากยังไม่ได้ทดสอบ

| ID | Device/browser | Scenario | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| DEV-01 | Android + LINE in-app LIFF | เรียก Home, account link, Stock, Leave, Routine | critical flows ใช้งานได้และไม่มี console-visible failure ที่ทำให้ flow หยุด | `NOT RUN` |  |
| DEV-02 | iPhone + LINE in-app LIFF | เรียก Home, account link, Stock, Leave, Routine | critical flows ใช้งานได้และ safe-area/keyboard ถูกต้อง | `NOT RUN` |  |
| DEV-03 | Android external Chrome | เปิด LIFF URL โดยตรงเป็น fallback | behavior อยู่ในขอบเขตที่รองรับ; บันทึกข้อจำกัดถ้ามี | `NOT RUN` |  |
| DEV-04 | iOS Safari | เปิด LIFF URL โดยตรงเป็น fallback | behavior อยู่ในขอบเขตที่รองรับ; บันทึกข้อจำกัดถ้ามี | `NOT RUN` |  |
| DEV-05 | Android + LINE | viewport ประมาณ 320 px และ 360 px | ไม่มี horizontal overflow, touch target หลักอย่างน้อย 44px, ไทยยาวไม่ล้น | `NOT RUN` |  |
| DEV-06 | iPhone + LINE | viewport ประมาณ 390 px และ 430 px | safe area, bottom navigation และ sheet footer ไม่ถูกบัง | `NOT RUN` |  |
| DEV-07 | Android + iPhone | keyboard, confirmation dialog, attachment picker และ long Thai text | focus/scroll/ปุ่มยืนยัน/ตัวเลือกไฟล์ทำงานได้; ไม่เกิด body-scroll lock ค้าง | `NOT RUN` |  |

## 14. Leave attachment deployment acceptance

ใช้คู่กับ [Leave attachment deployment runbook](./leave-attachments-deployment.md) และเก็บ evidence ของทั้ง storage และ authorization

| ID | Surface | Scenario | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| ATT-01 | Storage | ตรวจ `.uploads/private/leave` บน production host | persistent, writable/readable โดย process และไม่ถูก expose เป็น static directory | `NOT RUN` |  |
| ATT-02 | Upload | เลือก JPG/PNG/WEBP จาก Android และ iPhone | upload สำเร็จตาม policy และ retrieve ได้เป็น private WebP | `NOT RUN` |  |
| ATT-03 | Validation | ไฟล์เกิน 8 MB, รวมเกิน 20 MB, เกิน 3 files หรือ request เกิน 25 MB | reject ปลอดภัยและไม่ทิ้ง partial state ที่ผู้ใช้เข้าใจผิด | `NOT RUN` |  |
| ATT-04 | Validation | invalid/unsupported image หรือ image dimensions/pixels เกิน limit | reject ปลอดภัย ไม่เปิดไฟล์ให้ user | `NOT RUN` |  |
| ATT-05 | Authorization | owner/authorized approver เปิด attachment | เปิดได้ผ่าน application route ที่ตรวจสิทธิ์ | `NOT RUN` |  |
| ATT-06 | Authorization | employee อื่นเรียก attachment URL หรือพยายามเดา storage key | ปฏิเสธ/concealment และไม่เปิด filesystem path/storage internals | `NOT RUN` |  |

## 15. Rich Menu launch and rollback readiness

ห้ามทำ `--apply` ระหว่างเตรียม acceptance นี้ ให้ operator เติมผลหลังทำตาม runbook เท่านั้น

| ID | Surface | Scenario | Expected | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| RB-01 | Pre-launch | `status` แสดง current default ที่อ่านได้ | มี previous `richMenuId` ที่ deterministic; ถ้า `not-set`, `managed-elsewhere` หรือ `unavailable` ต้องหยุด | `NOT RUN` |  |
| RB-02 | Pre-launch | บันทึก previous/new ID, timestamp, operator และ deployment SHA | rollback evidence ครบก่อน mutation | `NOT RUN` |  |
| RB-03 | Dry-run | `npm run line:richmenu:set-default -- --rich-menu-id=<previous-id>` | validate target และไม่เรียก LINE mutation | `NOT RUN` |  |
| RB-04 | Rollback | ใช้ `set-default ... --apply` กับ previous ID | POST set default แล้ว GET verify ได้ ID เดิม; ไม่ลบ Rich Menu ใด ๆ | `NOT RUN` |  |
| RB-05 | Rollback failure | จำลอง provider error/verification mismatch ตามวิธีที่ปลอดภัย | error ถูกจัดประเภทและไม่มี delete/partial cleanup ที่ทำลาย previous menu | `NOT RUN` |  |
| RB-06 | Separation | เปรียบเทียบ menu rollback กับ app rollback | rollback default menu ได้โดยปล่อย app deployed; app rollback ใช้ known-good artifact ที่ compatible กับ forward schema | `NOT RUN` |  |
| RB-07 | Containment | ประเมิน Leave/Routine flag หลัง incident | ปิดเฉพาะ flag ที่มีอยู่ด้วย rebuild/redeploy เมื่อเหมาะสม; ไม่อ้างว่ามี Stock flag | `NOT RUN` |  |

อย่าลบ previous/new Rich Menu จน acceptance และ monitoring window เสร็จ และห้าม rollback database ด้วย destructive SQL เป็นขั้นตอนปกติ

## 16. Launch monitoring และ stop conditions

หลัง activation ให้เปิด monitoring window และบันทึก owner/เวลา/threshold ตาม monitoring architecture เดิม:

| Area | ต้องดู | Result | Evidence / owner |
| --- | --- | --- | --- |
| Application/LIFF | HTTP 4xx/5xx, `/liff`, `/api/line/*`, session และ account-link errors | `NOT RUN` |  |
| Stock | mutation failures, duplicate/ambiguous submissions, authorization errors | `NOT RUN` |  |
| Leave | mutation/quota/approval errors, upload/retrieve failures | `NOT RUN` |  |
| Routine | mutation errors, `409` conflicts, unauthorized deep links | `NOT RUN` |  |
| Scheduler | HTTP failures, `errors` counter, unexpected no-op | `NOT RUN` |  |
| Outbox | HTTP failures, `failed`, pending/retry backlog และ `DEAD` rows เมื่อ observable | `NOT RUN` |  |
| Delivery | `LINE_APP` Routine delivery, `LINE_STOCK` Stock broadcast, `LINE_IT` IT notification และ SMTP/email delivery failures | `NOT RUN` |  |

หยุด rolloutและพิจารณา rollback/containment ทันทีเมื่อพบ login/session ล้มเหลวสม่ำเสมอ, account link ผิดคนหรือ overwrite, authorization bypass, duplicate/data-integrity failure, scheduler สร้าง reminder ผิด, outbox backlog โตควบคุมไม่ได้ หรือ Rich Menu ใหม่พาไป broken route/critical mobile action ใช้ไม่ได้ ความผิดพลาดด้าน security/data integrity เป็น immediate stop; cosmetic defect เล็กน้อยต้องประเมินผลกระทบก่อน

## 17. Automated repository coverage

ตารางนี้เป็น evidence ของ code/tooling เท่านั้น ไม่แทน production หรือ smartphone acceptance:

| ID | Check | Expected | Result | Evidence |
| --- | --- | --- | --- | --- |
| AUTO-01 | `npm run check` | lint, strict TypeScript และ Vitest ผ่าน | `NOT RUN` |  |
| AUTO-02 | `npm run build` | production build ผ่านด้วย local/non-secret configuration หรือมี blocker ระบุชัด | `NOT RUN` |  |
| AUTO-03 | `npm run line:richmenu:provision` | dry-run ผ่าน/ระบุ missing config และไม่มี LINE mutation | `NOT RUN` |  |
| AUTO-04 | `npm run line:richmenu:status` ใน isolated/local environment | redacted status; หากไม่มี credential ให้บันทึก blocked ไม่ใช้ production token | `NOT RUN` |  |
| AUTO-05 | Rich Menu unit/operational tests | dry-run ไม่มี fetch, apply ต้อง explicit, ID validate, error redacted, verify หลัง set default และไม่มี delete | `NOT RUN` |  |

## 18. Final evidence และ GO / NO-GO

ห้าม pre-fill ผล production/manual เป็น PASS และห้ามประกาศ `GO` จาก automated checks เพียงอย่างเดียว

```text
Production commit SHA:
Deployment timestamp (timezone):
Operator:
Environment / production domain:
LIFF ID suffix (non-secret):
NHFapp Messaging API channel identifier (non-secret):
Stock Messaging API channel identifier (non-secret, if enabled):
IT Messaging API channel identifier (non-secret, if enabled):
LINE Provider display name/identifier (non-secret):
LINE Login Channel ID (non-secret):
Previous default richMenuId:
New richMenuId:
Monitoring window / owner:

Automated test result:
Build result:
Android acceptance:
iOS acceptance:
External browser fallback (optional):
Scheduler smoke:
Outbox smoke:
Stock smoke:
Leave smoke:
Routine smoke:
Deep-link smoke:
Attachment smoke:
Rollback verified:
Secret-hygiene review:

Final decision: GO / NO-GO
Decision owner:
Decision timestamp:
Notes / blockers:
```

ก่อน final decision ให้ตรวจ checklist นี้อีกครั้ง:

- [ ] deployment SHA และ migration evidence ตรงกัน
- [ ] production env/LINE Console/OA configuration ผ่านโดยไม่เปิดเผย secret
- [ ] scheduler และ outbox มี owner/ความถี่/timeout ที่บันทึกแล้วและไม่ duplicate
- [ ] identity, session recovery และ authorization boundary ผ่าน
- [ ] Stock, Leave, Routine และ deep links ผ่านบน Android + iPhone ใน LINE
- [ ] attachment storage/retrieval/limits ผ่าน
- [ ] Rich Menu status/dry-run ผ่าน และ previous default rollback target ถูกบันทึก
- [ ] new Rich Menu ถูก apply โดย human operator เท่านั้น หลัง acceptance ครบ
- [ ] monitoring owner และ stop conditions พร้อม
