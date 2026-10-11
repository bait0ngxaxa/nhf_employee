# NHF Employee — Phase 0: Auth & Database Deduplication Baseline

**สถานะ:** Phase 0 static audit เสร็จ; runtime HTTP/SQL measurement ยัง pending. รายงาน implementation และ verification ของ Phase 1 อยู่ท้ายเอกสาร
**วันที่ตรวจ:** 2026-10-11
**Commit ที่ตรวจ:** 3497b0b6c8e20254af825edfa8480aa58e65672a
**ขอบเขต:** static source audit และ read-only environment check; ไม่มี runtime instrumentation

## A. Executive Summary

### ยืนยันจาก source code

- Dashboard child routes บางหน้าเรียก getCurrentUserProjection() หลัง Dashboard layout เรียกฟังก์ชันเดียวกันแล้ว เมื่อ hard reload route เช่น Routine, Stock, Employee, Leave หรือ Notifications จะมี projection call จาก layout และจาก page guard ใน RSC render เดียวกัน ไม่มี React.cache หรือ memoization ที่ฟังก์ชันนี้
- Current-user projection เรียก authorization.resolveMany() แยก 9 ครั้งตาม domain ใน Promise.all แต่ละ batch อ่าน TeamMembership ซ้ำด้วย userId และเงื่อนไข active Team เดียวกัน การอ่าน TeamRole grants มีเพิ่มต่อ batch เมื่อมี active TeamRole
- Login/signup ทำ GET /api/auth/me ใน refreshUser() ขณะที่ provider อยู่บน public route และปิด SWR key อยู่ SWR 2.3.8 ที่ติดตั้งจะไม่ทำ bound mutate เมื่อ key ว่าง; เมื่อเข้า Dashboard key จึงเปิดและ bootstrap GET /me อีกครั้ง

### ยังเป็นการอ่านซ้ำที่อาจมีเหตุผลด้านความปลอดภัย

- Hard reload ของ Dashboard ทำ current-user projection ใน RSC แล้ว browser เรียก /api/auth/me อีกครั้ง เป็นคนละ HTTP request และคนละ React render; นี่ไม่ใช่งานที่ React.cache จะรวมได้ /me ยังตรวจ session และข้อมูลสิทธิ์สำหรับ client state
- การตรวจ User/Employee lifecycle เกิดใน account resolution และ employee projection อีกครั้ง ข้อมูลบางส่วนทับกัน แต่การตรวจรอบที่สองเป็นการอ่านสถานะล่าสุดและสร้าง Employee profile; ไม่ควรถอดออกโดยอาศัยจำนวน query อย่างเดียว
- Focus, reconnect และการหมุน refresh token เป็นกลไก revalidation ที่ยังมีหน้าที่รักษาสถานะ session/สิทธิ์ ไม่ควรนับทั้งหมดเป็น request ซ้ำที่ลบทิ้งได้

### กลไกที่มีอยู่แล้ว

- แต่ละ domain รวม capability หลายรายการเป็น resolveMany() batch เดียว แทนการ query แยกต่อ capability
- projection ทำงานอิสระพร้อมกันด้วย Promise.all; ช่วย latency แต่ไม่ได้ลดจำนวน reads
- browser มี refresh single-flight ภายใน JavaScript realm, SWR dedupe key เดียวในช่วง 2 วินาที และ focus throttle 5 วินาที
- refresh token rotation ใช้ transaction, row lock และ conditional update เพื่อคง semantics การหมุน token และการตรวจ concurrent completion

**ข้อจำกัดการวัด:** พอร์ตแอป 3000 ไม่เปิด; MySQL ที่ integration.env ชี้ไปตอบ read-only check ได้ แต่ employee_nhf_integration มี 0 ตาราง จึงไม่มี schema, account หรือ session สำหรับ runtime scenario ตัวเลขด้านล่างเป็น static expectation เท่านั้น; HTTP runtime counts และ SQL statement counts เป็น **NOT MEASURED**.

## B. Request / Database Call Graph

