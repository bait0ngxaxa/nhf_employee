# Next.js 16 / React lint-debt audit

สถานะ: diagnostic-only inventory หลังการอัปเกรดเป็น Next.js 16.3.3

เอกสารนี้บันทึกผลตรวจ lint rules ที่ถูกปิดชั่วคราวระหว่าง migration เท่านั้น ไม่มีการแก้ production code, test, ESLint configuration หรือพฤติกรรมของแอป

## Executive Summary

พบ 80 raw ESLint diagnostics ในไฟล์ที่ไม่ซ้ำกัน 46 ไฟล์ แบ่งเป็น errors 78 รายการและ warnings 2 รายการ ตัวเลขนี้รวม diagnostics ที่ ESLint รายงานซ้ำจาก AST ranges ที่ทับซ้อนกัน โดยเฉพาะ ref access ใน LiffLeaveApp ซึ่งเป็น code site เดียวแต่ถูกรายงาน 7 ครั้ง

| รายการ | จำนวน |
| --- | ---: |
| Newly exposed findings ทั้งหมด | 80 |
| ไฟล์ที่ได้รับผลกระทบแบบไม่ซ้ำ | 46 |
| Errors | 78 |
| Warnings | 2 |
| A — Correctness risk | 8 |
| B — Maintainability / performance debt | 18 |
| C — React Compiler compatibility only | 2 |
| D — Intentional / justified pattern | 52 |
| E — Needs investigation | 0 |

กฎ @typescript-eslint/explicit-module-boundary-types ถูกคอมเมนต์ปิดอยู่ก่อน migration และไม่ถูกรวมในตัวเลขข้างต้น

หนี้ส่วนใหญ่อยู่ที่ react-hooks/set-state-in-effect จำนวน 61 diagnostics แต่ 43 รายการเป็น effect ที่มีเหตุผลด้าน async, browser, subscription, hydration, permission หรือ reset behavior และไม่ควร auto-fix โดยไม่อ่านบริบท ส่วน correctness risk ที่มีหลักฐานชัดที่สุดคือ Math.random() ใน render และการอ่าน ref ระหว่าง render เพื่อกำหนด visibility ของ approval tab

## Audit Method

ตรวจทีละ rule ด้วย ESLint CLI rule override และ JSON formatter โดยไม่แก้ eslint.config.mjs และไม่เปิดทั้งหกกฎพร้อมกันในการเก็บ inventory หลัก

~~~powershell
.\node_modules\.bin\eslint.cmd . --format json --rule "<rule>:<severity>" --no-warn-ignored
~~~

กฎและ severity ที่ใช้:

~~~text
react-hooks/purity:error
react-hooks/refs:error
react-hooks/set-state-in-effect:error
@next/next/no-location-assign-relative-destination:warn
react-hooks/preserve-manual-memoization:error
react-hooks/incompatible-library:warn
~~~

ผล JSON ถูกอ่านเพื่อเก็บ path, line, column, severity และ message แล้วสรุปในเอกสารนี้ ไม่มี temporary config หรือ raw lint dump เหลืออยู่ใน repository

## Rule Inventory

| Rule | Findings | Files | Errors / warnings | Primary classification | Recommended phase |
| --- | ---: | ---: | --- | --- | --- |
| react-hooks/purity | 2 | 2 | 2 / 0 | A, D | L1 |
| react-hooks/refs | 14 | 3 | 14 / 0 | A, D | L1 |
| react-hooks/set-state-in-effect | 61 | 40 | 61 / 0 | B, D | L2 |
| @next/next/no-location-assign-relative-destination | 1 | 1 | 0 / 1 | D; semantics review | L3 |
| react-hooks/preserve-manual-memoization | 1 | 1 | 1 / 0 | C | L4 |
| react-hooks/incompatible-library | 1 | 1 | 0 / 1 | C | L4 |
| **รวม raw diagnostics** | **80** | **46 unique** | **78 / 2** |  |  |

จำนวนไฟล์ per-rule รวมเป็น 48 เพราะ LiffLeaveApp.tsx และ LiffRoutineTaskForm.tsx อยู่มากกว่าหนึ่ง rule แต่ union จริงคือ 46 ไฟล์

