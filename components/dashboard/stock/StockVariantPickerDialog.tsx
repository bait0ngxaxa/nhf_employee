"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Minus, Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { StockItem, StockItemVariant } from "../context/stock/types";
import {
    getBrowseImageUrl,
    getVariantAvailableQuantity,
    getVariantAttributeSummary,
} from "./stockVariant.shared";

type StockVariantPickerDialogProps = {
    item: StockItem | null;
    open: boolean;
    onClose: () => void;
    onConfirm: (variant: StockItemVariant, quantity: number) => void;
};

export function StockVariantPickerDialog({
    item,
    open,
    onClose,
    onConfirm,
}: StockVariantPickerDialogProps) {
    const variants = useMemo(() => item?.variants ?? [], [item]);
    const [selectedVariantId, setSelectedVariantId] = useState<number | null>(null);
    const [quantity, setQuantity] = useState(1);

    useEffect(() => {
        if (!open) {
            setSelectedVariantId(null);
            setQuantity(1);
            return;
        }

        const firstAvailableVariant =
            variants.find((variant) => getVariantAvailableQuantity(variant) > 0) ??
            variants[0] ??
            null;
        setSelectedVariantId(firstAvailableVariant?.id ?? null);
        setQuantity(1);
    }, [open, variants]);

    const selectedVariant = useMemo(
        () => variants.find((variant) => variant.id === selectedVariantId) ?? null,
        [selectedVariantId, variants],
    );
    const selectedVariantAvailableQuantity = selectedVariant
        ? getVariantAvailableQuantity(selectedVariant)
        : 0;

    if (!item) {
        return null;
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
                            {getBrowseImageUrl(item, selectedVariant) ? (
                                <Image
                                    src={getBrowseImageUrl(item, selectedVariant) ?? ""}
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
                            <Badge
                                variant="secondary"
                                className="border-none bg-indigo-50 text-indigo-700"
                            >
                                {item.category.name}
                            </Badge>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="text-sm font-semibold text-slate-700">
                            ตัวเลือกที่มี
                        </div>
                        <div className="grid gap-3">
                            {variants.map((variant) => {
                                const isSelected = variant.id === selectedVariantId;
                                const summary = getVariantAttributeSummary(
                                    variant.attributeValues,
                                );

                                return (
                                    <button
                                        key={variant.id}
                                        type="button"
                                        className={`group/variant rounded-2xl border p-4 text-left transition-all duration-300 ${
                                            isSelected
                                                ? "border-blue-300 bg-[linear-gradient(135deg,rgba(239,246,255,0.96),rgba(219,234,254,0.88))] shadow-[0_18px_34px_-24px_rgba(37,99,235,0.45)]"
                                                : "border-slate-200 bg-white hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50/30 hover:shadow-[0_16px_28px_-24px_rgba(37,99,235,0.35)]"
                                        }`}
                                        onClick={() => {
                                            setSelectedVariantId(variant.id);
                                            setQuantity(1);
                                        }}
                                    >
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <div className="space-y-1">
                                                <div className="font-semibold text-slate-800">
                                                    {summary || variant.sku}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    SKU: {variant.sku}
                                                </div>
                                            </div>
                                            <div className="rounded-lg bg-slate-50 px-2.5 py-1 text-sm font-bold text-slate-700 transition-all duration-300 group-hover/variant:bg-white group-hover/variant:shadow-sm">
                                                คงเหลือ {variant.quantity} {variant.unit}
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {selectedVariant && (
                        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="space-y-1">
                                <div className="text-sm font-semibold text-slate-800">
                                    จำนวนที่ต้องการเบิก
                                </div>
                                <div className="text-xs text-slate-500">
                                    สูงสุด {selectedVariant.quantity} {selectedVariant.unit}
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-lg border border-transparent bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-100 hover:shadow-md"
                                    onClick={() =>
                                        setQuantity((current) => Math.max(1, current - 1))
                                    }
                                >
                                    <Minus className="h-4 w-4" />
                                </Button>
                                <div className="w-16 text-center font-bold text-blue-700">
                                    {quantity}
                                </div>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9 rounded-lg border border-transparent bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-200 hover:bg-slate-100 hover:shadow-md"
                                    onClick={() =>
                                        setQuantity((current) =>
                                            Math.min(
                                                selectedVariantAvailableQuantity,
                                                current + 1,
                                            ),
                                        )
                                    }
                                    disabled={quantity >= selectedVariantAvailableQuantity}
                                >
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}

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
                            onClick={() => {
                                if (!selectedVariant) {
                                    return;
                                }
                                onConfirm(selectedVariant, quantity);
                            }}
                            disabled={
                                !selectedVariant ||
                                selectedVariantAvailableQuantity === 0
                            }
                        >
                            <Plus className="mr-1 h-4 w-4 transition-transform duration-300 group-hover/confirm:translate-x-0.5 group-hover/confirm:scale-110" />
                            เพิ่มในรายการเบิก
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