- **Browser bootstrap:** app/layout.tsx ครอบ HybridAuthProvider ด้วย SWRProvider. บน path ที่ไม่ใช่ public auth และไม่ใช่ LIFF, provider เปิด SWR key /api/auth/me แล้ว fetchCurrentUser() เรียก browser API
- **Browser revalidation:** focus และ reconnect ทำ SWR revalidation ของ /me; visibility หลังอายุ refresh ถึง 10 นาที และ interval ทุก 12 นาทีเรียก POST /api/auth/refresh โดยตรง หากสำเร็จจึง mutate /me. refreshInterval ของ SWR ไม่ได้ตั้งไว้; timer นี้เป็น setInterval ของ provider
- **401 recovery:** browser transport ส่ง request เดิม; เมื่อได้ 401 จะลอง /refresh หนึ่งครั้ง และ replay เฉพาะ GET/HEAD เมื่อ refresh สำเร็จ. Mutation ไม่ replay. refresh/logout/logout-all ถูกกันไม่ให้เรียก refresh ซ้ำ
- **RSC Dashboard:** Dashboard layout → getCurrentUserProjection() → cookies/access token → resolveAuthenticatedAccount() → ตรวจ JWT → ตรวจ active session family → อ่าน account กับ Employee lifecycle → อ่าน Employee profile/Department/manager hint → อ่านชื่อ Team สำหรับ presentation → parallel Leave projection และ capability projection 9 domains
- **/api/auth/me:** เป็น HTTP request แยกที่เรียก getCurrentUserProjection() ใหม่ ไม่มีการส่งค่า projection จาก RSC ให้ Route Handler
- **Authorization:** แต่ละ domain presentation function เรียก authorization.resolveMany() ของตัวเอง → resolver เรียก repository.loadMany() หนึ่งครั้งต่อ domain batch → repository อ่าน User grants และ Team memberships; อ่าน TeamRole grants เมื่อมี active role

Refresh persistence เป็นอีกเส้นทาง ไม่รวมอยู่ใน projection budget: POST /api/auth/refresh → refreshHybridSession() อ่าน refresh token ด้วย findRefreshTokenByHash() → rotateRefreshTokenAtomically() เริ่ม transaction และ lockUserRows() ด้วย SELECT ... FOR UPDATE → อ่าน User/Employee lifecycle และ source token ซ้ำใน transaction → conditional update ของ token เก่าและ create successor เมื่อหมุนสำเร็จ. กรณี expired/reuse/concurrent completion มี branch reads/writes เพิ่ม. Static success path มี 3 Prisma read delegate calls ก่อน/ใน transaction, 1 raw row-lock query และ 2 writes; SQL statement count ไม่ได้วัด. Logout ปัจจุบันอ่าน token reference, lock user, อ่าน family rows/count แล้ว revoke; logout-all lock user แล้ว revoke rows.

