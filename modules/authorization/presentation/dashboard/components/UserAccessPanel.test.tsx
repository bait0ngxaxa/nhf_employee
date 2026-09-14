import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { UserAccessPanel } from "./UserAccessPanel";
import type {
    AuthorizationAdministrationOverviewData,
    AuthorizationAdministrationUserDetailData,
    AuthorizationAdministrationUserSummaryData,
} from "../types";

const capability = {
    key: "audit.read",
    registered: true,
    domain: "audit",
    description: "อ่านบันทึกการใช้งาน",
    supportedScopes: ["ALL"],
    supportedChannels: ["DASHBOARD"],
    runtimeAuthorizationMode: "CENTRAL_WITH_COMPATIBILITY",
    administrativeStatus: "POLICY_ACTIVATION_REQUIRED",
    administrativelyGrantable: false,
    nonGrantableReason: "ต้องเปิด Policy ก่อน",
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

const user = {
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
        capability,
        allowed: true,
        scopes: ["ALL"],
        grants: [
            {
                capability: "audit.read",
                scope: "ALL",
                source: { type: "SYSTEM_ROLE", role: "ADMIN" },
                origin: { type: "SYSTEM_ROLE", role: "ADMIN" },
            },
            {
                capability: "audit.read",
                scope: "ALL",
                source: { type: "TEAM", teamId: 11 },
                constraint: { teamId: 11 },
                origin: { type: "TEAM", teamId: 11, team: teamReference },
            },
            {
                capability: "audit.read",
                scope: "ALL",
                source: { type: "TEAM_ROLE", teamId: 11, teamRoleId: 21 },
                origin: { type: "TEAM_ROLE", teamId: 11, teamRoleId: 21, team: teamReference, teamRole: roleReference },
            },
            {
                capability: "audit.read",
                scope: "ALL",
                source: { type: "USER", userId: 7 },
                origin: { type: "USER", userId: 7 },
            },
        ],
    }],
    configurationIssues: [],
} satisfies AuthorizationAdministrationUserDetailData;

const overview = {
    capabilities: [capability],
    teams: [],
    summary: {
        registeredCapabilityCount: 1,
        administrativelyGrantableCapabilityCount: 0,
        policyActivationRequiredCapabilityCount: 1,
        deferredCapabilityCount: 0,
        teamCount: 0,
        activeTeamCount: 0,
    },
} satisfies AuthorizationAdministrationOverviewData;

const directoryUsers = [userSummary] satisfies readonly AuthorizationAdministrationUserSummaryData[];

function renderPanel(userDetail: AuthorizationAdministrationUserDetailData = user) {
    return render(
        <UserAccessPanel
            user={userDetail}
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
            onRefresh={vi.fn(async () => undefined)}
        />,
    );
}

describe("User Access presentation", () => {
    it("shows lifecycle, memberships, distinct source explanations, TEAM constraint, and compatibility warning", () => {
        renderPanel();

        expect(screen.getByText("SYSTEM_ROLE")).toBeInTheDocument();
        expect(screen.getByText("TEAM_ROLE")).toBeInTheDocument();
        expect(screen.getByText("Direct User Grant · User ID 7")).toBeInTheDocument();
        expect(screen.getByText("constraint.teamId: 11")).toBeInTheDocument();
        expect(screen.getByText("มี Compatibility Policy")).toBeInTheDocument();
        expect(screen.getByText(/ผลจาก Central Authorization Resolver/)).toBeInTheDocument();
        expect(screen.getByText("SYSTEM ADMIN")).toBeInTheDocument();
        expect(screen.getByText("Operations")).toBeInTheDocument();
    });

    it("does not present INVALID_CONFIGURATION as a normal resolver decision", () => {
        const invalidUser: AuthorizationAdministrationUserDetailData = {
            ...user,
            resolverEffectivePermissionStatus: {
                status: "INVALID_CONFIGURATION",
                error: {
                    code: "UNKNOWN_PERSISTED_CAPABILITY",
                    capabilityKey: "old.capability",
                    teamId: 11,
                },
            },
            resolverEffectivePermissions: [],
        };

        renderPanel(invalidUser);

        expect(screen.getByText("Resolver ไม่สามารถเชื่อถือผลลัพธ์ได้")).toBeInTheDocument();
        expect(screen.getByText("UNKNOWN_PERSISTED_CAPABILITY")).toBeInTheDocument();
        expect(screen.queryByText("ALLOW")).not.toBeInTheDocument();
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
});
