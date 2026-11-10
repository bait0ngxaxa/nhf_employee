# Cloudflare Tunnel — Public Application Deployment

สถานะ: **CURRENT**

เอกสารนี้เป็นคู่มือปัจจุบันสำหรับการเผยแพร่แอปพลิเคชัน `nhf_employee` ผ่าน
Cloudflare Tunnel แบบ public application โดยใช้ public hostname เดียวสำหรับ
ทั้งแอปพลิเคชัน

## 1. ขอบเขตและสัญญาการติดตั้ง

สถาปัตยกรรมที่รองรับคือ:

```text
ผู้ใช้งานจาก Internet
        ↓ HTTPS public hostname: <PUBLIC_HOSTNAME>
Cloudflare edge
        ↓ Cloudflare Tunnel (cloudflared บนเครื่อง origin)
Next.js http://127.0.0.1:3000 (โดยตรง ไม่ผ่าน Nginx)
        ↓
MySQL และ persistent storage
```

นี่คือ topology จริงของ production ปัจจุบัน: `cloudflared` ส่ง request ตรงไปยัง
`http://127.0.0.1:3000` และ host firewall (`ufw`) ปิด inbound 80/443 จึงไม่มี
Nginx อยู่ใน request path ไฟล์ใน `deployment/nginx/` เป็น configuration สำหรับ
topology สำรอง (Tunnel → Nginx → Next.js) ที่ไม่ได้ใช้ใน production ปัจจุบัน
ดู [ภาคผนวก A](#ภาคผนวก-a-topology-สำรองผ่าน-nginx-ไม่ได้ใช้ใน-production-ปัจจุบัน)

การตั้งค่าปัจจุบันมีคุณสมบัติดังต่อไปนี้:

- public hostname เปิดให้เข้าถึง **ทุก path ของแอปพลิเคชัน** ผ่าน Tunnel
- configuration ของ Tunnel **ไม่กำหนด `path` allowlist** สำหรับเส้นทางของแอป
- มี **path denylist เฉพาะ maintenance/cron endpoint ภายใน** ซึ่งตอบ `404` จาก
  Tunnel (ดู [ส่วนที่ 6.1](#61-ปิด-maintenance-และ-cron-endpoint-จากภายนอก)) เพราะ
  endpoint เหล่านี้ถูกเรียกโดย cron บนเครื่องเดียวกันผ่าน `127.0.0.1:3000` เท่านั้น
- การควบคุมสิทธิ์ของแต่ละหน้าและ API เป็นหน้าที่ของ Next.js และ application
  authentication/authorization ไม่ใช่หน้าที่ของ path rule ใน Tunnel
- ไม่ใช้ Cloudflare Zero Trust หรือ Cloudflare Access เป็นด่านยืนยันตัวตน
- Next.js bind ที่ `127.0.0.1:3000` เท่านั้น ไม่เปิด port 3000 ออก Internet และ
  ไม่มี inbound 80/443 ที่ host firewall

การเปิด public ทุก path หมายถึง request สามารถเดินทางมาถึงแอปพลิเคชันได้ในระดับ
เครือข่าย ไม่ได้หมายความว่าทุกฟังก์ชันสามารถใช้งานได้โดยไม่ยืนยันตัวตน ระบบยัง
ต้องบังคับ Auth, role, workforce eligibility, LIFF session, signature และ
business authorization ในชั้นแอปพลิเคชันตาม route นั้น ๆ

> **ข้อกำหนดด้านความปลอดภัย (client IP):** แอปอ่าน client IP จาก header
> `CF-Connecting-IP` (`lib/network/trusted-client-ip.ts`) สำหรับ rate limit และ
> audit log ใน topology ปัจจุบันไม่มี Nginx คอย canonicalize header นี้ ค่าจึงมา
> จาก request ที่ Cloudflare edge ส่งผ่าน `cloudflared` โดยตรง ความถูกต้องของ
> trust boundary นี้จึงขึ้นกับเงื่อนไขว่า (1) port 3000 รับได้เฉพาะ loopback และ
> (2) process เดียวที่ส่ง traffic จาก Internet เข้า port 3000 คือ `cloudflared`
>
> **ผลการยืนยัน (บันทึกเมื่อ 2026-11-09):** owner ส่ง request จากภายนอกไปที่
> `https://nhfapp.org/api/auth/login` พร้อม header `CF-Connecting-IP: 1.2.3.4`
> ที่ client ใส่เอง Cloudflare ปฏิเสธที่ edge ด้วย `error code: 1000` และ request
> ไม่ถึง origin ผลนี้ตรงกับเอกสาร Cloudflare ที่ระบุว่า request ที่มี header
> `CF-Connecting-IP` เป็นสาเหตุหนึ่งของ
> [Error 1000](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1000/)
> และ [Cloudflare HTTP headers](https://developers.cloudflare.com/fundamentals/reference/http-headers/)
> ที่ระบุว่า `CF-Connecting-IP` ถูกส่งเฉพาะบน traffic จาก Cloudflare edge ไปยัง origin
>
> **ข้อสรุป:** ภายใต้ topology ปัจจุบัน client ปลอม `CF-Connecting-IP` ไม่ได้ จึง
> เชื่อถือ per-IP rate limit ได้ โดยขึ้นกับเงื่อนไขทั้งหมดต่อไปนี้:
>
> - port 3000 bind เฉพาะ loopback (`127.0.0.1`)
> - host firewall ไม่เปิด inbound 80/443
> - `cloudflared` เป็น ingress เดียวเข้า Next.js
> - ไม่มี Cloudflare Worker คั่นหน้าแอปบน zone นี้ (เอกสาร HTTP headers ระบุว่าใน
>   same-zone Worker subrequest ค่า `CF-Connecting-IP` มาจาก `x-real-ip` ซึ่ง
>   Worker script กำหนดได้)
>
> ต้องทำการยืนยันนี้ซ้ำทุกครั้งที่ topology เปลี่ยน

## 2. ค่าที่ต้องแทนที่ในคู่มือ

ตัวอย่างทั้งหมดใช้ placeholder ต่อไปนี้ ห้ามนำ placeholder ไปใช้เป็นค่าจริง:

| Placeholder | ความหมาย |
| --- | --- |
| `<PUBLIC_HOSTNAME>` | hostname สาธารณะใน Cloudflare DNS เช่น `app.example.com` |
| `<ORIGIN_SERVER_NAME>` | ใช้เฉพาะ topology สำรองผ่าน Nginx (ภาคผนวก A): ชื่อใน certificate ของ Nginx สำหรับ TLS ระหว่าง `cloudflared` กับ origin |
| `<TUNNEL_NAME>` | ชื่อ Tunnel ที่สร้างในบัญชี Cloudflare |
| `<TUNNEL_UUID>` | UUID ของ Tunnel |
| `<CREDENTIALS_FILE>` | absolute path ไปยังไฟล์ credentials ของ Tunnel บน origin server |
| `<PUBLIC_APP_URL>` | URL สาธารณะเต็มรูปแบบ เช่น `https://app.example.com` |

โดเมนที่เคยใช้ในเอกสารรุ่นก่อนเป็นข้อมูลเก่าและไม่ใช่ค่าปัจจุบันของระบบนี้

## 3. การเตรียม public hostname

1. ตรวจสอบว่า zone ขององค์กรอยู่ในบัญชี Cloudflare ที่ผู้ดูแลมีสิทธิ์จัดการ
2. สร้างหรือเลือก Tunnel สำหรับแอปพลิเคชันนี้
3. กำหนด public hostname เป็น `<PUBLIC_HOSTNAME>` และให้ชี้มายัง Tunnel
4. ไม่สร้าง Access Application, Access Policy หรือ OTP gate เพราะ deployment นี้
   ไม่ใช้ Zero Trust/Access

สำหรับ locally-managed Tunnel สามารถสร้าง DNS route ด้วยคำสั่งต่อไปนี้หลังจาก
แทนที่ placeholder แล้ว:

```bash
cloudflared tunnel route dns <TUNNEL_NAME> <PUBLIC_HOSTNAME>
```

คำสั่งนี้สร้าง DNS CNAME ของ public hostname ไปยัง Tunnel hostname ของ Cloudflare
ตามรูปแบบที่ Cloudflare รองรับ

## 4. การติดตั้ง `cloudflared`

### Linux (Ubuntu/Debian)

```bash
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-archive-keyring.gpg > /dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-archive-keyring.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update
sudo apt install cloudflared -y
```

### Windows

```powershell
winget install --id Cloudflare.cloudflared
```

## 5. การสร้าง Tunnel และ credentials

```bash
cloudflared tunnel login
cloudflared tunnel create <TUNNEL_NAME>
```

เก็บ Tunnel UUID และ credentials file ในตำแหน่งที่ผู้ใช้บริการ
`cloudflared` อ่านได้เท่านั้น ห้าม commit ไฟล์ credentials และห้ามแสดงค่า
ภายในไฟล์ใน log, issue หรือเอกสาร

## 6. Configuration สำหรับ public application ทั้งแอป

สำหรับ locally-managed Tunnel ให้สร้างไฟล์ `config.yml` ใน directory ที่
`cloudflared` รองรับ เช่น `~/.cloudflared/config.yml` บน Linux หรือ
`%USERPROFILE%\\.cloudflared\\config.yml` บน Windows:

```yaml
tunnel: <TUNNEL_UUID>
credentials-file: <CREDENTIALS_FILE>

ingress:
  # 1) ปิด maintenance/cron endpoint ภายในจาก Internet (ต้องอยู่ก่อน rule หลัก)
  - hostname: <PUBLIC_HOSTNAME>
    path: '^/api/(cron/|auth/cleanup|audit-logs/cleanup|it/attachments/cleanup|leave/attachments/cleanup)'
    service: http_status:404

  # 2) Route ทุก path ที่เหลือของ public hostname ไปยัง Next.js โดยตรง
  - hostname: <PUBLIC_HOSTNAME>
    service: http://127.0.0.1:3000

  # 3) Required final rule for hostnames that do not match the routes above
  - service: http_status:404
```

ความหมายของ configuration หลัก:

- `tunnel`: UUID ของ Tunnel ที่สร้างไว้
- `credentials-file`: path ของ credentials สำหรับให้ connector authenticate
  กับ Cloudflare; ต้องเป็น path จริงบนเครื่องที่รัน `cloudflared`
- `hostname`: public hostname เดียวที่เปิดใช้งาน; rule ที่ไม่มี `path` จะส่ง
  ทุก path ที่เหลือของ hostname นี้ไปยัง service เดียวกัน
- `service: http://127.0.0.1:3000`: Next.js production process บน loopback ของ
  เครื่องเดียวกับ `cloudflared`
- กฎ `http_status:404` ท้ายสุดเป็น catch-all สำหรับ hostname ที่ไม่ตรงกับ route
  ซึ่ง Cloudflare กำหนดให้ config ที่มี ingress rules ต้องมีเสมอ

ดูรายละเอียดจาก [Cloudflare — Configuration file (ingress rules)](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/)
และ [การสร้าง locally-managed tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/)

ห้ามเพิ่ม `path` แบบ **allowlist** (เช่น `path: /some/path/*` ที่ทำให้ path อื่น
ตกไปที่ catch-all 404) เพราะจะเปลี่ยน deployment contract จาก public ทั้งแอปเป็น
path-restricted โดยไม่ได้รับการอนุมัติให้เปลี่ยนสถาปัตยกรรม denylist ในส่วน 6.1
เป็นข้อยกเว้นเดียวที่อนุญาต

### 6.1 ปิด maintenance และ cron endpoint จากภายนอก

endpoint ต่อไปนี้ถูกเรียกโดย crontab บนเครื่องเดียวกับแอปผ่าน
`http://127.0.0.1:3000` เท่านั้น (ดู `production-deployment.md`) จึงไม่มีเหตุให้
เข้าถึงได้จาก public hostname:

| Endpoint | Header | Environment variable |
| --- | --- | --- |
| `POST /api/cron/notification-outbox` | `x-outbox-secret` | `NOTIFICATION_OUTBOX_CRON_SECRET` |
| `POST /api/cron/routine-scheduler` | `x-routine-secret` | `ROUTINE_SCHEDULER_CRON_SECRET` |
| `POST /api/auth/cleanup` | `x-cleanup-secret` | `AUTH_CLEANUP_SECRET` |
| `POST /api/audit-logs/cleanup` | `x-cleanup-secret` | `AUDIT_LOG_CLEANUP_SECRET` |
| `POST /api/it/attachments/cleanup` | `x-cleanup-secret` | `IT_ATTACHMENT_CLEANUP_SECRET` |
| `POST /api/leave/attachments/cleanup` | `x-cleanup-secret` | `LEAVE_ATTACHMENT_CLEANUP_SECRET` |

**ลำดับชั้นการป้องกัน:**

1. **ด่านหลัก — shared secret ในแอป:** ทุก endpoint เทียบ header กับ secret แบบ
   constant-time (`lib/security/shared-secret.ts`) และถือว่า secret ที่ว่างหรือ
   สั้นกว่า 32 ตัวอักษรหลัง trim เป็น "ยังไม่ได้กำหนดค่า" (ตอบ `503`) ด่านนี้ต้อง
   ถูกต้องเสมอโดยไม่ขึ้นกับ network rule
2. **ชั้นที่สอง — Tunnel ingress path rule:** rule แรกในตัวอย่างด้านบนตอบ
   `404` ก่อน request ถึงแอป ใช้ลด attack surface เท่านั้น ไม่ใช่ authorization
   boundary
3. **ชั้นเสริมที่แนะนำ — Cloudflare WAF custom rule:** สร้าง rule ที่ edge ด้วย
   action `Block` สำหรับ hostname นี้และ path เดียวกัน (เช่น expression ที่ใช้
   `http.request.uri.path` ร่วมกับ `starts_with` หรือ `matches` ตาม plan ของ zone)
   ดู [Cloudflare WAF custom rules](https://developers.cloudflare.com/waf/custom-rules/)

หลักการของ path rule ตามเอกสาร Cloudflare:

- `path` เป็น **regular expression ที่ parse ด้วย Go `regexp/syntax`** ไม่ใช่
  glob; `^` ยึดต้น path และ rule นี้จับทั้ง prefix (เช่น `/api/cron/` ทุก route)
- Cloudflare ตรวจ ingress rules **จากบนลงล่างและใช้ rule แรกที่ match** ดังนั้น
  rule denylist ต้องอยู่ **ก่อน** rule หลักของ hostname เดียวกัน มิฉะนั้นจะไม่มีผล
- path rule เทียบกับ path ของ request ตามที่ `cloudflared` เห็น จึงไม่ควรถือว่า
  ครอบคลุมทุกรูปแบบการเข้ารหัสหรือ normalize path; นี่คือเหตุผลที่ด่านหลักต้องเป็น
  secret ในแอป

ตรวจ config ก่อน restart ทุกครั้ง:

```bash
cloudflared tunnel --config <CONFIG_PATH> ingress validate

# ทุก endpoint ในตารางต้อง match rule แรก (Matched rule #0, service: http_status:404)
for p in /api/cron/notification-outbox /api/cron/routine-scheduler /api/auth/cleanup \
         /api/audit-logs/cleanup /api/it/attachments/cleanup /api/leave/attachments/cleanup; do
  cloudflared tunnel --config <CONFIG_PATH> ingress rule "https://<PUBLIC_HOSTNAME>$p"
done

# path ปกติต้อง match rule หลัก (Matched rule #1, service: http://127.0.0.1:3000)
cloudflared tunnel --config <CONFIG_PATH> ingress rule https://<PUBLIC_HOSTNAME>/dashboard
cloudflared tunnel --config <CONFIG_PATH> ingress rule https://<PUBLIC_HOSTNAME>/api/line/webhook
```

`ingress rule <url>` แสดง rule แรกที่ match กับ URL นั้น โดยนับลำดับจาก `#0`
หากผลของ endpoint ในตารางไม่ใช่ `service: http_status:404` ห้าม restart
`cloudflared` จนกว่าจะแก้ลำดับ rule

> ตัวอย่างนี้ตรวจกับ `cloudflared 2026.9.3` แล้ว: `ingress validate` ตอบ `OK`,
> ทั้ง 6 endpoint (รวม query string เช่น `?dryRun=true`) match rule `#0` และ
> `/dashboard`, `/api/line/webhook`, `/api/auth/login`, `/api/it/attachments/<id>`
> match rule `#1` regex นี้ match เฉพาะ 6 route ข้างต้นใน `app/api` ณ ตอนนี้
> หากเพิ่ม route ใหม่ที่ขึ้นต้นด้วย prefix เหล่านี้ ต้องทบทวน rule ใหม่

หลังแก้ config ของ service ที่ติดตั้งแล้ว (Linux ใช้ `/etc/cloudflared/config.yml`
เมื่อติดตั้งด้วย `cloudflared service install`) ให้ validate แล้ว restart:

```bash
sudo cloudflared tunnel --config /etc/cloudflared/config.yml ingress validate
sudo systemctl restart cloudflared
sudo systemctl status cloudflared --no-pager
```

## 7. การตรวจสอบ configuration และการรัน Tunnel

แทนที่ `<CONFIG_PATH>` และ `<TUNNEL_NAME>` ด้วยค่าจริงก่อนรัน:

```bash
cloudflared tunnel --config <CONFIG_PATH> ingress validate
cloudflared tunnel --config <CONFIG_PATH> run <TUNNEL_NAME>
```

เมื่อตรวจสอบ foreground สำเร็จแล้ว ให้ติดตั้งเป็น service ตามระบบปฏิบัติการ
และใช้ supervisor เพียงหนึ่ง instance ของ Next.js ตาม contract ของ repository:

```bash
# Linux
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

```powershell
# Windows (run in an elevated PowerShell)
cloudflared service install
```

ตรวจสอบสถานะ connector, error log และ public hostname หลังติดตั้ง service แล้ว
โดยไม่เปิดเผย tunnel token หรือ credentials

## 8. Environment variable ของแอปพลิเคชัน

ตั้ง public URL ที่แอปใช้สร้างลิงก์ approval/notification ให้เป็น hostname เดียว
กับ public Tunnel:

```dotenv
PUBLIC_APPROVE_URL="<PUBLIC_APP_URL>"
```

ตัวอย่างเชิงรูปแบบคือ `PUBLIC_APPROVE_URL="https://app.example.com"` โดยต้อง
แทนที่ด้วย URL จริงของ deployment ก่อน build/release

## 9. การทดสอบจากภายนอก origin network

ให้ทดสอบจาก network ที่ไม่ใช่ LAN เดียวกับ origin และแทนที่
`<PUBLIC_HOSTNAME>` ด้วยค่าจริง:

```bash
# Root และหน้า application ต้องเดินทางถึงแอป ไม่ใช่ Tunnel path allowlist
curl -I "https://<PUBLIC_HOSTNAME>/"
curl -I "https://<PUBLIC_HOSTNAME>/dashboard"

# API และ inbound webhook ใช้ public hostname เดียวกัน
curl -I "https://<PUBLIC_HOSTNAME>/api/line/webhook"
```

ผลลัพธ์ของ `/dashboard` หรือ API อาจเป็น `200`, `3xx`, `401` หรือ `403` ตาม
application authentication และ authorization ที่กำหนดไว้ แต่ไม่ควรเป็น `404`
จาก Tunnel เพียงเพราะ path ไม่ได้อยู่ใน allowlist

maintenance/cron endpoint ต้องได้ `404` จากภายนอก (ไม่ส่ง secret ใด ๆ):

```bash
for p in /api/cron/notification-outbox /api/cron/routine-scheduler /api/auth/cleanup \
         /api/audit-logs/cleanup /api/it/attachments/cleanup /api/leave/attachments/cleanup; do
  printf '%s ' "$p"
  curl -s -o /dev/null -w '%{http_code}\n' -X POST "https://<PUBLIC_HOSTNAME>$p"
done
```

ทุกบรรทัดต้องเป็น `404` หากได้ `403` หรือ `503` แปลว่า request ยังเดินทางถึงแอป
(rule ไม่มีผลหรือ `cloudflared` ยังไม่ได้ restart) ให้กลับไปตรวจส่วน 6.1

การทดสอบ `/api/line/webhook` ที่จะยอมรับ request ต้องใช้ signature และ payload
ตามสัญญาของ LINE เท่านั้น การที่ route เดินทางถึงแอปได้ไม่ใช่หลักฐานว่า webhook
ผ่านการยืนยันตัวตนแล้ว

## 10. ข้อกำหนดด้านความปลอดภัยและการปฏิบัติการ

- ใช้ Cloudflare Tunnel เพื่อรับ traffic จาก public hostname โดยไม่เปิด inbound
  port ของ origin โดยตรง
- ตั้ง firewall ให้จำกัด origin ตาม deployment policy และคง Next.js ไว้ที่
  `127.0.0.1:3000`
- ใน topology ปัจจุบัน TLS สิ้นสุดที่ Cloudflare edge และช่วง `cloudflared` →
  Next.js เป็น HTTP บน loopback; request-size limit และ timeout ของ Nginx
  **ไม่อยู่ใน request path** จึงต้องพึ่ง limit ในชั้นแอปเท่านั้น ค่า limit ของ JSON
  route อยู่ที่ `lib/ssot/request-limits.ts` และของ upload อยู่ที่
  `lib/ssot/uploads.ts` / constants ของแต่ละ module (สรุปใน
  [storage-and-attachments.md](./storage-and-attachments.md#app-level-request-body-limits))
  route ที่อ่าน body ทุกตัวใต้ `app/api` มี limit ในแอปแล้ว ยกเว้น LINE webhook
  (raw body สำหรับ signature) ซึ่งระบุเหตุผลไว้ใน storage-and-attachments.md
  และ `npm run architecture:check` กันไม่ให้มี route ใหม่อ่าน body โดยไม่มี limit
- อย่าใช้ public hostname หรือ Tunnel path เป็น authorization boundary; path
  denylist ในส่วน 6.1 เป็นเพียงชั้นป้องกันที่สอง
- อย่าเพิ่ม Cloudflare Zero Trust/Access policy ในคู่มือนี้ เพราะไม่ใช่ส่วนหนึ่ง
  ของ current deployment contract
- หากเปลี่ยนจาก single-process หรือเปลี่ยนเส้นทาง Tunnel ให้ทบทวน L2 trusted
  client-IP และ process-local rate-limit contract ก่อน deploy

การเผยแพร่ public ทั้งแอปทำให้ทุก route มี network reachability จาก Internet ดังนั้น
การตรวจสอบก่อน release ต้องครอบคลุม Auth, admin role, active workforce, LIFF,
webhook signature, mutation idempotency และ request/body limits ของ route ที่เปิดใช้

## 11. แหล่งอ้างอิง

- [Cloudflare — Error 1000 (Troubleshooting 1xxx errors)](https://developers.cloudflare.com/support/troubleshooting/http-status-codes/cloudflare-1xxx-errors/error-1000/)
- [Cloudflare — HTTP request headers (`CF-Connecting-IP`)](https://developers.cloudflare.com/fundamentals/reference/http-headers/)
- [Cloudflare Tunnel — Configuration file (ingress rules, `path` regex, `ingress validate`/`ingress rule`)](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/configuration-file/)
- [Cloudflare WAF — Custom rules](https://developers.cloudflare.com/waf/custom-rules/)
- [Cloudflare Tunnel — Published applications](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/)
- [Cloudflare Tunnel — Create a locally-managed tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/)
- [Cloudflare Tunnel — Origin parameters](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/origin-parameters/)

## ภาคผนวก A: topology สำรองผ่าน Nginx (ไม่ได้ใช้ใน production ปัจจุบัน)

ไฟล์ `deployment/nginx/employee_nhf.cloudflare-origin.conf`,
`deployment/nginx/cloudflare-real-ip.conf` และ test
`__tests__/deployment/nginx-client-ip.test.ts` อธิบาย topology สำรอง
`Cloudflare Tunnel → Nginx :443 → Next.js 127.0.0.1:3000` ซึ่ง **ไม่ใช่**
request path ของ production ปัจจุบัน ไฟล์เหล่านี้ยังคงอยู่ใน repository จนกว่า
owner จะตัดสินใจว่าจะลบหรือกลับไปใช้ topology นี้

หากเลือกใช้ topology สำรอง ingress หลักจะชี้ไปยัง Nginx แทน และต้องคง rule
denylist ของส่วน 6.1 ไว้ก่อน rule หลักเช่นเดิม:

```yaml
ingress:
  - hostname: <PUBLIC_HOSTNAME>
    path: '^/api/(cron/|auth/cleanup|audit-logs/cleanup|it/attachments/cleanup|leave/attachments/cleanup)'
    service: http_status:404
  - hostname: <PUBLIC_HOSTNAME>
    service: https://127.0.0.1:443
    originRequest:
      originServerName: <ORIGIN_SERVER_NAME>
  - service: http_status:404
```

ใน topology นี้ Nginx ต้องใช้ Cloudflare real-IP configuration และส่งต่อ
`CF-Connecting-IP` จากค่า client IP ที่ canonical แล้วเท่านั้น และ
`originServerName` ต้องตรงกับชื่อใน certificate หรือ SAN ของ Nginx ดู
[Cloudflare origin parameters](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/origin-parameters/)
