import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiGet, apiPost } from "@/lib/client/api-client";
import type { ApiResponse } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { StockRequest, StockDataContextValue, StockUIContextValue } from "../context/types";
import { StockAdminRequests } from "./StockAdminRequests";

const contextMocks = vi.hoisted(() => ({
    stockData: null as unknown,
    stockUI: null as unknown,
}));

vi.mock("../context", () => ({
    useStockDataContext: () => contextMocks.stockData,
    useStockUIContext: () => contextMocks.stockUI,
}));

vi.mock("@/components/Pagination", () => ({
    Pagination: () => null,
}));

vi.mock("@/lib/client/api-client", () => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

function success<T>(data: T): ApiResponse<T> {
    return {
        success: true,
        data,
        status: 200,
        requestId: "stock-admin-requests-test",
    };
}

function processedFailure(): ApiResponse<never> {
    return {
        success: false,
        error: "Request already processed",
        errorThai: "คำขอนี้ถูกดำเนินการแล้ว",
        code: "UNKNOWN_ERROR",
        status: 400,
    };
}

function requestStatusResponse(
    status: StockRequest["status"] | null,
): ApiResponse<{ requests: Array<{ id: number; status: StockRequest["status"] }> }> {
    return success({
        requests: status === null ? [] : [{ id: REQUEST.id, status }],
    });
}

const REQUEST: StockRequest = {
    id: 41,
    requestedBy: 7,
    projectCode: "NHF-2569",
    status: "PENDING_ISSUE",
    note: null,
    issuedById: null,
    issuedAt: null,
    cancelReason: null,
    cancelledById: null,
    cancelledAt: null,
    createdAt: "2026-08-30T03:00:00.000Z",
    requester: {
        id: 7,
        name: "ผู้เบิก ทดสอบ",
        email: "requester@example.com",
        employee: {
            firstName: "ผู้เบิก",
            lastName: "ทดสอบ",
            nickname: null,
        },
    },
    issuer: null,
    canceller: null,
    items: [
        {
            id: 88,
            itemId: 12,
            variantId: null,
            quantity: 3,
            item: { id: 12, name: "กระดาษ A4", sku: "PAPER-A4", unit: "รีม" },
            variant: null,
        },
    ],
};

const refreshRequests = vi.fn();
const refreshItems = vi.fn();

function setContexts(requests: StockRequest[] = [REQUEST]): void {
    const dataContext: StockDataContextValue = {
        categories: [],
        items: [],
        requests,
        totalItems: 0,
        totalRequests: requests.length,
        isLoading: false,
        isAdmin: true,
        stockCapabilities: {
            canReadCatalog: true,
            canReadOwnRequests: true,
            canReadAllRequests: true,
            canCreateRequests: true,
            canCancelOwnRequests: true,
            canCancelAnyRequests: true,
            canProcessRequests: true,
            canManageInventory: true,
            canExportReports: true,
        },
        refreshItems,
        refreshRequests,
        refreshCategories: vi.fn(),
    };
    const uiContext: StockUIContextValue = {
        activeTab: "admin-requests",
        setActiveTab: vi.fn(),
        itemsPage: 1,
        setItemsPage: vi.fn(),
        requestsPage: 1,
        setRequestsPage: vi.fn(),
        requestSearchQuery: "",
        setRequestSearchQuery: vi.fn(),
        searchQuery: "",
        setSearchQuery: vi.fn(),
        selectedCategoryId: undefined,
        setSelectedCategoryId: vi.fn(),
        statusFilter: undefined,
        setStatusFilter: vi.fn(),
    };
    contextMocks.stockData = dataContext;
    contextMocks.stockUI = uiContext;
}

function renderRequests() {
    setContexts();
    return render(<StockAdminRequests />);
}

describe("StockAdminRequests issue confirmation", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setContexts();
    });

    it("opens from mobile and desktop actions without mutating, and closes safely", async () => {
        vi.mocked(apiPost).mockResolvedValue(success({}));
        renderRequests();

        const issueButtons = screen.getAllByRole("button", { name: "จ่ายแล้ว" });
        expect(issueButtons).toHaveLength(2);

        fireEvent.click(issueButtons[0]);
        let dialog = await screen.findByRole("dialog");
        expect(within(dialog).getByText("รหัสโครงการ")).toBeInTheDocument();
        expect(within(dialog).getByText("NHF-2569")).toBeInTheDocument();
        expect(within(dialog).getByText("ผู้เบิก ทดสอบ")).toBeInTheDocument();
        expect(within(dialog).getByText("กระดาษ A4")).toBeInTheDocument();
        expect(within(dialog).getByText("3 รีม")).toBeInTheDocument();
        expect(within(dialog).getByText(/บันทึกการจ่ายวัสดุและปรับยอดคงเหลือ/)).toBeInTheDocument();
        await waitFor(() => {
            expect(screen.getByRole("button", { name: "กลับไปตรวจสอบ" })).toHaveFocus();
        });
        expect(apiPost).not.toHaveBeenCalled();

        fireEvent.keyDown(document, { key: "Escape" });
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(apiPost).not.toHaveBeenCalled();
        expect(screen.getAllByRole("button", { name: "จ่ายแล้ว" })[0]).toHaveFocus();

        fireEvent.click(screen.getAllByRole("button", { name: "จ่ายแล้ว" })[1]);
        dialog = await screen.findByRole("dialog");
        fireEvent.click(screen.getByRole("button", { name: "กลับไปตรวจสอบ" }));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
        expect(screen.getAllByRole("button", { name: "จ่ายแล้ว" })[1]).toHaveFocus();
        expect(apiPost).not.toHaveBeenCalled();
        expect(dialog).not.toBeInTheDocument();
    });

    it("confirms exactly once, refreshes requests and inventory, then closes", async () => {
        vi.mocked(apiPost).mockResolvedValue(success({}));
        renderRequests();

        fireEvent.click(screen.getAllByRole("button", { name: "จ่ายแล้ว" })[1]);
        await screen.findByRole("dialog");
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" }));

        await waitFor(() => {
            expect(apiPost).toHaveBeenCalledTimes(1);
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
        expect(apiPost).toHaveBeenCalledWith(API_ROUTES.stock.issueById(41), {});
        expect(refreshRequests).toHaveBeenCalledTimes(1);
        expect(refreshItems).toHaveBeenCalledTimes(1);
    });

    it("keeps retry available after a transient failure", async () => {
        vi.mocked(apiPost)
            .mockResolvedValueOnce({
                success: false,
                error: "Temporary server error",
                errorThai: "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง",
                code: "INTERNAL_ERROR",
                status: 500,
            })
            .mockResolvedValueOnce(success({}));
        renderRequests();

        fireEvent.click(screen.getAllByRole("button", { name: "จ่ายแล้ว" })[0]);
        await screen.findByRole("dialog");
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" }));

        expect(await screen.findByRole("alert")).toHaveTextContent("ระบบขัดข้องชั่วคราว");
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" })).toBeEnabled();
        expect(apiGet).not.toHaveBeenCalled();
        expect(refreshRequests).toHaveBeenCalledTimes(1);
        expect(refreshItems).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" }));
        await waitFor(() => {
            expect(apiPost).toHaveBeenCalledTimes(2);
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });

    it("blocks confirmation when the open request changes to ISSUED", async () => {
        const view = renderRequests();

        fireEvent.click(screen.getAllByRole("button", { name: "จ่ายแล้ว" })[0]);
        await screen.findByRole("dialog");

        setContexts([{ ...REQUEST, status: "ISSUED" }]);
        view.rerender(<StockAdminRequests />);

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "สถานะคำขอเปลี่ยนเป็น “จ่ายแล้ว” แล้ว",
        );
        expect(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" })).toBeDisabled();
        expect(apiPost).not.toHaveBeenCalled();
    });

    it("keeps confirmation blocked when a stale request disappears from the current result set", async () => {
        vi.mocked(apiPost).mockResolvedValueOnce(processedFailure());
        vi.mocked(apiGet).mockResolvedValue(requestStatusResponse(null));
        const view = renderRequests();

        fireEvent.click(screen.getAllByRole("button", { name: "จ่ายแล้ว" })[0]);
        await screen.findByRole("dialog");
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" }));

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "ไม่สามารถยืนยันสถานะล่าสุดของคำขอนี้ได้",
        );
        expect(apiGet).toHaveBeenCalledWith(
            `${API_ROUTES.stock.requests}?scope=all&search=41&page=1&limit=100`,
        );

        setContexts([]);
        view.rerender(<StockAdminRequests />);
        expect(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" })).toBeDisabled();
        expect(apiPost).toHaveBeenCalledTimes(1);

        vi.mocked(apiGet).mockResolvedValueOnce(requestStatusResponse(null));
        fireEvent.click(screen.getByRole("button", { name: "ตรวจสอบสถานะอีกครั้ง" }));
        await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
        expect(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" })).toBeDisabled();
        expect(apiPost).toHaveBeenCalledTimes(1);
    });

    it("allows retry only after an exact status check confirms the request is still pending", async () => {
        vi.mocked(apiPost)
            .mockResolvedValueOnce(processedFailure())
            .mockResolvedValueOnce(success({}));
        vi.mocked(apiGet).mockResolvedValueOnce(
            requestStatusResponse("PENDING_ISSUE"),
        );
        renderRequests();

        fireEvent.click(screen.getAllByRole("button", { name: "จ่ายแล้ว" })[0]);
        await screen.findByRole("dialog");
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" }));

        await waitFor(() => {
            expect(screen.getByText(/ตรวจสอบแล้ว คำขอยังอยู่ในสถานะรอจ่าย/)).toBeInTheDocument();
        });
        expect(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" })).toBeEnabled();

        fireEvent.click(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" }));
        await waitFor(() => {
            expect(apiPost).toHaveBeenCalledTimes(2);
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });

    it("blocks retry when the authoritative status check confirms another status", async () => {
        vi.mocked(apiPost).mockResolvedValueOnce(processedFailure());
        vi.mocked(apiGet).mockResolvedValueOnce(requestStatusResponse("ISSUED"));
        renderRequests();

        fireEvent.click(screen.getAllByRole("button", { name: "จ่ายแล้ว" })[0]);
        await screen.findByRole("dialog");
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" }));

        await waitFor(() => {
            expect(screen.getByRole("alert")).toHaveTextContent(
                "สถานะคำขอเปลี่ยนเป็น “จ่ายแล้ว” แล้ว",
            );
        });
        expect(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" })).toBeDisabled();
        expect(apiPost).toHaveBeenCalledTimes(1);
    });
});
