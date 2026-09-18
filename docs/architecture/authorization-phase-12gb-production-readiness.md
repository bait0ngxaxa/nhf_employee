# Phase 12G-B — First Production Capability Deployment Readiness

สถานะ: **Implementation complete — awaiting production operational acceptance**  
Production authorization rollout: **NOT RUN**  
Baseline: `c49caec5f14569655d1e385c1706dc7e9e22c0a8` (`fix(auth): close Phase 12G-A permission UX gaps`)  
Corrective patch starting revision: `5426be5e9ed3d243f8117e9c1c10dce816fa1d72` (`feat(auth): add Phase 12G-B production readiness preflight`)
วันที่จัดทำ readiness tooling: `2026-09-18`

เอกสารนี้เป็น handoff สำหรับการเตรียม deploy capability จริงครั้งแรกหลัง
Phase 12G-A. การผ่านของ repository tests เป็นหลักฐานว่า tooling และ contract
ทำงานตามที่ออกแบบ ไม่ใช่หลักฐานว่า production database สะอาด มี migration ครบ
หรือพร้อมรับ grant จริง. จนกว่าจะมี operator ทำ production gates ตามเอกสารนี้
สถานะ production ทุกข้อที่ยังไม่มีหลักฐานต้องบันทึกเป็น `NOT RUN`.

## Objective

สร้าง readiness boundary ที่อ่าน configuration authorization ปัจจุบันจาก
database แบบ read-only, ตรวจ structural invariant ตาม Capability Registry และ
authorization resolver contract, วางแผน canary ที่ operator ต้องระบุ target เอง,
และกำหนด before/after verification กับ rollback ผ่าน Authorization Administration
boundary เดิม.

ผลลัพธ์ที่ phase นี้ต้องให้ได้คือ repository-level tooling พร้อมใช้งานสำหรับ
controlled first capability canary โดยไม่มี Team, TeamRole, membership หรือ grant
ใน production ถูกสร้าง แก้ ลบ seed backfill หรือ normalize โดย agent นี้.

## In scope

- `evaluateAuthorizationProductionReadiness()` เป็น application/service model
  ที่ประเมิน snapshot แบบ deterministic;
- read-only Prisma inventory ของ Teams, TeamRoles, memberships, grants,
  User/Employee lifecycle และ `_prisma_migrations`;
- CLI `npm run authorization:production:preflight` ที่แสดง environment/database
  target แบบไม่พิมพ์ credential หรือ full URL;
- PASS / WARNING / BLOCKED / NOT_RUN result model, safe exit code และ bounded
  detail mode;
- `validateAuthorizationProductionCanaryPlan()` สำหรับตรวจ capability, scope,
  channel, source restriction, workforce-eligible observer, effective-access
  delta, warning acknowledgement และ exact-grant duplication;
- operator runbook, audit/observability contract และ rollback procedure;
- focused unit coverage โดยใช้ in-memory snapshots และ repository doubles.

## Non-goals and locked semantics

Phase นี้ไม่เปลี่ยน:

- ADMIN เป็น system authorization authority สูงสุด;
- authentication, account/workforce lifecycle หรือ server-side enforcement;
- additive semantics, Default Domain Policy, Team + TeamRole + exceptional User
  composition และ default-deny behavior;
- Team origin / `TEAM` constraint, domain-owned resource predicates,
  workflow/business rules และ channel restrictions;
- capability keys, supported scopes/channels, direct User `TEAM` restriction,
  Department/Team separation หรือ Phase 12G-A UI/API mutation contract;
- Prisma schema หรือ migration files;
- existing audited Authorization Administration mutation boundary.

ไม่สร้าง explicit DENY, wildcard, policy DSL/ABAC engine, automatic Team
assignment, Department-derived authority, automatic production seeding,
production backfill, shadow audit store, deployment-only mutation path หรือ CLI
ที่ mutate grants.

## Readiness model

Service ใช้ `AuthorizationProductionInventorySnapshot` ซึ่งมีเฉพาะ persisted
identifiers, lifecycle flags, grant values และ migration evidence ที่จำเป็นต่อ
การตรวจ ไม่อ่าน password, session, token หรือ profile email. Status มีความหมายดังนี้:

