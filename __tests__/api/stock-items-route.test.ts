import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type * as StockModule from "@/modules/stock";
import {
    DELETE as deleteItemRoute,
    PATCH as patchItemRoute,
} from "@/app/api/stock/items/[id]/route";
import { getApiAuthSession } from "@/lib/auth/server";
import { buildUserContext } from "@/lib/auth/context";
import { requireActiveWorkforceOrAdminSession } from "@/lib/auth/workforce";
import { isAdminRole } from "@/lib/ssot/permissions";
import {
    stockService,
    StockCapabilityDeniedError,
} from "@/modules/stock";

const stockAuthorizationMock = vi.hoisted(() => ({
    assert: vi.fn(),
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
    requireActiveWorkforceOrAdminSession: vi.fn(),
}));

vi.mock("@/modules/stock", async () => {
    const actual = await vi.importActual<typeof StockModule>(
        "@/modules/stock",
    );
    return {
        ...actual,
        assertStockCapabilityForMigration: stockAuthorizationMock.assert,
        stockService: {
            ...actual.stockService,
            updateItem: vi.fn(),
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
    vi.mocked(requireActiveWorkforceOrAdminSession).mockResolvedValue({
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
            isAdministrative: true,
            usedMigrationCompatibility: false,
        });
    });

    it("passes request audit context when updating an item", async () => {
        vi.mocked(stockService.updateItem).mockResolvedValue(updatedItem as never);
        const request = new NextRequest("http://localhost/api/stock/items/42", {
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
        const request = new NextRequest("http://localhost/api/stock/items/42", {
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
        const request = new NextRequest("http://localhost/api/stock/items/42", {
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
        const request = new NextRequest("http://localhost/api/stock/items/42", {
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
        vi.mocked(requireActiveWorkforceOrAdminSession).mockResolvedValue({
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
            new NextRequest("http://localhost/api/stock/items/42", {
                method: "PATCH",
                body: JSON.stringify({ name: "ปากกาใหม่" }),
            }),
            { params: Promise.resolve({ id: "42" }) },
        );

        expect(response.status).toBe(403);
        expect(stockService.updateItem).not.toHaveBeenCalled();
    });

    it("allows an explicitly granted USER to reach the inventory operation", async () => {
        vi.mocked(requireActiveWorkforceOrAdminSession).mockResolvedValue({
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
            isAdministrative: false,
            usedMigrationCompatibility: false,
        });
        vi.mocked(stockService.updateItem).mockResolvedValue(updatedItem as never);

        const response = await patchItemRoute(
            new NextRequest("http://localhost/api/stock/items/42", {
                method: "PATCH",
                body: JSON.stringify({ name: "ปากกาใหม่" }),
            }),
            { params: Promise.resolve({ id: "42" }) },
        );

        expect(response.status).toBe(200);
        expect(stockService.updateItem).toHaveBeenCalledTimes(1);
    });
});
