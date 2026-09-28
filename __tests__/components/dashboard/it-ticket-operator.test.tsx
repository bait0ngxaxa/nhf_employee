import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { IT_TICKET_CATEGORY_SEEDS } from "@/shared/it-ticket-category-seeds";
import {
    ITTicketOperatorDetail,
    ITTicketOperatorQueue,
    type ITOperatorReferenceData,
    type ITOperatorTicket,
    type ITPresentationCapabilities,
    type ITTicketAttachmentSummary,
} from "@/modules/it/client";

const sonnerToast = vi.hoisted(() => ({
    success: vi.fn(),
    error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast: sonnerToast }));

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
    categories: IT_TICKET_CATEGORY_SEEDS.map(({ key, name }, index) => ({
        id: index + 1,
        key,
        name,
    })),
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

function activityResponse(withStatusChange = false): Response {
    const items: unknown[] = [{
        type: "CREATED",
        id: 1,
        occurredAt: ticket.createdAt,
        actorDisplayName: ticket.requester.displayName,
    }];
    if (withStatusChange) {
        items.push({
            type: "STATUS_CHANGED",
            id: 2,
            occurredAt: "2026-09-03T01:30:00.000Z",
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

function conversationResponse(): Response {
    return apiResponse({ success: true, items: [], olderCursor: null, hasMore: false });
}

const configureFetch = fetchMock.mockImplementation.bind(fetchMock);

function mockApiImplementation(
    implementation: Parameters<typeof fetchMock.mockImplementation>[0],
): void {
    configureFetch(async (input, init) => {
        if (String(input).includes("/conversation")) return conversationResponse();
        return implementation(input, init);
    });
}

beforeEach(() => {
    fetchMock.mockReset();
    sonnerToast.success.mockReset();
    sonnerToast.error.mockReset();
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
        mockApiImplementation(async (input) => {
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
    it.each([
        ["OPEN", ["เริ่มดำเนินการ", "ยกเลิก"]],
        ["IN_PROGRESS", ["รอข้อมูลจากผู้แจ้ง", "ทำเครื่องหมายว่าแก้ไขแล้ว", "ยกเลิก"]],
        ["WAITING_REQUESTER", ["กลับมาดำเนินการ", "ยกเลิก"]],
        ["RESOLVED", ["เปิดงานอีกครั้ง", "ปิดงาน"]],
        ["CLOSED", []],
        ["CANCELLED", []],
    ] as const)(
        "shows only canonical lifecycle actions for %s",
        async (status, expectedActions) => {
            mockApiImplementation(async (input) => {
                if (String(input).includes("/reference")) return referenceResponse();
                if (String(input).includes("/activity")) return activityResponse();
                return detailResponse({ ...ticket, status });
            });

            render(<ITTicketOperatorDetail ticketId={19} capabilities={operatorCapabilities} />);

            expect(await screen.findByRole("heading", { name: ticket.title })).toBeInTheDocument();
            const actionLabels = [
                "เริ่มดำเนินการ",
                "รอข้อมูลจากผู้แจ้ง",
                "ทำเครื่องหมายว่าแก้ไขแล้ว",
                "ยกเลิก",
                "กลับมาดำเนินการ",
                "เปิดงานอีกครั้ง",
                "ปิดงาน",
            ];
            const expectedActionSet = new Set<string>(expectedActions);
            for (const label of actionLabels) {
                if (expectedActionSet.has(label)) {
                    expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
                } else {
                    expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
                }
            }
            expect(screen.queryByRole("combobox", { name: "สถานะ" })).not.toBeInTheDocument();
        },
    );

    it.each([
        ["OPEN", true],
        ["IN_PROGRESS", true],
        ["WAITING_REQUESTER", true],
        ["RESOLVED", false],
        ["CLOSED", false],
        ["CANCELLED", false],
    ] as const)("keeps operator Conversation %s commentability unchanged", async (status, commentable) => {
        mockApiImplementation(async (input) => {
            if (String(input).includes("/reference")) return referenceResponse();
            if (String(input).includes("/activity")) return activityResponse();
            return detailResponse({ ...ticket, status });
        });
        const capabilities: ITPresentationCapabilities = {
            ...requesterCapabilities,
            canCommentAllTickets: true,
            canManageTickets: false,
        };

        render(<ITTicketOperatorDetail ticketId={19} capabilities={capabilities} />);

        expect(await screen.findByRole("heading", { name: ticket.title })).toBeInTheDocument();
        if (commentable) {
            expect(await screen.findByLabelText("ตอบกลับ")).toBeInTheDocument();
        } else {
            expect(screen.queryByLabelText("ตอบกลับ")).not.toBeInTheDocument();
            expect(screen.getByText(/จึงอ่านบทสนทนาได้อย่างเดียว/)).toBeInTheDocument();
        }
    });

    it("keeps Ticket controls available when Conversation loading fails", async () => {
        configureFetch(async (input) => {
            const url = String(input);
            if (url.includes("/reference")) return referenceResponse();
            if (url.includes("/conversation")) return apiResponse({ error: "temporary" }, 503);
            if (url.includes("/activity")) return activityResponse();
            return detailResponse(ticket);
        });

        render(<ITTicketOperatorDetail ticketId={19} capabilities={operatorCapabilities} />);

        expect(await screen.findByRole("alert")).toHaveTextContent("temporary");
        const activity = await screen.findByRole("list", { name: "ประวัติการดำเนินการ Ticket #19" });
        expect(within(activity).getByText("ผู้ดำเนินการ: อารี ใจเย็น")).toBeInTheDocument();
        expect(within(activity).getByText("รับเรื่องแล้ว")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "เริ่มดำเนินการ" })).toBeEnabled();
    });

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
        mockApiImplementation(async (input) => {
            if (String(input).includes("/attachments/")) {
                return new Response(new Blob(["private image"], { type: "image/webp" }), {
                    status: 200,
                    headers: { "Content-Type": "image/webp" },
                });
            }
            if (String(input).includes("/reference")) return referenceResponse();
            if (String(input).includes("/activity")) return activityResponse();
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

    it("selects and clears reference categories using the current internal version", async () => {
        const selectedCategory = reference.categories.find(({ key }) => key === "HARDWARE");
        if (!selectedCategory) throw new Error("missing canonical HARDWARE category fixture");

        const categorizedTicket: ITOperatorTicket = {
            ...ticket,
            category: { ...selectedCategory, isActive: true },
            version: 5,
        };
        const clearedTicket: ITOperatorTicket = {
            ...categorizedTicket,
            category: null,
            version: 6,
        };
        const patchBodies: unknown[] = [];
        const patchRoutes: string[] = [];
        let patchCount = 0;
        let detailReadCount = 0;

        mockApiImplementation(async (input, init) => {
            const url = String(input);
            if (url.includes("/reference")) return referenceResponse();
            if (url.includes("/activity")) return activityResponse();
            if (init?.method === "PATCH") {
                patchCount += 1;
                patchRoutes.push(url);
                patchBodies.push(JSON.parse(String(init.body)) as unknown);
                return apiResponse({
                    success: true,
                    changed: true,
                    ticket: {
                        id: 19,
                        version: patchCount === 1 ? 5 : 6,
                        status: "OPEN",
                        assignedToUserId: null,
                        categoryId: patchCount === 1 ? selectedCategory.id : null,
                        updatedAt: "2026-09-03T02:00:00.000Z",
                    },
                });
            }

            detailReadCount += 1;
            const detail = detailReadCount === 1
                ? ticket
                : detailReadCount === 2 ? categorizedTicket : clearedTicket;
            return detailResponse(detail);
        });

        render(<ITTicketOperatorDetail ticketId={19} capabilities={operatorCapabilities} />);

        const categorySelector = await screen.findByRole("combobox", { name: "หมวดหมู่ Ticket" });
        expect(within(categorySelector).getAllByRole("option").map((option) => option.textContent))
            .toEqual([
                "ไม่จัดหมวดหมู่",
                ...reference.categories.map(({ name }) => name),
            ]);
        expect(screen.queryByText(/รุ่น|version|revision/i)).not.toBeInTheDocument();

        fireEvent.change(categorySelector, { target: { value: String(selectedCategory.id) } });
        expect(categorySelector).toHaveValue(String(selectedCategory.id));
        fireEvent.click(screen.getByRole("button", { name: "บันทึกหมวดหมู่" }));

        await waitFor(() => expect(patchBodies).toHaveLength(1));
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("บันทึกหมวดหมู่แล้ว"));
        expect(screen.queryByText("บันทึกหมวดหมู่แล้ว")).not.toBeInTheDocument();
        expect(patchRoutes).toEqual([expect.stringContaining("/category")]);
        expect(patchBodies[0]).toEqual({ categoryId: selectedCategory.id, expectedVersion: 4 });
        await waitFor(() => expect(detailReadCount).toBe(2));
        expect(categorySelector).toHaveValue(String(selectedCategory.id));

        fireEvent.change(categorySelector, { target: { value: "" } });
        expect(categorySelector).toHaveValue("");
        fireEvent.click(screen.getByRole("button", { name: "บันทึกหมวดหมู่" }));

        await waitFor(() => expect(patchBodies).toHaveLength(2));
        expect(patchBodies[1]).toEqual({ categoryId: null, expectedVersion: 5 });
        await waitFor(() => expect(toast.success).toHaveBeenCalledTimes(2));
        expect(toast.success).toHaveBeenNthCalledWith(2, "บันทึกหมวดหมู่แล้ว");
        await waitFor(() => expect(detailReadCount).toBe(3));
        expect(categorySelector).toHaveValue("");
        expect(screen.queryByText("บันทึกหมวดหมู่แล้ว")).not.toBeInTheDocument();
        expect(screen.queryByText(/รุ่น|version|revision/i)).not.toBeInTheDocument();
    });

    it("shows ordinary mutation failures through one safe toast", async () => {
        mockApiImplementation(async (input, init) => {
            if (String(input).includes("/reference")) return referenceResponse();
            if (String(input).includes("/activity")) return activityResponse();
            if (init?.method === "PATCH") {
                return apiResponse({ error: "ไม่สามารถบันทึกข้อมูลได้ในขณะนี้" }, 422);
            }
            return detailResponse(ticket);
        });

        render(<ITTicketOperatorDetail ticketId={19} capabilities={operatorCapabilities} />);

        fireEvent.click(await screen.findByRole("button", { name: "บันทึกผู้รับผิดชอบ" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("ไม่สามารถบันทึกข้อมูลได้ในขณะนี้"));
        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("alert")).not.toBeInTheDocument();
        expect(screen.queryByText("ไม่สามารถบันทึกข้อมูลได้ในขณะนี้")).not.toBeInTheDocument();
    });

    it("clears an inactive category draft, refreshes references, and shows its safe error as a toast", async () => {
        let referenceReadCount = 0;
        mockApiImplementation(async (input, init) => {
            const url = String(input);
            if (url.includes("/reference")) {
                referenceReadCount += 1;
                return referenceResponse();
            }
            if (url.includes("/activity")) return activityResponse();
            if (init?.method === "PATCH") {
                return apiResponse({
                    error: "หมวดหมู่ที่เลือกไม่สามารถใช้งานได้",
                    code: "CATEGORY_INACTIVE",
                }, 409);
            }
            return detailResponse(ticket);
        });

        render(<ITTicketOperatorDetail ticketId={19} capabilities={operatorCapabilities} />);

        const categorySelector = await screen.findByRole("combobox", { name: "หมวดหมู่ Ticket" });
        fireEvent.change(categorySelector, { target: { value: "1" } });
        fireEvent.click(screen.getByRole("button", { name: "บันทึกหมวดหมู่" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("หมวดหมู่ที่เลือกไม่สามารถใช้งานได้"));
        await waitFor(() => expect(referenceReadCount).toBe(2));
        expect(categorySelector).toHaveValue("");
        expect(toast.error).toHaveBeenCalledTimes(1);
    });

    it("clears an ineligible assignee draft, refreshes references, and shows its safe error as a toast", async () => {
        let referenceReadCount = 0;
        mockApiImplementation(async (input, init) => {
            const url = String(input);
            if (url.includes("/reference")) {
                referenceReadCount += 1;
                return referenceResponse();
            }
            if (url.includes("/activity")) return activityResponse();
            if (init?.method === "PATCH") {
                return apiResponse({
                    error: "ผู้รับผิดชอบที่เลือกไม่พร้อมใช้งาน",
                    code: "ASSIGNEE_NOT_ELIGIBLE",
                }, 409);
            }
            return detailResponse(ticket);
        });

        render(<ITTicketOperatorDetail ticketId={19} capabilities={operatorCapabilities} />);

        const assigneeSelector = await screen.findByRole("combobox", { name: "ผู้รับผิดชอบ Ticket" });
        fireEvent.change(assigneeSelector, { target: { value: "51" } });
        fireEvent.click(screen.getByRole("button", { name: "บันทึกผู้รับผิดชอบ" }));

        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("ผู้รับผิดชอบที่เลือกไม่พร้อมใช้งาน"));
        await waitFor(() => expect(referenceReadCount).toBe(2));
        expect(assigneeSelector).toHaveValue("");
        expect(toast.error).toHaveBeenCalledTimes(1);
    });

    it("keeps mutation access denial persistent while also reporting it through toast", async () => {
        mockApiImplementation(async (input, init) => {
            if (String(input).includes("/reference")) return referenceResponse();
            if (String(input).includes("/activity")) return activityResponse();
            if (init?.method === "PATCH") {
                return apiResponse({ error: "internal authorization detail" }, 403);
            }
            return detailResponse(ticket);
        });

        render(<ITTicketOperatorDetail ticketId={19} capabilities={operatorCapabilities} />);

        fireEvent.click(await screen.findByRole("button", { name: "บันทึกผู้รับผิดชอบ" }));

        const accessWarning = await screen.findByText(
            "สิทธิ์หรือสถานะพนักงานเปลี่ยนแปลง จึงปิดการดำเนินการไว้ กรุณาโหลดหน้าใหม่เพื่อตรวจสอบสิทธิ์ปัจจุบัน",
        );
        expect(accessWarning.closest('[role="alert"]')).toHaveTextContent(
            "สิทธิ์หรือสถานะพนักงานเปลี่ยนแปลง จึงปิดการดำเนินการไว้",
        );
        expect(toast.error).toHaveBeenCalledWith("บัญชีนี้ไม่มีสิทธิ์ดำเนินการกับคิว IT Ticket");
        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("heading", { name: "ดำเนินการกับ Ticket" })).not.toBeInTheDocument();
        expect(screen.queryByText("internal authorization detail")).not.toBeInTheDocument();
    });

    it("keeps detail load errors inline with a retry action", async () => {
        let detailReadCount = 0;
        mockApiImplementation(async (input) => {
            if (String(input).includes("/reference")) return referenceResponse();
            if (String(input).includes("/activity")) return activityResponse();
            detailReadCount += 1;
            return detailReadCount === 1
                ? apiResponse({}, 500)
                : detailResponse(ticket);
        });

        render(<ITTicketOperatorDetail ticketId={19} capabilities={operatorCapabilities} />);

        expect(await screen.findByText("ไม่สามารถโหลด Ticket ได้ กรุณาลองอีกครั้ง")).toBeInTheDocument();
        expect(screen.getByRole("alert")).toContainElement(screen.getByRole("button", { name: "โหลดอีกครั้ง" }));
        expect(toast.error).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "โหลดอีกครั้ง" }));
        expect(await screen.findByRole("heading", { name: ticket.title })).toBeInTheDocument();
    });

    it("keeps reference load errors inline with a retry action", async () => {
        let referenceReadCount = 0;
        mockApiImplementation(async (input) => {
            if (String(input).includes("/reference")) {
                referenceReadCount += 1;
                return referenceReadCount === 1 ? apiResponse({}, 500) : referenceResponse();
            }
            if (String(input).includes("/activity")) return activityResponse();
            return detailResponse(ticket);
        });

        render(<ITTicketOperatorDetail ticketId={19} capabilities={operatorCapabilities} />);

        expect(await screen.findByText("ไม่สามารถเชื่อมต่อคิว IT Ticket ได้ กรุณาลองอีกครั้ง")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "โหลดตัวเลือกอีกครั้ง" })).toBeInTheDocument();
        expect(toast.error).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "โหลดตัวเลือกอีกครั้ง" }));
        expect(await screen.findByRole("combobox", { name: "หมวดหมู่ Ticket" })).toBeInTheDocument();
    });

    it("keeps a read-only ALL operator from receiving mutation controls", async () => {
        mockApiImplementation(async (input) => String(input).includes("/reference")
            ? referenceResponse()
            : String(input).includes("/activity") ? activityResponse() : detailResponse(ticket));

        render(<ITTicketOperatorDetail ticketId={19} capabilities={requesterCapabilities} />);

        expect(await screen.findByRole("heading", { name: ticket.title })).toBeInTheDocument();
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
        mockApiImplementation(async (input) => String(input).includes("/reference")
            ? referenceResponse()
            : String(input).includes("/activity") ? activityResponse() : detailResponse(ticket));

        render(<ITTicketOperatorDetail ticketId={19} capabilities={commentOnlyCapabilities} />);

        expect(await screen.findByLabelText("ตอบกลับ")).toBeInTheDocument();
        expect(await screen.findByText("ผู้ดำเนินการ: อารี ใจเย็น")).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "ดำเนินการกับ Ticket" })).not.toBeInTheDocument();
    });

    it("does not show a reply composer for manage ALL without comment ALL", async () => {
        mockApiImplementation(async (input) => String(input).includes("/reference")
            ? referenceResponse()
            : String(input).includes("/activity") ? activityResponse() : detailResponse(ticket));

        render(<ITTicketOperatorDetail ticketId={19} capabilities={operatorCapabilities} />);

        expect(await screen.findByRole("heading", { name: "ดำเนินการกับ Ticket" })).toBeInTheDocument();
        expect(screen.queryByText("รุ่น 4")).not.toBeInTheDocument();
        expect(screen.queryByText(/ทุกการบันทึกใช้รุ่น/)).not.toBeInTheDocument();
        expect(screen.queryByLabelText("ตอบกลับ")).not.toBeInTheDocument();
    });

    it("posts the shared operator reply and leaves the workflow status alone", async () => {
        mockApiImplementation(async (input, init) => {
            if (String(input).includes("/reference")) return referenceResponse();
            if (String(input).includes("/activity")) return activityResponse();
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
        await screen.findByText("ผู้ดำเนินการ: อารี ใจเย็น");
        fireEvent.change(screen.getByLabelText("ตอบกลับ"), {
            target: { value: "  กำลังตรวจสอบให้ค่ะ  " },
        });
        fireEvent.click(screen.getByRole("button", { name: "ส่งข้อความ" }));

        expect(await screen.findByText("ส่งข้อความเรียบร้อยแล้ว")).toBeInTheDocument();
        expect(screen.getAllByText("กำลังตรวจสอบให้ค่ะ")).toHaveLength(1);
        expect(within(screen.getByRole("list", { name: "ประวัติการดำเนินการ Ticket #19" }))
            .getByText("รับเรื่องแล้ว")).toBeInTheDocument();
        const postCall = fetchMock.mock.calls.find(([, options]) => options?.method === "POST");
        expect(postCall?.[0]).toBe("/api/it/operator/tickets/19/comments");
        expect(JSON.parse(String(postCall?.[1]?.body))).toEqual({ body: "กำลังตรวจสอบให้ค่ะ" });
        expect(fetchMock.mock.calls.filter(([input]) => String(input).includes("/activity"))).toHaveLength(1);
        expect(fetchMock.mock.calls.filter(([, options]) => options?.method === "PATCH")).toHaveLength(0);
    });

    it("reloads Activity after a successful workflow change", async () => {
        let detailReadCount = 0;
        let activityReadCount = 0;
        const progressedTicket: ITOperatorTicket = {
            ...ticket,
            status: "IN_PROGRESS",
            version: 5,
        };
        mockApiImplementation(async (input, init) => {
            const url = String(input);
            if (url.includes("/reference")) return referenceResponse();
            if (url.includes("/activity")) {
                activityReadCount += 1;
                return activityResponse(activityReadCount > 1);
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

        expect(await screen.findByText("ผู้ดำเนินการ: อารี ใจเย็น")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "เริ่มดำเนินการ" }));

        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("เปลี่ยนสถานะเป็นกำลังดำเนินการแล้ว"));
        expect(toast.success).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("เปลี่ยนสถานะเป็นกำลังดำเนินการแล้ว")).not.toBeInTheDocument();
        expect(screen.queryByText(/รุ่น \d+/)).not.toBeInTheDocument();
        await screen.findByText("ผู้ดำเนินการ: เจ้าหน้าที่อีกคน");
        const activity = screen.getByRole("list", { name: "ประวัติการดำเนินการ Ticket #19" });
        expect(await within(activity).findByText("เริ่มดำเนินการ")).toBeInTheDocument();
        expect(within(activity).getByText("ผู้ดำเนินการ: เจ้าหน้าที่อีกคน")).toBeInTheDocument();
        expect(activityReadCount).toBe(2);
    });

    it("does not refetch Activity for a no-op workflow mutation with the same version", async () => {
        let detailReadCount = 0;
        let activityReadCount = 0;
        let patchCount = 0;
        const assignedTicket: ITOperatorTicket = {
            ...ticket,
            assignee: { userId: 51, displayName: "สมชาย ใจดี" },
        };
        mockApiImplementation(async (input, init) => {
            const url = String(input);
            if (url.includes("/reference")) return referenceResponse();
            if (url.includes("/activity")) {
                activityReadCount += 1;
                return activityResponse();
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

        expect(await screen.findByText("ผู้ดำเนินการ: อารี ใจเย็น")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "บันทึกผู้รับผิดชอบ" }));
        await waitFor(() => expect(screen.getByRole("button", { name: "บันทึกผู้รับผิดชอบ" })).toBeEnabled());

        expect(patchCount).toBe(1);
        expect(detailReadCount).toBe(2);
        expect(activityReadCount).toBe(1);
    });

    it("sends the displayed version and requires review after loading a stale conflict", async () => {
        let detailReadCount = 0;
        let activityReadCount = 0;
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
        mockApiImplementation(async (input, init) => {
            const url = String(input);
            if (url.includes("/reference")) return referenceResponse();
            if (url.includes("/activity")) {
                activityReadCount += 1;
                return activityResponse(activityReadCount > 1);
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
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith(
            "Ticket มีการเปลี่ยนแปลง กรุณาตรวจสอบข้อมูลล่าสุด",
        ));
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
        expect(toast.error).toHaveBeenCalledTimes(1);
        expect(sonnerToast.error.mock.calls.flat().join(" ")).not.toMatch(/รุ่น|version|revision/i);
        await screen.findByText("ผู้ดำเนินการ: เจ้าหน้าที่อีกคน");
        const activity = screen.getByRole("list", { name: "ประวัติการดำเนินการ Ticket #19" });
        expect(await within(activity).findByText("เริ่มดำเนินการ")).toBeInTheDocument();
        expect(within(activity).getByText("ผู้ดำเนินการ: เจ้าหน้าที่อีกคน")).toBeInTheDocument();
        expect(activityReadCount).toBe(2);
        expect(screen.getByRole("button", { name: "รอข้อมูลจากผู้แจ้ง" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "บันทึกผู้รับผิดชอบ" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "บันทึกหมวดหมู่" })).toBeDisabled();
        expect(patchBodies[0]).toEqual({ targetStatus: "IN_PROGRESS", expectedVersion: 4 });

        fireEvent.click(screen.getByRole("button", { name: "บันทึกผู้รับผิดชอบ" }));
        expect(patchBodies).toHaveLength(1);

        fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบข้อมูลล่าสุดแล้ว" }));
        fireEvent.change(screen.getByLabelText("ผู้รับผิดชอบ Ticket"), {
            target: { value: "51" },
        });
        fireEvent.click(screen.getByRole("button", { name: "บันทึกผู้รับผิดชอบ" }));

        await waitFor(() => expect(patchBodies).toHaveLength(2));
        expect(patchBodies[1]).toEqual({ assigneeUserId: 51, expectedVersion: 5 });
        await waitFor(() => expect(toast.success).toHaveBeenCalledWith("บันทึกผู้รับผิดชอบแล้ว"));
        await waitFor(() => expect(detailReadCount).toBe(3));
        expect(toast.success).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("บันทึกผู้รับผิดชอบแล้ว")).not.toBeInTheDocument();
        expect(screen.queryByText(/รุ่น \d+/)).not.toBeInTheDocument();
    });

    it.each(["network", "server", "incomplete-success"] as const)(
        "reports an ambiguous %s result and retains review with a Ticket refresh",
        async (failureKind) => {
            let detailReadCount = 0;
            let patchCount = 0;
            const latestTicket: ITOperatorTicket = {
                ...ticket,
                status: "IN_PROGRESS",
                version: 5,
            };
            mockApiImplementation(async (input, init) => {
                const url = String(input);
                if (url.includes("/reference")) return referenceResponse();
                if (url.includes("/activity")) return activityResponse();
                if (init?.method === "PATCH") {
                    patchCount += 1;
                    if (failureKind === "network") throw new Error("socket reset");
                    if (failureKind === "server") {
                        return apiResponse({ error: "internal server exception" }, 500);
                    }
                    return apiResponse({ success: true, ticket: { id: 19 } });
                }
                detailReadCount += 1;
                return detailResponse(detailReadCount === 1 ? ticket : latestTicket);
            });

            render(<ITTicketOperatorDetail ticketId={19} capabilities={operatorCapabilities} />);

            fireEvent.click(await screen.findByRole("button", { name: "เริ่มดำเนินการ" }));

            const ambiguousText = await screen.findByText(
                "ไม่สามารถยืนยันผลการบันทึกล่าสุดได้ ระบบโหลดข้อมูล Ticket ล่าสุดแล้ว กรุณาตรวจสอบข้อมูลก่อนดำเนินการต่อ",
            );
            const ambiguousAlert = ambiguousText.closest('[role="alert"]');
            expect(ambiguousAlert).toHaveTextContent(
                "ไม่สามารถยืนยันผลการบันทึกล่าสุดได้ ระบบโหลดข้อมูล Ticket ล่าสุดแล้ว กรุณาตรวจสอบข้อมูลก่อนดำเนินการต่อ",
            );
            expect(ambiguousAlert).not.toHaveTextContent(/เปลี่ยนแปลงจากผู้ใช้อื่น|รุ่น|version|revision/i);
            await waitFor(() => expect(detailReadCount).toBe(2));
            expect(toast.error).toHaveBeenCalledWith(
                "ไม่สามารถยืนยันผลการบันทึกได้ กำลังโหลดข้อมูลล่าสุด",
            );
            expect(toast.error).toHaveBeenCalledTimes(1);
            expect(sonnerToast.error.mock.calls.flat().join(" ")).not.toContain("internal server exception");
            expect(screen.queryByText("internal server exception")).not.toBeInTheDocument();
            expect(screen.getByRole("button", { name: "รอข้อมูลจากผู้แจ้ง" })).toBeDisabled();
            expect(screen.getByRole("button", { name: "บันทึกผู้รับผิดชอบ" })).toBeDisabled();
            expect(screen.getByRole("button", { name: "บันทึกหมวดหมู่" })).toBeDisabled();
            expect(screen.queryByText(/รุ่น \d+/)).not.toBeInTheDocument();
            expect(toast.success).not.toHaveBeenCalled();
            expect(patchCount).toBe(1);

            fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบข้อมูลล่าสุดแล้ว" }));
            expect(screen.getByRole("button", { name: "บันทึกผู้รับผิดชอบ" })).toBeEnabled();
            expect(patchCount).toBe(1);
        },
    );
});
