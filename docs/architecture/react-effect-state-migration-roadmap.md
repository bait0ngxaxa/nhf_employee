# Phase L5A — `react-hooks/set-state-in-effect` Architecture Classification & Migration Roadmap

สถานะปัจจุบัน (2026-09-23): migration L5A–L5K เสร็จสิ้น `react-hooks/set-state-in-effect` เปิดใช้ทั่ว repository และไม่เหลือ diagnostics; inventory 58 รายการและแผนด้านล่างเป็น baseline ประวัติของ Phase L5A

Phase L5A เป็น **audit / architecture analysis เท่านั้น** ไม่มี production code, tests, `eslint.config.mjs` หรือ suppression ใดถูกแก้ใน phase นั้น

เป้าหมายปลายทางที่ยังคงบังคับใช้คือ:

```text
react-hooks/set-state-in-effect = globally enabled
```

การปิด rule ใน Phase L5A เป็น migration debt ชั่วคราว ไม่ใช่ policy ถาวรของสถาปัตยกรรม

## Executive Summary

- inventory ณ Phase L5A จาก source จริงคือ **58 diagnostics ใน 38 ไฟล์**
- จำนวน 58 ตรงกับ expected baseline หลัง L2A ที่ลบออก 3 จาก 61 รายการเดิม จึงไม่พบ discrepancy ของจำนวน
- historical B/D ใช้เป็นหลักฐานประกอบเท่านั้น ไม่ได้ใช้เป็นคำตัดสินสุดท้าย
- หลังอ่าน lifecycle จริงแล้ว ไม่พบ finding ที่เป็น Pattern A หรือ B แบบบริสุทธิ์เหลืออยู่: 3 รายการ B ที่ปลอดภัยถูกแก้ใน L2A ส่วน B ที่เหลือเป็น capability, URL, pagination หรือ disclosure transition ที่มี driver ภายนอกและไม่ใช่ event-owned ล้วน ๆ
- Pattern ที่พบมากที่สุดคือ permission/capability-driven lifetime 16 รายการ, dialog/session reset 10 รายการ และ URL/router synchronization 8 รายการ
- risk: Low 3, Medium 14, High 41
- readiness: safe to remediate now 4, needs targeted investigation 17, not safe without architecture change 37
- proposed migration จะลดครบ 58 รายการตามลำดับ pattern โดยไม่ใช้ mechanical rewrite เป็นเกณฑ์ตัดสิน
- ไม่พบ final exception candidate ที่มีหลักฐานเพียงพอในรอบนี้ จึงตั้งเป้า zero reviewed local exceptions ไว้ก่อน

## Scope and Non-goals

รวมเฉพาะ diagnostics ที่ได้จาก:

```text
react-hooks/set-state-in-effect:error
```

ไม่รวม rule อื่น, diagnostics ที่ไม่ได้ถูก rule รายงาน, การแก้ business behavior หรือการเปิด rule ถาวร

Phase นี้จงใจไม่ทำสิ่งต่อไปนี้:

- ไม่แก้ production source
- ไม่แก้ tests
- ไม่แก้ `eslint.config.mjs`, `package.json`, `next.config.ts` หรือ scripts
- ไม่เพิ่ม `eslint-disable`, `setTimeout`, `queueMicrotask`, `Promise.resolve().then(...)` หรือการย้าย setter ไปอีก effect เพื่อหลบ lint
- ไม่ implement ratchet
- ไม่รัน test suite, build หรือ development server

## Authority and Audit Method

### Installed versions and rule behavior

ตรวจจาก workspace ปัจจุบัน:

- `next@16.3.3`
- `react@19.2.8`
- `eslint-config-next@16.3.3`
- `eslint-plugin-react-hooks@7.1.1`

อ่าน implementation ที่ติดตั้งอยู่ใน:

```text
node_modules/eslint-plugin-react-hooks/cjs/eslint-plugin-react-hooks.development.js
```

implementation ระบุว่า rule นี้ตรวจการเรียก `setState` แบบ synchronous ใน effect และอธิบายว่า effect ควรทำอย่างใดอย่างหนึ่งเป็นหลัก:

- update external system ด้วย state ล่าสุดจาก React
- subscribe external system และเรียก setState จาก callback เมื่อ external system เปลี่ยน

การเรียก asynchronous helper จาก effect จะยังถูก report ได้ถ้า helper มี synchronous loading/reset setter ก่อน `await` เช่น `loadHome()` และ `fetchEmailRequests()` ดังนั้นตารางจะแยก synchronous prelude ออกจาก async result setter ให้ชัดเจน

### Official React and Next.js guidance

ใช้เอกสารทางการของ React ผ่าน Context7 และอ่าน rule implementation ที่ติดตั้งจริง:

