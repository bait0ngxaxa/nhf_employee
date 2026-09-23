---
target: dashboard sidebar taxonomy
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 1
target_identity: "file:C:\\Users\\Yingyot\\Desktop\\App\\nhf_employee\\components\\dashboard\\layout\\DashboardSidebar.tsx"
target_fingerprint: "sha256:62c1ac5d36e354aa231bc16b1f1dcc796c1d2d6617d1e9c528058f72c2c995f7"
target_path: "C:\\Users\\Yingyot\\Desktop\\App\\nhf_employee\\components\\dashboard\\layout\\DashboardSidebar.tsx"
timestamp: 2026-09-23T06-10-41Z
slug: components-dashboard-layout-dashboardsidebar-tsx
---
# Dashboard Sidebar Critique

Method: dual-agent (A: sidebar_design_review · B: sidebar_detector)
Target: components/dashboard/layout/DashboardSidebar.tsx
Mode: Operate

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3/4 | Current item has aria-current, but disappears when its group is collapsed. |
| 2 | Match with the real world | 2/4 | Employee work and an IT request sit under system management; three modules use English labels. |
| 3 | User control and freedom | 3/4 | Users can navigate home, select another destination, collapse groups, and collapse the desktop sidebar. |
| 4 | Consistency and standards | 3/4 | Controls are consistent, but group labels do not use one classification rule. |
| 5 | Error prevention | 3/4 | Capability and feature filtering prevents unavailable choices; broad labels can still misdirect. |
| 6 | Recognition rather than recall | 2/4 | Expanded items omit descriptions and group headings are broad. |
| 7 | Flexibility and efficiency | 2/4 | Collapse controls exist; there are no shortcuts for frequent destinations. |
| 8 | Aesthetic and minimalist design | 3/4 | Calm, compact structure, but all groups open and expose nine destinations for fully provisioned users. |
| 9 | Error recovery | 2/4 | Users can navigate away easily, but the sidebar gives little help choosing the right area. |
| 10 | Help and documentation | 2/4 | Collapsed items have tooltips; expanded items have no task descriptions. |
| **Total** |  | **25/40 — Acceptable** | The main problem is category meaning and hierarchy. |

## Design Specificity Verdict

The NHF identity, Thai-first product, team context, and capability-filtered destinations ground the sidebar in this product. Its visual structure is familiar and calm. The taxonomy does not yet reflect NHF work: “Applications” classifies software, while “System Management” classifies an administrator responsibility. The latter mixes employee records and onboarding requests with audit and permission tools.

The bundled detector returned an empty JSON list (0 findings). That mechanical scan does not validate information architecture. Browser automation was unavailable, so no live screenshot or overlay assessment was possible; this review uses source and product/design documentation.

## Overall Impression

The sidebar works as a navigation control, but its category names answer different questions. One names what the destinations are (applications); the other names who might operate them (system administrators). Users can find the current page once inside it, but may have to guess which group contains their task.

## What's Working

- Capability-filtered groups keep the menu relevant to the signed-in user.
- The navigation has keyboard focus styling, accessible names, and an active-page state.
- CSV import remains an action within employee management rather than a separate top-level destination, as verified by the menu test.

## Priority Issues

1. **[P1] System Management mixes distinct kinds of work.** It contains new-employee requests and employee records alongside audit logs and permission administration. HR staff or employees may assume this group is only for IT/Admin. **Fix:** separate people work from technical system administration; reserve system administration for audit and access controls. Source: constants/dashboard.ts:111-134.
2. **[P2] Group titles use inconsistent classification axes.** Applications is a software type; System Management is an administrative function. Child entries then mix modules, service requests, records, and actions. **Fix:** make top-level groups work areas, then keep destinations/tasks as their children. Source: constants/dashboard.ts:111-134.
3. **[P2] Core module labels name products rather than tasks.** “NHF Leave,” “NHF Stock,” and “NHF Routine” are English names, and their Thai descriptions are not shown when the sidebar is expanded. **Fix:** use concise Thai primary labels (for example, การลา, วัสดุและคลัง, งานประจำ), optionally preserving module names as secondary context. Source: constants/dashboard.ts:24-43; DashboardSidebarPrimitives.tsx:73-105.
4. **[P2] Collapsing a group hides the current destination.** The group heading gets an active state, but the selected child is hidden. **Fix:** keep the active group expanded or show the current child name in the collapsed heading. Source: DashboardSidebarPrimitives.tsx:125-164.

## Recommended Information Architecture

หน้าหลัก

บริการภายใน
- การลา
- วัสดุและคลัง
- งานประจำ

บุคลากร
- ข้อมูลพนักงาน
- เพิ่มพนักงาน
- คำร้องบริการ IT สำหรับพนักงานใหม่

ระบบและสิทธิ์
- บันทึกการใช้งาน
- จัดการสิทธิ์การใช้งาน

The top-level headings describe work areas, and each child is a destination or task. “คำร้องบริการ IT สำหรับพนักงานใหม่” matches the current description of email, document, and Shared Drive requests sent to IT. Keep CSV import within employee management as it is today; tests explicitly keep it out of the sidebar menu.

## Cognitive Load and Emotional Journey

Fully provisioned users see nine destinations at once, including five under System Management; both groups start expanded. This is moderate scan load. The new work-area grouping should make scanning more predictable. If reducing initial density is still needed, keep the current page's group open and let users control other groups.

The NHF identity and team context establish ownership. Uncertainty begins when users map a task to “System Management”; the active item then helps users orient themselves, unless its group has been collapsed.

## Relevant Personas

- **Jordan, first-timer:** English module names and broad categories make it harder to find the first destination.
- **Alex, power user:** Nine initially visible destinations and five siblings under one heading increase scanning effort.
- **Sam, keyboard/screen-reader user:** Accessible names and active states help, but a collapsed active group hides the selected child.

## Minor Observations

- In the expanded sidebar, module descriptions are hidden; descriptions appear in the collapsed-item tooltip.
- CSV import is intentionally absent from sidebar groups and appears contextually in employee management.

## Questions to Consider

- Would employees naturally look for employee records under System Management?
- Should the sidebar group by work area or by user role/team (employee, HR, IT)?
- Which destinations need to be visible immediately, and which can be disclosed on demand?