Session resolution อยู่ที่ [sessions.ts](../../modules/auth/application/sessions.ts#L133), account read ที่ [account-repository.ts](../../modules/auth/infrastructure/persistence/account-repository.ts#L91), active family ที่ [refresh-token-repository.ts](../../modules/auth/infrastructure/persistence/refresh-token-repository.ts#L84), และ Employee projection ที่ [employee-queries.ts](../../modules/employee/infrastructure/persistence/employee-queries.ts#L73). Team names ใช้ query แยกซึ่งระบุชัดว่าเป็น descriptive context ไม่ใช่ authorization: [user-team-queries.ts](../../modules/authorization/infrastructure/persistence/user-team-queries.ts#L23).

### Browser trigger inventory

- **Initial bootstrap:** key /me เปิดเมื่อ path เป็น protected; SWR ค่าเริ่มต้น revalidate เมื่อ mount และไม่มี server fallback ใน root provider
- **Focus:** auth hook ตั้ง revalidateOnFocus=true ทับ global false; SWR focus throttle คือ 5 วินาที
- **Reconnect:** global revalidateOnReconnect=true และ auth hook ไม่ override
- **Visibility restoration:** visible และอายุ refresh ≥10 นาทีเรียก /refresh; เมื่อสำเร็จเรียก mutate() เพื่อ revalidate /me. หากเหตุการณ์ focus เกิดพร้อมกัน SWR อาจรวม /me ใน dedupe window หรือเกิดรอบที่สองภายหลัง
- **Periodic refresh:** เมื่อมี user data provider ตั้ง interval 12 นาที; refresh สำเร็จจึง mutate /me
- **Explicit refresh:** refreshUser() เรียก GET /me โดยตรง; login/signup ใช้ flow นี้ และ Authorization Administration เรียกหลังเปลี่ยน grant เพื่อโหลด capability ล่าสุด
- **401:** fetchWithRefresh เรียก /refresh แล้ว replay เฉพาะ GET/HEAD เมื่อสำเร็จ; refreshInFlight ใช้ร่วมกันได้เฉพาะภายใน tab/realm เดียว
- **Logout/revocation:** logout ส่ง /api/auth/logout และล้าง client state โดย signOut ไม่เรียก /me หรือ /refresh เพิ่ม. เมื่อ session ถูก revoke, /me ที่ได้ 401 จะลอง /refresh; ถ้า refresh ล้มเหลวจะไม่ replay /me. Auth provider จะได้ unauthenticated state แต่ DashboardProvider ใช้ authUser ?? initialUser จึงอาจแสดง initialUser เดิมต่อจน RSC refresh/full navigation. นี่เป็น presentation snapshot ไม่ใช่ server authorization; ไม่ได้เปลี่ยนพฤติกรรมใน Phase 0.
- **Multiple tabs:** SWR cache และ refreshInFlight อยู่ใน JavaScript realm ของแต่ละ tab; ไม่มี cross-tab request dedupe

รายละเอียด trigger อยู่ใน [HybridAuthProvider.tsx](../../modules/auth/presentation/HybridAuthProvider.tsx#L42), [browser-transport.ts](../../modules/auth/presentation/browser-transport.ts#L29), [browser-api.ts](../../modules/auth/presentation/browser-api.ts#L138), [swr.ts](../../lib/client/swr.ts#L19), และ [DashboardProvider.tsx](../../components/dashboard/context/dashboard/DashboardProvider.tsx#L47).

## C. Baseline Metrics

ค่าทุกช่องในตารางเป็น **static expectation จาก call graph ไม่ใช่ค่าจาก runtime**. DB count หมายถึงจำนวน Prisma Client delegate invocations สำหรับ projection สำเร็จหนึ่งครั้ง ไม่ใช่ SQL statement count.

Static budget ต่อ current-user projection ของผู้ใช้ Dashboard ที่มี Employee ใช้งานได้:

- 7 reads นอก authorization: active session 1, account 1, Employee 1, descriptive Team memberships 1, Leave relationship/history 3
- authorization 9 batches × (UserCapabilityGrant 1 + TeamMembership 1) = 18
- TeamRoleCapabilityGrant เพิ่ม 0–9 ครั้ง ตามว่ามี active TeamRole หรือไม่
- รวม **25–34 Prisma delegate calls ต่อ projection**; SQL statement count จริงไม่ได้วัด

| Scenario | GET /me | POST /refresh | Projection calls (static) | Prisma delegate calls (static) | Evidence / limit |
|---|---:|---:|---:|---:|---|
| Authenticated hard reload ที่ /dashboard | 1 | 0 | 2: Dashboard layout และ browser /me | 50–68 | layout และ provider; runtime NOT MEASURED |
| Hard reload ที่ /dashboard/routine, /stock หรือ /employees | 1 | 0 | 3: layout + page guard ใน RSC เดียว + browser /me | 75–102 | page เรียก projection ซ้ำ; runtime NOT MEASURED |
| Client navigation จาก Dashboard ไป Routine, Stock, Employee | 0 โดยปกติ | 0 | 1 ต่อ navigation request | 25–34 | shared layout คงอยู่; key /me ไม่เปลี่ยน; runtime NOT MEASURED |
| Focus หรือ reconnect เมื่อไม่มี request เดิมใน dedupe window | 1 ต่อ revalidation | 0 | 1 | 25–34 | SWR config; อาจเป็น 0 HTTP เมื่อใช้ผล request เดิม |
| กลับมา visible หลัง threshold 10 นาที | 1–2 | 1 เมื่อ refresh สำเร็จ | 1–2 | 25–68 บวก reads/writes ของ refresh | focus และ mutate อาจรวมกัน; runtime NOT MEASURED |
| Periodic refresh หลัง 12 นาที | 1 เมื่อ refresh สำเร็จ | 1 | 1 | 25–34 บวก transaction ของ refresh | เมื่อ refresh ล้มเหลว mutate ไม่ทำงาน; runtime NOT MEASURED |
| Login หรือ signup สำเร็จและเข้า Dashboard | 2 | 0 | รวม 3 ต่อ flow ที่มี Dashboard RSC หนึ่ง response: /me ก่อนนำทาง + layout + bootstrap /me หลังเปิด key | 75–102 ต่อ flow ดังกล่าว | router.refresh อาจทำ RSC เพิ่ม; ไม่ได้นับ/วัด |
| Access token หมดอายุระหว่าง GET /api/auth/me | 2: 401 แล้ว retry | 1 เมื่อ refresh สำเร็จ | 2 entry calls; มี 1 projection เต็ม | 25–34 บวก refresh transaction | JWT ที่หมดอายุออกก่อน DB reads; runtime NOT MEASURED |
| Logout ปกติ | 0 | 0 | 0 full projections; login page อาจเรียก helper แล้วออกก่อนประกอบ projection | ไม่ใช่ current-user projection; logout มี persistence ของตนเอง | signOut เรียก /logout แล้วนำทาง |
| Revoked session เมื่อ revalidation | 1 | 1 ที่ล้มเหลว | 1 entry call; ออกก่อน full projection | NOT MEASURED | ขึ้นกับ endpoint result และ database state |
| N tabs เปิด Dashboard พร้อมกัน | N | 0 ตอน bootstrap | อย่างน้อย N browser projections และ N RSC projections | 2N × 25–34 สำหรับ /dashboard โดยไม่มี retry | ไม่มี cross-tab dedupe; ไม่ได้วัด |

จำนวน RSC ต่อ hard reload ของ child route มาจาก layout และ page/route-access helper ที่เรียก projection โดยตรง เช่น [Routine](../../app/dashboard/routine/page.tsx#L22), [Stock](../../app/dashboard/stock/page.tsx#L14), [Employee](../../app/dashboard/employees/page.tsx#L18), และ [route-access.ts](../../app/dashboard/_lib/route-access.ts#L31). /dashboard root page เองไม่มี projection call เพิ่มจาก layout.

**ไม่วัดจริง:** endpoint HTTP counts, projection execution counters, per-request session persistence reads, resolver counts ใน production runtime, Prisma query events/SQL statements, query latency และจำนวนผลลัพธ์จาก Team/TeamRole grants. ไม่ได้เปิด server, migrate DB, seed account หรือเพิ่ม instrumentation.

## D. Findings

### F0-AUTH-01 — Medium: projection ซ้ำภายใน Dashboard RSC render

**อ้างอิง:** [Dashboard layout](../../app/dashboard/layout.tsx#L13), [Routine page](../../app/dashboard/routine/page.tsx#L22), [Stock page](../../app/dashboard/stock/page.tsx#L14), [Employee page](../../app/dashboard/employees/page.tsx#L18), [current-user.ts](../../app/_lib/auth/current-user.ts#L46), [route-access.ts](../../app/dashboard/_lib/route-access.ts#L31).

**หลักฐานและสาเหตุ:** layout เรียก projection เพื่อยืนยัน session และส่ง initialUser; leaf page หรือ route-access เรียกฟังก์ชันเดิมเพื่อ guard route. ฟังก์ชันไม่ถูก memoize. Hard reload ของ child route จึงมี call สองครั้งใน RSC tree/request เดียวกัน. Client navigation คง shared layout ไว้ จึงเรียกเฉพาะ page guard.

**ประโยชน์ที่คาด:** Phase 1 request-scoped dedupe อาจลด leaf-route projection สองครั้งเหลือหนึ่ง; static budget ของ call ที่ซ้ำคือ 25–34 Prisma delegate invocations. การลด SQL จริงยังไม่พิสูจน์.

**ความเสี่ยง:** ทั้ง call จะเห็น snapshot เดียวกันภายใน render แม้ grant/lifecycle เปลี่ยนระหว่างการอ่านสองรอบ. ควรจำกัด cache ไว้ใน RSC render เดียว; API และ mutation authorization ยังคงอ่าน/ตรวจตามขอบเขตเดิม.

### F0-AUTH-02 — Medium: resolver batches อ่าน Team memberships ทับซ้อนกัน

**อ้างอิง:** [current-user.ts](../../app/_lib/auth/current-user.ts#L76), [resolver.ts](../../modules/authorization/application/resolver.ts#L117), [authorization-resolution-repository.ts](../../modules/authorization/infrastructure/persistence/authorization-resolution-repository.ts#L181).

**หลักฐานและสาเหตุ:** current-user projection เรียก 9 domain projections แยกกัน; แต่ละอันเรียก resolveMany() หนึ่งครั้ง. repository อ่าน UserCapabilityGrant และ TeamMembership หนึ่งครั้งต่อ batch; TeamRoleCapabilityGrant query เมื่อพบ active role. TeamMembership filter ใช้ user เดิมและ active Team เหมือนกัน จึงโหลด membership snapshot เดิมซ้ำ 9 ครั้ง. Team grants ที่ซ้อนใน membership query ยัง filter ตาม capability ของแต่ละ domain จึงไม่ใช่ผลลัพธ์ทั้งหมดที่ซ้ำกัน. query สำหรับชื่อ Team อีกหนึ่งครั้งใช้เพื่อ descriptive projection เท่านั้น.

**ประโยชน์ที่คาด:** อาจลด membership reads เมื่อมี batch resolver ร่วม แต่จำนวน SQL และสัดส่วนเวลายังไม่วัด. resolveMany() ภายใน domain เป็น batching ที่มีอยู่แล้วและไม่ควรแตกเป็น query ต่อ capability.

**ความเสี่ยง:** การรวมต้องรักษา configured User/Team/TeamRole grants, active membership/role filters, grant origin, scopes และ channel support; แต่ละ domain ยังต้องประกอบ Default Domain Policy ของตน. ห้ามยุบผลเป็น boolean หรือใช้ผล capability แทน resource-level authorization.

### F0-AUTH-03 — Medium: login/signup ยิง /me ซ้ำจาก public route

**อ้างอิง:** [HybridAuthProvider.tsx](../../modules/auth/presentation/HybridAuthProvider.tsx#L54), [login-form.tsx](../../modules/auth/presentation/login-form.tsx#L79), [signup-form.tsx](../../modules/auth/presentation/signup-form.tsx#L97), [SWR provider](../../lib/client/swr.ts#L19).

**หลักฐานและสาเหตุ:** หน้า login/signup ทำให้ useSWR key เป็น null แต่ refreshUser() ยังเรียก fetchCurrentUser() ซึ่งส่ง GET /me. ค่าที่ได้ถูกส่งเข้า bound mutate; SWR 2.3.8 implementation serialize key ว่างแล้ว return โดยไม่เขียน cache. เมื่อ navigation เข้า Dashboard key กลายเป็น /me และทำ initial fetch อีกครั้ง.

**ประโยชน์ที่คาด:** ลด GET /me หนึ่งครั้งและ current-user projection หนึ่งครั้งต่อ successful login/signup; static delegate budget 25–34 ต่อครั้ง. ยังไม่ได้วัดด้วย browser runtime.

**ความเสี่ยง:** การแก้ต้องยังเติม client auth state ด้วย current capability projection และไม่ข้าม current session/Employee validation. ห้ามแก้โดยยอมรับ login response ที่มีเพียง identity fields แทน projection.

### F0-AUTH-04 — Low / ต้องวัด: RSC initialUser กับ browser bootstrap ทำ projection คนละ request

**อ้างอิง:** [Dashboard layout](../../app/dashboard/layout.tsx#L13), [HybridAuthProvider.tsx](../../modules/auth/presentation/HybridAuthProvider.tsx#L76), [DashboardProvider.tsx](../../components/dashboard/context/dashboard/DashboardProvider.tsx#L47), [/api/auth/me](../../app/api/auth/me/route.ts#L7).

**หลักฐานและสาเหตุ:** server ส่ง initialUser เข้า DashboardProvider แต่ HybridAuthProvider มี SWR bootstrap ของตัวเองและไม่มี fallback จาก RSC. DashboardProvider ใช้ authUser เมื่อพร้อม แล้ว fallback เป็น initialUser. การโหลด hard reload จึงทำ projection ฝั่ง RSC และทำซ้ำใน /me HTTP request.

**ประโยชน์ที่คาด:** อาจหลีกเลี่ยง client GET/projection เมื่อข้อมูลจาก RSC ยังสดและใช้แทน bootstrap ได้ แต่ React.cache ไม่รวมสอง request นี้ และผลประหยัดยังไม่มี runtime evidence.

**ความเสี่ยง:** ลดการ refresh client state อาจทำให้ UI แสดง session/grant เก่า; focus/reconnect และ server enforcement ต้องคงเดิม. ประเมินแยกจาก RSC cache.

### F0-AUTH-05 — Low / ยังไม่ยืนยันว่าควรถอด: lifecycle fields ถูกอ่านซ้ำ

**อ้างอิง:** [resolveAuthenticatedAccount()](../../modules/auth/application/sessions.ts#L133), [account select](../../modules/auth/infrastructure/persistence/account-repository.ts#L91), [findCurrentEmployeeProjection()](../../modules/employee/infrastructure/persistence/employee-queries.ts#L73).

**หลักฐานและสาเหตุ:** account resolution อ่าน User active/deleted/tokenVersion และ Employee status/deletedAt เพื่อยืนยัน session; Employee projection อ่าน Employee status/deletedAt และกรอง User active/deleted อีกครั้ง พร้อมดึงชื่อ/Department/manager. ฟิลด์ eligibility บางส่วนซ้ำ แต่การอ่านครั้งที่สองเกิดหลังอ่านแรกและอาจเห็น lifecycle update ที่เกิดระหว่างนั้น.

**ประโยชน์ที่คาด:** ยังตีมูลค่าไม่ได้; ห้ามถอด guard เพื่อแลก query count. Phase 1 cache ทั้ง projection อาจลดการเรียกซ้ำจาก layout/page แต่ไม่เปลี่ยนลำดับ reads ภายใน projection เดียว.

## E. Phase 1 Recommendation

เสนอให้ Phase 1 ทดลอง React.cache ครอบ getCurrentUserProjection() ที่ server-side composition seam เดิม โดยใช้ function reference เดียวกันจาก Dashboard layout, pages และ route-access helpers.

- ใช้ได้กับการเรียกซ้ำใน React Server Components render/request เดียวกัน; Next.js 16 auth guide ที่ติดตั้งแนะนำรูปแบบ DAL + cache สำหรับการตรวจ session ใน render pass
- React.cache ไม่ใช่ cross-request cache; React 19 cache แยก cache ใหม่ต่อ server render/request. คำขอ /api/auth/me, RSC navigation คนละรอบ และแต่ละ tab ยังตรวจ session แยกกัน
- Route Handler ที่ไม่มี React render context ไม่ได้ cache จาก RSC; อย่าใช้ module-level Map, TTL หรือ global authorization cache
- ก่อนนำไปใช้ ให้มี focused test ที่ยืนยันว่า call ซ้ำใน render เดียวใช้ projection เดียว และ request ถัดไป/ตัวตนหรือ cookie คนละชุดได้ projection ใหม่. ตรวจว่าการเปลี่ยนแปลงไม่มีผลต่อ server mutation/resource authorization

นี่เป็นข้อเสนอเท่านั้น; Phase 0 ไม่มีการ implement.

## F. Phase 2/3 Decision Gates

- **Phase 2 — authorization read consolidation:** ทำต่อเมื่อ Prisma query-event หรือ DB statement instrumentation ที่ผูกกับ request ยืนยันจำนวน/ต้นทุนของ TeamMembership reads ซ้ำใน projection หนึ่งครั้ง. นับ SQL statements จริง ไม่ใช้ findMany invocation แทน. เก็บ domain defaults, configured grant origins, channel restrictions, scopes และ resource checks ไว้ในเจ้าของเดิม. แหล่งสถาปัตยกรรมอธิบายการแยก Default Domain Policy กับ configured authority ใน [authorization-current-state.md](./authorization-current-state.md#L96) และ [authorization-presentation-projection.md](./authorization-presentation-projection.md#L658).
- **Phase 3 — browser coordination:** ให้ทำเมื่อ network capture ยืนยันค่าใช้จ่ายของ hard reload/login flow และชี้ว่าหนึ่ง GET /me สามารถรวมเข้ากับข้อมูลที่ถูกต้องได้. Login/signup public-key no-op เป็น candidate แรก; focus/reconnect, refresh interval, visibility, revoked-session handling และ cross-tab refresh ต้องคง semantics เดิมจนมีแบบทดสอบและข้อมูลรองรับ
- การอ่านที่มีวัตถุประสงค์แยกกัน เช่น server-side route guard กับ client session refresh และ Employee lifecycle recheck ยังไม่มีหลักฐานให้ลบ

## G. Verification / Limitations

### สภาพแวดล้อมและการตรวจที่ทำ

- ตรวจ git status และ HEAD: working tree สะอาดก่อนเริ่ม; commit 3497b0b6c8e20254af825edfa8480aa58e65672a
- อ่าน AGENTS.md, CONTEXT.md และเอกสาร architecture auth-session-identity-migration, authorization-current-state, authorization-resolver, authorization-persistence และ authorization-presentation-projection
- ตรวจ package ที่ติดตั้ง: Next.js 16.3.8, React 19.2.8, SWR 2.3.8, Prisma Client 6.19.3
- อ่าน Next.js docs ที่ติดตั้ง: authentication guide (React cache ระหว่าง render pass) และ linking/navigation guide (shared layout คงอยู่ระหว่าง client navigation); ใช้ React Context7 docs เรื่อง request-scoped cache, SWR Context7/installed implementation เรื่อง focus/reconnect/dedupe และ Prisma Client 6 installed query-event types
- read-only integration check ผ่าน Node/mysql2: host 127.0.0.1, port 3309, database employee_nhf_integration, tableCount=0. แอป port 3000 ไม่รับ connection. ไม่ได้เปิด server, apply migration, seed หรือแก้ฐานข้อมูล
- อ่าน tests: current-user projection, HybridAuthProvider, browser transport, Auth sessions, refresh-token repository, authorization resolver และ authorization-resolution repository. Tests เหล่านี้ครอบ lifecycle, refresh/retry/single-flight และ batch ต่อ repository delegate; provider tests ครอบ public/LIFF skip และ protected bootstrap แต่ไม่ครอบ focus/reconnect/visibility/periodic runtime counts
- คำสั่งตรวจที่รันจริง: `git status --short` (สะอาดก่อนเริ่ม; ตอนจบมีรายงานใหม่ไฟล์เดียว), `git rev-parse HEAD` (ยืนยัน commit ข้างต้น), `rg -n` สำหรับตรวจคำอ้างอิงในรายงาน และ `Get-Content -Raw -Encoding UTF8` สำหรับอ่านรายงาน; `git diff --no-index --check -- /dev/null docs/architecture/auth-dedup-phase0-baseline.md` ไม่มี whitespace diagnostics (exit code 1 เป็นผลปกติเมื่อ no-index พบว่าไฟล์ใหม่ต่างจาก /dev/null)
- ใน Phase 0 ไม่รัน tests, lint, typecheck, integration suite หรือ production build เพราะเป็น audit/report-only; ผลตรวจ Phase 1 บันทึกแยกไว้ท้ายเอกสาร
- ไม่มี HTTP request counts, projection counters, per-request Prisma SQL/query-event counts หรือ scenario runtime observations: **NOT MEASURED**

### ไฟล์และผลส่งมอบ

Phase 0 เปลี่ยนเฉพาะรายงานนี้ และไม่ได้เปลี่ยน authentication/authorization behavior, Prisma schema, migrations, cookie หรือ refresh semantics.

## Phase 1 Verification Report — Request-Scoped Auth Projection Deduplication

### Implementation

- ครอบ `projectCurrentUser()` ด้วย `React.cache()` และคง export `getCurrentUserProjection()` แบบไม่มี argument และคืน `CurrentUserProjection | null` ตามเดิม. Body, ลำดับการตรวจ, และ capability composition เดิมไม่เปลี่ยน.
- React cache ใช้ซ้ำทั้ง Promise ที่กำลังทำงานและค่าที่ resolve แล้วภายใน RSC render request เดียว; request render ถัดไปเริ่ม cache ใหม่. การเรียกนอก RSC ไม่มีการเก็บผลข้ามการเรียก และ Route Handler ยังเรียก export เดิมโดยตรง.
- ไฟล์ Phase 1 ที่เปลี่ยน: `app/_lib/auth/current-user.ts`, `__tests__/auth/current-user-projection.test.ts`, `modules/auth/application/sessions.test.ts`, `vitest.config.ts` และรายงานนี้.

### Before / after evidence

| Controlled case | ก่อนครอบ cache | หลังครอบ cache | แหล่งหลักฐานและขอบเขต |
|---|---|---|---|
| เรียก projection พร้อมกัน 2 ครั้งใน RSC render เดียว | Account resolution 2, Employee projection 2, Team projection 2, Routine capabilities 2 | แต่ละ mock ถูกเรียก 1 ครั้ง | React Flight renderer จริง; domain/persistence functions เป็น mocks |
| เรียก projection ครั้งที่สองหลังครั้งแรก resolve แล้วใน RSC render เดียว | Account resolution 2 | Account, Employee, Team และ Routine capability mocks ถูกเรียกครั้งเดียว | React Flight renderer จริง; ยืนยันการ reuse ค่าที่ resolve แล้ว |
| RSC render แยกกันโดยใช้ token/identity คนละชุด | — | 2 render ทำ account resolution รวม 2 ครั้ง; ได้ identity/capability `41/true` และ `42/false` | ยืนยัน cache isolation และผลตาม identity ใน test harness; account/capability data เป็น mocks |
| เรียก function 2 ครั้งนอก RSC context | — | Account resolution 2 ครั้ง | ยืนยันว่าไม่มี module/global result cache ใน test context; ไม่ใช่การวัด SQL หรือ full Next Route Handler runtime |

การวัดก่อนแก้ใช้ RSC tests เดียวกันโดยถอด wrapper ชั่วคราว: concurrent case ได้ 2 calls ต่อ mock ที่นับ และ resolved case เรียก account resolver 2 ครั้ง. หลังแก้ tests เดียวกันยืนยัน 1 call ต่อ mock ที่นับในแต่ละกรณี. ตัวเลขนี้เป็น execution counts ของ mocks ไม่ใช่ Prisma delegate หรือ SQL statement counts.

### Verification ที่รัน

- `npm run test -- __tests__/auth/current-user-projection.test.ts modules/auth/application/sessions.test.ts __tests__/api/auth-me.test.ts __tests__/dashboard-route-access.test.ts` — ผ่าน 4 files, 42 tests.
- ก่อนแก้ cache: `npm run test -- __tests__/auth/current-user-projection.test.ts -t "deduplicates concurrent projection calls within one RSC render request"` — ล้มเหลวตามที่คาดใน baseline; ทั้ง 4 mock execution counts เป็น 2.
- `npm run architecture:check` — ผ่าน; ตรวจ module boundaries 1,318 source files.
- `npm run lint:strict` — ผ่าน.
- `npm run typecheck` — ผ่าน.
- ไม่รัน full test suite, integration database suite หรือ production build.

### Security invariants และข้อจำกัด

- การตรวจ JWT, active session family, account state, Employee lifecycle, Team projection, Leave rules และ capability resolution ยังทำใน body เดิมทุกครั้งที่เริ่ม RSC request ใหม่. มี test ยืนยัน unauthorized/revoked resolver และ inactive Employee ยังได้ `null`; test เดิมยืนยัน projection value และ capabilities ครบตาม contract.
- เพิ่ม test ให้ `resolveAuthenticatedAccount()` ปฏิเสธ access token เมื่อ session family ถูก revoke และไม่อ่าน account ต่อ. `/api/auth/me`, `HybridAuthProvider`, SWR, refresh-token rotation และ domain services ไม่ได้แก้.
- RSC boundary test ใช้ React Flight renderer ที่ติดตั้งมากับ Next; service/persistence dependencies ถูก mock. ไม่ได้ยิง full Next HTTP server หรือฐานข้อมูลจริง; Prisma query events, SQL counts และ production DB savings ยัง **NOT MEASURED**. ข้อจำกัด Phase 0 เรื่อง app port และ integration DB เปล่ายังคงอยู่.

### Phase 2 readiness

Phase 2 ยัง **ไม่พร้อมเริ่ม** จากหลักฐานปัจจุบัน. Phase 1 พิสูจน์การลด projection execution ซ้ำภายใน RSC request ได้ แต่ยังไม่พิสูจน์ต้นทุน SQL ของ TeamMembership/TeamRole/User grant reads. ก่อนรวม authorization reads ให้เก็บ query-event หรือ SQL statement counts ที่ผูกกับ request บน integration environment ที่มี schema และข้อมูลทดสอบจริง พร้อมแยกตาม query family.
