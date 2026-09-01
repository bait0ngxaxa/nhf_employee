"use client";

import { AlertTriangle, Check, RotateCcw, X } from "lucide-react";
import type { ReactElement } from "react";

import { RequestStatusBadge } from "@/components/dashboard/shared/RequestStatusBadge";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { formatThaiDateTimeWithTimeWord } from "@/lib/helpers/date-helpers";
import type {
    ApproverLeaveAction,
    EmployeeLeaveAction,
    LiffLeaveRequestDetail as LiffLeaveRequestDetailData,
} from "@/lib/types/leave";

import { LiffLeaveAttachments } from "./LiffLeaveAttachments";
import {
    formatLeaveDateRange,
    formatLeaveDays,
    getLeavePeriodLabel,
    getLeaveTypeLabel,
} from "./leave-format";

export type LiffLeaveAvailableAction = EmployeeLeaveAction | ApproverLeaveAction;

interface LiffLeaveRequestDetailProps {
    detail: LiffLeaveRequestDetailData | null;
    actionIntent?: string | null;
    onOpenChange: (open: boolean) => void;
    onAction: (action: LiffLeaveAvailableAction, detail: LiffLeaveRequestDetailData) => void;
}

export function LiffLeaveRequestDetail({
    detail,
    actionIntent,
    onOpenChange,
    onAction,
}: LiffLeaveRequestDetailProps): ReactElement {
    const hasAuthorizedApproveIntent = Boolean(
        actionIntent === "approve"
        && detail?.viewerRole === "APPROVER"
        && detail.availableActions.includes("APPROVE"),
    );

    return (
        <Sheet open={detail !== null} onOpenChange={onOpenChange}>
            <SheetContent
                side="bottom"
                scrollMode="content"
                closeButtonLabel="ปิดรายละเอียดคำขอลา"
                className="max-h-[92vh] supports-[height:100dvh]:max-h-[92dvh] gap-0 scroll-pb-28 rounded-t-xl border-0 p-0 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2"
            >
                {detail ? (
                    <>
                        <SheetHeader className="sticky top-0 z-20 shrink-0 border-b border-border-subtle bg-surface px-5 pb-4 pt-5 pr-16 text-left">
                            <div className="flex flex-wrap items-center gap-2">
                                <SheetTitle className="text-xl font-bold tracking-tight text-content-heading">
                                    {getLeaveTypeLabel(detail.leaveType)}
                                </SheetTitle>
                                <RequestStatusBadge status={detail.status} />
                            </div>
                            <SheetDescription className="leading-6 text-content-secondary">
                                {formatLeaveDateRange(detail.startDate, detail.endDate)} · {getLeavePeriodLabel(detail.period)} · {formatLeaveDays(detail.durationDays)} วัน
                            </SheetDescription>
                        </SheetHeader>
                        <div className="space-y-5 bg-surface-subtle px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
                            {hasAuthorizedApproveIntent ? (
                                <div
                                    role="status"
                                    className="flex items-start gap-2 rounded-xl border border-status-warning-border bg-status-warning-surface px-3 py-3 text-sm leading-6 text-status-warning-strong"
                                >
                                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                                    เปิดจากลิงก์เพื่อพิจารณา กรุณาตรวจรายละเอียดและกดยืนยันด้วยตนเอง
                                </div>
                            ) : null}
                            <section className="space-y-4 rounded-2xl bg-surface p-4 shadow-sm">
                                {detail.employee ? (
                                    <DetailRow
                                        label="พนักงาน"
                                        value={`${detail.employee.firstName} ${detail.employee.lastName}${detail.employee.nickname ? ` (${detail.employee.nickname})` : ""}`}
                                    />
                                ) : null}
                                <DetailRow label="เหตุผล" value={detail.reason} />
                                {detail.emergencyReason ? (
                                    <DetailRow label="เหตุผลในการลาย้อนหลัง" value={detail.emergencyReason} tone="warning" />
                                ) : null}
                                {detail.specialReason ? (
                                    <DetailRow label="เหตุผลพิเศษ" value={detail.specialReason} tone="warning" />
                                ) : null}
                                {detail.overQuotaDays > 0 ? (
                                    <DetailRow label="เกินสิทธิ์" value={`${formatLeaveDays(detail.overQuotaDays)} วัน`} tone="warning" />
                                ) : null}
                                {detail.rejectReason ? (
                                    <DetailRow label="เหตุผลที่ไม่อนุมัติ" value={detail.rejectReason} tone="danger" />
                                ) : null}
                                {detail.notTakenReason ? (
                                    <DetailRow label="แจ้งไม่ได้ใช้วันลา" value={detail.notTakenReason} />
                                ) : null}
                                {detail.cancellationReason ? (
                                    <DetailRow label="เหตุผลขอยกเลิก" value={detail.cancellationReason} />
                                ) : null}
                                <DetailRow
                                    label="ส่งคำขอเมื่อ"
                                    value={formatThaiDateTimeWithTimeWord(detail.createdAt)}
                                />
                                <LiffLeaveAttachments attachments={detail.attachments} />
                            </section>
                            {detail.availableActions.length > 0 ? (
                                <section className="space-y-2" aria-label="การดำเนินการคำขอลา">
                                    {detail.availableActions.map((action) => (
                                        <ActionButton
                                            key={action}
                                            action={action}
                                            emphasized={hasAuthorizedApproveIntent && action === "APPROVE"}
                                            onClick={() => onAction(action, detail)}
                                        />
                                    ))}
                                </section>
                            ) : null}
                        </div>
                    </>
                ) : null}
            </SheetContent>
        </Sheet>
    );
}

