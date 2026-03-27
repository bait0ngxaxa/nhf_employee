"use client";

import { useState } from "react";
import { Package, Search, Minus, Plus, ShoppingCart } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { useStockDataContext, useStockUIContext } from "../context/stock";
import type { StockItem } from "../context/stock/types";
import { toast } from "sonner";
import { API_ROUTES } from "@/lib/ssot/routes";

interface CartItem {
    item: StockItem;
    qty: number;
}

export function StockBrowse() {
    const { items, categories, isLoading, refreshRequests } =
        useStockDataContext();
    const {
        searchQuery,
        setSearchQuery,
        selectedCategoryId,
        setSelectedCategoryId,
    } = useStockUIContext();
    const [cart, setCart] = useState<Map<number, CartItem>>(new Map());
    const [submitting, setSubmitting] = useState(false);

    function addToCart(item: StockItem) {
        setCart((prev) => {
            const next = new Map(prev);
            const existing = next.get(item.id);
            if (existing) {
                next.set(item.id, { ...existing, qty: existing.qty + 1 });
            } else {
                next.set(item.id, { item, qty: 1 });
            }
            return next;
        });
    }

    function updateCartQty(itemId: number, delta: number) {
        setCart((prev) => {
            const next = new Map(prev);
            const existing = next.get(itemId);
            if (!existing) return next;
            const newQty = existing.qty + delta;
            if (newQty <= 0) {
                next.delete(itemId);
            } else {
                next.set(itemId, { ...existing, qty: newQty });
            }
            return next;
        });
    }

    async function handleSubmit() {
        if (cart.size === 0) return;
        setSubmitting(true);
        try {
            const res = await fetch(API_ROUTES.stock.requests, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    items: Array.from(cart.values()).map((c) => ({
                        itemId: c.item.id,
                        quantity: c.qty,
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
            toast.error(
                error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
            );
        } finally {
            setSubmitting(false);
        }
    }

    const cartCount = Array.from(cart.values()).reduce(
        (sum, c) => sum + c.qty,
        0,
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                        placeholder="ค้นหาวัสดุ..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                    />
                </div>
                <div className="w-full sm:w-64">
                    <Select
                        value={
                            selectedCategoryId !== undefined
                                ? String(selectedCategoryId)
                                : "all"
                        }
                        onValueChange={(value) => {
                            setSelectedCategoryId(
                                value === "all" ? undefined : Number(value),
                            );
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="เลือกหมวดหมู่" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">ทั้งหมด</SelectItem>
                            {categories.map((cat) => (
                                <SelectItem key={cat.id} value={String(cat.id)}>
                                    {cat.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {isLoading ? (
                <div className="text-center py-20 text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4" />
                    <p className="animate-pulse">กำลังโหลดข้อมูลวัสดุ...</p>
                </div>
            ) : items.length === 0 ? (
                <div className="text-center py-20 bg-white/50 rounded-3xl border border-dashed border-gray-200">
                    <div className="bg-gray-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <Package className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 font-medium">ไม่พบวัสดุที่ค้นหา</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                    {items.map((item) => {
                        const inCart = cart.get(item.id);
                        const isLowStock = item.quantity <= item.minStock;
                        return (
                            <Card
                                key={item.id}
                                className="group relative overflow-hidden rounded-[1.25rem] border border-gray-100/80 bg-white hover:border-blue-100 hover:shadow-xl hover:shadow-blue-500/5 transition-all duration-500"
                            >
                                <div className="absolute inset-x-0 -top-px h-px w-full bg-gradient-to-r from-transparent via-blue-300/30 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                <CardContent className="p-5 space-y-4">
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1 space-y-1">
                                            <h3 className="font-bold text-gray-800 truncate group-hover:text-blue-700 transition-colors">
                                                {item.name}
                                            </h3>
                                            <p className="text-xs font-medium text-gray-400 font-mono bg-gray-50 inline-block px-1.5 py-0.5 rounded-md">
                                                {item.sku}
                                            </p>
                                        </div>
                                        <Badge
                                            variant="secondary"
                                            className="shrink-0 bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 border-none rounded-lg px-2.5 shadow-sm"
                                        >
                                            {item.category.name}
                                        </Badge>
                                    </div>

                                    <div className="flex items-center justify-between pt-2 border-t border-gray-50/50">
                                        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                                            คงเหลือ
                                        </span>
                                        <span
                                            className={`text-sm font-bold px-2.5 py-1 rounded-lg ${
                                                isLowStock
                                                    ? "bg-rose-50 text-rose-700"
                                                    : "bg-slate-50 text-slate-700"
                                            }`}
                                        >
                                            {item.quantity} {item.unit}
                                            {isLowStock && (
                                                <span className="ml-1.5 text-rose-500 animate-pulse">
                                                    ⚠
                                                </span>
                                            )}
                                        </span>
                                    </div>

                                    <div className="pt-1">
                                    {inCart ? (
                                        <div className="flex items-center justify-between bg-blue-50/80 rounded-xl px-2 py-1.5 ring-1 ring-blue-100/50 inset-ring inset-ring-white shadow-inner">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-white shadow-sm transition-all"
                                                onClick={() => updateCartQty(item.id, -1)}
                                            >
                                                <Minus className="h-4 w-4" />
                                            </Button>
                                            <span className="font-bold text-blue-700 w-12 text-center">
                                                {inCart.qty}
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 rounded-lg text-blue-600 hover:text-blue-700 hover:bg-white shadow-sm transition-all"
                                                onClick={() => updateCartQty(item.id, 1)}
                                                disabled={inCart.qty >= item.quantity}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button
                                            variant="outline"
                                            className={`w-full rounded-xl transition-all shadow-sm ${
                                                item.quantity === 0
                                                    ? "bg-gray-50/50 text-gray-400 border-gray-200"
                                                    : "bg-white text-gray-700 hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50/50 group-hover:border-blue-200"
                                            }`}
                                            onClick={() => addToCart(item)}
                                            disabled={item.quantity === 0}
                                        >
                                            {item.quantity === 0 ? "สินค้าหมด" : "เพิ่มในรายการเบิก"}
                                        </Button>
                                    )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}

            {cartCount > 0 && (
                <div className="sticky bottom-6 z-10 px-4 sm:px-0">
                    <div className="max-w-3xl mx-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl shadow-xl shadow-blue-600/20 p-4 flex items-center justify-between ring-1 ring-white/20 backdrop-blur-md">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/20 p-2.5 rounded-xl hidden sm:block">
                                <ShoppingCart className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex flex-col">
                                <span className="font-medium text-blue-100 text-sm">รายการในตะกร้า</span>
                                <span className="font-bold text-lg">
                                    {cart.size} <span className="text-blue-100 font-medium text-sm">รายการ</span> • {cartCount} <span className="text-blue-100 font-medium text-sm">ชิ้น</span>
                                </span>
                            </div>
                        </div>
                        <Button
                            variant="secondary"
                            className="rounded-xl px-6 font-bold bg-white text-blue-700 hover:bg-blue-50 hover:scale-105 active:scale-95 shadow-sm transition-all duration-200"
                            onClick={handleSubmit}
                            disabled={submitting}
                        >
                            {submitting ? (
                                <span className="flex items-center gap-2">
                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-700 border-r-transparent" />
                                    กำลังดำเนินการ...
                                </span>
                            ) : (
                                "ยืนยันการเบิก"
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
