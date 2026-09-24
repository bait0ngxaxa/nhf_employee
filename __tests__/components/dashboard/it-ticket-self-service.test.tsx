import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ITTicketDetail, ITTicketSelfService } from "@/modules/it/client";
import type { ITPresentationCapabilities, ITRequesterTicket } from "@/modules/it/client";

const capabilities: ITPresentationCapabilities = {
    canReadOwnTickets: true,
    canReadAllTickets: false,
    canCreateOwnTickets: true,
    canCommentOwnTickets: true,
    canCommentAllTickets: false,
    canManageTickets: false,
    canReadAnalytics: false,
};

const ticket: ITRequesterTicket = {
    id: 19,
    type: "INCIDENT",
    title: "เข้าใช้งานระบบไม่ได้",
    description: "หน้าเข้าสู่ระบบแสดงข้อผิดพลาด",
    status: "IN_PROGRESS",
    createdAt: "2026-09-01T01:00:00.000Z",
    updatedAt: "2026-09-02T02:00:00.000Z",
    resolvedAt: null,
};

const fetchMock = vi.fn<typeof fetch>();
const randomUUID = vi.fn(() => "it-ticket-key-001");

function apiResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function emptyListResponse(): Response {
    return apiResponse({
        success: true,
        tickets: [],
        pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
    });
}

function createdTicketResponse(): Response {
    return apiResponse({ success: true, ticket, replayed: false }, 201);
}

async function openCreateDialog(): Promise<void> {
    await screen.findByText("ยังไม่มี Ticket");
    fireEvent.click(screen.getByRole("button", { name: "สร้าง Ticket" }));
    fireEvent.change(screen.getByLabelText("หัวข้อ"), {
        target: { value: "  ขอความช่วยเหลือระบบงาน  " },
    });
    fireEvent.change(screen.getByLabelText("รายละเอียด"), {
        target: { value: "  ระบบแจ้งข้อผิดพลาดเมื่อเข้าสู่ระบบ  " },
    });
}

