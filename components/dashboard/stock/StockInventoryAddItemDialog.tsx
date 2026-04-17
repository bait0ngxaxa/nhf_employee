"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import {
    ensureStockApiSuccess,
    STOCK_ADMIN_TEXT,
    createEmptyVariant,
    createEmptyVariantAttribute,
} from "./stockAdminInventory.shared";
import type { VariantDraft } from "./stockAdminInventory.shared";
import {
    InventoryCategoryField,
    InventoryDialogActions,
    InventoryTextField,
} from "./StockInventoryFormFields";
import { StockImageUploadField } from "./StockImageUploadField";
import { StockInventoryVariantEditor } from "./StockInventoryVariantEditor";

type CategoryOption = { id: number; name: string };

type AddItemDialogProps = {
    open: boolean;
    onClose: () => void;
    categories: CategoryOption[];
    onSuccess: () => void;
};

export function AddItemDialog({
    open,
    onClose,
    categories,
    onSuccess,
}: AddItemDialogProps) {
    const [loading, setLoading] = useState(false);
    const [selectedCategoryId, setSelectedCategoryId] = useState("");
    const [itemImageUrl, setItemImageUrl] = useState("");
    const [variants, setVariants] = useState<VariantDraft[]>([createEmptyVariant()]);

    useEffect(() => {
        if (!open) {
            setSelectedCategoryId("");
            setItemImageUrl("");
            setVariants([createEmptyVariant()]);
            return;
        }

        setVariants((current) =>
            current.length > 0 ? current : [createEmptyVariant()],
        );
    }, [open]);

    async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
        event.preventDefault();

        if (!selectedCategoryId) {
            toast.error("กรุณาเลือกหมวดหมู่");
            return;
        }

        setLoading(true);

        const formData = new FormData(event.currentTarget);
        const normalizedVariants = variants.map(normalizeVariantDraft);

        try {
            ensureStockApiSuccess(
                await apiPost(API_ROUTES.stock.items, {
                    name: formData.get("name"),
                    description: formData.get("description") || null,
                    imageUrl: itemImageUrl || null,
                    sku: formData.get("sku") || undefined,
                    categoryId: Number(selectedCategoryId),
                    variants: normalizedVariants,
                }),
                STOCK_ADMIN_TEXT.genericError,
            );

            toast.success(STOCK_ADMIN_TEXT.itemAdded);
            onSuccess();
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : STOCK_ADMIN_TEXT.genericError;
            toast.error(message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-[760px]">
                <div className="border-b border-gray-100 bg-slate-50/50 px-6 py-4">
                    <DialogTitle className="text-lg font-semibold text-slate-800">
                        {STOCK_ADMIN_TEXT.addNewItem}
                    </DialogTitle>
                </div>
                <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
                    <BaseFields
                        categories={categories}
                        selectedCategoryId={selectedCategoryId}
                        onCategoryChange={setSelectedCategoryId}
                        itemImageUrl={itemImageUrl}
                        onItemImageChange={setItemImageUrl}
                    />
                    <StockInventoryVariantEditor
                        variants={variants}
                        hideSingleVariantSku
                        hideSingleVariantImage
                        onAddVariant={() =>
                            setVariants((current) => [...current, createEmptyVariant()])
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
                                    variantIndex === index ? variant : currentVariant,
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
                    <InventoryDialogActions
                        loading={loading}
                        submitLabel={STOCK_ADMIN_TEXT.save}
                        onClose={onClose}
                    />
                </form>
            </DialogContent>
        </Dialog>
    );
}

function BaseFields(props: {
    categories: CategoryOption[];
    selectedCategoryId: string;
    onCategoryChange: (value: string) => void;
    itemImageUrl: string;
    onItemImageChange: (value: string) => void;
}) {
    return (
        <>
            <div className="grid grid-cols-2 gap-5">
                <InventoryTextField
                    id="name"
                    name="name"
                    label={STOCK_ADMIN_TEXT.itemName}
                    required
                />
                <InventoryTextField
                    id="sku"
                    name="sku"
                    label="SKU หลัก"
                    placeholder="เว้นว่างเพื่อให้ระบบสร้างให้อัตโนมัติ"
                />
            </div>
            <InventoryTextField
                id="description"
                name="description"
                label={STOCK_ADMIN_TEXT.itemDescription}
                placeholder={STOCK_ADMIN_TEXT.itemDescriptionPlaceholder}
            />
            <StockImageUploadField
                label={STOCK_ADMIN_TEXT.imageUrl}
                scope="item"
                value={props.itemImageUrl}
                onChange={props.onItemImageChange}
            />
            <InventoryCategoryField
                categories={props.categories}
                value={props.selectedCategoryId}
                onChange={props.onCategoryChange}
                required
            />
        </>
    );
}

function normalizeVariantDraft(variant: VariantDraft): {
    sku?: string;
    unit: string;
    quantity: number;
    minStock: number;
    imageUrl: string | null;
    attributes: Array<{ name: string; value: string }>;
} {
    const normalizedSku = variant.sku.trim();
    const normalizedQuantity = Number(variant.quantity);
    const normalizedMinStock = Number(variant.minStock);

    return {
        sku: normalizedSku || undefined,
        unit: variant.unit.trim(),
        quantity:
            Number.isFinite(normalizedQuantity) && normalizedQuantity >= 1
                ? Math.trunc(normalizedQuantity)
                : 1,
        minStock:
            Number.isFinite(normalizedMinStock) && normalizedMinStock >= 1
                ? Math.trunc(normalizedMinStock)
                : 1,
        imageUrl: variant.imageUrl.trim() || null,
        attributes: variant.attributes
            .map((attribute) => ({
                name: attribute.name.trim(),
                value: attribute.value.trim(),
            }))
            .filter((attribute) => attribute.name && attribute.value),
    };
}
