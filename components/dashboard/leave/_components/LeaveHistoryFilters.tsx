"use client";

import { useId } from "react";
import type { LeaveStatus, LeaveType } from "@prisma/client";
import { RotateCcw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ALL_LEAVE_TYPES } from "@/constants/leave";
import { LEAVE_HISTORY_QUERY_MAX_LENGTH } from "@/lib/services/leave/history-filters";
import { getLeaveTypeLabel } from "@/lib/services/leave/notification-format";
import { getRequestStatusMeta } from "@/components/dashboard/shared/RequestStatusBadge";

export interface LeaveHistoryFiltersProps {
    query: string;
    queryPlaceholder: string;
    queryLabel: string;
    leaveType: LeaveType | "";
    status: LeaveStatus | "";
    year: string;
    yearOptions: readonly number[];
    statusOptions: readonly LeaveStatus[];
    hasActiveFilters: boolean;
    onQueryChange: (value: string) => void;
    onLeaveTypeChange: (value: LeaveType | "") => void;
    onStatusChange: (value: LeaveStatus | "") => void;
    onYearChange: (value: string) => void;
    onReset: () => void;
}

export function LeaveHistoryFilters({
    query,
    queryPlaceholder,
    queryLabel,
    leaveType,
    status,
    year,
    yearOptions,
    statusOptions,
    hasActiveFilters,
    onQueryChange,
    onLeaveTypeChange,
    onStatusChange,
    onYearChange,
    onReset,
}: LeaveHistoryFiltersProps) {
    const idPrefix = useId();
    const queryId = `${idPrefix}-query`;
    const leaveTypeId = `${idPrefix}-leave-type`;
    const statusId = `${idPrefix}-status`;
    const yearId = `${idPrefix}-year`;

    return (
        <fieldset className="rounded-xl border border-border-subtle bg-surface-subtle/70 p-3 shadow-sm">
            <legend className="sr-only">ตัวกรองประวัติการลา</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(8rem,1fr))_auto]">
                <div className="min-w-0">
                    <Label htmlFor={queryId} className="sr-only">
                        {queryLabel}
                    </Label>
                    <div className="relative">
                        <Search
                            className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-content-subtle"
                            aria-hidden="true"
                        />
                        <Input
                            id={queryId}
                            type="search"
                            name={queryId}
                            autoComplete="off"
                            maxLength={LEAVE_HISTORY_QUERY_MAX_LENGTH}
                            aria-label={queryLabel}
                            placeholder={queryPlaceholder}
                            value={query}
                            onChange={(event) => onQueryChange(event.target.value)}
                            className="h-11 rounded-lg border-border-subtle bg-surface-raised pl-10 text-content-primary placeholder:text-content-muted"
                        />
                    </div>
                </div>

                <div className="min-w-0">
                    <Label htmlFor={leaveTypeId} className="sr-only">
                        ประเภทการลา
                    </Label>
                    <Select
                        value={leaveType || undefined}
                        onValueChange={(value) => {
                            if (isLeaveType(value)) {
                                onLeaveTypeChange(value);
                            }
                        }}
                    >
                        <SelectTrigger
                            id={leaveTypeId}
                            className="h-11 w-full rounded-lg border-border-subtle bg-surface-raised text-content-primary"
                            aria-label="ประเภทการลา"
                        >
                            <SelectValue placeholder="ทุกประเภท" />
                        </SelectTrigger>
                        <SelectContent>
                            {ALL_LEAVE_TYPES.map((type) => (
                                <SelectItem key={type} value={type}>
                                    {getLeaveTypeLabel(type)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="min-w-0">
                    <Label htmlFor={statusId} className="sr-only">
                        สถานะการลา
                    </Label>
                    <Select
                        value={status || undefined}
                        onValueChange={(value) => {
                            if (isOptionValue(value, statusOptions)) {
                                onStatusChange(value);
                            }
                        }}
                    >
                        <SelectTrigger
                            id={statusId}
                            className="h-11 w-full rounded-lg border-border-subtle bg-surface-raised text-content-primary"
                            aria-label="สถานะการลา"
                        >
                            <SelectValue placeholder="ทุกสถานะ" />
                        </SelectTrigger>
                        <SelectContent>
                            {statusOptions.map((statusOption) => (
                                <SelectItem key={statusOption} value={statusOption}>
                                    {getRequestStatusMeta(statusOption).label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="min-w-0">
                    <Label htmlFor={yearId} className="sr-only">
                        ปีที่ลา
                    </Label>
                    <Select value={year || undefined} onValueChange={onYearChange}>
                        <SelectTrigger
                            id={yearId}
                            className="h-11 w-full rounded-lg border-border-subtle bg-surface-raised text-content-primary"
                            aria-label="ปีที่ลา"
                        >
                            <SelectValue placeholder="ทุกปี" />
                        </SelectTrigger>
                        <SelectContent>
                            {yearOptions.map((yearOption) => (
                                <SelectItem key={yearOption} value={String(yearOption)}>
                                    {formatBuddhistYear(yearOption)}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={!hasActiveFilters}
                    onClick={onReset}
                    className="w-full rounded-lg border-border-subtle bg-surface-raised lg:w-auto"
                >
                    <RotateCcw aria-hidden="true" />
                    ล้างตัวกรอง
                </Button>
            </div>
        </fieldset>
    );
}

function isLeaveType(value: string): value is LeaveType {
    return isOptionValue(value, ALL_LEAVE_TYPES);
}

function isOptionValue<T extends string>(
    value: string,
    options: readonly T[],
): value is T {
    return options.some((option) => option === value);
}

function formatBuddhistYear(year: number): string {
    return String(year + 543);
}
