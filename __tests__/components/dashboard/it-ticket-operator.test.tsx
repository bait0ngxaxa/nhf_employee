import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    ITTicketOperatorDetail,
    ITTicketOperatorQueue,
    type ITOperatorReferenceData,
    type ITOperatorTicket,
    type ITPresentationCapabilities,
    type ITTicketAttachmentSummary,
} from "@/modules/it/client";

const requesterCapabilities: ITPresentationCapabilities = {
    canReadOwnTickets: true,
    canReadAllTickets: true,
    canCreateOwnTickets: true,
    canCommentOwnTickets: true,
    canCommentAllTickets: false,
    canManageTickets: false,
    canReadAnalytics: false,
};

const operatorCapabilities: ITPresentationCapabilities = {
    ...requesterCapabilities,
    canManageTickets: true,
};

const ticket: ITOperatorTicket = {
    id: 19,
    type: "INCIDENT",
    title: "เข้าใช้งานระบบไม่ได้",
    description: "หน้าเข้าสู่ระบบแสดงข้อผิดพลาด",
    status: "OPEN",
    requester: {
        userId: 41,
        displayName: "อารี ใจเย็น",
        departmentId: 9,
        departmentNameSnapshot: "แผนกตัวอย่าง",
    },
    assignee: null,
    category: null,
    version: 4,
    createdAt: "2026-09-01T01:00:00.000Z",
    updatedAt: "2026-09-02T02:00:00.000Z",
    resolvedAt: null,
};

const reference: ITOperatorReferenceData = {
    categories: [{ id: 4, key: "NETWORK", name: "เครือข่าย" }],
    assignableOperators: [{ userId: 51, employeeId: 91, displayName: "สมชาย ใจดี" }],
};

const fetchMock = vi.fn<typeof fetch>();
let objectUrlSequence = 0;
const createObjectUrl = vi.fn(() => `blob:operator-${++objectUrlSequence}`);
const revokeObjectUrl = vi.fn();
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;

function apiResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });
}

function queueResponse(tickets: readonly ITOperatorTicket[] = []): Response {
    return apiResponse({ success: true, tickets, nextCursor: null, limit: 25 });
}

function detailResponse(
    value: ITOperatorTicket,
    initialAttachments: readonly ITTicketAttachmentSummary[] = [],
): Response {
    return apiResponse({ success: true, ticket: { ...value, initialAttachments } });
}

function referenceResponse(): Response {
    return apiResponse({ success: true, ...reference });
}

function timelineResponse(withStatusChange = false): Response {
    const items: unknown[] = [{
        type: "CREATED",
        id: 1,
        createdAt: ticket.createdAt,
        actorDisplayName: ticket.requester.displayName,
    }];
    if (withStatusChange) {
        items.push({
            type: "STATUS_CHANGED",
            id: 2,
            createdAt: "2026-09-03T01:30:00.000Z",
            actorDisplayName: "เจ้าหน้าที่อีกคน",
            fromStatus: "OPEN",
            toStatus: "IN_PROGRESS",
        });
    }
    return apiResponse({
        success: true,
        items,
        olderCursor: null,
        hasMore: false,
    });
}

beforeEach(() => {
    fetchMock.mockReset();
    objectUrlSequence = 0;
    createObjectUrl.mockClear();
    revokeObjectUrl.mockClear();
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "it-operator-comment-key" });
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

