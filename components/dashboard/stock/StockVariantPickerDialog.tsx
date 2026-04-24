"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Minus, Package, Plus, X, ZoomIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { StockItem, StockItemVariant } from "../context/stock/types";
import {
    getBrowseImageUrl,
    getVariantAttributeSummary,
    getVariantAvailableQuantity,
} from "./stockVariant.shared";

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
                <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-[720px]">
                <div className="border-b border-gray-100 bg-slate-50/60 px-6 py-4">
                    <DialogTitle className="text-lg font-semibold text-slate-800">
                        เลือกรายการย่อยสำหรับเบิก
                    </DialogTitle>
                </div>
                <div className="space-y-5 px-6 py-5">
                    <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 sm:flex-row">
                        <div className="h-24 w-24 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                            {activeImageUrl ? (
                                <button
                                    type="button"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        setPreviewImageUrl(activeImageUrl);
                                    }}
                                    className="group/preview relative h-full w-full overflow-hidden text-left outline-none transition-transform duration-300 hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 active:scale-95"
                                    aria-label={`ดูรูป ${item.name} แบบพรีวิว`}
                                >
                                    <Image
                                        src={activeImageUrl}
                                        alt={item.name}
                                        width={96}
                                        height={96}
                                        unoptimized
                                        className="h-full w-full object-contain transition-transform duration-500 group-hover/preview:scale-110"
                                    />
                                    <span className="absolute inset-0 bg-slate-950/0 transition-colors duration-300 group-hover/preview:bg-slate-950/20" />
                                    <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 translate-y-1 scale-95 items-center justify-center rounded-full bg-white/90 text-slate-700 opacity-0 shadow-lg shadow-slate-900/15 transition-all duration-300 group-hover/preview:translate-y-0 group-hover/preview:scale-110 group-hover/preview:opacity-100 group-hover/preview:text-blue-700 group-focus-visible/preview:translate-y-0 group-focus-visible/preview:scale-110 group-focus-visible/preview:opacity-100 group-focus-visible/preview:text-blue-700">
                                        <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                                    </span>
                                </button>
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-slate-400">
                                    <Package className="h-8 w-8" aria-hidden="true" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 space-y-2">
                            <div className="space-y-1">
                                <h3 className="text-lg font-bold text-slate-800">
                                    {item.name}
                                </h3>
                                {item.description && (
                                    <p className="text-sm text-slate-500">
                                        {item.description}
                                    </p>
                                )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge
                                    variant="secondary"
                                    className="border-none bg-indigo-50 text-indigo-700"
                                >
                                    {item.category.name}
                                </Badge>
                                <Badge
                                    variant="secondary"
                                    className="border-none bg-blue-50 text-blue-700"
                                >
                                    เลือกแล้ว {selectedVariantCount} รายการ
                                </Badge>
                                <Badge
                                    variant="secondary"
                                    className="border-none bg-emerald-50 text-emerald-700"
                                >
                                    รวม {selectedTotalQuantity} ชิ้น
                                </Badge>
                            </div>
                            <p className="text-xs text-slate-500">
                                เลือกจำนวนของแต่ละตัวเลือกได้หลายรายการ แล้วเพิ่มเข้าตะกร้าครั้งเดียว
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="text-sm font-semibold text-slate-700">
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
                                        className={`rounded-2xl border p-4 text-left transition-all duration-300 ${
                                            isSelected
                                                ? "border-blue-300 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(219,234,254,0.88))] shadow-[0_18px_34px_-24px_rgba(37,99,235,0.45)]"
                                                : isActive
                                                    ? "border-slate-300 bg-slate-50 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.45)]"
                                                    : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-[0_16px_28px_-24px_rgba(37,99,235,0.35)]"
                                        } ${availableQuantity === 0 ? "opacity-60" : "cursor-pointer"}`}
                                    >
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <button
                                                    type="button"
                                                    onClick={() => focusVariant(variant)}
                                                    className="min-w-0 flex-1 space-y-1 rounded-xl text-left outline-none transition-colors duration-200 hover:text-blue-700 focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                                                    aria-label={`ดูรูปและรายละเอียด ${summary || variant.sku}`}
                                                >
                                                    <div className="font-semibold text-slate-800">
                                                        {summary || variant.sku}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        SKU: {variant.sku}
                                                    </div>
                                                </button>
                                                <div className="flex items-center gap-2 self-start">
                                                    <div className="rounded-lg bg-slate-50 px-2.5 py-1 text-sm font-bold text-slate-700">
                                                        คงเหลือ {availableQuantity} {variant.unit}
                                                    </div>
                                                    {availableQuantity > 0 && quantity === 0 && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="h-8 rounded-lg border-blue-200 px-3 text-xs font-semibold text-blue-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-800"
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
                                                <div className="text-xs text-slate-500">
                                                    {availableQuantity === 0
                                                        ? "สินค้าหมดชั่วคราว"
                                                        : "กด + / - เพื่อกำหนดจำนวนของตัวเลือกนี้"}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-lg border border-transparent bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-100 hover:shadow-md"
                                                        onClick={() =>
                                                            updateVariantQuantity(variant, -1)
                                                        }
                                                        disabled={quantity === 0}
                                                        aria-label={`ลดจำนวน ${summary || variant.sku}`}
                                                    >
                                                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                                                    </Button>
                                                    <div className="w-12 text-center text-sm font-bold text-blue-700">
                                                        {quantity}
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-lg border border-transparent bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-100 hover:shadow-md"
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

                    <div className="flex justify-end gap-3 pt-2">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            className="border border-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-50 hover:shadow-sm"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            className="group/confirm bg-[linear-gradient(135deg,#2563EB,#1D4ED8)] font-bold text-white shadow-[0_18px_34px_-22px_rgba(37,99,235,0.95)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_22px_38px_-20px_rgba(37,99,235,0.95)]"
                            onClick={() => onConfirm(selections)}
                            disabled={selections.length === 0}
                        >
                            <Plus className="mr-1 h-4 w-4 transition-transform duration-300 group-hover/confirm:translate-x-0.5 group-hover/confirm:scale-110" aria-hidden="true" />
                            เพิ่ม {selectedVariantCount} รายการ ({selectedTotalQuantity} ชิ้น)
                        </Button>
                    </div>
                </div>

                {previewImageUrl && (
                    <div
                        className="fixed inset-0 z-[70] flex items-center justify-center bg-white/10 p-4 backdrop-blur-xl sm:p-6"
                        role="dialog"
                        aria-modal="true"
                        aria-label="พรีวิวรูปวัสดุ"
                        onClick={() => setPreviewImageUrl(null)}
                    >
                        <div
                            className="relative flex max-h-[86vh] w-full max-w-[860px] items-center justify-center rounded-[1.75rem] border border-white/15 bg-slate-900/80 p-3 shadow-[0_30px_90px_-34px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-4"
                            onClick={(event) => event.stopPropagation()}
                        >
                            <button
                                type="button"
                                onClick={() => setPreviewImageUrl(null)}
                                className="group/close absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/90 text-slate-950 shadow-[0_18px_36px_-18px_rgba(0,0,0,0.85)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:rotate-3 hover:bg-white hover:shadow-[0_22px_44px_-18px_rgba(0,0,0,0.95)] focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:right-4 sm:top-4 sm:h-11 sm:w-11"
                                aria-label="ปิดพรีวิวรูป"
                            >
                                <X className="h-5 w-5 transition-transform duration-200 group-hover/close:scale-110" aria-hidden="true" />
                            </button>
                            <Image
                                src={previewImageUrl}
                                alt={item.name}
                                width={1200}
                                height={900}
                                unoptimized
                                className="h-auto max-h-[78vh] w-auto max-w-full rounded-[1.25rem] object-contain"
                            />
                        </div>
                    </div>
                )}
                </DialogContent>
            </Dialog>
        </>
    );
}
