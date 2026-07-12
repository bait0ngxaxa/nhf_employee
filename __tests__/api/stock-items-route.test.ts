import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import {
    DELETE as deleteItemRoute,
    PATCH as patchItemRoute,
} from "@/app/api/stock/items/[id]/route";
import { getApiAuthSession } from "@/lib/auth/server";
import { buildUserContext } from "@/lib/auth/context";
import { isAdminRole } from "@/lib/ssot/permissions";
import { stockService } from "@/lib/services/stock";
import { logStockEvent } from "@/lib/server/audit";

vi.mock("@/lib/auth/server", () => ({
    getApiAuthSession: vi.fn(),
}));

vi.mock("@/lib/auth/context", () => ({
    buildUserContext: vi.fn(),
}));

vi.mock("@/lib/ssot/permissions", () => ({
    isAdminRole: vi.fn(),
}));

vi.mock("@/lib/services/stock", () => ({
    stockService: {
        updateItem: vi.fn(),
    },
}));

vi.mock("@/lib/server/audit", () => ({
    logStockEvent: vi.fn(),
}));

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
}

describe("Stock Item Routes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockAdmin();
    });

    it("logs STOCK_ITEM_UPDATE after updating an item", async () => {
        vi.mocked(stockService.updateItem).mockResolvedValue(updatedItem as never);
        const request = new NextRequest("http://localhost/api/stock/items/42", {
            method: "PATCH",
            body: JSON.stringify({ name: "ปากกาใหม่" }),
        });

        const response = await patchItemRoute(request, {
            params: Promise.resolve({ id: "42" }),
        });

        expect(response.status).toBe(200);
        expect(stockService.updateItem).toHaveBeenCalledWith(42, {
            name: "ปากกาใหม่",
        }, 1);
        expect(logStockEvent).toHaveBeenCalledWith(
            "STOCK_ITEM_UPDATE",
            42,
            1,
            "admin@test.com",
            { after: { name: "ปากกาใหม่", sku: "PEN-002", isActive: true } },
        );
    });

    it("logs STOCK_ITEM_DELETE after soft-deleting an item", async () => {
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
        expect(stockService.updateItem).toHaveBeenCalledWith(42, { isActive: false }, 1);
        expect(logStockEvent).toHaveBeenCalledWith(
            "STOCK_ITEM_DELETE",
            42,
            1,
            "admin@test.com",
            { after: { name: "ปากกาใหม่", sku: "PEN-002", isActive: false } },
        );
    });
});