| Status | ความหมาย | Exit code |
| --- | --- | ---: |
| `PASS` | ไม่พบ blocker หรือ warning ใน snapshot และ required migration evidence ครบ | 0 |
| `WARNING` | ไม่มี blocker แต่มี historical/inactive/redundant condition ที่ operator ต้อง review | 0 |
| `BLOCKED` | มี structural invariant, unsafe active configuration, missing migration หรืออ่าน inventory ไม่สำเร็จ | 1 |
| `NOT_RUN` | gate ที่ต้องมีหลักฐานจาก operator/production ยังไม่ได้ execute | 1 เมื่อใช้เป็น readiness decision |

`WARNING` ไม่ถูกใช้แทน invariant ที่ resolver จะถือว่า invalid. Unknown
capability, unsupported scope, source/origin violation, missing reference,
invalid lifecycle state, active non-grantable grant, migration evidence ที่ขาด
หรือ database read failure เป็น `BLOCKED`.

Inactive Team/TeamRole/User/Employee ที่ยังเก็บ historical configuration และ
redundant additive authority เป็น `WARNING` เมื่อไม่ใช่ effective authority.
สำหรับ non-administratively-grantable persisted grant ให้ใช้ lifecycle ของ
grant-owning source: active Team หรือ active TeamRole ภายใต้ active Team เป็น
`BLOCKED` แม้ยังไม่มีสมาชิก ส่วน source ที่ inactive เป็น historical
`WARNING`. ข้อมูล inactive ที่เก็บอยู่ไม่ถูกลบ และไม่ถูกนับเป็น effective
authority เพียงเพราะมี row อยู่.

ผล aggregate มี Team count (active/inactive), TeamRole count, membership count,
grant count แยกตาม source, grants grouped by capability, grants grouped by
source/scope, invalid configuration count, warning count, blocker count และ
redundant configured authority count. Finding target identifiers จะแสดงเฉพาะ
เมื่อ operator ระบุ `--details`; default report ไม่มีชื่อหรือ email ของบุคคล.

## Read-only production preflight

คำสั่ง:

```powershell
$env:NODE_ENV = "production"
$env:AUTHORIZATION_PREFLIGHT_ENVIRONMENT = "production"
# DATABASE_URL ต้องถูก inject โดย deployment/secret manager ของ environment นี้
npm run authorization:production:preflight
npm run authorization:production:preflight -- --json
npm run authorization:production:preflight -- --details
```

คำสั่งต้องมี `DATABASE_URL`, `NODE_ENV` และ
`AUTHORIZATION_PREFLIGHT_ENVIRONMENT` ที่ระบุชัดเจน, รองรับ MySQL ตาม Prisma
datasource และพิมพ์เพียง environment, host, port และ database name ที่กำลัง
ตรวจ. ไม่พิมพ์ username, password, query string หรือ full database URL.

Repository อ่านผ่าน repeatable-read transaction เท่านั้น โดย select fields
แบบ explicit จาก:

- `teams`, `team_roles`, `team_memberships`;
- `team_capability_grants`, `team_role_capability_grants`,
  `user_capability_grants`;
- `users`, `employees` เฉพาะ id/lifecycle reference ที่จำเป็น;
- `_prisma_migrations` เฉพาะ required migration names.

ไม่มี `create`, `update`, `delete`, `deleteMany`, `upsert`, seed, repair,
backfill, normalization หรือ mutation call ใน preflight. ถ้า query ใดล้มเหลว
ผลเป็น `BLOCKED / INVENTORY_READ_FAILED` และ exit code เป็น non-zero; command
ไม่พยายามซ่อมแล้วดำเนินการต่อ.

### Checks ที่ทำ

ใช้ `CAPABILITY_REGISTRY` เป็น authority สำหรับ known key และ supported scopes;
ใช้ administration catalog เป็น authority สำหรับ runtime/grantability metadata.
ตรวจอย่างน้อย:

