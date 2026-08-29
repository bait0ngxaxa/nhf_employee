"use client";

import { useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search, Download, Filter, Loader2, X } from "lucide-react";
import { STATUS_FILTER_OPTIONS } from "@/constants/ui";
import {
    useEmployeeUIContext,
    useEmployeeDataContext,
} from "@/components/dashboard/context/employee/EmployeeContext";

interface EmployeeSearchControlsProps {
    onExportClick: () => void;
}

export function EmployeeSearchControls({
    onExportClick,
}: EmployeeSearchControlsProps) {
    const { employees, totalEmployees } = useEmployeeDataContext();
    const {
        searchTerm,
        setSearchTerm,
        statusFilter,
        setStatusFilter,
        isExporting,
    } = useEmployeeUIContext();

    const handleSearch = useCallback((value: string) => {
        setSearchTerm(value);
    }, [setSearchTerm]);

    return (
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row">
                <div className="relative min-w-0 flex-1">
                    <Search
                        className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle"
                        aria-hidden="true"
                    />
                    <Input
                        id="employee-search"
                        type="text"
                        aria-label="ค้นหาพนักงาน"
                        placeholder="ค้นหาชื่อ ชื่อเล่น อีเมล ตำแหน่ง แผนก หรือสังกัด"
                        value={searchTerm}
                        onChange={(event) => handleSearch(event.target.value)}
                        className="h-11 rounded-lg border-border-subtle bg-surface-raised pl-10 pr-10 text-content-primary placeholder:text-content-muted focus:border-brand-border focus:ring-brand-solid/20"
                    />
                    {searchTerm.trim().length > 0 && (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleSearch("")}
                            aria-label="ล้างคำค้นหา"
                            className="absolute right-1.5 top-1/2 size-11 -translate-y-1/2 rounded-md text-content-muted hover:bg-surface-muted hover:text-content-body sm:size-7"
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                        </Button>
                    )}
                </div>

                {/* Status Filter */}
                <div className="w-full max-w-full sm:w-52">
                    <Select
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                    >
                        <SelectTrigger
                            className="h-11 w-full rounded-lg border-border-subtle bg-surface-raised"
                            aria-label="กรองตามสถานะพนักงาน"
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                <Filter
                                    className="h-4 w-4 shrink-0 text-content-subtle"
                                    aria-hidden="true"
                                />
                                <SelectValue placeholder="กรองตามสถานะ" />
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            {STATUS_FILTER_OPTIONS.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {employees.length > 0 && (
                <Button
                    variant="outline"
                    className="h-11 w-full justify-center rounded-lg border-border-subtle bg-surface-raised text-content-body hover:bg-surface-subtle hover:text-content-primary xl:w-auto xl:justify-start"
                    disabled={isExporting}
                    onClick={onExportClick}
                >
                    {isExporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                        <Download className="h-4 w-4" aria-hidden="true" />
                    )}
                    <span>
                        {isExporting
                            ? "กำลังเตรียม\u2026"
                            : `ดาวน์โหลด CSV (${totalEmployees} คน)`}
                    </span>
                </Button>
            )}
        </div>
    );
}
