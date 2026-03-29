"use client";

import Image from "next/image";
import { Package, Plus, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { StockItem } from "../context/stock/types";
import type { BrowseCartItem } from "./stockVariant.shared";
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
    cart: Map<number, BrowseCartItem>;
    onAddDirect: (item: StockItem) => void;
    onOpenVariantPicker: (item: StockItem) => void;
};

export function StockBrowseGrid({
    items,
    cart,
    onAddDirect,
    onOpenVariantPicker,
}: StockBrowseGridProps) {
    return (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
                <BrowseCard
                    key={item.id}
                    item={item}
                    cart={cart}
                    onAddDirect={onAddDirect}
                    onOpenVariantPicker={onOpenVariantPicker}
                />
            ))}
        </div>
    );
}

function BrowseCard(props: {
    item: StockItem;
    cart: Map<number, BrowseCartItem>;
    onAddDirect: (item: StockItem) => void;
    onOpenVariantPicker: (item: StockItem) => void;
}) {
    const { item } = props;
    const defaultVariant = getPreferredVariant(item);
    const imageUrl = getBrowseCardImageUrl(item);
    const availableQuantity = getItemAvailableQuantity(item);
    const isLowStock = availableQuantity <= item.minStock;
    const variantCount = getSelectableVariantCount(item);
    const totalInCart = Array.from(props.cart.values()).reduce(
        (sum, cartItem) => (cartItem.item.id === item.id ? sum + cartItem.qty : sum),
        0,
    );
    const variantSummary = getVariantAttributeSummary(defaultVariant?.attributeValues);

    return (
        <Card className="group relative overflow-hidden rounded-[1.25rem] border border-gray-100/80 bg-white transition-all duration-500 hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5">
            <div className="absolute inset-x-0 -top-px h-px w-full bg-gradient-to-r from-transparent via-blue-300/30 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
            <CardContent className="space-y-4 p-5">
                <div className="overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200">
                    {imageUrl ? (
                        <Image
                            src={imageUrl}
                            alt={item.name}
                            width={400}
                            height={240}
                            unoptimized
                            className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                        />
                    ) : (
                        <div className="flex h-40 items-center justify-center text-slate-400">
                            <Package className="h-10 w-10" />
                        </div>
                    )}
                </div>

                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-1">
                        <h3 className="truncate font-bold text-gray-800 transition-colors group-hover:text-blue-700">
                            {item.name}
                        </h3>
                        <p className="inline-block rounded-md bg-gray-50 px-1.5 py-0.5 font-mono text-xs font-medium text-gray-400">
                            {item.sku}
                        </p>
                    </div>
                    <Badge
                        variant="secondary"
                        className="shrink-0 border-none bg-indigo-50/80 px-2.5 text-indigo-700 shadow-sm hover:bg-indigo-100"
                    >
                        {item.category.name}
                    </Badge>
                </div>

                {item.description && (
                    <p className="line-clamp-2 min-h-10 text-sm text-slate-500">
                        {item.description}
                    </p>
                )}

                <div className="space-y-2 rounded-xl bg-slate-50/70 p-3">
                    {hasSelectableVariants(item) ? (
                        <div className="text-sm font-medium text-slate-700">
                            มี {variantCount} ตัวเลือก
                        </div>
                    ) : variantSummary ? (
                        <div className="text-sm font-medium text-slate-700">
                            {variantSummary}
                        </div>
                    ) : (
                        <div className="text-sm font-medium text-slate-500">
                            ใช้ตัวเลือกเริ่มต้น
                        </div>
                    )}
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                            คงเหลือ
                        </span>
                        <span
                            className={`rounded-lg px-2.5 py-1 text-sm font-bold ${
                                isLowStock
                                    ? "bg-rose-50 text-rose-700"
                                    : "bg-white text-slate-700"
                            }`}
                        >
                            {availableQuantity} {item.unit}
                        </span>
                    </div>
                    {item.reservedQuantity > 0 && (
                        <div className="text-xs text-amber-600">
                            รอจ่าย {item.reservedQuantity} {item.unit}
                        </div>
                    )}
                </div>

                <div className="space-y-2">
                    {totalInCart > 0 && (
                        <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                            <ShoppingCart className="h-4 w-4" />
                            อยู่ในรายการเบิกแล้ว {totalInCart} {item.unit}
                        </div>
                    )}
                    <Button
                        variant="default"
                        className={`w-full rounded-xl shadow-sm transition-all ${
                            availableQuantity === 0
                                ? "border-gray-200 bg-gray-50/50 text-gray-400"
                                : "border border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700"
                        }`}
                        onClick={() =>
                            hasSelectableVariants(item)
                                ? props.onOpenVariantPicker(item)
                                : props.onAddDirect(item)
                        }
                        disabled={availableQuantity === 0}
                    >
                        <Plus className="mr-1 h-4 w-4" />
                        {availableQuantity === 0
                            ? "สินค้าหมด"
                            : hasSelectableVariants(item)
                              ? "เลือกตัวเลือกแล้วเพิ่ม"
                              : "เพิ่มในรายการเบิก"}
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
