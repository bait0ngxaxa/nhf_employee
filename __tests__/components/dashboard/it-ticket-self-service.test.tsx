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
const ticketDetail = { ...ticket, initialAttachments: [] };

const fetchMock = vi.fn<typeof fetch>();
const randomUUID = vi.fn(() => "it-ticket-key-001");
let objectUrlSequence = 0;
const createObjectUrl = vi.fn(() => `blob:dashboard-${++objectUrlSequence}`);
const revokeObjectUrl = vi.fn();
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;

function digestSelectedFile(_algorithm: AlgorithmIdentifier, input: BufferSource): Promise<ArrayBuffer> {
    const bytes = input instanceof ArrayBuffer
        ? new Uint8Array(input)
        : new Uint8Array(input.buffer as ArrayBuffer, input.byteOffset, input.byteLength);
    const result = new Uint8Array(32);
    bytes.forEach((byte, index) => {
        const position = index % result.length;
        result[position] = ((result[position] ?? 0) + byte) % 256;
    });
    return Promise.resolve(result.buffer);
}

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

function timelineResponse(items: readonly unknown[] = [], options: {
    readonly olderCursor?: string | null;
    readonly hasMore?: boolean;
} = {}): Response {
    return apiResponse({
        success: true,
        items,
        olderCursor: options.olderCursor ?? null,
        hasMore: options.hasMore ?? false,
    });
}

function postedCommentResponse(replayed = false): Response {
    return apiResponse({
        success: true,
        replayed,
        comment: {
            type: "COMMENT",
            id: "cm-new-comment",
            createdAt: "2026-09-03T01:00:00.000Z",
            authorDisplayName: "ผู้แจ้งตัวอย่าง",
            authorSide: "REQUESTER",
            body: "ขออัปเดตผลตรวจสอบค่ะ",
            attachments: [],
        },
    }, replayed ? 200 : 201);
}

async function openCreateDialog(): Promise<void> {
    await screen.findByText("ยังไม่มี Ticket");
    fireEvent.click(screen.getByRole("button", { name: "แจ้งปัญหา / ขอความช่วยเหลือ" }));
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
    objectUrlSequence = 0;
    createObjectUrl.mockClear();
    revokeObjectUrl.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID, subtle: { digest: digestSelectedFile } } as unknown as Crypto);
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrl, writable: true });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl, writable: true });
});

afterEach(() => {
    vi.unstubAllGlobals();
    if (originalCreateObjectUrl) {
        Object.defineProperty(URL, "createObjectURL", { configurable: true, value: originalCreateObjectUrl });
    } else {
        Reflect.deleteProperty(URL, "createObjectURL");
    }
    if (originalRevokeObjectUrl) {
        Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: originalRevokeObjectUrl });
    } else {
        Reflect.deleteProperty(URL, "revokeObjectURL");
    }
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
        expect(screen.getByRole("button", { name: "แจ้งปัญหา / ขอความช่วยเหลือ" })).toBeInTheDocument();
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

    it("previews and removes selected images, then sends retained evidence as multipart", async () => {
        fetchMock.mockImplementation((_input, init) => init?.method === "POST"
            ? Promise.resolve(createdTicketResponse())
            : Promise.resolve(emptyListResponse()));

        render(<ITTicketSelfService capabilities={capabilities} />);
        await openCreateDialog();
        const firstFile = new File(["first image"], "ภาพเดิม.png", { type: "image/png" });
        fireEvent.change(screen.getByLabelText(/รูปภาพประกอบ/), {
            target: { files: [firstFile] },
        });

        expect(screen.getByRole("img", { name: "ตัวอย่างรูป ภาพเดิม.png" })).toHaveAttribute(
            "src",
            expect.stringContaining("blob:dashboard"),
        );
        fireEvent.click(screen.getByRole("button", { name: "นำรูปออก" }));
        expect(screen.queryByRole("img", { name: "ตัวอย่างรูป ภาพเดิม.png" })).not.toBeInTheDocument();
        expect(revokeObjectUrl).toHaveBeenCalledOnce();

        const selectedFile = new File(["current image"], "หน้าจอปัจจุบัน.webp", { type: "image/webp" });
        fireEvent.change(screen.getByLabelText(/รูปภาพประกอบ/), {
            target: { files: [selectedFile] },
        });
        fireEvent.click(screen.getByRole("button", { name: "ส่ง Ticket" }));

        expect(await screen.findByText("ส่ง Ticket #19 เรียบร้อยแล้ว")).toBeInTheDocument();
        const postCall = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
        const body = postCall?.[1]?.body;
        expect(body).toBeInstanceOf(FormData);
        if (!(body instanceof FormData)) throw new Error("Expected multipart create body");
        expect(body.get("attachments")).toMatchObject({
            name: "หน้าจอปัจจุบัน.webp",
            type: "image/webp",
        });
        expect(postCall?.[1]?.headers).not.toHaveProperty("Content-Type");
    });
});

