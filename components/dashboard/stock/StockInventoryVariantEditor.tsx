"use client";

import type { ReactNode } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type {
    VariantDraft,
    VariantDraftAttribute,
} from "./stockAdminInventory.shared";
import { STOCK_ADMIN_TEXT } from "./stockAdminInventory.shared";
import { StockImageUploadField } from "./StockImageUploadField";

type StockInventoryVariantEditorProps = {
    variants: VariantDraft[];
    onAddVariant: () => void;
    onRemoveVariant: (index: number) => void;
    onVariantChange: (index: number, variant: VariantDraft) => void;
    onAttributeChange: (
        variantIndex: number,
        attributeIndex: number,
        field: keyof VariantDraftAttribute,
        value: string,
    ) => void;
    onAddAttribute: (variantIndex: number) => void;
    onRemoveAttribute: (variantIndex: number, attributeIndex: number) => void;
};

export function StockInventoryVariantEditor(
    props: StockInventoryVariantEditorProps,
) {
    const { variants } = props;

    return (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
            <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                    <div className="text-sm font-semibold text-slate-800">
                        {STOCK_ADMIN_TEXT.variantsTitle}
                    </div>
                    <p className="text-xs text-slate-500">
                        {STOCK_ADMIN_TEXT.variantsHint}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    onClick={props.onAddVariant}
                    className="border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                    <Plus className="mr-1 h-4 w-4" />
                    {STOCK_ADMIN_TEXT.addVariant}
                </Button>
            </div>
            {variants.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-500">
                    {STOCK_ADMIN_TEXT.autoVariantHint}
                </div>
            ) : (
                <div className="space-y-4">
                    {variants.map((variant, index) => (
                        <VariantCard
                            key={`${index}-${variant.sku}`}
                            index={index}
                            variant={variant}
                            onRemove={() => props.onRemoveVariant(index)}
                            onChange={(nextVariant) =>
                                props.onVariantChange(index, nextVariant)
                            }
                            onAttributeChange={(attributeIndex, field, value) =>
                                props.onAttributeChange(index, attributeIndex, field, value)
                            }
                            onAddAttribute={() => props.onAddAttribute(index)}
                            onRemoveAttribute={(attributeIndex) =>
                                props.onRemoveAttribute(index, attributeIndex)
                            }
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function VariantCard(props: {
    index: number;
    variant: VariantDraft;
    onRemove: () => void;
    onChange: (variant: VariantDraft) => void;
    onAttributeChange: (
        attributeIndex: number,
        field: keyof VariantDraftAttribute,
        value: string,
    ) => void;
    onAddAttribute: () => void;
    onRemoveAttribute: (attributeIndex: number) => void;
}) {
    const { index, variant } = props;

    return (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-800">
                    {`${STOCK_ADMIN_TEXT.variantLabel} ${index + 1}`}
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={props.onRemove}
                    className="text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                >
                    <Trash2 className="mr-1 h-4 w-4" />
                    {STOCK_ADMIN_TEXT.remove}
                </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <FieldShell label="SKU">
                    <Input
                        value={variant.sku}
                        onChange={(event) =>
                            props.onChange({ ...variant, sku: event.target.value })
                        }
                        className="h-10 focus-visible:ring-blue-500"
                    />
                </FieldShell>
                <StockImageUploadField
                    label={STOCK_ADMIN_TEXT.imageUrl}
                    scope="variant"
                    value={variant.imageUrl}
                    onChange={(value) =>
                        props.onChange({ ...variant, imageUrl: value })
                    }
                />
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <FieldShell label={STOCK_ADMIN_TEXT.unit}>
                    <Input
                        value={variant.unit}
                        onChange={(event) =>
                            props.onChange({ ...variant, unit: event.target.value })
                        }
                        className="h-10 focus-visible:ring-blue-500"
                    />
                </FieldShell>
                <FieldShell label={STOCK_ADMIN_TEXT.initialQuantity}>
                    <Input
                        type="number"
                        min={1}
                        value={variant.quantity}
                        onChange={(event) =>
                            props.onChange({
                                ...variant,
                                quantity: Number(event.target.value) || 1,
                            })
                        }
                        className="h-10 focus-visible:ring-blue-500"
                    />
                </FieldShell>
                <FieldShell label={STOCK_ADMIN_TEXT.minStock}>
                    <Input
                        type="number"
                        min={1}
                        value={variant.minStock}
                        onChange={(event) =>
                            props.onChange({
                                ...variant,
                                minStock: Number(event.target.value) || 1,
                            })
                        }
                        className="h-10 focus-visible:ring-blue-500"
                    />
                </FieldShell>
            </div>
            <AttributeEditor
                variant={variant}
                onAttributeChange={props.onAttributeChange}
                onAddAttribute={props.onAddAttribute}
                onRemoveAttribute={props.onRemoveAttribute}
            />
        </div>
    );
}

function AttributeEditor(props: {
    variant: VariantDraft;
    onAttributeChange: (
        attributeIndex: number,
        field: keyof VariantDraftAttribute,
        value: string,
    ) => void;
    onAddAttribute: () => void;
    onRemoveAttribute: (attributeIndex: number) => void;
}) {
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-slate-700">
                    {STOCK_ADMIN_TEXT.attributes}
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={props.onAddAttribute}
                    className="border-slate-200"
                >
                    <Plus className="mr-1 h-4 w-4" />
                    {STOCK_ADMIN_TEXT.addAttribute}
                </Button>
            </div>
            <div className="space-y-3">
                {props.variant.attributes.map((attribute, attributeIndex) => (
                    <div
                        key={attributeIndex}
                        className="grid grid-cols-[1fr_1fr_auto] gap-3"
                    >
                        <Input
                            value={attribute.name}
                            placeholder={STOCK_ADMIN_TEXT.attributeNamePlaceholder}
                            onChange={(event) =>
                                props.onAttributeChange(
                                    attributeIndex,
                                    "name",
                                    event.target.value,
                                )
                            }
                            className="h-10 focus-visible:ring-blue-500"
                        />
                        <Input
                            value={attribute.value}
                            placeholder={STOCK_ADMIN_TEXT.attributeValuePlaceholder}
                            onChange={(event) =>
                                props.onAttributeChange(
                                    attributeIndex,
                                    "value",
                                    event.target.value,
                                )
                            }
                            className="h-10 focus-visible:ring-blue-500"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => props.onRemoveAttribute(attributeIndex)}
                            disabled={props.variant.attributes.length === 1}
                            className="h-10 w-10 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FieldShell(props: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-1.5">
            <Label className="text-sm font-semibold text-slate-700">
                {props.label}
            </Label>
            {props.children}
        </div>
    );
}
