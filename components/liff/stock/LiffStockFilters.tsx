"use client";

import type { StockRequestStatus } from "@prisma/client";
import { Search, X } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { LiffStockCategory } from "@/lib/types/stock-liff";

const REQUEST_STATUSES = [
    { value: "all", label: "ทุกสถานะ" },
    { value: "PENDING_ISSUE", label: "รอจ่าย" },
    { value: "ISSUED", label: "จ่ายแล้ว" },
    { value: "CANCELLED", label: "ยกเลิก" },
] as const;

interface LiffStockFiltersProps {
    search: string;
    categoryId: number | undefined;
    categories: LiffStockCategory[];
    onSearchChange: (value: string) => void;
    onCategoryChange: (value: number | undefined) => void;
}

export function LiffStockFilters({
    search,
    categoryId,
    categories,
    onSearchChange,
    onCategoryChange,
}: LiffStockFiltersProps): ReactElement {
    return (
        <div className="space-y-3 rounded-2xl bg-surface-raised p-3 shadow-sm ring-1 ring-border-subtle">
            <SearchInput
                id="liff-stock-search"
                label="ค้นหาวัสดุ"
                placeholder="ค้นหาชื่อหรือ SKU"
                value={search}
                onChange={onSearchChange}
            />
            <Select
                value={categoryId === undefined ? "all" : String(categoryId)}
                onValueChange={(value) =>
                    onCategoryChange(value === "all" ? undefined : Number(value))
                }
            >
                <SelectTrigger
                    aria-label="กรองหมวดหมู่วัสดุ"
                    className="h-12 w-full rounded-xl border-border-subtle bg-surface"
                >
                    <SelectValue placeholder="ทุกหมวดหมู่" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">ทุกหมวดหมู่</SelectItem>
                    {categories.map((category) => (
                        <SelectItem key={category.id} value={String(category.id)}>
                            {category.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

interface LiffStockRequestFiltersProps {
    search: string;
    status: StockRequestStatus | undefined;
    onSearchChange: (value: string) => void;
    onStatusChange: (value: StockRequestStatus | undefined) => void;
}

export function LiffStockRequestFilters({
    search,
    status,
    onSearchChange,
    onStatusChange,
}: LiffStockRequestFiltersProps): ReactElement {
    return (
        <div className="space-y-3 rounded-2xl bg-surface-raised p-3 shadow-sm ring-1 ring-border-subtle">
            <SearchInput
                id="liff-stock-request-search"
                label="ค้นหาคำขอเบิก"
                placeholder="เลขที่คำขอ โครงการ หรือวัสดุ"
                value={search}
                onChange={onSearchChange}
            />
            <Select
                value={status ?? "all"}
                onValueChange={(value) =>
                    onStatusChange(
                        value === "all" ? undefined : value as StockRequestStatus,
                    )
                }
            >
                <SelectTrigger
                    aria-label="กรองสถานะคำขอเบิก"
                    className="h-12 w-full rounded-xl border-border-subtle bg-surface"
                >
                    <SelectValue placeholder="ทุกสถานะ" />
                </SelectTrigger>
                <SelectContent>
                    {REQUEST_STATUSES.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                            {option.label}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}

function SearchInput({
    id,
    label,
    placeholder,
    value,
    onChange,
}: {
    id: string;
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
}): ReactElement {
    return (
        <div className="relative">
            <Search
                className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-content-muted"
                aria-hidden="true"
            />
            <Input
                id={id}
                aria-label={label}
                type="search"
                inputMode="search"
                autoComplete="off"
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder={placeholder}
                className="h-12 rounded-xl border-border-subtle bg-surface pl-10 pr-12"
            />
            {value ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onChange("")}
                    aria-label={`ล้าง${label}`}
                    className="absolute right-0.5 top-1/2 size-11 -translate-y-1/2 rounded-xl text-content-muted"
                >
                    <X className="size-4" aria-hidden="true" />
                </Button>
            ) : null}
        </div>
    );
}
