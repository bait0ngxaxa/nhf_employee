"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Package } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { useStockDataContext, useStockUIContext } from "../context/stock";
import { STOCK_BROWSE_LIMIT as ITEMS_PER_PAGE } from "../context/stock/provider.shared";
import { useDashboardDataContext } from "../context/dashboard/DashboardContext";
import type { StockItem } from "../context/stock/types";
import { StockBrowseFilters } from "./StockBrowseFilters";
import { StockBrowseGrid } from "./StockBrowseGrid";
import { StockEmptyState, StockLoadingState } from "./StockLoadingState";
import { useStockBrowseCart } from "./useStockBrowseCart";

const StockBrowseCartBar = dynamic(
    () => import("./StockBrowseCartBar").then((mod) => mod.StockBrowseCartBar),
    { ssr: false },
);
const StockVariantPickerDialog = dynamic(
    () =>
        import("./StockVariantPickerDialog").then(
            (mod) => mod.StockVariantPickerDialog,
        ),
    { ssr: false },
);

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
        addVariantsToCart,
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
            <StockBrowseFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCategoryId={selectedCategoryId}
                onCategoryChange={setSelectedCategoryId}
                categories={categories}
            />

            {isLoading ? (
                <StockLoadingState message="กำลังโหลดข้อมูลวัสดุ..." />
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
                onConfirm={(selections) => {
                    if (!variantPickerItem) {
                        return;
                    }
                    addVariantsToCart(variantPickerItem, selections);
                    setVariantPickerItem(null);
                }}
            />
        </div>
    );
}

function EmptyState() {
    return (
        <StockEmptyState
            icon={<Package className="h-6 w-6" aria-hidden="true" />}
            message="ไม่พบวัสดุที่ค้นหา"
        />
    );
}