## Findings by Rule

### react-hooks/purity

ESLint message: Error: Cannot call impure function during render

พบ 2 errors ใน 2 ไฟล์

| ตำแหน่ง | รูปแบบ | Classification |
| --- | --- | --- |
| components/ui/sidebar.tsx:612:26 | Math.random() ใน callback ของ useMemo เพื่อสร้าง width แบบสุ่ม | A |
| modules/auth/presentation/HybridAuthProvider.tsx:73:37 | Date.now() เป็นค่าเริ่มต้นของ useRef ระหว่าง render | D |

sidebar.tsx ใช้ผลลัพธ์ของ Math.random() เป็น render output แม้จะ memo ไว้ จึงไม่ deterministic สำหรับ props/state เดิมและอาจกระทบ render replay, hydration หรือ visual consistency ได้ แต่ audit นี้ยังไม่สรุปว่าเกิด production bug แล้ว

HybridAuthProvider ใช้ timestamp ref เป็น baseline สำหรับ visibility refresh และไม่ได้ส่งค่า Date.now() เข้า JSX โดยตรง การใช้ Date.now() เพิ่มเติมอยู่ใน event callback ซึ่งเป็น safe boundary จึงจัดเป็น intentional/justified pattern

### react-hooks/refs

ESLint message: Cannot access ref value during render

พบ 14 errors ใน 3 ไฟล์ โดยมี diagnostics ซ้ำใน code site เดียว

#### modules/leave/presentation/liff/LiffLeaveApp.tsx

- ตำแหน่ง 506:13 จำนวน 7 diagnostics ที่ expression เดียวกัน
- Pattern: showApprovalTab อ่าน hasApprovalRelationshipRef.current ระหว่าง render ร่วมกับ hadApprovalWork และ approvals.hasActionableWork
- Classification: A จำนวน 7 raw diagnostics

hasApprovalRelationshipRef ถูกเขียนใน applyTrustedHomeProjection, refreshApprovals, openDetail และ clearTrustedLeaveProjection หลายเส้นทางมี state update คู่กัน เช่น setHadApprovalWork, setLeaveCapabilities หรือ setApprovals แต่ถ้า ref เปลี่ยนโดยไม่มี state update ที่ trigger render ค่า approval-tab visibility อาจ stale ได้ จึงเป็น credible potential correctness risk ไม่ใช่ข้อสรุปว่าเกิด bug แล้ว

#### modules/routine/presentation/dashboard/RoutineImportRowEditor.tsx

- ตำแหน่ง 277:21 จำนวน 4 diagnostics จาก ranges ที่ทับซ้อนกัน
- ตำแหน่ง 278:32 จำนวน 1 diagnostic
- ตำแหน่ง 282:13 จำนวน 1 diagnostic
- รวม 6 diagnostics
- Pattern: เปรียบเทียบ currentSnapshot กับ initialSnapshotRef.current เพื่อคำนวณ isDirty และตัดสินใจใน requestClose
- Classification: D จำนวน 6

ref นี้เป็น baseline ของ dirty-form snapshot โดย effect ตั้ง baseline ก่อนหรือร่วมกับ state setters และ conflict paths update baseline คู่กับ setForm ไม่พบ correctness issue ที่แยกจาก lint rule แต่ไม่ควรเปลี่ยนเป็น state หรือ suppress แบบกลไกโดยไม่ตรวจ reset/conflict lifecycle

#### modules/routine/presentation/liff/LiffRoutineTaskForm.tsx

- ตำแหน่ง 289:41 จำนวน 1 diagnostic
- Pattern: เปรียบเทียบ currentSnapshot กับ initialSnapshotRef.current เพื่อคำนวณ isDirty
- Classification: D

เป็น dirty-form baseline แบบเดียวกับ dashboard editor และ conflict path update baseline พร้อม setForm ไม่พบ independent correctness issue จาก static inspection

สรุป rule นี้: 7 raw diagnostics เป็น correctness-risk candidate จาก approval visibility และอีก 7 เป็น intentional dirty-form baseline

### react-hooks/set-state-in-effect

ESLint message: Error: Calling setState synchronously within an effect can trigger cascading renders

