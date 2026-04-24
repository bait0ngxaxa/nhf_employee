"use client";

import Image from "next/image";
import { useState } from "react";
import { Check, Package, Plus, ShoppingCart, X, ZoomIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { StockItem } from "../context/stock/types";
import {
    getBrowseCardImageUrl,
    getItemAvailableQuantity,
    getPreferredVariant,
    getSelectableVariantCount,
    getVariantAttributeSummary,
    hasSelectableVariants,
} from "./stockVariant.shared";

type StockBrowseGridProps = {
    items: StockItem[];
    cartQuantityByItemId: Map<number, number>;
    onAddDirect: (item: StockItem) => void;
    onOpenVariantPicker: (item: StockItem) => void;
    recentlyAddedItemId: number | null;
};

type ImagePreviewState = {
    imageUrl: string;
    itemName: string;
} | null;

export function StockBrowseGrid({
    items,
    cartQuantityByItemId,
    onAddDirect,
    onOpenVariantPicker,
    recentlyAddedItemId,
}: StockBrowseGridProps) {
    const [imagePreview, setImagePreview] = useState<ImagePreviewState>(null);

    return (
        <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((item) => (
                    <BrowseCard
                        key={item.id}
                        item={item}
                        cartQuantityByItemId={cartQuantityByItemId}
                        onAddDirect={onAddDirect}
                        onOpenVariantPicker={onOpenVariantPicker}
                        onPreviewImage={(imageUrl) =>
                            setImagePreview({ imageUrl, itemName: item.name })
                        }
                        recentlyAddedItemId={recentlyAddedItemId}
                    />
                ))}
            </div>

            {imagePreview && (
                <ImagePreviewOverlay
                    imageUrl={imagePreview.imageUrl}
                    itemName={imagePreview.itemName}
                    onClose={() => setImagePreview(null)}
                />
            )}
        </>
    );
}

