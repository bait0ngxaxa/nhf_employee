import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { StockVariantSkuConflictError } from "@/modules/stock";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { type NextRequest } from "next/server";
import type * as StockModule from "@/modules/stock";
import {
    DELETE as deleteItemRoute,
    PATCH as patchItemRoute,
} from "@/app/api/stock/items/[id]/route";
import { getApiAuthSession } from "@/lib/auth/server";
import { buildUserContext } from "@/lib/auth/context";
import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { isAdminRole } from "@/lib/ssot/permissions";
import {
    stockService,
    StockCapabilityDeniedError,
} from "@/modules/stock";
import { WorkforceAuthorizationError } from "@/lib/auth/workforce-transaction";
import type * as NextServerModule from "next/server";
import { POST as createCategoryRoute } from "@/app/api/stock/categories/route";
import { POST as createItemRoute } from "@/app/api/stock/items/route";
import { POST as adjustItemRoute } from "@/app/api/stock/items/[id]/adjust/route";
import { resetMutationRateLimit } from "@/lib/security/mutation-rate-limit";
import {
    DEFAULT_JSON_MUTATION_MAX_BYTES,
    REQUEST_BODY_TOO_LARGE_MESSAGE,
    STOCK_ITEM_JSON_MAX_REQUEST_BYTES,
} from "@/lib/ssot/request-limits";
import {
    buildJsonBodyRequest,
    CONTENT_LENGTH_MODES,
    jsonBodyOfExactBytes,
} from "@/__tests__/helpers/request-body-limit";
import {
    buildMaximalCreateItemPayload,
    buildMaximalUpdateItemPayload,
} from "@/__tests__/helpers/maximal-stock-payloads";
import { trustedNextRequest } from "@/__tests__/helpers/trusted-mutation";

const stockAuthorizationMock = vi.hoisted(() => ({
    assert: vi.fn(),
}));

vi.mock("next/server", async (importOriginal) => {
    const actual = await importOriginal<typeof NextServerModule>();
    return { ...actual, after: vi.fn((callback: () => unknown) => callback()) };
});

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: vi.fn(async () => undefined),
}));

vi.mock("@/lib/auth/server", () => ({
    getApiAuthSession: vi.fn(),
}));

vi.mock("@/lib/auth/context", () => ({
    buildUserContext: vi.fn(),
}));

vi.mock("@/lib/ssot/permissions", () => ({
    isAdminRole: vi.fn(),
}));

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceSession: vi.fn(),
}));

vi.mock("@/modules/stock", async () => {
    const actual = await vi.importActual<typeof StockModule>(
        "@/modules/stock",
    );
    return {
        ...actual,
        assertStockCapability: stockAuthorizationMock.assert,
        stockService: {
            ...actual.stockService,
            updateItem: vi.fn(),
            createCategory: vi.fn(),
            createItem: vi.fn(),
            adjustStock: vi.fn(),
        },
    };
});

const adminSession = {
    user: { id: "1", email: "admin@test.com", role: "ADMIN" },
};

const updatedItem = {
    id: 42,
    name: "ปากกาใหม่",
    sku: "PEN-002",
    isActive: true,
};

function mockAdmin(): void {
    vi.mocked(getApiAuthSession).mockResolvedValue(adminSession as never);
    vi.mocked(buildUserContext).mockReturnValue({
        id: 1,
        email: "admin@test.com",
        role: "ADMIN",
        name: "Admin",
    });
    vi.mocked(isAdminRole).mockReturnValue(true);
    vi.mocked(requireActiveWorkforceSession).mockResolvedValue({
        ok: true,
        user: {
            id: 1,
            email: "admin@test.com",
            role: "ADMIN",
            name: "Admin",
        },
    } as never);
}

