# NHFapp LINE / LIFF และ Routine Launch Runbook

เอกสารนี้ใช้สำหรับเปิดใช้งาน LINE / LIFF กลางของ NHFapp และ Routine ใน environment จริง หลังจาก deploy แอปพลิเคชันและตรวจสอบ LIFF แล้ว

## Architecture

```text
NHF Official Account
        ↓
Rich Menu: งานของฉัน
        ↓
https://liff.line.me/{LIFF_ID}/routine
        ↓
NHFapp LIFF authentication / account link
        ↓
HttpOnly LIFF session
        ↓
My Routine APIs
        ↓
existing Routine services
```

Reminder ใช้ scheduler และ outbox เดิมของ Routine แล้ว fan-out เป็น in-app, email และ LINE push แยก delivery กัน

## Required LINE resources

```text
LINE Provider
├── Messaging API channel (NHFapp OA)
└── LINE Login channel
     └── NHFapp LIFF app
```

LINE Login channel และ Messaging API channel ต้องอยู่ภายใต้ Provider ที่ถูกต้องตามที่ LIFF ใช้งาน

## Environment variables

ตั้งค่าใน production โดยไม่ใส่ secret ใน `NEXT_PUBLIC_*`:

```env
NEXT_PUBLIC_LINE_LIFF_ID="<production-liff-id>"
LINE_LOGIN_CHANNEL_ID="<line-login-channel-id>"
LINE_APP_CHANNEL_ACCESS_TOKEN="<nhfapp-messaging-api-token>"
LINE_APP_CHANNEL_SECRET="<nhfapp-messaging-api-secret>"
LINE_LIFF_SESSION_SECRET="<long-random-server-secret>"
LINE_LIFF_SESSION_TTL_SECONDS="3600"
NEXT_PUBLIC_FEATURE_ROUTINE="true"
```

ตรวจให้แน่ใจว่า:

- LIFF ID เป็นของ production LIFF และชี้ไปยัง production LIFF Endpoint URL
- Login Channel ID เป็น channel เดียวกับที่ใช้สร้าง LIFF app
- Messaging API access token เป็นของ NHFapp Official Account สำหรับ targeted employee delivery และไม่ใช้ token ของ IT/Stock
- `LINE_LIFF_SESSION_SECRET` ยาวและสุ่มเพียงพอ
- Routine feature เปิดอยู่ก่อนจะเปิด Rich Menu ให้ผู้ใช้

LIFF Endpoint URL ที่ตั้งใน LINE Developers Console ต้องตรงกับ URL ที่ deploy จริง เช่น:

```text
https://<production-domain>/liff
```

ค่าที่ถูกต้องคือ `/liff` เพียงค่าเดียว บริการ Routine ใช้ LIFF deep link
`https://liff.line.me/{LIFF_ID}/routine` ซึ่งเปิด `/liff/routine` ภายใต้ Endpoint เดียวกัน

ชื่อ environment เดิมยังรองรับชั่วคราวโดย config กลาง และค่าชื่อใหม่มีลำดับความสำคัญสูงกว่า:

```text
NEXT_PUBLIC_LINE_ROUTINE_LIFF_ID     → NEXT_PUBLIC_LINE_LIFF_ID
LINE_ROUTINE_LOGIN_CHANNEL_ID        → LINE_LOGIN_CHANNEL_ID
LINE_ROUTINE_CHANNEL_ACCESS_TOKEN    → LINE_APP_CHANNEL_ACCESS_TOKEN
LINE_ROUTINE_CHANNEL_SECRET          → LINE_APP_CHANNEL_SECRET
```

## Rich Menu asset and definition

Asset อยู่ที่:

```text
assets/line/routine-rich-menu.png
```

คุณสมบัติของ MVP:

- PNG ขนาด 2500×843 pixels
- พื้นที่กดหนึ่งพื้นที่ ครอบคลุมทั้งภาพ
- URI action เปิด `https://liff.line.me/{LIFF_ID}/routine`
- ไม่มีข้อมูลพนักงาน, LINE user ID, NHF user ID หรือ secret ในภาพ/definition

หากแก้ไข artwork ให้สร้าง asset ใหม่ด้วยคำสั่ง:

```bash
npm run line:richmenu:asset
```

LINE ไม่อนุญาตให้แทนที่ภาพของ Rich Menu เดิม ให้สร้าง Rich Menu object ใหม่แล้ว set เป็น default แทน

## Provisioning

ตรวจ local configuration และ image โดยไม่เรียก LINE API:

```bash
npm run line:richmenu:provision
```

เมื่อ deploy และทดสอบ LIFF สำเร็จแล้ว จึงค่อยสร้างและเปิดใช้งาน Rich Menu จริง:

```bash
npm run line:richmenu:provision -- --apply
```

ลำดับเมื่อใช้ `--apply` คือ:

```text
validate definition
      ↓
create Rich Menu
      ↓
upload PNG
      ↓
set as Messaging API default
      ↓
read current default and verify ID
```

หาก upload ล้มเหลว script จะแสดง `richMenuId` ที่สร้างแล้วและจะไม่ set เป็น default โดยอัตโนมัติ ไม่ลบ object ให้เอง เพื่อรักษาความสามารถในการตรวจสอบ/cleanup ภายหลัง