describe("IT operator queue presentation", () => {
    it("shows bounded queue loading, empty, and retry states", async () => {
        fetchMock
            .mockImplementationOnce(() => new Promise<Response>(() => undefined))
            .mockResolvedValueOnce(referenceResponse());

        const { unmount } = render(<ITTicketOperatorQueue />);
        expect(await screen.findByRole("status", { name: "กำลังโหลดคิว IT Ticket" }))
            .toBeInTheDocument();
        unmount();

        fetchMock
            .mockResolvedValueOnce(apiResponse({ error: "temporary" }, 500))
            .mockResolvedValueOnce(referenceResponse())
            .mockResolvedValueOnce(queueResponse())
            .mockResolvedValueOnce(referenceResponse());
        render(<ITTicketOperatorQueue />);

        expect(await screen.findByRole("alert")).toHaveTextContent("temporary");
        fireEvent.click(screen.getByRole("button", { name: "ลองอีกครั้ง" }));
        expect(await screen.findByText("ไม่พบ Ticket ในตัวกรองนี้")).toBeInTheDocument();
    });

    it("renders operational identity and submits filters to the server", async () => {
        fetchMock.mockImplementation(async (input) => {
            const url = String(input);
            if (url.includes("/reference")) return referenceResponse();
            if (url.includes("status=IN_PROGRESS")) return queueResponse([]);
            return queueResponse([ticket]);
        });

        render(<ITTicketOperatorQueue />);

        expect(await screen.findAllByRole("link", { name: /เข้าใช้งานระบบไม่ได้/ }))
            .toHaveLength(2);
        expect(screen.getAllByText("อารี ใจเย็น")).toHaveLength(2);
        expect(screen.getAllByText("ยังไม่มีผู้รับผิดชอบ").length).toBeGreaterThan(1);
        expect(screen.getAllByText("ยังไม่จัดหมวดหมู่").length).toBeGreaterThan(0);

        fireEvent.change(screen.getByLabelText("กรองตามสถานะ"), {
            target: { value: "IN_PROGRESS" },
        });
        fireEvent.click(screen.getByRole("button", { name: "ใช้ตัวกรอง" }));

        await waitFor(() => {
            expect(fetchMock.mock.calls.some(([input]) =>
                String(input).includes("status=IN_PROGRESS"),
            )).toBe(true);
        });
        expect(await screen.findByText("ไม่พบ Ticket ในตัวกรองนี้")).toBeInTheDocument();
    });
});