describe("IT Ticket requester detail", () => {
    it("loads creation evidence for the requester detail through a private image fetch", async () => {
        const attachment = {
            id: "a".repeat(32),
            originalName: "หลักฐานหน้าจอ.png",
            contentType: "image/webp",
            sizeBytes: 1024,
            width: 24,
            height: 16,
            position: 0,
        };
        fetchMock.mockImplementation(async (input) => {
            if (String(input).includes("/attachments/")) {
                return new Response(new Blob(["private image"], { type: "image/webp" }), {
                    status: 200,
                    headers: { "Content-Type": "image/webp" },
                });
            }
            return String(input).includes("/timeline")
                ? timelineResponse()
                : apiResponse({ success: true, ticket: { ...ticketDetail, initialAttachments: [attachment] } });
        });

        const view = render(<ITTicketDetail ticketId={19} canCommentOwnTickets />);

        expect(await screen.findByRole("img", { name: "รูปภาพประกอบ: หลักฐานหน้าจอ.png" }))
            .toHaveAttribute("src", expect.stringContaining("blob:dashboard"));
        expect(screen.getByRole("region", { name: "รูปภาพประกอบ" })).toBeInTheDocument();
        view.unmount();
        expect(revokeObjectUrl).toHaveBeenCalled();
    });

    it.each([
        ["OPEN", "รับเรื่องแล้ว"],
        ["IN_PROGRESS", "กำลังดำเนินการ"],
        ["WAITING_REQUESTER", "รอข้อมูลจากผู้แจ้ง"],
        ["RESOLVED", "แก้ไขแล้ว"],
        ["CLOSED", "ปิดงานแล้ว"],
        ["CANCELLED", "ยกเลิกแล้ว"],
    ] as const)("renders %s status as %s", async (status, label) => {
        fetchMock.mockImplementation(async (input) => String(input).includes("/timeline")
            ? timelineResponse()
            : apiResponse({ success: true, ticket: { ...ticketDetail, status } }));

        render(<ITTicketDetail ticketId={19} canCommentOwnTickets />);

        expect(await screen.findByRole("heading", { name: "Ticket #19" })).toBeInTheDocument();
        expect(screen.getByText(label)).toBeInTheDocument();
        expect(screen.getByText("หน้าเข้าสู่ระบบแสดงข้อผิดพลาด")).toBeInTheDocument();
    });

    it("shows a non-leaking not-found error for a direct foreign Ticket URL", async () => {
        fetchMock.mockResolvedValue(apiResponse({ error: "Not found" }, 404));

        render(<ITTicketDetail ticketId={900} canCommentOwnTickets />);

        expect(await screen.findByRole("alert"))
            .toHaveTextContent("ไม่พบ Ticket หรือคุณไม่มีสิทธิ์ดูรายการนี้");
        expect(fetchMock).toHaveBeenCalledWith("/api/it/tickets/900", expect.anything());
    });

    it("shows timeline loading, empty, retry, and event history states", async () => {
        fetchMock.mockImplementation(async (input) => {
            if (String(input).includes("/timeline")) {
                return new Promise<Response>(() => undefined);
            }
            return apiResponse({ success: true, ticket: ticketDetail });
        });
        const { unmount } = render(<ITTicketDetail ticketId={19} canCommentOwnTickets />);
        expect(await screen.findByRole("status", { name: "กำลังโหลดประวัติ Ticket" }))
            .toBeInTheDocument();
        unmount();

        fetchMock.mockImplementation(async (input) => String(input).includes("/timeline")
            ? timelineResponse([
                { type: "CREATED", id: 1, createdAt: ticket.createdAt, actorDisplayName: "สมชาย" },
                { type: "ASSIGNED", id: 2, createdAt: ticket.updatedAt, actorDisplayName: "อารี", fromAssigneeDisplayName: null, toAssigneeDisplayName: "วิชัย" },
                { type: "UNASSIGNED", id: 3, createdAt: ticket.updatedAt, actorDisplayName: "อารี", fromAssigneeDisplayName: "วิชัย", toAssigneeDisplayName: null },
                { type: "STATUS_CHANGED", id: 4, createdAt: ticket.updatedAt, actorDisplayName: "อารี", fromStatus: "OPEN", toStatus: "IN_PROGRESS" },
                { type: "CATEGORY_CHANGED", id: 5, createdAt: ticket.updatedAt, actorDisplayName: "อารี", fromCategoryName: null, toCategoryName: "ระบบเครือข่าย" },
            ])
            : apiResponse({ success: true, ticket: ticketDetail }));
        render(<ITTicketDetail ticketId={19} canCommentOwnTickets />);
        expect(await screen.findByText("สมชาย สร้าง Ticket")).toBeInTheDocument();
        expect(screen.getByText("อารี เปลี่ยนผู้รับผิดชอบจาก ไม่มีผู้รับผิดชอบ เป็น วิชัย"))
            .toBeInTheDocument();
        expect(screen.getByText("อารี นำความรับผิดชอบของ วิชัย ออก")).toBeInTheDocument();
        expect(screen.getByText("อารี เปลี่ยนสถานะจาก รับเรื่องแล้ว เป็น กำลังดำเนินการ"))
            .toBeInTheDocument();
        expect(screen.getByText("อารี เปลี่ยนหมวดหมู่จาก ไม่จัดหมวดหมู่ เป็น ระบบเครือข่าย"))
            .toBeInTheDocument();
    });

    it("shows requester reply only for projected comment authority and commentable status", async () => {
        fetchMock.mockImplementation(async (input) => String(input).includes("/timeline")
            ? timelineResponse()
            : apiResponse({ success: true, ticket: ticketDetail }));
        const { rerender, unmount } = render(
            <ITTicketDetail ticketId={19} canCommentOwnTickets={false} />,
        );
        expect(await screen.findByText("ยังไม่มีข้อความหรือประวัติการดำเนินการ"))
            .toBeInTheDocument();
        expect(screen.queryByLabelText("ตอบกลับ")).not.toBeInTheDocument();

        rerender(<ITTicketDetail ticketId={19} canCommentOwnTickets />);
        expect(await screen.findByLabelText("ตอบกลับ")).toBeInTheDocument();

        fetchMock.mockImplementation(async (input) => String(input).includes("/timeline")
            ? timelineResponse()
            : apiResponse({ success: true, ticket: { ...ticketDetail, status: "RESOLVED" } }));
        unmount();
        render(<ITTicketDetail ticketId={19} canCommentOwnTickets />);
        expect(await screen.findByText(/สถานะ “แก้ไขแล้ว” จึงอ่านประวัติได้อย่างเดียว/))
            .toBeInTheDocument();
        expect(screen.queryByLabelText("ตอบกลับ")).not.toBeInTheDocument();
    });

    it("reuses the idempotency key after an uncertain retry of the same canonical body", async () => {
        fetchMock.mockImplementation(async (input, init) => {
            if (init?.method === "POST") {
                return fetchMock.mock.calls.filter(([, options]) => options?.method === "POST").length === 1
                    ? Promise.reject(new Error("network result uncertain"))
                    : postedCommentResponse(true);
            }
            return String(input).includes("/timeline")
                ? timelineResponse()
                : apiResponse({ success: true, ticket: { ...ticketDetail, status: "WAITING_REQUESTER" } });
        });

        render(<ITTicketDetail ticketId={19} canCommentOwnTickets />);
        await screen.findByText("ยังไม่มีข้อความหรือประวัติการดำเนินการ");
        const composer = screen.getByLabelText("ตอบกลับ");
        fireEvent.change(composer, { target: { value: "  ขออัปเดตผลตรวจสอบค่ะ  " } });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("network result uncertain");
        expect(screen.getByText("การตอบกลับจะไม่เปลี่ยนสถานะ Ticket อัตโนมัติ"))
            .toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));

        expect(await screen.findByText("ข้อความนี้ถูกส่งเรียบร้อยแล้ว")).toBeInTheDocument();
        expect(screen.getByText("ขออัปเดตผลตรวจสอบค่ะ")).toBeInTheDocument();
        expect(screen.getByText("รอข้อมูลจากผู้แจ้ง")).toBeInTheDocument();
        const postCalls = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");
        expect(postCalls).toHaveLength(2);
        expect((postCalls[0][1]?.headers as Headers).get("Idempotency-Key"))
            .toBe((postCalls[1][1]?.headers as Headers).get("Idempotency-Key"));
        expect(JSON.parse(String(postCalls[0][1]?.body))).toEqual({ body: "ขออัปเดตผลตรวจสอบค่ะ" });
    });

    it("uses a new idempotency key when the canonical body changes after uncertainty", async () => {
        randomUUID.mockReturnValueOnce("it-comment-key-a").mockReturnValueOnce("it-comment-key-b");
        fetchMock.mockImplementation(async (input, init) => {
            if (init?.method === "POST") {
                const count = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST").length;
                return count === 1
                    ? Promise.reject(new Error("network result uncertain"))
                    : postedCommentResponse();
            }
            return String(input).includes("/timeline")
                ? timelineResponse()
                : apiResponse({ success: true, ticket: ticketDetail });
        });
        render(<ITTicketDetail ticketId={19} canCommentOwnTickets />);
        await screen.findByText("ยังไม่มีข้อความหรือประวัติการดำเนินการ");
        fireEvent.change(screen.getByLabelText("ตอบกลับ"), { target: { value: "ข้อความแรก" } });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        await screen.findByRole("alert");
        fireEvent.change(screen.getByLabelText("ตอบกลับ"), { target: { value: "ข้อความใหม่" } });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));
        await screen.findByText("ส่งข้อความเรียบร้อยแล้ว");

        const postCalls = fetchMock.mock.calls.filter(([, options]) => options?.method === "POST");
        const firstKey = (postCalls[0][1]?.headers as Headers).get("Idempotency-Key");
        const secondKey = (postCalls[1][1]?.headers as Headers).get("Idempotency-Key");
        expect(firstKey).toBe("it-comment-key-a");
        expect(secondKey).toBe("it-comment-key-b");
    });
});