function DetailRow({
    label,
    value,
    tone = "default",
}: {
    label: string;
    value: string;
    tone?: "default" | "warning" | "danger";
}): ReactElement {
    return (
        <div className={tone === "default" ? "" : "rounded-xl border border-status-warning-border bg-status-warning-surface px-3 py-2"}>
            <p className="text-xs font-semibold leading-5 text-content-muted">{label}</p>
            <p className={`mt-0.5 break-words text-sm leading-6 ${tone === "danger" ? "text-status-danger-strong" : "text-content-body"}`}>
                {value}
            </p>
        </div>
    );
}

function ActionButton({
    action,
    emphasized,
    onClick,
}: {
    action: LiffLeaveAvailableAction;
    emphasized: boolean;
    onClick: () => void;
}): ReactElement {
    const config: Record<LiffLeaveAvailableAction, { label: string; icon: typeof Check; destructive?: boolean }> = {
        CANCEL: { label: "ยกเลิกคำขอลา", icon: X, destructive: true },
        REQUEST_CANCELLATION: { label: "ขอยกเลิกวันลา", icon: X, destructive: true },
        REQUEST_NOT_TAKEN: { label: "แจ้งไม่ได้ใช้วันลา", icon: RotateCcw },
        APPROVE: { label: "อนุมัติ", icon: Check },
        REJECT: { label: "ไม่อนุมัติ", icon: X, destructive: true },
        CONFIRM_NOT_TAKEN: { label: "ยืนยันไม่ได้ใช้วันลา", icon: RotateCcw },
        CONFIRM_CANCELLATION: { label: "ยืนยันยกเลิกและคืนโควต้า", icon: Check },
        REJECT_CANCELLATION: { label: "ไม่ยืนยันการยกเลิก", icon: X, destructive: true },
    };
    const item = config[action];
    const Icon = item.icon;
    return (
        <Button
            type="button"
            variant={emphasized ? "default" : "outline"}
            className={`min-h-12 w-full justify-start ${emphasized ? "bg-module-leave-solid text-content-on-brand hover:bg-module-leave-solid-hover" : item.destructive ? "border-status-danger-border text-status-danger-strong" : ""}`}
            onClick={onClick}
        >
            <Icon className="size-4" aria-hidden="true" />
            {item.label}
        </Button>
    );
}
