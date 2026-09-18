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

        fireEvent.change(screen.getByLabelText("รหัสทางเทคนิค"), { target: { value: "operations" } });
        fireEvent.change(screen.getByLabelText("ชื่อกลุ่ม"), { target: { value: "Operations" } });
        fireEvent.change(screen.getByLabelText("คำอธิบายกลุ่ม (ไม่บังคับ)"), { target: { value: "ทีมปฏิบัติการ" } });
        fireEvent.click(screen.getByRole("button", { name: "สร้างกลุ่มผู้ใช้งาน" }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
            key: "operations",
            name: "Operations",
            description: "ทีมปฏิบัติการ",
        }));
    });

    it("generates a fresh technical key for each new Team form session", async () => {
        const submittedKeys: string[] = [];
        const onSubmit = vi.fn(async (input: { readonly key?: string; readonly name: string; readonly description: string | null }) => {
            if (input.key) submittedKeys.push(input.key);
        });
        const view = render(
            <TeamFormDialog
                open
                mode="create"
                busy={false}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );

        fireEvent.change(screen.getByLabelText("ชื่อกลุ่ม"), { target: { value: "กลุ่มแรก" } });
        fireEvent.click(screen.getByRole("button", { name: "สร้างกลุ่มผู้ใช้งาน" }));
        await waitFor(() => expect(submittedKeys).toHaveLength(1));

        view.rerender(
            <TeamFormDialog
                open={false}
                mode="create"
                busy={false}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );
        view.rerender(
            <TeamFormDialog
                open
                mode="create"
                busy={false}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );

        fireEvent.change(screen.getByLabelText("ชื่อกลุ่ม"), { target: { value: "กลุ่มที่สอง" } });
        fireEvent.click(screen.getByRole("button", { name: "สร้างกลุ่มผู้ใช้งาน" }));
        await waitFor(() => expect(submittedKeys).toHaveLength(2));

        expect(submittedKeys[0]).toMatch(/^new-team-/);
        expect(submittedKeys[1]).toMatch(/^new-team-/);
        expect(submittedKeys[1]).not.toBe(submittedKeys[0]);
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

        const keyInput = screen.getByLabelText("รหัสทางเทคนิค");
        expect(keyInput).toHaveValue("operations");
        expect(keyInput).toHaveAttribute("readonly");
    });

    it("groups business abilities, hides non-grantable items, and excludes TEAM scope for direct User grants", async () => {
        const onSubmit = vi.fn(async () => undefined);
        render(
            <GrantFormDialog
                open
                source="USER"
                capabilities={capabilities}
                busy={false}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );

        expect(screen.getByRole("heading", { name: "บุคลากร" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /ดูข้อมูลพนักงาน/ })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /ดูงานประจำ/ })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /employee\.read/ })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /ดูข้อมูลพนักงาน/ }));

        expect(screen.queryByRole("radio", { name: /ภายในกลุ่มนี้/ })).not.toBeInTheDocument();
        expect(screen.getByRole("radio", { name: /ทั้งหมด/ })).toBeChecked();

        fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบการเปลี่ยนแปลง" }));
        expect(screen.getByText("ตรวจสอบสิ่งที่จะเปลี่ยน")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันเพิ่มสิทธิ์" }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
            capabilityKey: "employee.read",
            scope: "ALL",
        }));
    });

    it("keeps the permission form body scrollable after selecting an ability", () => {
        render(
            <GrantFormDialog
                open
                source="TEAM"
                capabilities={capabilities}
                busy={false}
                onClose={vi.fn()}
                onSubmit={vi.fn(async () => undefined)}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: /เพิ่มพนักงาน/ }));

        const dialog = screen.getByRole("dialog");
        const scrollArea = dialog.querySelector('[data-slot="dialog-scroll-area"]');

        expect(scrollArea).toBeInTheDocument();
        expect(scrollArea).toHaveClass("overflow-y-auto");
    });
});
