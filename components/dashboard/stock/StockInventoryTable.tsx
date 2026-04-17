"use client";

import { useState } from "react";
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
import { apiDelete } from "@/lib/api-client";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
    createDeleteSuccessMessage,
    ensureStockApiSuccess,
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
    const [pendingDeleteItem, setPendingDeleteItem] = useState<StockItem | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    function handleDeleteRequest(item: StockItem): void {
        setPendingDeleteItem(item);
    }

    async function handleConfirmDelete(): Promise<void> {
        if (!pendingDeleteItem) {
            return;
        }

        setIsDeleting(true);
        try {
            ensureStockApiSuccess(
                await apiDelete(API_ROUTES.stock.itemById(pendingDeleteItem.id)),
                STOCK_ADMIN_TEXT.genericError,
            );

            onDeleted(createDeleteSuccessMessage(pendingDeleteItem.name));
            setPendingDeleteItem(null);
        } catch (error: unknown) {
            const message =
                error instanceof Error ? error.message : STOCK_ADMIN_TEXT.genericError;
            onDeleteError(message);
        } finally {
            setIsDeleting(false);
        }
    }

    return (
        <>
            <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
                <Table className="border-separate border-spacing-0">
                    <TableHeader>
                        <TableRow className="border-b-2 border-slate-200 bg-slate-100/80 hover:bg-slate-100/80">
                            <TableHead className="w-20 border-r border-slate-200 font-semibold text-slate-700">
                                {STOCK_ADMIN_TEXT.image}
                            </TableHead>
                            <TableHead className="w-32 border-r border-slate-200 font-semibold text-slate-700">
                                {STOCK_ADMIN_TEXT.sku}
                            </TableHead>
                            <TableHead className="border-r border-slate-200 font-semibold text-slate-700">
                                {STOCK_ADMIN_TEXT.itemName}
                            </TableHead>
                            <TableHead className="w-40 border-r border-slate-200 font-semibold text-slate-700">
                                {STOCK_ADMIN_TEXT.category}
                            </TableHead>
                            <TableHead className="w-32 border-r border-slate-200 text-right font-semibold text-slate-700">
                                {STOCK_ADMIN_TEXT.quantity}
                            </TableHead>
                            <TableHead className="w-32 border-r border-slate-200 text-right font-semibold text-slate-700">
                                {STOCK_ADMIN_TEXT.minStock}
                            </TableHead>
                            <TableHead className="w-24" />
                        </TableRow>
                    </TableHeader>
                    <TableBody className="[&_tr:nth-child(odd)]:bg-white [&_tr:nth-child(even)]:bg-slate-100/70">
                        {items.map((item) => (
                            <InventoryRow
                                key={item.id}
                                item={item}
                                onAdjust={onAdjust}
                                onDelete={handleDeleteRequest}
                                deleteDisabled={isDeleting}
                            />
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog
                open={pendingDeleteItem !== null}
                onOpenChange={(open) => {
                    if (!open && !isDeleting) {
                        setPendingDeleteItem(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-rose-700">
                            ยืนยันการลบรายการวัสดุ
                        </DialogTitle>
                        <DialogDescription>
                            ต้องการลบรายการ {pendingDeleteItem?.name} ออกจากสต็อกหรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:justify-end">
                        <Button
                            variant="outline"
                            onClick={() => setPendingDeleteItem(null)}
                            disabled={isDeleting}
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={() => void handleConfirmDelete()}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "กำลังลบ..." : "ยืนยันการลบ"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

type InventoryRowProps = {
    item: StockItem;
    onAdjust: (item: StockItem) => void;
    onDelete: (item: StockItem) => void;
    deleteDisabled: boolean;
};

function InventoryRow({ item, onAdjust, onDelete, deleteDisabled }: InventoryRowProps) {
    const inventory = getItemInventoryMetrics(item);

    return (
        <TableRow className="border-b-2 border-slate-300 transition-colors hover:bg-blue-100/70">
            <TableCell className="border-r border-slate-300 py-4">
                {item.imageUrl ? <InventoryImage item={item} /> : <ImagePlaceholder />}
            </TableCell>
            <TableCell className="border-r border-slate-300 py-4 font-mono text-xs font-medium text-slate-600">
                {item.sku}
            </TableCell>
            <TableCell className="border-r border-slate-300 py-4">
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
            <TableCell className="border-r border-slate-300 py-4">
                <Badge
                    variant="secondary"
                    className="border-none bg-indigo-50/80 font-medium text-indigo-700 hover:bg-indigo-100"
                >
                    {item.category.name}
                </Badge>
            </TableCell>
            <TableCell className="border-r border-slate-300 py-4 text-right">
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
            <TableCell className="border-r border-slate-300 py-4 text-right text-sm font-medium text-slate-600">
                {inventory.minStock}{" "}
                <span className="text-xs">{inventory.unit}</span>
            </TableCell>
            <TableCell className="py-4">
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
                        onClick={() => onDelete(item)}
                        disabled={deleteDisabled}
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

    if (variants.length <= 1) {
        return null;
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
