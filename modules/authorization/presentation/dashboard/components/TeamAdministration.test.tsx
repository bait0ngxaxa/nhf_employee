import { useState } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const teamApi = vi.hoisted(() => ({
    addMember: vi.fn(),
    addTeamGrant: vi.fn(),
    addTeamRoleGrant: vi.fn(),
    changeMemberRole: vi.fn(),
    createTeamRole: vi.fn(),
    removeMember: vi.fn(),
    removeTeamGrant: vi.fn(),
    removeTeamRoleGrant: vi.fn(),
    updateTeam: vi.fn(),
    updateTeamRole: vi.fn(),
}));

vi.mock("../api", async (importOriginal) => {
    const actual = await importOriginal<typeof AuthorizationApiModule>();
    return { ...actual, ...teamApi };
});

import { TeamAdministration } from "./TeamAdministration";
import type * as AuthorizationApiModule from "../api";
import type {
    AuthorizationAdministrationOverviewData,
    AuthorizationAdministrationTeamDetailData,
    AuthorizationAdministrationUserSummaryData,
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

const directoryUser = {
    id: 8,
    name: "สุดา ใจดี",
    email: "suda@example.com",
    role: "USER",
    isActive: true,
    deletedAt: null,
    employee: null,
    teams: [],
} satisfies AuthorizationAdministrationUserSummaryData;

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

function renderTeamWithDirectory() {
    const onDirectoryQueryChange = vi.fn();
    function DirectoryHarness() {
        const [directoryQuery, setDirectoryQuery] = useState("stale query");
        const [, setParentRender] = useState(0);

        return (
            <>
                <button type="button" onClick={() => setParentRender((current) => current + 1)}>
                    parent team rerender
                </button>
                <TeamAdministration
                    team={team}
                    loading={false}
                    error={undefined}
                    overview={overview}
                    directoryQuery={directoryQuery}
                    directoryUsers={[directoryUser]}
                    directoryLoading={false}
                    directoryError={undefined}
                    onDirectoryQueryChange={(query) => {
                        onDirectoryQueryChange(query);
                        setDirectoryQuery(query);
                    }}
                    onSelectUser={vi.fn()}
                    onRefresh={vi.fn(async () => undefined)}
                />
            </>
        );
    }

    return { ...render(<DirectoryHarness />), onDirectoryQueryChange };
}

describe("TeamAdministration", () => {
    it("keeps configuration issues visible and exposes Team/member sections", () => {
        renderTeam();

        expect(screen.getByText(/พบการตั้งค่าสิทธิ์ของทีมที่ต้องตรวจสอบ/)).toBeInTheDocument();
        expect(screen.queryByText("old.capability")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "หน้าที่ในทีมและสิทธิ์" }));
        expect(screen.getByRole("button", { name: "เพิ่มหน้าที่" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "สมาชิก" }));
        expect(screen.getByText("สมชาย ใจดี")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /นำ สมชาย ใจดี ออกจากทีม/ })).toBeInTheDocument();
    });

    it("requires confirmation before disabling a Team and explains retained configuration", () => {
        renderTeam();

        fireEvent.click(screen.getByRole("button", { name: "ปิดใช้งานทีม" }));

        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
        expect(screen.getByText(/สมาชิกและสิทธิ์ที่ตั้งค่าไว้จะไม่ถูกลบ/)).toBeInTheDocument();
        expect(screen.getByText(/การเข้าถึงจากทีมจะหยุดใช้งาน/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("initializes and clears the parent-owned Add Member query at session boundaries", async () => {
        const { onDirectoryQueryChange } = renderTeamWithDirectory();

        fireEvent.click(screen.getByRole("button", { name: "สมาชิก" }));
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มสมาชิก" }));
        expect(screen.getByLabelText("ค้นหาผู้ใช้")).toHaveValue("");
        expect(onDirectoryQueryChange).toHaveBeenCalledWith("");

        fireEvent.change(screen.getByLabelText("ค้นหาผู้ใช้"), { target: { value: "suda" } });
        fireEvent.click(screen.getByText("parent team rerender"));
        expect(screen.getByLabelText("ค้นหาผู้ใช้")).toHaveValue("suda");

        fireEvent.click(screen.getByRole("button", { name: "ปิดแบบฟอร์มเพิ่มสมาชิก" }));
        const discardDialog = await screen.findByRole("alertdialog");
        fireEvent.click(within(discardDialog).getByRole("button", { name: "ทิ้งข้อมูล" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

        fireEvent.click(screen.getByRole("button", { name: "เพิ่มสมาชิก" }));
        expect(screen.getByLabelText("ค้นหาผู้ใช้")).toHaveValue("");
        expect(onDirectoryQueryChange).toHaveBeenLastCalledWith("");
    });

    it("keeps a failed Team confirmation error in-session and clears it for the next confirmation", async () => {
        teamApi.updateTeam.mockRejectedValue(new Error("request failed"));
        renderTeam();

        fireEvent.click(screen.getByRole("button", { name: "ปิดใช้งานทีม" }));
        let confirmation = await screen.findByRole("alertdialog");
        fireEvent.click(within(confirmation).getByRole("button", { name: "ปิดใช้งาน" }));
        await waitFor(() => expect(within(confirmation).getByText("ดำเนินการไม่สำเร็จ")).toBeInTheDocument());

        fireEvent.click(within(confirmation).getByRole("button", { name: "ยกเลิก" }));
        fireEvent.click(screen.getByRole("button", { name: "ปิดใช้งานทีม" }));
        confirmation = await screen.findByRole("alertdialog");
        expect(within(confirmation).queryByText("ดำเนินการไม่สำเร็จ")).not.toBeInTheDocument();
    });
});
