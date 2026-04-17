"use client";

import { useState } from "react";
import { Package } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { useStockDataContext, useStockUIContext } from "../context/stock";
import { STOCK_BROWSE_LIMIT as ITEMS_PER_PAGE } from "../context/stock/provider.shared";
import { useDashboardDataContext } from "../context/dashboard/DashboardContext";
import type { StockItem } from "../context/stock/types";
import { StockBrowseCartBar } from "./StockBrowseCartBar";
import { StockBrowseFilters } from "./StockBrowseFilters";
import { StockBrowseGrid } from "./StockBrowseGrid";
import { StockVariantPickerDialog } from "./StockVariantPickerDialog";
import { useStockBrowseCart } from "./useStockBrowseCart";

export function StockBrowse() {
    const { user } = useDashboardDataContext();
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
    const [variantPickerItem, setVariantPickerItem] = useState<StockItem | null>(null);
    const {
        cartCount,
        cartItems,
        cartQuantityByItemId,
        cartSize,
        projectCode,
        recentlyAddedItemId,
        submitting,
        addDirectItem,
        addVariantToCart,
        clearCart,
        removeFromCart,
        setProjectCode,
        submitRequest,
        updateCartQuantity,
    } = useStockBrowseCart({
        userId: user?.id,
        onSubmitted: refreshRequests,
    });
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

    return (
        <div className="space-y-6">
            <div className="hidden relative overflow-hidden rounded-[2rem] border border-slate-200/80 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92),rgba(37,99,235,0.88))] px-6 py-6 text-white shadow-[0_28px_80px_-36px_rgba(30,64,175,0.55)]">
                <div className="pointer-events-none absolute inset-0">
                    <div className="absolute -right-16 top-0 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
                    <div className="absolute bottom-0 left-0 h-32 w-56 bg-gradient-to-r from-amber-300/20 to-transparent blur-2xl" />
                </div>
                <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                    <div className="space-y-2">
                        <div className="inline-flex items-center rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-[0.2em] text-sky-100">
                            STOCK REQUISITION
                        </div>
                        <h3 className="text-2xl font-bold tracking-tight text-white">
                            เบิกวัสดุได้จากคลังกลางในมุมมองเดียว
                        </h3>
                        <p className="max-w-2xl text-sm text-slate-200/90">
                            ค้นหา เลือกตัวเลือกสินค้า และรวบรวมรายการเบิกก่อนยืนยันได้ทันที
                        </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:w-auto">
                        <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
                            <div className="text-xs text-slate-200">จำนวนสินค้าทั้งหมด</div>
                            <div className="mt-1 text-2xl font-bold text-white">{totalItems}</div>
                        </div>
                        <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur-sm">
                            <div className="text-xs text-slate-200">ในตะกร้าปัจจุบัน</div>
                            <div className="mt-1 text-2xl font-bold text-amber-200">{cartCount}</div>
                        </div>
                    </div>
                </div>
            </div>
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
                    cartQuantityByItemId={cartQuantityByItemId}
                    onAddDirect={addDirectItem}
                    onOpenVariantPicker={setVariantPickerItem}
                    recentlyAddedItemId={recentlyAddedItemId}
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
                    cartSize={cartSize}
                    cartCount={cartCount}
                    projectCode={projectCode}
                    submitting={submitting}
                    onProjectCodeChange={setProjectCode}
                    onRemove={removeFromCart}
                    onChangeQuantity={updateCartQuantity}
                    onClear={clearCart}
                    onSubmit={() => void submitRequest()}
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
        <div className="rounded-[2rem] border border-slate-200/80 bg-white/80 py-20 text-center text-gray-500 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
            <p className="animate-pulse">กำลังโหลดข้อมูลวัสดุ...</p>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="rounded-[2rem] border border-dashed border-slate-300 bg-white/70 py-20 text-center shadow-[0_18px_40px_-28px_rgba(15,23,42,0.28)] backdrop-blur">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 shadow-inner">
                <Package className="h-8 w-8 text-gray-400" />
            </div>
            <p className="font-medium text-gray-500">ไม่พบวัสดุที่ค้นหา</p>
        </div>
    );
}
