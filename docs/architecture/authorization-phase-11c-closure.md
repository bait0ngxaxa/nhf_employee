# NHF Employee Authorization Phase 11C — Security Regression Closure

- สถานะ: **CLOSED**
- Audit baseline: `5669d79ca359701bc6a637079ca738575b731cf7`
- วันที่ตรวจ: `2026-09-16`
- Production policy: **ไม่เปลี่ยนแปลง**

เอกสารนี้เป็นบันทึกปิด Phase 11C หลังการ reconcile matrix, operation ledger,
source และ test evidence ที่ current baseline. การปิด phase นี้ไม่ใช่การเปิด
policy migration ใหม่

## Executive conclusion

ผล audit สุดท้ายจาก [authorization-phase-11c-security-regression-matrix.md](authorization-phase-11c-security-regression-matrix.md) คือ:

| ขอบเขต | ผลลัพธ์ |
| --- | ---: |
| Matrix cases | 89 |
| `DIRECT` / `INDIRECT` / `MISSING` / `N/A` | 80 / 6 / 0 / 3 |
| Migrated route ledger | 81/81 `DIRECT` |
| Protected route rows | 78/78 `DIRECT` |
| Authorization Administration command rows | 17/17 `DIRECT` |
| Combined explicit ledger | 98/98 `DIRECT` |
| Mandatory Phase 11C.2 backlog | 0 |

ไม่พบ newly discovered blocking authorization defect และไม่พบ mandatory
Phase 11C.2 regression gap ที่เหลืออยู่ การมี `INDIRECT` ไม่ใช่ security defect:
เป็น aggregate, partial, deferred หรือ architecture evidence ตามขอบเขตของแต่ละ
row. การมี `N/A` หมายถึง architecture ไม่ได้ claim invariant ที่แข็งกว่าใน
ปัจจุบัน ไม่ได้หมายความว่า route นั้นไม่มี authentication หรือ authorization
protection.

Phase 11C ไม่ได้ activate Team policy, ไม่ได้ retire compatibility/deferred
behavior, ไม่ได้เปลี่ยน Dashboard/LIFF channel behavior และไม่ได้เปลี่ยน
production authorization policy.

The 81 route-ledger rows are `78` protected operations plus exactly three
presentation-only Stock LIFF projection rows: `LEDGER-STK-23`,
`LEDGER-STK-24`, and `LEDGER-STK-26`. Their corresponding POST mutation routes
remain separate ledger entries and are not replaced by projection evidence.
The explicit ledger arithmetic is `81 + 17 = 98`, separate from the 89 matrix
cases.

## Mandatory Phase 11C.2 backlog closure

| Work item | Final status |
| --- | --- |
| `11C2-CAP-01` | **COMPLETE — Phase 11C.2A** |
| `11C2-CAP-02` | **COMPLETE — Phase 11C.2A** |
| `11C2-ACTOR-01` | **COMPLETE — Phase 11C.2B** |
| `11C2-TX-01` | **COMPLETE — Phase 11C.2B** |
| `11C2-TX-02` | **COMPLETE — Phase 11C.2B** |
| `11C2-API-01` | **COMPLETE — Phase 11C.2C.2** |

Final mandatory Phase 11C.2 regression backlog: `0`.

## What Phase 11C proved

- Authentication และ lifecycle: invalid session, inactive/deleted User,
  workforce lifecycle และ LIFF identity/link boundaries ถูกปฏิเสธตาม contract.
- Trusted actor provenance: `userId`, `employeeId`, current system role,
  capability และ channel มาจาก server/session หรือ fixed route boundary ไม่ใช่
  request body, query, headers หรือ route target.
- Central resolver: registry lookup, supported channel, additive grant union,
  default deny, invalid configuration และ Team-origin validation fail closed.
- Grant revocation applicability: direct User grants, Team memberships,
  Team-origin grants และ TeamRole grants ใช้ current applicable state ใน fresh
  resolution.
- Scope/resource enforcement: `OWN`, `CREATED`, `ASSIGNED`, `TEAM` origin และ
  `ALL` ถูกแยกจาก domain relationship, lifecycle, workflow และ validation rules.
- Channel isolation: Dashboard และ `LIFF_SELF_SERVICE` ใช้ resolver model เดียวกัน
  แต่ LIFF ยังคง self-service/resource restrictions และไม่รับ Dashboard-only
  recovery semantics.
- Direct API enforcement: migrated Employee, Routine, Stock, Leave, Audit,
  Notification และ Administration entry points ตรวจที่ server ไม่พึ่ง hidden UI.
