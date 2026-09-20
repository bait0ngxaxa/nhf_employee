import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const grantApi = vi.hoisted(() => ({
    addUserGrant: vi.fn(),
    changeUserSystemRole: vi.fn(),
    removeUserGrant: vi.fn(),
}));

vi.mock("../api", () => grantApi);

import { UserAccessPanel } from "./UserAccessPanel";
import type {
    AuthorizationAdministrationGrantProjectionData,
    AuthorizationAdministrationOverviewData,
    AuthorizationAdministrationUserDetailData,
    AuthorizationAdministrationUserSummaryData,
} from "../types";

const auditCapability = {
    key: "audit.read",
    registered: true,
    domain: "audit",
    description: "อ่านบันทึกการใช้งาน",
    supportedScopes: ["ALL"],
    supportedChannels: ["DASHBOARD"],
    runtimeAuthorizationMode: "CENTRAL_ONLY",
    administrativeStatus: "GRANTABLE",
    administrativelyGrantable: true,
} satisfies AuthorizationAdministrationOverviewData["capabilities"][number];

const routineCapability = {
    key: "routine.task.read",
    registered: true,
    domain: "routine",
    description: "อ่านงาน Routine",
    supportedScopes: ["CREATED", "ASSIGNED", "ALL"],
    supportedChannels: ["DASHBOARD", "LIFF_SELF_SERVICE"],
    runtimeAuthorizationMode: "CENTRAL_WITH_DEFAULT_POLICY",
    administrativeStatus: "GRANTABLE",
    administrativelyGrantable: true,
} satisfies AuthorizationAdministrationOverviewData["capabilities"][number];

const routineUpdateCapability = {
    ...routineCapability,
    key: "routine.task.update",
    description: "แก้ไขงาน Routine",
} satisfies AuthorizationAdministrationOverviewData["capabilities"][number];

const emailCapability = {
    key: "email.request.read",
    registered: true,
    domain: "email",
    description: "อ่านคำขอ Email",
    supportedScopes: ["OWN", "ALL"],
    supportedChannels: ["DASHBOARD"],
    runtimeAuthorizationMode: "CENTRAL_ONLY",
    administrativeStatus: "GRANTABLE",
    administrativelyGrantable: true,
} satisfies AuthorizationAdministrationOverviewData["capabilities"][number];

const teamReference = {
    id: 11,
    key: "operations",
    name: "Operations",
    isActive: true,
};

const roleReference = {
    id: 21,
    teamId: 11,
    key: "operator",
    name: "Operator",
    isActive: true,
};

const userSummary = {
    id: 7,
    name: "สมชาย ใจดี",
    email: "somchai@example.com",
    role: "ADMIN",
    isActive: true,
    deletedAt: null,
    employee: null,
} satisfies AuthorizationAdministrationUserSummaryData;

const systemGrant = {
    capability: "audit.read",
    scope: "ALL",
    source: { type: "SYSTEM_ROLE", role: "ADMIN" },
    origin: { type: "SYSTEM_ROLE", role: "ADMIN" },
} as const;

const teamGrant = {
    capability: "audit.read",
    scope: "ALL",
    source: { type: "TEAM", teamId: 11 },
    constraint: { teamId: 11 },
    origin: { type: "TEAM", teamId: 11, team: teamReference },
} as const;

const roleGrant = {
    capability: "audit.read",
    scope: "ALL",
    source: { type: "TEAM_ROLE", teamId: 11, teamRoleId: 21 },
    origin: { type: "TEAM_ROLE", teamId: 11, teamRoleId: 21, team: teamReference, teamRole: roleReference },
} as const;

const directGrant = {
    capability: "audit.read",
    scope: "ALL",
    source: { type: "USER", userId: 7 },
    origin: { type: "USER", userId: 7 },
} as const;

const directUserGrantProjection = {
    capabilityKey: "audit.read",
    scope: "ALL",
    capability: auditCapability,
    validation: { status: "VALID" },
} as const;

const routineDirectCreatedGrantProjection = {
    capabilityKey: "routine.task.read",
    scope: "CREATED",
    capability: routineCapability,
    validation: { status: "VALID" },
} as const;

