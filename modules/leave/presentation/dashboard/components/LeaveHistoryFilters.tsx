"use client";

import type { ReactElement } from "react";
import { useId } from "react";
import type { LeaveStatusValue as LeaveStatus, LeaveTypeValue as LeaveType } from "../../types";
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
import { ALL_LEAVE_TYPES } from "../../../domain/constants";
import { LEAVE_HISTORY_QUERY_MAX_LENGTH } from "../../../application/queries/history-filters";
import { getLeaveTypeLabel } from "../../../application/notifications/notification-format";
import { getRequestStatusMeta } from "@/components/dashboard/shared/RequestStatusBadge";

const ALL_FILTER_VALUE = "__ALL__";

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
}: LeaveHistoryFiltersProps): ReactElement {
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
                        value={leaveType || ALL_FILTER_VALUE}
                        onValueChange={(value) => {
                            if (value === ALL_FILTER_VALUE) {
                                onLeaveTypeChange("");
                                return;
                            }
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
                            <SelectItem value={ALL_FILTER_VALUE}>ทุกประเภท</SelectItem>
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
                        value={status || ALL_FILTER_VALUE}
                        onValueChange={(value) => {
                            if (value === ALL_FILTER_VALUE) {
                                onStatusChange("");
                                return;
                            }
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
                            <SelectItem value={ALL_FILTER_VALUE}>ทุกสถานะ</SelectItem>
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
                    <Select
                        value={year || ALL_FILTER_VALUE}
                        onValueChange={(value) => {
                            if (value === ALL_FILTER_VALUE) {
                                onYearChange("");
                                return;
                            }
                            if (isYearOption(value, yearOptions)) {
                                onYearChange(value);
                            }
                        }}
                    >
                        <SelectTrigger
                            id={yearId}
                            className="h-11 w-full rounded-lg border-border-subtle bg-surface-raised text-content-primary"
                            aria-label="ปีที่ลา"
                        >
                            <SelectValue placeholder="ทุกปี" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL_FILTER_VALUE}>ทุกปี</SelectItem>
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

function isYearOption(value: string, options: readonly number[]): boolean {
    return options.some((option) => String(option) === value);
}

function formatBuddhistYear(year: number): string {
    return String(year + 543);
}