function ImagePreviewOverlay({
    imageUrl,
    itemName,
    onClose,
}: {
    imageUrl: string;
    itemName: string;
    onClose: () => void;
}) {
    return (
        <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-white/10 p-4 backdrop-blur-xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={`พรีวิวรูป ${itemName}`}
            onClick={onClose}
        >
            <div
                className="relative flex max-h-[86vh] w-full max-w-[860px] items-center justify-center rounded-[1.75rem] border border-white/15 bg-slate-900/80 p-3 shadow-[0_30px_90px_-34px_rgba(0,0,0,0.95)] backdrop-blur-xl sm:p-4"
                onClick={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={onClose}
                    className="group/close absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-2xl border border-white/20 bg-white/90 text-slate-950 shadow-[0_18px_36px_-18px_rgba(0,0,0,0.85)] backdrop-blur-md transition-all duration-200 hover:-translate-y-0.5 hover:rotate-3 hover:bg-white hover:shadow-[0_22px_44px_-18px_rgba(0,0,0,0.95)] focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 sm:right-4 sm:top-4 sm:h-11 sm:w-11"
                    aria-label="ปิดพรีวิวรูป"
                >
                    <X className="h-5 w-5 transition-transform duration-200 group-hover/close:scale-110" aria-hidden="true" />
                </button>
                <Image
                    src={imageUrl}
                    alt={itemName}
                    width={1200}
                    height={900}
                    unoptimized
                    className="h-auto max-h-[78vh] w-auto max-w-full rounded-[1.25rem] object-contain"
                />
            </div>
        </div>
    );
}

function BrowseCard(props: {
    item: StockItem;
    cartQuantityByItemId: Map<number, number>;
    onAddDirect: (item: StockItem) => void;
    onOpenVariantPicker: (item: StockItem) => void;
    onPreviewImage: (imageUrl: string) => void;
    recentlyAddedItemId: number | null;
}) {
    const { item } = props;
    const defaultVariant = getPreferredVariant(item);
    const imageUrl = getBrowseCardImageUrl(item);
    const availableQuantity = getItemAvailableQuantity(item);
    const variantCount = getSelectableVariantCount(item);
    const totalInCart = props.cartQuantityByItemId.get(item.id) ?? 0;
    const isRecentlyAdded = props.recentlyAddedItemId === item.id;
    const variantSummary = getVariantAttributeSummary(defaultVariant?.attributeValues);

    return (
        <Card className={`group relative h-full overflow-hidden rounded-[1.6rem] border border-slate-200/80 bg-white transition-all duration-500 hover:-translate-y-1 hover:border-orange-200 hover:shadow-[0_28px_60px_-32px_rgba(249,115,22,0.28)] ${isRecentlyAdded ? "ring-2 ring-emerald-300/70 shadow-[0_28px_60px_-32px_rgba(16,185,129,0.35)]" : ""}`}>
            <div className="absolute inset-x-0 -top-px h-px w-full bg-gradient-to-r from-transparent via-orange-300/40 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <CardContent className="flex h-full flex-col gap-3 p-4">
                <div className="overflow-hidden rounded-[1.35rem] bg-slate-100 ring-1 ring-slate-200 shadow-inner shadow-white/70">
                    {imageUrl ? (
                        <button
                            type="button"
                            onClick={() => props.onPreviewImage(imageUrl)}
                            className="group/preview relative block h-40 w-full overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                            aria-label={`ดูรูป ${item.name} แบบพรีวิว`}
                        >
                            <Image
                                src={imageUrl}
                                alt={item.name}
                                width={400}
                                height={280}
                                unoptimized
                                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] group-hover/preview:scale-[1.08]"
                            />
                            <span className="absolute inset-0 bg-slate-950/0 transition-colors duration-300 group-hover/preview:bg-slate-950/20" />
                            <span className="absolute bottom-2 right-2 flex h-8 w-8 translate-y-1 scale-95 items-center justify-center rounded-full bg-white/90 text-slate-700 opacity-0 shadow-lg shadow-slate-900/15 transition-all duration-300 group-hover/preview:translate-y-0 group-hover/preview:scale-110 group-hover/preview:opacity-100 group-hover/preview:text-blue-700 group-focus-visible/preview:translate-y-0 group-focus-visible/preview:scale-110 group-focus-visible/preview:opacity-100 group-focus-visible/preview:text-blue-700">
                                <ZoomIn className="h-4 w-4" aria-hidden="true" />
                            </span>
                        </button>
                    ) : (
                        <div className="flex h-40 items-center justify-center text-slate-400">
                            <Package className="h-10 w-10" aria-hidden="true" />
                        </div>
                    )}
                </div>

                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="truncate font-bold text-gray-800 transition-colors group-hover:text-orange-700">
                            {item.name}
                        </h3>
                        <p
                            title={item.sku}
                            className="truncate rounded-md bg-gray-50 px-1.5 py-0.5 font-mono text-xs font-medium text-gray-400"
                        >
                            {item.sku}
                        </p>
                    </div>
                    <Badge
                        variant="secondary"
                        className="max-w-[8.5rem] shrink-0 truncate border border-indigo-100 bg-indigo-50/90 px-2.5 text-indigo-700 shadow-sm shadow-indigo-100/60 hover:bg-indigo-100"
                        title={item.category.name}
                    >
                        {item.category.name}
                    </Badge>
                </div>

                <div className="min-h-[2.25rem]">
                    {item.description ? (
                        <p className="line-clamp-2 text-sm text-slate-500">
                            {item.description}
                        </p>
                    ) : null}
                </div>

                <div className="flex min-h-[6.5rem] flex-col justify-between rounded-[1.2rem] border border-slate-200/80 bg-slate-50 p-3 shadow-inner shadow-white">
                    <div className="min-h-4 text-sm font-medium text-slate-700">
                        {hasSelectableVariants(item) ? (
                            <>มี {variantCount} ตัวเลือก</>
                        ) : variantSummary ? (
                            variantSummary
                        ) : null}
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                คงเหลือ
                            </span>
                            <span className="rounded-lg bg-white px-2.5 py-1 text-sm font-bold text-slate-700 shadow-sm">
                                {availableQuantity} {item.unit}
                            </span>
                        </div>
                        <div
                            className={`min-h-[0.875rem] text-xs ${
                                item.reservedQuantity > 0
                                    ? "text-amber-600"
                                    : "text-transparent"
                            }`}
                        >
                            {item.reservedQuantity > 0
                                ? `รอจ่าย ${item.reservedQuantity} ${item.unit}`
                                : ""}
                        </div>
                    </div>
                </div>

                <div className="mt-auto space-y-2">
                    {totalInCart > 0 && (
                        <div className="flex min-h-4 items-center gap-2 text-sm font-medium text-orange-700">
                            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                            อยู่ในรายการเบิกแล้ว {totalInCart} {item.unit}
                        </div>
                    )}
                    <Button
                        variant="default"
                        className={`group/button relative isolate w-full overflow-hidden rounded-xl shadow-sm ring-offset-2 transition-all duration-300 focus-visible:ring-2 focus-visible:ring-blue-400 active:translate-y-0.5 active:scale-[0.98] ${
                            availableQuantity === 0
                                ? "border-gray-200 bg-gray-50/50 text-gray-400"
                                : isRecentlyAdded
                                  ? "border border-emerald-600 bg-[linear-gradient(135deg,#10B981,#059669)] text-white shadow-[0_16px_30px_-18px_rgba(16,185,129,0.9)] hover:-translate-y-1 hover:shadow-[0_22px_38px_-18px_rgba(16,185,129,0.95)]"
                                : "border border-blue-600 bg-[linear-gradient(135deg,#2563EB,#1D4ED8)] text-white shadow-[0_16px_30px_-18px_rgba(37,99,235,0.9)] before:absolute before:inset-y-0 before:-left-1/3 before:z-[-1] before:w-1/3 before:-skew-x-12 before:bg-white/25 before:opacity-0 before:transition-all before:duration-700 hover:-translate-y-1 hover:border-blue-700 hover:shadow-[0_24px_42px_-18px_rgba(37,99,235,0.95)] hover:before:left-full hover:before:opacity-100"
                        }`}
                        onClick={() =>
                            hasSelectableVariants(item)
                                ? props.onOpenVariantPicker(item)
                                : props.onAddDirect(item)
                        }
                        disabled={availableQuantity === 0}
                    >
                        {availableQuantity > 0 && (
                            <span className="pointer-events-none absolute inset-x-3 bottom-0 h-px bg-white/45 opacity-60 transition-opacity duration-300 group-hover/button:opacity-100" />
                        )}
                        {isRecentlyAdded ? (
                            <Check className="relative z-10 mr-1 h-4 w-4 transition-transform duration-300 group-hover/button:scale-125 group-active/button:scale-95" aria-hidden="true" />
                        ) : (
                            <Plus className="relative z-10 mr-1 h-4 w-4 transition-transform duration-300 group-hover/button:rotate-90 group-hover/button:scale-125 group-active/button:rotate-180 group-active/button:scale-95" aria-hidden="true" />
                        )}
                        <span className="relative z-10 transition-transform duration-300 group-hover/button:translate-x-0.5 group-active/button:translate-x-0">
                            {availableQuantity === 0
                                ? "สินค้าหมด"
                                : isRecentlyAdded
                                  ? "เพิ่มแล้ว"
                                : hasSelectableVariants(item)
                                  ? "เลือกแล้วเพิ่ม"
                                  : "เพิ่มรายการ"}
                        </span>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