const routineDirectAssignedGrantProjection = {
    capabilityKey: "routine.task.read",
    scope: "ASSIGNED",
    capability: routineCapability,
    validation: { status: "VALID" },
} as const;

const invalidRoutineDirectGrantProjection = {
    capabilityKey: "routine.task.read",
    scope: "INVALID_SCOPE",
    capability: routineCapability,
    validation: {
        status: "INVALID",
        code: "UNSUPPORTED_PERSISTED_SCOPE",
        reason: "scope ไม่อยู่ใน registry",
    },
} satisfies AuthorizationAdministrationGrantProjectionData;

const adminUser = {
    user: userSummary,
    systemRole: "ADMIN",
    teamMemberships: [{
        teamId: 11,
        userId: 7,
        teamRoleId: 21,
        team: teamReference,
        teamRole: roleReference,
    }],
    directGrants: [],
    resolverEffectivePermissionStatus: { status: "RESOLVED" },
    resolverEffectivePermissions: [{
        capability: auditCapability,
        allowed: true,
        scopes: ["ALL"],
        grants: [systemGrant, teamGrant, roleGrant, directGrant],
    }],
    effectiveAccessStatus: { status: "RESOLVED" },
    effectiveAccess: [{
        capability: auditCapability,
        context: { key: "dashboard", label: "Dashboard", channel: "DASHBOARD" },
        defaultAuthority: { scopes: [] },
        additionalAuthority: { scopes: ["ALL"], grants: [systemGrant] },
        effectiveAuthority: { state: "AVAILABLE", scopes: ["ALL"], redundant: false },
        limitations: [{ code: "audit.server_resource", label: "Audit query rules ยังทำงานแยกต่างหาก" }],
    }, {
        capability: emailCapability,
        context: { key: "dashboard", label: "Dashboard", channel: "DASHBOARD" },
        defaultAuthority: { scopes: [] },
        additionalAuthority: { scopes: [], grants: [] },
        effectiveAuthority: { state: "UNAVAILABLE", scopes: [], redundant: false },
        limitations: [{ code: "email.request.workflow", label: "Email Request ยังต้องผ่าน workflow rules" }],
    }],
    effectiveAccessSummary: {
        inspectedContextCount: 2,
        availableContextCount: 1,
        defaultBackedContextCount: 0,
        additionalAuthorityContextCount: 1,
        unsupportedContextCount: 0,
        deferredCapabilityCount: 0,
        configurationIssueCount: 0,
    },
    configurationIssues: [],
} satisfies AuthorizationAdministrationUserDetailData;

