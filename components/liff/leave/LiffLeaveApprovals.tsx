import {
    AlertTriangle,
    Check,
    ChevronLeft,
    ChevronRight,
    Paperclip,
    RotateCcw,
    X,
} from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import type {
    ApproverLeaveAction,
    LiffLeaveApprovalItem,
    LiffLeaveApprovalsResponse,
    LeavePaginationMetadata,
} from "@/lib/types/leave";

import {
    formatLeaveDateRange,
    formatLeaveDays,
    getLeavePeriodLabel,
    getLeaveTypeLabel,
} from "./leave-format";

interface LiffLeaveApprovalsProps {
    approvals: LiffLeaveApprovalsResponse;
    isLoading: boolean;
    onOpenDetail: (requestId: string) => void;
    onAction: (action: ApproverLeaveAction, request: LiffLeaveApprovalItem) => void;
    onPageChange: (
        category: "pending" | "notTakenPending" | "cancellationPending",
        page: number,
    ) => void;
}

export function LiffLeaveApprovals({
    approvals,
    isLoading,
    onOpenDetail,
    onAction,
    onPageChange,
}: LiffLeaveApprovalsProps): ReactElement {
    const total = approvals.metadata.pending.totalItems
        + approvals.metadata.notTakenPending.totalItems
        + approvals.metadata.cancellationPending.totalItems;

    if (total === 0) {
        return (
            <div className="rounded-2xl border border-status-success-border bg-status-success-surface px-5 py-8 text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-status-success-surface-strong text-status-success-strong">
                    <Check className="size-6" aria-hidden="true" />
                </div>
                <h2 className="mt-3 font-bold text-status-success-strong">
                    ไม่มีรายการรอพิจารณา
                </h2>
                <p className="mt-1 text-sm leading-6 text-content-secondary">
                    คุณดำเนินการรายการที่ได้รับมอบหมายครบแล้ว
                </p>
            </div>
        );
    }

    return (
        <div className={`space-y-6 ${isLoading ? "opacity-60" : ""}`} aria-busy={isLoading}>
            <ApprovalSection
                title="รออนุมัติคำขอลา"
                description="ตรวจรายละเอียดก่อนอนุมัติหรือไม่อนุมัติ"
                items={approvals.pending}
                metadata={approvals.metadata.pending}
                disabled={isLoading}
                category="pending"
                onOpenDetail={onOpenDetail}
                onAction={onAction}
                onPageChange={onPageChange}
            />
            <ApprovalSection
                title="รอยืนยันไม่ได้ใช้วันลา"
                description="ยืนยันแล้วระบบจะคืนโควต้าตามคำขอเดิม"
                items={approvals.notTakenPending}
                metadata={approvals.metadata.notTakenPending}
                disabled={isLoading}
                category="notTakenPending"
                onOpenDetail={onOpenDetail}
                onAction={onAction}
                onPageChange={onPageChange}
            />
            <ApprovalSection
                title="รอยืนยันยกเลิกวันลา"
                description="ยืนยันเพื่อยกเลิกและคืนโควต้า หรือปฏิเสธเพื่อคงวันลาเดิม"
                items={approvals.cancellationPending}
                metadata={approvals.metadata.cancellationPending}
                disabled={isLoading}
                category="cancellationPending"
                onOpenDetail={onOpenDetail}
                onAction={onAction}
                onPageChange={onPageChange}
            />
        </div>
    );
}

function ApprovalSection({
    title,
    description,
    items,
    metadata,
    disabled,
    category,
    onOpenDetail,
    onAction,
    onPageChange,
}: {
    title: string;
    description: string;
    items: LiffLeaveApprovalItem[];
    metadata: LeavePaginationMetadata;
    disabled: boolean;
    category: "pending" | "notTakenPending" | "cancellationPending";
    onOpenDetail: (requestId: string) => void;
    onAction: (action: ApproverLeaveAction, request: LiffLeaveApprovalItem) => void;
    onPageChange: LiffLeaveApprovalsProps["onPageChange"];
}): ReactElement | null {
    if (metadata.totalItems === 0) return null;

    return (
        <section className="space-y-3">
            <div>
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-lg font-bold tracking-tight text-content-heading">
                        {title}
                    </h2>
                    <span className="rounded-full bg-module-leave-badge-surface px-2.5 py-1 text-xs font-bold tabular-nums text-module-leave-badge-foreground">
                        {metadata.totalItems}
                    </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-content-secondary">
                    {description}
                </p>
            </div>
            <div className="space-y-3">
                {items.map((item) => (
                    <ApprovalCard
                        key={item.id}
                        item={item}
                        disabled={disabled}
                        onOpenDetail={onOpenDetail}
                        onAction={onAction}
                    />
                ))}
            </div>
            {metadata.totalPages > 1 ? (
                <div className="flex items-center justify-between gap-3 pt-1">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`หน้าก่อนหน้าของ${title}`}
                        disabled={disabled || metadata.currentPage <= 1}
                        onClick={() => onPageChange(category, metadata.currentPage - 1)}
                    >
                        <ChevronLeft aria-hidden="true" />
                    </Button>
                    <span className="text-sm font-semibold tabular-nums text-content-secondary">
                        หน้า {metadata.currentPage} / {metadata.totalPages}
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label={`หน้าถัดไปของ${title}`}
                        disabled={disabled || metadata.currentPage >= metadata.totalPages}
                        onClick={() => onPageChange(category, metadata.currentPage + 1)}
                    >
                        <ChevronRight aria-hidden="true" />
                    </Button>
                </div>
            ) : null}
        </section>
    );
}

