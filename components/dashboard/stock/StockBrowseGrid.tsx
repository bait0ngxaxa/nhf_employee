"use client";

import Image from "next/image";
import { Check, Package, Plus, ShoppingCart } from "lucide-react";
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

export function StockBrowseGrid({
    items,
    cartQuantityByItemId,
    onAddDirect,
    onOpenVariantPicker,
    recentlyAddedItemId,
}: StockBrowseGridProps) {
    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
                <BrowseCard
                    key={item.id}
                    item={item}
                    cartQuantityByItemId={cartQuantityByItemId}
                    onAddDirect={onAddDirect}
                    onOpenVariantPicker={onOpenVariantPicker}
                    recentlyAddedItemId={recentlyAddedItemId}
                />
            ))}
        </div>
    );
}

function BrowseCard(props: {
    item: StockItem;
    cartQuantityByItemId: Map<number, number>;
    onAddDirect: (item: StockItem) => void;
    onOpenVariantPicker: (item: StockItem) => void;
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
                        <Image
                            src={imageUrl}
                            alt={item.name}
                            width={400}
                            height={240}
                            unoptimized
                            className="h-32 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                    ) : (
                        <div className="flex h-32 items-center justify-center text-slate-400">
                            <Package className="h-10 w-10" />
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
                            <ShoppingCart className="h-4 w-4" />
                            อยู่ในรายการเบิกแล้ว {totalInCart} {item.unit}
                        </div>
                    )}
                    <Button
                        variant="default"
                        className={`group/button w-full rounded-xl shadow-sm transition-all duration-300 ${
                            availableQuantity === 0
                                ? "border-gray-200 bg-gray-50/50 text-gray-400"
                                : isRecentlyAdded
                                  ? "border border-emerald-600 bg-[linear-gradient(135deg,#10B981,#059669)] text-white shadow-[0_16px_30px_-18px_rgba(16,185,129,0.9)]"
                                : "border border-blue-600 bg-[linear-gradient(135deg,#2563EB,#1D4ED8)] text-white shadow-[0_16px_30px_-18px_rgba(37,99,235,0.9)] hover:-translate-y-0.5 hover:border-blue-700 hover:shadow-[0_20px_34px_-18px_rgba(37,99,235,0.95)]"
                        }`}
                        onClick={() =>
                            hasSelectableVariants(item)
                                ? props.onOpenVariantPicker(item)
                                : props.onAddDirect(item)
                        }
                        disabled={availableQuantity === 0}
                    >
                        {isRecentlyAdded ? (
                            <Check className="mr-1 h-4 w-4 transition-transform duration-300 group-hover/button:scale-110" />
                        ) : (
                            <Plus className="mr-1 h-4 w-4 transition-transform duration-300 group-hover/button:translate-x-0.5 group-hover/button:scale-110" />
                        )}
                        {availableQuantity === 0
                            ? "สินค้าหมด"
                            : isRecentlyAdded
                              ? "เพิ่มแล้ว"
                            : hasSelectableVariants(item)
                              ? "เลือกแล้วเพิ่ม"
                              : "เพิ่มรายการ"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
