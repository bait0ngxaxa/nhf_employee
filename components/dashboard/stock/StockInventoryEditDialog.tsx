"use client";

import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiPatch } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { StockItem } from "../context/stock/types";
import {
    createEmptyVariantAttribute,
    ensureStockApiSuccess,
    STOCK_ADMIN_TEXT,
} from "./stockAdminInventory.shared";
import { InventoryCategoryField } from "./StockInventoryFormFields";
import { StockImageUploadField } from "./StockImageUploadField";
import { StockInventoryVariantEditor } from "./StockInventoryVariantEditor";

type CategoryOption = { id: number; name: string };

type EditItemDialogProps = {
    item: StockItem;
    categories: CategoryOption[];
    onClose: () => void;
    onSuccess: () => void;
};

type StockItemVariant = NonNullable<StockItem["variants"]>[number];
type EditableVariant = ReturnType<typeof createEditableVariant>;
type NormalizedVariant = {
    id?: number;
    sku?: string;
    unit: string;
    quantity: number;
    minStock: number;
    imageUrl: string | null;
    attributes: Array<{ name: string; value: string }>;
};
type NormalizedEditSnapshot = {
    name: string;
    description: string | null;
    categoryId: number;
    imageUrl: string | null;
    variants: NormalizedVariant[];
};

