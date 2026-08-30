"use client";

import Image from "next/image";
import { Check, Package, Plus } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
    getBrowseCardImageUrl,
    getPreferredVariant,
    getVariantAttributeSummary,
    hasSelectableVariants,
} from "@/components/dashboard/stock/stockVariant.shared";
import type { LiffStockCatalogItem } from "@/lib/types/stock-liff";

interface LiffStockItemCardProps {
    item: LiffStockCatalogItem;
    totalInCart: number;
    recentlyAdded: boolean;
    priorityImage: boolean;
    onAddDirect: (item: LiffStockCatalogItem) => void;
    onChooseVariant: (item: LiffStockCatalogItem) => void;
}

export function LiffStockItemCard({
    item,
    totalInCart,
    recentlyAdded,
    priorityImage,
    onAddDirect,
    onChooseVariant,
}: LiffStockItemCardProps): ReactElement {
    const imageUrl = getBrowseCardImageUrl(item);
    const preferredVariant = getPreferredVariant(item);
    const multiVariant = hasSelectableVariants(item);
    const preferredSummary = getVariantAttributeSummary(
        preferredVariant?.attributeValues,
    );
    const outOfStock = item.availableQuantity <= 0;

    return (
        <article
            className={`flex min-w-0 flex-col overflow-hidden rounded-2xl bg-surface-raised shadow-sm ring-1 transition-[box-shadow,ring-color] ${
                recentlyAdded
                    ? "ring-status-success-border-strong"
                    : "ring-border-subtle"
            }`}
        >
            <div className="relative aspect-[4/3] overflow-hidden bg-surface-subtle">
                {imageUrl ? (
                    <Image
                        src={imageUrl}
                        alt={item.name}
                        fill
                        priority={priorityImage}
                        sizes="(min-width: 380px) 50vw, 100vw"
                        unoptimized
                        className="object-cover"
                    />
                ) : (
                    <div className="flex size-full items-center justify-center text-content-border">
                        <Package className="size-10" aria-hidden="true" />
                    </div>
                )}
                {totalInCart > 0 ? (
                    <span className="absolute right-2 top-2 rounded-full bg-status-success-solid px-2 py-1 text-xs font-bold tabular-nums text-content-on-brand shadow-sm">
                        ในตะกร้า {totalInCart}
                    </span>
                ) : null}
            </div>
            <div className="flex flex-1 flex-col gap-3 p-3">
                <div className="space-y-1">
                    <p className="text-xs font-semibold text-module-stock-badge-foreground">
                        {item.category.name}
                    </p>
                    <h2 className="line-clamp-2 text-sm font-bold leading-5 text-content-heading">
                        {item.name}
                    </h2>
                    <p className="break-all text-xs leading-5 text-content-muted">
                        SKU {item.sku}
                    </p>
                </div>
                <div className="mt-auto space-y-2">
                    <div className="text-xs leading-5 text-content-secondary">
                        {multiVariant
                            ? `${item.variants.length} ตัวเลือก`
                            : preferredSummary || preferredVariant?.unit || item.unit}
                    </div>
                    <div className="flex items-baseline justify-between gap-2">
                        <span className="text-xs text-content-muted">พร้อมเบิก</span>
                        <span className={`text-sm font-bold tabular-nums ${
                            outOfStock
                                ? "text-content-muted"
                                : "text-status-success-foreground"
                        }`}>
                            {item.availableQuantity} {item.unit}
                        </span>
                    </div>
                    <Button
                        type="button"
                        onClick={() =>
                            multiVariant ? onChooseVariant(item) : onAddDirect(item)
                        }
                        disabled={outOfStock}
                        className="min-h-11 w-full rounded-xl bg-module-stock-solid font-bold text-content-on-brand hover:bg-module-stock-solid-hover"
                    >
                        {recentlyAdded ? (
                            <Check className="size-4" aria-hidden="true" />
                        ) : (
                            <Plus className="size-4" aria-hidden="true" />
                        )}
                        {outOfStock
                            ? "วัสดุหมด"
                            : multiVariant
                                ? "เลือกตัวเลือก"
                                : "เพิ่มลงตะกร้า"}
                    </Button>
                </div>
            </div>
        </article>
    );
}
