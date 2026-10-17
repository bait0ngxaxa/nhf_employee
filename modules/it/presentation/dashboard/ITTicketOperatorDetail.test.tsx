import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { API_ROUTES } from "@/lib/ssot/routes";
import type {
    ITOperatorReferenceData,
    ITOperatorTicketDetail,
    ITPresentationCapabilities,
} from "../../contracts";
import type { ITTicketStatus } from "@prisma/client";
import { ITTicketOperatorDetail } from "./ITTicketOperatorDetail";

const fetchMock = vi.fn<(
    input: RequestInfo | URL,
    init?: RequestInit,
) => Promise<Response>>();

vi.mock("sonner", () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

vi.mock("./ITTicketConversation", () => ({
    ITTicketConversation: () => null,
}));

vi.mock("../ITTicketActivity", () => ({
    ITTicketActivity: () => null,
}));

vi.mock("./ITTicketInitialAttachments", () => ({
    ITTicketInitialAttachments: () => null,
}));

const CAPABILITIES: ITPresentationCapabilities = {
    canReadOwnTickets: true,
    canReadAllTickets: true,
    canCreateOwnTickets: true,
    canCommentOwnTickets: true,
    canCommentAllTickets: true,
    canManageTickets: true,
    canReadAnalytics: true,
};

const REFERENCE_DATA: ITOperatorReferenceData = {
    categories: [],
    assignableOperators: [],
};

function buildTicket(
    status: ITTicketStatus,
    version = 4,
    id = 19,
): ITOperatorTicketDetail {
    return {
        id,
        type: "INCIDENT",
        title: "เครื่องพิมพ์ใช้งานไม่ได้",
        description: "เครื่องพิมพ์ที่สำนักงานไม่ตอบสนอง",
        status,
        requester: {
            userId: 7,
            displayName: "ผู้แจ้ง ทดสอบ",
            departmentId: 3,
            departmentNameSnapshot: "ฝ่ายทดสอบ",
        },
        assignee: null,
        category: null,
        version,
        createdAt: "2026-10-01T03:00:00.000Z",
        updatedAt: "2026-10-01T03:30:00.000Z",
        resolvedAt: status === "RESOLVED" ? "2026-10-01T03:30:00.000Z" : null,
        initialAttachments: [],
    };
}

function jsonResponse(payload: unknown, status = 200): Response {
    return {
        ok: status >= 200 && status < 300,
        status,
        json: async () => payload,
    } as Response;
}

function mutationSnapshot(ticket: ITOperatorTicketDetail) {
    return {
        success: true,
        changed: true,
        ticket: {
            id: ticket.id,
            version: ticket.version,
            status: ticket.status,
            assignedToUserId: null,
            categoryId: null,
            updatedAt: ticket.updatedAt,
        },
    };
}

function renderTicket(initialTicket: ITOperatorTicketDetail) {
    let currentTicket = initialTicket;
    const patchResponses: Response[] = [];
    let pendingPatchResponse: Promise<Response> | null = null;

    fetchMock.mockImplementation(async (input, init) => {
        const url = String(input);
        if (init?.method === "PATCH") {
            if (pendingPatchResponse) {
                const response = pendingPatchResponse;
                pendingPatchResponse = null;
                return response;
            }
            const queuedResponse = patchResponses.shift();
            if (queuedResponse) return queuedResponse;

            const body = JSON.parse(String(init.body)) as {
                targetStatus: ITTicketStatus;
                expectedVersion: number;
            };
            currentTicket = {
                ...currentTicket,
                status: body.targetStatus,
                version: body.expectedVersion + 1,
                updatedAt: "2026-10-01T04:00:00.000Z",
                resolvedAt: body.targetStatus === "RESOLVED"
                    ? "2026-10-01T04:00:00.000Z"
                    : currentTicket.resolvedAt,
            };
            return jsonResponse(mutationSnapshot(currentTicket));
        }

        if (url === API_ROUTES.itOperatorTickets.reference) {
            return jsonResponse({ success: true, ...REFERENCE_DATA });
        }
        if (url === API_ROUTES.itOperatorTickets.byId(initialTicket.id)) {
            return jsonResponse({ success: true, ticket: currentTicket });
        }
        return jsonResponse({ error: "Not found" }, 404);
    });

    const view = render(
        <ITTicketOperatorDetail
            ticketId={initialTicket.id}
            capabilities={CAPABILITIES}
        />,
    );

    return {
        ...view,
        enqueuePatchResponse(response: Response): void {
            patchResponses.push(response);
        },
        setCurrentTicket(ticket: ITOperatorTicketDetail): void {
            currentTicket = ticket;
        },
        setPendingPatchResponse(response: Promise<Response>): void {
            pendingPatchResponse = response;
        },
    };
}

function getPatchCalls() {
    return fetchMock.mock.calls.filter(([, init]) => init?.method === "PATCH");
}

describe("ITTicketOperatorDetail terminal transition confirmation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchMock.mockReset();
        vi.stubGlobal("fetch", fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("keeps non-terminal transitions immediate", async () => {
        renderTicket(buildTicket("OPEN"));
        await screen.findByText(/Ticket #19/);

        fireEvent.click(screen.getByRole("button", { name: "เริ่มดำเนินการ" }));

        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        await waitFor(() => expect(getPatchCalls()).toHaveLength(1));
        expect(JSON.parse(String(getPatchCalls()[0]?.[1]?.body))).toMatchObject({
            targetStatus: "IN_PROGRESS",
            expectedVersion: 4,
        });
        await waitFor(() => {
            expect(screen.getByText("กำลังดำเนินการ", { selector: "span" }))
                .toBeInTheDocument();
        });
    });

    it.each(["OPEN", "IN_PROGRESS", "WAITING_REQUESTER"] as const)(
        "requires cancellation confirmation from %s",
        async (status) => {
            renderTicket(buildTicket(status));
            await screen.findByText(/Ticket #19/);

            const trigger = screen.getByRole("button", { name: "ยกเลิก" });
            fireEvent.click(trigger);
            const dialog = await screen.findByRole("dialog");

            expect(within(dialog).getByRole("heading", { name: "ยืนยันยกเลิก Ticket #19" }))
                .toBeInTheDocument();
            expect(within(dialog).getByText("ผู้แจ้ง ทดสอบ")).toBeInTheDocument();
            expect(within(dialog).getByText("ยกเลิกแล้ว")).toBeInTheDocument();
            expect(within(dialog).getByText(/การยกเลิกจะบันทึกว่าไม่ดำเนินการ/))
                .toBeInTheDocument();
            await waitFor(() => {
                expect(within(dialog).getByRole("button", { name: "กลับไปตรวจสอบ" }))
                    .toHaveFocus();
            });
            expect(getPatchCalls()).toHaveLength(0);

            fireEvent.click(within(dialog).getByRole("button", { name: "กลับไปตรวจสอบ" }));
            await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
            expect(trigger).toHaveFocus();
            expect(getPatchCalls()).toHaveLength(0);
        },
    );

    it("requires close confirmation, cancels on Escape, and refreshes after success", async () => {
        renderTicket(buildTicket("RESOLVED"));
        await screen.findByText(/Ticket #19/);

        fireEvent.click(screen.getByRole("button", { name: "ปิดงาน" }));
        let dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByRole("heading", { name: "ยืนยันปิด Ticket #19" }))
            .toBeInTheDocument();
        expect(within(dialog).getByText("ปิดงานแล้ว")).toBeInTheDocument();
        expect(within(dialog).getByText(/การปิด Ticket จะบันทึกว่างานเสร็จสิ้น/))
            .toBeInTheDocument();
        expect(getPatchCalls()).toHaveLength(0);

        fireEvent.keyDown(document, { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(getPatchCalls()).toHaveLength(0);

        fireEvent.click(screen.getByRole("button", { name: "ปิดงาน" }));
        dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันปิดงาน" }));

        await waitFor(() => {
            expect(getPatchCalls()).toHaveLength(1);
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
            expect(screen.getByText("ปิดงานแล้ว", { selector: "span" })).toBeInTheDocument();
        });
        expect(JSON.parse(String(getPatchCalls()[0]?.[1]?.body))).toMatchObject({
            targetStatus: "CLOSED",
            expectedVersion: 4,
        });
        expect(toast.success).toHaveBeenCalledWith("ปิด Ticket เรียบร้อยแล้ว");
    });

    it("prevents duplicate submissions and disables conflicting actions while pending", async () => {
        let resolvePatch: ((response: Response) => void) | undefined;
        const pendingResponse = new Promise<Response>((resolve) => {
            resolvePatch = resolve;
        });
        const ticket = buildTicket("RESOLVED");
        const rendered = renderTicket(ticket);
        rendered.setPendingPatchResponse(pendingResponse);
        await screen.findByText(/Ticket #19/);

        fireEvent.click(screen.getByRole("button", { name: "ปิดงาน" }));
        const dialog = await screen.findByRole("dialog");
        const confirm = within(dialog).getByRole("button", { name: "ยืนยันปิดงาน" });
        fireEvent.click(confirm);

        const pendingConfirm = within(dialog).getByRole("button", { name: "กำลังดำเนินการ…" });
        expect(pendingConfirm).toBeDisabled();
        expect(screen.getByRole("button", { name: "เปิดงานอีกครั้ง", hidden: true }))
            .toBeDisabled();
        fireEvent.click(pendingConfirm);
        expect(getPatchCalls()).toHaveLength(1);

        const updatedTicket = buildTicket("CLOSED", 5);
        rendered.setCurrentTicket(updatedTicket);
        resolvePatch?.(jsonResponse(mutationSnapshot(updatedTicket)));

        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(getPatchCalls()).toHaveLength(1);
    });

    it("requires review of fresh data after a version conflict before another attempt", async () => {
        const rendered = renderTicket(buildTicket("OPEN"));
        await screen.findByText(/Ticket #19/);

        rendered.setCurrentTicket(buildTicket("IN_PROGRESS", 5));
        rendered.enqueuePatchResponse(jsonResponse({
            success: false,
            code: "MUTATION_CONFLICT",
            reason: "STALE_VERSION",
            error: "Ticket changed",
            message: "Ticket changed",
        }, 409));

        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันยกเลิก Ticket" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Ticket นี้มีการเปลี่ยนแปลงจากผู้ใช้อื่น",
        );
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(getPatchCalls()).toHaveLength(1);
        expect(screen.getByRole("button", { name: "ยกเลิก" })).toBeDisabled();
        expect(screen.getByText("กำลังดำเนินการ", { selector: "span" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบข้อมูลล่าสุดแล้ว" }));
        expect(screen.getByRole("button", { name: "ยกเลิก" })).toBeEnabled();
        expect(getPatchCalls()).toHaveLength(1);
        expect(toast.error).toHaveBeenCalledWith(
            "Ticket มีการเปลี่ยนแปลง กรุณาตรวจสอบข้อมูลล่าสุด",
        );
    });

    it("keeps the dialog available for retry after a rejected terminal mutation", async () => {
        renderTicket(buildTicket("RESOLVED"));
        await screen.findByText(/Ticket #19/);

        fetchMock.mockImplementationOnce(async () => jsonResponse({
            success: false,
            error: "ไม่สามารถปิด Ticket นี้ได้",
            message: "ไม่สามารถปิด Ticket นี้ได้",
        }, 422));
        fireEvent.click(screen.getByRole("button", { name: "ปิดงาน" }));
        const dialog = await screen.findByRole("dialog");
        fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันปิดงาน" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("ไม่สามารถปิด Ticket นี้ได้"));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(within(dialog).getByRole("button", { name: "ยืนยันปิดงาน" })).toBeEnabled();
        expect(toast.success).not.toHaveBeenCalled();

        fireEvent.click(within(dialog).getByRole("button", { name: "ยืนยันปิดงาน" }));
        await waitFor(() => {
            expect(getPatchCalls()).toHaveLength(2);
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
        expect(toast.success).toHaveBeenCalledWith("ปิด Ticket เรียบร้อยแล้ว");
    });
});
