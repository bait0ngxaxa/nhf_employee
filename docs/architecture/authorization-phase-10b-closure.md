# Authorization Phase 10B — Audited Configuration Mutations

สถานะ: **CLOSED** วันที่ 2026-09-14

Phase 10B เพิ่ม write boundary แรกของ Authorization Administration โดยยังคง
locked architecture จาก Phase 10A เป็น source of truth และไม่สร้าง Phase 10C UI

## Boundary และ authority

ทุก mutation ต้องผ่านลำดับนี้:

```text
trusted authenticated ADMIN session
  -> shared Authorization Administration API boundary
  -> validated application command
  -> readiness and policy-applicability guard
  -> serializable transaction
  -> configuration write
  -> appendAuditInTransaction (same transaction)
  -> commit
```

API ใช้ `requireAdminSession()` และ
`assertAuthorizationAdministrationAccess()` จาก server context เดิม. Actor
identity, system role, email และ workforce/session eligibility ไม่รับจาก body,
query หรือ path; path ระบุได้เฉพาะ target resource. Request metadata สำหรับ audit
อ่านจาก trusted request headers ตาม pattern เดิม. Authorization ไม่เพิ่ม
`authorization.manage`, `authorization.admin`, delegated administrator หรือ
domain capability เพื่อแทน `ADMIN`.

คำสั่งอยู่ใน `modules/authorization/application/administration-mutations.ts`
และ persistence อยู่ใน command-specific repository. Routes ไม่ import Prisma
delegate และไม่ถือ business logic.

## Supported commands

- Team: create, metadata update, disable และ re-enable ผ่าน update
- TeamRole: create ภายใน Team เดียว, metadata update, disable และ re-enable ผ่าน update
- TeamMembership: add, remove และเปลี่ยน `teamRoleId` เป็น role เดิม/role ใหม่/null
- Team grant: add/remove exact grant
- TeamRole grant: add/remove exact grant
- direct User grant: add/remove exact exceptional grant

Team และ TeamRole ไม่มี hard delete ใน Phase 10B. Team key และ TeamRole key
เป็น stable technical identifiers หลังสร้าง และไม่มีคำสั่งย้าย TeamRole หรือ
ย้ายสมาชิกข้าม Team แบบ opaque operation. Composite database key/FK และ
application check ทั้งสองชั้นบังคับว่า TeamRole ต้องเป็นของ Team เดียวกับ
membership.

API surfaces ที่เตรียมไว้สำหรับ Phase 10C:

```text
POST   /api/authorization/administration
PATCH  /api/authorization/administration/teams/:teamId
POST   /api/authorization/administration/teams/:teamId/roles
PATCH  /api/authorization/administration/teams/:teamId/roles/:roleId
POST   /api/authorization/administration/teams/:teamId/members
PATCH  /api/authorization/administration/teams/:teamId/members/:userId
DELETE /api/authorization/administration/teams/:teamId/members/:userId
POST   /api/authorization/administration/teams/:teamId/grants
DELETE /api/authorization/administration/teams/:teamId/grants
POST   /api/authorization/administration/teams/:teamId/roles/:roleId/grants
DELETE /api/authorization/administration/teams/:teamId/roles/:roleId/grants
POST   /api/authorization/administration/users/:userId/grants
DELETE /api/authorization/administration/users/:userId/grants
```

GET read models จาก Phase 10A ยังใช้ boundary เดิม และ Dashboard ยังคง
read-only.

## Registry/readiness enforcement

Every direct Team, TeamRole และ User grant add/remove เรียก canonical
`validateCapabilityGrant()` โดยไม่ trim, coerce, fallback scope, สร้าง key,
รองรับ wildcard หรือ explicit DENY. หลัง registry validation ต้องผ่าน
administration catalog อีกชั้น:

| Classification | Phase 10B behavior |
| --- | --- |
| `GRANTABLE` / `administrativelyGrantable === true` | ordinary add/remove allowed |
| `POLICY_ACTIVATION_REQUIRED` | rejected with `CAPABILITY_POLICY_ACTIVATION_REQUIRED` |
| `DEFERRED` | rejected with `CAPABILITY_DEFERRED` |
| unknown/unsupported/invalid source | rejected with stable configuration error |

Direct User `TEAM` scope ถูกปฏิเสธด้วย `DIRECT_TEAM_SCOPE_REQUIRES_ORIGIN`
เพราะ `UserCapabilityGrant` ไม่มี Team origin. ไม่มีการ fabricate origin Team.
Target User ต้องมีอยู่ แต่ User lifecycle ไม่ถูกใช้เป็นแหล่ง authority และไม่มี
การลบ membership/grant อัตโนมัติเมื่อ account/employee inactive.

## Indirect applicability guard

Read state ที่ใช้ตรวจ policy impact, snapshot และ write อยู่ใน transaction เดียวกัน.
ก่อน mutation ที่เปลี่ยน applicability จะ validate persisted grants แบบ
fail-closed:

- Team active-state: Team grants และ TeamRole grants ที่ reachable ผ่าน
  membership ของ Team
