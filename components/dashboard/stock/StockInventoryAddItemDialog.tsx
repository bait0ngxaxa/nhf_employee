"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { API_ROUTES } from "@/lib/ssot/routes";
import {
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
        setLoading(true);

        const formData = new FormData(event.currentTarget);
        const normalizedVariants = variants.map(normalizeVariantDraft);

        try {
            const res = await fetch(API_ROUTES.stock.items, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: formData.get("name"),
                    description: formData.get("description") || null,
                    imageUrl: itemImageUrl || null,
                    sku: formData.get("sku") || undefined,
                    categoryId: selectedCategoryId ? Number(selectedCategoryId) : undefined,
                    variants: normalizedVariants,
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? STOCK_ADMIN_TEXT.genericError);
            }

            toast.success(STOCK_ADMIN_TEXT.itemAdded);
            onSuccess();
        } catch (error) {
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
                    label="SKU"
                    placeholder="เว้นว่างเพื่อสร้างอัตโนมัติ"
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

    return {
        sku: normalizedSku || undefined,
        unit: variant.unit.trim(),
        quantity: variant.quantity,
        minStock: variant.minStock,
        imageUrl: variant.imageUrl.trim() || null,
        attributes: variant.attributes
            .map((attribute) => ({
                name: attribute.name.trim(),
                value: attribute.value.trim(),
            }))
            .filter((attribute) => attribute.name && attribute.value),
    };
}