- unknown persisted capability และ unsupported persisted scope;
- direct User `TEAM` grant;
- TeamRole ที่ไม่ใช่ Team เดียวกับ membership หรือ grant origin ที่ไม่ตรง role;
- missing Team, TeamRole, User หรือ linked Employee reference;
- duplicate/impossible persisted rows และ resolver configuration invariant;
- active persisted grant ของ capability ที่ `administrativelyGrantable` เป็น false;
- inactive Team/TeamRole/User/Employee configuration โดยไม่ถือว่าเป็น effective;
- invalid/contradictory lifecycle state;
- redundant authority จาก active configured sources โดยคง provenance แยกกัน;
- required migration evidence: `20260108060001_add_audit_log`,
  `20260911100000_add_authorization_persistence` และ
  `20260914100000_add_authorization_audit_actions`.

การมี migration file ใน Git ไม่ถือว่า migration ถูก apply แล้ว. Preflight ต้อง
เห็น `_prisma_migrations.finished_at` ที่ไม่เป็น null, ไม่มี `rolled_back_at`
และมี applied steps สำหรับแต่ละ required migration. Deployment ยังคงต้องทำ
ตาม Prisma migration convention ปกติ เช่น `npx prisma migrate deploy` ใน
release process ที่ได้รับอนุมัติ; phase นี้ไม่ได้เพิ่ม migration.

## First-production canary contract

Repository ไม่ทราบ business target ที่องค์กรต้องการ activate จึงไม่เลือก
User, Team, TeamRole, capability หรือ scope ให้. Operator ต้องกรอก canary record
ต่อไปนี้ก่อน mutation:

| Field | ต้องระบุ |
| --- | --- |
| Target source | `TEAM`, `TEAM_ROLE` หรือ exceptional `USER` |
| Target identifier | Team id, TeamRole id หรือ User id ตาม source |
| Capability key | key ที่มีอยู่ใน Capability Registry |
| Scope | scope ที่ capability รองรับ; ไม่เลือก `ALL` โดยอัตโนมัติ |
| Execution channel | channel ของ protected operation ที่จะทดสอบ |
| Business reason | requirement ที่อนุมัติแล้ว |
| Runtime observer User | User ที่จะสร้าง session และ exercise protected path จริง |
| Effective access before | `state`, default scopes, effective scopes และ exact domain-owned `contextKey` จาก authoritative Administration read model โดยระบุ observer/capability/channel เดียวกัน |
| Warning review/disposition | review หนึ่งรายการต่อ current `WARNING` ทุกข้อ โดย match `kind/source/code` และ target fields พร้อม substantive `disposition` และ `reviewedBy` |
| Expected authority before | ผลจาก authoritative Administration read model ก่อน add |
| Expected authority after | ผลที่คาดหลัง add โดยระบุ source และ exact scope |
| Expected resource/domain limitation | predicate, domain และ workflow ที่ยังต้องบังคับ |
| Operator | ผู้ดำเนินการ |
| Planned time/window | เวลาและ window ที่อนุมัติ |
| Rollback action | ลบ exact source + capability + scope ผ่าน Administration |

`validateAuthorizationProductionCanaryPlan()` จะตรวจ registry key/scope/channel,
administrative grantability, direct User `TEAM` restriction และ exact-grant
duplication. Normal `USER` observer ต้องมี active, non-deleted User และ linked
Employee ที่มีสถานะ `ACTIVE` และไม่ถูกลบ ตาม workforce/session boundary จริง;
TEAM และ TEAM_ROLE ต้องมีสมาชิกอย่างน้อยหนึ่งคนที่ผ่านเงื่อนไขเดียวกัน.
Established account-only ADMIN compatibility path ไม่ถูกบังคับให้มี Employee แต่
ADMIN ไม่ qualify เป็น first capability canary เมื่อ `SYSTEM_ROLE` authority
ทำให้ grant ใหม่ไม่เปลี่ยน effective authority.

