"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Package, Plus, ZoomIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
                <DialogContent scrollMode="area" className="flex flex-col overflow-hidden p-0 sm:max-w-[720px]">
                <div className="shrink-0 border-b border-border-subtle bg-surface-raised">
                    <div className="bg-surface-subtle px-4 py-3 pr-12 sm:px-6 sm:py-4">
                        <DialogTitle className="text-base font-semibold text-content-primary sm:text-lg">
                            เลือกรายการย่อยสำหรับเบิก
                        </DialogTitle>
                    </div>
                    <div className="px-4 py-3 sm:px-6 sm:py-4">
                        <div className="flex items-start gap-3 rounded-xl border border-border-subtle bg-surface-subtle/80 p-3 sm:gap-4 sm:rounded-2xl sm:p-4">
                            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-raised ring-1 ring-border-subtle sm:h-24 sm:w-24 sm:rounded-2xl">
                                {activeImageUrl ? (
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            setPreviewImageUrl(activeImageUrl);
                                        }}
                                        className="group/preview relative h-full w-full overflow-hidden text-left outline-none transition-transform duration-200 focus-visible:ring-2 focus-visible:ring-action-primary-ring focus-visible:ring-offset-2 active:scale-95"
                                        aria-label={`ดูรูป ${item.name} แบบพรีวิว`}
                                    >
                                        <Image
                                            src={activeImageUrl}
                                            alt={item.name}
                                            width={96}
                                            height={96}
                                            sizes="(max-width: 640px) 64px, 96px"
                                            loading="lazy"
                                            unoptimized
                                            className="h-full w-full object-contain transition-transform duration-200 group-hover/preview:scale-[1.03]"
                                        />
                                        <span className="absolute inset-0 bg-surface-inverted/0 transition-colors duration-300 group-hover/preview:bg-surface-inverted/20" />
                                        <span className="absolute bottom-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-surface-raised/90 text-content-body opacity-0 shadow-sm transition-opacity duration-200 group-hover/preview:opacity-100 group-hover/preview:text-action-primary-foreground group-focus-visible/preview:opacity-100 group-focus-visible/preview:text-action-primary-foreground">
                                            <ZoomIn className="h-3.5 w-3.5" aria-hidden="true" />
                                        </span>
                                    </button>
                                ) : (
                                    <div className="flex h-full w-full items-center justify-center text-content-border">
                                        <Package className="h-8 w-8" aria-hidden="true" />
                                    </div>
                                )}
                            </div>
                            <div className="min-w-0 flex-1 space-y-1.5 sm:space-y-2">
                                <div className="space-y-1">
                                    <h3 className="line-clamp-2 text-base font-bold leading-snug text-content-primary sm:text-lg">
                                        {item.name}
                                    </h3>
                                    {item.description && (
                                        <p className="hidden text-sm leading-6 text-content-secondary sm:line-clamp-2 sm:block">
                                            {item.description}
                                        </p>
                                    )}
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                    <Badge
                                        variant="secondary"
                                        className="max-w-full justify-start whitespace-normal border border-border-subtle bg-surface-raised text-left text-xs leading-5 text-content-body sm:text-sm"
                                    >
                                        {item.category.name}
                                    </Badge>
                                    <Badge
                                        variant="secondary"
                                        className="border border-border-subtle bg-surface-raised text-xs text-content-body sm:text-sm"
                                    >
                                        เลือกแล้ว {selectedVariantCount} รายการ
                                    </Badge>
                                    <Badge
                                        variant="secondary"
                                        className="border border-status-success-border bg-status-success-surface text-xs text-status-success-strong sm:text-sm"
                                    >
                                        รวม {selectedTotalQuantity} ชิ้น
                                    </Badge>
                                </div>
                                <p className="hidden text-xs leading-5 text-content-secondary sm:block">
                                    เลือกจำนวนของแต่ละตัวเลือกได้หลายรายการ แล้วเพิ่มเข้าตะกร้าครั้งเดียว
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:space-y-5 sm:px-6 sm:py-5">

                    <div className="space-y-3">
                        <div className="text-sm font-semibold text-content-primary">
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
                                                ? "border-status-success-border-strong bg-status-success-surface shadow-sm shadow-status-success-shadow-soft/70"
                                                : isActive
                                                    ? "border-action-primary-border-strong bg-action-primary-surface/70 shadow-sm shadow-action-primary-shadow-soft/60"
                                                    : "border-border-subtle bg-surface-raised hover:border-action-primary-border hover:bg-action-primary-surface/35"
                                        } ${availableQuantity === 0 ? "bg-surface-subtle opacity-70" : "cursor-pointer"}`}
                                    >
                                        <div className="flex flex-col gap-3">
                                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                <button
                                                    type="button"
                                                    onClick={() => focusVariant(variant)}
                                                    className="min-w-0 flex-1 space-y-1 rounded-xl text-left outline-none transition-colors duration-200 hover:text-content-heading focus-visible:ring-2 focus-visible:ring-action-primary-ring focus-visible:ring-offset-2"
                                                    aria-label={`ดูรูปและรายละเอียด ${summary || variant.sku}`}
                                                >
                                                    <div className={`font-semibold ${isSelected ? "text-status-success-emphasis" : "text-content-strong"}`}>
                                                        {summary || variant.sku}
                                                    </div>
                                                    <div className={isSelected ? "text-xs text-status-success-foreground/80" : "text-xs text-content-muted"}>
                                                        SKU: {variant.sku}
                                                    </div>
                                                </button>
                                                <div className="flex flex-wrap items-center justify-end gap-2 self-start">
                                                    <div
                                                        className={`max-w-full rounded-lg px-2.5 py-1 text-right text-sm font-bold [overflow-wrap:anywhere] ${
                                                            availableQuantity === 0
                                                                ? "bg-surface-muted text-content-muted"
                                                                : isSelected
                                                                    ? "bg-surface-raised text-status-success-strong"
                                                                    : "bg-surface-muted text-content-strong"
                                                        }`}
                                                    >
                                                        คงเหลือ {availableQuantity} {variant.unit}
                                                    </div>
                                                    {availableQuantity > 0 && quantity === 0 && (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            className="h-11 rounded-lg border-border-subtle bg-surface-raised px-3 text-sm font-semibold text-content-body hover:border-action-primary-border-strong hover:bg-action-primary-surface hover:text-action-primary-strong"
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
                                                            ? "text-status-danger-foreground"
                                                            : isSelected
                                                                ? "text-status-success-foreground"
                                                                : "text-content-muted"
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
                                                        className="h-11 w-11 rounded-lg border border-border-subtle bg-surface-raised text-content-body shadow-sm transition-colors duration-200 hover:border-action-primary-border hover:bg-action-primary-surface hover:text-action-primary-foreground"
                                                        onClick={() =>
                                                            updateVariantQuantity(variant, -1)
                                                        }
                                                        disabled={quantity === 0}
                                                        aria-label={`ลดจำนวน ${summary || variant.sku}`}
                                                    >
                                                        <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                                                    </Button>
                                                    <div className={`w-12 rounded-lg py-1 text-center text-sm font-bold ${quantity > 0 ? "bg-status-success-surface-strong text-status-success-strong" : "text-content-body"}`}>
                                                        {quantity}
                                                    </div>
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-11 w-11 rounded-lg border border-border-subtle bg-surface-raised text-content-body shadow-sm transition-colors duration-200 hover:border-action-primary-border hover:bg-action-primary-surface hover:text-action-primary-foreground"
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

                    <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-border-subtle bg-surface-subtle px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            className="h-11 border border-border-muted transition-colors duration-200 hover:border-border-subtle hover:bg-surface-subtle"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            className="h-11 bg-action-primary-solid font-bold text-content-on-brand shadow-sm transition-colors duration-200 hover:bg-action-primary-solid-hover"
                            onClick={() => onConfirm(selections)}
                            disabled={selections.length === 0}
                        >
                            <Plus className="mr-1 h-4 w-4" aria-hidden="true" />
                            เพิ่ม {selectedVariantCount} รายการ ({selectedTotalQuantity} ชิ้น)
                        </Button>
                    </div>
                </DialogContent>
                {previewImageUrl &&
                    createPortal(
                        <StockImagePreviewSurface
                            imageUrl={previewImageUrl}
                            itemName={item.name}
                            onClose={() => setPreviewImageUrl(null)}
                            ariaLabel="พรีวิวรูปวัสดุ"
                        />,
                        document.body,
                    )}
            </Dialog>
        </>
    );
}
