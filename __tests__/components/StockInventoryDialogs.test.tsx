import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { AdjustDialog } from "@/components/dashboard/stock/StockInventoryDialogs";
import type { StockItem } from "@/components/dashboard/context/stock/types";

const item: StockItem = {
    id: 1,
    name: "แฟ้มเอกสาร",
    sku: "FILE-001",
    unit: "ชิ้น",
    quantity: 20,
    reservedQuantity: 0,
    availableQuantity: 20,
    minStock: 9,
    categoryId: 1,
    isActive: true,
    category: { id: 1, name: "สำนักงาน" },
    variants: [
        {
            id: 11,
            stockItemId: 1,
            sku: "FILE-001-RED",
            unit: "ชิ้น",
            quantity: 8,
            reservedQuantity: 0,
            availableQuantity: 8,
            minStock: 2,
            imageUrl: null,
            isActive: true,
        },
        {
            id: 12,
            stockItemId: 1,
            sku: "FILE-001-BLUE",
            unit: "ชิ้น",
            quantity: 12,
            reservedQuantity: 0,
            availableQuantity: 12,
            minStock: 7,
            imageUrl: null,
            isActive: true,
        },
    ],
};

beforeAll(() => {
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: vi.fn(),
    });
});

describe("AdjustDialog", () => {
    it("updates minStock to match the selected variant", () => {
        render(
            <AdjustDialog
                item={item}
                onClose={() => undefined}
                onSuccess={() => undefined}
            />,
        );

        fireEvent.click(screen.getByRole("combobox"));
        fireEvent.click(screen.getByRole("option", { name: /FILE-001-BLUE/ }));

        expect(screen.getByLabelText(/จุดสั่งซื้อ/)).toHaveValue(7);
    });
});