Plan ต้องแนบ effective-access state ก่อน mutation จาก authoritative
Administration read model พร้อม `contextKey` ที่ตรงกับ protected operation
จริง เช่น `liff.self-service`, `dashboard.summary.mine` หรือ
`dashboard.summary.all`. Validator สร้าง hypothetical central resolver state
ใน memory แล้วส่งทั้ง BEFORE และ AFTER ผ่าน
`AuthorizationAdministrationEffectiveAccessProvider` เดิมของ outer server
composition เพื่อให้ domain-owned default policy, context, channel clamp และ
workflow limitation ถูกใช้ตาม runtime จริง. `defaultScopes` และ
`effectiveScopes` ที่ operator ส่งมาเป็น evidence ที่ต้องตรงกับ provider
เท่านั้น ไม่ใช่ input สำหรับจำลอง policy. การเปรียบเทียบต้องเป็น capability,
channel และ `contextKey` เดียวกัน; Routine capability เดียวกันอาจมีหลาย
context ภายใต้ channel เดียวกัน.

Authority จาก Team, TeamRole, direct User, Default Domain Policy และ ADMIN
SYSTEM_ROLE ถูกนำมาพิจารณาโดยยังคง provenance ของ grant. ถ้า row ใหม่ไม่ทำให้
effective authority ของ context เดิมเพิ่มขึ้น จะหยุดด้วย
`CANARY_NO_EFFECTIVE_AUTHORITY_CHANGE`. Plan ที่มี missing field, context
ไม่สามารถระบุได้, target ไม่พบ/ไม่ active, capability deferred/non-grantable
หรือ readiness มี blocker ต้องหยุดก่อน mutation. `WARNING` ไม่ทำให้ canary
ผ่านเอง: ต้องมี matching substantive review/disposition และ reviewer สำหรับ
warning ปัจจุบันทุกข้อ; missing, partial, stale หรือ unrelated acknowledgement
เป็น blocker ของ canary validation.

สำหรับ exceptional direct User grant ต้องบันทึกเหตุผลว่าเป็น exception และยัง
คงหลักการให้ Team/TeamRole เป็น default administration workflow. ห้ามสร้าง Team
หรือ assign membership เพียงเพื่อให้ canary ผ่าน หาก business requirement นั้น
ไม่ได้รับอนุมัติแยกต่างหาก.

## First-production-canary safety rules

Grant แรกต้อง:

1. เป็น business requirement ที่อนุมัติแล้ว;
2. อยู่ใน registry และ administratively grantable;
3. valid สำหรับ selected source และ selected execution channel;
4. ใช้อำนาจน้อยที่สุดที่เพียงพอ โดย operator เป็นผู้ตัดสินจาก requirement;
5. reversible ด้วยการลบ exact configured grant row ผ่าน audited boundary เดิม;
6. สังเกตได้จาก authoritative Administration effective-access read model;
7. ต้องทำให้ effective authority เปลี่ยนอย่างสังเกตได้ ไม่ใช่เพียงเพิ่ม
   provenance row ที่ redundant;
8. มี Authorization audit event ที่ตรง target/source/capability/scope;
9. ตรวจด้วย server/API protected operation จริง ไม่ใช่ UI visibility อย่างเดียว.

`ALL` ไม่ใช่ค่า default ของ tooling และ scope จะไม่ถูก broaden เพื่อความสะดวก.
การมี configured grant ไม่ได้ลบ domain resource predicate, lifecycle หรือ
workflow restriction.

## Operator flow

### PRE-CANARY

- deploy code และ required migrations ตาม release process ปกติ;
- ตรวจ production application health, session/authentication health และ API
  error baseline;
- รัน read-only production preflight;
- ต้องมี `0 BLOCKED` findings; `WARNING` ทุกข้อถูก review พร้อม owner/action;
- capture target User/Team/TeamRole effective-access state จาก authoritative
  Administration read model ก่อน mutation และบันทึก observer User,
  capability/channel/contextKey, default scopes และ effective scopes ใน canary
  record; validator ต้องตรวจ evidence กับ provider เดิมทั้ง BEFORE และ
  hypothetical AFTER โดยไม่ให้ operator กำหนด domain defaults เอง;
