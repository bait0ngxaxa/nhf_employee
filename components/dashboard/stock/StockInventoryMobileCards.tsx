"use client";

import Image from "next/image";
import { AlertTriangle, Image as ImageIcon, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StockItem } from "../context/stock/types";
import { getItemInventoryMetrics } from "./stockInventoryVariantDisplay";

type StockInventoryMobileCardsProps = {
    items: StockItem[];
    onAdjust: (item: StockItem) => void;
    onDelete: (item: StockItem) => void;
    deleteDisabled: boolean;
};

export function StockInventoryMobileCards({
    items,
    onAdjust,
    onDelete,
    deleteDisabled,
}: StockInventoryMobileCardsProps) {
    return (
        <div className="space-y-3 xl:hidden">
            {items.map((item) => (
                <InventoryMobileCard
                    key={item.id}
                    item={item}
                    onAdjust={onAdjust}
                    onDelete={onDelete}
                    deleteDisabled={deleteDisabled}
                />
            ))}
        </div>
    );
}

function InventoryMobileCard({
    item,
    onAdjust,
    onDelete,
    deleteDisabled,
}: {
    item: StockItem;
    onAdjust: (item: StockItem) => void;
    onDelete: (item: StockItem) => void;
    deleteDisabled: boolean;
}) {
    const inventory = getItemInventoryMetrics(item);
    const variantCount = item.variants?.length ?? 0;

    return (
        <article className="rounded-2xl border border-border-subtle bg-surface-raised p-4 shadow-sm">
            <div className="flex gap-3">
                <InventoryCardImage item={item} />
                <div className="min-w-0 flex-1 space-y-2">
                    <div className="space-y-1">
                        <div className="font-semibold leading-snug text-content-strong [overflow-wrap:anywhere]">
                            {item.name}
                        </div>
                        <div className="font-mono text-xs font-medium text-content-muted [overflow-wrap:anywhere]">
                            {item.sku}
                        </div>
                    </div>
                    <Badge
                        variant="secondary"
                        className="max-w-full justify-start whitespace-normal border-none bg-brand-surface/80 text-left font-medium leading-snug text-brand-foreground [overflow-wrap:anywhere]"
                    >
                        {item.category.name}
                    </Badge>
                </div>
            </div>

            {item.description ? (
                <p className="mt-3 line-clamp-2 text-sm text-content-muted">
                    {item.description}
                </p>
            ) : null}

            <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <Metric label="คงเหลือ" value={`${inventory.quantity} ${inventory.unit}`} danger={inventory.isLowStock} />
                <Metric label="จุดสั่งซื้อ" value={`${inventory.minStock} ${inventory.unit}`} />
                {variantCount > 1 ? (
                    <Metric label="รายการย่อย" value={`${variantCount} รายการ`} />
                ) : null}
            </div>

            <div className="mt-4 flex justify-end gap-2">
                <Button
                    variant="outline"
                    className="h-11 px-3 text-brand-foreground"
                    onClick={() => onAdjust(item)}
                >
                    <Pencil className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    แก้ไข
                </Button>
                <Button
                    variant="outline"
                    className="h-11 px-3 text-status-danger-foreground hover:bg-status-danger-surface hover:text-status-danger-foreground"
                    onClick={() => onDelete(item)}
                    disabled={deleteDisabled}
                >
                    <Trash2 className="mr-1.5 h-4 w-4" aria-hidden="true" />
                    ลบ
                </Button>
            </div>
        </article>
    );
}

function Metric({
    label,
    value,
    danger = false,
}: {
    label: string;
    value: string;
    danger?: boolean;
}) {
    return (
        <div className="rounded-xl border border-border-subtle bg-surface-subtle px-3 py-2">
            <div className="text-xs text-content-muted">{label}</div>
            <div className={`mt-1 flex items-center gap-1 font-semibold ${danger ? "text-status-danger-foreground" : "text-content-strong"}`}>
                {value}
                {danger ? <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" /> : null}
            </div>
        </div>
    );
}

function InventoryCardImage({ item }: { item: StockItem }) {
    if (!item.imageUrl) {
        return (
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-content-subtle ring-1 ring-border-subtle">
                <ImageIcon className="h-5 w-5" aria-hidden="true" />
            </div>
        );
    }

    return (
        <Image
            src={item.imageUrl}
            alt={item.name}
            width={64}
            height={64}
            sizes="64px"
            loading="lazy"
            unoptimized
            className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-border-subtle"
        />
    );
}