- [You Might Not Need an Effect](https://react.dev/learn/you-might-not-need-an-effect)
- [React `set-state-in-effect` lint rule](https://react.dev/reference/eslint-plugin-react-hooks/lints/set-state-in-effect)
- [Preserving and Resetting State](https://react.dev/learn/preserving-and-resetting-state)
- [React `useSyncExternalStore`](https://react.dev/reference/react/useSyncExternalStore)

อ่านเอกสาร Next.js ที่ติดตั้งใน `node_modules/next/dist/docs` โดยเฉพาะ:

- `01-app/02-guides/preserving-ui-state.md`
- `01-app/01-getting-started/05-server-and-client-components.md`
- `01-app/03-api-reference/04-functions/use-pathname.md`

หลักการที่ใช้ในการจัดหมวดคือ:

> Effects มีไว้เพื่อ synchronize React กับ external systems เป็นหลัก ไม่ใช่เป็น event bus หรือที่เก็บ derived state หากการกำจัด effect ทำให้ lifecycle, session, cancellation, URL navigation, permission boundary หรือ data invariant เปลี่ยน ต้อง redesign ownership ก่อน ไม่ใช่ย้าย setter เพียงให้ lint ผ่าน

### Inventory command and result

คำสั่งที่กำหนดใน audit ถูกเรียกแบบ machine-readable โดยตรง:

```text
npx eslint . --rule "react-hooks/set-state-in-effect:error" --format json
```

บน PowerShell ของ workspace ใช้ `npx.cmd` ที่เทียบเท่ากัน และ parse JSON ใน memory โดยไม่เขียน raw output ลง repository

ผลปัจจุบัน:

```text
Total current diagnostics: 58
Unique affected files: 38
```

ผล 58 ตรงกับ expected inventory หลัง L2A:

```text
61 historical diagnostics
- 3 L2A fixes
= 58 current diagnostics
```

historical B/D จาก audit เดิมจึง reconcile เป็น B 15 และ D 43 สำหรับรายการที่ยังเหลืออยู่ แต่การจัดหมวดด้านล่าง re-evaluate ใหม่ทั้งหมดจาก source ปัจจุบัน

## Current Inventory by File

| ไฟล์ | Diagnostics |
| --- | ---: |
| `components/dashboard/layout/DashboardSidebarPrimitives.tsx` | 1 |
| `components/dashboard/sections/DashboardHomeSection.tsx` | 1 |
| `components/liff/home/LiffHomeApp.tsx` | 1 |
| `components/theme/ThemeSelector.tsx` | 1 |
| `components/ui/async-form-dialog.tsx` | 1 |
| `hooks/useEmailRequestHistory.ts` | 1 |
| `hooks/use-mobile.ts` | 1 |
| `modules/authorization/presentation/dashboard/components/AuthorizationDialogs.tsx` | 5 |
| `modules/employee/presentation/dashboard/context/EmployeeProvider.tsx` | 1 |
| `modules/leave/presentation/dashboard/components/LeaveAttachmentViewerDialog.tsx` | 1 |
| `modules/leave/presentation/dashboard/hooks/useApproverManagementModel.ts` | 1 |
| `modules/leave/presentation/dashboard/hooks/useEmployeeLeaveDashboardModel.ts` | 1 |
| `modules/leave/presentation/dashboard/hooks/useManagerApprovalModel.ts` | 1 |
| `modules/leave/presentation/dashboard/LeaveManagementSection.tsx` | 2 |
| `modules/leave/presentation/liff/LiffLeaveApp.tsx` | 2 |
| `modules/leave/presentation/liff/LiffLeaveDecisionSheet.tsx` | 1 |
| `modules/leave/presentation/liff/LiffLeaveHistory.tsx` | 1 |
| `modules/routine/presentation/dashboard/RoutineImportPanel.tsx` | 2 |
| `modules/routine/presentation/dashboard/RoutineOccurrenceEditDialog.tsx` | 1 |
| `modules/routine/presentation/dashboard/RoutineOccurrenceList.tsx` | 1 |
| `modules/routine/presentation/dashboard/RoutineScheduleFields.tsx` | 1 |
| `modules/routine/presentation/dashboard/RoutineSection.tsx` | 6 |
| `modules/routine/presentation/dashboard/RoutineTaskList.tsx` | 1 |
| `modules/routine/presentation/liff/LiffRoutineApp.tsx` | 2 |
| `modules/routine/presentation/liff/LiffRoutineTaskDetail.tsx` | 1 |
| `modules/routine/presentation/liff/LiffRoutineTaskForm.tsx` | 1 |
| `modules/stock/presentation/dashboard/components/StockAdminInventory.tsx` | 1 |
| `modules/stock/presentation/dashboard/components/StockAdminRequests.tsx` | 1 |
| `modules/stock/presentation/dashboard/components/StockBrowse.tsx` | 1 |
| `modules/stock/presentation/dashboard/components/StockInventoryAddItemDialog.tsx` | 1 |
| `modules/stock/presentation/dashboard/components/StockMyRequests.tsx` | 1 |
| `modules/stock/presentation/dashboard/components/StockRequestCancelDialog.tsx` | 1 |
| `modules/stock/presentation/dashboard/components/StockVariantPickerDialog.tsx` | 1 |
| `modules/stock/presentation/dashboard/components/useStockBrowseCart.ts` | 1 |
| `modules/stock/presentation/dashboard/context/StockProvider.tsx` | 5 |
| `modules/stock/presentation/liff/components/LiffStockApp.tsx` | 4 |
| `modules/stock/presentation/liff/components/LiffStockDecisionSheet.tsx` | 1 |
| `modules/stock/presentation/liff/components/LiffStockVariantPicker.tsx` | 1 |
| **รวม** | **58** |

## Per-finding Classification

### Reading the table

- `Previous` คือ B/D จาก historical audit เท่านั้น
- `Root pattern` คือ primary state-ownership pattern ของ finding นั้น หากมี secondary concern ระบุไว้ใน Notes
- `No — architecture change required` หมายถึงย้าย setter อย่างปลอดภัยไม่ได้จนกว่าจะย้าย owner หรือ lifecycle ไม่ได้หมายถึง permanent exception
- location ใช้ line/column จาก inventory ปัจจุบัน และ `SSE-*` เป็น stable identity ที่ไม่ผูกกับ line number

| ID | File | Current line / location | Previous audit class | Root pattern | State being written | Driving value / source | Current source of truth | Why effect exists | Recommended long-term architecture | Can safely remediate now? | Risk | Suggested migration phase | Required focused tests | Notes / invariants |
| --- | --- | ---: | :---: | --- | --- | --- | --- | --- | --- | --- | :---: | --- | --- | --- |
| SSE-001 | `components/dashboard/layout/DashboardSidebarPrimitives.tsx` | 178:9 | B | E — capability-driven lifetime with user-owned expansion | `expandedGroups` | `availableMenuGroups` จาก menu/capability projection | user toggle เป็นหลัก และ group ใหม่จาก source menu | auto-expand group ที่เพิ่งพร้อมใช้งานโดยไม่เปิด group ที่ user ยุบไว้ใหม่ทั้งหมด | แยก availability ออกจาก explicit user overrides หรือสร้าง capability-owned sidebar subtree; ห้าม derive จนทำลาย manual collapse | No — architecture change required | Medium | L5E | `__tests__/components/DashboardSidebar.test.tsx`; เพิ่ม new-group, collapse, remove และ re-grant sequence | ห้ามให้ group ที่หายจาก capability โผล่กลับมาเมื่อ capability กลับมาโดยไม่ตั้งใจ; UI visibility ไม่ใช่ authorization boundary |
| SSE-002 | `components/dashboard/sections/DashboardHomeSection.tsx` | 277:9 | D | H — hydration/client readiness and time-dependent presentation | `greeting` | เวลาปัจจุบันตอน client mount | wall clock plus rendered server/client output | ป้องกัน greeting จาก server กับ client ต่างกันในช่วง hydration | ส่ง stable time bucket จาก server หรือย้าย greeting ไป client-only boundary ที่มี fallback deterministic; ไม่ใช้ lazy state ที่ยังทำให้ SSR/client ต่างกัน | Needs targeted investigation | Medium | L5G | `__tests__/components/DashboardHomeSection.test.tsx`; ทดสอบชั่วโมงข้ามช่วงและ SSR/client output | เปลี่ยน greeting ได้ตามเวลาไทย แต่ห้ามเกิด hydration mismatch หรือ Thai text เพี้ยน |
| SSE-003 | `components/liff/home/LiffHomeApp.tsx` | 193:14 | D | J — async workflow / fetched-result lifecycle | synchronous `setState("LOADING")` และ `setViewError(null)` ภายใน `loadHome`; async result setters ไม่ใช่จุดเดียวกัน | mount effect หรือ retry action และ `fetchLiffHome()` | remote home response เป็น source ของ `home`; local request state เป็น state machine | effect เริ่ม bootstrap และ helper reset loading/error ก่อน `await` | ใช้ query/request lifecycle owner หรือแยก mount fetch ออกจาก retry transition โดยยังคง cancellation, retry และ safe error copy | No — architecture change required | High | L5K | `__tests__/components/LiffHome.test.tsx`; initial loading, retry, error และ stale response | ห้ามแก้ด้วยการหน่วง setter; ต้องคง initial LOADING, retry ได้ และ response เก่าห้ามทับ state ใหม่ |
| SSE-004 | `components/theme/ThemeSelector.tsx` | 36:9 | D | H — hydration/client readiness | `mounted` | client hydration และ `next-themes` readiness | `next-themes` เป็น authority ของ theme; `mounted` เป็น readiness gate ของ UI | ไม่ให้ radio value จาก theme ที่ยังอ่าน client ไม่เสร็จทำให้ hydration ต่าง | กำหนด server-safe placeholder/client boundary ตาม contract ของ `next-themes`; คง `html suppressHydrationWarning` และไม่แสดงค่าหลอก | Needs targeted investigation | Medium | L5G | `__tests__/components/ThemeSelector.test.tsx`; hydration/first client render และ theme switching | ห้ามแสดงหรือบันทึก theme ผิดเพราะตัด readiness gate ออกเร็วเกินไป |
| SSE-005 | `components/ui/async-form-dialog.tsx` | 92:7 | D | D — dialog/session reset | `discardConfirmationOpen` | `open` จาก parent | parent owns main dialog; primitive owns discard confirmation | ปิด AlertDialog ที่ค้างอยู่เมื่อ main dialog ถูกปิดจากภายนอก | ทำให้ dialog session เป็น owner เดียว ใช้ explicit close transition หรือ remount keyed session โดยรักษ dirty/discard/focus behavior | Needs targeted investigation | High | L5C | เพิ่ม test ของ primitive และ `LeaveRequestForm`, `AuthorizationDialogs`; close externally, cancel discard, reopen | เป็น shared primitive หลาย caller; ต้องไม่ทำให้ unsaved draft, focus restoration หรือ busy guard เปลี่ยน |
| SSE-006 | `hooks/useEmailRequestHistory.ts` | 87:9 | D | J — async workflow / fetched-result lifecycle | `isLoading` และ `error` แบบ synchronous prelude ใน `fetchEmailRequests()`; result setters อยู่หลัง `await` | `currentPage` และ `refreshTrigger` | `/api/email-request` response plus request lifecycle state | effect fetch เมื่อ mount, page หรือ refresh เปลี่ยน | ย้าย request/loading/error ownership ไป SWR/query hook หรือ reducer ที่นิยาม request identity และ stale response | No — architecture change required | High | L5K | เพิ่ม focused hook test; page, refresh, success, API error, retry และ out-of-order response | ต้องคง page clamp, loading transition และ sanitized error; อย่าสรุปว่า async setter ทุกตัวเป็นปัญหาเดียวกัน |
| SSE-007 | `hooks/use-mobile.ts` | 14:5 | D | I — browser/external-system subscription | `isMobile` initial snapshot | `window.matchMedia`, `window.innerWidth`, change event | browser viewport | effect subscribe `matchMedia` และอ่าน snapshot ครั้งแรก | ใช้ `useSyncExternalStore` พร้อม `getSnapshot`, `subscribe` และ SSR snapshot ที่ปลอดภัย | No — architecture change required | Medium | L5H | เพิ่ม hook test; initial viewport, change event, cleanup และ SSR snapshot | ต้องไม่ทำให้ mobile UI flash หรืออ่าน `window` ระหว่าง server render; callback update ยังเหมาะกับ external store |
| SSE-008 | `modules/authorization/presentation/dashboard/components/AuthorizationDialogs.tsx` | 112:9 | D | C — incoming entity/prop to editable form initialization | `key`, `name`, `description`, `error` ของ team form | `open`, `mode`, `team` | local editable draft ระหว่าง dialog session; `team` เป็น baseline | เปิดหรือเปลี่ยน entity แล้วสร้าง draft ใหม่และล้าง error | key editor ด้วย `mode + team.id` หรือ mount editor instance ใหม่; ใช้ explicit session initialization โดยไม่ derive draft จาก prop ทุก render | Needs targeted investigation | High | L5D | `modules/authorization/presentation/dashboard/components/AuthorizationDialogs.test.tsx`; create/edit, entity switch, dirty close/reopen | ต้อง preserve unsaved edits ภายใน session, generate technical key ครั้งเดียวต่อ session และไม่เปลี่ยน mutation payload |
| SSE-009 | `modules/authorization/presentation/dashboard/components/AuthorizationDialogs.tsx` | 222:9 | D | C — incoming entity/prop to editable form initialization | `key`, `name`, `error` ของ role form | `open`, `mode`, `role` | local role draft; `role` เป็น baseline | เปิดหรือเปลี่ยน role แล้ว initialize draft | keyed role editor หรือ explicit begin-edit boundary ที่ผูกกับ role identity | Needs targeted investigation | High | L5D | `AuthorizationDialogs.test.tsx`; create/edit, role switch, dirty state และ error reset | ต้องไม่ล้างชื่อที่ user กำลังแก้เมื่อ parent re-render โดยไม่ใช่ session ใหม่ |
| SSE-010 | `modules/authorization/presentation/dashboard/components/AuthorizationDialogs.tsx` | 315:9 | D | D — dialog/session reset | `selectedUserId`, `teamRoleId`, `error` และ parent `directoryQuery` | `open` | local selection plus parent-owned directory query | เริ่ม Add Member session ใหม่และคืน search/query ให้สะอาด | mount keyed by team/session และให้ parent event เปิด/initialize query อย่างชัดเจน | Needs targeted investigation | High | L5C | `AuthorizationDialogs.test.tsx`, `TeamAdministration.test.tsx`; open, search, selection, close, reopen | `query` เป็น state ของ parent จึงห้ามย้าย reset แบบ local-only แล้วทิ้ง parent query ค้าง |
| SSE-011 | `modules/authorization/presentation/dashboard/components/AuthorizationDialogs.tsx` | 456:9 | D | D — dialog/session reset | `query`, `capabilityKey`, `scope`, `step`, `error` | `open` | local multi-step grant wizard | เปิด grant session ใหม่ต้องกลับ step choose และไม่มี error | keyed/remounted wizard หรือ explicit `beginGrantSession`/`discardGrantSession` reducer | Needs targeted investigation | High | L5C | `AuthorizationDialogs.test.tsx`; choose → review, back, close, reopen, source switch | effective scope normalization จาก L2A ต้องยังคงใช้กับ review และ mutation payload |
| SSE-012 | `modules/authorization/presentation/dashboard/components/AuthorizationDialogs.tsx` | 689:19 | D | D — dialog/session reset | `error` ของ confirm action | `open` | local transient mutation error | เปิด action ใหม่ต้องไม่แสดง error จากครั้งก่อน | ให้ caller/session identity เป็น owner ของ reset หรือ key confirm instance; shared primitive behavior ต้องชัดเจน | Needs targeted investigation | Low | L5C | `AuthorizationDialogs.test.tsx`, `GrantList.test.tsx`; failed confirm, close, reopen, new target | error reset นี้ low risk แต่ component ใช้หลาย target และไม่ควรแก้ด้วย hidden stale error ที่ยัง submit ได้ |
| SSE-013 | `modules/employee/presentation/dashboard/context/EmployeeProvider.tsx` | 279:13 | D | E — permission/capability-driven lifetime | `isEditFormOpen`, `employeeToEdit` | `canUpdateEmployees` | server-derived capability plus provider UI state | ปิด editor และล้าง entity เมื่อ capability ถูกถอน | capability ต้องควบคุมการมีอยู่ของ editor subtree; ย้าย session state ให้ใกล้ editor และใช้ key ตาม employee identity ที่มีอยู่แล้วใน `EmployeeModals` | No — architecture change required | High | L5E | `modules/employee/presentation/dashboard/context/EmployeeProvider.test.tsx`, `EmployeeModals` flow; revoke while open | authorization ต้องยัง fail closed ที่ server; conditional mount เป็น UX/lifecycle ไม่ใช่ security enforcement |
| SSE-014 | `modules/leave/presentation/dashboard/components/LeaveAttachmentViewerDialog.tsx` | 73:9 | D | D — dialog/session reset with external resource cleanup | `imageStates` | `open` และ `attachments` | local image cache plus `AbortController` และ object URLs | เริ่ม viewer session ใหม่และไม่ให้ image/blob จาก attachment เดิมปนกับชุดใหม่ | keyed viewer session หรือ resource-owning reducer/child ที่ผูก cleanup กับ attachment set; คง abort/revoke semantics | Needs targeted investigation | High | L5C | `LeaveAttachmentViewerDialog.test.tsx`; reopen, attachment switch, abort, object URL revoke และ stale fetch | displayed page/image state ต้องไม่แสดง blob ผิดรายการ และทุก object URL ต้อง revoke |
| SSE-015 | `modules/leave/presentation/dashboard/hooks/useApproverManagementModel.ts` | 81:9 | B | G — pagination reconciled with changing data | `currentPage` | `totalPages` จาก filtered employee data | user page plus filtered list length | clamp page เมื่อ search/filter/data ทำให้จำนวนหน้าลดลง | pagination reducer/query owner ที่กำหนด page invariant และ rebound behavior; ห้าม derive แค่ effective page | No — architecture change required | High | L5I | `useApproverManagementModel.test.ts`; shrink, clamp, then grow, search/filter and save refresh | ห้ามซ่อน stale page ไว้ใน display เพราะเมื่อ totalPages โตขึ้น state เก่าอาจกลับมา |
| SSE-016 | `modules/leave/presentation/dashboard/hooks/useEmployeeLeaveDashboardModel.ts` | 128:13 | D | E — permission/capability-driven lifetime | request form, cancel target/reason, not-taken target/note | leave capabilities | server capability projection plus local modal/draft state | ล้าง state ที่เปิดอยู่เมื่อ capability ถูกถอน | capability-gated child subtrees and explicit capability transition owner; keep server auth authoritative | No — architecture change required | High | L5E | `useEmployeeLeaveDashboardModel.test.ts`, `LeaveManagementSection.test.tsx`; each capability loss while active | ห้ามเปิด form/action ต่อหลังสิทธิ์หาย และต้องไม่ล้าง unrelated history/filter state โดยไม่จำเป็น |
| SSE-017 | `modules/leave/presentation/dashboard/hooks/useManagerApprovalModel.ts` | 133:13 | D | E — permission/capability-driven lifetime | selected leave, approval confirm, reject dialog/reason | `canApproveAssignedRequests` | server capability plus local approval workflow | ปิด approval controls เมื่อ capability ถูกถอน | mount approval workflow only under capability boundary หรือ reducer handles capability transition explicitly | No — architecture change required | High | L5E | `useManagerApprovalModel.test.ts`, `ManagerApprovalDashboard.test.tsx`; revoke while selected/rejecting | UI gating ไม่แทน server authorization; action APIs ต้องยังตรวจสิทธิ์ฝั่ง server |
| SSE-018 | `modules/leave/presentation/dashboard/LeaveManagementSection.tsx` | 40:13 | B | F — URL/router/deep-link to local tab synchronization | `activeTab` | `defaultTab` จาก dashboard URL/deep link | URL/navigation intent กับ user-selected local tab ยัง mirror กัน | ให้ deep link เปลี่ยน tab แม้ component ยัง mounted | ทำ URL หรือ route navigation เป็น canonical source หรือ key section ตาม route session; กำหนด Back/Forward semantics ก่อนลบ effect | No — architecture change required | High | L5J | `LeaveManagementSection.test.tsx`; initial deep link, rerender URL, user tab, Back/Forward | ห้ามใช้ `defaultTab` ชื่อ initial-only ทั้งที่ value เปลี่ยนจากภายนอกจริง |
| SSE-019 | `modules/leave/presentation/dashboard/LeaveManagementSection.tsx` | 45:9 | D | H — hydration/client readiness | `isMounted` | client mount | client readiness gate ของ `SectionTabs` | เลื่อนการ render tabs ที่อาศัย client-only state ออกจาก server HTML | ใช้ stable server fallback/client boundary ที่ hydration-compatible; ตรวจว่าการ render child ซ้ำไม่สร้าง duplicate data work | Needs targeted investigation | Medium | L5G | `LeaveManagementSection.test.tsx`; server fallback, first client render, capability/tab visibility | ห้ามตัด gate แล้วทำให้ tab content หรือ active value ต่างระหว่าง hydration |
| SSE-020 | `modules/leave/presentation/liff/LiffLeaveApp.tsx` | 292:14 | D | J — async workflow / fetched-result lifecycle | initial state/error/profile/approval reset ผ่าน `loadInitialData()` ก่อน `await` | mount effect และ explicit refresh; `fetchLiffHome`/profile/approvals | remote responses plus request sequence refs | bootstrap ต้อง reset state, load capability/profile และ reject stale responses | request state machine/query owner with explicit `start`, `success`, `error`, cancellation; keep sequence/race semantics | No — architecture change required | High | L5K | `modules/leave/presentation/liff/LiffLeaveApp.test.tsx`; bootstrap, retry, stale response, capability projection | ต้องคง `requestSequence` guards, capability-safe empty state และ approval refresh ordering |
| SSE-021 | `modules/leave/presentation/liff/LiffLeaveApp.tsx` | 338:13 | D | F — URL/deep-link validation to one-shot UI notice | `focusNotice` | invalid `requestId` from `useSearchParams` | URL plus `deepLinkHandledRef` one-shot guard | แสดง warning เมื่อ deep link invalid หลัง app READY โดยไม่ยิง request | validate/normalize deep link at navigation boundary หรือ explicit URL-intent handler; อย่า derive notice ที่บังคับแสดงตลอด | No — architecture change required | Medium | L5J | `LiffLeaveApp.test.tsx`; invalid link, repeated render, valid link, clear/retry | ต้องไม่เปิดข้อมูลที่ไม่ได้รับอนุญาต และไม่ให้ notice เก่ากลับมาเมื่อ query ถูกล้าง |
| SSE-022 | `modules/leave/presentation/liff/LiffLeaveDecisionSheet.tsx` | 136:21 | D | D — dialog/session reset | `reason` | `intent` identity | local editable reason for one decision session | intent ใหม่ต้องเริ่มเหตุผลว่าง | key sheet by request/action session หรือ parent เปิด session ใหม่อย่าง explicit | Yes | Medium | L5B | `modules/leave/presentation/liff/LiffLeaveComponents.test.tsx`; edit reason, switch intent, close/reopen | ห้ามใช้ derived `reason = intent ? "" : ...` จน user พิมพ์แล้วถูกล้างระหว่าง render เดียวกัน |
| SSE-023 | `modules/leave/presentation/liff/LiffLeaveHistory.tsx` | 243:19 | D | C — incoming applied filters to editable filter draft | `draft` | `filters` และ `open` | parent-applied filters เป็น committed value; sheet draft เป็น editable value | เปิด sheet ต้อง copy committed filters เข้า draft | keyed filter session หรือ explicit `beginFilterEdit(filters)`/`applyFilter(draft)` boundary | Needs targeted investigation | High | L5D | `modules/leave/presentation/liff/LiffLeaveComponents.test.tsx`; open, edit, apply, cancel, parent filter refresh | ห้าม derive input value ตรงจาก committed filters เพราะจะทำลาย independent editing |
| SSE-024 | `modules/routine/presentation/dashboard/RoutineImportPanel.tsx` | 411:18 | D | J — async reference workflow | `referenceLoading`, `referenceError`, `reference`, `referenceBatchKey` ผ่าน `loadReference()` | `currentReferenceBatchKey` จาก batch/version | reference API response keyed by batch version | โหลด reference เมื่อ batch identity เปลี่ยน พร้อม request sequence guard | ใช้ SWR/query keyed by batch/version หรือ dedicated request lifecycle owner; preserve cancellation and no stale reference | No — architecture change required | High | L5K | `RoutineImportPanel.test.tsx`; batch/version change, race, error, retry | reference ต้อง match batch version เดียวกันเท่านั้น; ห้ามแสดง reference เก่าระหว่างกำลังโหลดใหม่ |
| SSE-025 | `modules/routine/presentation/dashboard/RoutineImportPanel.tsx` | 415:14 | D | J — async batch/rows workflow | `loading`, `error`, `batch`, `rowsPage` ผ่าน `loadBatch()` | batch id, page, filters, debounced search, selected-only | batch/rows API response plus request UI state | refetch เมื่อ query identity หรือ page เปลี่ยน และตั้ง loading/error ก่อน `Promise.all` | query lifecycle keyed by full request identity หรือ reducer ที่มี cancellation/stale response policy | No — architecture change required | High | L5K | `RoutineImportPanel.test.tsx`; filter/page/search, concurrent responses, error, retry, toast identity | ต้องคง `uploadToastBatchIdRef`, row/page result pairing และไม่ให้ response เก่าทับ batch ใหม่ |
| SSE-026 | `modules/routine/presentation/dashboard/RoutineOccurrenceEditDialog.tsx` | 105:9 | D | C — incoming occurrence to editable form initialization | `editor`, `error` | `occurrence` และ `open` | local occurrence draft; server occurrence เป็น initial snapshot | เปิดหรือเปลี่ยน occurrence ต้องสร้าง editor ใหม่ | key dialog/editor ด้วย occurrence identity หรือ explicit `beginEditOccurrence`; preserve draft while same session | Needs targeted investigation | High | L5D | เพิ่ม `RoutineOccurrenceEditDialog` focused test หรือใช้ `RoutineOccurrenceList.test.tsx`; identity switch, dirty edit, reopen, save | ห้าม derive editor field จาก occurrence ทุก render เพราะจะ overwrite user edits |
| SSE-027 | `modules/routine/presentation/dashboard/RoutineOccurrenceList.tsx` | 75:13 | D | E — permission/capability-driven lifetime | `occurrenceEditTask`, `occurrenceEditOpen` | `canOverrideOccurrences` | server capability plus local dialog target | ปิด occurrence editor เมื่อ capability หาย | conditional mount of privileged editor and explicit capability boundary; keep server enforcement | No — architecture change required | High | L5E | `RoutineOccurrenceList.test.tsx`; capability loss while editor open and re-grant | ต้องไม่ให้ stale selected task กลับมาเปิดเมื่อ permission กลับมาโดยไม่ user action |
| SSE-028 | `modules/routine/presentation/dashboard/RoutineScheduleFields.tsx` | 149:51 | B | K — disclosure/validation auto-open once | `contractOpen` | contract data/error flags | user controls disclosure; form values and validation decide when attention is required | เปิด section เมื่อ data หรือ validation error ปรากฏ แต่ยังให้ user ยุบได้ | validation/input event เป็น owner ของ one-shot open transition หรือ reducer แยก `autoOpened` จาก `userClosed`; ห้าม force-open จาก derived boolean ตลอดเวลา | Needs targeted investigation | Medium | L5F | เพิ่ม focused test ของ `RoutineScheduleFields` ผ่าน `RoutineTaskForm.test.tsx`; data/error appears then user collapses | `open = hasContractData || hasContractErrors` ไม่เทียบเท่า เพราะจะบังคับเปิดตลอด |
| SSE-029 | `modules/routine/presentation/dashboard/RoutineSection.tsx` | 130:9 | B | G — pagination/query-identity reconciliation | `page` | filters, debounce, scope และ task/occurrence deep-link inputs | local page plus remote query identity | reset page เมื่อ query identity เปลี่ยนเพื่อไม่ให้ page เก่าชี้ไปข้อมูลว่าง | central query reducer or route/query owner; event handlers reset known local changes, external deep links use explicit reconciliation | No — architecture change required | High | L5I | `RoutineSection.test.tsx`; filter change, deep link change, remote empty page, browser navigation | input บางตัวมาจาก URL ภายนอก จึงไม่ใช่ pure event-owned transition; ห้ามลบ effect แล้วพึ่งเฉพาะ handlers |
| SSE-030 | `modules/routine/presentation/dashboard/RoutineSection.tsx` | 141:13 | D | E — permission/capability-driven lifetime | `editingTaskId` | `canUpdateTasks` | server capability plus local edit selection | ปิด task editor เมื่อ update permission หาย | capability-owned editor subtree or explicit capability transition action | No — architecture change required | High | L5E | `RoutineSection.test.tsx`; revoke while edit data loading/open and re-grant | server route authorization ต้องคงเดิม; UI close เป็น safety/lifecycle response |
| SSE-031 | `modules/routine/presentation/dashboard/RoutineSection.tsx` | 358:13 | D | E — permission/capability-driven lifetime | `isCreating`, `editingTask`, coupled `deleteError` reset | create/update capability and selected task capability | server capability plus local task editor state | remove inaccessible create/edit surface after capability changes | conditionally mount create/edit subtree by capability and move draft ownership into it | No — architecture change required | High | L5E | `RoutineTaskList.test.tsx`, `RoutineSection.test.tsx`; capability loss during create/edit and error state | ต้องไม่ resurrect stale draft เมื่อ permission กลับมา และ mutation server ต้องยัง fail closed |
| SSE-032 | `modules/routine/presentation/dashboard/RoutineSection.tsx` | 551:13 | B | E — capability-driven tab lifetime and hidden-state normalization | `activeTab` | `visibleRoutineTabs` and `safeTab` | user-selected tab plus capability visibility | repair an active tab that is no longer visible | capability boundary or explicit tab state machine with cleared invalid selection; prove no stale tab reappears after re-grant | No — architecture change required | High | L5E | `RoutineSection.test.tsx`; hide active tab, fallback, re-grant, user selection | derived `safeTab` alone is insufficient because stale `activeTab` can reappear when visibility returns |
| SSE-033 | `modules/routine/presentation/dashboard/RoutineSection.tsx` | 561:13 | B | F — URL/deep-link to local tab synchronization | `activeTab` | `taskId` or `occurrenceId` from URL | URL deep-link intent plus local selected tab | route task/occurrence deep link must land on `all` tab | make URL/deep-link route canonical or dispatch one explicit navigation intent before render; define tab/history contract | No — architecture change required | High | L5J | `RoutineSection.test.tsx`; task/occurrence deep links, requested tab conflict, Back/Forward | deep link can change while mounted, so handler-only reset is incomplete |
| SSE-034 | `modules/routine/presentation/dashboard/RoutineSection.tsx` | 568:13 | B | F — URL/router to local tab synchronization | `activeTab` | `searchParams.get("routineTab")` | URL and local tab currently mirror each other | browser/deep link URL changes must update current tab | URL-derived tab as canonical, with user action writing URL only when persistence is desired | No — architecture change required | High | L5J | `RoutineSection.test.tsx`; URL tab change, user tab change, invalid tab, Back/Forward | ห้ามสร้าง uncontrolled bidirectional loop หรือให้ URL tab bypass capability visibility |
| SSE-035 | `modules/routine/presentation/dashboard/RoutineTaskList.tsx` | 123:13 | D | E — permission/capability-driven lifetime | `deleteTask` | `canDeleteTasks` and task-level `canDelete` | capability plus local destructive-confirm target | close confirmation when selected task is no longer deletable | conditionally mount delete controls and clear target at capability boundary | No — architecture change required | Medium | L5E | `RoutineTaskList.test.tsx`; selected target loses permission/task capability | server delete authorization remains authoritative; no stale confirmation may submit |
| SSE-036 | `modules/routine/presentation/liff/LiffRoutineApp.tsx` | 149:13 | D | E — permission/capability-driven lifetime | `formMode`, `deleteError` | routine read/create/update/delete capabilities and detail editability | server capability projection plus local workflow state | close inaccessible form and clear delete error after capability projection changes | capability-gated editor/detail subtrees and explicit permission transition owner | No — architecture change required | High | L5E | `modules/routine/presentation/liff/LiffRoutine.test.tsx`; revoke/restore during create, edit, delete error | capability state from server remains authority; retain request sequence cleanup |
| SSE-037 | `modules/routine/presentation/liff/LiffRoutineApp.tsx` | 244:14 | D | J — async routine bootstrap lifecycle | `state`, `viewError`, `home`, `summary`, `tasks`, `pagination` through `loadRoutine()` | mount and initial deep-link IDs; routine APIs | remote responses plus request sequence refs | bootstrap resets/loads data synchronously before async requests | query/state-machine owner for routine bootstrap with explicit request identity and cancellation | No — architecture change required | High | L5K | `modules/routine/presentation/liff/LiffRoutine.test.tsx`; initial load, retry, focus IDs, stale response | preserve `routineRequestIdRef`, initial focused task behavior, loading/error/empty state |
| SSE-038 | `modules/routine/presentation/liff/LiffRoutineTaskDetail.tsx` | 133:9 | D | D — transient delete-confirm session; secondary concern: capability-driven lifetime | `deleteConfirmOpen` | `canDelete` and `detail?.id` | capability-gated confirmation session; detail identity keys a valid session but does not own capability lifetime | capability loss or detail change must destroy the confirmation session, not merely repair its open flag after render | move confirmation-open ownership into a child/session subtree mounted only when `canDelete && detail` is valid, keyed by `detail.id`; do not rely on detail identity alone to reset state across capability loss/re-grant | Yes | Low | L5B | `LiffRoutine.test.tsx`; open confirm, capability loss, confirm disappearance/unmount, re-grant on same detail, detail switch and close/reopen | invariant: open confirm → capability lost → confirm disappears and session state is destroyed → capability restored on same detail → confirmation remains closed; preserve unrelated detail loading and mutation-error state |
| SSE-039 | `modules/routine/presentation/liff/LiffRoutineTaskForm.tsx` | 280:60 | B | K — disclosure/validation auto-open once | `extraDetailsOpen` | `form.extraDetails` and `fieldErrors.extraDetails` | user disclosure state plus validation/error event | reveal extra details when content/error needs attention while allowing user collapse | submit/validation event owns opening or reducer records auto-opened versus user-closed | Needs targeted investigation | Medium | L5F | `RoutineTaskForm.test.tsx`, `LiffRoutine.test.tsx`; error appears, user collapses, next edit/submit | `open = hasError` would permanently force disclosure and change UX |
| SSE-040 | `modules/stock/presentation/dashboard/components/StockAdminInventory.tsx` | 46:13 | D | E — permission/capability-driven lifetime | `showAddItem`, `editingItem`, `showAddCategory` | `canManageInventory` | server capability plus local admin dialog state | close privileged inventory dialogs when permission disappears | conditionally mount admin controls/dialog subtree under capability | No — architecture change required | High | L5E | `StockInventoryDialogs.test.tsx`, `StockSection.test.tsx`; revoke while each dialog is open | UI gating is not server authorization; preserve no stale edit target on re-grant |
| SSE-041 | `modules/stock/presentation/dashboard/components/StockAdminRequests.tsx` | 76:13 | D | E — permission/capability-driven lifetime | `cancelTarget` | `canCancelAnyRequests` | server capability plus local cancel confirmation | close cancellation target when permission disappears | capability-owned cancellation dialog and explicit permission transition | No — architecture change required | Medium | L5E | `StockSection.test.tsx`; revoke while cancel target open | request mutation must still validate capability server-side |
| SSE-042 | `modules/stock/presentation/dashboard/components/StockBrowse.tsx` | 73:13 | D | E — permission/capability-driven lifetime | `variantPickerItem` | `canCreateRequests` | server capability plus local picker target | close request-creation picker when capability disappears | conditionally mount picker/creation subtree; do not retain inaccessible item target | No — architecture change required | High | L5E | `StockSection.test.tsx`, `useStockBrowseCart.test.ts`; revoke while picker/cart flow is active | cart/idempotency state and permission state are different owners; do not clear cart accidentally |
| SSE-043 | `modules/stock/presentation/dashboard/components/StockInventoryAddItemDialog.tsx` | 55:13 | D | D — dialog/session reset | `selectedCategoryId`, `itemImageUrl`, `variants` | `open` | local add-item draft session | close should discard form and open should guarantee at least one variant | conditional mount/keyed form session or explicit `resetDraft` at the open/close event boundary | Needs targeted investigation | High | L5C | เพิ่ม focused dialog test; close, reopen, category/image/variant draft and submit | uncontrolled form fields, variant invariants and file/image behavior must remain intact |
| SSE-044 | `modules/stock/presentation/dashboard/components/StockMyRequests.tsx` | 67:13 | D | E — permission/capability-driven lifetime | `cancelTarget` | `canCancelOwnRequests` | server capability plus local cancel confirmation | close own-request cancel UI when capability disappears | capability-gated cancel subtree and explicit transition owner | No — architecture change required | Medium | L5E | `StockSection.test.tsx`; revoke while target selected | do not let a stale target bypass ownership or status checks |
| SSE-045 | `modules/stock/presentation/dashboard/components/StockRequestCancelDialog.tsx` | 32:13 | D | D — dialog/session reset | `reason` | `request` becoming null | local reason draft for current request session | clear reason after dialog closes so next request does not inherit it | parent conditional mount/key by request session or explicit close action reset | Yes | Low | L5B | เพิ่ม focused dialog test; type reason, close, reopen same/different request | request prop is entity/session identity; do not preserve cancellation reason across requests |
| SSE-046 | `modules/stock/presentation/dashboard/components/StockVariantPickerDialog.tsx` | 72:13 | D | C — incoming item to editable picker initialization | `initializedItemId`, `activeVariantId`, `selectedQuantities`, preview state | `open`, `itemId`, `variants` | local picker draft plus current catalog item | close clears session; first open/item initializes active variant and quantities | key/remount picker by open session and item identity, with resource cleanup for preview | Needs targeted investigation | High | L5D | `StockInventoryDialogs.test.tsx`; item switch, close/reopen, selected quantities, Escape preview | preserving quantities for same open session and clearing them for a new session are distinct invariants |
| SSE-047 | `modules/stock/presentation/dashboard/components/useStockBrowseCart.ts` | 404:13 | D | I — browser/external persistence store | `cart`, `projectCode`, `hydratedStorageKey` and idempotency restoration | user-scoped `storageKey` and `window.localStorage` | localStorage persistence plus local cart/idempotency state | hydrate React state after client storage becomes available and user key changes | persistence adapter/external-store boundary with user-scoped snapshot, hydration status and optional subscription | No — architecture change required | High | L5H | `useStockBrowseCart.test.ts`; missing/present storage, user switch, stale key, idempotency and write-back | never mix users' carts; preserve idempotency and do not write default state before hydration completes |
| SSE-048 | `modules/stock/presentation/dashboard/context/StockProvider.tsx` | 117:9 | B | F — URL/router to local tab synchronization | `activeTab` | `tabFromUrl` from `useSearchParams` and capabilities | URL plus local tab state currently mirror | browser/deep-link URL changes must update provider state | URL canonical source; derive tab from normalized query and write URL only from tab action | No — architecture change required | High | L5J | `modules/stock/presentation/dashboard/context/StockProvider.test.tsx`; deep link, user tab, Back/Forward, capability invalidation | normalize capability before rendering; avoid bidirectional mirror loops |
| SSE-049 | `modules/stock/presentation/dashboard/context/StockProvider.tsx` | 124:9 | B | F — URL/router to local pagination synchronization | `requestsPage` | request page query parameter | URL and local page state | hydrate local request page when URL changes | derive page directly from URL or define a single router/query owner | No — architecture change required | High | L5J | `StockProvider.test.tsx`; page deep link, Back/Forward, request tab switching | request page must remain independent from item pages and preserve history semantics |
| SSE-050 | `modules/stock/presentation/dashboard/context/StockProvider.tsx` | 133:9 | B | F — URL/router to local query synchronization | browse page, inventory page, search query, category state | multiple stock search params plus `tabFromUrl` | URL is persistence source; local state provides immediate UI/query inputs | mirror several URL values into local state while event handlers also push/replace URL | one canonical URL projection with derived UI values; keep non-URL request filters local only | No — architecture change required | High | L5J | `StockProvider.test.tsx`, `provider.shared.test.ts`; all query fields, tab-specific page, Back/Forward, replace/push | do not lose inventory page key, search debounce semantics or category reset behavior |
| SSE-051 | `modules/stock/presentation/dashboard/context/StockProvider.tsx` | 421:13 | B | G — remote pagination reconciliation | item `itemsPage` | remote `itemsData.total`, active tab and page limit | local/URL page plus remote total | clamp page after data shrinks | explicit pagination reconciliation owner that updates local and URL atomically; prove shrink/grow rebound | No — architecture change required | High | L5I | `StockProvider.test.tsx`; total shrink, URL write-back, revalidation grow, tab switch | displayed effective page alone is not equivalent; stale page must not reappear unexpectedly |
| SSE-052 | `modules/stock/presentation/dashboard/context/StockProvider.tsx` | 429:18 | B | G — remote pagination reconciliation | request `requestsPage` | remote request total and page limit | local/URL page plus remote total | clamp request page after request data changes | same explicit reconciliation owner, with request-specific URL semantics | No — architecture change required | High | L5I | `StockProvider.test.tsx`; request total shrink/grow, filter reset, URL write-back | preserve request page when data revalidates unless invariant requires clamp |
| SSE-053 | `modules/stock/presentation/liff/components/LiffStockApp.tsx` | 384:14 | D | J — async capability bootstrap lifecycle | `stockHomeLoading`, `stockHomeError`, `stockCapabilities` through `loadStockCapabilities()` | mount effect and `fetchLiffHome()` | server capability response plus local loading/error | bootstrap sets loading/error before awaiting capability response | capability query/state machine with explicit initial/retry transition and safe empty projection | No — architecture change required | High | L5K | `modules/stock/__tests__/liff-app.test.tsx`; initial load, retry, missing capability, stale response | capability projection must remain trusted server response; no client-side role inference |
| SSE-054 | `modules/stock/presentation/liff/components/LiffStockApp.tsx` | 389:13 | D | E — permission/capability-driven lifetime | `variantPickerItem`, `cartOpen` | `stockCapabilities.canCreateRequests` | server capability plus local transient UI | close creation surfaces when capability is removed | conditional mount of create/cart subtree and explicit capability transition | No — architecture change required | High | L5E | `modules/stock/__tests__/liff-app.test.tsx`; revoke while picker/cart open, re-grant | do not silently discard persisted cart unless product contract says so; mutation remains server-authorized |
| SSE-055 | `modules/stock/presentation/liff/components/LiffStockApp.tsx` | 477:13 | D | F — URL/deep-link validation to one-shot notice | `focusNotice` | invalid numeric request id and action intent from URL | URL plus `deepLinkHandledRef` | show safe notice once and avoid opening an invalid request | route/deep-link parser or explicit navigation-intent handler with one-shot lifecycle | No — architecture change required | Medium | L5J | `modules/stock/__tests__/liff-app.test.tsx`; invalid id, unsafe integer, capability denial, repeated render | notice must not expose backend details or accidentally open a request without capability |
| SSE-056 | `modules/stock/presentation/liff/components/LiffStockApp.tsx` | 784:13 | B | E — capability-driven tab lifetime and hidden-state normalization | `activeTab` | `visibleTabs` from server capabilities | user tab plus capability visibility | repair active tab when its capability disappears | capability-owned tab lifecycle or reducer that clears invalid selection without allowing stale reappearance | No — architecture change required | High | L5E | `modules/stock/__tests__/liff-app.test.tsx`; active tab loss, fallback, re-grant, user selection | deriving only `safeActiveTab` leaves stale hidden state that can return when capability is restored |
| SSE-057 | `modules/stock/presentation/liff/components/LiffStockDecisionSheet.tsx` | 45:21 | D | D — dialog/session reset | `reason` | `intent` identity | local reason draft for one stock decision session | new issue/action intent starts with empty reason | key decision sheet by request/action session or parent-owned explicit open transition | Yes | Medium | L5B | `modules/stock/__tests__/liff-components.test.tsx`, `liff-app.test.tsx`; reason, intent switch, close/reopen | do not use a permanently derived open state that prevents user-controlled close |
| SSE-058 | `modules/stock/presentation/liff/components/LiffStockVariantPicker.tsx` | 43:19 | D | C — incoming item/session to editable picker initialization | `quantities` | `item?.id` and `open` | local quantities draft for current picker session | opening a picker or changing item must clear prior quantities | key/remount by picker session/item or explicit session reducer; keep confirmation payload tied to current item | Needs targeted investigation | High | L5D | `modules/stock/__tests__/liff-components.test.tsx`; item switch, close/reopen, quantity reset and confirm payload | a derived `quantities` value must not erase user input while the same session remains open |

## Reconciliation

### Primary root-pattern counts

| Pattern | Meaning | Count |
| --- | --- | ---: |
| A | Render-derived / normalized state | 0 |
| B | Event-owned transition | 0 |
| C | Incoming entity/prop → editable form or picker initialization | 6 |
| D | Dialog/sheet open-close or session reset | 10 |
| E | Permission/capability-driven lifetime | 16 |
| F | URL/router ↔ local state synchronization | 8 |
| G | Pagination synchronized to remote or changing query data | 4 |
| H | Hydration/client-readiness state | 3 |
| I | Browser/external persistence or subscription | 2 |
| J | Async workflow/fetched-result lifecycle | 7 |
| K | Disclosure/auto-open UX | 2 |
| **รวม** |  | **58** |

ไม่มี A/B pure finding เหลืออยู่ ไม่ใช่เพราะ rule ยอมรับ pattern เหล่านี้ แต่เพราะ L2A แก้ 3 กรณีที่เป็น event/derived transition ที่พิสูจน์ได้แล้ว และรายการที่เหลือมี external driver หรือ session semantics ที่ต้องจัด architecture ก่อน

### Risk counts

| Risk | Count |
| --- | ---: |
| Low | 3 |
| Medium | 14 |
| High | 41 |
| **รวม** | **58** |

High ใช้กับ authorization/capability boundary, URL canonicalization, remote pagination, async race/loading, persisted cart, attachment/blob lifecycle และ editable business forms เพราะการ refactor ผิดอาจทำให้ข้อมูลผิด session, action เกิดโดยไม่มีสิทธิ์, page rebound ผิด หรือ response เก่าทับ state ใหม่

### Remediation readiness counts

| Readiness | Meaning | Count |
| --- | --- | ---: |
| Safe to remediate now | session owner ชัดและมี end-state ที่ไม่ต้องเปลี่ยน shared canonical contract | 4 |
| Needs targeted investigation | มีแนวทางที่น่าเชื่อถือ แต่ต้องพิสูจน์ interaction/hydration/lifecycle ก่อน | 17 |
| Not safe without architecture change | ต้องย้าย owner ไปที่ URL, capability boundary, query/reducer หรือ external-store lifecycle ก่อน | 37 |
| **รวม** |  | **58** |

## Root-Cause Architecture Findings

### 1. Duplicated sources of truth

วันนี้ URL, local tab/page state, server data และ user intent ถูก mirror กันใน Stock และ Routine หลายจุด เพราะต้องรองรับ deep link, browser navigation, immediate interaction และ tab-specific pagination ใน component เดียว

React เตือนเพราะ render แรกยังใช้ local snapshot เก่า แล้ว effect ค่อยซ่อมให้ตรงกับ URL หรือ data ทำให้เกิด render เพิ่มและเปิด race ระหว่าง navigation กับ request

นี่เป็น debt จริง ไม่ใช่ permanent exception เป้าหมายคือเลือก canonical source ต่อ state: URL → derived UI state เมื่อ URL persistence เป็น requirement หรือ local action state → URL เฉพาะเมื่อมี explicit navigation policy

ความเสี่ยงระหว่าง migration คือ Back/Forward, `push`/`replace`, query debounce, tab-specific page keys และ capability normalization อาจเปลี่ยนพร้อมกัน จึงต้อง migrate ทีละ contract ไม่ใช่ลบทุก mirror effect พร้อมกัน

### 2. Component lifetime ยาวกว่าช่วงชีวิตของ state

Dialog, sheet, picker และ confirmation หลายตัวถูก mount ค้างไว้ขณะที่ `open` หรือ entity เปลี่ยน จึงต้องใช้ effect ล้าง state เมื่อ session จบหรือเริ่มใหม่

React เตือนเพราะ session reset เกิดหลัง render แรก ทั้งที่ state นี้ไม่มีความหมายเมื่อ dialog/session เดิมสิ้นสุดแล้ว

desired architecture คือ state lifetime ต้องตรงกับ session owner: conditional mount, stable `key` จาก entity/session identity หรือ explicit session reducer. การเลือกอย่างใดต้องรักษา Activity/Next navigation behavior และ unsaved draft contract

ความเสี่ยงคือ reset เร็วเกินไปจะล้าง draft, reset ช้าเกินไปจะนำ reason/selection/error จาก entity เดิมไปใช้กับ entity ใหม่

### 3. Permission ถูกซ่อมหลัง render แทนที่จะกำหนด lifetime

Employee, Leave, Routine และ Stock ยังให้ interactive subtree มีอยู่ก่อน แล้ว effect ปิดเมื่อ capability เปลี่ยน เพราะ capability projection มาจาก auth/data lifecycle ที่อัปเดตภายหลัง

React เตือนเพราะ UI render หนึ่งรอบสามารถเห็น state ที่ไม่สอดคล้องกับ capability ก่อน effect ทำงาน และทำให้ component lifetime ไม่ตรงกับ authorization lifetime

desired architecture คือ capability-safe component boundary และ conditional mount พร้อม server-side authorization ที่ยัง authoritative เหมือนเดิม ไม่ใช่ซ่อนปุ่มอย่างเดียว

ความเสี่ยงคือผู้ใช้ที่กำลังแก้ข้อมูลอาจถูกตัด session, stale state อาจกลับมาเมื่อ re-grant หรือ mutation อาจคง selection เก่าโดยไม่ตั้งใจ ต้องแยก UI lifecycle ออกจาก security enforcement

### 4. Editable form drafts ถูก reinitialize จาก incoming props

Authorization dialogs, Leave filter sheet, Routine occurrence editor และ Stock pickers ต้องมี local draft เพราะ user แก้ได้อิสระจาก entity/committed filter ที่ parent ส่งมา แต่ component lifetime ปัจจุบันยาวกว่าหนึ่ง editor session

React เตือนเพราะ effect copy prop → state สร้าง render ด้วย draft เก่าแล้วค่อย overwrite และอาจชนกับ user input หรือ parent revalidation

desired architecture คือ editor instance ใหม่เมื่อ identity/session ใหม่ หรือ `beginEdit(initialValue)` ที่ชัดเจน ขณะที่ render ระหว่าง session อ่าน local draft เพียง source เดียว

ความเสี่ยงคือ key ผิด identity จะล้าง draft โดยไม่ตั้งใจ ส่วนไม่ key จะนำ draft ของ record ก่อนหน้าไป submit กับ record ใหม่

### 5. Remote pagination ต้อง reconcile ไม่ใช่ derive display อย่างเดียว

Approver, Routine และ Stock มี page state ที่เปลี่ยนได้จาก user, filter, URL และ remote total ที่ revalidate ได้อิสระ

React เตือนเมื่อ effect clamp page เพราะ render แรกอาจ query/display ด้วย page ที่ไม่ valid แล้วค่อยแก้ใน render รอบถัดไป แต่การลบ setter แล้วใช้ `effectivePage` อย่างเดียวไม่ปลอดภัย: internal stale page อาจกลับมาเมื่อ totalPages โตขึ้น

desired architecture คือ pagination reducer/query owner ที่กำหนด identity, reset, clamp, URL write-back และ rebound invariant ในจุดเดียว

### 6. Hydration/client readiness ถูกแทนด้วย boolean state

Greeting, theme selector และ Leave tabs ใช้ mounted state เพื่อไม่ให้ server output กับ client output ต่างกัน หรือเพื่อรอ browser/library readiness

React เตือนเพราะ `setMounted(true)` เป็น synchronous cascading render แต่การลบทันทีอาจทำให้ hydration mismatch ซึ่งเป็น regression ที่หนักกว่า lint warning

desired architecture ขึ้นกับ source: server-provided deterministic value, stable fallback, client-only boundary หรือ third-party hydration contract. Lazy initializer อย่างเดียวไม่แก้ mismatch ถ้าค่า server/client ต่างกัน

### 7. Browser/external store ถูกแทนด้วย ordinary local state

`use-mobile` อ่าน `matchMedia` และ subscribe browser event ส่วน stock cart hydrate/persist กับ `localStorage` และ idempotency store

React แนะนำ `useSyncExternalStore` สำหรับ external snapshot/subscription เพราะ local state + mount effect ทำให้ initial snapshot และ subscription lifecycle แยกจากกัน

desired architecture คือ external-store adapter ที่มี `subscribe`, `getSnapshot`, SSR snapshot/hydration policy และ user-scoped persistence contract

ความเสี่ยงคือ browser-only access ตอน SSR, viewport flash, cross-user cart leakage, write-before-hydration และ idempotency key สูญหาย

### 8. Async workflow มี synchronous loading/reset prelude ใน effect

Liff home/leave/routine/stock, email history และ Routine import เรียก async helper จาก effect แต่ helper set loading/error/reset ก่อน `await`

React rule report ที่ call site เพราะ synchronous call path ยังทำ cascading render แม้ result setter หลัง `await` จะเป็น lifecycle update ที่สมเหตุผลกว่า

desired architecture คือ query library/state machine/reducer ที่เป็น owner ของ request identity, loading, error, cancellation และ stale response หรือแยก initial request transition จาก user-triggered retry อย่าง explicit

ความเสี่ยงคือการสลับ loading state ผิดจังหวะ, stale response, duplicate request, error ที่หายไป และ request-specific cleanup ถูกลบไปพร้อมกัน

### 9. Disclosure/validation transition ถูก effect เป็นเจ้าของ

Routine contract และ extra-details form ต้อง auto-open เมื่อ data/error ปรากฏ แต่ต้องให้ user ปิดได้ จึงไม่เท่ากับ boolean ที่ derive จาก `hasError` ตลอดเวลา

React เตือนเพราะ effect กำลังแปลง observed state เป็น event transition แบบ implicit และ render แรกยังใช้ disclosure state ก่อน sync

desired architecture คือ validation/submit event เปิด disclosure ครั้งเดียว หรือ reducer แยก automatic attention request กับ user dismissal

## Proposed Migration Sequence

ลำดับนี้จัดตาม confidence, regression risk, repeated convention และ business criticality ไม่ใช่จำนวน lint ที่ลดได้อย่างเดียว ทุก phase ต้องเปิดเฉพาะ rule ใน scope ที่กำลัง migrate, รัน focused tests, แล้วตรวจ behavior sequence ก่อนจึงลด baseline

| Phase | Pattern / findings | Files or modules affected | Architecture goal | Expected diagnostic reduction | Risk | Test surface | Split further? |
| --- | --- | --- | --- | ---: | --- | --- | --- |
| L5B | Dialog/session ที่เป็น transient และ identity ชัด: SSE-022, SSE-038, SSE-045, SSE-057 | Leave decision sheet, Routine detail sheet, Stock cancel/decision sheets | key หรือ explicit session owner ให้ reason/confirmation มี lifetime ตรงกับ intent/entity | 4 | Low–Medium | Liff Leave/Routine/Stock component tests | ไม่ควรรวมกับ form draft ที่มี unsaved data |
| L5C | Shared/complex dialog reset: SSE-005, SSE-010, SSE-011, SSE-012, SSE-014, SSE-043 | `AsyncFormDialog`, Authorization dialogs, attachment viewer, Stock add-item dialog | session lifecycle, dirty/focus, blob cleanup และ form reset เป็น owner เดียว | 6 | Medium–High | primitive/dialog/attachment tests | ควรแยก attachment resource cleanup ออกจาก generic dialog |
| L5D | Incoming entity/prop → editable draft: SSE-008, SSE-009, SSE-023, SSE-026, SSE-046, SSE-058 | Authorization forms, Leave filter sheet, Routine occurrence editor, Stock pickers | key by entity/session หรือ explicit `beginEdit` boundary โดยไม่ overwrite draft | 6 | High | editor/picker tests with identity switch and dirty state | แยก authorization forms จาก picker forms ได้ |
| L5E | Capability-driven lifetime: SSE-001, SSE-013, SSE-016, SSE-017, SSE-027, SSE-030, SSE-031, SSE-032, SSE-035, SSE-036, SSE-040, SSE-041, SSE-042, SSE-044, SSE-054, SSE-056 | dashboard sidebar, Employee/Leave/Routine/Stock dashboard and LIFF surfaces | capability-safe component boundary; stale inaccessible UI ไม่กลับมา; server auth unchanged | 16 | High | capability-loss/re-grant tests and mutation authorization tests | ควรทำ Employee/Leave/Routine/Stock แยกกัน ไม่ bulk rewrite |
| L5F | Disclosure/validation ownership: SSE-028, SSE-039 | Routine schedule and LIFF task form | validation/submit event หรือ reducer เป็น owner ของ one-shot auto-open | 2 | Medium | Routine form/schedule interaction tests | แยก contract data กับ field error sequence ถ้าพฤติกรรมต่างกัน |
| L5G | Hydration/client readiness: SSE-002, SSE-004, SSE-019 | dashboard greeting/theme/Leave tabs | deterministic server/client output หรือ client boundary ที่มี fallback ถูกต้อง | 3 | Medium | hydration-oriented component tests and fixed-clock tests | ต้องแยก third-party theme contract จาก time greeting |
| L5H | Browser/external store: SSE-007, SSE-047 | `use-mobile`, stock cart persistence | `useSyncExternalStore`/persistence adapter พร้อม SSR and user-scope policy | 2 | High | browser API, storage, SSR and idempotency tests | ต้องแยก viewport subscription กับ localStorage cart |
| L5I | Remote pagination reconciliation: SSE-015, SSE-029, SSE-051, SSE-052 | Leave approver, Routine occurrence, Stock provider | query identity, page reset/clamp, URL write-back และ rebound behavior อยู่ใน owner เดียว | 4 | High | shrink/grow/revalidate/filter/deep-link tests | ทำ Approver ก่อน แล้ว Stock/Routine ตาม contract |
| L5J | URL/router canonicalization: SSE-018, SSE-021, SSE-033, SSE-034, SSE-048, SSE-049, SSE-050, SSE-055 | Leave/Routine/Stock URL-driven UI | URL หรือ navigation intent เป็น canonical source; รองรับ Back/Forward และ capability normalization | 8 | High | router/search-param integration tests | แยก invalid deep-link notice ออกจาก persistent tab/page state |
| L5K | Async request lifecycle: SSE-003, SSE-006, SSE-020, SSE-024, SSE-025, SSE-037, SSE-053 | LIFF home/Leave/Routine/Stock, email history, Routine import | query/state-machine owner ของ loading/error/cancellation/stale responses | 7 | High | race, retry, abort, loading/error and result ordering tests | ต้อง migrate ทีละ request family; ห้าม replace ทุก helper พร้อมกัน |

หลัง L5K ให้รัน repository-wide explicit rule check ด้วย `error` และพิจารณาเปิด globally ใน config เมื่อ findings เหลือศูนย์หรือเหลือเฉพาะ exception ที่ผ่าน review ตาม section ด้านล่าง

## Target Architecture Policy

นโยบายปลายทาง:

```text
react-hooks/set-state-in-effect = globally enabled
```

New code ต้องไม่เพิ่ม synchronous `setState` ใน effect body

Effects ควรทำอย่างใดอย่างหนึ่งเป็นหลัก:

- synchronize React state outward ไปยัง external system
- subscribe external system และ update state จาก callback เมื่อ external value เปลี่ยน
- จัดการ async workflow โดยมี request/query lifecycle owner ที่ชัดเจน ไม่ใช้ synchronous effect setter เป็น implicit event transition

State ที่คำนวณได้ทั้งหมดจาก props หรือ React state ควร derive ระหว่าง render

State transition ที่เกิดจาก user action ควรอยู่ใน action/event handler เดียวกับ driver

State ของ component/session ต้องมี lifetime ตรงกับ component/session ที่เป็น owner

ข้อกำหนดความถูกต้อง:

- lint compliance ไม่ override behavioral correctness
- ห้ามใช้ timeout, microtask, promise hop หรือย้าย setter ไป effect อื่นเพื่อหลบ rule
- ห้ามเปลี่ยน local editable draft เป็น derived display value ถ้าจะทำให้ stale internal state กลับมาได้
- ห้ามเปลี่ยน capability UI projection เป็น security enforcement; server authorization ยังคง authoritative
- ทุก URL, pagination, storage และ async migration ต้องระบุ canonical source, cancellation และ rebound behavior

## Temporary Migration Guard

**RECOMMEND** — ควรมี temporary no-new-findings ratchet ใน phase ถัดไปเพื่อกันไม่ให้ migration debt เพิ่มขึ้นระหว่าง L5B–L5K แต่ไม่ implement ใน L5A

เหตุผล:

- ปัจจุบัน rule ยัง globally disabled และมี 58-item baseline
- การ migrate เป็นเวลานานและมีหลายทีม/หลาย module แตะ effect lifecycle
- count-only check กันกรณีเพิ่ม finding แล้วแก้ finding เดิมออกไม่ได้ และ line-only baseline เปราะต่อการขยับ code

หาก implement ภายหลัง ratchet ต้องเป็น migration firewall ชั่วคราว ไม่ใช่ final policy โดย identity ควรประกอบด้วยอย่างน้อย:

```text
ruleId
repo-relative file
enclosing component/hook/function
effect dependency signature
state setter or traced synchronous call-path identity
normalized AST fingerprint ของ reported call site
```

baseline ควรรองรับ `new`, `resolved`, `moved` และ explicit reviewed mapping เพื่อไม่ให้ line move กลายเป็น finding ใหม่ปลอม ๆ แต่ก็ไม่ควร auto-accept code ที่เปลี่ยน owner โดยไม่มี review

ข้อความ policy ที่ต้องบันทึกใน ratchet คือ:

```text
This is a temporary migration firewall.
It is not the final policy.
The final policy remains global rule ON.
```

## Potential Final Exceptions

**Potential final exceptions: 0 ณ audit รอบนี้**

ยังไม่มี finding ที่มีหลักฐานว่าการคง synchronous reconciliation ใน effect เป็นทางเลือกที่ถูกต้องและเสถียรกว่าการย้าย owner:

- `use-mobile` มี `useSyncExternalStore` เป็น architecture ทางเลือกตรงตาม React guidance
- theme/greeting/Leave mounted state มี server-safe value, fallback หรือ client boundary เป็นทางเลือกที่ต้องสำรวจ
- attachment/blob cleanup ย้ายไป keyed resource owner หรือ reducer ได้โดยไม่ต้องยอมรับ effect setter ถาวร
- URL/pagination/permission state มี canonical source หรือ lifecycle boundary ที่ควรออกแบบให้ชัด
- async loading/reset มี query/state-machine owner ที่ตรวจ race ได้

จึงยังไม่เพิ่ม local suppression ใด ๆ และไม่ประกาศ D finding เป็น exception โดยอัตโนมัติ หากภายหลังพบ exception จริง ต้องผ่านเกณฑ์ทั้งหมด:

1. redesign ทางเลือกทำให้ lifecycle หรือ data invariant แย่ลงอย่างมีหลักฐาน
2. effect เป็น narrow stable reconciliation ที่ไม่ใช่ derived state/event detection แบบทั่วไป
3. มี focused regression test และ owner/review record
4. exception ไม่กระทบ authorization, URL canonicalization, hydration หรือ persistence correctness
5. rule ยัง globally ON และ exception ถูกจำกัดเฉพาะจุดที่ review แล้ว

## Verification Record

ทำแล้ว:

- อ่าน `AGENTS.md`, `eslint.config.mjs`, `package.json`, `next.config.ts` และ historical `docs/architecture/next16-react-lint-debt-audit.md`
- อ่าน source context รอบ diagnostics ทั้ง 58 รายการ รวม helper call path, state declaration, dependency และ relevant parent/test context
- อ่าน installed `eslint-plugin-react-hooks` rule implementation และ installed Next.js docs ที่เกี่ยวข้อง
- ใช้ Context7 กับ official React/Next.js documentation ตามหัวข้อ effect, derived state, state reset, external store, hydration และ URL navigation
- รัน repository-wide machine-readable inventory ด้วย `react-hooks/set-state-in-effect:error`
- ผล inventory: **58 diagnostics ใน 38 ไฟล์**, ตรงกับ expected 58
- ไม่สร้างหรือเก็บ raw ESLint JSON output ใน repository

ยังไม่ได้ทำโดยตั้งใจ:

- ไม่รัน `npm run test:run`
- ไม่รัน `npm run test:full:serial`
- ไม่รัน `npm run build`
- ไม่แก้ production code, tests, config หรือ scripts
- ไม่เปิด rule globally และไม่ implement ratchet

ไฟล์ที่เปลี่ยนใน Phase L5A ควรมีเพียง:

```text
docs/architecture/react-effect-state-migration-roadmap.md
```

## Phase L5B Completion Record

สถานะ: **เสร็จสิ้น**

แก้ไขแล้ว:

- `SSE-022` — Leave decision reason session
- `SSE-038` — Routine delete confirmation session
- `SSE-045` — Dashboard Stock cancellation reason session
- `SSE-057` — LIFF Stock decision reason session

Baseline ก่อน L5B: **58** diagnostics
Baseline หลัง L5B: **54** diagnostics
Reduction: **4**

รูปแบบสถาปัตยกรรมที่ใช้คือ conditional session subtree ที่มี state transient เป็นเจ้าของภายใน และใช้ key จาก session identity จริง: `requestId + action` สำหรับ Leave, `detail.id` ภายใต้ `canDelete && detail` สำหรับ Routine, `request.id` สำหรับ Dashboard Stock และ `request.id + action + actorMode` สำหรับ LIFF Stock การปิด session ทำให้ subtree unmount; การ rerender ของ session เดิมจึงไม่ล้างค่าที่ผู้ใช้กรอก

Focused verification ที่ผ่าน:

- `npm.cmd run test:run -- modules/leave/presentation/liff/LiffLeaveComponents.test.tsx` — 11 tests ผ่าน
- `npm.cmd run test:run -- modules/routine/presentation/liff/LiffRoutine.test.tsx` — 39 tests ผ่าน
- `npm.cmd run test:run -- modules/stock/__tests__/liff-components.test.tsx modules/stock/presentation/dashboard/components/StockRequestCancelDialog.test.tsx` — 6 tests ผ่าน
- targeted `react-hooks/set-state-in-effect:error` check ของ source ที่แก้ — 0 diagnostics
- `npm.cmd run lint:strict` — ผ่าน
- `npm.cmd run typecheck` — ผ่าน
- explicit repository-wide rule inventory ด้วย `npx.cmd eslint . --rule "react-hooks/set-state-in-effect:error" --format json` — **54 diagnostics**; 4 ไฟล์ L5B มี 0 diagnostics

ไม่มี deviation ด้าน business rule, API, schema, authorization หรือ lint policy และไม่ได้แก้ L5C–L5K. เป้าหมายสุดท้ายยังคงเป็น:

```text
react-hooks/set-state-in-effect = globally enabled
```

## Phase L5C Completion Record

สถานะ: **เสร็จสิ้น**

แก้ไขแล้ว: `SSE-005`, `SSE-010`, `SSE-011`, `SSE-012`, `SSE-014`, `SSE-043`

Baseline ก่อน L5C: **54** diagnostics
Baseline หลัง L5C: **48** diagnostics
Reduction: **6**

รูปแบบ ownership ที่ใช้:

- `SSE-005` — `AsyncFormDialog` คง `Dialog` หลักและ focus lifecycle เดิมไว้; แยก discard confirmation เป็น child session ที่ mount เฉพาะตอน dialog เปิด และเปิดผ่าน ref เฉพาะกิจ
- `SSE-010` — parent เป็นเจ้าของ `directoryQuery`; open/close boundary ล้าง query และเพิ่ม Add Member session identity; local selection/role/error อยู่ใน keyed dialog session
- `SSE-011` — caller เป็นเจ้าของ grant-session identity; keyed wizard แยกตามทีม/source/TeamRole และ preserve draft ภายใน session เดิม
- `SSE-012` — caller ส่ง stable confirmation session identity; child confirmation เป็นเจ้าของ error ขณะที่ `AlertDialog` root และ close/focus behavior คงเดิม
- `SSE-014` — keyed viewer resource session เป็นเจ้าของ active index, cache, pending requests และ `AbortController`; cleanup aborts requests และ revokes object URLs
- `SSE-043` — parent เพิ่ม Add Item session identity; keyed form subtree เป็นเจ้าของ controlled draft และ uncontrolled DOM fields จึงถูกทำลายพร้อม session

Focused verification ที่ผ่าน:

- `npm.cmd run test:run -- components/ui/async-form-dialog.test.tsx modules/leave/presentation/dashboard/LeaveRequestForm.test.tsx modules/authorization/presentation/dashboard/components/AuthorizationDialogs.test.tsx modules/authorization/presentation/dashboard/components/TeamAdministration.test.tsx modules/authorization/presentation/dashboard/components/GrantList.test.tsx modules/authorization/presentation/dashboard/components/UserAccessPanel.test.tsx modules/leave/presentation/dashboard/components/LeaveAttachmentViewerDialog.test.tsx modules/stock/presentation/dashboard/components/StockInventoryAddItemDialog.test.tsx modules/stock/presentation/dashboard/components/StockInventoryDialogs.test.tsx` — 55 tests ผ่าน
- `npm.cmd run lint:strict` — ผ่าน
- `npm.cmd run typecheck` — ผ่าน
- targeted `react-hooks/set-state-in-effect:error` check ของ source ที่แก้ — เหลือเฉพาะ `SSE-008`, `SSE-009`, `SSE-040` ซึ่งอยู่นอก L5C
- `npx.cmd eslint . --rule "react-hooks/set-state-in-effect:error" --format json` — **48 diagnostics**; raw JSON ใช้ชั่วคราวนอก repository และไม่ถูก commit

ไม่รัน `architecture:check` เพราะไม่มีการเปลี่ยน module boundary/import ownership และไม่รัน `npm run build` หรือ full-suite ตามขอบเขต verification ของ phase นี้

Behavior invariants ที่ตรวจแล้ว: dirty-form discard protection, focus restoration, same-session draft preservation, new-session reset, effective-scope normalization, confirmation error isolation, attachment request abort, object URL revocation, stale attachment response isolation, Stock uncontrolled field reset และ one-variant minimum

Follow-up hardening สำหรับ `SSE-011`: เมื่อ authorization inspection เป็น `INVALID_CONFIGURATION` Grant session subtree จะถูกถอดออกพร้อม session owner; เมื่อ inspection กลับมา valid dialog จะไม่เปิดเองและไม่ revive wizard state เดิม ต้องเปิด session ใหม่โดยผู้ใช้

Regression verification: `UserAccessPanel.test.tsx` เพิ่มกรณี valid → เปิด Grant → invalid → valid → explicit reopen; targeted UserAccessPanel/AuthorizationDialogs tests **25 tests ผ่าน**, lint และ typecheck ผ่าน และ repository-wide explicit rule inventory ยังคง **48 diagnostics**

ไม่มีการแก้ API contract, schema, migration, authorization หรือ capability cleanup `SSE-040`. `SSE-008`/`SSE-009` และงาน L5D–L5K ยังคง intentionally untouched. เป้าหมายสุดท้ายยังคงเป็น:

```text
react-hooks/set-state-in-effect = globally enabled
```

## Phase L5D Completion Record

สถานะ: **เสร็จสิ้น**

แก้ไขแล้ว: `SSE-008`, `SSE-009`, `SSE-023`, `SSE-026`, `SSE-046`, `SSE-058`

Baseline ก่อน L5D: **48** diagnostics
Baseline หลัง L5D: **42** diagnostics
Reduction: **6**

รูปแบบ ownership ที่ใช้:

- `SSE-008` / `SSE-009` — Workspace และ `TeamAdministration` เป็นเจ้าของ explicit create/edit session identity; keyed form session จับ technical key และ editable baseline ครั้งเดียวต่อ session ส่วน Team/Role ID เป็น semantic entity identity
- `SSE-023` — `LiffLeaveHistory` เริ่ม filter session ใหม่เมื่อผู้ใช้เปิด sheet; keyed sheet จับ committed-filter snapshot แยกจาก draft จนกว่าจะกด Apply
- `SSE-026` — occurrence editor เป็น keyed session subtree; editor draft และ `expectedReminderVersion` มาจาก occurrence snapshot เดียวกันตั้งแต่ session เริ่ม และ session จบเมื่อปิดหรือเปลี่ยน occurrence identity
- `SSE-046` — dashboard Stock picker เป็น item/session subtree; quantity, active variant และ preview อยู่ใน session เดียวกัน และถูกทำลายเมื่อปิดหรือเปลี่ยน item
- `SSE-058` — LIFF Stock picker เป็น item-keyed session; quantities ถูกทำลายเมื่อปิดหรือเปลี่ยน item, confirm ใช้ item/variants ปัจจุบันของ session และ projection ของ quantity ถูก clamp ตาม availability ปัจจุบัน

Focused verification ที่ผ่าน:

- `npm.cmd run test:run -- modules/authorization/presentation/dashboard/components/AuthorizationDialogs.test.tsx modules/authorization/presentation/dashboard/components/TeamAdministration.test.tsx modules/authorization/presentation/dashboard/AuthorizationAdministrationWorkspace.test.tsx modules/leave/presentation/liff/LiffLeaveComponents.test.tsx modules/routine/presentation/dashboard/RoutineOccurrenceList.test.tsx modules/stock/__tests__/liff-components.test.tsx modules/stock/presentation/dashboard/components/StockVariantPickerDialog.test.tsx` — 7 files, **44 tests ผ่าน**
- follow-up `npm.cmd run test:run -- modules/authorization/presentation/dashboard/components/AuthorizationDialogs.test.tsx` — **10 tests ผ่าน**
- `npm.cmd run lint:strict` — ผ่าน
- `npm.cmd run typecheck` — ผ่าน
- targeted `react-hooks/set-state-in-effect:error` สำหรับ L5D source call sites — **0 diagnostics**; diagnostics ที่ยังอยู่ใน caller เป็น finding ของ phase อื่นและไม่ได้แก้
- `npx.cmd eslint . --rule "react-hooks/set-state-in-effect:error" --format json` — **42 diagnostics**; raw JSON ใช้ชั่วคราวนอก repository และไม่ถูก commit

SSE-058 follow-up: เมื่อ availability ของ variant เดิมลดลงระหว่าง session, quantity ที่แสดง, selection และ confirm payload จะไม่เกิน availability ปัจจุบัน; regression test ครอบคลุมกรณี `2 → 1` และผ่านแล้ว

ไม่รัน `architecture:check` เพราะไม่มีการเปลี่ยน module/import boundary และไม่รัน `npm run build` หรือ full-suite ตามขอบเขต verification ของ phase นี้

ตรวจแล้วว่า same-session parent refresh ไม่ทับ draft, close/reopen และ entity switch สร้าง draft ใหม่, Team/Role technical key stable ภายใน session, Leave committed filters แยกจาก draft, Routine ใช้ `reminderVersion` จาก session-start snapshot, Stock quantities ไม่ข้าม item session และ preview ไม่รอดจาก picker session

ไม่มีการแก้ API contract, schema, migration, authorization หรือ L5E capability lifecycle. `SSE-027`, `SSE-040`, `SSE-042` และงาน L5E–L5K ยังคง intentionally untouched. เป้าหมายสุดท้ายยังคงเป็น:

```text
react-hooks/set-state-in-effect = globally enabled
```

## Phase L5E Completion Record

สถานะ: **เสร็จสิ้น**

แก้ไขแล้วทั้ง 16 finding:

```text
SSE-001, SSE-013, SSE-016, SSE-017, SSE-027, SSE-030, SSE-031, SSE-032,
SSE-035, SSE-036, SSE-040, SSE-041, SSE-042, SSE-044, SSE-054, SSE-056
```

Baseline ก่อน L5E: **42 diagnostics**
Explicit inventory หลัง L5E: **26 diagnostics**
Reduction: **16**

รูปแบบ ownership ที่ใช้:

- `SSE-001` — Sidebar เก็บเฉพาะ `collapsedGroupIds` ที่ผู้ใช้เลือกเอง และ derive กลุ่มที่ขยายจากกลุ่มที่มีอยู่ลบด้วยค่าที่ถูกยุบ จึงไม่ synchronize availability เข้า user preference
- `SSE-013` — Employee provider คง search, filter, pagination และ read-only data; `EmployeeList` เป็น capability owner ของ edit session และ `EmployeeModals` อยู่ภายใน session นั้น
- `SSE-016` — Leave model คง history/filter/page; create, cancel และ not-taken ใช้ controller/session แยกกันตาม capability ของตัวเอง
- `SSE-017` — Manager approval decision session เป็น subtree ของ `canApproveAssignedRequests`; not-taken และ cancellation workflows ยังอยู่นอก boundary นี้
- `SSE-027` — occurrence override editor เป็น per-row capability session; details dialog แบบอ่านอย่างเดียวยังคงอยู่นอก session
- `SSE-030` / `SSE-031` — operational edit detail fetch, create form และ edit form อยู่ใน per-task/capability session; task list, filters, page และ reference state ที่ไม่ใช่ draft อยู่นอก session
- `SSE-032` — Routine tab state เก็บ visible-tab lifetime key และปรับ active tab เป็น fallback ที่ valid แบบ durable โดยไม่ rewrite URL synchronization
- `SSE-035` — delete confirmation เป็น per-task destructive session ซึ่ง mount เฉพาะเมื่อ global และ task-level eligibility ยังใช้ได้
- `SSE-036` — Routine LIFF create/edit/delete form state อยู่ใน capability-owned sessions; delete error อยู่ใน delete session ส่วน detail Sheet ยังคง stable เพื่อไม่กระทบ read-only detail loading
- `SSE-040` — inventory management controls/dialogs อยู่ใน capability-keyed inventory session; catalog filters, page และ read-only rows อยู่นอก owner
- `SSE-041` — admin cancellation เป็น per-request action session; process/issue capability ไม่ถูกผูกกับ cancellation state
- `SSE-042` — dashboard variant picker อยู่ใน create-capability session; `useStockBrowseCart` และ cart persistence มี owner แยกต่างหาก
- `SSE-044` — own-request cancellation target อยู่ใน capability-keyed request-history session; search/filter/page อยู่ใน UI context เดิม
- `SSE-054` — LIFF Stock picker และ cart open/closed UI อยู่ใน create-capability session; cart contents, project code และ idempotency persistence ยังคงอยู่ใน cart hook
- `SSE-056` — LIFF Stock active tab ถูก reconcile ที่ server capability response boundary และ fallback ถูกเขียนกลับไปยัง state จึงไม่ย้อนกลับไปยัง tab ที่ถูกถอนสิทธิ์เมื่อ capability กลับมา

Invariants ที่ตรวจแล้ว:

- เปิด workflow → capability หาย → owner unmount/reset → capability กลับมาแล้ว workflow ปิดและต้องเปิดใหม่โดยผู้ใช้
- capability ของ workflow หนึ่งไม่ล้าง history, search, filter, pagination, read-only detail หรือ workflow ของ capability อื่น
- sidebar collapse preference คงอยู่ผ่าน rerender, availability loss/regrant และ explicit re-expand
- tab ที่ถูกซ่อนเลือก fallback อย่างถาวรจนกว่าจะมี explicit user selection ใหม่
- persisted Stock cart และ idempotency state ไม่ถูกล้างเพียงเพราะ create capability หาย
- client mutation guards และ server authorization/ownership/status checks ไม่ถูกลดทอน

Focused verification ที่ผ่าน:

- `npm.cmd run test:run --` พร้อม explicit paths ของ Sidebar, Employee, Leave, Routine dashboard/LIFF และ Stock dashboard/LIFF — **22 files, 191 tests ผ่าน**
- `npm.cmd run lint:strict` — ผ่าน
- `npx.cmd tsc --noEmit --pretty false` — ผ่าน
- `git diff --check` และตรวจ diff ไม่พบอักขระแทนที่หรือข้อความเสียรูป — ผ่าน
- ไม่รัน `architecture:check` เพราะไม่มีการเปลี่ยน module/import boundary
- ไม่รัน `npm run build` และไม่รัน full repository suite เพราะ focused/static verification เพียงพอกับขอบเขต L5E

Repository-wide explicit inventory:

```text
npx.cmd eslint . --rule "react-hooks/set-state-in-effect:error" --format json
→ 26 diagnostics
```

ไม่เก็บ raw JSON ไว้ใน repository และไม่พบ diagnostic ของ 16 L5E IDs ที่แก้ใน inventory หลังการเปลี่ยนแปลง

Scope audit: ไม่แตะ L5F (`SSE-028`, `SSE-039`), hydration, external-store, pagination (`SSE-015`, `SSE-029`), URL/deep-link (`SSE-018`, `SSE-033`, `SSE-034`, `SSE-055`) หรือ async lifecycle (`SSE-037`, `SSE-053`) นอกเหนือจากการคง behavior ที่ L5E ต้องใช้ร่วมกัน รายการ 26 diagnostics ที่เหลือจึงเป็นงานของเฟสถัดไปตาม roadmap และยังไม่มีการเริ่ม L5F

ไม่มีการแก้ API contract, schema, migration, server authorization, lint suppression หรือ timing workaround เป้าหมายสุดท้ายยังคงเป็น:

```text
react-hooks/set-state-in-effect = globally enabled
```

## Phase L5F Completion Record

สถานะ: **เสร็จสิ้น**

แก้ไขแล้ว: `SSE-028`, `SSE-039`

รูปแบบ ownership ที่ใช้:

- `SSE-028` — `LiffRoutineTaskForm` เป็นเจ้าของ `contractOpen` โดยเริ่มจาก contract data ของ edit/session, เปิดจาก user contract-field transition, local/server validation result และ explicit `applyLatestTask()`; `RoutineScheduleFields` รับค่า disclosure แบบ controlled และส่งต่อเฉพาะ user toggle จึงไม่ synchronize จาก data/error ระหว่าง rerender
- `SSE-039` — `LiffRoutineTaskForm` เป็นเจ้าของ `extraDetailsOpen` โดยเริ่มจาก `extraDetails` ของ session, เปิดจาก local/server field-error result และ explicit latest-task application; field editing และ `<details>` toggle ไม่ derive openness จากค่าฟอร์มอย่างต่อเนื่อง

คง invariants ของ disclosure ไว้ครบถ้วน: auto-open เป็น one-shot transition, ผู้ใช้ยุบ section ได้และ rerender ด้วย data/error เดิมไม่เปิดกลับ, validation submit ครั้งใหม่เปิดได้อีกครั้ง, initial edit data ยังคงเปิด และ `focusFirstRoutineInvalidField(...)` ทำงานหลังเปิด disclosure เพื่อให้ field ที่ผิดมองเห็นและโฟกัสได้

Focused verification ที่ผ่าน:

- `npm.cmd run test:run -- modules/routine/presentation/dashboard/RoutineTaskForm.test.tsx modules/routine/presentation/liff/LiffRoutine.test.tsx` — 2 files, **53 tests ผ่าน**
- `npm.cmd run lint:strict` — ผ่าน
- `npm.cmd run typecheck` — ผ่าน
- `git diff --check` — ผ่าน
- explicit inventory ด้วย `npx.cmd eslint . --rule "react-hooks/set-state-in-effect:error" --format json` — **26 → 24 diagnostics**; `SSE-028` และ `SSE-039` ไม่เหลือ diagnostic และไม่มี diagnostic ของ rule ใน changed production/test files

ไม่มีการแก้ schema, API contract, database, authorization, hydration, pagination, URL, async bootstrap หรือการใช้ lint suppression/timing workaround และ **ไม่ได้เริ่ม L5G**

## Phase L5G Completion Record

สถานะ: **เสร็จสิ้น**

แก้ไขแล้ว: `SSE-002`, `SSE-004`, `SSE-019`

รูปแบบ ownership ที่ใช้:

- `SSE-002` — greeting ที่ขึ้นกับ wall clock ถูกย้ายไปยัง client-only `next/dynamic({ ssr: false })` boundary โดยใช้ `สวัสดี` เป็น fallback ที่ deterministic; client-ready component ใช้ classifier เดิมครบ 4 ช่วงเวลาใน `Asia/Bangkok` และไม่ใช้ lazy state หรือ effect เพื่อเลือก greeting
- `SSE-004` — `ThemeSelector` แยก deterministic fallback ที่มี `value=""`, radio ทั้งหมด disabled และไม่มี mutation handler ออกจาก client-only content ที่อ่าน `useTheme()`; ค่าที่ไม่ใช่ `system`/`light`/`dark` ไม่ถูกทำเป็น checked state และการเปลี่ยน theme ยังเรียก `setTheme()` ด้วยค่าที่ validate แล้ว
- `SSE-019` — ลบ `isMounted` readiness state/effect และ render capability-filtered `SectionTabs` ตั้งแต่ server/initial client render เพราะ `SectionTabs`/Radix Tabs ที่ติดตั้งสร้างโครงสร้างจาก props และอ่าน `matchMedia` เฉพาะใน effect; fallback `EmployeeLeaveDashboard` ไม่ถูกใช้เพื่อหลบ hydration อีกต่อไป และกรณีไม่มี visible tab จะ fail closed ด้วย `null`

Mount gate ของ Leave ถูก **ลบออก** ไม่ได้แทนด้วย mounted helper หรือ timing workaround: server และ initial client ใช้ `tabs`, `safeActiveTab` และ capability projection ชุดเดียวกัน จึงไม่ต้อง mount dashboard ชั่วคราวแล้วทิ้งเพื่อแสดง tabs และไม่สร้าง child dashboard ซ้ำโดยไม่จำเป็น

Invariants ที่ทดสอบ:

- Dashboard server markup และ initial hydration ใช้ greeting fallback เดียวกันโดยไม่มี hydration mismatch; client-ready render เปลี่ยนเป็น greeting ตามเวลาประเทศไทย และ boundary `04:59`, `05:00`, `11:59`, `12:00`, `16:59`, `17:00`, `21:59`, `22:00` ยังถูกต้อง
- Theme fallback ไม่มี checked theme และกดแล้วไม่ mutate `next-themes`; เมื่อพร้อมแล้ว `light`, `dark`, `system` ทำงานครบ และค่า undefined/invalid ไม่สร้าง selection ปลอม
- Leave server markup และ initial client markup มี capability-filtered tab structure ตรงกัน; ครอบคลุมพนักงานปกติ, หลาย tabs, กรณีไม่มี `my-leave` แต่มี tab อื่น และ active/default tab ที่มองเห็นได้
- `html suppressHydrationWarning` เดิมใน `app/layout.tsx` คงอยู่ และไม่มี local `suppressHydrationWarning` เพิ่ม

Focused verification ที่ผ่าน:

- `npm.cmd run test:run -- __tests__/components/DashboardHomeSection.test.tsx __tests__/components/ThemeSelector.test.tsx modules/leave/presentation/dashboard/LeaveManagementSection.test.tsx` — **3 files, 29 tests ผ่าน**
- `npm.cmd run lint:strict` — ผ่าน
- `npm.cmd run typecheck` — ผ่าน
- `git diff --check` — ผ่าน
- `architecture:check` — ไม่รัน เพราะไม่มีการเปลี่ยน module/import boundary หรือ shared cross-layer hydration utility
- ไม่รัน `npm run build` และไม่รัน full repository suite เพราะ focused hydration tests, lint และ typecheck เพียงพอกับขอบเขต L5G

Repository-wide explicit inventory:

```text
npx.cmd eslint . --rule "react-hooks/set-state-in-effect:error" --format json
→ 24 -> 21 diagnostics
```

`SSE-002`, `SSE-004` และ `SSE-019` ไม่เหลือ diagnostic; `SSE-018` ยังเหลือโดยตั้งใจและถูก deferred ไป L5J. ไม่ได้แก้ findings อื่นแบบ opportunistic และ **ไม่ได้เริ่ม L5H หรือ phase ถัดไป**

## Phase L5H Completion Record

สถานะ: **เสร็จสิ้น**

แก้ไขแล้ว: `SSE-007`, `SSE-047`

รูปแบบ ownership ที่ใช้:

- `SSE-007` — `useIsMobile` ใช้ `useSyncExternalStore` กับ `matchMedia("(max-width: 767px)")` เป็น source เดียวกันสำหรับ `getSnapshot` และ subscription; `MediaQueryList` ถูก cache ต่อ `Window`/`matchMedia` เพื่อให้ snapshot เสถียรและ listener ใช้ object เดียวกัน
- `SSE-007` — `subscribe` เพิ่ม/ถอด listener เดิมด้วย `addEventListener("change")`/`removeEventListener`; `getServerSnapshot` เป็น `false` แบบ deterministic และไม่แตะ `window` หรือ `matchMedia`; จึงคง policy SSR/initial hydration เป็น non-mobile และคง boundary `767 => mobile`, `768 => desktop`
- `SSE-047` — localStorage ถูกย้ายไป `stockBrowseCart.store.ts` ซึ่งเป็น user-scoped external store แยกเฉพาะ Stock cart; snapshot เดียวเป็นเจ้าของ `cart`, `projectCode` และ pending idempotency และ cache reference จะเปลี่ยนเมื่อ persisted state เปลี่ยนเท่านั้น
- `SSE-047` — `getServerSnapshot` ใช้ empty snapshot คงที่โดยไม่อ่าน browser storage; `subscribe` หรือ explicit mutation จึงค่อยอ่าน storage ฝั่ง client และ write-back เริ่มได้หลัง store พร้อมหรือจาก mutation ที่เรียก `ensureClientReady`; ไม่มี default empty write ระหว่าง SSR/hydration
- `SSE-047` — storage key normalize user ID ด้วย `stock:browse-cart:v1:user:<normalizedUserId>` เดิม; store identity เปลี่ยนตาม key, anonymous/null ใช้ empty store ที่เขียนไม่ได้, และการเปลี่ยน `user A -> user B`, `user -> null`, `null -> user` ไม่แชร์ cart หรือ pending key ข้าม scope
- `SSE-047` — pending idempotency เป็นส่วนหนึ่งของ snapshot store ไม่ใช่ process/ref lifecycle; การเปลี่ยน payload จะ invalidate key, retry payload เดิมจะ reuse key, และ success จะ persist empty cart/project/pending state
- `clearStockBrowseCart(userId)` invalidate snapshot cache ของ user เป้าหมาย, ลบเฉพาะ user key กับ legacy key, และไม่ลบ user อื่น; storage read/parse/write/remove failures ยังคงไม่ทำให้ active in-memory flow ล้ม
- ไม่ได้ implement cross-tab `storage` subscription เพราะไม่ใช่ contract เดิม; in-document store mutation notify subscribers เอง

Invariants ที่ทดสอบ:

- viewport SSR/hydration, 767/768, change event, listener identity/cleanup และไม่มี listener สะสม
- cart empty/existing storage, no destructive pre-hydration write, SSR ไม่อ่าน localStorage, user switch isolation, pending idempotency isolation, null transitions, retry/payload mutation/availability reconciliation, success clearing, storage failure และ logout cleanup
- Dashboard และ LIFF ยังคงใช้ shared `useStockBrowseCart` semantics เดิม โดยไม่เปลี่ยน authorization, API, schema หรือ cart domain rules

Focused verification:

- `npm.cmd run test:run -- __tests__/hooks/use-mobile.test.tsx` — **1 file, 5 tests ผ่าน**
- `npm.cmd run test:run -- modules/stock/presentation/dashboard/components/useStockBrowseCart.test.ts` — **1 file, 20 tests ผ่าน**
- `npm.cmd run test:run -- modules/stock/__tests__/liff-app.test.tsx` — **1 file, 21 tests ผ่าน**
- `npm.cmd run test:run -- __tests__/context/DashboardProvider.test.tsx` — **1 file, 15 tests ผ่าน**
- `npm.cmd run architecture:check` — ผ่าน
- `npm.cmd run lint:strict` — ผ่าน
- `npm.cmd run typecheck` — ผ่าน
- `git diff --check` — ผ่าน

Repository-wide explicit inventory:

```text
npx.cmd eslint . --rule "react-hooks/set-state-in-effect:error" --format json
→ 21 -> 19 diagnostics
```

`SSE-007` และ `SSE-047` ไม่เหลือ diagnostic; ไม่ได้แก้ 19 รายการที่เหลือแบบ opportunistic. ไม่ได้เริ่ม `L5I` หรือ phase ถัดไป และไม่ได้แตะ pagination, URL/deep-link, async bootstrap, authorization, API contract, schema, migration, lint suppression หรือ timing workaround

## Phase L5I Completion Record

สถานะ: **เสร็จสิ้น**

แก้ไขแล้ว: `SSE-015`, `SSE-029`, `SSE-051`, `SSE-052`

รูปแบบ ownership ที่ใช้:

- `SSE-015` — Approver ใช้ guarded render-time reconciliation โดยเก็บ `totalPages` baseline และแก้ `currentPage` ที่เป็น durable state เมื่อ filtered dataset หดตัว; `pagedEmployees` จึง render ด้วย page ที่ clamp แล้วก่อน children commit
- `SSE-015` — search และ approver-filter ยัง reset page ผ่าน event handlers เดิม; save/mutate refresh ที่ทำให้จำนวนพนักงานลดลงจะ clamp page และเมื่อ dataset โตกลับ page ที่ถูก clamp จะไม่ rebound ไปหน้าก่อนหน้า
- `SSE-029` — Routine operational query identity ประกอบด้วย `scope`, `taskId`, `occurrenceId`, `debouncedSearch`, `unitId`, `categoryId` และ `timingStatus`; identity baseline reset เฉพาะ durable page เป็น 1 โดยไม่ remount หรือล้าง filter state อื่น
- `SSE-029` — local filter events ยังคง reset page อย่าง explicit ส่วน scope/deep-link และ external identity changes ใช้ render-time identity reconciliation; remote response ที่ยืนยัน `pagination.pages` จะ clamp empty/invalid page ผ่าน `onSuccess`
- `SSE-029` — `onSuccess` ตรวจ resolved query key กับ callback ของ current key ก่อนเปลี่ยน page จึงไม่ใช้ data ที่ `keepPreviousData` ค้างจาก query ก่อนหน้า; shrink → clamp → grow คง page ที่ clamp แล้ว
- `SSE-051` — Stock item pagination ใช้ `onSuccess` ของ query hook เป็น owner ของ remote total; browse และ inventory ใช้ durable state, limit และ URL key แยกกัน (`stockItemsPage` / `stockInventoryPage`)
- `SSE-051` — current response เท่านั้นที่ clamp page และเรียก setter เดิมเพื่อเขียน URL; browse/inventory ไม่ mutate ข้ามกัน และการ grow หลัง clamp ไม่คืน page เก่า
- `SSE-052` — Stock request pagination ใช้ request query identity และ `onSuccess` แยกจาก item pagination; total shrink clamp durable `requestsPage` พร้อม URL write-back และ total grow ไม่ rebound
- `SSE-052` — request search/filter reset และ debounce contract เดิมยังคงอยู่; ไม่ได้เปลี่ยน push/replace policy หรือ URL canonicalization ของ L5J

การป้องกัน stale response:

- Routine และ Stock รับ resolved SWR key จาก `onSuccess` และยอม reconcile เมื่อ key ตรงกับ query owner ปัจจุบันเท่านั้น; tests ครอบคลุม response key เก่าที่มาถึง callback ปัจจุบัน
- ไม่ใช้ `effectivePage`, timeout, microtask, animation frame หรือ synchronization effect ใหม่เพื่อซ่อน stale durable page

Focused verification:

- `npm.cmd run test:run -- modules/leave/presentation/dashboard/hooks/useApproverManagementModel.test.ts` — **1 file, 8 tests ผ่าน**
- `npm.cmd run test:run -- modules/stock/presentation/dashboard/context/StockProvider.test.tsx` — **1 file, 10 tests ผ่าน**
- `npm.cmd run test:run -- modules/stock/presentation/dashboard/context/provider.shared.test.ts` — **1 file, 7 tests ผ่าน**
- `npm.cmd run test:run -- modules/routine/presentation/dashboard/RoutineSection.test.tsx` — **1 file, 31 tests ผ่าน**
- `npm.cmd run lint:strict` — ผ่าน
- `npm.cmd run typecheck` — ผ่าน
- `git diff --check` — ผ่าน
- `npm.cmd run architecture:check` — ไม่รัน เพราะไม่มีการเปลี่ยน module boundary หรือ import layer

Repository-wide explicit inventory:

```text
npx.cmd eslint . --rule "react-hooks/set-state-in-effect:error" --format json
→ 19 -> 15 diagnostics
```

`SSE-015`, `SSE-029`, `SSE-051` และ `SSE-052` ไม่เหลือ diagnostic; ไม่ได้แก้ findings ของ L5J หรือ L5K แบบ opportunistic และ **ไม่ได้เริ่ม L5J หรือ phase ถัดไป**. API/server pagination contracts, authorization, debounce semantics และ URL history semantics เดิมยังคงเดิม

## Phase L5J Completion Record

สถานะ: **เสร็จสิ้น**

แก้ไขแล้ว: `SSE-018`, `SSE-021`, `SSE-033`, `SSE-034`, `SSE-048`, `SSE-049`, `SSE-050`, `SSE-055`

รูปแบบ ownership และ navigation ที่ใช้:

- Leave dashboard ใช้ `routeTab` ที่ผ่าน `normalizeLeaveDashboardTab(...)` จาก server เป็น canonical tab owner; client ไม่เก็บสำเนา tab ถาวร และ user tab action ใช้ `router.push(...)` ผ่าน `toDashboardLeaveTabPath(...)`
- Leave คง push semantics สำหรับ tab ที่ user เลือก, Back/Forward เปลี่ยน rendered tab ตาม route prop ที่เปลี่ยน และ server capability normalization กับ client defense-in-depth ยังคง fail closed
- Routine ใช้ `resolveRoutineActiveTab(...)` ตัวเดียว โดยลำดับคือ authorized task/occurrence focus → valid visible `routineTab` → first visible tab; focus ที่ไม่มี `all` capability ไม่ขยาย scope
- Routine user tab action เขียน `routineTab` ด้วย `push`; การออกจาก focused deep link จะลบ `taskId`/`occurrenceId` เมื่อเลือก tab อื่นที่ไม่ใช่ `all`; stale/hidden tab normalization ใช้ `replace` และไม่วนลูป
- Routine Back/Forward อ่าน `useSearchParams()` ขณะ component เดิมยัง mounted และคง L5I pagination query identity, stale-response guard และ remote clamp behavior
- Stock dashboard derive tab, browse page, inventory page, request page และ category จาก canonical URL projection; page keys ยังคงแยกกัน (`stockItemsPage`, `stockInventoryPage`, `stockRequestsPage`)
- Stock tab/page user navigation ใช้ `push`; category และ debounced search canonicalization ใช้ `replace`; hidden/invalid capability tab fallback ไม่พึ่ง local stale state และไม่เพิ่มสิทธิ์จาก URL
- Stock search แยก transient editable draft ออกจาก canonical `stockSearch`; input เปลี่ยนทันที, API/URL debounce ยังคงอยู่, committed search ใช้ page 1 ตั้งแต่ query แรก และการกลับไปค่าเดิมยัง reset page 1
- Stock search draft reconcile เฉพาะเมื่อ canonical search เปลี่ยน จึงรองรับ Back/Forward โดยไม่ทำลาย draft จาก query อื่นที่ไม่เกี่ยวข้อง; L5I remote item/request clamp ยังคงเขียน canonical page และไม่ rebound เมื่อข้อมูลโต
- LIFF Leave แยก pure `parseLiffLeaveDeepLink(...)` (string ID, allowed actions และความยาวเดิม) ออกจาก one-shot lifecycle; invalid notice เป็น URL projection, ไม่ fetch detail, ล้างตาม URL และ intent เดิมไม่ทำซ้ำ
- LIFF Stock แยก pure `parseLiffStockDeepLink(...)` (positive decimal safe integer เท่านั้น) ออกจาก lifecycle; capability notice แยกจาก operational notice และยังบังคับ read capability กับ process capability ก่อนเปิด detail
- Notice precedence กำหนดให้ operational notice แสดงก่อน URL deep-link notice; URL-owned invalid/capability projection ไม่ค้างหลัง query ถูกล้าง และการใส่ intent ใหม่ทำงานได้อีกครั้ง
- API/server authorization, domain authorization, schema, database, workforce identity และ capability definitions ไม่ถูกเปลี่ยน; client checks เป็น presentation safety เท่านั้น

Focused verification:

- `npm.cmd run test:run -- modules/leave/presentation/dashboard/LeaveManagementSection.test.tsx __tests__/dashboard-leave-page.test.tsx __tests__/lib/dashboard-routes.test.ts modules/leave/presentation/liff/LiffLeaveApp.test.tsx modules/routine/presentation/dashboard/RoutineSection.test.tsx modules/stock/presentation/dashboard/context/StockProvider.test.tsx modules/stock/presentation/dashboard/context/provider.shared.test.ts modules/stock/__tests__/liff-app.test.tsx` — **8 files, 136 tests ผ่าน**
- `npm.cmd run lint:strict` — ผ่าน
- `npm.cmd run typecheck` — ผ่าน
- `npm.cmd run architecture:check` — ผ่าน (ตรวจ 1,180 source files)
- `git diff --check` — ผ่าน
- explicit diagnostic inventory: **15 -> 7 diagnostics**; เหลือเฉพาะ 7 findings ที่ defer ไป L5K
- ตรวจ Thai/UTF-8 และ diff แล้ว ไม่พบ mojibake หรือไฟล์ generated/vendor ที่ถูกแก้
- ไม่รัน `npm run build` และไม่รัน full repository suite เพราะ focused route/hydration/deep-link/Back-Forward/pagination tests พร้อม lint, typecheck และ architecture check ครอบคลุมขอบเขต L5J

L5K ยังไม่ได้เริ่ม และ findings `SSE-003`, `SSE-006`, `SSE-020`, `SSE-024`, `SSE-025`, `SSE-037`, `SSE-053` ยังคงถูก defer ตามขอบเขต phase

### L5J Review Correction

- URL parser เป็นเจ้าของ navigation-intent identity; deep-link session เป็นเจ้าของอายุของ presentation warning แยกจาก parser result
- Leave เริ่ม invalid-link notice หนึ่งครั้งต่อ intent; การเปิดรายละเอียดคำขออื่นด้วยตนเอง acknowledge notice โดยไม่แก้ URL และ rerender ด้วย intent เดิมไม่สร้าง notice กลับมา
- Stock รอ capability projection ก่อน resolve valid intent แล้วบันทึกผลเป็น invalid, read-denied, process-denied หรือ authorized ใน session เดียวกัน; capability warning ไม่ได้ derive จาก URL และ capabilities ทุก render
- operational notice ยังคงมี owner แยกและ precedence สูงกว่า deep-link notice; การ acknowledge deep-link notice ไม่ล้าง operational notice
- การนำ URL intent ออกจบ session; เมื่อนำ intent เดิมกลับเข้ามาภายหลังจะเริ่ม session ใหม่และจัดการได้อีกครั้ง ทั้ง Leave และ Stock

## Phase L5K Completion Record

สถานะ: **เสร็จสิ้น**

แก้ไขแล้ว: `SSE-003`, `SSE-006`, `SSE-020`, `SSE-024`, `SSE-025`, `SSE-037`, `SSE-053`

รูปแบบ request ownership ที่ใช้:

- `SSE-003` — LIFF Home เริ่มด้วย `LOADING`; mount Effect เริ่มคำขอที่ผูกกับ sequence โดยไม่ reset state, retry เริ่ม transition จาก event และเริ่ม sequence ใหม่; cleanup และ sequence guard กันผลลัพธ์เก่าหรือผลหลัง unmount
- `SSE-006` — Email Request identity คือ `page + refresh generation`; loading/data/error derive จาก identity ที่ settle แล้ว, cleanup ละทิ้งผลเก่า, `refresh()` คงหน้าเดิมและสร้าง generation ใหม่; page clamp เดิมยังคงใช้ `max(1, totalPages)`
- `SSE-020` — Leave mount เริ่ม bootstrap จาก initial loading projection; ลำดับยังเป็น trusted home → capability projection → profile เฉพาะเมื่ออ่านคำขอของตนได้ → READY → approval refresh แบบไม่ block; retry ล้าง projection และ invalidates bootstrap/profile/approval/capability/detail sequences; L5J one-shot deep-link session ยังคงเดิม
- `SSE-024` — Routine Import reference ใช้ key `${batchId}:${batch.version}` พร้อม request generation; presentation ซ่อน reference ที่ key ไม่ตรงกับ batch/version ปัจจุบัน, schema validation เดิมยังบังคับใช้, retry เริ่ม request instance ใหม่ และ sequence guard กันผลเก่าหรือผลหลัง unmount
- `SSE-025` — Routine Import batch/rows ใช้ identity `batchId + page + filter + issue + selectedOnly + normalized debouncedSearch + refresh generation`; metadata กับ rows commit จาก `Promise.all` เป็น snapshot เดียว, latest request เท่านั้น commit success/error, mutation callers ยัง await การ revalidation; upload toast ถูก consume ได้เฉพาะ batch ปัจจุบันหลัง metadata และ rows สำเร็จทั้งคู่
- `SSE-037` — Routine bootstrap identity คือ `routine:default` หรือคู่ task/occurrence ที่ผ่าน parser เดิม; identity mismatch แสดง loading projection ทันที, trusted home ตรวจสิทธิ์ก่อน Routine APIs, sequence guard ป้องกัน focus เก่า, retry เริ่มคำขอใหม่และ invalidates task/detail work ตาม lifetime เดิม
- `SSE-053` — Stock capability bootstrap ใช้ sequence แยก; mount Effect ไม่ reset state, retry และ session-recovery workflow ล้าง projection แล้ว await `Promise<StockPresentationCapabilities | null>`; current sequence เท่านั้น commit capability/ref/tab projection, stale/unmounted response ไม่มีผล และ L5J deep-link intent resolve กับ capability ปัจจุบัน

Focused verification:

- `npm.cmd run test:run -- __tests__/components/LiffHome.test.tsx` — **1 file, 9 tests ผ่าน**
- `npm.cmd run test:run -- __tests__/hooks/useEmailRequestHistory.test.tsx __tests__/components/EmailRequestHistory.test.tsx` — **2 files, 8 tests ผ่าน**
- `npm.cmd run test:run -- modules/routine/presentation/dashboard/RoutineImportPanel.test.tsx` — **1 file, 26 tests ผ่าน**
- `npm.cmd run test:run -- modules/leave/presentation/liff/LiffLeaveApp.test.tsx` — **1 file, 20 tests ผ่าน**
- `npm.cmd run test:run -- modules/routine/presentation/liff/LiffRoutine.test.tsx` — **1 file, 44 tests ผ่าน**
- `npm.cmd run test:run -- modules/stock/__tests__/liff-app.test.tsx` — **1 file, 27 tests ผ่าน**
- `npm.cmd run lint:strict` — ผ่าน
- `npm.cmd run typecheck` — ผ่าน
- `npm.cmd run architecture:check` — ไม่รัน; ไม่ได้เพิ่ม production module หรือเปลี่ยน import boundary
- `git diff --check` — ผ่าน
- explicit inventory `npx.cmd eslint . --rule "react-hooks/set-state-in-effect:error" --format json --output-file <temp>` — **7 → 0 diagnostics**
- ไม่รัน full repository suite หรือ production build; focused suites ครอบคลุม request races, retry, identity transition และ unmount ของทั้งเจ็ด request families แล้ว

ไม่มี lint suppression, artificial timing boundary, API/auth/schema redesign หรือ async request migration นอก L5K เพิ่มเข้ามา

## React effect-state migration closure

React effect-state migration explicit inventory:

```text
initial audited findings: 58
remaining react-hooks/set-state-in-effect findings: 0
lint suppressions added for migration: 0
```

### ESLint policy cleanup (2026-09-23)

- เปิด `react-hooks/set-state-in-effect` เป็น `error` ใน `eslint.config.mjs` และลบคอมเมนต์ที่อธิบายการปิด rule ชั่วคราว
- `npx.cmd eslint . --rule "react-hooks/set-state-in-effect:error" --max-warnings=0` ผ่านก่อนเปิด rule ใน config; `npm.cmd run lint:strict` ผ่านหลังเปิด rule
- `npm.cmd run typecheck` และ `npm.cmd run architecture:check` ผ่าน (ตรวจ 1,181 source files)
- `npm.cmd run test:full:serial` ผ่าน: 346 files, 3,290 tests
- ไม่พบ suppression ของ `react-hooks/set-state-in-effect` ใน source และไม่ต้องเพิ่ม exception