beforeEach(() => {
    fetchMock.mockReset();
    randomUUID.mockReset();
    randomUUID.mockReturnValue("it-ticket-key-001");
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("IT Ticket self-service presentation", () => {
    it("shows a skeleton while the bounded requester list is loading", async () => {
        fetchMock.mockImplementation(() => new Promise<Response>(() => undefined));

        render(<ITTicketSelfService capabilities={capabilities} />);

        expect(await screen.findByRole("status", { name: "กำลังโหลด Ticket" }))
            .toBeInTheDocument();
    });

    it("explains the empty state and offers creation when authorized", async () => {
        fetchMock.mockResolvedValue(emptyListResponse());

        render(<ITTicketSelfService capabilities={capabilities} />);

        expect(await screen.findByText("ยังไม่มี Ticket")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "สร้าง Ticket แรก" })).toBeInTheDocument();
    });

    it("shows list failures with a retry action", async () => {
        fetchMock
            .mockResolvedValueOnce(apiResponse({ success: false }, 500))
            .mockResolvedValueOnce(emptyListResponse());

        render(<ITTicketSelfService capabilities={capabilities} />);

        expect(await screen.findByRole("alert")).toHaveTextContent("ไม่สามารถเชื่อมต่อระบบได้");
        fireEvent.click(screen.getByRole("button", { name: "ลองอีกครั้ง" }));
        expect(await screen.findByText("ยังไม่มี Ticket")).toBeInTheDocument();
    });

    it("lists Ticket identity, type, current status, timestamps, and a detail link", async () => {
        fetchMock.mockResolvedValue(apiResponse({
            success: true,
            tickets: [ticket],
            pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }));

        render(<ITTicketSelfService capabilities={capabilities} />);

        expect(await screen.findByText("#19 · เข้าใช้งานระบบไม่ได้")).toBeInTheDocument();
        expect(screen.getByText("กำลังดำเนินการ")).toBeInTheDocument();
        expect(screen.getByRole("link", { name: /เข้าใช้งานระบบไม่ได้/ }))
            .toHaveAttribute("href", "/dashboard/it/19");
    });

    it("disables duplicate submissions while the create request is pending", async () => {
        const pendingPost: { resolve: ((response: Response) => void) | null } = { resolve: null };
        fetchMock.mockImplementation((_input, init) => init?.method === "POST"
            ? new Promise<Response>((resolve) => { pendingPost.resolve = resolve; })
            : Promise.resolve(emptyListResponse()));

        render(<ITTicketSelfService capabilities={capabilities} />);
        await openCreateDialog();
        const form = screen.getByRole("button", { name: "ส่ง Ticket" }).closest("form");
        expect(form).not.toBeNull();
        fireEvent.submit(form as HTMLFormElement);
        fireEvent.submit(form as HTMLFormElement);

        await screen.findByRole("button", { name: "กำลังส่ง…" });
        const postCalls = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");
        expect(postCalls).toHaveLength(1);

        pendingPost.resolve?.(createdTicketResponse());
        expect(await screen.findByText("ส่ง Ticket #19 เรียบร้อยแล้ว")).toBeInTheDocument();
    });

    it("reuses the logical submission key after an uncertain network result", async () => {
        fetchMock
            .mockResolvedValueOnce(emptyListResponse())
            .mockRejectedValueOnce(new Error("network result uncertain"))
            .mockResolvedValueOnce(createdTicketResponse())
            .mockResolvedValue(emptyListResponse());

        render(<ITTicketSelfService capabilities={capabilities} />);
        await openCreateDialog();
        fireEvent.click(screen.getByRole("button", { name: "ส่ง Ticket" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("network result uncertain");
        fireEvent.click(screen.getByRole("button", { name: "ส่ง Ticket" }));

        expect(await screen.findByText("ส่ง Ticket #19 เรียบร้อยแล้ว")).toBeInTheDocument();
        const postCalls = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");
        expect(postCalls).toHaveLength(2);
        const firstHeaders = postCalls[0][1]?.headers as Record<string, string>;
        const secondHeaders = postCalls[1][1]?.headers as Record<string, string>;
        expect(firstHeaders["Idempotency-Key"]).toBe("it-ticket-key-001");
        expect(secondHeaders["Idempotency-Key"]).toBe(firstHeaders["Idempotency-Key"]);
        expect(randomUUID).toHaveBeenCalledTimes(1);
        expect(JSON.parse(String(postCalls[0][1]?.body))).toEqual({
            type: "INCIDENT",
            title: "ขอความช่วยเหลือระบบงาน",
            description: "ระบบแจ้งข้อผิดพลาดเมื่อเข้าสู่ระบบ",
        });
    });
});

describe("IT Ticket requester detail", () => {
    it.each([
        ["OPEN", "รับเรื่องแล้ว"],
        ["IN_PROGRESS", "กำลังดำเนินการ"],
        ["WAITING_REQUESTER", "รอข้อมูลเพิ่มเติม"],
        ["RESOLVED", "แก้ไขแล้ว"],
        ["CLOSED", "ปิดงานแล้ว"],
        ["CANCELLED", "ยกเลิกแล้ว"],
    ] as const)("renders %s status as %s", async (status, label) => {
        fetchMock.mockResolvedValue(apiResponse({
            success: true,
            ticket: { ...ticket, status },
        }));

        render(<ITTicketDetail ticketId={19} />);

        expect(await screen.findByRole("heading", { name: "Ticket #19" })).toBeInTheDocument();
        expect(screen.getByText(label)).toBeInTheDocument();
        expect(screen.getByText("หน้าเข้าสู่ระบบแสดงข้อผิดพลาด")).toBeInTheDocument();
    });

    it("shows a non-leaking not-found error for a direct foreign Ticket URL", async () => {
        fetchMock.mockResolvedValue(apiResponse({ error: "Not found" }, 404));

        render(<ITTicketDetail ticketId={900} />);

        expect(await screen.findByRole("alert"))
            .toHaveTextContent("ไม่พบ Ticket หรือคุณไม่มีสิทธิ์ดูรายการนี้");
        expect(fetchMock).toHaveBeenCalledWith("/api/it/tickets/900", expect.anything());
    });
});
