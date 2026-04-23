"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Minus, Package, Plus } from "lucide-react";
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

export function StockVariantPickerDialog({
    item,
    open,
    onClose,
    onConfirm,
}: StockVariantPickerDialogProps) {
    const variants = useMemo(() => item?.variants ?? [], [item]);
    const [activeVariantId, setActiveVariantId] = useState<number | null>(null);
    const [selectedQuantities, setSelectedQuantities] = useState<Record<number, number>>({});

    useEffect(() => {
        if (!open) {
            setActiveVariantId(null);
            setSelectedQuantities({});
            return;
        }

        const firstAvailableVariant =
            variants.find((variant) => getVariantAvailableQuantity(variant) > 0) ??
            variants[0] ??
            null;

        setActiveVariantId(firstAvailableVariant?.id ?? null);
        setSelectedQuantities({});
    }, [open, variants]);

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

    function updateVariantQuantity(variant: StockItemVariant, delta: number): void {
        const maxQuantity = getVariantAvailableQuantity(variant);

        setActiveVariantId(variant.id);
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
        setActiveVariantId(variant.id);

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
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-h-[90vh] overflow-y-auto p-0 sm:max-w-[720px]">
                <div className="border-b border-gray-100 bg-slate-50/60 px-6 py-4">
                    <DialogTitle className="text-lg font-semibold text-slate-800">
                        เลือกรายการย่อยสำหรับเบิก
                    </DialogTitle>
                </div>
                <div className="space-y-5 px-6 py-5">
                    <div className="flex flex-col gap-4 rounded-2xl border border-slate-100 bg-white p-4 sm:flex-row">
                        <div className="h-24 w-24 overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                            {getBrowseImageUrl(item, activeVariant) ? (
                                <Image
                                    src={getBrowseImageUrl(item, activeVariant) ?? ""}
                                    alt={item.name}
                                    width={96}
                                    height={96}
                                    unoptimized
                                    className="h-full w-full object-contain"
                                />
                            ) : (
                                <div className="flex h-full w-full items-center justify-center text-slate-400">
                                    <Package className="h-8 w-8" />
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
                                        className={`rounded-2xl border p-4 text-left transition-all duration-300 ${
                                            isSelected
                                                ? "border-blue-300 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(219,234,254,0.88))] shadow-[0_18px_34px_-24px_rgba(37,99,235,0.45)]"
                                                : isActive
                                                    ? "border-slate-300 bg-slate-50 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.45)]"
                                                    : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-[0_16px_28px_-24px_rgba(37,99,235,0.35)]"
                                        } ${availableQuantity === 0 ? "opacity-60" : ""}`}
                                    >
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <div className="space-y-1">
                                                    <div className="font-semibold text-slate-800">
                                                        {summary || variant.sku}
                                                    </div>
                                                    <div className="text-xs text-slate-500">
                                                        SKU: {variant.sku}
                                                    </div>
                                                </div>
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
                                                <div
                                                    className="flex items-center gap-2"
                                                    onClick={(event) => event.stopPropagation()}
                                                    onKeyDown={(event) => event.stopPropagation()}
                                                >
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-8 w-8 rounded-lg border border-transparent bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-100 hover:shadow-md"
                                                        onClick={() =>
                                                            updateVariantQuantity(variant, -1)
                                                        }
                                                        disabled={quantity === 0}
                                                    >
                                                        <Minus className="h-3.5 w-3.5" />
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
                                                    >
                                                        <Plus className="h-3.5 w-3.5" />
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
                            <Plus className="mr-1 h-4 w-4 transition-transform duration-300 group-hover/confirm:translate-x-0.5 group-hover/confirm:scale-110" />
                            เพิ่ม {selectedVariantCount} รายการ ({selectedTotalQuantity} ชิ้น)
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