- TeamRole active-state: grants ของ role เมื่อ Team ยัง active
- membership add: Team grants และ grants ของ role ใหม่ที่ active/applicable
- membership remove: Team grants และ grants ของ role ปัจจุบันที่ active/applicable
- membership role change: grants ของ old/new role ที่ active/applicable; Team
  grants ไม่ถูกถือว่าเปลี่ยน applicability เพราะ membership ยังอยู่ Team เดิม

Unknown capability, invalid scope, direct User origin error, invalid TeamRole
origin หรือ invalid persisted relationship ทำให้ command หยุดและไม่เขียน state.
ทั้ง add และ remove ของ exact grant ใช้ readiness gate เดียวกัน. Duplicate add,
missing remove และ no-op update/role change ถูกแปลงเป็น typed stable errors และ
ไม่สร้าง audit row.

## Audit contract

Authorization เป็นเจ้าของความหมายของ event และเรียก Audit เฉพาะผ่าน
`import { appendAuditInTransaction } from "@/modules/audit"`. Audit เป็น generic
persistence/query capability และไม่รู้จัก Team business semantics.

เพิ่ม `AuditAction` เฉพาะ 13 ค่า:

```text
TEAM_CREATE
TEAM_UPDATE
TEAM_DISABLE
TEAM_MEMBER_ADD
TEAM_MEMBER_REMOVE
TEAM_MEMBER_ROLE_CHANGE
TEAM_ROLE_CREATE
TEAM_ROLE_UPDATE
TEAM_ROLE_DISABLE
TEAM_CAPABILITY_GRANT_UPDATE
TEAM_ROLE_CAPABILITY_GRANT_UPDATE
USER_CAPABILITY_GRANT_ADD
USER_CAPABILITY_GRANT_REMOVE
```

ไม่ reuse `SETTINGS_UPDATE` และไม่เปลี่ยน historical enum values หรือ Prisma
mapped Stock physical values. Migration คือ
`20260914100000_add_authorization_audit_actions`.

Stable entity conventions:

| Mutation | entityType / entityId | Details |
| --- | --- | --- |
| Team lifecycle | `Team` / team id | before/after `name`, `description`, `isActive`; create includes key |
| TeamRole lifecycle | `TeamRole` / role id | before/after teamId, key, name, isActive |
| Membership | `Team` / team id | before/after membership; metadata `teamId`, `targetUserId` |
| Team grant | `Team` / team id | present/capabilityKey/scope before and after |
| TeamRole grant | `TeamRole` / role id | present/capabilityKey/scope before and after; Team metadata |
| direct User grant | `User` / user id | present/capabilityKey/scope before and after |

Every event records trusted actor `userId`, `userEmail` when available, and
trusted request `ipAddress`/`userAgent`. Audit failure propagates through the
same serializable transaction and rolls back the configuration mutation.

## Explicitly unchanged

Phase 10B does not:

- seed production Teams, roles, memberships, or grants;
- derive Team or membership from Department, manager, position, employee, or
  other workforce relationships;
- roll out policy automatically or retire compatibility floors;
- mutate `POLICY_ACTIVATION_REQUIRED` or `DEFERRED` capability grants through
  ordinary commands;
- add hard delete, explicit DENY, wildcard, inheritance, nested Teams, ABAC,
  policy DSL, expiry, delegated administration, or external policy service;
- make the Phase 10A page a management UI.

## Verification and evidence

Focused application/API tests cover trusted ADMIN enforcement, forged principal
rejection, Team/TeamRole lifecycle, duplicate/no-op behavior, membership role
integrity, grant validation/readiness, direct User constraints, indirect policy
guarding, audit snapshots/actions, and audit failure rollback behavior.

MySQL integration tests cover:

- Team `audit.read / ALL` grant -> membership -> resolver `ALLOW` from `TEAM`,
  then membership removal -> `NO_APPLICABLE_GRANT`;
- TeamRole `audit.read / ALL` grant -> assigned membership -> resolver `ALLOW`
  from `TEAM_ROLE`, then role disable -> `NO_APPLICABLE_GRANT`;
- direct User `audit.read / ALL` add/remove and `USER` source explanations;
- generic Audit query reading the new membership event;
- real transaction rollback when strict audit append fails;
- migration deployment and existing authorization/audit integration suites.

The repository check and focused Phase 10B checks pass. The full MySQL runner
applies all 67 migrations and reports 15/16 files and 99/100 tests passing; the
single failure is the known pre-existing
`__tests__/integration/leave-quota-concurrency.integration.test.ts`
`WorkforceAuthorizationError` failure documented by the Phase 10A baseline.
No additional Phase 10B integration failure is present.

## Phase 10C handoff

Phase 10C may build operator-facing Teams, Members & Roles, Permissions, User
Exceptions, and Effective Access UI over the Phase 10A read contracts and the
Phase 10B mutation contracts. The UI must remain a presentation surface; the
trusted ADMIN boundary, readiness classification, policy-impact guard, and
strict transactional audit contract remain authoritative on the server.

