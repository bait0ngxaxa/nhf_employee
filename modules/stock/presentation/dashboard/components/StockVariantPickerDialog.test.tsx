import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { StockVariantPickerDialog } from "./StockVariantPickerDialog";
import type { StockItem, StockItemVariant } from "../context/types";

function createVariant(id: number, sku: string, availableQuantity: number, stockItemId = 10): StockItemVariant {
    return {
        id,
        stockItemId,
        sku,
        unit: "ตัว",
        quantity: availableQuantity,
        reservedQuantity: 0,
        availableQuantity,
        minStock: 0,
        imageUrl: `/stock-${id}.jpg`,
        isActive: true,
        attributeValues: [{
            attributeValue: {
                id,
                value: sku.slice(-1),
                attribute: { id: 1, name: "ขนาด" },
            },
        }],
    };
}

function createItem(id: number, name: string, variants = [
    createVariant(101, "SHIRT-S", 2),
    createVariant(102, "SHIRT-M", 3),
]): StockItem {
    return {
        id,
        name,
        description: null,
        imageUrl: `/item-${id}.jpg`,
        sku: `ITEM-${id}`,
        unit: "ตัว",
        quantity: variants.reduce((total, variant) => total + variant.availableQuantity, 0),
        reservedQuantity: 0,
        availableQuantity: variants.reduce((total, variant) => total + variant.availableQuantity, 0),
        minStock: 0,
        categoryId: 1,
        defaultVariantId: variants[1]?.id ?? variants[0]?.id ?? null,
        isActive: true,
        category: { id: 1, name: "กิจกรรม" },
        variants,
    };
}

describe("StockVariantPickerDialog", () => {
    it("isolates picker sessions while preserving same-item drafts and preview behavior", () => {
        const item = createItem(10, "เสื้อกิจกรรม");
        const otherItem = createItem(11, "กระเป๋ากิจกรรม", [
            createVariant(201, "BAG-B", 1, 11),
        ]);
        const onConfirm = vi.fn();
        const onClose = vi.fn();
        const view = render(
            <StockVariantPickerDialog
                item={item}
                open
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        expect(screen.getByText("เลือกแล้ว 0 รายการ")).toBeInTheDocument();
        expect(screen.getByAltText("เสื้อกิจกรรม")).toHaveAttribute(
            "src",
            "/stock-102.jpg",
        );
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มจำนวน ขนาด: S" }));
        expect(screen.getByText("เลือกแล้ว 1 รายการ")).toBeInTheDocument();

        view.rerender(
            <StockVariantPickerDialog
                item={{ ...item, variants: [...(item.variants ?? [])] }}
                open
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );
        expect(screen.getByText("เลือกแล้ว 1 รายการ")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ดูรูป เสื้อกิจกรรม แบบพรีวิว" }));
        expect(screen.getByRole("dialog", { name: "พรีวิวรูปวัสดุ" })).toBeInTheDocument();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(screen.queryByRole("dialog", { name: "พรีวิวรูปวัสดุ" })).not.toBeInTheDocument();
        expect(screen.getByRole("dialog", { name: "เลือกรายการย่อยสำหรับเบิก" })).toBeInTheDocument();

        view.rerender(
            <StockVariantPickerDialog
                item={otherItem}
                open
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );
        expect(screen.getByText("กระเป๋ากิจกรรม")).toBeInTheDocument();
        expect(screen.getByText("เลือกแล้ว 0 รายการ")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มจำนวน ขนาด: B" }));
        fireEvent.click(screen.getByRole("button", { name: "เพิ่ม 1 รายการ (1 ชิ้น)" }));
        expect(onConfirm).toHaveBeenCalledWith([{
            variant: otherItem.variants?.[0],
            quantity: 1,
        }]);

        view.rerender(
            <StockVariantPickerDialog
                item={null}
                open={false}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );
        view.rerender(
            <StockVariantPickerDialog
                item={item}
                open
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );
        expect(screen.getByText("เลือกแล้ว 0 รายการ")).toBeInTheDocument();
    });
});