พบ 61 errors ใน 40 ไฟล์ แบ่งตามการอ่าน code จริงดังนี้

#### B — Maintainability / performance debt: 18 diagnostics

กลุ่มนี้เป็น derived state, URL/filter/page/tab state, pagination หรือ local synchronization ที่มีโอกาสลด render/effect work ได้ แต่ต้องยืนยัน reset และ lifecycle contract ก่อนแก้

- components/dashboard/layout/DashboardSidebarPrimitives.tsx:178:9
- modules/audit/presentation/dashboard/AuditLogsProvider.tsx:60:9
- modules/authorization/presentation/dashboard/components/AuthorizationDialogs.tsx:514:13
- modules/authorization/presentation/dashboard/components/UserAccessPanel.tsx:461:72
- modules/leave/presentation/dashboard/LeaveManagementSection.tsx:40:13
- modules/leave/presentation/dashboard/hooks/useApproverManagementModel.ts:81:9
- modules/routine/presentation/dashboard/RoutineScheduleFields.tsx:149:51
- modules/routine/presentation/dashboard/RoutineSection.tsx:130:9
- modules/routine/presentation/dashboard/RoutineSection.tsx:551:13
- modules/routine/presentation/dashboard/RoutineSection.tsx:561:13
- modules/routine/presentation/dashboard/RoutineSection.tsx:568:13
- modules/routine/presentation/liff/LiffRoutineTaskForm.tsx:280:60
- modules/stock/presentation/dashboard/context/StockProvider.tsx:117:9
- modules/stock/presentation/dashboard/context/StockProvider.tsx:124:9
- modules/stock/presentation/dashboard/context/StockProvider.tsx:133:9
- modules/stock/presentation/dashboard/context/StockProvider.tsx:421:13
- modules/stock/presentation/dashboard/context/StockProvider.tsx:429:18
- modules/stock/presentation/liff/components/LiffStockApp.tsx:784:13

#### D — Intentional / justified pattern: 43 diagnostics

กลุ่มนี้เป็น async result handling, external-system synchronization, browser/DOM state, hydration, subscription lifecycle, permission projection หรือ reset behavior การย้าย setter ออกจาก effect อาจเปลี่ยน semantics

- components/dashboard/sections/DashboardHomeSection.tsx:277:9
- components/liff/home/LiffHomeApp.tsx:193:14
- components/theme/ThemeSelector.tsx:36:9
- components/ui/async-form-dialog.tsx:92:7
- hooks/use-mobile.ts:14:5
- hooks/useEmailRequestHistory.ts:87:9
- modules/authorization/presentation/dashboard/components/AuthorizationDialogs.tsx:112:9
- modules/authorization/presentation/dashboard/components/AuthorizationDialogs.tsx:222:9
- modules/authorization/presentation/dashboard/components/AuthorizationDialogs.tsx:315:9
- modules/authorization/presentation/dashboard/components/AuthorizationDialogs.tsx:456:9
- modules/authorization/presentation/dashboard/components/AuthorizationDialogs.tsx:692:19
- modules/employee/presentation/dashboard/context/EmployeeProvider.tsx:279:13
- modules/leave/presentation/dashboard/LeaveManagementSection.tsx:45:9
- modules/leave/presentation/dashboard/components/LeaveAttachmentViewerDialog.tsx:73:9
- modules/leave/presentation/dashboard/hooks/useEmployeeLeaveDashboardModel.ts:128:13
- modules/leave/presentation/dashboard/hooks/useManagerApprovalModel.ts:133:13
- modules/leave/presentation/liff/LiffLeaveApp.tsx:292:14
- modules/leave/presentation/liff/LiffLeaveApp.tsx:338:13
- modules/leave/presentation/liff/LiffLeaveDecisionSheet.tsx:136:21
- modules/leave/presentation/liff/LiffLeaveHistory.tsx:243:19
- modules/routine/presentation/dashboard/RoutineImportPanel.tsx:411:18
- modules/routine/presentation/dashboard/RoutineImportPanel.tsx:415:14
- modules/routine/presentation/dashboard/RoutineOccurrenceEditDialog.tsx:105:9
- modules/routine/presentation/dashboard/RoutineOccurrenceList.tsx:75:13
- modules/routine/presentation/dashboard/RoutineSection.tsx:141:13
- modules/routine/presentation/dashboard/RoutineSection.tsx:358:13
- modules/routine/presentation/dashboard/RoutineTaskList.tsx:123:13
- modules/routine/presentation/liff/LiffRoutineApp.tsx:149:13
- modules/routine/presentation/liff/LiffRoutineApp.tsx:244:14
- modules/routine/presentation/liff/LiffRoutineTaskDetail.tsx:133:9
- modules/stock/presentation/dashboard/components/StockAdminInventory.tsx:46:13
- modules/stock/presentation/dashboard/components/StockAdminRequests.tsx:76:13
- modules/stock/presentation/dashboard/components/StockBrowse.tsx:73:13
- modules/stock/presentation/dashboard/components/StockInventoryAddItemDialog.tsx:55:13
- modules/stock/presentation/dashboard/components/StockMyRequests.tsx:67:13
- modules/stock/presentation/dashboard/components/StockRequestCancelDialog.tsx:32:13
- modules/stock/presentation/dashboard/components/StockVariantPickerDialog.tsx:72:13
- modules/stock/presentation/dashboard/components/useStockBrowseCart.ts:404:13
- modules/stock/presentation/liff/components/LiffStockApp.tsx:384:14
- modules/stock/presentation/liff/components/LiffStockApp.tsx:389:13
- modules/stock/presentation/liff/components/LiffStockApp.tsx:477:13
- modules/stock/presentation/liff/components/LiffStockDecisionSheet.tsx:45:21
- modules/stock/presentation/liff/components/LiffStockVariantPicker.tsx:43:19