describe("IT operator Ticket detail presentation", () => {
    it("shows initial requester evidence in the operator Ticket detail", async () => {
        const attachment: ITTicketAttachmentSummary = {
            id: "b".repeat(32),
            originalName: "ภาพปัญหาของผู้แจ้ง.png",
            contentType: "image/webp",
            sizeBytes: 2048,
            width: 40,
            height: 30,
            position: 0,
        };
        fetchMock.mockImplementation(async (input) => {
            if (String(input).includes("/attachments/")) {
                return new Response(new Blob(["private image"], { type: "image/webp" }), {
                    status: 200,
                    headers: { "Content-Type": "image/webp" },
                });
            }
            if (String(input).includes("/reference")) return referenceResponse();
            if (String(input).includes("/timeline")) return timelineResponse();
            return detailResponse(ticket, [attachment]);
        });

        const view = render(<ITTicketOperatorDetail ticketId={19} capabilities={requesterCapabilities} />);

        expect(await screen.findByRole("img", {
            name: `รูปภาพประกอบ: ${attachment.originalName}`,
        })).toHaveAttribute("src", expect.stringContaining("blob:operator-"));
        expect(screen.getByRole("region", { name: "รูปภาพประกอบ" })).toBeInTheDocument();
        view.unmount();
        expect(revokeObjectUrl).toHaveBeenCalled();
    });

    it("keeps a read-only ALL operator from receiving mutation controls", async () => {
        fetchMock.mockImplementation(async (input) => String(input).includes("/reference")
            ? referenceResponse()
            : String(input).includes("/timeline") ? timelineResponse() : detailResponse(ticket));

        render(<ITTicketOperatorDetail ticketId={19} capabilities={requesterCapabilities} />);

        expect(await screen.findByRole("heading", { name: "Ticket #19" })).toBeInTheDocument();
        expect(screen.getByRole("link", { name: "กลับไปยังคิว IT Ticket" })).toHaveAttribute(
            "href",
            "/dashboard/it?itTab=queue",
        );
        expect(screen.getByText("แผนกตัวอย่าง")).toBeInTheDocument();
        expect(screen.getByText("หน้าเข้าสู่ระบบแสดงข้อผิดพลาด")).toBeInTheDocument();
        expect(screen.queryByText("รุ่น 4")).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "ดำเนินการกับ Ticket" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "เริ่มดำเนินการ" })).not.toBeInTheDocument();
    });

    it("shows a reply composer for comment ALL without manage ALL", async () => {
        const commentOnlyCapabilities: ITPresentationCapabilities = {
            ...requesterCapabilities,
            canCommentAllTickets: true,
            canManageTickets: false,
        };
        fetchMock.mockImplementation(async (input) => String(input).includes("/reference")
            ? referenceResponse()
            : String(input).includes("/timeline") ? timelineResponse() : detailResponse(ticket));

        render(<ITTicketOperatorDetail ticketId={19} capabilities={commentOnlyCapabilities} />);

        expect(await screen.findByLabelText("ตอบกลับ")).toBeInTheDocument();
        expect(await screen.findByText("อารี ใจเย็น สร้าง Ticket")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "ดำเนินการกับ Ticket" })).not.toBeInTheDocument();
    });

    it("does not show a reply composer for manage ALL without comment ALL", async () => {
        fetchMock.mockImplementation(async (input) => String(input).includes("/reference")
            ? referenceResponse()
            : String(input).includes("/timeline") ? timelineResponse() : detailResponse(ticket));

        render(<ITTicketOperatorDetail ticketId={19} capabilities={operatorCapabilities} />);

        expect(await screen.findByRole("heading", { name: "ดำเนินการกับ Ticket" })).toBeInTheDocument();
        expect(screen.queryByText("รุ่น 4")).not.toBeInTheDocument();
        expect(screen.queryByText(/ทุกการบันทึกใช้รุ่น/)).not.toBeInTheDocument();
        expect(screen.queryByLabelText("ตอบกลับ")).not.toBeInTheDocument();
    });

    it("posts the shared operator reply and leaves the workflow status alone", async () => {
        fetchMock.mockImplementation(async (input, init) => {
            if (String(input).includes("/reference")) return referenceResponse();
            if (String(input).includes("/timeline")) return timelineResponse();
            if (init?.method === "POST") {
                return apiResponse({
                    success: true,
                    replayed: false,
                    comment: {
                        type: "COMMENT",
                        id: "cm-operator-reply",
                        createdAt: "2026-09-03T01:00:00.000Z",
                        authorDisplayName: "เจ้าหน้าที่ IT",
                        authorSide: "OPERATOR",
                        body: "กำลังตรวจสอบให้ค่ะ",
                        attachments: [],
                    },
                }, 201);
            }
            return detailResponse(ticket);
        });
        const commentOnlyCapabilities: ITPresentationCapabilities = {
            ...requesterCapabilities,
            canCommentAllTickets: true,
            canManageTickets: false,
        };

        render(<ITTicketOperatorDetail ticketId={19} capabilities={commentOnlyCapabilities} />);
        await screen.findByText("อารี ใจเย็น สร้าง Ticket");
        fireEvent.change(screen.getByLabelText("ตอบกลับ"), {
            target: { value: "  กำลังตรวจสอบให้ค่ะ  " },
        });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));

        expect(await screen.findByText("ส่งข้อความเรียบร้อยแล้ว")).toBeInTheDocument();
        expect(screen.getAllByText("กำลังตรวจสอบให้ค่ะ")).toHaveLength(1);
        expect(screen.getByText("รับเรื่องแล้ว")).toBeInTheDocument();
        const postCall = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
        expect(postCall?.[0]).toBe("/api/it/operator/tickets/19/comments");
        expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({ body: "กำลังตรวจสอบให้ค่ะ" });
        expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/timeline"))).toHaveLength(1);
        expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "PATCH")).toHaveLength(0);
    });

    it("reloads the latest timeline after a successful workflow change", async () => {
        let detailReadCount = 0;
        let timelineReadCount = 0;
        const progressedTicket: ITOperatorTicket = {
            ...ticket,
            status: "IN_PROGRESS",
            version: 5,
        };
        fetchMock.mockImplementation(async (input, init) => {
            const url = String(input);
            if (url.includes("/reference")) return referenceResponse();
            if (url.includes("/timeline")) {
                timelineReadCount += 1;
                return timelineResponse(timelineReadCount > 1);
            }
            if (init?.method === "PATCH") {
                return apiResponse({
                    success: true,
                    changed: true,
                    ticket: {
                        id: 19,
                        version: 5,
                        status: "IN_PROGRESS",
                        assignedToUserId: null,
                        categoryId: null,
                        updatedAt: "2026-09-03T02:00:00.000Z",
                    },
                });
            }
            detailReadCount += 1;
            return detailResponse(detailReadCount === 1 ? ticket : progressedTicket);
        });

        render(<ITTicketOperatorDetail ticketId={19} capabilities={operatorCapabilities} />);

        expect(await screen.findByText("อารี ใจเย็น สร้าง Ticket")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "เริ่มดำเนินการ" }));

        expect(await screen.findByText("เปลี่ยนสถานะเป็นกำลังดำเนินการแล้ว")).toBeInTheDocument();
        expect(screen.queryByText(/รุ่น \d+/)).not.toBeInTheDocument();
        expect(await screen.findByText(
            "เจ้าหน้าที่อีกคน เปลี่ยนสถานะจาก รับเรื่องแล้ว เป็น กำลังดำเนินการ",
        )).toBeInTheDocument();
        expect(timelineReadCount).toBe(2);
    });

    it("does not refetch the timeline for a no-op workflow mutation with the same version", async () => {
        let detailReadCount = 0;
        let timelineReadCount = 0;
        let patchCount = 0;
        const assignedTicket: ITOperatorTicket = {
            ...ticket,
            assignee: { userId: 51, displayName: "สมชาย ใจดี" },
        };
        fetchMock.mockImplementation(async (input, init) => {
            const url = String(input);
            if (url.includes("/reference")) return referenceResponse();
            if (url.includes("/timeline")) {
                timelineReadCount += 1;
                return timelineResponse();
            }
            if (init?.method === "PATCH") {
                patchCount += 1;
                return apiResponse({
                    success: true,
                    changed: false,
                    ticket: {
                        id: 19,
                        version: 4,
                        status: "OPEN",
                        assignedToUserId: 51,
                        categoryId: null,
                        updatedAt: assignedTicket.updatedAt,
                    },
                });
            }
            detailReadCount += 1;
            return detailResponse(assignedTicket);
        });

        render(<ITTicketOperatorDetail ticketId={19} capabilities={operatorCapabilities} />);

        expect(await screen.findByText("อารี ใจเย็น สร้าง Ticket")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "บันทึกผู้รับผิดชอบ" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "บันทึกผู้รับผิดชอบ" })).toBeEnabled());

        expect(patchCount).toBe(1);
        expect(detailReadCount).toBe(2);
        expect(timelineReadCount).toBe(1);
    });

    it("sends the displayed version and requires review after loading a stale conflict", async () => {
        let detailReadCount = 0;
        let timelineReadCount = 0;
        const latestTicket: ITOperatorTicket = {
            ...ticket,
            status: "IN_PROGRESS",
            assignee: { userId: 62, displayName: "ผู้รับผิดชอบปัจจุบัน" },
            version: 5,
        };
        const confirmedTicket: ITOperatorTicket = {
            ...latestTicket,
            assignee: { userId: 51, displayName: "สมชาย ใจดี" },
            version: 6,
        };
        const patchBodies: unknown[] = [];
        let patchCount = 0;
        fetchMock.mockImplementation(async (input, init) => {
            const url = String(input);
            if (url.includes("/reference")) return referenceResponse();
            if (url.includes("/timeline")) {
                timelineReadCount += 1;
                return timelineResponse(timelineReadCount > 1);
            }
            if (init?.method === "PATCH") {
                patchBodies.push(JSON.parse(String(init.body)) as unknown);
                patchCount += 1;
                if (patchCount === 1) {
                    return apiResponse({
                        success: false,
                        error: "Ticket ถูกเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลล่าสุด",
                        code: "MUTATION_CONFLICT",
                        reason: "STALE_VERSION",
                    }, 409);
                }
                return apiResponse({
                    success: true,
                    changed: true,
                    ticket: {
                        id: 19,
                        version: 6,
                        status: "IN_PROGRESS",
                        assignedToUserId: 51,
                        categoryId: null,
                        updatedAt: "2026-09-03T02:00:00.000Z",
                    },
                });
            }
            detailReadCount += 1;
            return detailResponse(detailReadCount === 1
                ? ticket
                : detailReadCount === 2 ? latestTicket : confirmedTicket);
        });

        render(<ITTicketOperatorDetail ticketId={19} capabilities={operatorCapabilities} />);

        expect(await screen.findByLabelText("ผู้รับผิดชอบ Ticket")).toBeInTheDocument();
        expect(screen.getByLabelText("หมวดหมู่ Ticket")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "บันทึกผู้รับผิดชอบ" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "บันทึกหมวดหมู่" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "ปิดงานแล้ว" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "ยกเลิกแล้ว" })).not.toBeInTheDocument();

        fireEvent.click(await screen.findByRole("button", { name: "เริ่มดำเนินการ" }));
        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Ticket นี้มีการเปลี่ยนแปลงจากผู้ใช้อื่น ระบบโหลดข้อมูลล่าสุดแล้ว กรุณาตรวจสอบข้อมูลก่อนดำเนินการต่อ",
        );
        await waitFor(() => expect(screen.getByLabelText("ผู้รับผิดชอบ Ticket")).toHaveValue("62"));
        const conflictAlert = screen.getByRole("alert");
        expect(conflictAlert).toHaveTextContent(
            "Ticket นี้มีการเปลี่ยนแปลงจากผู้ใช้อื่น ระบบโหลดข้อมูลล่าสุดแล้ว กรุณาตรวจสอบข้อมูลก่อนดำเนินการต่อ",
        );
        expect(conflictAlert).not.toHaveTextContent(/รุ่น|version|revision/i);
        expect(screen.queryByText(/รุ่น \d+/)).not.toBeInTheDocument();
        expect(await screen.findByText(
            "เจ้าหน้าที่อีกคน เปลี่ยนสถานะจาก รับเรื่องแล้ว เป็น กำลังดำเนินการ",
        )).toBeInTheDocument();
        expect(timelineReadCount).toBe(2);
        expect(screen.getByRole("button", { name: "รอข้อมูลจากผู้แจ้ง" })).toBeDisabled();
        expect(patchBodies[0]).toEqual({ targetStatus: "IN_PROGRESS", expectedVersion: 4 });

        fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบข้อมูลล่าสุดแล้ว" }));
        fireEvent.change(screen.getByLabelText("ผู้รับผิดชอบ Ticket"), {
            target: { value: "51" },
        });
        fireEvent.click(screen.getByRole("button", { name: "บันทึกผู้รับผิดชอบ" }));

        await waitFor(() => expect(patchBodies).toHaveLength(2));
        expect(patchBodies[1]).toEqual({ assigneeUserId: 51, expectedVersion: 5 });
        expect(await screen.findByText("บันทึกผู้รับผิดชอบแล้ว")).toBeInTheDocument();
        expect(screen.queryByText(/รุ่น \d+/)).not.toBeInTheDocument();
    });
});
