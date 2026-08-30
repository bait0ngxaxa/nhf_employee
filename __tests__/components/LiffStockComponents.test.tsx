import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LiffStockCart } from "@/components/liff/stock/LiffStockCart";
import { LiffStockItemCard } from "@/components/liff/stock/LiffStockItemCard";
import { LiffStockRequestCard } from "@/components/liff/stock/LiffStockRequestCard";
import { LiffStockVariantPicker } from "@/components/liff/stock/LiffStockVariantPicker";

const MULTI_VARIANT_ITEM = {
    id: 10,
    name: "เสื้อกิจกรรมชื่อยาวสำหรับทดสอบบนหน้าจอมือถือ",
    description: null,
    imageUrl: null,
    sku: "SHIRT",
    unit: "ตัว",
    availableQuantity: 5,
    category: { id: 2, name: "กิจกรรม" },
    variants: [
        {
            id: 101,
            sku: "SHIRT-S",
            unit: "ตัว",
            imageUrl: null,
            availableQuantity: 2,
            attributeValues: [{
                attributeValue: {
                    value: "S",
                    attribute: { name: "ขนาด" },
                },
            }],
        },
        {
            id: 102,
            sku: "SHIRT-M",
            unit: "ตัว",
            imageUrl: null,
            availableQuantity: 3,
            attributeValues: [{
                attributeValue: {
                    value: "M",
                    attribute: { name: "ขนาด" },
                },
            }],
        },
    ],
};

describe("LIFF Stock mobile components", () => {
    it("routes a multi-variant card through the picker and respects availability", () => {
        const onChooseVariant = vi.fn();
        render(
            <LiffStockItemCard
                item={MULTI_VARIANT_ITEM}
                totalInCart={0}
                recentlyAdded={false}
                priorityImage={false}
                onAddDirect={vi.fn()}
                onChooseVariant={onChooseVariant}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "เลือกตัวเลือก" }));
        expect(onChooseVariant).toHaveBeenCalledWith(MULTI_VARIANT_ITEM);

        const onConfirm = vi.fn();
        render(
            <LiffStockVariantPicker
                item={MULTI_VARIANT_ITEM}
                open
                onOpenChange={vi.fn()}
                onConfirm={onConfirm}
            />,
        );
        const addSmall = screen.getByRole("button", { name: "เพิ่มจำนวน ขนาด: S" });
        fireEvent.click(addSmall);
        fireEvent.click(addSmall);
        expect(addSmall).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "เพิ่ม 1 ตัวเลือก · 2 ชิ้น" }));
        expect(onConfirm).toHaveBeenCalledWith([{
            variant: MULTI_VARIANT_ITEM.variants[0],
            quantity: 2,
        }]);
    });

    it("supports cart quantity, project code, submit, and request cancellation actions", () => {
        const onProjectCodeChange = vi.fn();
        const onChangeQuantity = vi.fn();
        const onSubmit = vi.fn();
        render(
            <LiffStockCart
                open
                items={[{
                    item: { id: 10, name: "เสื้อกิจกรรม", imageUrl: null },
                    variant: MULTI_VARIANT_ITEM.variants[0],
                    qty: 1,
                }]}
                totalQuantity={1}
                projectCode="NHF-2569"
                submitting={false}
                onOpenChange={vi.fn()}
                onProjectCodeChange={onProjectCodeChange}
                onChangeQuantity={onChangeQuantity}
                onRemove={vi.fn()}
                onClear={vi.fn()}
                onSubmit={onSubmit}
            />,
        );

        fireEvent.change(screen.getByLabelText("ชื่อย่อโครงการ"), {
            target: { value: "NHF-2570" },
        });
        expect(onProjectCodeChange).toHaveBeenCalledWith("NHF-2570");
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มจำนวน เสื้อกิจกรรม" }));
        expect(onChangeQuantity).toHaveBeenCalledWith(101, 1);
        fireEvent.click(screen.getByRole("button", { name: "ส่งคำขอเบิก 1 ชิ้น" }));
        expect(onSubmit).toHaveBeenCalledTimes(1);

        const onAction = vi.fn();
        render(
            <LiffStockRequestCard
                request={{
                    id: 71,
                    projectCode: "NHF-2569",
                    status: "PENDING_ISSUE",
                    note: null,
                    cancelReason: null,
                    issuedAt: null,
                    cancelledAt: null,
                    createdAt: "2026-08-30T03:00:00.000Z",
                    items: [{
                        itemName: "เสื้อกิจกรรม",
                        itemSku: "SHIRT",
                        variantSku: "SHIRT-S",
                        variantLabel: "ขนาด: S",
                        unit: "ตัว",
                        quantity: 1,
                        imageUrl: null,
                        currentQuantity: 2,
                        isAvailableForIssue: true,
                    }],
                    availableActions: ["CANCEL"],
                }}
                onOpenDetail={vi.fn()}
                onAction={onAction}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "ยกเลิกคำขอ" }));
        expect(onAction).toHaveBeenCalledWith(
            "CANCEL",
            expect.objectContaining({ id: 71 }),
        );
        expect(screen.queryByRole("button", { name: "จ่ายวัสดุ" }))
            .not.toBeInTheDocument();
    });
});
