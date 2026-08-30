import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    search: "",
    fetchHome: vi.fn(),
    fetchItems: vi.fn(),
    fetchCategories: vi.fn(),
    fetchMyRequests: vi.fn(),
    fetchProcessing: vi.fn(),
    fetchRequest: vi.fn(),
    submitRequest: vi.fn(),
    cancelRequest: vi.fn(),
    issueRequest: vi.fn(),
    useLiffWorkforce: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useSearchParams: () => new URLSearchParams(mocks.search),
}));

vi.mock("@/components/liff/LiffBootstrap", () => ({
    useLiffWorkforce: mocks.useLiffWorkforce,
}));

vi.mock("@/lib/client/liff-home", () => ({
    fetchLiffHome: mocks.fetchHome,
}));

vi.mock("@/lib/client/liff-stock", () => ({
    fetchLiffStockItems: mocks.fetchItems,
    fetchLiffStockCategories: mocks.fetchCategories,
    fetchLiffStockMyRequests: mocks.fetchMyRequests,
    fetchLiffStockProcessingQueue: mocks.fetchProcessing,
    fetchLiffStockRequest: mocks.fetchRequest,
    submitLiffStockRequest: mocks.submitRequest,
    cancelLiffStockRequest: mocks.cancelRequest,
    issueLiffStockRequest: mocks.issueRequest,
}));

import { LiffStockApp } from "@/components/liff/stock/LiffStockApp";

const EMPTY_REQUESTS = {
    requests: [],
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
};

const CATALOG = {
    items: [{
        id: 10,
        name: "กระดาษ A4",
        description: "กระดาษสำนักงาน",
        imageUrl: null,
        sku: "PAPER-A4",
        unit: "รีม",
        availableQuantity: 5,
        category: { id: 2, name: "เครื่องเขียน" },
        variants: [{
            id: 101,
            sku: "PAPER-A4-80",
            unit: "รีม",
            imageUrl: null,
            availableQuantity: 5,
            attributeValues: [{
                attributeValue: {
                    value: "80 แกรม",
                    attribute: { name: "ความหนา" },
                },
            }],
        }],
    }],
    total: 1,
    page: 1,
    limit: 12,
    totalPages: 1,
};

const PROCESSOR_DETAIL = {
    id: 71,
    projectCode: "NHF-2569",
    status: "PENDING_ISSUE" as const,
    note: null,
    cancelReason: null,
    issuedAt: null,
    cancelledAt: null,
    createdAt: "2026-08-30T03:00:00.000Z",
    requester: { name: "พนักงาน ทดสอบ" },
    items: [{
        itemName: "กระดาษ A4",
        itemSku: "PAPER-A4",
        variantSku: "PAPER-A4-80",
        variantLabel: "ความหนา: 80 แกรม",
        unit: "รีม",
        quantity: 2,
        imageUrl: null,
        currentQuantity: 5,
        isAvailableForIssue: true,
    }],
    availableActions: ["ISSUE", "CANCEL"] as const,
    viewerRole: "PROCESSOR" as const,
};

describe("LIFF Stock app orchestration", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        window.localStorage.clear();
        mocks.search = "";
        mocks.useLiffWorkforce.mockReturnValue({
            userId: 7,
            employeeId: 70,
            name: "พนักงาน ทดสอบ",
        });
        mocks.fetchHome.mockResolvedValue({
            workforce: { userId: 7, employeeId: 70, name: "พนักงาน ทดสอบ" },
            modules: {},
            capabilities: { canProcessStockRequests: false },
        });
        mocks.fetchItems.mockResolvedValue(CATALOG);
        mocks.fetchCategories.mockResolvedValue([{ id: 2, name: "เครื่องเขียน" }]);
        mocks.fetchMyRequests.mockResolvedValue(EMPTY_REQUESTS);
        mocks.fetchProcessing.mockResolvedValue(EMPTY_REQUESTS);
        mocks.fetchRequest.mockResolvedValue(PROCESSOR_DETAIL);
        mocks.issueRequest.mockResolvedValue(undefined);
        mocks.cancelRequest.mockResolvedValue(undefined);
    });

    it("loads employee Stock without requesting the processor queue", async () => {
        render(<LiffStockApp />);

        expect(await screen.findByRole("heading", { name: "เลือกวัสดุที่ต้องการเบิก" }))
            .toBeInTheDocument();
        expect(await screen.findByText("กระดาษ A4")).toBeInTheDocument();
        expect(screen.queryByRole("tab", { name: /รอดำเนินการ/ }))
            .not.toBeInTheDocument();
        expect(mocks.fetchProcessing).not.toHaveBeenCalled();

        fireEvent.mouseDown(screen.getByRole("tab", { name: "คำขอของฉัน" }), {
            button: 0,
            ctrlKey: false,
        });
        expect(await screen.findByRole("heading", { name: "ยังไม่มีประวัติการเบิก" }))
            .toBeInTheDocument();
    });

    it("keeps employee workflows usable when only the processor queue fails", async () => {
        mocks.fetchHome.mockResolvedValueOnce({
            workforce: { userId: 1, employeeId: 10, name: "ผู้ดูแล ทดสอบ" },
            modules: {},
            capabilities: { canProcessStockRequests: true },
        });
        mocks.fetchProcessing.mockRejectedValueOnce(new Error("queue unavailable"));

        render(<LiffStockApp />);

        expect(await screen.findByText("กระดาษ A4")).toBeInTheDocument();
        const processingTab = await screen.findByRole("tab", { name: /รอดำเนินการ/ });
        fireEvent.mouseDown(processingTab, { button: 0, ctrlKey: false });
        expect(await screen.findByRole("heading", { name: "โหลดคิวรอดำเนินการไม่สำเร็จ" }))
            .toBeInTheDocument();
        fireEvent.mouseDown(screen.getByRole("tab", { name: "เบิกวัสดุ" }), {
            button: 0,
            ctrlKey: false,
        });
        expect(screen.getByRole("heading", { name: "เลือกวัสดุที่ต้องการเบิก" }))
            .toBeInTheDocument();
    });

    it("opens a processor deep link independently and never auto-issues", async () => {
        mocks.search = "requestId=71&action=issue";

        render(<LiffStockApp />);

        expect(await screen.findByText(
            "เปิดจากลิงก์เพื่อดำเนินการ กรุณาตรวจรายละเอียดและกดยืนยันด้วยตนเอง",
        )).toBeInTheDocument();
        expect(mocks.fetchRequest).toHaveBeenCalledWith(71);
        expect(mocks.issueRequest).not.toHaveBeenCalled();

        const detailIssueButton = screen.getByRole("button", { name: "จ่ายวัสดุ" });
        fireEvent.click(detailIssueButton);
        expect(mocks.issueRequest).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" }));

        await waitFor(() => expect(mocks.issueRequest).toHaveBeenCalledWith(71));
    });

    it("rejects malformed deep links without calling the detail API", async () => {
        mocks.search = "requestId=../71&action=issue";
        render(<LiffStockApp />);

        expect(await screen.findByText(
            "ลิงก์คำขอเบิกไม่ถูกต้อง กำลังแสดง Stock ตามปกติ",
        )).toBeInTheDocument();
        expect(mocks.fetchRequest).not.toHaveBeenCalled();
    });
});
