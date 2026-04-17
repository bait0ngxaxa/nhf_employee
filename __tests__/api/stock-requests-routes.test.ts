import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as NextServerModule from "next/server";
import { GET as getRequestsRoute, POST as postRequestsRoute } from "@/app/api/stock/requests/route";
import { POST as issueRequestRoute } from "@/app/api/stock/requests/[id]/issue/route";
import { POST as cancelRequestRoute } from "@/app/api/stock/requests/[id]/cancel/route";
import { getApiAuthSession } from "@/lib/server-auth";
import { buildUserContext } from "@/lib/context";
import { isAdminRole } from "@/lib/ssot/permissions";
import { stockService } from "@/lib/services/stock";
import { processOutbox } from "@/lib/services/outbox/processor";
import { logStockEvent } from "@/lib/audit";
import {
    enqueueLineLowStockReached,
    enqueueLineNewStockRequest,
    notifyAdminsNewStockRequest,
    notifyAdminsStockRequestCancelledByRequester,
    notifyStockRequestResult,
} from "@/lib/services/stock/notifications";

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return {
        ...actual,
        after: vi.fn((callback: () => void | Promise<void>) => {
            void callback();
        }),
    };
});

vi.mock("@/lib/server-auth", () => ({
    getApiAuthSession: vi.fn(),
}));

vi.mock("@/lib/context", () => ({
    buildUserContext: vi.fn(),
}));

vi.mock("@/lib/ssot/permissions", () => ({
    isAdminRole: vi.fn(),
}));

vi.mock("@/lib/services/stock", () => ({
    stockService: {
        getRequests: vi.fn(),
        createRequest: vi.fn(),
        issueRequest: vi.fn(),
        cancelRequest: vi.fn(),
    },
}));

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
    logStockEvent: vi.fn(),
}));

vi.mock("@/lib/services/stock/notifications", () => ({
    notifyAdminsNewStockRequest: vi.fn(),
    enqueueLineNewStockRequest: vi.fn(),
    notifyStockRequestResult: vi.fn(),
    enqueueLineLowStockReached: vi.fn(),
    notifyAdminsStockRequestCancelledByRequester: vi.fn(),
}));

