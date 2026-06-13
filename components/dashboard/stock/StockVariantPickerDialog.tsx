"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Minus, Package, Plus, ZoomIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogPortal, DialogTitle } from "@/components/ui/dialog";
import type { StockItem, StockItemVariant } from "../context/stock/types";
import {
    getBrowseImageUrl,
    getVariantAttributeSummary,
    getVariantAvailableQuantity,
} from "./stockVariant.shared";
import { StockImagePreviewSurface } from "./StockImagePreviewSurface";

type VariantSelection = {
    variant: StockItemVariant;
    quantity: number;
};

type StockVariantPickerDialogProps = {
    item: StockItem | null;
    open: boolean;
    onClose: () => void;
    onConfirm: (selections: VariantSelection[]) => void;
};

function getInitialActiveVariantId(variants: StockItemVariant[]): number | null {
    const firstAvailableVariant =
        variants.find((variant) => getVariantAvailableQuantity(variant) > 0) ??
        variants[0] ??
        null;

    return firstAvailableVariant?.id ?? null;
}

export function StockVariantPickerDialog({
    item,
    open,
    onClose,
    onConfirm,
}: StockVariantPickerDialogProps) {
    const variants = useMemo(() => item?.variants ?? [], [item]);
    const itemId = item?.id ?? null;
    const [initializedItemId, setInitializedItemId] = useState<number | null>(null);
    const [activeVariantId, setActiveVariantId] = useState<number | null>(null);
    const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
    const [selectedQuantities, setSelectedQuantities] = useState<Record<number, number>>({});

    useEffect(() => {
        if (!previewImageUrl) {
            return undefined;
        }

        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === "Escape") {
                setPreviewImageUrl(null);
            }
        }

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [previewImageUrl]);

    useEffect(() => {
        if (!open) {
            setInitializedItemId(null);
            setActiveVariantId(null);
            setPreviewImageUrl(null);
            setSelectedQuantities({});
            return;
        }

        if (itemId === null || initializedItemId === itemId) {
            return;
        }

        setInitializedItemId(itemId);
        setActiveVariantId(getInitialActiveVariantId(variants));
        setSelectedQuantities({});
    }, [initializedItemId, itemId, open, variants]);

    const activeVariant = useMemo(
        () => variants.find((variant) => variant.id === activeVariantId) ?? null,
        [activeVariantId, variants],
    );

    const selections = useMemo(
        () =>
            variants.flatMap((variant) => {
                const quantity = Math.min(
                    getVariantAvailableQuantity(variant),
                    selectedQuantities[variant.id] ?? 0,
                );

                if (quantity <= 0) {
                    return [];
                }

                return [{ variant, quantity }];
            }),
        [selectedQuantities, variants],
    );

    const selectedVariantCount = selections.length;
    const selectedTotalQuantity = selections.reduce(
        (total, selection) => total + selection.quantity,
        0,
    );

    if (!item) {
        return null;
    }

    const activeImageUrl = getBrowseImageUrl(item, activeVariant);

    function focusVariant(variant: StockItemVariant): void {
        setActiveVariantId(variant.id);
    }

    function updateVariantQuantity(variant: StockItemVariant, delta: number): void {
        const maxQuantity = getVariantAvailableQuantity(variant);

        focusVariant(variant);
        setSelectedQuantities((current) => {
            const existingQuantity = current[variant.id] ?? 0;
            const nextQuantity = Math.min(
                maxQuantity,
                Math.max(0, existingQuantity + delta),
            );

            if (nextQuantity === existingQuantity) {
                return current;
            }

            if (nextQuantity === 0) {
                const next = { ...current };
                delete next[variant.id];
                return next;
            }

            return {
                ...current,
                [variant.id]: nextQuantity,
            };
        });
    }

    function handleVariantCardClick(variant: StockItemVariant): void {
        focusVariant(variant);

        if (getVariantAvailableQuantity(variant) === 0) {
            return;
        }

        setSelectedQuantities((current) => {
            if ((current[variant.id] ?? 0) > 0) {
                return current;
            }

            return {
                ...current,
                [variant.id]: 1,
            };
        });
    }

    return (
        <>
            <Dialog
                open={open}
                onOpenChange={(nextOpen) => {
                    if (nextOpen) {
                        return;
                    }

                    if (previewImageUrl) {
                        setPreviewImageUrl(null);
                        return;
                    }

                    onClose();
                }}
            >
                <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden p-0 sm:max-w-[720px]">
                <div className="shrink-0 border-b border-slate-200 bg-white">
                    <div className="bg-slate-50 px-5 py-4 sm:px-6">
                        <DialogTitle className="text-lg font-semibold text-slate-900">
                            เลือกรายการย่อยสำหรับเบิก
                        </DialogTitle>
                    </div>
                    <div className="px-5 py-4 sm:px-6">
                        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4 sm:flex-row">
                            <div className="h-24 w-24 overflow-hidden rounded-2xl bg-white ring-1 ring-slate-200">
                                {activeImageUrl ? (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setPreviewImageUrl(activeImageUrl);
                                        }}
                                        className="group/preview relative h-full w-full overflow-hidden text-left outline-none transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 active:scale-95"
                                        aria-label={`ดูรูป ${item.name} แบบพรีวิว`}
                                    >
                                        <Image
                                            src={activeImageUrl}
                                            alt={item.name}
                                            width={96}
                                            height={96}
                                            sizes="96px"
                                            loading="lazy"
                                            unoptimized
                                            className="h-full w-full object-contain transition-transform duration-200 group-hover/preview:scale-[1.03]"
                                        />
                                        <span className="absolute inset-0 bg-slate-950/0 transition-colors duration-300 group-hover/preview:bg-slate-950/20" />
                                        <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-slate-700 opacity-0 shadow-sm transition-opacity duration-200 group-hover/preview:opacity-100 group-hover/preview:text-blue-700 group-focus-visible/preview:opacity-100 group-focus-visible/preview:text-blue-700">
                                            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                                        </span>
                                    </button>
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-slate-300">
                                        <Package className="h-8 w-8" aria-hidden="true" />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 space-y-2">
                                <div className="space-y-1">
                                    <h3 className="text-lg font-bold text-slate-900">
                                        {item.name}
                                    </h3>
                                    {item.description && (
                                        <p className="text-sm leading-6 text-slate-600">
                                            {item.description}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Badge
                                        variant="secondary"
                                        className="border border-slate-200 bg-white text-slate-700"
                                    >
                                        {item.category.name}
                                    </Badge>
                                    <Badge
                                        variant="secondary"
                                        className="border border-slate-200 bg-white text-slate-700"
                                    >
                                        เลือกแล้ว {selectedVariantCount} รายการ
                                    </Badge>
                                    <Badge
                                        variant="secondary"
                                        className="border border-emerald-200 bg-emerald-50 text-emerald-800"
                                    >
                                        รวม {selectedTotalQuantity} ชิ้น
                                    </Badge>
                                </div>
                                <p className="text-xs leading-5 text-slate-600">
                                    เลือกจำนวนของแต่ละตัวเลือกได้หลายรายการ แล้วเพิ่มเข้าตะกร้าครั้งเดียว
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-5 sm:px-6">

                    <div className="space-y-3">
                        <div className="text-sm font-semibold text-slate-900">
                            ตัวเลือกที่มี
                        </div>
                        <div className="grid gap-3">
                            {variants.map((variant) => {
                                const availableQuantity = getVariantAvailableQuantity(variant);
                                const quantity = selectedQuantities[variant.id] ?? 0;
                                const isActive = variant.id === activeVariantId;
                                const isSelected = quantity > 0;
                                const summary = getVariantAttributeSummary(
                                    variant.attributeValues,
                                );

                                return (
                                    <div
                                        key={variant.id}
                                        onClick={() => focusVariant(variant)}
                                        className={`rounded-2xl border p-4 text-left transition-[border-color,background-color,box-shadow,opacity] duration-200 ${
                                            isSelected
                                                ? "border-emerald-300 bg-emerald-50 shadow-sm shadow-emerald-100/70"
                                                : isActive
                                                    ? "border-blue-300 bg-blue-50/70 shadow-sm shadow-blue-100/60"
                                                    : "border-slate-200 bg-white hover:border-blue-200 hover:bg-blue-50/35"
                                        } ${availableQuantity === 0 ? "bg-slate-50 opacity-70" : "cursor-pointer"}`}
                                    >
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <button
                                                    type="button"
                                                    onClick={() => focusVariant(variant)}
                                                    className="min-w-0 flex-1 space-y-1 rounded-xl text-left outline-none transition-colors duration-200 hover:text-slate-950 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                                                    aria-label={`ดูรูปและรายละเอียด ${summary || variant.sku}`}
                                                >
                                                    <div className={`font-semibold ${isSelected ? "text-emerald-900" : "text-slate-800"}`}>
                                                        {summary || variant.sku}
                                                    </div>
                                                    <div className={isSelected ? "text-xs text-emerald-700/80" : "text-xs text-slate-500"}>
                                                        SKU: {variant.sku}
                                                    </div>
                                                </button>
                                                <div className="flex items-center gap-2 self-start">
                                                    <div
                                                        className={`rounded-lg px-2.5 py-1 text-sm font-bold ${
                                                            availableQuantity === 0
                                                                ? "bg-slate-100 text-slate-500"
                                                                : isSelected
                                                                    ? "bg-white text-emerald-800"
                                                                    : "bg-slate-100 text-slate-800"
                                                        }`}
                                                    >
                                                        คงเหลือ {availableQuantity} {variant.unit}
                                                    </div>
                                                    {availableQuantity > 0 && quantity === 0 && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="h-8 rounded-lg border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
                                                            onClick={() =>
                                                                handleVariantCardClick(variant)
                                                            }
                                                            aria-label={`เลือก ${summary || variant.sku}`}
                                                        >
                                                            เลือก
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="flex items-center justify-between gap-3">
                                                <div
                                                    className={`text-xs ${
                                                        availableQuantity === 0
                                                            ? "text-rose-600"
                                                            : isSelected
                                                                ? "text-emerald-700"
                                                                : "text-slate-500"
                                                    }`}
                                                >
                                                    {availableQuantity === 0
                                                        ? "สินค้าหมดชั่วคราว"
                                                        : isSelected
                                                            ? "เลือกตัวเลือกนี้แล้ว"
                                                            : "กด + / - เพื่อกำหนดจำนวนของตัวเลือกนี้"}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-11 w-11 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                                        onClick={() =>
                                                            updateVariantQuantity(variant, -1)
                                                        }
                                                        disabled={quantity === 0}
                                                        aria-label={`ลดจำนวน ${summary || variant.sku}`}
                                                    >
                                                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                                                    </Button>
                                                    <div className={`w-12 rounded-lg py-1 text-center text-sm font-bold ${quantity > 0 ? "bg-emerald-100 text-emerald-800" : "text-slate-700"}`}>
                                                        {quantity}
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-11 w-11 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors duration-200 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                                                        onClick={() =>
                                                            updateVariantQuantity(variant, 1)
                                                        }
                                                        disabled={
                                                            availableQuantity === 0
                                                            || quantity >= availableQuantity
                                                        }
                                                        aria-label={`เพิ่มจำนวน ${summary || variant.sku}`}
                                                    >
                                                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                </div>

                    <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            className="h-11 border border-slate-100 transition-colors duration-200 hover:border-slate-200 hover:bg-slate-50"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            className="group/confirm h-11 bg-blue-600 font-bold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700"
                            onClick={() => onConfirm(selections)}
                            disabled={selections.length === 0}
                        >
                            <Plus className="mr-1 h-4 w-4 transition-transform duration-300 group-hover/confirm:translate-x-0.5 group-hover/confirm:scale-110" aria-hidden="true" />
                            เพิ่ม {selectedVariantCount} รายการ ({selectedTotalQuantity} ชิ้น)
                        </Button>
                    </div>
                </DialogContent>
                {previewImageUrl && (
                    <DialogPortal>
                        <StockImagePreviewSurface
                            imageUrl={previewImageUrl}
                            itemName={item.name}
                            onClose={() => setPreviewImageUrl(null)}
                            ariaLabel="พรีวิวรูปวัสดุ"
                        />
                    </DialogPortal>
                )}
            </Dialog>
        </>
    );
}
