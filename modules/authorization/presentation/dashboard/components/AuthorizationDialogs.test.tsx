import { useState, type ReactElement } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
    AddMemberDialog,
    GrantFormDialog,
    TeamFormDialog,
    TeamRoleFormDialog,
} from "./AuthorizationDialogs";
import type {
    AuthorizationAdministrationOverviewData,
    AuthorizationAdministrationTeamDetailData,
    AuthorizationAdministrationUserSummaryData,
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

const memberTeam = {
    ...team,
    roles: [{
        id: 21,
        teamId: 11,
        key: "operator",
        name: "Operator",
        isActive: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-02T00:00:00.000Z",
        membershipCount: 0,
        grantCount: 0,
    }],
} satisfies AuthorizationAdministrationTeamDetailData;

const memberUser = {
    id: 7,
    name: "สมชาย ใจดี",
    email: "somchai@example.com",
    role: "USER",
    isActive: true,
    deletedAt: null,
    employee: null,
    teams: [],
} satisfies AuthorizationAdministrationUserSummaryData;

function AddMemberSessionHarness({
    onQueryChange,
    onSubmit,
}: {
    readonly onQueryChange: (query: string) => void;
    readonly onSubmit: (input: { readonly userId: number; readonly teamRoleId: number | null }) => Promise<void>;
}): ReactElement {
    const [open, setOpen] = useState(false);
    const [sessionId, setSessionId] = useState(0);
    const [query, setQuery] = useState("");
    const [, setParentRender] = useState(0);

    const updateQuery = (nextQuery: string): void => {
        onQueryChange(nextQuery);
        setQuery(nextQuery);
    };
    const close = (): void => {
        updateQuery("");
        setOpen(false);
    };

    return (
        <>
            <button type="button" onClick={() => { updateQuery(""); setSessionId((current) => current + 1); setOpen(true); }}>
                เปิด Add Member
            </button>
            <button type="button" onClick={() => setParentRender((current) => current + 1)}>
                parent rerender
            </button>
            <button type="button" onClick={close}>ปิด Add Member</button>
            <AddMemberDialog
                key={sessionId}
                open={open}
                team={memberTeam}
                users={[memberUser]}
                roles={memberTeam.roles}
                query={query}
                usersLoading={false}
                usersError={undefined}
                busy={false}
                onQueryChange={updateQuery}
                onClose={close}
                onSubmit={onSubmit}
            />
        </>
    );
}

function GrantSessionHarness({
    onSubmit,
}: {
    readonly onSubmit: (input: { readonly capabilityKey: string; readonly scope: string }) => Promise<void>;
}): ReactElement {
    const [open, setOpen] = useState(false);
    const [sessionId, setSessionId] = useState(0);
    const [source, setSource] = useState<"TEAM" | "TEAM_ROLE">("TEAM");
    const [, setParentRender] = useState(0);

    const openSession = (): void => {
        setSessionId((current) => current + 1);
        setOpen(true);
    };

    return (
        <>
            <button type="button" onClick={openSession}>เปิด Grant</button>
            <button type="button" onClick={() => setParentRender((current) => current + 1)}>
                parent grant rerender
            </button>
            <button type="button" onClick={() => setOpen(false)}>ปิด Grant</button>
            <button type="button" onClick={() => { setSource("TEAM_ROLE"); openSession(); }}>
                เปลี่ยนเป็น TeamRole session
            </button>
            <GrantFormDialog
                key={`${source}:${sessionId}`}
                open={open}
                source={source}
                capabilities={capabilities}
                busy={false}
                onClose={() => setOpen(false)}
                onSubmit={onSubmit}
            />
        </>
    );
}

describe("Authorization Administration dialogs", () => {
    it("submits the Team creation payload and does not add a local row", async () => {
        const onSubmit = vi.fn(async (_input: {
            readonly key?: string;
            readonly name: string;
            readonly description: string | null;
        }) => undefined);
        render(
            <TeamFormDialog
                open
                mode="create"
                busy={false}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );

        fireEvent.change(screen.getByLabelText("ชื่อทีม"), { target: { value: "Operations" } });
        fireEvent.change(screen.getByLabelText("คำอธิบายทีม (ไม่บังคับ)"), { target: { value: "ทีมปฏิบัติการ" } });
        expect(screen.queryByLabelText("รหัสทางเทคนิค")).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "สร้างทีม" }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        const submitted = onSubmit.mock.calls[0]?.[0];
        expect(submitted).toMatchObject({
            name: "Operations",
            description: "ทีมปฏิบัติการ",
        });
        expect(submitted?.key).toMatch(/^new-team-/);
    });

    it("generates a fresh technical key for each new Team form session", async () => {
        const submittedKeys: string[] = [];
        const onSubmit = vi.fn(async (input: { readonly key?: string; readonly name: string; readonly description: string | null }) => {
            if (input.key) submittedKeys.push(input.key);
        });
        const view = render(
            <TeamFormDialog
                key="create:1"
                open
                mode="create"
                busy={false}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );

        fireEvent.change(screen.getByLabelText("ชื่อทีม"), { target: { value: "ทีมแรก" } });
        fireEvent.click(screen.getByRole("button", { name: "สร้างทีม" }));
        await waitFor(() => expect(submittedKeys).toHaveLength(1));

        view.rerender(
            <TeamFormDialog
                key="closed"
                open={false}
                mode="create"
                busy={false}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );
        view.rerender(
            <TeamFormDialog
                key="create:2"
                open
                mode="create"
                busy={false}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );

        fireEvent.change(screen.getByLabelText("ชื่อทีม"), { target: { value: "ทีมที่สอง" } });
        fireEvent.click(screen.getByRole("button", { name: "สร้างทีม" }));
        await waitFor(() => expect(submittedKeys).toHaveLength(2));

        expect(submittedKeys[0]).toMatch(/^new-team-/);
        expect(submittedKeys[1]).toMatch(/^new-team-/);
        expect(submittedKeys[1]).not.toBe(submittedKeys[0]);
    });

    it("keeps a Team draft and its session baseline across same-ID refreshes", () => {
        const view = render(
            <TeamFormDialog
                key="edit:11:1"
                open
                mode="edit"
                team={team}
                busy={false}
                onClose={vi.fn()}
                onSubmit={vi.fn(async () => undefined)}
            />,
        );

        fireEvent.change(screen.getByLabelText("ชื่อทีม"), { target: { value: "ชื่อที่ยังไม่บันทึก" } });
        view.rerender(
            <TeamFormDialog
                key="edit:11:1"
                open
                mode="edit"
                team={{ ...team, name: "ชื่อจากการ refresh", description: "คำอธิบายใหม่" }}
                busy={false}
                onClose={vi.fn()}
                onSubmit={vi.fn(async () => undefined)}
            />,
        );

        expect(screen.getByLabelText("ชื่อทีม")).toHaveValue("ชื่อที่ยังไม่บันทึก");
        fireEvent.click(screen.getByRole("button", { name: "ปิดแบบฟอร์มทีม" }));
        fireEvent.click(screen.getByRole("button", { name: "ทิ้งข้อมูล" }));
        expect(screen.getByLabelText("ชื่อทีม")).toHaveValue("Operations");

        view.rerender(
            <TeamFormDialog
                key="edit:11:2"
                open
                mode="edit"
                team={{ ...team, name: "ชื่อจากการ refresh", description: "คำอธิบายใหม่" }}
                busy={false}
                onClose={vi.fn()}
                onSubmit={vi.fn(async () => undefined)}
            />,
        );
        expect(screen.getByLabelText("ชื่อทีม")).toHaveValue("ชื่อจากการ refresh");
        expect(screen.getByLabelText("คำอธิบายทีม (ไม่บังคับ)")).toHaveValue("คำอธิบายใหม่");
    });

    it("keeps a TeamRole draft for the same role and snapshots a fresh role session", () => {
        const role = memberTeam.roles[0];
        if (!role) throw new Error("Authorization test fixture is incomplete");
        const view = render(
            <TeamRoleFormDialog
                key="edit-role:21:1"
                open
                mode="edit"
                role={role}
                busy={false}
                onClose={vi.fn()}
                onSubmit={vi.fn(async () => undefined)}
            />,
        );

        fireEvent.change(screen.getByLabelText("ชื่อหน้าที่"), { target: { value: "ชื่อหน้าที่ที่ยังไม่บันทึก" } });
        view.rerender(
            <TeamRoleFormDialog
                key="edit-role:21:1"
                open
                mode="edit"
                role={{ ...role, name: "ชื่อหน้าที่จากการ refresh" }}
                busy={false}
                onClose={vi.fn()}
                onSubmit={vi.fn(async () => undefined)}
            />,
        );
        expect(screen.getByLabelText("ชื่อหน้าที่")).toHaveValue("ชื่อหน้าที่ที่ยังไม่บันทึก");

        view.rerender(
            <TeamRoleFormDialog
                key="edit-role:21:2"
                open
                mode="edit"
                role={{ ...role, name: "ชื่อหน้าที่จากการ refresh" }}
                busy={false}
                onClose={vi.fn()}
                onSubmit={vi.fn(async () => undefined)}
            />,
        );
        expect(screen.getByLabelText("ชื่อหน้าที่")).toHaveValue("ชื่อหน้าที่จากการ refresh");
    });

    it("generates a fresh technical key for each new TeamRole create session", async () => {
        const submittedKeys: string[] = [];
        const onSubmit = vi.fn(async (input: { readonly key?: string; readonly name: string }) => {
            if (input.key) submittedKeys.push(input.key);
        });
        const view = render(
            <TeamRoleFormDialog
                key="create-role:1"
                open
                mode="create"
                busy={false}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );

        fireEvent.change(screen.getByLabelText("ชื่อหน้าที่"), { target: { value: "หน้าที่แรก" } });
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มหน้าที่" }));
        await waitFor(() => expect(submittedKeys).toHaveLength(1));

        view.rerender(
            <TeamRoleFormDialog
                key="closed-role"
                open={false}
                mode="create"
                busy={false}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );
        view.rerender(
            <TeamRoleFormDialog
                key="create-role:2"
                open
                mode="create"
                busy={false}
                onClose={vi.fn()}
                onSubmit={onSubmit}
            />,
        );
        fireEvent.change(screen.getByLabelText("ชื่อหน้าที่"), { target: { value: "หน้าที่สอง" } });
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มหน้าที่" }));
        await waitFor(() => expect(submittedKeys).toHaveLength(2));

        expect(submittedKeys[0]).toMatch(/^new-role-/);
        expect(submittedKeys[1]).toMatch(/^new-role-/);
        expect(submittedKeys[1]).not.toBe(submittedKeys[0]);
    });

    it("keeps technical Team keys out of the metadata editor", () => {
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

        expect(screen.queryByLabelText("รหัสทางเทคนิค")).not.toBeInTheDocument();
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

        expect(screen.queryByRole("radio", { name: /ภายในทีมนี้/ })).not.toBeInTheDocument();
        expect(screen.getByRole("radio", { name: /ทั้งหมด/ })).toBeChecked();

        fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบการเปลี่ยนแปลง" }));
        expect(screen.getByText("ตรวจสอบสิ่งที่จะเปลี่ยน")).toBeInTheDocument();
        expect(screen.getByText(/หลังบันทึก ระบบจะคำนวณสิทธิ์ที่ใช้งานได้ใหม่ และโหลดข้อมูลล่าสุดให้อัตโนมัติ/)).toBeInTheDocument();
        expect(screen.queryByText(/server/i)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันเพิ่มสิทธิ์" }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({
            capabilityKey: "employee.read",
            scope: "ALL",
        }));
    });

    it("keeps Add Member state in one parent-owned session and clears it for the next session", async () => {
        const queryChanges: string[] = [];
        const onSubmit = vi.fn(async () => undefined);
        render(
            <AddMemberSessionHarness
                onQueryChange={(query) => queryChanges.push(query)}
                onSubmit={onSubmit}
            />,
        );

        fireEvent.click(screen.getByText("เปิด Add Member"));
        fireEvent.change(screen.getByLabelText("ค้นหาผู้ใช้"), { target: { value: "som" } });
        fireEvent.click(screen.getByRole("button", { name: /สมชาย ใจดี/ }));
        fireEvent.change(screen.getByLabelText("หน้าที่ในทีม (ไม่บังคับ)"), { target: { value: "21" } });
        fireEvent.click(screen.getByText("parent rerender"));

        expect(screen.getByLabelText("ค้นหาผู้ใช้")).toHaveValue("som");
        expect(screen.getByText("เลือก สมชาย ใจดี")).toBeInTheDocument();
        expect(screen.getByLabelText("หน้าที่ในทีม (ไม่บังคับ)")).toHaveValue("21");

        fireEvent.click(screen.getByText("ปิด Add Member"));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        fireEvent.click(screen.getByText("เปิด Add Member"));

        expect(screen.getByLabelText("ค้นหาผู้ใช้")).toHaveValue("");
        expect(screen.getByLabelText("หน้าที่ในทีม (ไม่บังคับ)")).toHaveValue("");
        expect(screen.queryByText("เลือก สมชาย ใจดี")).not.toBeInTheDocument();
        expect(screen.getByText("พิมพ์คำค้นเพื่อค้นหาผู้ใช้ที่ต้องการ")).toBeInTheDocument();
        expect(queryChanges).toContain("");

        fireEvent.change(screen.getByLabelText("ค้นหาผู้ใช้"), { target: { value: "som" } });
        fireEvent.click(screen.getByRole("button", { name: /สมชาย ใจดี/ }));
        fireEvent.change(screen.getByLabelText("หน้าที่ในทีม (ไม่บังคับ)"), { target: { value: "21" } });
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มสมาชิก" }));

        await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ userId: 7, teamRoleId: 21 }));
    });

    it("preserves a Grant wizard during rerenders and starts a new source session clean", () => {
        render(<GrantSessionHarness onSubmit={vi.fn(async () => undefined)} />);

        fireEvent.click(screen.getByText("เปิด Grant"));
        fireEvent.change(screen.getByLabelText("ค้นหาสิทธิ์"), { target: { value: "พนักงาน" } });
        const capabilityButton = screen.getByRole("button", { name: /ดูข้อมูลพนักงาน/ });
        fireEvent.click(capabilityButton);
        fireEvent.click(screen.getByRole("radio", { name: /ทั้งหมด/ }));
        fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบการเปลี่ยนแปลง" }));
        expect(screen.getByText("ตรวจสอบสิ่งที่จะเปลี่ยน")).toBeInTheDocument();

        fireEvent.click(screen.getByText("parent grant rerender"));
        fireEvent.click(screen.getByRole("button", { name: "ย้อนกลับ" }));
        expect(screen.getByLabelText("ค้นหาสิทธิ์")).toHaveValue("พนักงาน");
        expect(screen.getByRole("button", { name: /ดูข้อมูลพนักงาน/ })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("radio", { name: /ทั้งหมด/ })).toBeChecked();

        fireEvent.click(screen.getByText("ปิด Grant"));
        fireEvent.click(screen.getByText("เปิด Grant"));
        expect(screen.getByLabelText("ค้นหาสิทธิ์")).toHaveValue("");
        expect(screen.getByRole("button", { name: "ตรวจสอบการเปลี่ยนแปลง" })).toBeInTheDocument();
        expect(screen.queryByText("ตรวจสอบสิ่งที่จะเปลี่ยน")).not.toBeInTheDocument();

        fireEvent.click(screen.getByText("เปลี่ยนเป็น TeamRole session"));
        expect(screen.getByLabelText("ค้นหาสิทธิ์")).toHaveValue("");
        expect(screen.getByText(/หน้าที่นี้จะได้รับสิทธิ์เพิ่มเติม/)).toBeInTheDocument();
    });

    it("keeps the permission form body scrollable while the action footer stays persistent", () => {
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
        const footer = dialog.querySelector('[data-slot="dialog-footer"]');
        const selector = screen.getByTestId("permission-selector");
        const editor = screen.getByTestId("permission-editor");

        expect(scrollArea).toBeInTheDocument();
        expect(scrollArea).toHaveClass("overflow-y-auto");
        expect(footer).toBeInTheDocument();
        expect(scrollArea?.contains(footer)).toBe(false);
        expect(selector.parentElement).toBe(editor.parentElement);
    });
});
