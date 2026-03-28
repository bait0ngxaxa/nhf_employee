"use client";

import { useState } from "react";
import { PackagePlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useStockDataContext } from "../context/stock";
import type { StockItem } from "../context/stock/types";
import { AddItemDialog } from "./StockInventoryAddItemDialog";
import { AddCategoryDialog } from "./StockInventoryDialogs";
import { EditItemDialog } from "./StockInventoryEditDialog";
import { StockInventoryTable } from "./StockInventoryTable";
import { STOCK_ADMIN_TEXT } from "./stockAdminInventory.shared";

export function StockAdminInventory() {
    const { items, categories, isLoading, refreshItems, refreshCategories } =
        useStockDataContext();
    const [showAddItem, setShowAddItem] = useState(false);
    const [editingItem, setEditingItem] = useState<StockItem | null>(null);
    const [showAddCategory, setShowAddCategory] = useState(false);

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

            {isLoading ? (
                <div className="py-12 text-center text-gray-500">
                    {STOCK_ADMIN_TEXT.loading}
                </div>
            ) : (
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