ไม่พบหลักฐานให้เรียก 43 รายการนี้ว่า production bugs จาก static inspection เพียงอย่างเดียว โดยเฉพาะ setter ที่รับ async result, external response, browser media query, dialog lifecycle หรือ subscription state

### @next/next/no-location-assign-relative-destination

ESLint message:

Do not use window.location.href to navigate to internal Next.js pages. Use redirect() in the render phase, or useRouter().push() in Client Components' event handlers instead. See: https://nextjs.org/docs/messages/no-location-assign-relative-destination

พบ 1 warning:

- app/error.tsx:57:45
- Pattern: event handler กำหนด window.location.href เป็น "/"
- Classification: D; navigation semantics review

Destination เป็น relative/internal path จริง และอยู่ใน global error boundary การใช้ full-document navigation ดูตั้งใจเพื่อ clear error boundary/client state และเริ่มแอปใหม่ router.push("/") อาจคง client state และเปลี่ยน recovery semantics ส่วนการเปลี่ยนเป็น absolute URL ไม่ได้พิสูจน์ว่าปลอดภัยกว่าเพราะอาจมีผลกับ host, basePath หรือ deployment configuration

Dynamic auth/LIFF navigation เช่น window.location.assign(nextLoginUrl) ไม่ถูก rule นี้รายงาน จึงไม่ถูกรวมใน finding count และผล audit นี้ไม่ได้ยืนยัน navigation paths ที่ rule ตรวจไม่ถึง

### react-hooks/preserve-manual-memoization

ESLint message: Compilation Skipped: Existing memoization could not be preserved

พบ 1 error:

- components/dashboard/context/dashboard/DashboardProvider.tsx:181:39
- Manual memoization: handleSignOut ใช้ useCallback
- Source dependencies: signOut และ user?.id
- Compiler-inferred dependency: user
- Classification: C

Compiler skip เพราะ inferred dependency ไม่ตรงกับ manual dependency เดิม ไม่พบ correctness issue ที่เป็นอิสระจาก compiler diagnostic จึงไม่ควรลบ useCallback หรือเปลี่ยน dependencies แบบเดา

### react-hooks/incompatible-library

ESLint message: Compilation Skipped: Use of incompatible library

พบ 1 warning:

- modules/leave/presentation/dashboard/hooks/useLeaveRequestFormModel.ts:139:23
- Library/API: React Hook Form form.watch("leaveType")
- Hook เดียวกัน watch startDate, endDate และ period ด้วย แต่ diagnostic ชี้ occurrence แรก
- Classification: C