- Transaction/current-state revalidation: Routine, Stock, Leave และ Employee
  ใช้ lock/re-read หรือ current actor resolution เฉพาะจุดที่ contract ระบุ;
  ไม่ขยาย claim ไปยัง unsupported non-transactional paths.
- ADMIN boundaries: `ADMIN` ไม่ bypass authentication, workforce lifecycle,
  domain/workflow invariants, channel restrictions, locks หรือ Team-origin rules.
- Compatibility/deferred classification: legacy floors, Routine work-item bridge,
  domain-owned Leave behavior, presentation projections และ deferred capabilities
  ถูกบันทึกตาม current behavior โดยไม่ relabel เป็น migration gap.

## Remaining INDIRECT / N/A evidence

### `INDIRECT` — legitimate partial or aggregate evidence

| Row | เหตุผลที่ยังเป็น `INDIRECT` |
| --- | --- |
| `AUTHN-01` | เป็น aggregate authentication evidence ของ selected Dashboard/API entry points; ไม่มี mandatory route gap แต่ไม่ได้ claim exhaustive auth test ทุก route. |
| `CAP-12` | Current tests พิสูจน์ additive grant/default-deny behavior; การไม่มี explicit DENY, wildcard, policy DSL หรือ priority override ยังอาศัย source/schema inspection บางส่วน. `11C2-CAP-03` เป็น OPTIONAL strengthening เท่านั้น. |
| `CHANNEL-07` | Dashboard และ LIFF cases แข็งแรงแยกกัน แต่ยังไม่มี exhaustive paired parity matrix ทุก capability ที่มีร่วมกัน. `11C2-CHANNEL-01` เป็น OPTIONAL strengthening เท่านั้น. |
| `ADMIN-08` | Current-role evidence ครอบคลุม cases ที่ระบุ และ `ACTOR-06`/`TX-06` ครอบคลุม cross-domain mutation proofs โดยตรง แต่ row นี้เป็น aggregate ที่กว้างกว่า จึงไม่ overclaim exhaustive ADMIN-route coverage. |
| `COMPAT-10` | Leave report/export อยู่นอก migrated capability set; route/report behavior มี tests และ registry/Administration evidence อยู่ใกล้เคียง แต่ยังไม่มี dedicated classification assertion. การเพิ่ม assertion เป็น OPTIONAL; future report/export policy อยู่นอก Phase 11C. |
| `COMPAT-15` | เป็น Team/organization architecture boundary: Team ไม่ใช่ Department, TeamRole name ไม่ใช่ authority และต้องมี explicit origin; ยังไม่มี active domain-Team policy runtime test. Future Team matrix/test เป็นงานนอก phase. |

### `N/A` — stronger invariant intentionally not claimed

| Row | เหตุผลที่เป็น `N/A` |
| --- | --- |
| `SCOPE-05` | ปัจจุบันไม่มี active domain Team-resource semantics หรือ Team scope adapter. Matrix จึงไม่ claim cross-Team resource policy; route protection อื่น ๆ ไม่ได้ถูกยกเลิก. |
| `TX-09` | Read-only, Employee create/import และ path ที่ระบุว่า non-transactional ไม่ได้ claim transaction-wide authorization revalidation. ห้ามสร้าง guarantee เพิ่มระหว่าง closure. |
| `TX-10` | Routine partial-success import มี capability preflight และ domain validation แต่ไม่ได้ claim transaction-wide authorization re-read. ไม่ redesign import transaction ใน phase นี้. |

ทั้งสาม `N/A` เป็นขอบเขตของ invariant ที่ architecture รับรอง ไม่ใช่ active
authorization bypass และไม่เพิ่ม `MISSING`.

## Compatibility/deferred policies intentionally preserved

- Employee broad read/stats/export และ explicit ADMIN mutation floor ยังคงเป็น
  compatibility policy; ไม่ได้ตัดสิน PII/broad-data narrowing.
- Department full-read floor, Notification actor-owned `OWN`, Stock relationship
  floors และ Dashboard ADMIN employee-optional allowlist ยังคงเดิม.
- Routine normal USER work-item `NO_APPLICABLE_GRANT -> ALL` bridge ยังคงจำกัด
  เฉพาะ exact historical work-item case; ไม่ retire หรือ broaden.
- Routine summary/reference/export, Leave participant/detail/attachment/recovery
  boundaries, Leave report/export และ Email Request ยังคง deferred หรือ
  domain-owned ตาม current classification.
- Dashboard/LIFF navigation และ capability projections เป็น presentation only
  ไม่ใช่ mutation authority.

## Future policy decisions outside Phase 11C

