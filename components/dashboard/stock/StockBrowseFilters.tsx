"use client";

import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { StockCategory } from "../context/stock/types";

type StockBrowseFiltersProps = {
    searchQuery: string;
    onSearchChange: (value: string) => void;
    selectedCategoryId: number | undefined;
    onCategoryChange: (value: number | undefined) => void;
    categories: StockCategory[];
};

export function StockBrowseFilters({
    searchQuery,
    onSearchChange,
    selectedCategoryId,
    onCategoryChange,
    categories,
}: StockBrowseFiltersProps) {
    return (
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm">
            <div className="mb-3 px-1">
                <div className="text-[0.9375rem] font-semibold leading-6 text-slate-900">
                    ค้นหาและกรองรายการ
                </div>
                <div className="max-w-[62ch] text-sm leading-5 text-slate-600">
                    เลือกหมวดหรือพิมพ์ชื่อวัสดุเพื่อเจอรายการเร็วขึ้น
                </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
                    <Input
                        aria-label="ค้นหาวัสดุ"
                        name="stock-search"
                        autoComplete="off"
                        placeholder="ค้นหาวัสดุ…"
                        value={searchQuery}
                        onChange={(event) => onSearchChange(event.target.value)}
                        className="h-12 rounded-2xl border-slate-200 bg-white pl-11 pr-11 text-slate-900 placeholder:text-slate-500 focus-visible:border-blue-300 focus-visible:ring-blue-200"
                    />
                    {searchQuery.trim().length > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onSearchChange("")}
                            className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                            aria-label="ล้างคำค้นหาวัสดุ"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    )}
                </div>
                <div className="w-full sm:w-64">
                    <Select
                        value={
                            selectedCategoryId !== undefined
                                ? String(selectedCategoryId)
                                : "all"
                        }
                        onValueChange={(value) =>
                            onCategoryChange(value === "all" ? undefined : Number(value))
                        }
                    >
                        <SelectTrigger
                            className="h-12 rounded-2xl border-slate-200 bg-white text-slate-900 focus:ring-blue-200"
                            aria-label="กรองหมวดหมู่วัสดุ"
                        >
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
        </div>
    );
}
