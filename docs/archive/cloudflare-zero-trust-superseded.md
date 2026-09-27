# Cloudflare Zero Trust Setup — Superseded

สถานะ: **SUPERSEDED — ห้ามใช้เป็นคู่มือการติดตั้งปัจจุบัน**

เอกสารนี้เก็บไว้เพื่อบันทึกว่าครั้งหนึ่ง repository เคยมีแนวทาง Cloudflare
Zero Trust/Access แต่แนวทางดังกล่าวไม่ใช่ deployment contract ปัจจุบันแล้ว

## สถาปัตยกรรมปัจจุบัน

ระบบปัจจุบันใช้ Cloudflare Tunnel แบบ public application โดยใช้ public hostname
เดียว route เข้าสู่ **ทั้งแอปพลิเคชัน** และไม่กำหนด path allowlist:

```text
Internet
  ↓ HTTPS <PUBLIC_HOSTNAME>
Cloudflare
  ↓ Cloudflare Tunnel
Nginx :443
  ↓
Next.js 127.0.0.1:3000
```

ระบบ **ไม่ใช้ Cloudflare Zero Trust หรือ Cloudflare Access** เป็น authentication
gate และไม่มีขั้นตอนให้ผู้ใช้งานกรอก OTP ของ Cloudflare ก่อนเข้าแอปพลิเคชัน
การยืนยันตัวตนและการกำหนดสิทธิ์เป็นหน้าที่ของ Auth, role, workforce/LIFF guard,
webhook signature และ business authorization ในแอปพลิเคชัน

## เอกสารที่ต้องใช้แทน

ให้ใช้ [Cloudflare Tunnel — Public Application Deployment](./CLOUDFLARE_TUNNEL_SETUP.md)
เป็นคู่มือปัจจุบันเพียงฉบับเดียวสำหรับ:

- การสร้าง public hostname
- การตั้งค่า Tunnel ให้ route ทุก path ของแอปพลิเคชัน
- การเชื่อมต่อ Tunnel ผ่าน Nginx ไปยัง Next.js
- การตรวจสอบ DNS, connector, TLS และ public application

ห้ามนำตัวอย่าง Access Application, Access Policy, email OTP หรือ path-specific
ingress จากเอกสารรุ่นก่อนกลับมาใช้ เว้นแต่จะมีการอนุมัติให้เปลี่ยน deployment
contract และบันทึกสถาปัตยกรรมฉบับใหม่อย่างชัดเจน