describe("Stock Item Routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAdmin();
        stockAuthorizationMock.assert.mockResolvedValue({
            actor: {
                userId: 1,
                employeeId: null,
                systemRole: "ADMIN",
                channel: "DASHBOARD",
            },
            capability: "stock.inventory.manage",
            decision: {
                capability: "stock.inventory.manage",
                allowed: true,
                scopes: ["ALL"],
                grants: [],
            },
            scopes: ["ALL"],
            defaultScopes: [],
            isAdministrative: true,
        });
    });

    it.each(["POST", "PATCH"])("%s maps pre-check and raced P2002 to the same 409", async (method) => {
        for (const error of [new StockVariantSkuConflictError(), new PrismaClientKnownRequestError(
            "Unique constraint failed", { code: "P2002", clientVersion: "test" },
        )]) {
            const mutation = method === "POST" ? stockService.createItem : stockService.updateItem;
            vi.mocked(mutation).mockRejectedValueOnce(error);
            const request = trustedNextRequest("http://localhost/api/stock/items/42", {
                method, body: JSON.stringify({ name: "วัสดุ", categoryId: 1, variants: [{ unit: "ชิ้น", quantity: 1, minStock: 1 }] }),
            });
            const response = method === "POST" ? await createItemRoute(request) : await patchItemRoute(request, { params: Promise.resolve({ id: "42" }) });
            expect(response.status).toBe(409);
            expect(await response.json()).toMatchObject({ error: "รหัสวัสดุ (SKU) นี้มีอยู่แล้ว" });
        }
    });

    it("passes request audit context when updating an item", async () => {
        vi.mocked(stockService.updateItem).mockResolvedValue(updatedItem as never);
        const request = trustedNextRequest("http://localhost/api/stock/items/42", {
            method: "PATCH",
            headers: { "user-agent": "stock-route-test" },
            body: JSON.stringify({ name: "ปากกาใหม่" }),
        });

        const response = await patchItemRoute(request, {
            params: Promise.resolve({ id: "42" }),
        });

        expect(response.status).toBe(200);
        expect(stockService.updateItem).toHaveBeenCalledWith(
            42,
            { name: "ปากกาใหม่" },
            expect.objectContaining({
                id: 1,
                email: "admin@test.com",
                name: "Admin",
                userAgent: "stock-route-test",
            }),
        );
    });

    it("returns 409 when an existing variant was changed by a stale form", async () => {
        vi.mocked(stockService.updateItem).mockRejectedValue(
            new Error("ยอดคงเหลือของรายการย่อยเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่"),
        );
        const request = trustedNextRequest("http://localhost/api/stock/items/42", {
            method: "PATCH",
            body: JSON.stringify({
                variants: [{
                    id: 421,
                    expectedQuantity: 5,
                    unit: "ชิ้น",
                    quantity: 0,
                    minStock: 1,
                    attributes: [],
                }],
            }),
        });

        const response = await patchItemRoute(request, {
            params: Promise.resolve({ id: "42" }),
        });

        expect(response.status).toBe(409);
    });

    it("returns 409 when closing a variant with remaining quantity", async () => {
        vi.mocked(stockService.updateItem).mockRejectedValue(
            new Error(
                "ไม่สามารถปิดรายการย่อยที่ยังมียอดคงเหลือ กรุณาปรับยอดเป็นศูนย์ก่อน",
            ),
        );
        const request = trustedNextRequest("http://localhost/api/stock/items/42", {
            method: "PATCH",
            body: JSON.stringify({ name: "ปากกาใหม่" }),
        });

        const response = await patchItemRoute(request, {
            params: Promise.resolve({ id: "42" }),
        });

        expect(response.status).toBe(409);
    });

    it("selects the atomic delete audit action when soft-deleting an item", async () => {
        vi.mocked(stockService.updateItem).mockResolvedValue({
            ...updatedItem,
            isActive: false,
        } as never);
        const request = trustedNextRequest("http://localhost/api/stock/items/42", {
            method: "DELETE",
        });

        const response = await deleteItemRoute(request, {
            params: Promise.resolve({ id: "42" }),
        });

        expect(response.status).toBe(200);
        expect(stockService.updateItem).toHaveBeenCalledWith(
            42,
            { isActive: false },
            expect.objectContaining({
                id: 1,
                email: "admin@test.com",
                name: "Admin",
            }),
            "STOCK_ITEM_DELETE",
        );
    });

    it("denies a normal USER without the inventory grant", async () => {
        vi.mocked(requireActiveWorkforceSession).mockResolvedValue({
            ok: true,
            user: {
                id: 2,
                email: "user@test.com",
                role: "USER",
                name: "User",
            },
            employeeId: 20,
        } as never);
        stockAuthorizationMock.assert.mockRejectedValueOnce(
            new StockCapabilityDeniedError(
                "stock.inventory.manage",
                "NO_APPLICABLE_GRANT",
            ),
        );

        const response = await patchItemRoute(
            trustedNextRequest("http://localhost/api/stock/items/42", {
                method: "PATCH",
                body: JSON.stringify({ name: "ปากกาใหม่" }),
            }),
            { params: Promise.resolve({ id: "42" }) },
        );

        expect(response.status).toBe(403);
        expect(stockService.updateItem).not.toHaveBeenCalled();
    });

    it("allows an explicitly granted USER to reach the inventory operation", async () => {
        vi.mocked(requireActiveWorkforceSession).mockResolvedValue({
            ok: true,
            user: {
                id: 2,
                email: "user@test.com",
                role: "USER",
                name: "User",
            },
            employeeId: 20,
        } as never);
        stockAuthorizationMock.assert.mockResolvedValueOnce({
            actor: {
                userId: 2,
                employeeId: 20,
                systemRole: "USER",
                channel: "DASHBOARD",
            },
            capability: "stock.inventory.manage",
            decision: {
                capability: "stock.inventory.manage",
                allowed: true,
                scopes: ["ALL"],
                grants: [{
                    capability: "stock.inventory.manage",
                    scope: "ALL",
                    source: { type: "USER", userId: 2 },
                }],
            },
            scopes: ["ALL"],
            defaultScopes: [],
            isAdministrative: false,
        });
        vi.mocked(stockService.updateItem).mockResolvedValue(updatedItem as never);

        const response = await patchItemRoute(
            trustedNextRequest("http://localhost/api/stock/items/42", {
                method: "PATCH",
                body: JSON.stringify({ name: "ปากกาใหม่" }),
            }),
            { params: Promise.resolve({ id: "42" }) },
        );

        expect(response.status).toBe(200);
        expect(stockService.updateItem).toHaveBeenCalledTimes(1);
    });

    it("maps transaction workforce revocation to 403", async () => {
        vi.mocked(stockService.updateItem).mockRejectedValue(
            new WorkforceAuthorizationError(),
        );

        const response = await patchItemRoute(
            trustedNextRequest("http://localhost/api/stock/items/42", {
                method: "PATCH",
                body: JSON.stringify({ name: "ปากกาใหม่" }),
            }),
            { params: Promise.resolve({ id: "42" }) },
        );

        expect(response.status).toBe(403);
    });
});

