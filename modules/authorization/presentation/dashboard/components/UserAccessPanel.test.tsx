import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const grantApi = vi.hoisted(() => ({
    addUserGrant: vi.fn(),
    removeUserGrant: vi.fn(),
}));

vi.mock("../api", () => grantApi);

import { UserAccessPanel } from "./UserAccessPanel";
import type {
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
    runtimeAuthorizationMode: "DEFERRED",
    administrativeStatus: "DEFERRED",
    administrativelyGrantable: false,
    nonGrantableReason: "Email Request remains deferred",
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
        effectiveAuthority: { state: "DEFERRED", scopes: [], redundant: false },
        limitations: [{ code: "email.deferred_migration", label: "Email Request ยัง deferred" }],
    }],
    effectiveAccessSummary: {
        inspectedContextCount: 2,
        availableContextCount: 1,
        defaultBackedContextCount: 0,
        additionalAuthorityContextCount: 1,
        unsupportedContextCount: 0,
        deferredCapabilityCount: 1,
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
        effectiveAuthority: { state: "DEFERRED", scopes: [], redundant: false },
        limitations: [{ code: "email.deferred_migration", label: "Email Request ยัง deferred" }],
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
        deferredCapabilityCount: 1,
        configurationIssueCount: 0,
    },
} satisfies AuthorizationAdministrationUserDetailData;

const overview = {
    capabilities: [auditCapability, routineCapability, routineUpdateCapability, emailCapability],
    teams: [],
    summary: {
        registeredCapabilityCount: 4,
        administrativelyGrantableCapabilityCount: 3,
        policyActivationRequiredCapabilityCount: 0,
        deferredCapabilityCount: 1,
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

afterEach(() => {
    vi.clearAllMocks();
});

describe("User Access presentation", () => {
    it("keeps Default, Additional, Effective, provenance, and deferred state visibly distinct", () => {
        renderPanel();

        expect(screen.getAllByText("Default Domain Policy").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Additional / Resolver authority").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Effective capability authority").length).toBeGreaterThan(0);
        expect(screen.getAllByText("SYSTEM_ROLE").length).toBeGreaterThan(0);
        expect(screen.getByText(/ดู source \/ provenance ของ Additional/)).toBeInTheDocument();
        expect(screen.getAllByText(/DEFERRED · ยังไม่ migrate/).length).toBeGreaterThan(0);
        expect(screen.queryByText("มี Compatibility Policy")).not.toBeInTheDocument();
        expect(screen.getByText("SYSTEM ADMIN")).toBeInTheDocument();
        expect(screen.getByText("Operations")).toBeInTheDocument();
    });

    it("does not turn NO_APPLICABLE_GRANT into final denial when Default exists", () => {
        renderPanel(normalUser);

        expect(screen.getAllByText("AVAILABLE · มี authority").length).toBeGreaterThan(0);
        expect(screen.getAllByText("Default Domain Policy").length).toBeGreaterThan(0);
        expect(screen.getAllByText(/NO_APPLICABLE_GRANT/).length).toBeGreaterThan(0);
        expect(screen.getAllByText("UNAVAILABLE · ไม่มี authority").length).toBeGreaterThan(0);
    });

    it("shows trusted context variants, LIFF distinction, unsupported and deferred states", () => {
        renderPanel(normalUser);

        expect(screen.getByText("Dashboard · Management")).toBeInTheDocument();
        expect(screen.getByText("Dashboard · Work items · Mine")).toBeInTheDocument();
        expect(screen.getByText("Dashboard · Work items · All")).toBeInTheDocument();
        expect(screen.getAllByText("LIFF · Self service").length).toBeGreaterThan(0);
        expect(screen.getAllByText("UNSUPPORTED · ไม่รองรับ context นี้").length).toBeGreaterThan(0);
        expect(screen.getAllByText("DEFERRED · ยังไม่ migrate").length).toBeGreaterThan(0);
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

        expect(screen.getByText("Resolver ไม่สามารถเชื่อถือผลลัพธ์ได้")).toBeInTheDocument();
        expect(screen.getByText("UNKNOWN_PERSISTED_CAPABILITY")).toBeInTheDocument();
        expect(screen.queryByText("ALLOW")).not.toBeInTheDocument();
        expect(screen.queryByText("Default Domain Policy")).not.toBeInTheDocument();
    });

    it("keeps the domain and effective-state filters usable", () => {
        renderPanel(normalUser);

        fireEvent.change(screen.getByLabelText("Effective state"), {
            target: { value: "DEFERRED" },
        });
        expect(screen.getByText("email.request.read")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("Domain"), {
            target: { value: "audit" },
        });
        expect(screen.getByText("audit.read")).toBeInTheDocument();
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

        fireEvent.click(screen.getByRole("button", { name: /^เพิ่ม grant$/ }));
        const dialog = await screen.findByRole("dialog");
        fireEvent.change(within(dialog).getByLabelText("Capability"), {
            target: { value: "audit.read" },
        });
        fireEvent.click(within(dialog).getByRole("button", { name: /^เพิ่ม grant$/ }));

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

        fireEvent.click(screen.getByRole("button", { name: "ลบ grant audit.read ALL" }));
        const dialog = await screen.findByRole("alertdialog");
        fireEvent.click(within(dialog).getByRole("button", { name: /^ลบ grant$/ }));

        await vi.waitFor(() => {
            expect(grantApi.removeUserGrant).toHaveBeenCalledWith(7, {
                capabilityKey: "audit.read",
                scope: "ALL",
            });
        });
        expect(onRefresh).toHaveBeenCalledTimes(1);
    });
});
