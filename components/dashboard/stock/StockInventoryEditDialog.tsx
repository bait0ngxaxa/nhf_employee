"use client";

import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { StockItem } from "../context/stock/types";
import {
    createEmptyVariantAttribute,
    resolveStockApiErrorMessage,
    STOCK_ADMIN_TEXT,
} from "./stockAdminInventory.shared";
import { StockImageUploadField } from "./StockImageUploadField";
import { StockInventoryVariantEditor } from "./StockInventoryVariantEditor";

type EditItemDialogProps = {
    item: StockItem;
    onClose: () => void;
    onSuccess: () => void;
};

type StockItemVariant = NonNullable<StockItem["variants"]>[number];
type EditableVariant = ReturnType<typeof createEditableVariant>;

function createEditableVariant(item: StockItem, variant?: StockItemVariant) {
    return {
        clientKey:
            variant?.id !== undefined
                ? `existing-${variant.id}`
                : `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        id: variant?.id,
        sku: variant?.sku ?? "",
        unit: variant?.unit ?? item.unit,
        quantity: String(variant?.quantity ?? 1),
        minStock: String(variant?.minStock ?? 1),
        imageUrl: variant?.imageUrl ?? "",
        attributes:
            variant?.attributeValues?.map((attributeValue) => ({
                name: attributeValue.attributeValue.attribute.name,
                value: attributeValue.attributeValue.value,
            })) ?? [createEmptyVariantAttribute()],
    };
}

function parseVariantNumber(value: string): number {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return 1;
    }

    return Math.trunc(parsed);
}

function createEditableVariants(item: StockItem): EditableVariant[] {
    const variants = item.variants ?? [];
    if (variants.length === 0) {
        return [createEditableVariant(item)];
    }

    return variants.map((variant) => createEditableVariant(item, variant));
}

export function EditItemDialog({
    item,
    onClose,
    onSuccess,
}: EditItemDialogProps) {
    const [loading, setLoading] = useState(false);
    const [itemImageUrl, setItemImageUrl] = useState(item.imageUrl ?? "");
    const [variants, setVariants] = useState<EditableVariant[]>(
        createEditableVariants(item),
    );

    const totalQuantity = useMemo(
        () =>
            variants.reduce(
                (sum, variant) => sum + parseVariantNumber(variant.quantity),
                0,
            ),
        [variants],
    );
    const totalMinStock = useMemo(
        () =>
            variants.reduce(
                (sum, variant) => sum + parseVariantNumber(variant.minStock),
                0,
            ),
        [variants],
    );

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();
        setLoading(true);

        try {
            const res = await fetch(API_ROUTES.stock.itemById(item.id), {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    imageUrl: itemImageUrl || null,
                    variants: variants.map((variant) => ({
                        ...(variant.id !== undefined && { id: variant.id }),
                        sku: variant.sku.trim() || undefined,
                        unit: variant.unit.trim(),
                        quantity: parseVariantNumber(variant.quantity),
                        minStock: parseVariantNumber(variant.minStock),
                        imageUrl:
                            variants.length === 1
                                ? itemImageUrl.trim() || null
                                : variant.imageUrl.trim() || null,
                        attributes: variant.attributes
                            .map((attribute) => ({
                                name: attribute.name.trim(),
                                value: attribute.value.trim(),
                            }))
                            .filter((attribute) => attribute.name && attribute.value),
                    })),
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(
                    resolveStockApiErrorMessage(err, "เกิดข้อผิดพลาด"),
                );
            }

            toast.success(`อัปเดตสต็อก ${item.name} เรียบร้อยแล้ว`);
            onSuccess();
        } catch (error) {
            const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-[760px]">
                <div className="border-b border-gray-100 bg-slate-50/50 px-6 py-4">
                    <DialogTitle className="text-lg font-semibold text-slate-800">
                        แก้ไขสต็อก
                    </DialogTitle>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
                    <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                        <div className="text-sm font-semibold text-slate-800">
                            {item.name}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                            <span>คงเหลือรวม: {totalQuantity}</span>
                            <span>จุดสั่งซื้อรวม: {totalMinStock}</span>
                        </div>
                    </div>

                    <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-800">
                        ถ้ามีหลายรายการย่อย ต้องระบุคุณสมบัติของแต่ละตัวให้ชัด เช่น สี ขนาด หรือชนิด
                    </div>

                    <StockImageUploadField
                        label={STOCK_ADMIN_TEXT.imageUrl}
                        scope="item"
                        value={itemImageUrl}
                        onChange={setItemImageUrl}
                    />

                    <StockInventoryVariantEditor
                        variants={variants}
                        hideSingleVariantImage
                        onAddVariant={() =>
                            setVariants((current) => [
                                ...current,
                                createEditableVariant(item),
                            ])
                        }
                        onRemoveVariant={(index) =>
                            setVariants((current) =>
                                current.length === 1
                                    ? current
                                    : current.filter(
                                          (_, variantIndex) => variantIndex !== index,
                                      ),
                            )
                        }
                        onVariantChange={(index, variant) =>
                            setVariants((current) =>
                                current.map((currentVariant, variantIndex) =>
                                    variantIndex === index
                                        ? {
                                              ...currentVariant,
                                              ...variant,
                                          }
                                        : currentVariant,
                                ),
                            )
                        }
                        onAttributeChange={(variantIndex, attributeIndex, field, value) =>
                            setVariants((current) =>
                                current.map((variant, index) =>
                                    index === variantIndex
                                        ? {
                                              ...variant,
                                              attributes: variant.attributes.map(
                                                  (attribute, attrIndex) =>
                                                      attrIndex === attributeIndex
                                                          ? {
                                                                ...attribute,
                                                                [field]: value,
                                                            }
                                                          : attribute,
                                              ),
                                          }
                                        : variant,
                                ),
                            )
                        }
                        onAddAttribute={(variantIndex) =>
                            setVariants((current) =>
                                current.map((variant, index) =>
                                    index === variantIndex
                                        ? {
                                              ...variant,
                                              attributes: [
                                                  ...variant.attributes,
                                                  createEmptyVariantAttribute(),
                                              ],
                                          }
                                        : variant,
                                ),
                            )
                        }
                        onRemoveAttribute={(variantIndex, attributeIndex) =>
                            setVariants((current) =>
                                current.map((variant, index) =>
                                    index === variantIndex &&
                                    variant.attributes.length > 1
                                        ? {
                                              ...variant,
                                              attributes: variant.attributes.filter(
                                                  (_, attrIndex) =>
                                                      attrIndex !== attributeIndex,
                                              ),
                                          }
                                        : variant,
                                ),
                            )
                        }
                    />
                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={loading}
                            className="h-10 px-5 font-medium text-slate-600 hover:bg-slate-100"
                        >
                            {STOCK_ADMIN_TEXT.cancel}
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="h-10 bg-blue-600 px-7 font-bold text-white shadow-sm transition-all hover:bg-blue-700"
                        >
                            {loading ? STOCK_ADMIN_TEXT.saving : "บันทึกการแก้ไข"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
