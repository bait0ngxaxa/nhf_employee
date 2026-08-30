"use client";

import { ChevronLeft, ChevronRight, Filter, Paperclip, RotateCcw, X } from "lucide-react";
import { useEffect, useState, type ReactElement } from "react";

import { RequestStatusBadge } from "@/components/dashboard/shared/RequestStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { formatThaiDateTimeWithTimeWord } from "@/lib/helpers/date-helpers";
import type { LeaveHistoryFilters } from "@/lib/services/leave/history-filters";
import type {
    EmployeeLeaveAction,
    LiffEmployeeLeaveRequest,
    LiffLeaveProfileResponse,
    LeaveStatusValue,
    LeaveTypeValue,
} from "@/lib/types/leave";

import {
    formatLeaveDateRange,
    formatLeaveDays,
    getLeavePeriodLabel,
    getLeaveTypeLabel,
} from "./leave-format";

interface LiffLeaveHistoryProps {
    profile: LiffLeaveProfileResponse;
    filters: LeaveHistoryFilters;
    isLoading: boolean;
    onApplyFilters: (filters: LeaveHistoryFilters) => void;
    onPageChange: (page: number) => void;
    onOpenDetail: (requestId: string) => void;
    onAction: (action: EmployeeLeaveAction, request: LiffEmployeeLeaveRequest) => void;
}

export function LiffLeaveHistory({
    profile,
    filters,
    isLoading,
    onApplyFilters,
    onPageChange,
    onOpenDetail,
    onAction,
}: LiffLeaveHistoryProps): ReactElement {
    const [filterOpen, setFilterOpen] = useState(false);
    const hasFilters = Boolean(
        filters.query || filters.leaveType || filters.status || filters.year,
    );

    return (
        <section aria-labelledby="liff-leave-history-heading" className="space-y-3">
            <div className="flex items-end justify-between gap-3">
                <div>
                    <h2
                        id="liff-leave-history-heading"
                        className="text-lg font-bold tracking-tight text-content-heading"
                    >
                        คำขอลาของฉัน
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-content-secondary">
                        {profile.metadata.totalItems} รายการ
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="min-h-11"
                    onClick={() => setFilterOpen(true)}
                >
                    <Filter className="size-4" aria-hidden="true" />
                    ตัวกรอง{hasFilters ? " · ใช้งาน" : ""}
                </Button>
            </div>

            {profile.history.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border-strong bg-surface px-5 py-8 text-center">
                    <p className="font-semibold text-content-heading">
                        {hasFilters ? "ไม่พบรายการตามตัวกรอง" : "ยังไม่มีคำขอลา"}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-content-muted">
                        {hasFilters
                            ? "ลองปรับตัวกรองเพื่อดูรายการอื่น"
                            : "เมื่อส่งคำขอแล้ว สถานะจะแสดงที่นี่"}
                    </p>
                </div>
            ) : (
                <div className={`space-y-3 ${isLoading ? "opacity-60" : ""}`} aria-busy={isLoading}>
                    {profile.history.map((request) => (
                        <HistoryCard
                            key={request.id}
                            request={request}
                            disabled={isLoading}
                            onOpenDetail={onOpenDetail}
                            onAction={onAction}
                        />
                    ))}
                </div>
            )}

            {profile.metadata.totalPages > 1 ? (
                <div className="flex items-center justify-between gap-3 pt-1">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="หน้าก่อนหน้า"
                        disabled={isLoading || profile.metadata.currentPage <= 1}
                        onClick={() => onPageChange(profile.metadata.currentPage - 1)}
                    >
                        <ChevronLeft aria-hidden="true" />
                    </Button>
                    <span className="text-sm font-semibold tabular-nums text-content-secondary">
                        หน้า {profile.metadata.currentPage} / {profile.metadata.totalPages}
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="หน้าถัดไป"
                        disabled={isLoading || profile.metadata.currentPage >= profile.metadata.totalPages}
                        onClick={() => onPageChange(profile.metadata.currentPage + 1)}
                    >
                        <ChevronRight aria-hidden="true" />
                    </Button>
                </div>
            ) : null}

            <LeaveFilterSheet
                open={filterOpen}
                filters={filters}
                years={profile.metadata.availableYears}
                onOpenChange={setFilterOpen}
                onApply={onApplyFilters}
            />
        </section>
    );
}

function HistoryCard({
    request,
    disabled,
    onOpenDetail,
    onAction,
}: {
    request: LiffEmployeeLeaveRequest;
    disabled: boolean;
    onOpenDetail: (requestId: string) => void;
    onAction: (action: EmployeeLeaveAction, request: LiffEmployeeLeaveRequest) => void;
}): ReactElement {
    return (
        <article className="rounded-2xl bg-surface p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="font-bold tracking-tight text-content-heading">
                        {getLeaveTypeLabel(request.leaveType)}
                    </h3>
                    <p className="mt-1 break-words text-sm font-medium leading-6 text-content-secondary">
                        {formatLeaveDateRange(request.startDate, request.endDate)}
                    </p>
                    <p className="text-xs leading-5 text-content-muted">
                        {getLeavePeriodLabel(request.period)} · {formatLeaveDays(request.durationDays)} วัน
                    </p>
                </div>
                <RequestStatusBadge status={request.status} />
            </div>
            <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-content-body">
                {request.reason}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-content-muted">
                <span>{formatThaiDateTimeWithTimeWord(request.createdAt)}</span>
                {request.attachments.length > 0 ? (
                    <span className="inline-flex items-center gap-1">
                        <Paperclip className="size-3.5" aria-hidden="true" />
                        {request.attachments.length} รูป
                    </span>
                ) : null}
            </div>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-border-subtle pt-3">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled}
                    onClick={() => onOpenDetail(request.id)}
                >
                    ดูรายละเอียด
                </Button>
                {request.availableActions.map((action) => (
                    <Button
                        key={action}
                        type="button"
                        variant="outline"
                        size="sm"
                        className={action === "REQUEST_NOT_TAKEN"
                            ? "border-status-info-border text-status-info-foreground"
                            : "border-status-danger-border text-status-danger-strong"}
                        disabled={disabled}
                        onClick={() => onAction(action, request)}
                    >
                        {action === "REQUEST_NOT_TAKEN" ? (
                            <RotateCcw aria-hidden="true" />
                        ) : (
                            <X aria-hidden="true" />
                        )}
                        {action === "CANCEL"
                            ? "ยกเลิก"
                            : action === "REQUEST_CANCELLATION"
                                ? "ขอยกเลิก"
                                : "แจ้งไม่ได้ใช้วันลา"}
                    </Button>
                ))}
            </div>
        </article>
    );
}

