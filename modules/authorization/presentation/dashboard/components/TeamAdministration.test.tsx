import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { TeamAdministration } from "./TeamAdministration";
import type {
    AuthorizationAdministrationOverviewData,
    AuthorizationAdministrationTeamDetailData,
} from "../types";

const capability = {
    key: "employee.create",
    registered: true,
    domain: "employee",
    description: "สร้างข้อมูลพนักงาน",
    supportedScopes: ["ALL"],
    supportedChannels: ["DASHBOARD"],
    runtimeAuthorizationMode: "CENTRAL_ONLY",
    administrativeStatus: "GRANTABLE",
    administrativelyGrantable: true,
} satisfies AuthorizationAdministrationOverviewData["capabilities"][number];

const team = {
    id: 11,
    key: "operations",
    name: "Operations",
    description: "ทีมปฏิบัติการ",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    roleCount: 1,
    membershipCount: 1,
    teamGrantCount: 0,
    roles: [{
        id: 21,
        teamId: 11,
        key: "operator",
        name: "Operator",
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        membershipCount: 1,
        grantCount: 0,
    }],
    memberships: [{
        teamId: 11,
        userId: 7,
        teamRoleId: 21,
        teamRole: {
            id: 21,
            teamId: 11,
            key: "operator",
            name: "Operator",
            isActive: true,
        },
        user: {
            id: 7,
            name: "สมชาย ใจดี",
            email: "somchai@example.com",
            role: "USER",
            isActive: true,
            deletedAt: null,
            employee: null,
        },
    }],
    teamGrants: [],
    teamRoleGrants: [],
    configurationIssues: [{
        source: "TEAM_GRANT",
        code: "UNKNOWN_PERSISTED_CAPABILITY",
        capabilityKey: "old.capability",
        scope: "ALL",
    }],
} satisfies AuthorizationAdministrationTeamDetailData;

const overview = {
    capabilities: [capability],
    teams: [team],
    summary: {
        registeredCapabilityCount: 1,
        administrativelyGrantableCapabilityCount: 1,
        policyActivationRequiredCapabilityCount: 0,
        deferredCapabilityCount: 0,
        teamCount: 1,
        activeTeamCount: 1,
    },
} satisfies AuthorizationAdministrationOverviewData;

function renderTeam() {
    return render(
        <TeamAdministration
            team={team}
            loading={false}
            error={undefined}
            overview={overview}
            directoryQuery=""
            directoryUsers={[]}
            directoryLoading={false}
            directoryError={undefined}
            onDirectoryQueryChange={vi.fn()}
            onSelectUser={vi.fn()}
            onRefresh={vi.fn(async () => undefined)}
        />,
    );
}

describe("TeamAdministration", () => {
    it("keeps configuration issues visible and exposes role/member sections", () => {
        renderTeam();

        expect(screen.getByText(/พบการตั้งค่าสิทธิ์ของกลุ่มที่ต้องตรวจสอบ/)).toBeInTheDocument();
        expect(screen.getByText(/capability: old\.capability/).closest("details")).not.toHaveAttribute("open");
        fireEvent.click(screen.getByRole("button", { name: "บทบาทและสิทธิ์" }));
        expect(screen.getByRole("button", { name: "สร้างบทบาท" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "สมาชิก" }));
        expect(screen.getByText("สมชาย ใจดี")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /นำ สมชาย ใจดี ออกจากกลุ่ม/ })).toBeInTheDocument();
    });

    it("requires confirmation before disabling a Team and explains retained configuration", () => {
        renderTeam();

        fireEvent.click(screen.getByRole("button", { name: "ปิดใช้งานกลุ่ม" }));

        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
        expect(screen.getByText(/สมาชิกและสิทธิ์ที่ตั้งค่าไว้จะไม่ถูกลบ/)).toBeInTheDocument();
        expect(screen.getByText(/การเข้าถึงจากกลุ่มจะหยุดใช้งาน/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });
});
