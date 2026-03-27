"use client";

import { useState } from "react";
import { Plus, PackagePlus, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectTrigger,
    SelectValue,
    SelectContent,
    SelectItem,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { API_ROUTES } from "@/lib/ssot/routes";
import { useStockDataContext } from "../context/stock";
import type { StockItem } from "../context/stock/types";

export function StockAdminInventory() {
    const { items, categories, isLoading, refreshItems, refreshCategories } =
        useStockDataContext();
    const [showAddItem, setShowAddItem] = useState(false);
    const [showAdjust, setShowAdjust] = useState<StockItem | null>(null);
    const [showAddCategory, setShowAddCategory] = useState(false);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-3">
                <Button 
                    className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all font-semibold px-5" 
                    onClick={() => setShowAddItem(true)}
                >
                    <Plus className="h-4 w-4 mr-1.5" /> เพิ่มวัสดุ
                </Button>
                <Button
                    variant="outline"
                    className="text-slate-600 hover:text-blue-700 hover:bg-blue-50 border-slate-200 hover:border-blue-200 transition-all font-medium px-5"
                    onClick={() => setShowAddCategory(true)}
                >
                    <PackagePlus className="h-4 w-4 mr-1.5" /> เพิ่มหมวดหมู่
                </Button>
            </div>

            {isLoading ? (
                <div className="text-center py-12 text-gray-500">กำลังโหลด...</div>
            ) : (
                <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 overflow-hidden">
                    <Table>
                        <TableHeader>
                            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50 border-b-gray-100">
                                <TableHead className="font-semibold text-slate-600 w-32">รหัส (SKU)</TableHead>
                                <TableHead className="font-semibold text-slate-600">ชื่อวัสดุ</TableHead>
                                <TableHead className="font-semibold text-slate-600 w-40">หมวดหมู่</TableHead>
                                <TableHead className="text-right font-semibold text-slate-600 w-32">คงเหลือ</TableHead>
                                <TableHead className="text-right font-semibold text-slate-600 w-32">จุดสั่งซื้อ</TableHead>
                                <TableHead className="w-24 border-b-gray-100" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((item) => {
                                const isLow = item.quantity <= item.minStock;
                                return (
                                    <TableRow key={item.id} className="hover:bg-blue-50/30 transition-colors border-b-gray-50/80">
                                        <TableCell className="font-mono text-xs font-medium text-slate-500 bg-slate-50/50 border-r border-slate-50/50 rounded-r-md mx-2 my-1 inline-block px-2 py-0.5">
                                            {item.sku}
                                        </TableCell>
                                        <TableCell className="font-semibold text-slate-800">
                                            {item.name}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary" className="bg-indigo-50/80 text-indigo-700 hover:bg-indigo-100 border-none font-medium">
                                                {item.category.name}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span
                                                className={`text-sm font-bold px-2 py-1 rounded-lg ${
                                                    isLow
                                                        ? "bg-rose-50 text-rose-700"
                                                        : "text-slate-700"
                                                }`}
                                            >
                                                {item.quantity} <span className="text-xs font-medium opacity-70">{item.unit}</span>
                                                {isLow && (
                                                    <AlertTriangle className="inline h-3.5 w-3.5 ml-1.5 text-rose-500 animate-pulse" />
                                                )}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right text-slate-500 font-medium text-sm">
                                            {item.minStock} <span className="text-xs">{item.unit}</span>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex gap-1 justify-end">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                                                    onClick={() => setShowAdjust(item)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                                                    onClick={async () => {
                                                        if (!confirm(`ลบ "${item.name}" ออกจากรายการหรือไม่?`)) return;
                                                        try {
                                                            const res = await fetch(API_ROUTES.stock.itemById(item.id), { method: "DELETE" });
                                                            if (!res.ok) {
                                                                const err = await res.json();
                                                                throw new Error(err.error ?? "เกิดข้อผิดพลาด");
                                                            }
                                                            toast.success(`ลบ ${item.name} เรียบร้อยแล้ว`);
                                                            refreshItems();
                                                        } catch (error) {
                                                            toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
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

            {showAdjust && (
                <AdjustDialog
                    item={showAdjust}
                    onClose={() => setShowAdjust(null)}
                    onSuccess={() => {
                        refreshItems();
                        setShowAdjust(null);
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

function AddItemDialog({
    open,
    onClose,
    categories,
    onSuccess,
}: {
    open: boolean;
    onClose: () => void;
    categories: { id: number; name: string }[];
    onSuccess: () => void;
}) {
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const fd = new FormData(e.currentTarget);
        try {
            const res = await fetch(API_ROUTES.stock.items, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: fd.get("name"),
                    sku: fd.get("sku") || undefined,
                    unit: fd.get("unit"),
                    quantity: Number(fd.get("quantity")),
                    minStock: Number(fd.get("minStock")),
                    categoryId: fd.get("categoryId")
                        ? Number(fd.get("categoryId"))
                        : undefined,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? "เกิดข้อผิดพลาด");
            }
            toast.success("เพิ่มวัสดุเรียบร้อยแล้ว");
            onSuccess();
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px] overflow-hidden p-0">
                <div className="px-6 py-4 border-b border-gray-100 bg-slate-50/50">
                    <DialogTitle className="text-lg font-semibold text-slate-800">เพิ่มวัสดุใหม่</DialogTitle>
                </div>
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                    <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <Label htmlFor="name" className="text-sm font-semibold text-slate-700">ชื่อวัสดุ <span className="text-rose-500">*</span></Label>
                            <Input id="name" name="name" required className="h-10 transition-shadow focus-visible:ring-blue-500" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="sku" className="text-sm font-semibold text-slate-700">รหัส (SKU)</Label>
                            <Input
                                id="sku"
                                name="sku"
                                placeholder="เว้นว่างเพื่อสร้างอัตโนมัติ"
                                className="h-10 bg-slate-50 transition-shadow focus-visible:ring-blue-500"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-5">
                        <div className="space-y-1.5">
                            <Label htmlFor="unit" className="text-sm font-semibold text-slate-700">หน่วย <span className="text-rose-500">*</span></Label>
                            <Input id="unit" name="unit" placeholder="เช่น ชิ้น" required className="h-10 focus-visible:ring-blue-500" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="quantity" className="text-sm font-semibold text-slate-700">จำนวนเริ่มต้น</Label>
                            <Input id="quantity" name="quantity" type="number" min={1} defaultValue={1} className="h-10 focus-visible:ring-blue-500" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="minStock" className="text-sm font-semibold text-slate-700">จุดสั่งซื้อ</Label>
                            <Input id="minStock" name="minStock" type="number" min={1} defaultValue={1} className="h-10 focus-visible:ring-blue-500" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="categoryId" className="text-sm font-semibold text-slate-700">หมวดหมู่</Label>
                        <Select name="categoryId">
                            <SelectTrigger className="h-10 focus:ring-blue-500">
                                <SelectValue placeholder="เลือกหมวดหมู่ (ไม่บังคับ)" />
                            </SelectTrigger>
                            <SelectContent>
                                {categories.map((cat) => (
                                    <SelectItem key={cat.id} value={String(cat.id)}>
                                        {cat.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="pt-3 flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="h-10 px-5 font-medium hover:bg-slate-100 text-slate-600">
                            ยกเลิก
                        </Button>
                        <Button type="submit" disabled={loading} className="h-10 px-7 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all">
                            {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function AdjustDialog({
    item,
    onClose,
    onSuccess,
}: {
    item: StockItem;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const fd = new FormData(e.currentTarget);
        const qty = Number(fd.get("quantity"));
        const minStock = Number(fd.get("minStock"));
        try {
            const res = await fetch(API_ROUTES.stock.adjustById(item.id), {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "IN",
                    quantity: qty,
                    minStock,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? "เกิดข้อผิดพลาด");
            }
            toast.success(`ปรับยอด ${item.name} เรียบร้อยแล้ว`);
            onSuccess();
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[400px] overflow-hidden p-0">
                <div className="px-6 py-4 border-b border-gray-100 bg-slate-50/50">
                    <DialogTitle className="text-lg font-semibold text-slate-800">ปรับยอดสต็อก</DialogTitle>
                </div>
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                    <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100/60 flex flex-col gap-0.5 shadow-inner">
                        <span className="text-[13px] font-semibold text-blue-800 uppercase tracking-wider">
                            {item.name}
                        </span>
                        <span className="text-sm font-medium text-blue-600/90 flex items-center gap-1.5">
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            คงเหลือปัจจุบัน: {item.quantity} {item.unit}
                        </span>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adj-qty" className="text-sm font-semibold text-slate-700">จำนวนรับเข้า <span className="text-rose-500">*</span></Label>
                        <Input id="adj-qty" name="quantity" type="number" min={1} required className="h-10 focus-visible:ring-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="adj-min-stock" className="text-sm font-semibold text-slate-700">จุดสั่งซื้อ <span className="text-rose-500">*</span></Label>
                        <Input
                            id="adj-min-stock"
                            name="minStock"
                            type="number"
                            min={1}
                            defaultValue={item.minStock}
                            required
                            className="h-10 focus-visible:ring-blue-500"
                        />
                    </div>
                    <div className="pt-3 flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="h-10 px-5 font-medium hover:bg-slate-100 text-slate-600">
                            ยกเลิก
                        </Button>
                        <Button type="submit" disabled={loading} className="h-10 px-7 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all">
                            {loading ? "กำลังบันทึก..." : "บันทึกการปรับ"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function AddCategoryDialog({
    open,
    onClose,
    onSuccess,
}: {
    open: boolean;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        setLoading(true);
        const fd = new FormData(e.currentTarget);
        try {
            const res = await fetch(API_ROUTES.stock.categories, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: fd.get("name"),
                    description: fd.get("description") || null,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error ?? "เกิดข้อผิดพลาด");
            }
            toast.success("เพิ่มหมวดหมู่เรียบร้อยแล้ว");
            onSuccess();
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "เกิดข้อผิดพลาด",
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[400px] overflow-hidden p-0">
                <div className="px-6 py-4 border-b border-gray-100 bg-slate-50/50">
                    <DialogTitle className="text-lg font-semibold text-slate-800">เพิ่มหมวดหมู่</DialogTitle>
                </div>
                <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">
                    <div className="space-y-1.5">
                        <Label htmlFor="cat-name" className="text-sm font-semibold text-slate-700">ชื่อหมวดหมู่ <span className="text-rose-500">*</span></Label>
                        <Input id="cat-name" name="name" required className="h-10 focus-visible:ring-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="cat-desc" className="text-sm font-semibold text-slate-700">คำอธิบาย (ถ้ามี)</Label>
                        <Input id="cat-desc" name="description" className="h-10 focus-visible:ring-blue-500" />
                    </div>
                    <div className="pt-3 flex justify-end gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} disabled={loading} className="h-10 px-5 font-medium hover:bg-slate-100 text-slate-600">
                            ยกเลิก
                        </Button>
                        <Button type="submit" disabled={loading} className="h-10 px-7 font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all">
                            {loading ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