React Compiler ไม่สามารถ memoize API ที่มี subscription/proxy behavior นี้ได้อย่างปลอดภัยโดยไม่เสี่ยง stale UI จึง skip compilation Finding นี้เป็น compiler boundary ไม่ใช่หลักฐานว่า runtime behavior ปัจจุบันผิด และไม่ควรเปลี่ยน library ใน audit นี้

## High-Risk Findings

มีเพียงสอง code sites ที่มี credible correctness implication:

1. components/ui/sidebar.tsx:612:26 — Math.random() เป็น impure render input ทำให้ output ไม่ deterministic และอาจกระทบ render replay, hydration หรือ visual consistency
2. modules/leave/presentation/liff/LiffLeaveApp.tsx:506:13 — ref ถูกใช้เป็น render input ของ approval-tab visibility หาก ref เปลี่ยนโดยไม่มี state update ค่า UI อาจ stale แม้หลาย mutation paths ปัจจุบันมี state update คู่กัน

รายการที่สองถูกรายงาน 7 ครั้งแต่เป็น code site เดียว ไม่ใช่ 7 defects แยกกัน

## Compiler-Only Findings

Compiler-only debt มี 2 diagnostics และแยกจาก runtime correctness backlog:

- DashboardProvider.tsx:181:39 — manual useCallback dependency ไม่ตรงกับ dependency ที่ compiler infer
- useLeaveRequestFormModel.ts:139:23 — React Hook Form watch() เป็น incompatible API สำหรับ compiler memoization

แนวทางภายหลังควรกำหนด compiler/library boundary และตรวจ callback identity หรือ subscription contract ก่อน ไม่ควรลบ memoization หรือเปลี่ยน form library เพียงเพื่อให้ lint หาย

## Intentional / Justified และ Needs Investigation

D มี 52 raw diagnostics:

- HybridAuthProvider ใช้ Date.now() เป็น refresh timestamp baseline
- Routine import/task forms ใช้ ref เป็น initial snapshot เพื่อ dirty/conflict behavior
- set-state-in-effect จำนวน 43 รายการเป็น async result, external-system sync, browser/DOM, hydration, subscription, permission projection หรือ reset lifecycle
- error boundary ใช้ full-document navigation ที่ดู deliberate

การจัดเป็น D หมายถึงพบเหตุผลทาง architecture จาก code ปัจจุบัน ไม่ได้หมายความว่าควร suppress rule อย่างถาวร

ไม่มี finding ที่จัดเป็น E จาก static inspection รอบนี้ High-risk candidates ยังต้องมี focused behavior verification ก่อน remediation แต่หลักฐานเพียงพอที่จะจัดประเภทความเสี่ยงโดยไม่เดาว่าเป็น production defect

## Concentration and Repeated Patterns

### ตาม module

| Module / พื้นที่ | Raw diagnostics |
| --- | ---: |
| Routine | 23 |
| Stock | 19 |
| Leave | 18 |
| Shared UI, hooks และ dashboard context | 9 |
| Authorization | 7 |
| Auth | 1 |
| Audit | 1 |
| Employee | 1 |
| app/error.tsx | 1 |
| **รวม** | **80** |

### ไฟล์ที่มี diagnostics มากที่สุด

| ไฟล์ | Raw diagnostics | รูปแบบหลัก |
| --- | ---: | --- |
| modules/leave/presentation/liff/LiffLeaveApp.tsx | 9 | ref read ซ้ำ 7 และ set-state-in-effect 2 |
| modules/authorization/presentation/dashboard/components/AuthorizationDialogs.tsx | 6 | effect setters หลาย lifecycle |
| modules/routine/presentation/dashboard/RoutineSection.tsx | 6 | derived/reset state และ synchronization |
| modules/routine/presentation/dashboard/RoutineImportRowEditor.tsx | 6 | dirty-form ref ที่รายงานซ้ำ |
| modules/stock/presentation/dashboard/context/StockProvider.tsx | 5 | provider state synchronization |
| modules/stock/presentation/liff/components/LiffStockApp.tsx | 4 | browser/async และ derived state |

Recurring patterns:

