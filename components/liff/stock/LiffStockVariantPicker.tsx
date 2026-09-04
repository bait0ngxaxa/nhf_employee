"use client";

import { Minus, Plus } from "lucide-react";
import { useEffect, useMemo, useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogScrollArea,
    DialogTitle,
} from "@/components/ui/dialog";
import { getVariantAttributeSummary } from "@/modules/stock/client";
import type {
    LiffStockCatalogItem,
    LiffStockCatalogVariant,
} from "@/lib/types/stock-liff";

interface LiffStockVariantPickerProps {
    item: LiffStockCatalogItem | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (
        selections: ReadonlyArray<{
            variant: LiffStockCatalogVariant;
            quantity: number;
        }>,
    ) => void;
}

export function LiffStockVariantPicker({
    item,
    open,
    onOpenChange,
    onConfirm,
}: LiffStockVariantPickerProps): ReactElement | null {
    const [quantities, setQuantities] = useState<Record<number, number>>({});

    useEffect(() => {
        if (open) setQuantities({});
    }, [item?.id, open]);

    const selections = useMemo(() => {
        if (!item) return [];
        return item.variants.flatMap((variant) => {
            const quantity = quantities[variant.id] ?? 0;
            return quantity > 0 ? [{ variant, quantity }] : [];
        });
    }, [item, quantities]);
    const totalQuantity = selections.reduce(
        (sum, selection) => sum + selection.quantity,
        0,
    );

    if (!item) return null;

    function updateQuantity(
        variant: LiffStockCatalogVariant,
        delta: number,
    ): void {
        setQuantities((current) => ({
            ...current,
            [variant.id]: Math.min(
                variant.availableQuantity,
                Math.max(0, (current[variant.id] ?? 0) + delta),
            ),
        }));
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                closeLabel="ปิดตัวเลือกวัสดุ"
                scrollMode="area"
                className="bottom-0 left-0 top-auto max-h-[88vh] supports-[height:100dvh]:max-h-[88dvh] max-w-none translate-x-0 translate-y-0 gap-0 rounded-b-none rounded-t-xl border-x-0 border-b-0 p-0 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2"
            >
                <div className="shrink-0 border-b border-border-subtle bg-surface-subtle px-4 py-4 pr-12">
                    <DialogTitle className="text-lg leading-7 text-content-heading">
                        เลือกตัวเลือกของ {item.name}
                    </DialogTitle>
                    <DialogDescription className="mt-1 leading-6 text-content-secondary">
                        เลือกได้หลายตัวเลือก โดยจำนวนต้องไม่เกินยอดพร้อมเบิก
                    </DialogDescription>
                </div>
                <DialogScrollArea className="space-y-3 px-4 py-4">
                    {item.variants.map((variant) => {
                        const quantity = quantities[variant.id] ?? 0;
                        const label = getVariantAttributeSummary(
                            variant.attributeValues,
                        ) || variant.sku;
                        return (
                            <article
                                key={variant.id}
                                className={`rounded-2xl p-3 shadow-sm ring-1 ${
                                    quantity > 0
                                        ? "bg-status-success-surface ring-status-success-border"
                                        : "bg-surface-raised ring-border-subtle"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <h3 className="break-words text-sm font-bold leading-6 text-content-heading">
                                            {label}
                                        </h3>
                                        <p className="break-all text-xs leading-5 text-content-muted">
                                            SKU {variant.sku}
                                        </p>
                                    </div>
                                    <span className="shrink-0 text-xs font-semibold tabular-nums text-content-secondary">
                                        พร้อมเบิก {variant.availableQuantity} {variant.unit}
                                    </span>
                                </div>
                                <div className="mt-3 flex items-center justify-between gap-3">
                                    <span className="text-xs text-content-muted">
                                        {variant.availableQuantity > 0
                                            ? "จำนวนที่เลือก"
                                            : "หมดชั่วคราว"}
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => updateQuantity(variant, -1)}
                                            disabled={quantity <= 0}
                                            aria-label={`ลดจำนวน ${label}`}
                                            className="size-11 rounded-xl"
                                        >
                                            <Minus className="size-4" aria-hidden="true" />
                                        </Button>
                                        <span
                                            className="min-w-10 text-center text-base font-bold tabular-nums text-content-heading"
                                            aria-live="polite"
                                        >
                                            {quantity}
                                        </span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="icon"
                                            onClick={() => updateQuantity(variant, 1)}
                                            disabled={
                                                variant.availableQuantity <= 0
                                                || quantity >= variant.availableQuantity
                                            }
                                            aria-label={`เพิ่มจำนวน ${label}`}
                                            className="size-11 rounded-xl"
                                        >
                                            <Plus className="size-4" aria-hidden="true" />
                                        </Button>
                                    </div>
                                </div>
                            </article>
                        );
                    })}
                </DialogScrollArea>
                <div className="shrink-0 border-t border-border-subtle bg-surface-raised px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                    <Button
                        type="button"
                        onClick={() => onConfirm(selections)}
                        disabled={selections.length === 0}
                        className="min-h-12 w-full rounded-xl bg-module-stock-solid font-bold text-content-on-brand hover:bg-module-stock-solid-hover"
                    >
                        เพิ่ม {selections.length} ตัวเลือก · {totalQuantity} ชิ้น
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