describe("Stock Request Routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(processOutbox).mockResolvedValue({
            processed: 0,
            failed: 0,
        } as never);
    });

    describe("GET /api/stock/requests", () => {
        it("should return 401 when unauthorized", async () => {
            vi.mocked(getApiAuthSession).mockResolvedValue(null);

            const request = new NextRequest(
                "http://localhost/api/stock/requests?scope=all",
            );
            const response = await getRequestsRoute(request);

            expect(response.status).toBe(401);
        });

        it("should pass admin scope all and search to service", async () => {
            vi.mocked(getApiAuthSession).mockResolvedValue({
                user: { id: "1", email: "admin@test.com", role: "ADMIN" },
            } as never);
            vi.mocked(buildUserContext).mockReturnValue({
                id: 1,
                email: "admin@test.com",
                role: "ADMIN",
                name: "Admin",
            });
            vi.mocked(isAdminRole).mockReturnValue(true);
            vi.mocked(stockService.getRequests).mockResolvedValue({
                requests: [],
                total: 0,
                page: 1,
                limit: 10,
            } as never);

            const request = new NextRequest(
                "http://localhost/api/stock/requests?scope=all&search=PRJ-2569&page=1&limit=10",
            );
            const response = await getRequestsRoute(request);
            const data = await response.json();

            expect(response.status).toBe(200);
            expect(data.total).toBe(0);
            expect(stockService.getRequests).toHaveBeenCalledWith(
                expect.objectContaining({
                    search: "PRJ-2569",
                    page: 1,
                    limit: 10,
                }),
                1,
                true,
                "all",
            );
        });
    });

    describe("POST /api/stock/requests", () => {
        it("should reject invalid request payload", async () => {
            vi.mocked(getApiAuthSession).mockResolvedValue({
                user: { id: "3", email: "user@test.com", role: "USER" },
            } as never);
            vi.mocked(buildUserContext).mockReturnValue({
                id: 3,
                email: "user@test.com",
                role: "USER",
                name: "User",
            });

            const request = new NextRequest("http://localhost/api/stock/requests", {
                method: "POST",
                body: JSON.stringify({ items: [] }),
            });
            const response = await postRequestsRoute(request);

            expect(response.status).toBe(400);
            expect(stockService.createRequest).not.toHaveBeenCalled();
        });

        it("should create request and enqueue line notification", async () => {
            vi.mocked(getApiAuthSession).mockResolvedValue({
                user: { id: "3", email: "user@test.com", name: "User", role: "USER" },
            } as never);
            vi.mocked(buildUserContext).mockReturnValue({
                id: 3,
                email: "user@test.com",
                role: "USER",
                name: "User",
            });
            vi.mocked(stockService.createRequest).mockResolvedValue({
                id: 7001,
                projectCode: "PRJ-2569/01",
            } as never);

            const request = new NextRequest("http://localhost/api/stock/requests", {
                method: "POST",
                body: JSON.stringify({
                    projectCode: "prj-2569/01",
                    items: [{ itemId: 10, quantity: 1 }],
                }),
            });
            const response = await postRequestsRoute(request);

            expect(response.status).toBe(201);
            expect(stockService.createRequest).toHaveBeenCalledWith(
                expect.objectContaining({
                    projectCode: "PRJ-2569/01",
                }),
                3,
            );
            expect(notifyAdminsNewStockRequest).toHaveBeenCalledWith(
                7001,
                "User",
                "PRJ-2569/01",
            );
            expect(enqueueLineNewStockRequest).toHaveBeenCalledTimes(1);
            expect(processOutbox).toHaveBeenCalledTimes(1);
            expect(logStockEvent).toHaveBeenCalledWith(
                "STOCK_REQUEST_CREATE",
                7001,
                3,
                "user@test.com",
                expect.any(Object),
            );
        });
    });

    describe("POST /api/stock/requests/[id]/issue", () => {
        it("should block non-admin user", async () => {
            vi.mocked(getApiAuthSession).mockResolvedValue({
                user: { id: "4", email: "user@test.com", role: "USER" },
            } as never);
            vi.mocked(buildUserContext).mockReturnValue({
                id: 4,
                email: "user@test.com",
                role: "USER",
                name: "User",
            });
            vi.mocked(isAdminRole).mockReturnValue(false);

            const request = new NextRequest(
                "http://localhost/api/stock/requests/77/issue",
                {
                    method: "POST",
                    body: JSON.stringify({}),
                },
            );
            const response = await issueRequestRoute(request, {
                params: Promise.resolve({ id: "77" }),
            });

            expect(response.status).toBe(403);
            expect(stockService.issueRequest).not.toHaveBeenCalled();
        });

        it("should issue request and enqueue low-stock line notification", async () => {
            vi.mocked(getApiAuthSession).mockResolvedValue({
                user: { id: "1", email: "admin@test.com", role: "ADMIN" },
            } as never);
            vi.mocked(buildUserContext).mockReturnValue({
                id: 1,
                email: "admin@test.com",
                role: "ADMIN",
                name: "Admin",
            });
            vi.mocked(isAdminRole).mockReturnValue(true);
            vi.mocked(stockService.issueRequest).mockResolvedValue({
                request: { id: 77, requestedBy: 3 },
                lowStockAlerts: [
                    {
                        itemId: 10,
                        name: "ปากกา",
                        sku: "PEN-001",
                        quantity: 3,
                        minStock: 5,
                        unit: "ด้าม",
                    },
                ],
            } as never);

            const request = new NextRequest(
                "http://localhost/api/stock/requests/77/issue",
                {
                    method: "POST",
                    body: JSON.stringify({}),
                },
            );
            const response = await issueRequestRoute(request, {
                params: Promise.resolve({ id: "77" }),
            });

            expect(response.status).toBe(200);
            expect(stockService.issueRequest).toHaveBeenCalledWith(77, 1);
            expect(notifyStockRequestResult).toHaveBeenCalledWith(77, 3, true);
            expect(enqueueLineLowStockReached).toHaveBeenCalledTimes(1);
            expect(processOutbox).toHaveBeenCalledTimes(1);
        });
    });

    describe("POST /api/stock/requests/[id]/cancel", () => {
        it("should cancel request and notify admins when cancelled by non-admin", async () => {
            vi.mocked(getApiAuthSession).mockResolvedValue({
                user: { id: "5", email: "user@test.com", role: "USER" },
            } as never);
            vi.mocked(buildUserContext).mockReturnValue({
                id: 5,
                email: "user@test.com",
                role: "USER",
                name: "Somchai",
            });
            vi.mocked(isAdminRole).mockReturnValue(false);
            vi.mocked(stockService.cancelRequest).mockResolvedValue({
                id: 55,
                requestedBy: 3,
            } as never);

            const request = new NextRequest(
                "http://localhost/api/stock/requests/55/cancel",
                {
                    method: "POST",
                    body: JSON.stringify({ cancelReason: "ทดสอบยกเลิก" }),
                },
            );
            const response = await cancelRequestRoute(request, {
                params: Promise.resolve({ id: "55" }),
            });

            expect(response.status).toBe(200);
            expect(stockService.cancelRequest).toHaveBeenCalledWith(
                55,
                5,
                "ทดสอบยกเลิก",
                { isAdmin: false },
            );
            expect(notifyStockRequestResult).toHaveBeenCalledWith(
                55,
                3,
                false,
                "ทดสอบยกเลิก",
            );
            expect(notifyAdminsStockRequestCancelledByRequester).toHaveBeenCalledWith(
                55,
                "Somchai",
            );
        });
    });
});
