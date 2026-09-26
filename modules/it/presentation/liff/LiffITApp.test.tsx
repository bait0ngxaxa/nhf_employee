import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    fetchTickets: vi.fn(),
    fetchTicket: vi.fn(),
    createTicket: vi.fn(),
    fetchTimeline: vi.fn(),
    postComment: vi.fn(),
    fetchAttachment: vi.fn(),
}));

vi.mock("./api", () => ({
    fetchLiffITTickets: mocks.fetchTickets,
    fetchLiffITTicket: mocks.fetchTicket,
    createLiffITTicket: mocks.createTicket,
    fetchLiffITTicketTimeline: mocks.fetchTimeline,
    postLiffITTicketComment: mocks.postComment,
    fetchLiffITAttachment: mocks.fetchAttachment,
}));

import { LiffApiError } from "@/modules/line/client";
import { LiffITApp } from "./LiffITApp";

const TICKET = {
    id: 42,
    type: "INCIDENT" as const,
    title: "เข้าใช้งานระบบไม่ได้",
    description: "พบหน้าจอแจ้งข้อผิดพลาด",
    status: "WAITING_REQUESTER" as const,
    createdAt: "2026-09-25T02:00:00.000Z",
    updatedAt: "2026-09-26T03:00:00.000Z",
    resolvedAt: null,
};

