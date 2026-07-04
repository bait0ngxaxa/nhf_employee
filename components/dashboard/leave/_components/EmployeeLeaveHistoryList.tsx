import { CalendarClock, Clock, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Pagination } from "@/components/Pagination";
import type { LeaveRequest } from "@/hooks/useLeaveProfile";
import { formatThaiDateTimeWithTimeWord } from "@/lib/helpers/date-helpers";
import { isAfterLeaveEnd } from "@/lib/services/leave/utils";
import { LeaveStatusBadge } from "./LeaveStatusBadge";

interface LeaveHistoryMetadata {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    itemsPerPage: number;
}

interface EmployeeLeaveHistoryListProps {
    history: LeaveRequest[];
    metadata?: LeaveHistoryMetadata;
    isSubmitting: boolean;
    onCancelRequest: (leaveId: string) => void;
    onNotTakenRequest: (leaveId: string) => void;
    onPageChange: (page: number) => void;
}

const leaveTypeLabel = (leaveType: LeaveRequest["leaveType"]): string => {
    if (leaveType === "SICK") return "ลาป่วย";
    if (leaveType === "PERSONAL") return "ลากิจ";
    return "ลาพักร้อน";
};

const periodLabel = (period: LeaveRequest["period"]): string => {
    if (period === "FULL_DAY") return "เต็มวัน";
    if (period === "MORNING") return "ช่วงเช้า";
    return "ช่วงบ่าย";
};

export function EmployeeLeaveHistoryList({
    history,
    metadata,
    isSubmitting,
    onCancelRequest,
    onNotTakenRequest,
    onPageChange,
}: EmployeeLeaveHistoryListProps) {
    if (history.length === 0) {
        return <EmptyLeaveHistory />;
    }

    return (
        <div className="space-y-3">
            {history.map((request) => (
                <LeaveHistoryItem
                    key={request.id}
                    request={request}
                    isSubmitting={isSubmitting}
                    onCancelRequest={onCancelRequest}
                    onNotTakenRequest={onNotTakenRequest}
                />
            ))}

            {metadata && metadata.totalPages > 1 ? (
                <div className="pt-4">
                    <Pagination
                        currentPage={metadata.currentPage}
                        totalPages={metadata.totalPages}
                        itemsPerPage={metadata.itemsPerPage}
                        onPageChange={onPageChange}
                        onPreviousPage={() => onPageChange(Math.max(1, metadata.currentPage - 1))}
                        onNextPage={() => onPageChange(Math.min(metadata.totalPages, metadata.currentPage + 1))}
                    />
                </div>
            ) : null}
        </div>
    );
}

function LeaveHistoryItem({
    request,
    isSubmitting,
    onCancelRequest,
    onNotTakenRequest,
}: {
    request: LeaveRequest;
    isSubmitting: boolean;
    onCancelRequest: (leaveId: string) => void;
    onNotTakenRequest: (leaveId: string) => void;
}) {
    return (
        <Card className="border-slate-200 p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base/6 font-semibold tracking-tight text-slate-950">
                            {leaveTypeLabel(request.leaveType)}
                        </h3>
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs/5 font-medium text-slate-700">
                            {periodLabel(request.period)} ({request.durationDays} วัน)
                        </span>
                    </div>
                    <p className="flex flex-wrap items-center gap-1.5 text-sm/6 font-medium text-slate-600">
                        <CalendarClock className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        <span>{formatLeaveDateRange(request.startDate, request.endDate)}</span>
                    </p>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs/5 font-medium text-slate-500">
                        <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                        <span>ยื่นคำขอเมื่อ {formatThaiDateTimeWithTimeWord(request.createdAt)}</span>
                    </p>
                    <LeaveNote label="เหตุผล" text={request.reason} />
                    {request.status === "REJECTED" && request.rejectReason ? (
                        <LeaveNote tone="danger" label="เหตุผลที่ไม่อนุมัติ" text={request.rejectReason} />
                    ) : null}
                    {request.emergencyReason ? (
                        <LeaveNote tone="info" label="เหตุผลฉุกเฉิน" text={request.emergencyReason} />
                    ) : null}
                    {request.specialReason ? (
                        <LeaveNote tone="warning" label="เหตุผลพิเศษ" text={request.specialReason} />
                    ) : null}
                    {request.notTakenRequestedAt && request.status === "APPROVED" ? (
                        <LeaveNote tone="info" label="รอหัวหน้ายืนยันไม่ได้ใช้วันลา" text={request.notTakenReason ?? "-"} />
                    ) : null}
                    {request.status === "NOT_TAKEN" && request.notTakenReason ? (
                        <LeaveNote tone="info" label="ไม่ได้ใช้วันลา" text={request.notTakenReason} />
                    ) : null}
                </div>
                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                    <LeaveStatusBadge status={request.status} />
                    {request.status === "PENDING" ? (
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                            disabled={isSubmitting}
                            onClick={() => onCancelRequest(request.id)}
                        >
                            <X className="h-4 w-4" aria-hidden="true" />
                            ยกเลิก
                        </Button>
                    ) : null}
                    {canRequestNotTaken(request) ? (
                        <Button
                            variant="outline"
                            size="sm"
                            className="border-cyan-200 text-cyan-700 hover:bg-cyan-50 hover:text-cyan-800"
                            disabled={isSubmitting}
                            onClick={() => onNotTakenRequest(request.id)}
                        >
                            <RotateCcw className="h-4 w-4" aria-hidden="true" />
                            แจ้งไม่ได้ใช้วันลา
                        </Button>
                    ) : null}
                </div>
            </div>
        </Card>
    );
}

function LeaveNote({
    label,
    text,
    tone = "neutral",
}: {
    label: string;
    text: string;
    tone?: "neutral" | "danger" | "info" | "warning";
}) {
    const toneClassName = {
        neutral: "border-slate-200 bg-slate-50 text-slate-700",
        danger: "border-rose-200 bg-rose-50 text-rose-800",
        info: "border-sky-200 bg-sky-50 text-sky-800",
        warning: "border-amber-200 bg-amber-50 text-amber-800",
    }[tone];

    return (
        <p className={`rounded-lg border px-3 py-2 text-sm/6 ${toneClassName}`}>
            <span className="font-medium">{label}: </span>
            <span className="break-words">{text}</span>
        </p>
    );
}

function EmptyLeaveHistory() {
    return (
        <Card className="border-dashed border-slate-300 p-8 text-center shadow-none">
            <p className="text-base/6 font-semibold text-slate-900">ยังไม่มีประวัติการยื่นคำขอลา</p>
            <p className="mt-1 text-sm/6 text-slate-500">
                เมื่อส่งคำขอแล้ว รายการและสถานะจะแสดงที่นี่
            </p>
        </Card>
    );
}

function formatLeaveDateRange(startDate: string, endDate: string): string {
    const formatter = new Intl.DateTimeFormat("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
    const start = formatter.format(new Date(startDate));

    if (startDate === endDate) {
        return start;
    }

    return `${start} - ${formatter.format(new Date(endDate))}`;
}

function canRequestNotTaken(request: LeaveRequest): boolean {
    return (
        request.status === "APPROVED"
        && !request.notTakenRequestedAt
        && isAfterLeaveEnd(new Date(request.endDate))
    );
}