1. Effect setters ที่คำนวณ state จาก URL, filter, page, tab หรือ form value เป็นกลุ่ม B ที่ควร review ก่อน
2. Effect setters ที่รับ async/external result หรือจัดการ browser, hydration, subscription, permission และ reset เป็นกลุ่ม D ไม่ควรย้ายโดยกลไก
3. Ref เป็น render input ทั้งใน approval visibility และ dirty-form baseline แต่มี risk profile ต่างกัน
4. Compiler diagnostics มีเพียงสองจุดและไม่ใช่ runtime bug backlog
5. จำนวน set-state diagnostics สูงไม่ได้แปลว่ามี 61 design failures แยกกัน แต่สะท้อน effect/state lifecycle pattern ที่เกิดซ้ำใน Routine, Stock และ Leave

## Proposed Remediation Phases

หลักฐานสนับสนุนลำดับ L1 → L2 → L3 → L4

### Phase L1 — correctness-oriented React rules

Scope: react-hooks/purity และ react-hooks/refs

เริ่มจาก sidebar.tsx:612 และ LiffLeaveApp.tsx:506 ด้วย focused behavior sequence จากนั้นแยก safe event/effect ref access ออกจาก render reads และ dirty-form baselines ที่ตั้งใจไว้

ขอบเขต: ไม่ bulk-rewrite useRef, ไม่เปลี่ยน approval authorization contract และไม่ลบ form snapshot refs ก่อนตรวจ reset/conflict behavior

### Phase L2 — effect/state synchronization

Scope: react-hooks/set-state-in-effect

เริ่มจาก 18 รายการกลุ่ม B โดยพิจารณา render derivation, event derivation หรือ reducer เฉพาะเมื่อรักษา reset, loading, race และ async ordering ได้ จากนั้น review 43 รายการกลุ่ม D แบบราย lifecycle

ขอบเขต: ไม่ย้าย setter เพียงเพื่อให้ lint ผ่าน และต้องรักษา loading/error/subscription/hydration behavior รวมถึง cancellation และ stale-response handling

### Phase L3 — Next.js navigation semantics

Scope: app/error.tsx:57:45 เพียงรายการเดียว

ยืนยันว่าต้องการ full-document reload เพื่อ recover จาก error boundary หรือไม่ และเปรียบเทียบ semantics ของ router.push, redirect และ window.location ภายใต้ basePath/deployment configuration

ขอบเขต: ไม่เปลี่ยน auth/LIFF navigation ที่ rule นี้ไม่ได้รายงาน และไม่แปลงเป็น absolute URL โดยไม่มี deployment evidence

### Phase L4 — React Compiler readiness

Scope:

- components/dashboard/context/dashboard/DashboardProvider.tsx:181:39
- modules/leave/presentation/dashboard/hooks/useLeaveRequestFormModel.ts:139:23

กำหนด compiler/library boundary และตรวจ callback identity กับ React Hook Form subscription contract ก่อนปรับ memoization หรือ integration strategy

ขอบเขต: ไม่ถือว่าเป็น correctness bug โดยอัตโนมัติ ไม่ลบ manual memoization และไม่เปลี่ยน library โดยไม่มีหลักฐาน

## Verification Record

ทำแล้ว:

- อ่าน AGENTS.md, eslint.config.mjs และ package.json
- อ่าน local Next.js 16 upgrade/ESLint documentation และ installed React Hooks/Next rule implementation ที่เกี่ยวข้อง
- ตรวจทั้งหก rules แบบ independent ด้วย machine-readable JSON output
- ตรวจ source context ของทุก finding ก่อนจัดประเภท

ไม่ได้ทำตามข้อกำหนด:

- ไม่รัน npm run test:full:serial
- ไม่รัน npm run test:run
- ไม่รัน npm run build
- ไม่แก้ production code, tests หรือ eslint.config.mjs
- ไม่เปิด rules ถาวร
- ไม่สร้างหรือเก็บ temporary audit config/raw dump

Final repository verification ใช้เฉพาะ:

~~~powershell
git diff --check
git status
git diff
~~~

ไฟล์ที่เปลี่ยนจาก audit นี้ควรมีเพียง docs/architecture/next16-react-lint-debt-audit.md