- บันทึก substantive warning review/disposition และ `reviewedBy` ให้ครบทุก
  current warning; validator ต้อง reject review ที่ stale หรือไม่ตรง snapshot;
- ยืนยัน registry key, supported scope/channel และ `administrativelyGrantable`;
- ยืนยัน target identity, Team/TeamRole membership และ User/Employee lifecycle;
- บันทึก canary record และ approval/business reason.

### MUTATION

- ใช้ Authorization Administration UI/API boundary เดิม ซึ่งตรวจ ADMIN
  authority, schema, source/scope และเขียน audit ใน transaction เดียวกัน;
- ทำ exactly one intended grant change สำหรับ canary;
- ห้าม cleanup, normalize, seed หรือ authorization change อื่นใน change เดียวกัน;
- ห้ามใช้ preflight หรือ script นี้เพื่อ mutate.

### POST-CANARY

- reload authoritative Administration read model;
- ตรวจ configured source และ exact capability/scope ที่เพิ่ม;
- ตรวจ effective access เปลี่ยนตรงตาม expected-after;
- ตรวจ unrelated capabilities ไม่เปลี่ยน;
- exercise server/API protected operation จริงด้วย target/channel ที่อนุมัติ;
- ตรวจ resource/domain/workflow/lifecycle restriction ยังคงทำงาน;
- ตรวจ audit event มี actor, target, exact capability/scope, add action และเวลา;
- monitor 401/403/500, application logs, latency และ unexpected denial/error
  ใน observation window.

## Rollback

Rollback ที่เตรียมไว้ล่วงหน้าคือ remove เฉพาะ exact grant ที่ canary เพิ่มผ่าน
Authorization Administration UI/API เดิม พร้อมเหตุผลและ operator เดิมตาม process.
ห้ามลบ Team, TeamRole, membership หรือ grant อื่นเพื่อแก้ผลข้างเคียง.

หลัง rollback ต้อง:

- refresh authoritative read model;
- ตรวจ effective access กลับไปเป็น expected-before;
- ตรวจ server/API behavior กลับเป็นผลเดิม;
- ตรวจ removal audit event มี actor, target, exact capability/scope และเวลา;
- รัน production preflight ซ้ำและต้องไม่มี blocker ใหม่.

การลบ grant row ไม่เท่ากับการลบ effective authority เสมอไป. เพราะ semantics
เป็น additive, User อาจยังมี access จาก Default Domain Policy, Team อื่น,
TeamRole อื่น หรือ direct User grant อื่น. ดังนั้น rollback acceptance ต้อง
ตรวจ effective access และ actual server/API behavior ไม่ใช่ดูเพียงว่า row เดิม
ถูกลบ.

## Audit and observability

ใช้ audit actions เดิม ไม่มี shadow storage ใหม่:

| Source | Add/remove action | Target recorded |
| --- | --- | --- |
| Team | `TEAM_CAPABILITY_GRANT_UPDATE` | `entityType=Team`, Team id |
| TeamRole | `TEAM_ROLE_CAPABILITY_GRANT_UPDATE` | `entityType=TeamRole`, TeamRole id และ Team id ใน metadata |
| User | `USER_CAPABILITY_GRANT_ADD` / `USER_CAPABILITY_GRANT_REMOVE` | `entityType=User`, User id |

Mutation details ปัจจุบันเก็บ `before`, `after` และ metadata ที่มี
`capabilityKey`, exact `scope`, source target identifiers; audit row เก็บ
actor `userId`/`userEmail`, `createdAt`, action และ entity target. จึงตอบได้ว่า
ใครเปลี่ยนอะไร เมื่อไร เป็น add/remove และ expected configured authority คืออะไร.

Audit append อยู่ใน authorization mutation transaction และ persistence failure
propagate เข้า transaction ตาม existing contract. Preflight ไม่สร้าง audit event
เพราะเป็น read-only.

## Operational acceptance table

สถานะด้านล่างเป็นสถานะของ handoff นี้ ไม่ใช่การอนุมานจาก Git หรือ local seed:

| Gate | Required evidence | Current status |
| --- | --- | --- |
| Code/runtime implementation | focused service tests + repository checks | PASS (repository evidence) |
| Required production migrations applied | production `_prisma_migrations` readback | NOT RUN |
| Production authorization inventory | preflight against explicitly identified production DB | NOT RUN |
| Zero `BLOCKED` findings | preflight result from production | NOT RUN |
| Warning review and remediation owners | signed canary record | NOT RUN |
| Production app health before canary | deployment/monitoring evidence | NOT RUN |
| Operator-approved target and business reason | completed canary record | NOT RUN |
| Before effective-access capture | Administration read model evidence | NOT RUN |
| Exactly one audited grant mutation | audit event + mutation record | NOT RUN |
| Post-canary effective-access/API verification | read model + actual server/API result | NOT RUN |
| Rollback rehearsal or executed rollback | removal audit + after-state/API result | NOT RUN |
| Observation window | 401/403/500/log/latency review | NOT RUN |

Phase 12G-B ยังไม่ถูก mark เป็น fully `CLOSED`; repository implementation พร้อม
แต่ first real production capability deployment ยังรอ manual production gates
ข้างต้น.

## Automated verification evidence

Focused tests in `modules/authorization/application/production-readiness.test.ts`
cover:

- clean empty configuration;
- valid Team, TeamRole และ direct User grant;
- unknown capability, unsupported scope และ direct User `TEAM` blocker;
- TeamRole/Team mismatch;
- inactive Team/User/Employee warning และ missing reference blocker;
- non-administratively-deployable persisted grant;
- required migration blocker;
- repository/database failure and blocker exit behavior;
- warning-only exit behavior;
- no mutation side effects and deterministic report projection;
- default report redaction/bounded detail behavior;
- explicit canary plan validation and exact-grant duplicate rejection;
- workforce-eligible User/Team/TeamRole observer requirements;
- redundant effective-authority detection across Team, TeamRole, direct User,
  Default Domain Policy และ ADMIN SYSTEM_ROLE;
- authoritative effective-access provider comparison for the same capability,
  channel and domain-owned `contextKey`, including Routine LIFF channel clamp;
- rejection of operator-supplied before-state evidence that disagrees with the
  domain provider;
- active-source non-grantable blocker severity with zero members;
- matching warning review/disposition requirement, including missing, partial,
  stale และ zero-warning cases.

ผลคำสั่งตรวจ repository ด้านล่างเป็นหลักฐานของ implementation เท่านั้น และ
ไม่แทน production evidence.

ผลการตรวจของ corrective patch นี้:

| Command | Result |
| --- | --- |
| `npm.cmd run test:run -- modules/authorization/application/production-readiness.test.ts` | PASS — 1 file / 47 tests |
| `npm.cmd run architecture:check` | PASS — 1,144 source files |
| `npm.cmd run lint:strict` | PASS |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run test:run` | PASS — 325 files / 3,020 tests |
| `npm.cmd run test:integration:mysql` | PASS — 16 files / 104 tests; local integration database had no pending migrations |
| `git diff --check` | PASS |

Integration evidence เป็น local isolated test database เท่านั้น และไม่ใช่
production authorization evidence. ไม่ได้รัน dev server หรือ production build.

## Unresolved production-only gates

ณ handoff นี้ยังไม่มี trusted production database access และยังไม่ได้ทำ:

- production preflight/migration readback;
- production canary target selection หรือ business approval;
- real Authorization Administration mutation;
- post-canary server/API verification;
- rollback rehearsal/execution;
- production audit/log/401/403/500 observation window.

ทุกข้อข้างต้นต้องคงสถานะ `NOT RUN` จน operator ที่ได้รับอนุญาต execute และแนบ
evidence จริง. ห้ามใช้ local/CI fixtures, migration files ใน Git, หรือ empty seed
เพื่อเขียนว่า production `PASS`, `CLEAN`, `READY FOR PRODUCTION` หรือ `ZERO GRANTS`.

