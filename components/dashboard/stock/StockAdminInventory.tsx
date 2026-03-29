"use client";

import { useState } from "react";
import { PackagePlus, Plus } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useStockDataContext, useStockUIContext } from "../context/stock";
import type { StockItem } from "../context/stock/types";
import { AddItemDialog } from "./StockInventoryAddItemDialog";
import { AddCategoryDialog } from "./StockInventoryDialogs";
import { EditItemDialog } from "./StockInventoryEditDialog";
import { StockBrowseFilters } from "./StockBrowseFilters";
import { StockInventoryTable } from "./StockInventoryTable";
import { STOCK_ADMIN_TEXT } from "./stockAdminInventory.shared";

const ITEMS_PER_PAGE = 20;

export function StockAdminInventory() {
    const {
        items,
        categories,
        isLoading,
        refreshItems,
        refreshCategories,
        totalItems,
    } = useStockDataContext();
    const {
        itemsPage,
        setItemsPage,
        searchQuery,
        setSearchQuery,
        selectedCategoryId,
        setSelectedCategoryId,
    } = useStockUIContext();
    const [showAddItem, setShowAddItem] = useState(false);
    const [editingItem, setEditingItem] = useState<StockItem | null>(null);
    const [showAddCategory, setShowAddCategory] = useState(false);
    const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
                <Button
                    className="bg-blue-600 px-5 font-semibold text-white shadow-sm transition-all hover:bg-blue-700"
                    onClick={() => setShowAddItem(true)}
                >
                    <Plus className="mr-1.5 h-4 w-4" /> {STOCK_ADMIN_TEXT.addItem}
                </Button>
                <Button
                    variant="outline"
                    className="border-slate-200 px-5 font-medium text-slate-600 transition-all hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                    onClick={() => setShowAddCategory(true)}
                >
                    <PackagePlus className="mr-1.5 h-4 w-4" />
                    {STOCK_ADMIN_TEXT.addCategory}
                </Button>
            </div>

            <StockBrowseFilters
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                selectedCategoryId={selectedCategoryId}
                onCategoryChange={setSelectedCategoryId}
                categories={categories}
            />

            {isLoading ? (
                <div className="py-12 text-center text-gray-500">
                    {STOCK_ADMIN_TEXT.loading}
                </div>
            ) : items.length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                    ไม่พบรายการวัสดุตามเงื่อนไขที่เลือก
                </div>
            ) : (
                <>
                    <StockInventoryTable
                        items={items}
                        onAdjust={setEditingItem}
                        onDeleted={(message) => {
                            toast.success(message);
                            refreshItems();
                        }}
                        onDeleteError={(message) => {
                            toast.error(message);
                        }}
                    />

                    <Pagination
                        currentPage={itemsPage}
                        totalPages={totalPages}
                        itemsPerPage={ITEMS_PER_PAGE}
                        onPageChange={setItemsPage}
                        onPreviousPage={() => setItemsPage(Math.max(1, itemsPage - 1))}
                        onNextPage={() =>
                            setItemsPage(Math.min(totalPages, itemsPage + 1))
                        }
                    />
                </>
            )}

            <AddItemDialog
                open={showAddItem}
                onClose={() => setShowAddItem(false)}
                categories={categories}
                onSuccess={() => {
                    refreshItems();
                    setShowAddItem(false);
                }}
            />

            {editingItem && (
                <EditItemDialog
                    item={editingItem}
                    onClose={() => setEditingItem(null)}
                    onSuccess={() => {
                        refreshItems();
                        setEditingItem(null);
                    }}
                />
            )}

            <AddCategoryDialog
                open={showAddCategory}
                onClose={() => setShowAddCategory(false)}
                onSuccess={() => {
                    refreshCategories();
                    setShowAddCategory(false);
                }}
            />
        </div>
    );
}
