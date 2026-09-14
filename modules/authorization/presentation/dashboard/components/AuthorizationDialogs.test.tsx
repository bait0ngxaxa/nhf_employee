import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GrantFormDialog, TeamFormDialog } from "./AuthorizationDialogs";
import type {
    AuthorizationAdministrationOverviewData,
    AuthorizationAdministrationTeamDetailData,
} from "../types";

const capabilities = [
    {
        key: "employee.create",
        registered: true,
        domain: "employee",
        description: "สร้างข้อมูลพนักงาน",
        supportedScopes: ["ALL"],
        supportedChannels: ["DASHBOARD"],
        runtimeAuthorizationMode: "CENTRAL_ONLY",
        administrativeStatus: "GRANTABLE",
        administrativelyGrantable: true,
    },
    {
        key: "employee.read",
        registered: true,
        domain: "employee",
        description: "อ่านข้อมูลพนักงาน",
        supportedScopes: ["TEAM", "ALL"],
        supportedChannels: ["DASHBOARD"],
        runtimeAuthorizationMode: "CENTRAL_ONLY",
        administrativeStatus: "GRANTABLE",
        administrativelyGrantable: true,
    },
    {
        key: "routine.task.read",
        registered: true,
        domain: "routine",
        description: "อ่านงาน Routine",
        supportedScopes: ["OWN", "ALL"],
        supportedChannels: ["DASHBOARD"],
        runtimeAuthorizationMode: "CENTRAL_WITH_COMPATIBILITY",
        administrativeStatus: "POLICY_ACTIVATION_REQUIRED",
        administrativelyGrantable: false,
        nonGrantableReason: "ต้องเปิด Policy ก่อน",
    },
] satisfies AuthorizationAdministrationOverviewData["capabilities"];

const team = {
    id: 11,
    key: "operations",
    name: "Operations",
    description: "ทีมปฏิบัติการ",
    isActive: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    roleCount: 0,
    membershipCount: 0,
    teamGrantCount: 0,
    roles: [],
    memberships: [],
    teamGrants: [],
    teamRoleGrants: [],
    configurationIssues: [],
} satisfies AuthorizationAdministrationTeamDetailData;

describe("Authorization Administration dialogs", () => {
    it("submits the Team creation payload and does not add a local row", async () => {
        const onSubmit = vi.fn(async () => undefined);
        render(
            <TeamFormDialog
                open
                mode="create"
                busy={false}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );

        fireEvent.change(screen.getByLabelText("key"), { target: { value: "operations" } });
        fireEvent.change(screen.getByLabelText("ชื่อ Team"), { target: { value: "Operations" } });
        fireEvent.change(screen.getByLabelText("คำอธิบาย (ไม่บังคับ)"), { target: { value: "ทีมปฏิบัติการ" } });
        fireEvent.click(screen.getByRole("button", { name: "สร้าง Team" }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
            key: "operations",
            name: "Operations",
            description: "ทีมปฏิบัติการ",
        }));
    });

    it("keeps a Team key read-only in the metadata editor", () => {
        render(
            <TeamFormDialog
                open
                mode="edit"
                team={team}
                busy={false}
                onClose={vi.fn()}
                onSubmit={vi.fn(async () => undefined)}
            />,
        );

        const keyInput = screen.getByLabelText("key");
        expect(keyInput).toHaveValue("operations");
        expect(keyInput).toHaveAttribute("readonly");
    });

    it("offers only supported scopes and excludes TEAM scope for direct User grants", () => {
        render(
            <GrantFormDialog
                open
                source="USER"
                capabilities={capabilities}
                busy={false}
                onClose={vi.fn()}
                onSubmit={vi.fn(async () => undefined)}
            />,
        );

        fireEvent.change(screen.getByLabelText("Capability"), {
            target: { value: "employee.read" },
        });

        expect(screen.queryByRole("option", { name: "TEAM" })).not.toBeInTheDocument();
        expect(screen.getByRole("option", { name: "ALL" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: /routine\.task\.read/ })).toBeDisabled();
    });
});
