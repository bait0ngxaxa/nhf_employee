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
        <div className="rounded-[1.75rem] border border-slate-200/80 bg-white/80 p-3 shadow-[0_20px_48px_-32px_rgba(15,23,42,0.22)] backdrop-blur">
            <div className="mb-3 px-1">
                <div className="text-sm font-semibold text-slate-800">
                    ค้นหาและกรองรายการ
                </div>
                <div className="text-xs text-slate-500">
                    เลือกหมวดหรือพิมพ์ชื่อวัสดุเพื่อเจอรายการเร็วขึ้น
                </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                        placeholder="ค้นหาวัสดุ..."
                        value={searchQuery}
                        onChange={(event) => onSearchChange(event.target.value)}
                        className="h-12 rounded-2xl border-slate-200 bg-slate-50/80 pl-11 pr-11 shadow-inner shadow-slate-200/50 focus-visible:border-orange-300 focus-visible:ring-orange-200"
                    />
                    {searchQuery.trim().length > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onSearchChange("")}
                            className="absolute right-2 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full text-slate-400 hover:bg-slate-200/70 hover:text-slate-600"
                        >
                            <X className="h-4 w-4" />
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
                        <SelectTrigger className="h-12 rounded-2xl border-slate-200 bg-slate-50/80 shadow-inner shadow-slate-200/50">
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
