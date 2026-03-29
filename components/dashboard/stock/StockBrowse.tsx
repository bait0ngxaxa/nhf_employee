"use client";

import { useMemo, useState } from "react";
import { Package } from "lucide-react";
import { toast } from "sonner";
import { Pagination } from "@/components/Pagination";
import { API_ROUTES } from "@/lib/ssot/routes";
import { useStockDataContext, useStockUIContext } from "../context/stock";
import type { StockItem, StockItemVariant } from "../context/stock/types";
import { StockBrowseCartBar } from "./StockBrowseCartBar";
import { StockBrowseFilters } from "./StockBrowseFilters";
import { StockBrowseGrid } from "./StockBrowseGrid";
import { StockVariantPickerDialog } from "./StockVariantPickerDialog";
import {
    type BrowseCartItem,
    getPreferredVariant,
    getVariantAvailableQuantity,
} from "./stockVariant.shared";

const ITEMS_PER_PAGE = 20;

export function StockBrowse() {
    const { items, categories, isLoading, refreshRequests, totalItems } =
        useStockDataContext();
    const {
        searchQuery,
        setSearchQuery,
        selectedCategoryId,
        setSelectedCategoryId,
        itemsPage,
        setItemsPage,
    } = useStockUIContext();
    const [cart, setCart] = useState<Map<number, BrowseCartItem>>(new Map());
    const [submitting, setSubmitting] = useState(false);
    const [variantPickerItem, setVariantPickerItem] = useState<StockItem | null>(null);

    function addVariantToCart(
        item: StockItem,
        variant: StockItemVariant,
        quantity: number,
    ): void {
        setCart((prev) => {
            const next = new Map(prev);
            const existing = next.get(variant.id);
            const maxQuantity = getVariantAvailableQuantity(variant);
            const nextQuantity = Math.min(
                maxQuantity,
                (existing?.qty ?? 0) + Math.max(1, quantity),
            );

            next.set(variant.id, {
                item,
                variant,
                qty: nextQuantity,
            });
            return next;
        });
    }

    function handleAddDirect(item: StockItem): void {
        const defaultVariant = getPreferredVariant(item);
        if (!defaultVariant || getVariantAvailableQuantity(defaultVariant) === 0) {
            toast.error("รายการนี้ไม่มีสต็อกพร้อมเบิก");
            return;
        }

        addVariantToCart(item, defaultVariant, 1);
    }

    async function handleSubmit(): Promise<void> {
        if (cart.size === 0) {
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(API_ROUTES.stock.requests, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: Array.from(cart.values()).map((cartItem) => ({
                        itemId: cartItem.item.id,
                        variantId: cartItem.variant.id,
                        quantity: cartItem.qty,
                    })),
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? "เกิดข้อผิดพลาด");
            }

            toast.success("ส่งคำขอเบิกวัสดุเรียบร้อยแล้ว");
            setCart(new Map());
            refreshRequests();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
        } finally {
            setSubmitting(false);
        }
    }

    function handleRemoveFromCart(variantId: number): void {
        setCart((prev) => {
            const next = new Map(prev);
            next.delete(variantId);
            return next;
        });
    }

    function handleUpdateCartQuantity(variantId: number, delta: number): void {
        setCart((prev) => {
            const next = new Map(prev);
            const existing = next.get(variantId);

            if (!existing) {
                return prev;
            }

            const nextQuantity = Math.min(
                getVariantAvailableQuantity(existing.variant),
                Math.max(0, existing.qty + delta),
            );

            if (nextQuantity === 0) {
                next.delete(variantId);
                return next;
            }

            next.set(variantId, {
                ...existing,
                qty: nextQuantity,
            });
            return next;
        });
    }

    function handleClearCart(): void {
        setCart(new Map());
    }

    const cartCount = useMemo(
        () => Array.from(cart.values()).reduce((sum, cartItem) => sum + cartItem.qty, 0),
        [cart],
    );
    const cartItems = useMemo(() => Array.from(cart.values()), [cart]);
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

    return (
        <div className="space-y-6">
            <StockBrowseFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCategoryId={selectedCategoryId}
                onCategoryChange={setSelectedCategoryId}
                categories={categories}
            />

            {isLoading ? (
                <LoadingState />
            ) : items.length === 0 ? (
                <EmptyState />
            ) : (
                <StockBrowseGrid
                    items={items}
                    cart={cart}
                    onAddDirect={handleAddDirect}
                    onOpenVariantPicker={setVariantPickerItem}
                />
            )}

            <Pagination
                currentPage={itemsPage}
                totalPages={totalPages}
                itemsPerPage={ITEMS_PER_PAGE}
                onPageChange={setItemsPage}
                onPreviousPage={() => setItemsPage(Math.max(1, itemsPage - 1))}
                onNextPage={() => setItemsPage(Math.min(totalPages, itemsPage + 1))}
            />

            {cartCount > 0 && (
                <StockBrowseCartBar
                    items={cartItems}
                    cartSize={cart.size}
                    cartCount={cartCount}
                    submitting={submitting}
                    onRemove={handleRemoveFromCart}
                    onChangeQuantity={handleUpdateCartQuantity}
                    onClear={handleClearCart}
                    onSubmit={() => void handleSubmit()}
                />
            )}

            <StockVariantPickerDialog
                item={variantPickerItem}
                open={variantPickerItem !== null}
                onClose={() => setVariantPickerItem(null)}
                onConfirm={(variant, quantity) => {
                    if (!variantPickerItem) {
                        return;
                    }
                    addVariantToCart(variantPickerItem, variant, quantity);
                    setVariantPickerItem(null);
                }}
            />
        </div>
    );
}

function LoadingState() {
    return (
        <div className="py-20 text-center text-gray-500">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
            <p className="animate-pulse">กำลังโหลดข้อมูลวัสดุ...</p>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="rounded-3xl border border-dashed border-gray-200 bg-white/50 py-20 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-50">
                <Package className="h-8 w-8 text-gray-400" />
            </div>
            <p className="font-medium text-gray-500">ไม่พบวัสดุที่ค้นหา</p>
        </div>
    );
}