function LeaveFilterSheet({
    open,
    filters,
    years,
    onOpenChange,
    onApply,
}: {
    open: boolean;
    filters: LeaveHistoryFilters;
    years: number[];
    onOpenChange: (open: boolean) => void;
    onApply: (filters: LeaveHistoryFilters) => void;
}): ReactElement {
    const [draft, setDraft] = useState<LeaveHistoryFilters>(filters);

    useEffect(() => {
        if (open) setDraft(filters);
    }, [filters, open]);

    const selectClassName = "min-h-12 w-full rounded-md border border-input bg-surface px-3 text-sm text-content-body outline-none focus-visible:ring-2 focus-visible:ring-brand-focus/40";

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                closeButtonLabel="ปิดตัวกรองประวัติการลา"
                className="max-h-[88dvh] overflow-y-auto rounded-t-3xl border-0 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2"
            >
                <SheetHeader className="pr-12 text-left">
                    <SheetTitle>กรองคำขอลา</SheetTitle>
                    <SheetDescription>ค้นหาและเลือกเฉพาะรายการที่ต้องการดู</SheetDescription>
                </SheetHeader>
                <div className="space-y-4 px-4">
                    <label className="grid gap-2 text-sm font-medium text-content-heading">
                        ค้นหาเหตุผล
                        <Input
                            value={draft.query ?? ""}
                            maxLength={200}
                            placeholder="พิมพ์คำค้นหา"
                            onChange={(event) => setDraft((current) => ({
                                ...current,
                                query: event.target.value || undefined,
                            }))}
                        />
                    </label>
                    <FilterSelect
                        label="ประเภทการลา"
                        value={draft.leaveType ?? ""}
                        className={selectClassName}
                        onChange={(value) => setDraft((current) => ({
                            ...current,
                            leaveType: value as LeaveTypeValue || undefined,
                        }))}
                        options={[
                            ["", "ทุกประเภท"],
                            ["SICK", "ลาป่วย"],
                            ["PERSONAL", "ลากิจ"],
                            ["VACATION", "ลาพักร้อน"],
                        ]}
                    />
                    <FilterSelect
                        label="สถานะ"
                        value={draft.status ?? ""}
                        className={selectClassName}
                        onChange={(value) => setDraft((current) => ({
                            ...current,
                            status: value as LeaveStatusValue || undefined,
                        }))}
                        options={[
                            ["", "ทุกสถานะ"],
                            ["PENDING", "รออนุมัติ"],
                            ["APPROVED", "อนุมัติแล้ว"],
                            ["REJECTED", "ไม่อนุมัติ"],
                            ["CANCELLED", "ยกเลิกแล้ว"],
                            ["NOT_TAKEN", "ไม่ได้ใช้วันลา"],
                            ["CANCELLATION_REQUESTED", "รอยืนยันยกเลิก"],
                            ["CANCELLED_AFTER_APPROVAL", "ยกเลิกหลังอนุมัติ"],
                        ]}
                    />
                    <FilterSelect
                        label="ปี"
                        value={draft.year ? String(draft.year) : ""}
                        className={selectClassName}
                        onChange={(value) => setDraft((current) => ({
                            ...current,
                            year: value ? Number(value) : undefined,
                        }))}
                        options={[
                            ["", "ทุกปี"],
                            ...years.map((year) => [String(year), String(year)] as const),
                        ]}
                    />
                    <div className="grid grid-cols-2 gap-2 pt-2">
                        <Button
                            type="button"
                            variant="outline"
                            className="min-h-12"
                            onClick={() => setDraft({})}
                        >
                            ล้างตัวกรอง
                        </Button>
                        <Button
                            type="button"
                            className="min-h-12 bg-module-leave-solid text-content-on-brand hover:bg-module-leave-solid-hover"
                            onClick={() => {
                                onApply(draft);
                                onOpenChange(false);
                            }}
                        >
                            แสดงผล
                        </Button>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}

function FilterSelect({
    label,
    value,
    className,
    options,
    onChange,
}: {
    label: string;
    value: string;
    className: string;
    options: ReadonlyArray<readonly [string, string]>;
    onChange: (value: string) => void;
}): ReactElement {
    return (
        <label className="grid gap-2 text-sm font-medium text-content-heading">
            {label}
            <select
                value={value}
                className={className}
                onChange={(event) => onChange(event.target.value)}
            >
                {options.map(([optionValue, optionLabel]) => (
                    <option key={optionValue || "all"} value={optionValue}>
                        {optionLabel}
                    </option>
                ))}
            </select>
        </label>
    );
}
