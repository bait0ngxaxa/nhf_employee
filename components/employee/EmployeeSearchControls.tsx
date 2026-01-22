"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Search, Download, Filter } from "lucide-react";
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

    return (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0 sm:space-x-3">
            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 flex-1">
                {/* Search Input */}
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                        type="text"
                        placeholder="ค้นหาพนักงาน (ชื่อ, ชื่อเล่น, อีเมล, ตำแหน่ง, แผนก, สังกัด)"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 rounded-xl border-gray-200 focus:border-blue-500 focus:ring-blue-500/20 bg-white/50"
                    />
                </div>

                {/* Status Filter */}
                <div className="w-full sm:w-48">
                    <Select
                        value={statusFilter}
                        onValueChange={setStatusFilter}
                    >
                        <SelectTrigger className="w-full">
                            <div className="flex items-center space-x-2">
                                <Filter className="h-4 w-4 text-gray-400" />
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
                    className="flex items-center space-x-2 whitespace-nowrap"
                    disabled={isExporting}
                    onClick={onExportClick}
                >
                    <Download className="h-4 w-4" />
                    <span>
                        {isExporting
                            ? "กำลังเตรียม..."
                            : `Export CSV (${totalEmployees} คน)`}
                    </span>
                </Button>
            )}
        </div>
    );
}
