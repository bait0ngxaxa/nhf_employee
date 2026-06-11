"use client";

import Image from "next/image";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Package, Plus, ShoppingCart, ZoomIn } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import type { StockItem } from "../context/stock/types";
import {
    getBrowseCardImageUrl,
    getItemAvailableQuantity,
    getPreferredVariant,
    getSelectableVariantCount,
    getVariantAttributeSummary,
    hasSelectableVariants,
} from "./stockVariant.shared";
import { StockImagePreviewSurface } from "./StockImagePreviewSurface";

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

type BrowseCardProps = {
    item: StockItem;
    totalInCart: number;
    isRecentlyAdded: boolean;
    isPriorityImage: boolean;
    onAddDirect: (item: StockItem) => void;
    onOpenVariantPicker: (item: StockItem) => void;
    onPreviewImage: (imageUrl: string, itemName: string) => void;
};

export function StockBrowseGrid({
    items,
    cartQuantityByItemId,
    onAddDirect,
    onOpenVariantPicker,
    recentlyAddedItemId,
}: StockBrowseGridProps) {
    const [imagePreview, setImagePreview] = useState<ImagePreviewState>(null);
    const handlePreviewImage = useCallback(
        (imageUrl: string, itemName: string): void => {
            setImagePreview({ imageUrl, itemName });
        },
        [],
    );
    const handleClosePreview = useCallback((): void => {
        setImagePreview(null);
    }, []);

    return (
        <>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {items.map((item, index) => {
                    const totalInCart = cartQuantityByItemId.get(item.id) ?? 0;

                    return (
                        <BrowseCard
                            key={item.id}
                            item={item}
                            totalInCart={totalInCart}
                            isRecentlyAdded={recentlyAddedItemId === item.id}
                            isPriorityImage={index === 0}
                            onAddDirect={onAddDirect}
                            onOpenVariantPicker={onOpenVariantPicker}
                            onPreviewImage={handlePreviewImage}
                        />
                    );
                })}
            </div>

            {imagePreview && (
                <ImagePreviewOverlay
                    imageUrl={imagePreview.imageUrl}
                    itemName={imagePreview.itemName}
                    onClose={handleClosePreview}
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
    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent): void {
            if (event.key === "Escape") {
                onClose();
            }
        }

        document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [onClose]);

    return createPortal(
        <StockImagePreviewSurface
            imageUrl={imageUrl}
            itemName={itemName}
            onClose={onClose}
            ariaLabel={`พรีวิวรูป ${itemName}`}
        />,
        document.body,
    );
}

function BrowseCardBase(props: BrowseCardProps) {
    const { item } = props;
    const defaultVariant = getPreferredVariant(item);
    const imageUrl = getBrowseCardImageUrl(item);
    const availableQuantity = getItemAvailableQuantity(item);
    const variantCount = getSelectableVariantCount(item);
    const { isRecentlyAdded, totalInCart } = props;
    const variantSummary = getVariantAttributeSummary(defaultVariant?.attributeValues);

    return (
        <Card className={`group relative h-full overflow-hidden rounded-2xl border bg-white transition-colors duration-200 ${
            isRecentlyAdded
                ? "border-emerald-300 ring-2 ring-emerald-300/70"
                : availableQuantity === 0
                    ? "border-slate-200/80"
                    : "border-blue-100/80 hover:border-blue-300"
        }`}>
            <CardContent className="flex h-full flex-col gap-2.5 p-3">
                <div className="overflow-hidden rounded-2xl bg-blue-50/50 ring-1 ring-blue-100 shadow-inner shadow-white/70">
                    <div className="flex h-9 items-center border-b border-indigo-100/80 bg-indigo-50/80 px-2 py-1 backdrop-blur">
                        <Badge
                            variant="secondary"
                            className="max-w-full justify-start whitespace-normal border border-indigo-200 bg-white/85 px-2 text-left text-xs font-medium leading-5 text-indigo-800 shadow-sm shadow-indigo-100/50 [display:-webkit-box] [overflow-wrap:anywhere] [-webkit-box-orient:vertical] [-webkit-line-clamp:2] hover:bg-white"
                            title={item.category.name}
                        >
                            {item.category.name}
                        </Badge>
                    </div>
                    {imageUrl ? (
                        <button
                            type="button"
                            onClick={() => props.onPreviewImage(imageUrl, item.name)}
                            className="group/preview relative block h-32 w-full overflow-hidden text-left outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                            aria-label={`ดูรูป ${item.name} แบบพรีวิว`}
                        >
                            <Image
                                src={imageUrl}
                                alt={item.name}
                                width={400}
                                height={280}
                                priority={props.isPriorityImage}
                                fetchPriority={props.isPriorityImage ? "high" : "auto"}
                                sizes="(min-width: 1280px) 25vw, (min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                                unoptimized
                                className="h-full w-full object-cover transition-transform duration-200 group-hover/preview:scale-[1.03]"
                            />
                            <span className="absolute inset-0 bg-slate-950/0 transition-colors duration-300 group-hover/preview:bg-slate-950/20" />
                            <span className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-slate-700 opacity-0 shadow-sm transition-opacity duration-200 group-hover/preview:opacity-100 group-hover/preview:text-blue-700 group-focus-visible/preview:opacity-100 group-focus-visible/preview:text-blue-700">
                                <ZoomIn className="h-4 w-4" aria-hidden="true" />
                            </span>
                        </button>
                    ) : (
                        <div className="flex h-32 items-center justify-center text-blue-300">
                            <Package className="h-10 w-10" aria-hidden="true" />
                        </div>
                    )}
                </div>

                <div className="space-y-1.5">
                    <StockItemName name={item.name} />
                    <div className="flex flex-wrap items-start gap-2">
                        <p
                            title={item.sku}
                            className="max-w-full rounded-md bg-blue-50 px-1.5 py-0.5 font-mono text-xs font-medium leading-5 text-blue-700/70 [overflow-wrap:anywhere]"
                        >
                            {item.sku}
                        </p>
                    </div>
                </div>

                <div className="min-h-8">
                    {item.description ? (
                        <p className="line-clamp-2 text-sm leading-6 text-slate-500">
                            {item.description}
                        </p>
                    ) : null}
                </div>

                <div className="flex min-h-[5.75rem] flex-col justify-between rounded-2xl border border-blue-100/80 bg-blue-50/45 p-2.5 shadow-inner shadow-white">
                    <div className="min-h-5 text-sm font-semibold leading-5 text-blue-950">
                        {hasSelectableVariants(item) ? (
                            <>มี {variantCount} ตัวเลือก</>
                        ) : variantSummary ? (
                            variantSummary
                        ) : null}
                    </div>
                    <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold leading-5 text-blue-700/75">
                                คงเหลือ
                            </span>
                            <span
                                className={`rounded-lg px-2.5 py-1 text-sm font-bold tabular-nums leading-5 shadow-sm ${
                                    availableQuantity === 0
                                        ? "bg-slate-100 text-slate-500"
                                        : "bg-white text-blue-800"
                                }`}
                            >
                                {availableQuantity} {item.unit}
                            </span>
                        </div>
                        <div
                            className={`min-h-5 text-xs font-medium leading-5 ${
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
                        <div className="flex min-h-9 items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-sm font-medium leading-5 text-amber-800">
                            <ShoppingCart className="h-4 w-4" aria-hidden="true" />
                            อยู่ในรายการเบิกแล้ว {totalInCart} {item.unit}
                        </div>
                    )}
                    <Button
                        variant="default"
                        className={`group/button relative isolate w-full overflow-hidden rounded-xl shadow-sm ring-offset-2 transition-colors duration-200 focus-visible:ring-2 focus-visible:ring-blue-400 active:translate-y-0.5 active:scale-[0.98] ${
                            availableQuantity === 0
                                ? "border-slate-200 bg-slate-50/50 text-slate-400"
                                : isRecentlyAdded
                                  ? "border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                                : "border border-blue-600 bg-blue-600 text-white hover:border-blue-700 hover:bg-blue-700"
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
                            <Check className="relative z-10 mr-1 h-4 w-4" aria-hidden="true" />
                        ) : (
                            <Plus className="relative z-10 mr-1 h-4 w-4" aria-hidden="true" />
                        )}
                        <span className="relative z-10 text-sm font-semibold leading-5">
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

const BrowseCard = memo(BrowseCardBase, areBrowseCardPropsEqual);

function StockItemName({ name }: { name: string }) {
    const titleRef = useRef<HTMLHeadingElement | null>(null);
    const [isTooltipOpen, setIsTooltipOpen] = useState(false);

    function isNameClamped(): boolean {
        const titleElement = titleRef.current;

        if (!titleElement) {
            return false;
        }

        return (
            titleElement.scrollHeight > titleElement.clientHeight
            || titleElement.scrollWidth > titleElement.clientWidth
        );
    }

    function handleTooltipOpenChange(open: boolean): void {
        if (!open) {
            setIsTooltipOpen(false);
            return;
        }

        setIsTooltipOpen(isNameClamped());
    }

    return (
        <div className="min-w-0 space-y-1">
            <Tooltip open={isTooltipOpen} onOpenChange={handleTooltipOpenChange}>
                <TooltipTrigger asChild>
                    <span className="block min-w-0">
                        <h3
                            ref={titleRef}
                            className="line-clamp-2 min-h-11 text-base font-bold leading-[1.35] text-slate-900 [overflow-wrap:anywhere] transition-colors group-hover:text-blue-800"
                        >
                            {name}
                        </h3>
                    </span>
                </TooltipTrigger>
                <TooltipContent
                    side="top"
                    align="start"
                    hideArrow
                    className="max-w-72 whitespace-normal border border-blue-200 bg-blue-50 text-left leading-6 text-blue-950 shadow-lg shadow-blue-100/70"
                >
                    {name}
                </TooltipContent>
            </Tooltip>
        </div>
    );
}

function areBrowseCardPropsEqual(
    prev: BrowseCardProps,
    next: BrowseCardProps,
): boolean {
    return (
        prev.item === next.item
        && prev.totalInCart === next.totalInCart
        && prev.isRecentlyAdded === next.isRecentlyAdded
        && prev.isPriorityImage === next.isPriorityImage
    );
}