const normalUser = {
    ...adminUser,
    user: { ...userSummary, role: "USER" },
    systemRole: "USER",
    effectiveAccess: [{
        capability: routineUpdateCapability,
        context: { key: "dashboard.management", label: "Dashboard · Management", channel: "DASHBOARD" },
        defaultAuthority: { scopes: ["CREATED", "ASSIGNED"] },
        additionalAuthority: { scopes: [], grants: [], reason: "NO_APPLICABLE_GRANT" },
        effectiveAuthority: { state: "AVAILABLE", scopes: ["CREATED", "ASSIGNED"], redundant: false },
        limitations: [{ code: "routine.resource_relationship", label: "ยังต้องผ่าน creator/assignee predicate" }],
    }, {
        capability: routineCapability,
        context: { key: "dashboard.work-item.mine", label: "Dashboard · Work items · Mine", channel: "DASHBOARD" },
        defaultAuthority: { scopes: ["ASSIGNED"] },
        additionalAuthority: { scopes: [], grants: [], reason: "NO_APPLICABLE_GRANT" },
        effectiveAuthority: { state: "AVAILABLE", scopes: ["ASSIGNED"], redundant: false },
        limitations: [{ code: "routine.resource_relationship", label: "ยังต้องผ่าน assignee predicate" }],
    }, {
        capability: routineCapability,
        context: { key: "dashboard.work-item.all", label: "Dashboard · Work items · All", channel: "DASHBOARD" },
        defaultAuthority: { scopes: ["ALL"] },
        additionalAuthority: { scopes: ["ALL"], grants: [directGrant] },
        effectiveAuthority: { state: "AVAILABLE", scopes: ["ALL"], redundant: true },
        limitations: [{ code: "routine.resource_relationship", label: "ยังต้องผ่าน resource predicate" }],
    }, {
        capability: routineCapability,
        context: { key: "liff.self-service", label: "LIFF · Self service", channel: "LIFF_SELF_SERVICE" },
        defaultAuthority: { scopes: ["ASSIGNED"] },
        additionalAuthority: { scopes: ["ALL"], grants: [directGrant] },
        effectiveAuthority: { state: "AVAILABLE", scopes: ["ASSIGNED"], redundant: false },
        limitations: [{ code: "routine.liff_minimization", label: "LIFF ใช้ data minimization" }],
    }, {
        capability: auditCapability,
        context: { key: "dashboard", label: "Dashboard", channel: "DASHBOARD" },
        defaultAuthority: { scopes: [] },
        additionalAuthority: { scopes: [], grants: [], reason: "NO_APPLICABLE_GRANT" },
        effectiveAuthority: { state: "UNAVAILABLE", scopes: [], redundant: false },
        limitations: [{ code: "audit.server_resource", label: "Audit query rules ยังทำงานแยกต่างหาก" }],
    }, {
        capability: routineCapability,
        context: { key: "liff.export", label: "LIFF · Self service", channel: "LIFF_SELF_SERVICE" },
        defaultAuthority: { scopes: [] },
        additionalAuthority: { scopes: [], grants: [] },
        effectiveAuthority: { state: "UNSUPPORTED", scopes: [], redundant: false },
        limitations: [{ code: "routine.export_resource", label: "Routine export ไม่รองรับ LIFF" }],
    }, {
        capability: emailCapability,
        context: { key: "dashboard", label: "Dashboard", channel: "DASHBOARD" },
        defaultAuthority: { scopes: [] },
        additionalAuthority: { scopes: [], grants: [] },
        effectiveAuthority: { state: "UNAVAILABLE", scopes: [], redundant: false },
        limitations: [{ code: "email.request.workflow", label: "Email Request ยังต้องผ่าน workflow rules" }],
    }],
    resolverEffectivePermissions: [{
        capability: routineUpdateCapability,
        allowed: false,
        scopes: [],
        grants: [],
        reason: "NO_APPLICABLE_GRANT",
    }, {
        capability: auditCapability,
        allowed: false,
        scopes: [],
        grants: [],
        reason: "NO_APPLICABLE_GRANT",
    }],
    effectiveAccessSummary: {
        inspectedContextCount: 7,
        availableContextCount: 4,
        defaultBackedContextCount: 4,
        additionalAuthorityContextCount: 2,
        unsupportedContextCount: 1,
        deferredCapabilityCount: 0,
        configurationIssueCount: 0,
    },
} satisfies AuthorizationAdministrationUserDetailData;

const overview = {
    capabilities: [auditCapability, routineCapability, routineUpdateCapability, emailCapability],
    teams: [],
    summary: {
        registeredCapabilityCount: 4,
        administrativelyGrantableCapabilityCount: 4,
        policyActivationRequiredCapabilityCount: 0,
        deferredCapabilityCount: 0,
        teamCount: 0,
        activeTeamCount: 0,
    },
} satisfies AuthorizationAdministrationOverviewData;

const directoryUsers = [userSummary] satisfies readonly AuthorizationAdministrationUserSummaryData[];

function renderPanel(
    user: AuthorizationAdministrationUserDetailData = adminUser,
    onRefresh: () => Promise<void> = vi.fn(async () => undefined),
) {
    return render(
        <UserAccessPanel
            user={user}
            loading={false}
            error={undefined}
            overview={overview}
            query="สม"
            directoryUsers={directoryUsers}
            directoryLoading={false}
            directoryError={undefined}
            onQueryChange={vi.fn()}
            onSelectUser={vi.fn()}
            onSelectTeam={vi.fn()}
            onRefresh={onRefresh}
        />,
    );
}