function createEditableVariant(item: StockItem, variant?: StockItemVariant) {
    const existingAttributes =
        variant?.attributeValues?.map((attributeValue) => ({
            name: attributeValue.attributeValue.attribute.name,
            value: attributeValue.attributeValue.value,
        })) ?? [];

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
            existingAttributes.length > 0
                ? existingAttributes
                : [createEmptyVariantAttribute()],
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

function normalizeVariantForUpdate(
    variant: EditableVariant,
    variantsLength: number,
    itemImageUrl: string,
): NormalizedVariant {
    return {
        ...(variant.id !== undefined && { id: variant.id }),
        sku: variant.sku.trim() || undefined,
        unit: variant.unit.trim(),
        quantity: parseVariantNumber(variant.quantity),
        minStock: parseVariantNumber(variant.minStock),
        imageUrl:
            variantsLength === 1
                ? itemImageUrl.trim() || null
                : variant.imageUrl.trim() || null,
        attributes: variant.attributes
            .map((attribute) => ({
                name: attribute.name.trim(),
                value: attribute.value.trim(),
            }))
            .filter((attribute) => attribute.name && attribute.value),
    };
}

function createEditSnapshot(params: {
    name: string;
    description: string;
    categoryId: string;
    imageUrl: string;
    variants: EditableVariant[];
}): NormalizedEditSnapshot {
    return {
        name: params.name.trim(),
        description: params.description.trim() || null,
        categoryId: Number(params.categoryId),
        imageUrl: params.imageUrl.trim() || null,
        variants: params.variants.map((variant) =>
            normalizeVariantForUpdate(
                variant,
                params.variants.length,
                params.imageUrl,
            ),
        ),
    };
}

export function EditItemDialog({
    item,
    categories,
    onClose,
    onSuccess,
}: EditItemDialogProps) {
    const [loading, setLoading] = useState(false);
    const [itemName, setItemName] = useState(item.name);
    const [itemDescription, setItemDescription] = useState(item.description ?? "");
    const [selectedCategoryId, setSelectedCategoryId] = useState(
        String(item.categoryId),
    );
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
    const initialSnapshot = useMemo(
        () =>
            createEditSnapshot({
                name: item.name,
                description: item.description ?? "",
                categoryId: String(item.categoryId),
                imageUrl: item.imageUrl ?? "",
                variants: createEditableVariants(item),
            }),
        [item],
    );
    const currentSnapshot = useMemo(
        () =>
            createEditSnapshot({
                name: itemName,
                description: itemDescription,
                categoryId: selectedCategoryId,
                imageUrl: itemImageUrl,
                variants,
            }),
        [itemDescription, itemImageUrl, itemName, selectedCategoryId, variants],
    );
    const hasChanges =
        JSON.stringify(currentSnapshot) !== JSON.stringify(initialSnapshot);
    const hasVariantChanges =
        JSON.stringify(currentSnapshot.variants) !==
        JSON.stringify(initialSnapshot.variants);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        if (!hasChanges) {
            return;
        }

        const normalizedName = currentSnapshot.name;

        if (!normalizedName) {
            toast.error("กรุณากรอกชื่อวัสดุ");
            return;
        }

        setLoading(true);

        try {
            ensureStockApiSuccess(
                await apiPatch(API_ROUTES.stock.itemById(item.id), {
                    name: currentSnapshot.name,
                    description: currentSnapshot.description,
                    categoryId: currentSnapshot.categoryId,
                    imageUrl: currentSnapshot.imageUrl,
                    ...(hasVariantChanges && {
                        variants: currentSnapshot.variants,
                    }),
                }),
                "เกิดข้อผิดพลาด",
            );

            toast.success(`อัปเดตสต็อก ${normalizedName} เรียบร้อยแล้ว`);
            onSuccess();
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog
            open
            onOpenChange={() => {
                if (!loading) {
                    onClose();
                }
            }}
        >
            <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-[760px]">
                <div className="shrink-0 border-b border-gray-100 bg-slate-50/50 px-5 py-4 sm:px-6">
                    <DialogTitle className="text-lg font-semibold text-slate-800">
                        แก้ไขสต็อก
                    </DialogTitle>
                </div>
                <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
                    <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                            <div className="text-sm font-semibold text-slate-800">
                                ข้อมูลหลักของวัสดุ
                            </div>
                            <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-600">
                                <span>คงเหลือรวม: {totalQuantity}</span>
                                <span>จุดสั่งซื้อรวม: {totalMinStock}</span>
                            </div>
                        </div>

                        {variants.length > 1 && (
                            <div className="rounded-xl border border-amber-100 bg-amber-50/70 px-4 py-3 text-sm text-amber-800">
                                ถ้ามีหลายรายการย่อย ต้องระบุคุณสมบัติของแต่ละตัวให้ชัด เช่น สี ขนาด หรือชนิด
                            </div>
                        )}

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label
                                    htmlFor="edit-item-name"
                                    className="text-sm font-semibold text-slate-700"
                                >
                                    {STOCK_ADMIN_TEXT.itemName}{" "}
                                    <span className="text-rose-500">*</span>
                                </Label>
                                <Input
                                    id="edit-item-name"
                                    value={itemName}
                                    onChange={(event) => setItemName(event.target.value)}
                                    required
                                    maxLength={200}
                                    placeholder="เช่น กระดาษ A4"
                                    className="h-10 focus-visible:ring-blue-500"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label
                                    htmlFor="edit-item-description"
                                    className="text-sm font-semibold text-slate-700"
                                >
                                    {STOCK_ADMIN_TEXT.itemDescription}
                                </Label>
                                <Textarea
                                    id="edit-item-description"
                                    value={itemDescription}
                                    onChange={(event) =>
                                        setItemDescription(event.target.value)
                                    }
                                    maxLength={2000}
                                    placeholder={STOCK_ADMIN_TEXT.itemDescriptionPlaceholder}
                                    className="min-h-10 resize-y focus-visible:ring-blue-500"
                                />
                            </div>
                        </div>

                        <InventoryCategoryField
                            categories={categories}
                            value={selectedCategoryId}
                            onChange={setSelectedCategoryId}
                            required
                        />

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
                                              (_, variantIndex) =>
                                                  variantIndex !== index,
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
                            onAttributeChange={(
                                variantIndex,
                                attributeIndex,
                                field,
                                value,
                            ) =>
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
                    </div>
                    <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-white px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={onClose}
                            disabled={loading}
                            className="h-11 px-5 font-medium text-slate-600 hover:bg-slate-100"
                        >
                            {STOCK_ADMIN_TEXT.cancel}
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !hasChanges}
                            className="h-11 bg-blue-600 px-7 font-bold text-white shadow-sm transition-colors hover:bg-blue-700"
                        >
                            {loading ? STOCK_ADMIN_TEXT.saving : "บันทึกการแก้ไข"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