function ApprovalCard({
    item,
    disabled,
    onOpenDetail,
    onAction,
}: {
    item: LiffLeaveApprovalItem;
    disabled: boolean;
    onOpenDetail: (requestId: string) => void;
    onAction: (action: ApproverLeaveAction, request: LiffLeaveApprovalItem) => void;
}): ReactElement {
    const employeeName = `${item.employee.firstName} ${item.employee.lastName}${item.employee.nickname ? ` (${item.employee.nickname})` : ""}`;
    const hasWarning = Boolean(
        item.emergencyReason || item.specialReason || item.overQuotaDays > 0,
    );

    return (
        <article className="rounded-2xl bg-surface p-4 shadow-sm">
            <div className="min-w-0">
                <h3 className="break-words font-bold tracking-tight text-content-heading">
                    {employeeName}
                </h3>
                <p className="mt-0.5 break-words text-xs leading-5 text-content-muted">
                    {item.employee.position} · {item.employee.dept?.name ?? "ไม่ระบุแผนก"}
                </p>
            </div>
            <div className="mt-3 rounded-xl bg-module-leave-badge-surface px-3 py-3">
                <p className="font-semibold text-content-heading">
                    {getLeaveTypeLabel(item.leaveType)} · {formatLeaveDays(item.durationDays)} วัน
                </p>
                <p className="mt-1 text-sm leading-6 text-content-secondary">
                    {formatLeaveDateRange(item.startDate, item.endDate)} · {getLeavePeriodLabel(item.period)}
                </p>
            </div>
            <p className="mt-3 line-clamp-3 break-words text-sm leading-6 text-content-body">
                {item.reason}
            </p>
            {hasWarning ? (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-status-warning-border bg-status-warning-surface px-3 py-2 text-xs font-medium leading-5 text-status-warning-strong">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {item.overQuotaDays > 0
                        ? `มีเงื่อนไขพิเศษและเกินสิทธิ์ ${formatLeaveDays(item.overQuotaDays)} วัน`
                        : "มีเหตุผลฉุกเฉินหรือเหตุผลพิเศษ กรุณาตรวจรายละเอียด"}
                </div>
            ) : null}
            {item.attachments.length > 0 ? (
                <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-content-muted">
                    <Paperclip className="size-3.5" aria-hidden="true" />
                    หลักฐาน {item.attachments.length} รูป
                </p>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border-subtle pt-3">
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="col-span-2"
                    disabled={disabled}
                    onClick={() => onOpenDetail(item.id)}
                >
                    ดูรายละเอียด
                </Button>
                {item.availableActions.map((action) => (
                    <ApprovalActionButton
                        key={action}
                        action={action}
                        disabled={disabled}
                        fullWidth={item.availableActions.length === 1}
                        onClick={() => onAction(action, item)}
                    />
                ))}
            </div>
        </article>
    );
}

function ApprovalActionButton({
    action,
    disabled,
    fullWidth,
    onClick,
}: {
    action: ApproverLeaveAction;
    disabled: boolean;
    fullWidth: boolean;
    onClick: () => void;
}): ReactElement {
    const isPositive = action === "APPROVE"
        || action === "CONFIRM_NOT_TAKEN"
        || action === "CONFIRM_CANCELLATION";
    const label: Record<ApproverLeaveAction, string> = {
        APPROVE: "อนุมัติ",
        REJECT: "ไม่อนุมัติ",
        CONFIRM_NOT_TAKEN: "ยืนยันคืนโควต้า",
        CONFIRM_CANCELLATION: "ยืนยันยกเลิก",
        REJECT_CANCELLATION: "ปฏิเสธยกเลิก",
    };
    const Icon = action === "CONFIRM_NOT_TAKEN"
        ? RotateCcw
        : isPositive
            ? Check
            : X;
    return (
        <Button
            type="button"
            size="sm"
            variant={isPositive ? "default" : "outline"}
            className={`${fullWidth ? "col-span-2" : ""} min-h-11 ${isPositive ? "bg-module-leave-solid text-content-on-brand hover:bg-module-leave-solid-hover" : "border-status-danger-border text-status-danger-strong"}`}
            disabled={disabled}
            onClick={onClick}
        >
            <Icon aria-hidden="true" />
            {label[action]}
        </Button>
    );
}
