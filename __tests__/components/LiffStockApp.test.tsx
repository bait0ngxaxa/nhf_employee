import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";

import { LiffApiError } from "@/lib/client/liff";
import type {
    LiffStockCatalogResponse,
    LiffStockRequestAction,
    LiffStockRequestDetail,
    LiffStockRequestSummary,
    LiffStockRequestsResponse,
    LiffStockVariantAvailability,
} from "@/lib/types/stock-liff";

const mocks = vi.hoisted(() => ({
    search: "",
    fetchHome: vi.fn(),
    fetchItems: vi.fn(),
    fetchCategories: vi.fn(),
    fetchMyRequests: vi.fn(),
    fetchProcessing: vi.fn(),
    fetchRequest: vi.fn(),
    fetchAvailability: vi.fn(),
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
    fetchLiffStockVariantAvailability: mocks.fetchAvailability,
    submitLiffStockRequest: mocks.submitRequest,
    cancelLiffStockRequest: mocks.cancelRequest,
    issueLiffStockRequest: mocks.issueRequest,
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
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

type Deferred<T> = {
    promise: Promise<T>;
    resolve: (value: T) => void;
    reject: (reason?: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
    let resolvePromise: ((value: T) => void) | undefined;
    let rejectPromise: ((reason?: unknown) => void) | undefined;
    const promise = new Promise<T>((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
    });

    return {
        promise,
        resolve: (value) => resolvePromise?.(value),
        reject: (reason) => rejectPromise?.(reason),
    };
}

function createCatalogResponse(
    name: string,
    itemId: number,
): LiffStockCatalogResponse {
    const sourceItem = CATALOG.items[0];
    return {
        ...CATALOG,
        items: [{
            ...sourceItem,
            id: itemId,
            name,
            sku: `SKU-${itemId}`,
            variants: sourceItem.variants.map((variant) => ({
                ...variant,
                id: itemId * 10 + 1,
                sku: `SKU-${itemId}-VARIANT`,
            })),
        }],
    };
}

function createRequestSummary(
    id: number,
    projectCode: string,
    requester = false,
): LiffStockRequestSummary {
    return {
        id,
        projectCode,
        status: "PENDING_ISSUE",
        note: null,
        cancelReason: null,
        issuedAt: null,
        cancelledAt: null,
        createdAt: "2026-08-30T03:00:00.000Z",
        ...(requester ? { requester: { name: "ผู้เบิก ทดสอบ" } } : {}),
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
        availableActions: requester ? ["ISSUE", "CANCEL"] : ["CANCEL"],
    };
}

function createRequestsResponse(
    requests: LiffStockRequestSummary[],
): LiffStockRequestsResponse {
    return {
        requests,
        total: requests.length,
        page: 1,
        limit: 10,
        totalPages: requests.length > 0 ? 1 : 0,
    };
}

function createProcessorDetail(
    id: number,
    currentQuantity: number,
    availableActions: LiffStockRequestAction[] = ["ISSUE", "CANCEL"],
): LiffStockRequestDetail {
    return {
        ...PROCESSOR_DETAIL,
        id,
        items: [{
            ...PROCESSOR_DETAIL.items[0],
            currentQuantity,
            isAvailableForIssue: currentQuantity >= PROCESSOR_DETAIL.items[0].quantity,
        }],
        availableActions,
    };
}

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
        mocks.fetchAvailability.mockResolvedValue([]);
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

    it("refreshes processor detail after an issue conflict without retrying", async () => {
        mocks.search = "requestId=71&action=issue";
        const refreshedDetail = {
            ...createProcessorDetail(71, 1, []),
            status: "ISSUED" as const,
            issuedAt: "2026-08-31T03:00:00.000Z",
        };
        mocks.issueRequest.mockRejectedValueOnce(
            new LiffApiError("สต็อกเปลี่ยนแปลง", 409),
        );

        render(<LiffStockApp />);

        expect(await screen.findByText(
            "เปิดจากลิงก์เพื่อดำเนินการ กรุณาตรวจรายละเอียดและกดยืนยันด้วยตนเอง",
        )).toBeInTheDocument();
        mocks.fetchRequest.mockResolvedValueOnce(refreshedDetail);

        fireEvent.click(screen.getByRole("button", { name: "จ่ายวัสดุ" }));
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" }));

        await waitFor(() => {
            expect(mocks.issueRequest).toHaveBeenCalledTimes(1);
            expect(mocks.fetchRequest).toHaveBeenCalledTimes(2);
        });
        expect(screen.queryByRole("button", { name: "ยืนยันจ่ายวัสดุ" }))
            .not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ปิดหน้าต่างยืนยัน" }));
        expect(await screen.findByText(/คงเหลือจริง 1 รีม/)).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "จ่ายวัสดุ" }))
            .not.toBeInTheDocument();
        expect(mocks.issueRequest).toHaveBeenCalledTimes(1);
    });

    it("reconciles stale cart quantities after a Stock conflict", async () => {
        const latestCatalog = {
            ...CATALOG,
            items: [{
                ...CATALOG.items[0],
                availableQuantity: 2,
                variants: [{
                    ...CATALOG.items[0].variants[0],
                    availableQuantity: 2,
                }],
            }],
        };
        mocks.submitRequest.mockRejectedValueOnce(
            new LiffApiError("สต็อกเปลี่ยนแปลง", 409),
        );
        mocks.fetchAvailability.mockResolvedValueOnce([
            { id: 101, availableQuantity: 2 },
        ]);

        render(<LiffStockApp />);
        expect(await screen.findByText("กระดาษ A4")).toBeInTheDocument();
        mocks.fetchItems.mockResolvedValueOnce(latestCatalog);

        fireEvent.click(screen.getByRole("button", { name: "เพิ่มลงตะกร้า" }));
        fireEvent.click(screen.getByRole("button", { name: /เปิดตะกร้า/ }));
        const increaseButton = screen.getByRole("button", {
            name: "เพิ่มจำนวน กระดาษ A4",
        });
        for (let index = 0; index < 4; index += 1) {
            fireEvent.click(increaseButton);
        }
        fireEvent.change(screen.getByLabelText("ชื่อย่อโครงการ"), {
            target: { value: "NHF-2569" },
        });
        fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอเบิก 5 ชิ้น" }));

        await waitFor(() => expect(mocks.submitRequest).toHaveBeenCalledTimes(1));
        expect(await screen.findByRole("button", { name: "ส่งคำขอเบิก 2 ชิ้น" }))
            .toBeInTheDocument();
        expect(toast.info).toHaveBeenCalledWith(
            "จำนวนวัสดุบางรายการถูกปรับตามสต็อกล่าสุด",
        );
    });

    it("preserves the exact retry payload and key after an ambiguous failure", async () => {
        const latestCatalog = {
            ...CATALOG,
            items: [{
                ...CATALOG.items[0],
                availableQuantity: 3,
                variants: [{
                    ...CATALOG.items[0].variants[0],
                    availableQuantity: 3,
                }],
            }],
        };
        mocks.fetchItems.mockImplementation(({ search }: { search?: string }) =>
            search === "ล่าสุด" ? Promise.resolve(latestCatalog) : Promise.resolve(CATALOG));
        mocks.submitRequest
            .mockRejectedValueOnce(new Error("network unavailable"))
            .mockResolvedValueOnce(undefined);

        render(<LiffStockApp />);
        expect(await screen.findByText("กระดาษ A4")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มลงตะกร้า" }));
        fireEvent.click(screen.getByRole("button", { name: /เปิดตะกร้า/ }));
        const increaseButton = screen.getByRole("button", {
            name: "เพิ่มจำนวน กระดาษ A4",
        });
        for (let index = 0; index < 4; index += 1) {
            fireEvent.click(increaseButton);
        }
        fireEvent.change(screen.getByLabelText("ชื่อย่อโครงการ"), {
            target: { value: "NHF-2569" },
        });
        fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอเบิก 5 ชิ้น" }));

        await waitFor(() => expect(mocks.submitRequest).toHaveBeenCalledTimes(1));
        const firstPayload = mocks.submitRequest.mock.calls[0]?.[0];
        const firstKey = mocks.submitRequest.mock.calls[0]?.[1];
        expect(firstKey).toBeTruthy();
        expect(mocks.fetchAvailability).not.toHaveBeenCalled();

        fireEvent.click(screen.getByRole("button", { name: "ปิดตะกร้า" }));
        fireEvent.change(screen.getByLabelText("ค้นหาวัสดุ"), {
            target: { value: "ล่าสุด" },
        });
        await waitFor(() => expect(mocks.fetchItems).toHaveBeenCalledWith(
            expect.objectContaining({ search: "ล่าสุด" }),
        ));
        fireEvent.click(screen.getByRole("button", { name: /เปิดตะกร้า/ }));

        expect(await screen.findByRole("button", { name: "ส่งคำขอเบิก 5 ชิ้น" }))
            .toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอเบิก 5 ชิ้น" }));

        await waitFor(() => expect(mocks.submitRequest).toHaveBeenCalledTimes(2));
        expect(mocks.submitRequest.mock.calls[1]?.[0]).toEqual(firstPayload);
        expect(mocks.submitRequest.mock.calls[1]?.[1]).toBe(firstKey);
        expect(mocks.fetchAvailability).not.toHaveBeenCalled();
    });

    it("refreshes all cart variants with targeted availability after a deterministic conflict", async () => {
        window.localStorage.setItem("stock:browse-cart:v1:user:7", JSON.stringify({
            projectCode: "NHF-2569",
            cartItems: [
                {
                    itemId: 10,
                    itemName: "กระดาษ A4",
                    itemImageUrl: null,
                    variantId: 101,
                    variantSku: "PAPER-A4-80",
                    variantUnit: "รีม",
                    variantImageUrl: null,
                    variantAvailableQuantity: 8,
                    qty: 5,
                },
                {
                    itemId: 20,
                    itemName: "ปากกา",
                    itemImageUrl: null,
                    variantId: 202,
                    variantSku: "PEN-BLUE",
                    variantUnit: "ด้าม",
                    variantImageUrl: null,
                    variantAvailableQuantity: 2,
                    qty: 2,
                },
            ],
            pendingIdempotency: null,
        }));
        mocks.submitRequest.mockRejectedValueOnce(
            new LiffApiError("สต็อกเปลี่ยนแปลง", 409),
        ).mockResolvedValueOnce(undefined);
        mocks.fetchAvailability.mockResolvedValueOnce([
            { id: 101, availableQuantity: 3 },
            { id: 202, availableQuantity: 0 },
        ]);

        render(<LiffStockApp />);
        expect(await screen.findByText("กระดาษ A4")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /เปิดตะกร้า/ }));
        fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอเบิก 7 ชิ้น" }));

        await waitFor(() => expect(mocks.fetchAvailability).toHaveBeenCalledWith([
            101,
            202,
        ]));
        expect(await screen.findByRole("button", { name: "ส่งคำขอเบิก 3 ชิ้น" }))
            .toBeInTheDocument();
        expect(screen.queryByText("ปากกา")).not.toBeInTheDocument();
        expect(mocks.submitRequest).toHaveBeenCalledTimes(1);
        expect(toast.info).toHaveBeenCalledWith(
            "จำนวนวัสดุบางรายการถูกปรับตามสต็อกล่าสุด และวัสดุที่ไม่มีสต็อกพร้อมเบิกถูกนำออกจากตะกร้า",
        );

        const firstKey = mocks.submitRequest.mock.calls[0]?.[1];
        fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอเบิก 3 ชิ้น" }));
        await waitFor(() => expect(mocks.submitRequest).toHaveBeenCalledTimes(2));
        expect(mocks.submitRequest.mock.calls[1]?.[0]).toMatchObject({
            projectCode: "NHF-2569",
            items: [{ itemId: 10, variantId: 101, quantity: 3 }],
        });
        expect(mocks.submitRequest.mock.calls[1]?.[1]).not.toBe(firstKey);
    });

    it("keeps the newest targeted availability response when conflict refreshes overlap", async () => {
        const availabilityA = createDeferred<LiffStockVariantAvailability[]>();
        const availabilityB = createDeferred<LiffStockVariantAvailability[]>();
        mocks.submitRequest
            .mockRejectedValueOnce(new LiffApiError("สต็อกเปลี่ยนแปลง", 409))
            .mockRejectedValueOnce(new LiffApiError("สต็อกเปลี่ยนแปลง", 409));
        mocks.fetchAvailability
            .mockImplementationOnce(() => availabilityA.promise)
            .mockImplementationOnce(() => availabilityB.promise);

        render(<LiffStockApp />);
        expect(await screen.findByText("กระดาษ A4")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มลงตะกร้า" }));
        fireEvent.click(screen.getByRole("button", { name: /เปิดตะกร้า/ }));
        fireEvent.change(screen.getByLabelText("ชื่อย่อโครงการ"), {
            target: { value: "NHF-2569" },
        });
        fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอเบิก 1 ชิ้น" }));

        await waitFor(() => expect(mocks.fetchAvailability).toHaveBeenCalledTimes(1));
        fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอเบิก 1 ชิ้น" }));
        await waitFor(() => expect(mocks.fetchAvailability).toHaveBeenCalledTimes(2));

        availabilityB.resolve([{ id: 101, availableQuantity: 4, isAvailable: true }]);
        expect(await screen.findByText("พร้อมเบิก 4 รีม")).toBeInTheDocument();
        availabilityA.resolve([{ id: 101, availableQuantity: 0, isAvailable: false }]);
        await waitFor(() => {
            expect(screen.getByText("พร้อมเบิก 4 รีม")).toBeInTheDocument();
        });
        expect(screen.getByRole("button", { name: "ส่งคำขอเบิก 1 ชิ้น" }))
            .toBeInTheDocument();
    });

    it("keeps the newest catalog result and error state when older responses finish later", async () => {
        const catalogA = createDeferred<LiffStockCatalogResponse>();
        const catalogB = createDeferred<LiffStockCatalogResponse>();
        const resultB = createCatalogResponse("ผลลัพธ์ B", 202);
        mocks.fetchItems.mockImplementation(({ search }: { search?: string }) => {
            if (search === "กา") return catalogA.promise;
            if (search === "กระดาษ") return catalogB.promise;
            return Promise.resolve(CATALOG);
        });

        render(<LiffStockApp />);
        expect(await screen.findByText("กระดาษ A4")).toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("ค้นหาวัสดุ"), {
            target: { value: "กา" },
        });
        await waitFor(() => {
            expect(mocks.fetchItems).toHaveBeenCalledWith(
                expect.objectContaining({ search: "กา" }),
            );
        });

        fireEvent.change(screen.getByLabelText("ค้นหาวัสดุ"), {
            target: { value: "กระดาษ" },
        });
        await waitFor(() => {
            expect(mocks.fetchItems).toHaveBeenCalledWith(
                expect.objectContaining({ search: "กระดาษ" }),
            );
        });

        catalogB.resolve(resultB);
        expect(await screen.findByText("ผลลัพธ์ B")).toBeInTheDocument();
        catalogA.reject(new Error("old catalog failure"));
        await waitFor(() => expect(screen.getByText("ผลลัพธ์ B")).toBeInTheDocument());
        expect(screen.queryByRole("heading", { name: "โหลดรายการวัสดุไม่สำเร็จ" }))
            .not.toBeInTheDocument();
        expect(screen.queryByText("ผลลัพธ์ A")).not.toBeInTheDocument();
    });

    it("keeps the newest employee request history result", async () => {
        const requestA = createDeferred<LiffStockRequestsResponse>();
        const requestB = createDeferred<LiffStockRequestsResponse>();
        mocks.fetchMyRequests.mockImplementation(({ search }: { search?: string }) => {
            if (search === "เก่า") return requestA.promise;
            if (search === "ใหม่") return requestB.promise;
            return Promise.resolve(EMPTY_REQUESTS);
        });

        render(<LiffStockApp />);
        expect(await screen.findByText("กระดาษ A4")).toBeInTheDocument();
        fireEvent.mouseDown(screen.getByRole("tab", { name: "คำขอของฉัน" }), {
            button: 0,
            ctrlKey: false,
        });
        expect(await screen.findByRole("heading", { name: "ยังไม่มีประวัติการเบิก" }))
            .toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("ค้นหาคำขอเบิก"), {
            target: { value: "เก่า" },
        });
        await waitFor(() => {
            expect(mocks.fetchMyRequests).toHaveBeenCalledWith(
                expect.objectContaining({ search: "เก่า" }),
            );
        });
        fireEvent.change(screen.getByLabelText("ค้นหาคำขอเบิก"), {
            target: { value: "ใหม่" },
        });
        await waitFor(() => {
            expect(mocks.fetchMyRequests).toHaveBeenCalledWith(
                expect.objectContaining({ search: "ใหม่" }),
            );
        });

        requestB.resolve(createRequestsResponse([
            createRequestSummary(202, "PROJECT-B"),
        ]));
        expect(await screen.findByText("PROJECT-B")).toBeInTheDocument();
        requestA.resolve(createRequestsResponse([
            createRequestSummary(201, "PROJECT-A"),
        ]));
        await waitFor(() => expect(screen.getByText("PROJECT-B")).toBeInTheDocument());
        expect(screen.queryByText("PROJECT-A")).not.toBeInTheDocument();
    });

    it("keeps the newest processor queue result", async () => {
        const queueA = createDeferred<LiffStockRequestsResponse>();
        const queueB = createDeferred<LiffStockRequestsResponse>();
        mocks.fetchHome.mockResolvedValue({
            workforce: { userId: 7, employeeId: 70, name: "พนักงาน ทดสอบ" },
            modules: {},
            capabilities: { canProcessStockRequests: true },
        });
        mocks.fetchProcessing.mockImplementation(({ search }: { search?: string }) => {
            if (search === "เก่า") return queueA.promise;
            if (search === "ใหม่") return queueB.promise;
            return Promise.resolve(EMPTY_REQUESTS);
        });

        render(<LiffStockApp />);
        expect(await screen.findByText("กระดาษ A4")).toBeInTheDocument();
        const processingTab = await screen.findByRole("tab", { name: /รอดำเนินการ/ });
        fireEvent.mouseDown(processingTab, { button: 0, ctrlKey: false });
        expect(await screen.findByRole("heading", { name: "ไม่มีคำขอรอดำเนินการ" }))
            .toBeInTheDocument();

        fireEvent.change(screen.getByLabelText("ค้นหาคำขอรอดำเนินการ"), {
            target: { value: "เก่า" },
        });
        await waitFor(() => {
            expect(mocks.fetchProcessing).toHaveBeenCalledWith(
                expect.objectContaining({ search: "เก่า" }),
            );
        });
        fireEvent.change(screen.getByLabelText("ค้นหาคำขอรอดำเนินการ"), {
            target: { value: "ใหม่" },
        });
        await waitFor(() => {
            expect(mocks.fetchProcessing).toHaveBeenCalledWith(
                expect.objectContaining({ search: "ใหม่" }),
            );
        });

        queueB.resolve(createRequestsResponse([
            createRequestSummary(302, "QUEUE-B", true),
        ]));
        expect(await screen.findByText("QUEUE-B")).toBeInTheDocument();
        queueA.resolve(createRequestsResponse([
            createRequestSummary(301, "QUEUE-A", true),
        ]));
        await waitFor(() => expect(screen.getByText("QUEUE-B")).toBeInTheDocument());
        expect(screen.queryByText("QUEUE-A")).not.toBeInTheDocument();
    });

    it("keeps the newest request detail when two detail loads overlap", async () => {
        const detailA = createDeferred<LiffStockRequestDetail>();
        const detailB = createDeferred<LiffStockRequestDetail>();
        mocks.fetchMyRequests.mockResolvedValue(createRequestsResponse([
            createRequestSummary(10, "PROJECT-A"),
            createRequestSummary(20, "PROJECT-B"),
        ]));
        mocks.fetchRequest.mockImplementation((requestId: number) =>
            requestId === 10 ? detailA.promise : detailB.promise,
        );

        render(<LiffStockApp />);
        expect(await screen.findByText("กระดาษ A4")).toBeInTheDocument();
        fireEvent.mouseDown(screen.getByRole("tab", { name: "คำขอของฉัน" }), {
            button: 0,
            ctrlKey: false,
        });
        expect(await screen.findByText("PROJECT-A")).toBeInTheDocument();
        const detailButtons = screen.getAllByRole("button", { name: "รายละเอียด" });
        fireEvent.click(detailButtons[0]);
        fireEvent.click(detailButtons[1]);

        detailB.resolve(createProcessorDetail(20, 2));
        expect(await screen.findByRole("heading", { name: "รายละเอียดคำขอ #20" }))
            .toBeInTheDocument();
        detailA.resolve(createProcessorDetail(10, 5));
        await waitFor(() => {
            expect(screen.getByRole("heading", { name: "รายละเอียดคำขอ #20" }))
                .toBeInTheDocument();
        });
        expect(screen.queryByRole("heading", { name: "รายละเอียดคำขอ #10" }))
            .not.toBeInTheDocument();
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