const LIST = {
    tickets: [TICKET],
    pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
};

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (reason: unknown) => void;
    const promise = new Promise<T>((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

async function openCreateForm(): Promise<void> {
    await screen.findByRole("heading", { name: "IT Ticket ของฉัน" });
    fireEvent.click(screen.getByRole("button", { name: "สร้าง Ticket" }));
    await screen.findByRole("heading", { name: "สร้าง Ticket" });
}

function fillCreateForm(title = "ขอความช่วยเหลือเรื่องระบบ"): void {
    fireEvent.change(screen.getByRole("combobox", { name: "ประเภทคำขอ" }), {
        target: { value: "SERVICE_REQUEST" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "หัวข้อ" }), {
        target: { value: title },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "รายละเอียด" }), {
        target: { value: "โปรดช่วยตรวจสอบการใช้งาน" },
    });
}

describe("LiffITApp requester experience", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.fetchTickets.mockResolvedValue(LIST);
        mocks.fetchTicket.mockResolvedValue(TICKET);
        mocks.createTicket.mockResolvedValue(TICKET);
        mocks.fetchTimeline.mockResolvedValue({ items: [], olderCursor: null, hasMore: false });
        mocks.postComment.mockResolvedValue(undefined);
        mocks.fetchAttachment.mockResolvedValue(new Blob(["image"], { type: "image/webp" }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("shows a loading state and then only requester ticket fields", async () => {
        const response = deferred<typeof LIST>();
        mocks.fetchTickets.mockReturnValueOnce(response.promise);
        render(<LiffITApp />);

        expect(screen.getByRole("status", { name: "กำลังโหลดรายการ Ticket" })).toBeInTheDocument();
        await act(async () => response.resolve(LIST));

        expect(await screen.findByRole("heading", { name: TICKET.title })).toBeInTheDocument();
        expect(screen.getByText("ปัญหาที่พบ")).toBeInTheDocument();
        expect(screen.getByText("รอข้อมูลจากผู้แจ้ง")).toBeInTheDocument();
        expect(screen.getByText(/สร้างเมื่อ/)).toBeInTheDocument();
        expect(screen.getByText(/ปรับปรุงล่าสุด/)).toBeInTheDocument();
        expect(screen.queryByText(/ผู้รับผิดชอบ|หมวดหมู่ภายใน|วิเคราะห์/)).not.toBeInTheDocument();
        expect(mocks.fetchTickets).toHaveBeenCalledTimes(1);
    });

    it("shows a useful error with retry and an empty state for a successful empty list", async () => {
        mocks.fetchTickets.mockRejectedValueOnce(new LiffApiError("ระบบ Ticket ขัดข้องชั่วคราว กรุณาลองอีกครั้ง", 503));
        const view = render(<LiffITApp />);

        expect(await screen.findByRole("alert")).toHaveTextContent("ระบบ Ticket ขัดข้องชั่วคราว");
        mocks.fetchTickets.mockResolvedValueOnce({
            tickets: [],
            pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
        });
        fireEvent.click(screen.getByRole("button", { name: "โหลดรายการอีกครั้ง" }));
        expect(await screen.findByText("ยังไม่มี Ticket")).toBeInTheDocument();
        expect(view.container).toHaveTextContent("เมื่อส่งคำขอแล้ว รายการและสถานะจะแสดงที่นี่");
    });

    it("pages through the existing requester list pagination", async () => {
        const nextTicket = { ...TICKET, id: 43, title: "ขอใช้งานโปรแกรม" };
        mocks.fetchTickets
            .mockResolvedValueOnce({
                ...LIST,
                pagination: { page: 1, limit: 10, total: 11, totalPages: 2 },
            })
            .mockResolvedValueOnce({
                tickets: [nextTicket],
                pagination: { page: 2, limit: 10, total: 11, totalPages: 2 },
            });
        render(<LiffITApp />);
        await screen.findByRole("heading", { name: TICKET.title });
        fireEvent.click(screen.getByRole("button", { name: "ถัดไป" }));

        expect(await screen.findByRole("heading", { name: nextTicket.title })).toBeInTheDocument();
        expect(screen.getByText("หน้า 2 จาก 2")).toBeInTheDocument();
        expect(mocks.fetchTickets).toHaveBeenNthCalledWith(1, 1, expect.any(AbortSignal));
        expect(mocks.fetchTickets).toHaveBeenNthCalledWith(2, 2, expect.any(AbortSignal));
    });

    it("preserves a create idempotency key after a failed attempt and links to the new Ticket", async () => {
        let keyIndex = 0;
        vi.stubGlobal("crypto", { randomUUID: () => `create-key-${++keyIndex}` } as unknown as Crypto);
        mocks.createTicket
            .mockRejectedValueOnce(new LiffApiError("ระบบ Ticket ขัดข้องชั่วคราว กรุณาลองอีกครั้ง", 503))
            .mockResolvedValueOnce({ ...TICKET, id: 73, title: "ขอความช่วยเหลือเรื่องระบบ" });
        render(<LiffITApp />);
        await openCreateForm();
        fillCreateForm();

        fireEvent.click(screen.getByRole("button", { name: "ส่ง Ticket" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("ระบบ Ticket ขัดข้องชั่วคราว");
        fireEvent.click(screen.getByRole("button", { name: "ส่ง Ticket" }));

        const successMessage = await screen.findByRole("status");
        expect(successMessage).toHaveTextContent("ส่ง Ticket #73 เรียบร้อยแล้ว");
        expect(mocks.createTicket).toHaveBeenCalledTimes(2);
        expect(mocks.createTicket.mock.calls[0]?.[1]).toBe("create-key-1");
        expect(mocks.createTicket.mock.calls[1]?.[1]).toBe("create-key-1");
        expect(mocks.createTicket.mock.calls[0]?.[0]).toEqual({
            type: "SERVICE_REQUEST",
            title: "ขอความช่วยเหลือเรื่องระบบ",
            description: "โปรดช่วยตรวจสอบการใช้งาน",
        });
        expect(screen.getByRole("link", { name: "เปิดรายละเอียดและการสนทนา" })).toHaveAttribute("href", "/liff/it/73");
        expect(screen.getByRole("heading", { name: "ขอความช่วยเหลือเรื่องระบบ" })).toBeInTheDocument();
    });

    it("creates a Ticket when crypto.randomUUID is unavailable", async () => {
        vi.stubGlobal("crypto", { randomUUID: undefined } as unknown as Crypto);
        render(<LiffITApp />);
        await openCreateForm();
        fillCreateForm();

        fireEvent.click(screen.getByRole("button", { name: "ส่ง Ticket" }));

        await waitFor(() => expect(mocks.createTicket).toHaveBeenCalledTimes(1));
        expect(mocks.createTicket.mock.calls[0]?.[1]).toMatch(/^idem_\d+_[a-z0-9]+$/);
    });

    it("creates a new idempotency attempt when the logical create payload changes", async () => {
        let keyIndex = 0;
        vi.stubGlobal("crypto", { randomUUID: () => `changed-key-${++keyIndex}` } as unknown as Crypto);
        mocks.createTicket
            .mockRejectedValueOnce(new LiffApiError("ลองใหม่", 503))
            .mockRejectedValueOnce(new LiffApiError("ลองใหม่", 503));
        render(<LiffITApp />);
        await openCreateForm();
        fillCreateForm("หัวข้อเดิม");
        fireEvent.click(screen.getByRole("button", { name: "ส่ง Ticket" }));
        await screen.findByRole("alert");

        fireEvent.change(screen.getByRole("textbox", { name: "หัวข้อ" }), {
            target: { value: "หัวข้อใหม่" },
        });
        fireEvent.click(screen.getByRole("button", { name: "ส่ง Ticket" }));
        await waitFor(() => expect(mocks.createTicket).toHaveBeenCalledTimes(2));
        expect(mocks.createTicket.mock.calls[0]?.[1]).toBe("changed-key-1");
        expect(mocks.createTicket.mock.calls[1]?.[1]).toBe("changed-key-2");
    });

    it("prevents double submit and updates the visible list without a page reload", async () => {
        let keyIndex = 0;
        vi.stubGlobal("crypto", { randomUUID: () => `double-key-${++keyIndex}` } as unknown as Crypto);
        const pending = deferred<typeof TICKET>();
        mocks.createTicket.mockReturnValueOnce(pending.promise);
        render(<LiffITApp />);
        await openCreateForm();
        fillCreateForm();
        const form = screen.getByRole("button", { name: "ส่ง Ticket" }).closest("form");
        if (!(form instanceof HTMLFormElement)) throw new Error("Expected Ticket form");

        fireEvent.submit(form);
        fireEvent.submit(form);
        expect(mocks.createTicket).toHaveBeenCalledTimes(1);
        await act(async () => pending.resolve({ ...TICKET, id: 91, title: "ขอความช่วยเหลือเรื่องระบบ" }));
        expect(await screen.findByRole("heading", { name: "ขอความช่วยเหลือเรื่องระบบ" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "เปิดรายละเอียดและการสนทนา" })).toHaveAttribute("href", "/liff/it/91");
        expect(mocks.fetchTickets).toHaveBeenCalledTimes(1);
    });

    it("loads requester detail and conversation, keeps WAITING_REQUESTER unchanged after a reply", async () => {
        mocks.fetchTicket.mockResolvedValue(TICKET);
        mocks.fetchTimeline.mockResolvedValue({
            items: [{
                type: "COMMENT",
                id: "operator-note",
                createdAt: "2026-09-25T04:00:00.000Z",
                authorDisplayName: "เจ้าหน้าที่",
                authorSide: "OPERATOR",
                body: "ขอรายละเอียดเพิ่มเติม",
                attachments: [],
            }],
            olderCursor: null,
            hasMore: false,
        });
        mocks.postComment.mockResolvedValue({
            comment: {
                type: "COMMENT",
                id: "requester-note",
                createdAt: "2026-09-26T04:00:00.000Z",
                authorDisplayName: "พนักงาน",
                authorSide: "REQUESTER",
                body: "ยังพบปัญหา",
                attachments: [],
            },
            replayed: false,
        });
        let keyIndex = 0;
        vi.stubGlobal("crypto", { randomUUID: () => `comment-key-${++keyIndex}`, subtle: { digest: vi.fn() } } as unknown as Crypto);
        render(<LiffITApp ticketId="42" />);

        expect(await screen.findByRole("heading", { name: TICKET.title })).toBeInTheDocument();
        expect(screen.getByText("พบหน้าจอแจ้งข้อผิดพลาด")).toBeInTheDocument();
        expect(screen.getByText("สร้างเมื่อ")).toBeInTheDocument();
        expect(screen.getByText("ปรับปรุงล่าสุด")).toBeInTheDocument();
        expect(screen.queryByText("ดำเนินการเสร็จสิ้น")).not.toBeInTheDocument();
        expect(await screen.findByText("ขอรายละเอียดเพิ่มเติม")).toBeInTheDocument();
        expect(screen.getByText("เจ้าหน้าที่ IT")).toBeInTheDocument();
        expect(screen.getByText("ขอรายละเอียดเพิ่มเติม")).toBeInTheDocument();
        expect(screen.getByText("การตอบกลับของคุณจะไม่เปลี่ยนสถานะ Ticket โดยอัตโนมัติ")).toBeInTheDocument();

        fireEvent.change(screen.getByRole("textbox", { name: "ตอบกลับ" }), {
            target: { value: "ยังพบปัญหา" },
        });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        expect(await screen.findByText("ส่งข้อความเรียบร้อยแล้ว")).toBeInTheDocument();
        expect(screen.getByText("รอข้อมูลจากผู้แจ้ง")).toBeInTheDocument();
        expect(screen.getByText("ยังพบปัญหา")).toBeInTheDocument();
        expect(mocks.fetchTicket).toHaveBeenCalledTimes(1);
    });

    it("shows the resolved timestamp and keeps a resolved conversation read-only", async () => {
        mocks.fetchTicket.mockResolvedValue({
            ...TICKET,
            status: "RESOLVED",
            resolvedAt: "2026-09-26T04:00:00.000Z",
        });
        render(<LiffITApp ticketId="42" />);

        expect(await screen.findByText("ดำเนินการเสร็จสิ้น")).toBeInTheDocument();
        expect(screen.getByText("แก้ไขแล้ว")).toBeInTheDocument();
        expect(screen.queryByRole("textbox", { name: "ตอบกลับ" })).not.toBeInTheDocument();
    });

    it("protects the visible detail from a stale response for a different Ticket", async () => {
        const first = deferred<typeof TICKET>();
        const second = deferred<typeof TICKET>();
        mocks.fetchTicket.mockImplementation((id: number) => id === 1 ? first.promise : second.promise);
        const view = render(<LiffITApp ticketId="1" />);
        view.rerender(<LiffITApp ticketId="2" />);

        await act(async () => second.resolve({ ...TICKET, id: 2, title: "รายการล่าสุด" }));
        expect(await screen.findByRole("heading", { name: "รายการล่าสุด" })).toBeInTheDocument();
        await act(async () => first.resolve({ ...TICKET, id: 1, title: "รายการเก่า" }));
        expect(screen.getByRole("heading", { name: "รายการล่าสุด" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "รายการเก่า" })).not.toBeInTheDocument();
    });
});
