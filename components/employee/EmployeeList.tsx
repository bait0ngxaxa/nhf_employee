"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
    EmployeeTable,
    EmployeeSearchControls,
    EmployeeModals,
} from "@/components/employee";
import { Pagination } from "@/components/Pagination";
import { type EmployeeListProps } from "@/types/employees";
import { AlertCircle, SearchX, Sparkles, UsersRound } from "lucide-react";

import { getEmployeeStatusLabel } from "@/lib/helpers/employee-helpers";
import {
    useEmployeeDataContext,
    useEmployeeUIContext,
} from "@/components/dashboard/context/employee/EmployeeContext";

export function EmployeeList({ userRole }: EmployeeListProps) {
    const {
        employees,
        currentEmployees,
        totalEmployees,
        totalPages,
        isLoading,
        error,
        triggerRefresh,
    } = useEmployeeDataContext();

    const {
        debouncedSearchTerm,

        statusFilter,

        currentPage,
        itemsPerPage,
        handlePageChange,
        handlePreviousPage,
        handleNextPage,
        handleExportCSV,
        handleEditEmployee,
    } = useEmployeeUIContext();

    // Show full skeleton only for the very first unfiltered load.
    // Keep search controls mounted during filtering/searching to avoid input focus loss.
    const isInitialLoading =
        isLoading
        && employees.length === 0
        && totalEmployees === 0
        && debouncedSearchTerm.trim().length === 0
        && statusFilter === "all";

    // Handle export button click - fetch data then trigger CSV download
    const onExportClick = async () => {
        await handleExportCSV();
    };

    if (isInitialLoading) {
        return (
            <div className="space-y-6 animate-pulse">
                {/* Search Controls Skeleton */}
                <div className="flex flex-wrap gap-3">
                    <Skeleton className="h-10 flex-1 min-w-[200px]" />
                    <Skeleton className="h-10 w-40" />
                    <Skeleton className="h-10 w-32" />
                    <Skeleton className="h-10 w-32" />
                </div>

                {/* Results Summary Skeleton */}
                <div className="flex justify-between">
                    <Skeleton className="h-4 w-48" />
                    <Skeleton className="h-4 w-24" />
                </div>

                {/* Table Skeleton */}
                <div className="w-full">
                    <div className="flex gap-4 pb-4 border-b border-gray-100">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="h-4 flex-1" />
                        ))}
                    </div>
                    <div className="space-y-4 pt-4">
                        {Array.from({ length: 5 }).map((_, rowIndex) => (
                            <div
                                key={rowIndex}
                                className="flex gap-4 items-center"
                            >
                                {Array.from({ length: 6 }).map(
                                    (_, colIndex) => (
                                        <Skeleton
                                            key={colIndex}
                                            className="h-12 flex-1"
                                        />
                                    ),
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    // Calculate display range
    const hasActiveFilters =
        debouncedSearchTerm.trim().length > 0 || statusFilter !== "all";
    const startIndex =
        totalEmployees === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
    const endIndex =
        totalEmployees === 0
            ? 0
            : Math.min((currentPage - 1) * itemsPerPage + employees.length, totalEmployees);
    const emptyTitle = error
        ? "โหลดรายชื่อพนักงานไม่สำเร็จ"
        : hasActiveFilters
          ? "ไม่พบพนักงานที่ตรงกับเงื่อนไข"
          : "ยังไม่มีข้อมูลพนักงาน";
    const emptyMessage = error
        ? error
        : hasActiveFilters
          ? "ลองปรับคำค้นหา สถานะ หรือเคลียร์ตัวกรองเพื่อดูรายชื่อทั้งหมด"
          : "เมื่อเพิ่มพนักงานแล้ว รายชื่อและข้อมูลติดต่อจะแสดงที่นี่";

    return (
        <div className="space-y-6">
            {/* Search, Filter and Export Controls */}
            <EmployeeSearchControls onExportClick={onExportClick} />

            {/* Results Summary */}
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0 text-sm text-slate-700">
                    <span className="font-semibold text-slate-950">
                        แสดงผล {startIndex}-{endIndex}
                    </span>{" "}
                    จาก {totalEmployees} คน
                    <div className="mt-2 flex flex-wrap gap-2">
                        {statusFilter !== "all" ? (
                            <span className="inline-flex max-w-full items-center rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-800">
                                <span className="truncate">
                                    สถานะ: {getEmployeeStatusLabel(statusFilter)}
                                </span>
                            </span>
                        ) : null}
                        {debouncedSearchTerm ? (
                            <span className="inline-flex max-w-full items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                                <span className="truncate">
                                    ค้นหา: &quot;{debouncedSearchTerm}&quot;
                                </span>
                            </span>
                        ) : null}
                    </div>
                </div>
                {totalPages > 1 ? (
                    <div className="shrink-0 text-sm font-medium text-slate-600">
                        หน้า {currentPage} จาก {totalPages}
                    </div>
                ) : null}
            </div>

            {/* Employee Table */}
            {employees.length === 0 ? (
                <EmployeeEmptyState
                    title={emptyTitle}
                    message={emptyMessage}
                    type={
                        error
                            ? "error"
                            : hasActiveFilters
                              ? "filtered"
                              : "empty"
                    }
                    onRetry={error ? triggerRefresh : undefined}
                />
            ) : (
                <EmployeeTable
                    employees={currentEmployees}
                    userRole={userRole}
                    onEditEmployee={handleEditEmployee}
                />
            )}

            {/* Pagination Controls */}
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                itemsPerPage={itemsPerPage}
                onPageChange={handlePageChange}
                onPreviousPage={handlePreviousPage}
                onNextPage={handleNextPage}
            />

            {/* Modals */}
            <EmployeeModals />
        </div>
    );
}

function EmployeeEmptyState({
    title,
    message,
    type,
    onRetry,
}: {
    title: string;
    message: string;
    type: "empty" | "filtered" | "error";
    onRetry?: () => Promise<void>;
}) {
    const Icon =
        type === "error" ? AlertCircle : type === "filtered" ? SearchX : UsersRound;
    const toneClass =
        type === "error"
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-slate-200 bg-white text-slate-700";
    const iconClass =
        type === "error"
            ? "bg-red-100 text-red-700"
            : type === "filtered"
              ? "bg-amber-100 text-amber-700"
              : "bg-sky-100 text-sky-700";

    return (
        <div className={`rounded-xl border p-8 text-center ${toneClass}`}>
            <div className="mx-auto flex max-w-md flex-col items-center">
                <div
                    className={`mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${iconClass}`}
                >
                    <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold text-slate-950">
                    {title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-current [overflow-wrap:anywhere]">
                    {message}
                </p>
                {type === "empty" ? (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-800">
                        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                        พร้อมจัดระเบียบทีมเมื่อมีข้อมูลแรก
                    </div>
                ) : null}
                {onRetry ? (
                    <Button
                        type="button"
                        variant="outline"
                        className="mt-5 rounded-lg border-red-200 bg-white text-red-700 hover:bg-red-50 hover:text-red-800"
                        onClick={() => void onRetry()}
                    >
                        โหลดอีกครั้ง
                    </Button>
                ) : null}
            </div>
        </div>
    );
}
