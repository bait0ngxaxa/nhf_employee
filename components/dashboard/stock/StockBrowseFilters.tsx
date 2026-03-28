"use client";

import { Search } from "lucide-react";
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
        <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                    placeholder="ค้นหาวัสดุ..."
                    value={searchQuery}
                    onChange={(event) => onSearchChange(event.target.value)}
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
                    onValueChange={(value) =>
                        onCategoryChange(value === "all" ? undefined : Number(value))
                    }
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
    );
}