function expectInvalidConfigurationSurfaceToBeReadOnly(): void {
    expect(screen.queryByRole("button", { name: "เพิ่มสิทธิ์อื่น" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ปรับสิทธิ์เฉพาะบุคคล" })).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มสิทธิ์" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ยืนยันเพิ่มสิทธิ์" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "นำสิทธิ์ออก" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /นำออก/ })).not.toBeInTheDocument();
}

afterEach(() => {
    vi.clearAllMocks();
});

describe("User Access presentation", () => {
    it("keeps base, added, effective, provenance, and deferred state visibly distinct", () => {
        renderPanel();

        expect(screen.getAllByText("สิทธิ์พื้นฐาน").length).toBeGreaterThan(0);
        expect(screen.getAllByText("สิทธิ์ที่เพิ่มให้").length).toBeGreaterThan(0);
        expect(screen.getAllByText("สิทธิ์ที่ใช้งานได้").length).toBeGreaterThan(0);
        expect(screen.getAllByText("SYSTEM_ROLE").length).toBeGreaterThan(0);
        expect(screen.getAllByText("ที่มาของสิทธิ์").length).toBeGreaterThan(0);
        expect(screen.getAllByText("ยังไม่เปิดให้จัดการ").length).toBeGreaterThan(0);
        expect(screen.queryByText("มี Compatibility Policy")).not.toBeInTheDocument();
        expect(screen.getAllByText("ผู้ดูแลระบบ").length).toBeGreaterThan(0);
        expect(screen.getByText("Operations")).toBeInTheDocument();
    });

    it("does not turn NO_APPLICABLE_GRANT into final denial when Default exists", () => {
        renderPanel(normalUser);

        expect(screen.getAllByText("ใช้งานได้").length).toBeGreaterThan(0);
        expect(screen.getAllByText("สิทธิ์พื้นฐาน").length).toBeGreaterThan(0);
        expect(screen.getAllByText(/NO_APPLICABLE_GRANT/).length).toBeGreaterThan(0);
        expect(screen.getAllByText("ยังไม่มีสิทธิ์").length).toBeGreaterThan(0);
    });

    it("shows trusted context variants, LIFF distinction, unsupported and deferred states", () => {
        renderPanel(normalUser);

        expect(screen.getAllByText("การจัดการงาน").length).toBeGreaterThan(0);
        expect(screen.getAllByText("งานที่รับผิดชอบ").length).toBeGreaterThan(0);
        expect(screen.getAllByText("งานทั้งหมด").length).toBeGreaterThan(0);
        expect(screen.getAllByText("การใช้งานผ่าน LINE").length).toBeGreaterThan(0);
        for (const technicalLabel of ["Dashboard · Management", "Dashboard · Work items · Mine", "LIFF · Self service"]) {
            expect(screen.getAllByText(technicalLabel).every((node) => node.closest("details") !== null)).toBe(true);
        }
        expect(screen.getAllByText("ช่องทางนี้ไม่รองรับ").length).toBeGreaterThan(0);
        expect(screen.getAllByText("ยังไม่เปิดให้จัดการ").length).toBeGreaterThan(0);
    });

    it("groups context rows by exact capability key without flattening their authority", () => {
        renderPanel(normalUser);

        const card = screen.getByTestId("effective-capability-card-routine.task.read");
        expect(card).toBeInTheDocument();
        expect(within(card).getAllByText("งานที่รับผิดชอบ").length).toBeGreaterThan(0);
        expect(within(card).getAllByText("งานทั้งหมด").length).toBeGreaterThan(0);
        expect(within(card).getAllByText("การใช้งานผ่าน LINE").length).toBeGreaterThan(0);
        expect(within(card).getAllByText("บริบทการใช้งาน").length).toBeGreaterThan(0);
        expect(within(card).getAllByText("ดูงานประจำ").length).toBeGreaterThan(0);
        expect(within(card).getAllByText("งานยังขึ้นอยู่กับความสัมพันธ์ของผู้ใช้งาน").length).toBeGreaterThan(0);
        expect(within(card).getAllByText(/original label: ยังต้องผ่าน assignee predicate/).every((node) => node.closest("details") !== null)).toBe(true);
        expect(within(card).queryByText("routine.task.read = ALL")).not.toBeInTheDocument();
    });

    it("collapses direct User editing while keeping exact scopes in the matching capability card", () => {
        renderPanel({
            ...normalUser,
            directGrants: [routineDirectCreatedGrantProjection, routineDirectAssignedGrantProjection],
        });

        const routineCard = screen.getByTestId("effective-capability-card-routine.task.read");
        const auditCard = screen.getByTestId("effective-capability-card-audit.read");

        expect(within(routineCard).getByText("มี 2 ขอบเขตที่เพิ่มไว้")).toBeInTheDocument();
        expect(within(routineCard).getByText("รายการที่สร้าง · รายการที่รับผิดชอบ")).toBeInTheDocument();
        expect(within(routineCard).getByRole("button", { name: "ปรับสิทธิ์เฉพาะบุคคล" })).toBeInTheDocument();
        expect(within(routineCard).queryByRole("radio", { name: /รายการที่สร้าง/ })).not.toBeInTheDocument();
        expect(within(routineCard).queryByRole("radio", { name: /รายการที่รับผิดชอบ/ })).not.toBeInTheDocument();
        expect(within(routineCard).queryByRole("button", { name: "เพิ่มสิทธิ์" })).not.toBeInTheDocument();
        expect(within(routineCard).queryByRole("button", { name: /นำสิทธิ์เฉพาะบุคคล/ })).not.toBeInTheDocument();
        fireEvent.click(within(routineCard).getByRole("button", { name: "ปรับสิทธิ์เฉพาะบุคคล" }));
        expect(within(routineCard).getByRole("radio", { name: /ทั้งหมดงานประจำทั้งหมด/ })).toBeInTheDocument();
        expect(within(routineCard).getAllByRole("button", { name: /นำสิทธิ์เฉพาะบุคคล/ })).toHaveLength(2);
        fireEvent.click(within(routineCard).getByRole("button", { name: "ปิดการแก้ไข" }));
        expect(within(routineCard).queryByRole("radio", { name: /ทั้งหมดงานประจำทั้งหมด/ })).not.toBeInTheDocument();
        expect(within(routineCard).queryByRole("button", { name: "เพิ่มสิทธิ์" })).not.toBeInTheDocument();
        expect(within(routineCard).getByText("มี 2 ขอบเขตที่เพิ่มไว้")).toBeInTheDocument();
        expect(within(auditCard).queryByText("ผู้ใช้รายนี้ได้รับสิทธิ์นี้โดยเฉพาะ")).not.toBeInTheDocument();
        expect(within(auditCard).getByText("ยังไม่มีสิทธิ์เฉพาะบุคคล")).toBeInTheDocument();
        expect(screen.queryByText("ยังไม่มีสิทธิ์เพิ่มเติมในส่วนนี้")).not.toBeInTheDocument();
    });

    it("does not present invalid direct records as access and keeps their evidence advanced", () => {
        renderPanel({
            ...normalUser,
            directGrants: [invalidRoutineDirectGrantProjection],
        });

        const routineCard = screen.getByTestId("effective-capability-card-routine.task.read");
        expect(within(routineCard).getByText("ยังไม่มีสิทธิ์เฉพาะบุคคล")).toBeInTheDocument();
        expect(within(routineCard).queryByText("INVALID_SCOPE")).not.toBeInTheDocument();

        fireEvent.click(screen.getByText("รายละเอียดทางเทคนิค · หลักฐานจากระบบสิทธิ์"));
        expect(screen.getByText("routine.task.read · INVALID_SCOPE")).toBeInTheDocument();
        expect(screen.getByText("validation: UNSUPPORTED_PERSISTED_SCOPE")).toBeInTheDocument();
    });

    it("renders one business domain heading for multiple independent capability cards", () => {
        renderPanel(normalUser);

        expect(screen.getAllByRole("heading", { name: "งานประจำ" })).toHaveLength(1);
        expect(screen.getByTestId("effective-capability-card-routine.task.read")).toBeInTheDocument();
        expect(screen.getByTestId("effective-capability-card-routine.task.update")).toBeInTheDocument();
    });

    it("keeps INVALID_CONFIGURATION fail-closed and does not render effective rows", () => {
        const error = {
            code: "UNKNOWN_PERSISTED_CAPABILITY" as const,
            capabilityKey: "old.capability",
            teamId: 11,
        };
        const invalidUser: AuthorizationAdministrationUserDetailData = {
            ...normalUser,
            resolverEffectivePermissionStatus: { status: "INVALID_CONFIGURATION", error },
            resolverEffectivePermissions: [],
            effectiveAccessStatus: { status: "RESOLVED" },
            effectiveAccess: [],
            effectiveAccessSummary: {
                inspectedContextCount: 0,
                availableContextCount: 0,
                defaultBackedContextCount: 0,
                additionalAuthorityContextCount: 0,
                unsupportedContextCount: 0,
                deferredCapabilityCount: 0,
                configurationIssueCount: 1,
            },
        };

        renderPanel(invalidUser);

        expect(screen.getByText("พบการตั้งค่าสิทธิ์ที่ต้องตรวจสอบ")).toBeInTheDocument();
        expect(screen.getByText("UNKNOWN_PERSISTED_CAPABILITY")).toBeInTheDocument();
        expect(screen.queryByText("ALLOW")).not.toBeInTheDocument();
        expect(screen.queryByText("สิทธิ์พื้นฐาน")).not.toBeInTheDocument();
        expectInvalidConfigurationSurfaceToBeReadOnly();
    });

    it("keeps the User permission surface read-only when only effective access inspection is invalid", () => {
        const error = {
            code: "UNKNOWN_PERSISTED_CAPABILITY" as const,
            capabilityKey: "old.capability",
            teamId: 11,
        };
        const invalidUser: AuthorizationAdministrationUserDetailData = {
            ...normalUser,
            effectiveAccessStatus: { status: "INVALID_CONFIGURATION", error },
            effectiveAccess: [],
            effectiveAccessSummary: {
                inspectedContextCount: 0,
                availableContextCount: 0,
                defaultBackedContextCount: 0,
                additionalAuthorityContextCount: 0,
                unsupportedContextCount: 0,
                deferredCapabilityCount: 0,
                configurationIssueCount: 1,
            },
        };

        renderPanel(invalidUser);

        expect(screen.getByText("พบการตั้งค่าสิทธิ์ที่ต้องตรวจสอบ")).toBeInTheDocument();
        expect(screen.getByText("UNKNOWN_PERSISTED_CAPABILITY")).toBeInTheDocument();
        expectInvalidConfigurationSurfaceToBeReadOnly();
    });

    it("keeps system-role promotion separate from business capability grants", async () => {
        grantApi.changeUserSystemRole.mockResolvedValue({ userId: 7, before: "USER", after: "ADMIN" });
        const onRefresh = vi.fn(async () => undefined);
        renderPanel(normalUser, onRefresh);

        expect(screen.getByRole("heading", { name: "บัญชีและบทบาทระบบ" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "บทบาทผู้ดูแลระบบ" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "แต่งตั้งเป็นผู้ดูแลระบบ" }));

        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByRole("heading", { name: "แต่งตั้งเป็นผู้ดูแลระบบหรือไม่?" })).toBeInTheDocument();
        expect(within(dialog).getByText(/ไม่ได้เพิ่มสิทธิ์การทำงานของโมดูลต่าง ๆ/)).toBeInTheDocument();
        expect(grantApi.changeUserSystemRole).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันแต่งตั้งเป็นผู้ดูแลระบบ" }));
        await vi.waitFor(() => {
            expect(grantApi.changeUserSystemRole).toHaveBeenCalledWith(7, { systemRole: "ADMIN" });
        });
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("requires confirmation for ADMIN demotion and explains that business grants remain", async () => {
        grantApi.changeUserSystemRole.mockResolvedValue({ userId: 7, before: "ADMIN", after: "USER" });
        const onRefresh = vi.fn(async () => undefined);
        renderPanel(adminUser, onRefresh);

        fireEvent.click(screen.getByRole("button", { name: "ยกเลิกบทบาทผู้ดูแลระบบ" }));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByRole("heading", { name: "ยกเลิกบทบาทผู้ดูแลระบบหรือไม่?" })).toBeInTheDocument();
        expect(within(dialog).getByText(/จะไม่ลบสมาชิก Team, TeamRole หรือสิทธิ์เฉพาะบุคคล/)).toBeInTheDocument();
        expect(grantApi.changeUserSystemRole).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันยกเลิกบทบาทผู้ดูแลระบบ" }));
        await vi.waitFor(() => {
            expect(grantApi.changeUserSystemRole).toHaveBeenCalledWith(7, { systemRole: "USER" });
        });
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("keeps the domain and effective-state filters usable", () => {
        renderPanel(normalUser);

        fireEvent.change(screen.getByLabelText("สถานะสิทธิ์"), {
            target: { value: "UNAVAILABLE" },
        });
        expect(screen.getByRole("heading", { name: "อีเมล" })).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("สถานะสิทธิ์"), {
            target: { value: "ALL" },
        });
        fireEvent.change(screen.getByLabelText("หมวดงาน"), {
            target: { value: "audit" },
        });
        expect(screen.getByRole("heading", { name: "การตรวจสอบ" })).toBeInTheDocument();
    });

    it("keeps User search results available for selection", () => {
        const onSelectUser = vi.fn();
        render(
            <UserAccessPanel
                user={undefined}
                loading={false}
                error={undefined}
                overview={overview}
                query="สม"
                directoryUsers={directoryUsers}
                directoryLoading={false}
                directoryError={undefined}
                onQueryChange={vi.fn()}
                onSelectUser={onSelectUser}
                onSelectTeam={vi.fn()}
                onRefresh={vi.fn(async () => undefined)}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: /สมชาย ใจดี/ }));
        expect(onSelectUser).toHaveBeenCalledWith(7);
    });

    it("revalidates effective access after adding a direct User grant", async () => {
        grantApi.addUserGrant.mockResolvedValue(undefined);
        const onRefresh = vi.fn(async () => undefined);
        renderPanel(normalUser, onRefresh);

        fireEvent.click(screen.getByRole("button", { name: "เพิ่มสิทธิ์อื่น" }));
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: /ดูบันทึกการใช้งานระบบ/ }));
        fireEvent.click(within(dialog).getByRole("button", { name: "ตรวจสอบการเปลี่ยนแปลง" }));
        fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันเพิ่มสิทธิ์" }));

        await vi.waitFor(() => {
            expect(grantApi.addUserGrant).toHaveBeenCalledWith(7, {
                capabilityKey: "audit.read",
                scope: "ALL",
            });
        });
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("revalidates effective access after removing a direct User grant", async () => {
        grantApi.removeUserGrant.mockResolvedValue(undefined);
        const onRefresh = vi.fn(async () => undefined);
        renderPanel({ ...normalUser, directGrants: [directUserGrantProjection] }, onRefresh);

        const auditCard = screen.getByTestId("effective-capability-card-audit.read");
        fireEvent.click(within(auditCard).getByRole("button", { name: "ปรับสิทธิ์เฉพาะบุคคล" }));
        fireEvent.click(within(auditCard).getByRole("button", { name: /นำสิทธิ์เฉพาะบุคคล ดูบันทึกการใช้งานระบบ ทั้งหมด ออก/ }));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText(/สิทธิ์พื้นฐาน หรือสิทธิ์จากกลุ่ม\/บทบาทอาจยังทำให้ผู้ใช้นี้เข้าถึงรายการนี้ได้/)).toBeInTheDocument();
        fireEvent.click(within(dialog).getByRole("button", { name: "นำสิทธิ์ออก" }));

        await vi.waitFor(() => {
            expect(grantApi.removeUserGrant).toHaveBeenCalledWith(7, {
                capabilityKey: "audit.read",
                scope: "ALL",
            });
        });
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it("adds a direct User scope from the matching capability card and refreshes authoritative data", async () => {
        grantApi.addUserGrant.mockResolvedValue(undefined);
        const onRefresh = vi.fn(async () => undefined);
        renderPanel(normalUser, onRefresh);

        const card = screen.getByTestId("effective-capability-card-routine.task.read");
        fireEvent.click(within(card).getByRole("button", { name: "ปรับสิทธิ์เฉพาะบุคคล" }));
        fireEvent.click(within(card).getByRole("radio", { name: /ทั้งหมดงานประจำทั้งหมด/ }));
        fireEvent.click(within(card).getByRole("button", { name: "เพิ่มสิทธิ์" }));
        fireEvent.click(within(card).getByRole("button", { name: "ยืนยันเพิ่มสิทธิ์" }));

        await vi.waitFor(() => {
            expect(grantApi.addUserGrant).toHaveBeenCalledWith(7, {
                capabilityKey: "routine.task.read",
                scope: "ALL",
            });
        });
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });
});