describe("Stock JSON mutation body limits", () => {
    type StockRoute = {
        readonly label: string;
        readonly url: string;
        readonly method: "POST" | "PATCH";
        readonly limit: number;
        readonly body: Record<string, unknown>;
        readonly maximalBody?: () => Record<string, unknown>;
        readonly invoke: (request: NextRequest) => Promise<Response>;
        readonly command: () => unknown;
        readonly successStatus: number;
    };

    const idParams = (): { params: Promise<{ id: string }> } => ({
        params: Promise.resolve({ id: "42" }),
    });
    const routes: readonly StockRoute[] = [
        {
            label: "POST /api/stock/categories",
            url: "http://localhost/api/stock/categories",
            method: "POST",
            limit: DEFAULT_JSON_MUTATION_MAX_BYTES,
            body: { name: "เครื่องเขียน" },
            invoke: (request) => createCategoryRoute(request),
            command: () => stockService.createCategory,
            successStatus: 201,
        },
        {
            label: "POST /api/stock/items",
            url: "http://localhost/api/stock/items",
            method: "POST",
            limit: STOCK_ITEM_JSON_MAX_REQUEST_BYTES,
            body: { name: "ปากกา", categoryId: 1, variants: [{ unit: "ด้าม", quantity: 1, minStock: 1 }] },
            maximalBody: buildMaximalCreateItemPayload,
            invoke: (request) => createItemRoute(request),
            command: () => stockService.createItem,
            successStatus: 201,
        },
        {
            label: "PATCH /api/stock/items/[id]",
            url: "http://localhost/api/stock/items/42",
            method: "PATCH",
            limit: STOCK_ITEM_JSON_MAX_REQUEST_BYTES,
            body: { name: "ปากกาใหม่" },
            maximalBody: buildMaximalUpdateItemPayload,
            invoke: (request) => patchItemRoute(request, idParams()),
            command: () => stockService.updateItem,
            successStatus: 200,
        },
        {
            label: "POST /api/stock/items/[id]/adjust",
            url: "http://localhost/api/stock/items/42/adjust",
            method: "POST",
            limit: DEFAULT_JSON_MUTATION_MAX_BYTES,
            body: { type: "IN", quantity: 5, minStock: 1 },
            invoke: (request) => adjustItemRoute(request, idParams()),
            command: () => stockService.adjustStock,
            successStatus: 200,
        },
    ];

    beforeEach(() => {
        vi.clearAllMocks();
        resetMutationRateLimit();
        mockAdmin();
        stockAuthorizationMock.assert.mockResolvedValue({ scopes: ["ALL"] } as never);
        vi.mocked(stockService.createCategory).mockResolvedValue({ id: 1 } as never);
        vi.mocked(stockService.createItem).mockResolvedValue({ id: 42 } as never);
        vi.mocked(stockService.updateItem).mockResolvedValue(updatedItem as never);
        vi.mocked(stockService.adjustStock).mockResolvedValue({ id: 7 } as never);
    });

    it.each(CONTENT_LENGTH_MODES)(
        "rejects an oversized body with 413 before the Stock command (Content-Length %s)",
        async (contentLength) => {
            for (const route of routes) {
                const response = await route.invoke(buildJsonBodyRequest(
                    route.url,
                    jsonBodyOfExactBytes(route.body, route.limit + 1),
                    { method: route.method, contentLength },
                ));

                expect(response.status, route.label).toBe(413);
                expect(await response.json()).toEqual({ error: REQUEST_BODY_TOO_LARGE_MESSAGE });
                expect(route.command(), route.label).not.toHaveBeenCalled();
            }
        },
    );

    it("keeps the previous 500 response for malformed JSON", async () => {
        for (const route of routes) {
            const response = await route.invoke(
                buildJsonBodyRequest(route.url, "{not json", { method: route.method }),
            );

            expect(response.status, route.label).toBe(500);
            expect(await response.json()).toEqual({ error: "Internal server error" });
            expect(route.command(), route.label).not.toHaveBeenCalled();
        }
    });

    it("runs the command with a valid body of exactly the limit", async () => {
        for (const route of routes) {
            const response = await route.invoke(buildJsonBodyRequest(
                route.url,
                jsonBodyOfExactBytes(route.body, route.limit),
                { method: route.method },
            ));

            expect(response.status, route.label).toBe(route.successStatus);
            expect(route.command(), route.label).toHaveBeenCalledTimes(1);
        }
    });

    it("accepts the maximal schema-valid Stock item payloads padded to exactly the limit", async () => {
        const itemRoutes = routes.filter((candidate) => candidate.maximalBody !== undefined);
        expect(itemRoutes).toHaveLength(2);
        for (const route of itemRoutes) {
            const payload = route.maximalBody === undefined ? {} : route.maximalBody();
            const response = await route.invoke(buildJsonBodyRequest(
                route.url,
                jsonBodyOfExactBytes(payload, route.limit),
                { method: route.method },
            ));

            expect(response.status, route.label).toBe(route.successStatus);
            expect(route.command(), route.label).toHaveBeenCalledTimes(1);
        }
    });
});
