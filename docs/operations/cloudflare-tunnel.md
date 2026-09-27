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
        ↓ Cloudflare Tunnel (cloudflared)
Nginx :443
        ↓
Next.js :3000 (127.0.0.1)
        ↓
MySQL และ persistent storage
```

การตั้งค่าปัจจุบันมีคุณสมบัติดังต่อไปนี้:

- public hostname เปิดให้เข้าถึง **ทุก path ของแอปพลิเคชัน** ผ่าน Tunnel
- configuration ของ Tunnel **ไม่กำหนด `path` allowlist** สำหรับเส้นทางของแอป
- การควบคุมสิทธิ์ของแต่ละหน้าและ API เป็นหน้าที่ของ Next.js และ application
  authentication/authorization ไม่ใช่หน้าที่ของ path rule ใน Tunnel
- ไม่ใช้ Cloudflare Zero Trust หรือ Cloudflare Access เป็นด่านยืนยันตัวตน
- ยังคงไม่เปิด `127.0.0.1:3000` ออก Internet โดยตรง และให้ Tunnel เชื่อมต่อผ่าน
  Nginx ตาม deployment contract ของ repository

การเปิด public ทุก path หมายถึง request สามารถเดินทางมาถึงแอปพลิเคชันได้ในระดับ
เครือข่าย ไม่ได้หมายความว่าทุกฟังก์ชันสามารถใช้งานได้โดยไม่ยืนยันตัวตน ระบบยัง
ต้องบังคับ Auth, role, workforce eligibility, LIFF session, signature และ
business authorization ในชั้นแอปพลิเคชันตาม route นั้น ๆ

> **ข้อกำหนดด้านความปลอดภัย:** Nginx ต้องใช้ Cloudflare real-IP configuration
> และส่งต่อ `CF-Connecting-IP` จากค่า client IP ที่ canonical แล้วเท่านั้น
> ห้ามให้ผู้เรียกส่ง header ดังกล่าวตรงถึง Next.js และห้ามเปลี่ยน service ใน
> Tunnel ให้ชี้ตรงไป `localhost:3000` หาก deployment ต้องคง trusted Nginx
> boundary ของ repository นี้

## 2. ค่าที่ต้องแทนที่ในคู่มือ

ตัวอย่างทั้งหมดใช้ placeholder ต่อไปนี้ ห้ามนำ placeholder ไปใช้เป็นค่าจริง:

| Placeholder | ความหมาย |
| --- | --- |
| `<PUBLIC_HOSTNAME>` | hostname สาธารณะใน Cloudflare DNS เช่น `app.example.com` |
| `<ORIGIN_SERVER_NAME>` | ชื่อที่อยู่ใน certificate ของ Nginx สำหรับ TLS ระหว่าง `cloudflared` กับ origin |
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
  # Route ทุก path ของ public hostname ไปยังแอปพลิเคชันผ่าน Nginx
  - hostname: <PUBLIC_HOSTNAME>
    service: https://127.0.0.1:443
    originRequest:
      originServerName: <ORIGIN_SERVER_NAME>

  # Required final rule for hostnames that do not match the public route above
  - service: http_status:404
```

ความหมายของ configuration หลัก:

- `tunnel`: UUID ของ Tunnel ที่สร้างไว้
- `credentials-file`: path ของ credentials สำหรับให้ connector authenticate
  กับ Cloudflare; ต้องเป็น path จริงบนเครื่องที่รัน `cloudflared`
- `hostname`: public hostname เดียวที่เปิดใช้งาน; เมื่อไม่มี `path` ทุก path
  ที่มากับ hostname นี้จะถูกส่งต่อไปยัง service เดียวกัน
- `service`: local Nginx HTTPS listener ซึ่งเป็น trusted reverse-proxy boundary
  ก่อนถึง Next.js
- `originRequest.originServerName`: ชื่อที่ `cloudflared` ใช้ตรวจสอบ certificate
  ของ origin ใน TLS handshake; ต้องตรงกับชื่อใน certificate หรือ SAN ของ Nginx
- กฎ `http_status:404` ท้ายสุดเป็น catch-all สำหรับ hostname ที่ไม่ตรงกับ route
  ไม่ใช่ path allowlist และไม่บล็อก path ใด ๆ ของ `<PUBLIC_HOSTNAME>`

Cloudflare ระบุว่า `originServerName` คือ hostname ที่ `cloudflared` คาดหวังจาก
certificate ของ origin และ configuration ของ locally-managed Tunnel สามารถกำหนด
ค่าเหล่านี้ในไฟล์ config ได้ ดูรายละเอียดจาก [Cloudflare origin parameters]
(https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/origin-parameters/)
และ [การสร้าง locally-managed tunnel]
(https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/)

ห้ามเพิ่มรายการลักษณะต่อไปนี้กลับเข้า configuration ของ public application:

```yaml
path: /some/path/*
```

เนื่องจากจะเปลี่ยน deployment contract จาก public ทั้งแอปเป็น path-restricted
โดยไม่ได้รับการอนุมัติให้เปลี่ยนสถาปัตยกรรม

## 7. การตรวจสอบ configuration และการรัน Tunnel

แทนที่ `<CONFIG_PATH>` และ `<TUNNEL_NAME>` ด้วยค่าจริงก่อนรัน:

```bash
cloudflared tunnel ingress validate --config <CONFIG_PATH>
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

การทดสอบ `/api/line/webhook` ที่จะยอมรับ request ต้องใช้ signature และ payload
ตามสัญญาของ LINE เท่านั้น การที่ route เดินทางถึงแอปได้ไม่ใช่หลักฐานว่า webhook
ผ่านการยืนยันตัวตนแล้ว

## 10. ข้อกำหนดด้านความปลอดภัยและการปฏิบัติการ

- ใช้ Cloudflare Tunnel เพื่อรับ traffic จาก public hostname โดยไม่เปิด inbound
  port ของ origin โดยตรง
- ตั้ง firewall ให้จำกัด origin ตาม deployment policy และคง Next.js ไว้ที่
  `127.0.0.1:3000`
- ให้ Nginx ควบคุม TLS, request-size limit, timeout และ canonical client IP
- อย่าใช้ public hostname หรือ Tunnel path เป็น authorization boundary
- อย่าเพิ่ม Cloudflare Zero Trust/Access policy ในคู่มือนี้ เพราะไม่ใช่ส่วนหนึ่ง
  ของ current deployment contract
- หากเปลี่ยนจาก single-process หรือเปลี่ยนเส้นทาง Tunnel ให้ทบทวน L2 trusted
  client-IP และ process-local rate-limit contract ก่อน deploy

การเผยแพร่ public ทั้งแอปทำให้ทุก route มี network reachability จาก Internet ดังนั้น
การตรวจสอบก่อน release ต้องครอบคลุม Auth, admin role, active workforce, LIFF,
webhook signature, mutation idempotency และ request/body limits ของ route ที่เปิดใช้

## 11. แหล่งอ้างอิง

- [Cloudflare Tunnel — Published applications](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/routing-to-tunnel/)
- [Cloudflare Tunnel — Create a locally-managed tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/create-local-tunnel/)
- [Cloudflare Tunnel — Origin parameters](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/configure-tunnels/origin-parameters/)
