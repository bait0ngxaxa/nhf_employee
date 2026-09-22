import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LiffStockCart } from "../presentation/liff/components/LiffStockCart";
import { LiffStockDecisionSheet } from "../presentation/liff/components/LiffStockDecisionSheet";
import { LiffStockItemCard } from "../presentation/liff/components/LiffStockItemCard";
import { LiffStockRequestCard } from "../presentation/liff/components/LiffStockRequestCard";
import { LiffStockVariantPicker } from "../presentation/liff/components/LiffStockVariantPicker";
import type { LiffStockRequestSummary } from "../contracts/liff";

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

const DECISION_REQUEST = {
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
    availableActions: ["ISSUE", "CANCEL"],
} satisfies LiffStockRequestSummary;

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
                canCreateRequests
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
                canCreateRequests
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

    it("keeps LIFF picker quantities within one item session and resets on close or item switch", () => {
        const onConfirm = vi.fn();
        const onOpenChange = vi.fn();
        const otherItem = {
            ...MULTI_VARIANT_ITEM,
            id: 11,
            name: "กระเป๋ากิจกรรม",
            variants: [{
                ...MULTI_VARIANT_ITEM.variants[0],
                id: 201,
                sku: "BAG-B",
                availableQuantity: 1,
            }],
        };
        const view = render(
            <LiffStockVariantPicker
                item={MULTI_VARIANT_ITEM}
                open
                onOpenChange={onOpenChange}
                onConfirm={onConfirm}
                canCreateRequests
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "เพิ่มจำนวน ขนาด: S" }));
        view.rerender(
            <LiffStockVariantPicker
                item={{ ...MULTI_VARIANT_ITEM, variants: [...MULTI_VARIANT_ITEM.variants] }}
                open
                onOpenChange={onOpenChange}
                onConfirm={onConfirm}
                canCreateRequests
            />,
        );
        expect(screen.getByRole("button", { name: "ลดจำนวน ขนาด: S" })).toBeEnabled();

        view.rerender(
            <LiffStockVariantPicker
                item={otherItem}
                open
                onOpenChange={onOpenChange}
                onConfirm={onConfirm}
                canCreateRequests
            />,
        );
        expect(screen.getByRole("button", { name: "ลดจำนวน ขนาด: S" })).toBeDisabled();
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มจำนวน ขนาด: S" }));
        fireEvent.click(screen.getByRole("button", { name: "เพิ่ม 1 ตัวเลือก · 1 ชิ้น" }));
        expect(onConfirm).toHaveBeenLastCalledWith([{
            variant: otherItem.variants[0],
            quantity: 1,
        }]);

        view.rerender(
            <LiffStockVariantPicker
                item={null}
                open={false}
                onOpenChange={onOpenChange}
                onConfirm={onConfirm}
                canCreateRequests
            />,
        );
        view.rerender(
            <LiffStockVariantPicker
                item={MULTI_VARIANT_ITEM}
                open
                onOpenChange={onOpenChange}
                onConfirm={onConfirm}
                canCreateRequests
            />,
        );
        expect(screen.getByRole("button", { name: "ลดจำนวน ขนาด: S" })).toBeDisabled();
    });

    it("clamps preserved quantities to refreshed variant availability", () => {
        const onConfirm = vi.fn();
        const view = render(
            <LiffStockVariantPicker
                item={MULTI_VARIANT_ITEM}
                open
                onOpenChange={vi.fn()}
                onConfirm={onConfirm}
                canCreateRequests
            />,
        );

        const addSmall = screen.getByRole("button", { name: "เพิ่มจำนวน ขนาด: S" });
        fireEvent.click(addSmall);
        fireEvent.click(addSmall);

        const refreshedItem = {
            ...MULTI_VARIANT_ITEM,
            variants: MULTI_VARIANT_ITEM.variants.map((variant) =>
                variant.id === 101
                    ? { ...variant, availableQuantity: 1 }
                    : variant,
            ),
        };
        view.rerender(
            <LiffStockVariantPicker
                item={refreshedItem}
                open
                onOpenChange={vi.fn()}
                onConfirm={onConfirm}
                canCreateRequests
            />,
        );

        expect(screen.getByRole("button", { name: "เพิ่ม 1 ตัวเลือก · 1 ชิ้น" }))
            .toBeEnabled();
        fireEvent.click(screen.getByRole("button", { name: "เพิ่ม 1 ตัวเลือก · 1 ชิ้น" }));
        expect(onConfirm).toHaveBeenCalledWith([{
            variant: refreshedItem.variants[0],
            quantity: 1,
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
                canCreateRequests
            />,
        );

        const dialogs = screen.getAllByRole("dialog");
        const cartDialog = dialogs[dialogs.length - 1];
        const cartScrollArea = cartDialog.querySelector('[data-slot="dialog-scroll-area"]');
        const submitButton = within(cartDialog).getByRole("button", { name: "ส่งคำขอเบิก 1 ชิ้น" });
        expect(cartDialog.querySelectorAll('[data-slot="dialog-scroll-area"]')).toHaveLength(1);
        expect(cartScrollArea).not.toContainElement(submitButton);

        fireEvent.change(screen.getByLabelText("ชื่อย่อโครงการ"), {
            target: { value: "NHF-2570" },
        });
        expect(onProjectCodeChange).toHaveBeenCalledWith("NHF-2570");
        fireEvent.click(screen.getByRole("button", { name: "เพิ่มจำนวน เสื้อกิจกรรม" }));
        expect(onChangeQuantity).toHaveBeenCalledWith(101, 1);
        fireEvent.click(submitButton);
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
                canIssue={false}
                canCancel
                canOpenDetail
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

    it("does not expose request detail when the read capability is absent", () => {
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
                    items: [],
                    availableActions: ["ISSUE"],
                    requester: { name: "ผู้เบิก ทดสอบ" },
                }}
                canIssue
                canCancel={false}
                canOpenDetail={false}
                onOpenDetail={vi.fn()}
                onAction={vi.fn()}
            />,
        );

        expect(screen.queryByRole("button", { name: "รายละเอียด" }))
            .not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "จ่ายวัสดุ" }))
            .toBeEnabled();
    });

    it("resets the Stock decision reason at action, request, actor, and close boundaries", () => {
        const employeeCancelIntent = {
            action: "CANCEL" as const,
            request: DECISION_REQUEST,
            actorMode: "employee" as const,
        };
        const { rerender } = render(
            <LiffStockDecisionSheet
                intent={employeeCancelIntent}
                busy={false}
                error={null}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
            />,
        );

        fireEvent.change(screen.getByLabelText("เหตุผล (ถ้ามี)"), {
            target: { value: "เหตุผลเดิม" },
        });
        rerender(
            <LiffStockDecisionSheet
                intent={{
                    ...employeeCancelIntent,
                    request: { ...DECISION_REQUEST },
                }}
                busy
                error="ลองใหม่อีกครั้ง"
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
            />,
        );
        expect(screen.getByLabelText("เหตุผล (ถ้ามี)"))
            .toHaveValue("เหตุผลเดิม");

        rerender(
            <LiffStockDecisionSheet
                intent={{ ...employeeCancelIntent, action: "ISSUE" }}
                busy={false}
                error={null}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
            />,
        );
        expect(screen.queryByLabelText("เหตุผล (ถ้ามี)"))
            .not.toBeInTheDocument();

        rerender(
            <LiffStockDecisionSheet
                intent={employeeCancelIntent}
                busy={false}
                error={null}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
            />,
        );
        expect(screen.getByLabelText("เหตุผล (ถ้ามี)"))
            .toHaveValue("");

        fireEvent.change(screen.getByLabelText("เหตุผล (ถ้ามี)"), {
            target: { value: "เหตุผลคำขอเดิม" },
        });
        rerender(
            <LiffStockDecisionSheet
                intent={{
                    ...employeeCancelIntent,
                    request: { ...DECISION_REQUEST, id: 72 },
                }}
                busy={false}
                error={null}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
            />,
        );
        expect(screen.getByLabelText("เหตุผล (ถ้ามี)"))
            .toHaveValue("");

        fireEvent.change(screen.getByLabelText("เหตุผล (ถ้ามี)"), {
            target: { value: "เหตุผลโหมดเดิม" },
        });
        rerender(
            <LiffStockDecisionSheet
                intent={{
                    ...employeeCancelIntent,
                    request: { ...DECISION_REQUEST, id: 72 },
                    actorMode: "processor",
                }}
                busy={false}
                error={null}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
            />,
        );
        expect(screen.getByRole("heading", { name: "ยืนยันไม่ดำเนินการ" }))
            .toBeInTheDocument();
        expect(screen.getByLabelText("เหตุผล (ถ้ามี)"))
            .toHaveValue("");

        rerender(
            <LiffStockDecisionSheet
                intent={null}
                busy={false}
                error={null}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
            />,
        );
        expect(screen.queryByLabelText("เหตุผล (ถ้ามี)"))
            .not.toBeInTheDocument();
        rerender(
            <LiffStockDecisionSheet
                intent={{
                    ...employeeCancelIntent,
                    request: { ...DECISION_REQUEST, id: 72 },
                    actorMode: "processor",
                }}
                busy={false}
                error={null}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
            />,
        );
        expect(screen.getByLabelText("เหตุผล (ถ้ามี)"))
            .toHaveValue("");
    });

    it("keeps ISSUE reasonless and submits a trimmed Stock cancellation reason", () => {
        const onConfirm = vi.fn();
        const cancelIntent = {
            action: "CANCEL" as const,
            request: DECISION_REQUEST,
            actorMode: "employee" as const,
        };
        const { rerender } = render(
            <LiffStockDecisionSheet
                intent={cancelIntent}
                busy={false}
                error={null}
                onOpenChange={vi.fn()}
                onConfirm={onConfirm}
            />,
        );

        fireEvent.change(screen.getByLabelText("เหตุผล (ถ้ามี)"), {
            target: { value: "  ผู้เบิกไม่ต้องการแล้ว  " },
        });
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันยกเลิกคำขอ" }));
        expect(onConfirm).toHaveBeenCalledWith("ผู้เบิกไม่ต้องการแล้ว");

        rerender(
            <LiffStockDecisionSheet
                intent={{ ...cancelIntent, action: "ISSUE" }}
                busy={false}
                error={null}
                onOpenChange={vi.fn()}
                onConfirm={onConfirm}
            />,
        );
        expect(screen.queryByLabelText("เหตุผล (ถ้ามี)"))
            .not.toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันจ่ายวัสดุ" }));
        expect(onConfirm).toHaveBeenLastCalledWith(undefined);
    });
});
