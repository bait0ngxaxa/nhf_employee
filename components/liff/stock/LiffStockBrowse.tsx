"use client";

import { PackageSearch, ShoppingCart } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/state";
import type {
    LiffStockCatalogItem,
    LiffStockCatalogResponse,
    LiffStockCategory,
} from "@/lib/types/stock-liff";

import { LiffStockFilters } from "./LiffStockFilters";
import { LiffStockItemCard } from "./LiffStockItemCard";
import { LiffStockPagination } from "./LiffStockPagination";

interface LiffStockBrowseProps {
    catalog: LiffStockCatalogResponse;
    categories: LiffStockCategory[];
    search: string;
    categoryId: number | undefined;
    loading: boolean;
    error: string | null;
    cartCount: number;
    cartQuantityByItemId: Map<number, number>;
    recentlyAddedItemId: number | null;
    onSearchChange: (value: string) => void;
    onCategoryChange: (value: number | undefined) => void;
    onPageChange: (page: number) => void;
    onRetry: () => void;
    onAddDirect: (item: LiffStockCatalogItem) => void;
    onChooseVariant: (item: LiffStockCatalogItem) => void;
    onOpenCart: () => void;
}

export function LiffStockBrowse({
    catalog,
    categories,
    search,
    categoryId,
    loading,
    error,
    cartCount,
    cartQuantityByItemId,
    recentlyAddedItemId,
    onSearchChange,
    onCategoryChange,
    onPageChange,
    onRetry,
    onAddDirect,
    onChooseVariant,
    onOpenCart,
}: LiffStockBrowseProps): ReactElement {
    return (
        <section aria-labelledby="liff-stock-browse-heading" className="space-y-4">
            <div>
                <h1
                    id="liff-stock-browse-heading"
                    className="text-xl font-bold tracking-tight text-content-heading"
                >
                    เลือกวัสดุที่ต้องการเบิก
                </h1>
                <p className="mt-1 text-sm leading-6 text-content-secondary">
                    จำนวนที่แสดงเป็นยอดพร้อมเบิกล่าสุด ระบบจะตรวจอีกครั้งเมื่อส่งคำขอ
                </p>
            </div>

            <LiffStockFilters
                search={search}
                categoryId={categoryId}
                categories={categories}
                onSearchChange={onSearchChange}
                onCategoryChange={onCategoryChange}
            />

            {error ? (
                <ErrorState
                    title="โหลดรายการวัสดุไม่สำเร็จ"
                    description={error}
                    action={{ label: "ลองใหม่", onClick: onRetry }}
                    className="min-h-64 border-border-subtle bg-surface-raised px-4 py-8"
                />
            ) : loading && catalog.items.length === 0 ? (
                <LoadingState
                    label="กำลังโหลดรายการวัสดุ..."
                    className="min-h-64 border-0 bg-transparent"
                />
            ) : catalog.items.length === 0 ? (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-surface-raised px-5 text-center shadow-sm ring-1 ring-border-subtle">
                    <PackageSearch className="size-9 text-content-muted" aria-hidden="true" />
                    <h2 className="mt-3 text-base font-bold text-content-heading">
                        ไม่พบวัสดุที่ค้นหา
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-content-secondary">
                        ลองเปลี่ยนคำค้นหาหรือเลือกหมวดหมู่อื่น
                    </p>
                </div>
            ) : (
                <>
                    <div
                        className={`grid grid-cols-1 gap-3 min-[380px]:grid-cols-2 ${
                            loading ? "opacity-70" : ""
                        }`}
                        aria-busy={loading}
                    >
                        {catalog.items.map((item, index) => (
                            <LiffStockItemCard
                                key={item.id}
                                item={item}
                                totalInCart={cartQuantityByItemId.get(item.id) ?? 0}
                                recentlyAdded={recentlyAddedItemId === item.id}
                                priorityImage={index < 2}
                                onAddDirect={onAddDirect}
                                onChooseVariant={onChooseVariant}
                            />
                        ))}
                    </div>
                    <LiffStockPagination
                        page={catalog.page}
                        totalPages={catalog.totalPages}
                        onPageChange={onPageChange}
                    />
                </>
            )}

            {cartCount > 0 ? (
                <div className="sticky bottom-[calc(5.25rem+env(safe-area-inset-bottom))] z-20 pt-1">
                    <Button
                        type="button"
                        onClick={onOpenCart}
                        className="min-h-14 w-full rounded-2xl bg-module-stock-solid px-4 text-base font-bold text-content-on-brand shadow-lg hover:bg-module-stock-solid-hover"
                    >
                        <ShoppingCart className="size-5" aria-hidden="true" />
                        เปิดตะกร้า · {cartCount} ชิ้น
                    </Button>
                </div>
            ) : null}
        </section>
    );
}