## Status

ตรวจ configuration และ default Rich Menu ปัจจุบัน:

```bash
npm run line:richmenu:status
```

คำสั่งนี้แสดงเฉพาะสถานะและ ID ไม่แสดง access token, secret หรือ Authorization header หาก default ถูกจัดการจาก LINE Official Account Manager หรือมี per-user Rich Menu อยู่ ผู้ใช้อาจไม่เห็น Messaging API default ตามลำดับ priority ของ LINE:

```text
per-user Messaging API menu
        > default Messaging API menu
        > default OA Manager menu
```

Rich Menu ไม่แสดงบน LINE desktop client ควรทดสอบบน smartphone และเปิด chat ใหม่หลังเปลี่ยน default

## Rollback

เก็บ `richMenuId` เดิมก่อน provisioning หากต้อง rollback:

1. ตรวจสอบ `richMenuId` เดิม
2. set menu เดิมกลับเป็น default ผ่านเครื่องมือที่ใช้สร้างเมนูนั้น หรือใช้ Messaging API ที่เหมาะสม
3. ตรวจด้วย `npm run line:richmenu:status`

ถ้าไม่มี menu เดิมและต้องการเอา Messaging API default ออก ให้ operator เรียก endpoint ทางการโดยใส่ token จาก secret manager เท่านั้น:

```bash
curl --request DELETE \
  --url https://api.line.me/v2/bot/user/all/richmenu \
  --header 'Authorization: Bearer <LINE_APP_CHANNEL_ACCESS_TOKEN>'
```

การ set default ไม่ลบ menu เดิม และการ rollback ไม่ควรลบ `LineAccountLink` หรือข้อมูล Routine

## Deployment order

```text
1. Deploy application code
2. Apply Prisma migrations if the release has any
3. Configure production environment variables
4. Restart application
5. Verify LIFF URL directly
6. Verify first-use account linking
7. Verify returning My Routine access
8. Verify a test Routine reminder
9. Provision Rich Menu with --apply LAST
10. Verify status and smartphone display
```

## Manual acceptance test

ใช้ test LINE account บน smartphone และเพิ่ม NHF Official Account เป็นเพื่อนก่อนเริ่ม:

1. ตรวจว่า Routine feature เปิดอยู่
2. เปิด LIFF โดยตรงและตรวจว่า first-use linking ทำงาน
3. เชื่อม Employee A กับ LINE Account A
4. เปิด OA chat และตรวจว่า Rich Menu แสดง `งานของฉัน`
5. แตะ `งานของฉัน` และตรวจว่า My Routine เปิดโดยไม่ต้อง login NHF ซ้ำ
6. ตรวจว่า Employee A เห็นเฉพาะงานของ A
7. ทดสอบ `taskId` ของ Employee อื่น และตรวจว่าไม่แสดงข้อมูล
8. สร้าง/รัน reminder ที่ทดสอบได้
9. ตรวจ in-app, email และ LINE push ของ Employee A
10. แตะ `เปิดดูงาน` และตรวจว่า LIFF แสดงงานที่ถูกต้องแบบ authorized focus
11. ทดสอบ Employee C ที่ยังไม่ link: in-app/email ต้องทำงาน และ LINE ต้องถูก skip อย่างปลอดภัย
12. ทดสอบ Admin ที่ link แล้ว: LIFF ต้องยังแสดงเฉพาะงานที่ assign ให้ Admin

## Troubleshooting

### Rich Menu ไม่แสดง

ตรวจว่า:

- ผู้ใช้เพิ่ม OA เป็นเพื่อนแล้ว
- image upload สำเร็จและมี default Messaging API menu
- ไม่มี per-user Rich Menu override ผู้ใช้ทดสอบ
- เปิด chat ใหม่บน smartphone ไม่ใช่ LINE desktop

### Rich Menu เปิดผิด environment

ตรวจ `NEXT_PUBLIC_LINE_LIFF_ID`, LIFF Endpoint URL `/liff` และการแยก channel ระหว่าง staging/production

### LIFF เปิดแต่เชื่อมบัญชีไม่ได้

ตรวจ Login Channel ID, ID token verification, NHF session และ `LineAccountLink` โดยไม่ส่ง token ลง log

### LINE push ไม่ถึงผู้ใช้

ตรวจว่า:

- ผู้ใช้เพิ่ม OA เป็นเพื่อนและไม่ได้ block
- `LineAccountLink` ยังมีอยู่
- Routine LINE outbox ถูกสร้างและ processor ทำงาน
- ใช้ `LINE_APP_CHANNEL_ACCESS_TOKEN`
- provider response และ outbox status ไม่เป็น `DEAD`

การที่ LINE API ตอบรับไม่ได้รับประกันว่าผู้ใช้เห็นข้อความ หากผู้ใช้ยังไม่ได้เป็นเพื่อนกับ OA

## Official references

- [Use rich menus](https://developers.line.biz/en/docs/messaging-api/using-rich-menus/)
- [Messaging API reference](https://developers.line.biz/en/reference/messaging-api/nojs/)
- [LIFF API reference](https://developers.line.biz/en/reference/liff/)
