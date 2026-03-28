"use client";

import Image from "next/image";
import {
    AlertTriangle,
    Image as ImageIcon,
    Layers3,
    Pencil,
    Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { StockItem } from "../context/stock/types";
import {
    STOCK_ADMIN_TEXT,
    createDeleteConfirmMessage,
    createDeleteSuccessMessage,
} from "./stockAdminInventory.shared";
import {
    getItemInventoryMetrics,
    getVariantLabel,
} from "./stockInventoryVariantDisplay";

type StockInventoryTableProps = {
    items: StockItem[];
    onAdjust: (item: StockItem) => void;
    onDeleted: (message: string) => void;
    onDeleteError: (message: string) => void;
};

export function StockInventoryTable({
    items,
    onAdjust,
    onDeleted,
    onDeleteError,
}: StockInventoryTableProps) {
    async function handleDelete(item: StockItem): Promise<void> {
        if (!confirm(createDeleteConfirmMessage(item.name))) {
            return;
        }

        try {
            const res = await fetch(API_ROUTES.stock.itemById(item.id), {
                method: "DELETE",
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? STOCK_ADMIN_TEXT.genericError);
            }

            onDeleted(createDeleteSuccessMessage(item.name));
        } catch (error) {
            const message =
                error instanceof Error ? error.message : STOCK_ADMIN_TEXT.genericError;
            onDeleteError(message);
        }
    }

    return (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-100">
            <Table>
                <TableHeader>
                    <TableRow className="border-b-gray-100 bg-slate-50/50 hover:bg-slate-50/50">
                        <TableHead className="w-20 font-semibold text-slate-600">
                            {STOCK_ADMIN_TEXT.image}
                        </TableHead>
                        <TableHead className="w-32 font-semibold text-slate-600">
                            {STOCK_ADMIN_TEXT.sku}
                        </TableHead>
                        <TableHead className="font-semibold text-slate-600">
                            {STOCK_ADMIN_TEXT.itemName}
                        </TableHead>
                        <TableHead className="w-40 font-semibold text-slate-600">
                            {STOCK_ADMIN_TEXT.category}
                        </TableHead>
                        <TableHead className="w-32 text-right font-semibold text-slate-600">
                            {STOCK_ADMIN_TEXT.quantity}
                        </TableHead>
                        <TableHead className="w-32 text-right font-semibold text-slate-600">
                            {STOCK_ADMIN_TEXT.minStock}
                        </TableHead>
                        <TableHead className="w-24 border-b-gray-100" />
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => (
                        <InventoryRow
                            key={item.id}
                            item={item}
                            onAdjust={onAdjust}
                            onDelete={handleDelete}
                        />
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}

type InventoryRowProps = {
    item: StockItem;
    onAdjust: (item: StockItem) => void;
    onDelete: (item: StockItem) => Promise<void>;
};

function InventoryRow({ item, onAdjust, onDelete }: InventoryRowProps) {
    const inventory = getItemInventoryMetrics(item);

    async function handleDeleteClick(): Promise<void> {
        await onDelete(item);
    }

    return (
        <TableRow className="border-b-gray-50/80 transition-colors hover:bg-blue-50/30">
            <TableCell>{item.imageUrl ? <InventoryImage item={item} /> : <ImagePlaceholder />}</TableCell>
            <TableCell className="mx-2 my-1 inline-block rounded-r-md border-r border-slate-50/50 bg-slate-50/50 px-2 py-0.5 font-mono text-xs font-medium text-slate-500">
                {item.sku}
            </TableCell>
            <TableCell>
                <div className="space-y-1">
                    <div className="font-semibold text-slate-800">{item.name}</div>
                    {item.description && (
                        <div className="line-clamp-2 text-xs text-slate-500">
                            {item.description}
                        </div>
                    )}
                    <VariantBreakdown item={item} />
                </div>
            </TableCell>
            <TableCell>
                <Badge
                    variant="secondary"
                    className="border-none bg-indigo-50/80 font-medium text-indigo-700 hover:bg-indigo-100"
                >
                    {item.category.name}
                </Badge>
            </TableCell>
            <TableCell className="text-right">
                <span
                    className={`rounded-lg px-2 py-1 text-sm font-bold ${
                        inventory.isLowStock
                            ? "bg-rose-50 text-rose-700"
                            : "text-slate-700"
                    }`}
                >
                    {inventory.quantity}{" "}
                    <span className="text-xs font-medium opacity-70">
                        {inventory.unit}
                    </span>
                    {inventory.isLowStock && (
                        <AlertTriangle className="ml-1.5 inline h-3.5 w-3.5 animate-pulse text-rose-500" />
                    )}
                </span>
            </TableCell>
            <TableCell className="text-right text-sm font-medium text-slate-500">
                {inventory.minStock}{" "}
                <span className="text-xs">{inventory.unit}</span>
            </TableCell>
            <TableCell>
                <div className="flex justify-end gap-1">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                        onClick={() => onAdjust(item)}
                    >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                        onClick={handleDeleteClick}
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}

function VariantBreakdown({ item }: { item: StockItem }) {
    const variants = item.variants ?? [];

    if (variants.length === 0) {
        return (
            <div className="flex items-center gap-2 text-xs text-slate-500">
                <Layers3 className="h-3.5 w-3.5 text-slate-400" />
                <span>{STOCK_ADMIN_TEXT.noVariant}</span>
            </div>
        );
    }

    return (
        <div className="space-y-1.5">
            {variants.map((variant) => {
                const isLow = variant.quantity <= variant.minStock;

                return (
                    <div
                        key={variant.id}
                        className="flex items-start justify-between gap-3 rounded-lg bg-slate-50/80 px-2.5 py-2 text-xs"
                    >
                        <div className="flex min-w-0 items-start gap-2 text-slate-500">
                            <Layers3 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="line-clamp-2">{getVariantLabel(variant)}</span>
                        </div>
                        <div className="shrink-0 text-right">
                            <div
                                className={`font-semibold ${
                                    isLow ? "text-rose-700" : "text-slate-700"
                                }`}
                            >
                                {variant.quantity} {variant.unit}
                            </div>
                            <div className="text-[11px] text-slate-400">
                                จุดสั่งซื้อ {variant.minStock}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

function InventoryImage({ item }: { item: StockItem }) {
    return (
        <Image
            src={item.imageUrl ?? ""}
            alt={item.name}
            width={48}
            height={48}
            unoptimized
            className="h-12 w-12 rounded-xl object-cover ring-1 ring-slate-200"
        />
    );
}

function ImagePlaceholder() {
    return (
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400 ring-1 ring-slate-200">
            <ImageIcon className="h-5 w-5" />
        </div>
    );
}