สี่ decision families ต่อไปนี้ยังอยู่นอก Phase 11C และยังไม่ถือว่าดำเนินการแล้ว:

1. Routine summary/reference/export future central authorization policy.
2. Leave report/export future authorization policy.
3. Email Request read/create future authorization policy.
4. Future Team/domain resource policy.

สำหรับ Team ต้องรักษาขอบเขตที่ lock ไว้ทั้งหมด: Team != Department; ห้าม infer
Team จาก Department หรือ Employee metadata; ต้องมี explicit Team origin; ห้าม
สร้าง nested Team; ห้าม TeamRole inheritance; และชื่อ TeamRole ไม่มี intrinsic
capability authority.

## Accepted limitations

1. ไม่ได้ inventory production authorization database. Empty code-owned seed
   ไม่ใช่หลักฐานว่า production ไม่มี `Team`, `TeamRole`, `TeamMembership`,
   `TeamCapabilityGrant`, `TeamRoleCapabilityGrant` หรือ `UserCapabilityGrant`.
2. Resolver transaction semantics ไม่รับรอง atomic observation ของ
   grant/membership/role commit จาก unrelated concurrent transaction ที่เกิด
   หลัง resolver อ่านข้อมูลของตนเอง.
3. Central resolver โดยทั่วไปไม่ได้ lock grant/membership rows.
4. Supported domain adapters lock/re-read เฉพาะ rows ที่ documented contract
   ของ adapter นั้น claim.
5. Read-only paths, Employee create/import, Routine partial-success import และ
   path ที่ระบุ non-transactional ต้องไม่ถูกนำเสนอว่ามี transaction-wide
   authorization guarantee.
6. Stock upload มี authorization preflight และ immediate pre-write recheck แต่
   external filesystem write ไม่ได้ประสานแบบ atomic กับ database authorization
   transaction. Residual filesystem TOCTOU นี้ถูกยอมรับและบันทึกไว้.

## Verification

Focused high-value suites ผ่านทั้งหมด:

```text
npm.cmd run test:run -- modules/authorization/application/resolver.test.ts modules/authorization/application/grant-validation.test.ts modules/authorization/registry.test.ts modules/authorization/application/administration.test.ts modules/authorization/application/administration-mutations.test.ts
PASS — 5 files, 75 tests

npm.cmd run test:run -- modules/routine/application/authorization.test.ts modules/stock/application/authorization.test.ts modules/leave/application/authorization.test.ts __tests__/auth/workforce-transaction.test.ts
PASS — 4 files, 62 tests

npm.cmd run test:run -- __tests__/api/phase-11c2c1-employee-routine-route-authorization.test.ts __tests__/api/phase-11c2c2-stock-leave-route-authorization.test.ts
PASS — 2 files, 21 tests
```

Repository checks:

- `npm.cmd run architecture:check` — PASS; 1121 repository source files checked.
- `npm.cmd run lint:strict` — PASS.
- `npm.cmd run typecheck` — PASS.
- `npm.cmd run test:run` — PASS on the first run; 316 test files and 2,786 tests
  passed. No architecture-timeout rerun was required.
- `git diff --check` — PASS.

MySQL integration does not become a false global-green claim:

```text
npm.cmd run test:integration:mysql
Prisma migrations: PASS — 67 migrations found, no pending migrations.
Vitest: FAIL — 15/16 integration files passed; 103/104 tests passed.
Failure: __tests__/integration/leave-quota-concurrency.integration.test.ts
Test: creates one quota for concurrent non-overlapping requests with different keys
Error: WorkforceAuthorizationError
Source: modules/leave/application/authorization.ts:parseUserRole
Cause: malformed historical route mock role shape.
```

นี่เป็น known unrelated historical integration-fixture failure ไม่ใช่ mandatory
Phase 11C authorization-regression gap. Closure จึงอ้างอิง authorization
regression evidence ที่ผ่าน ไม่ได้อ้างว่า repository integration ทั้งหมดเขียว.
ไม่มีการเปลี่ยน timeout configuration และไม่ได้แก้ fixture นี้ใน Phase 11C.2D.

## Final closure statement

Phase 11C ถูกปิดอย่างเป็นทางการที่ audit baseline
`5669d79ca359701bc6a637079ca738575b731cf7`: matrix และ explicit ledgers
reconcile แล้ว, mandatory Phase 11C.2 backlog เป็น `0`, และ production
authorization policy ยังคง **UNCHANGED**.

การปิดนี้ไม่ activate Team policy, ไม่ตัดสินสี่ future policy families และไม่
เริ่ม authorization migration ระยะถัดไปโดยอัตโนมัติ.
