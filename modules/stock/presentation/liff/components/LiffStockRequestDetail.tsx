"use client";

import { Ban, Loader2, PackageCheck } from "lucide-react";
import type { ReactElement } from "react";

import { RequestStatusBadge } from "@/components/dashboard/shared/RequestStatusBadge";
import { getStockRequestStatusMeta } from "../../status-meta";
import { formatStockRequestDate } from "../../dashboard/components/stockRequest.shared";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogScrollArea,
    DialogTitle,
} from "@/components/ui/dialog";
import type {
    LiffStockRequestAction,
    LiffStockRequestDetail as LiffStockRequestDetailData,
} from "../../../contracts/liff";

interface LiffStockRequestDetailProps {
    open: boolean;
    detail: LiffStockRequestDetailData | null;
    loading: boolean;
    error: string | null;
    actionIntent: string | null;
    onOpenChange: (open: boolean) => void;
    onAction: (
        action: LiffStockRequestAction,
        request: LiffStockRequestDetailData,
    ) => void;
    canProcessRequests: boolean;
    canCancelOwnRequests: boolean;
    canCancelAnyRequests: boolean;
}

export function LiffStockRequestDetail({
    open,
    detail,
    loading,
    error,
    actionIntent,
    onOpenChange,
    onAction,
    canProcessRequests,
    canCancelOwnRequests,
    canCancelAnyRequests,
}: LiffStockRequestDetailProps): ReactElement {
    const processorIntent = canProcessRequests
        && (actionIntent === "issue" || actionIntent === "review");
    const visibleActions = detail?.availableActions.filter((action) =>
        action === "ISSUE"
            ? canProcessRequests
            : detail.viewerRole === "PROCESSOR"
                ? canCancelAnyRequests
                : canCancelOwnRequests,
    ) ?? [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                closeLabel="ปิดรายละเอียดคำขอ"
                scrollMode="area"
                className="bottom-0 left-0 top-auto max-h-[90vh] supports-[height:100dvh]:max-h-[90dvh] max-w-none translate-x-0 translate-y-0 gap-0 rounded-b-none rounded-t-xl border-x-0 border-b-0 p-0 sm:left-1/2 sm:max-w-lg sm:-translate-x-1/2"
            >
                <div className="shrink-0 border-b border-border-subtle bg-surface-subtle px-4 py-4 pr-12">
                    <DialogTitle className="text-lg leading-7 text-content-heading">
                        {detail ? `รายละเอียดคำขอ #${detail.id}` : "รายละเอียดคำขอเบิก"}
                    </DialogTitle>
                    <DialogDescription className="mt-1 leading-6 text-content-secondary">
                        ตรวจสอบรายการ สถานะ และหมายเหตุของคำขอ
                    </DialogDescription>
                </div>

                <DialogScrollArea className="px-4 py-4 scroll-pb-4">
                    {loading ? (
                        <div className="flex min-h-56 items-center justify-center gap-2 text-sm font-medium text-content-secondary" role="status">
                            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                            กำลังโหลดรายละเอียด…
                        </div>
                    ) : error ? (
                        <div className="min-h-56 border-y border-status-warning-border bg-status-warning-surface p-4 text-sm leading-6 text-status-warning-strong" role="alert">
                            {error}
                        </div>
                    ) : detail ? (
                        <div className="space-y-4">
                            {processorIntent ? (
                                <div className="border-y border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm leading-6 text-status-warning-strong">
                                    เปิดจากลิงก์เพื่อดำเนินการ กรุณาตรวจรายละเอียดและกดยืนยันด้วยตนเอง
                                </div>
                            ) : null}
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <p className="font-bold tabular-nums text-content-heading">
                                        คำขอ #{detail.id}
                                    </p>
                                    <p className="mt-0.5 text-xs leading-5 text-content-muted">
                                        {formatStockRequestDate(detail.createdAt)}
                                    </p>
                                </div>
                                <RequestStatusBadge meta={getStockRequestStatusMeta(detail.status)} />
                            </div>

                            <dl className="grid gap-2 border-y border-border-subtle py-3 text-sm">
                                <div className="flex gap-2">
                                    <dt className="shrink-0 text-content-muted">โครงการ</dt>
                                    <dd className="break-all font-semibold text-content-strong">
                                        {detail.projectCode}
                                    </dd>
                                </div>
                                {detail.requester ? (
                                    <div className="flex gap-2">
                                        <dt className="shrink-0 text-content-muted">ผู้เบิก</dt>
                                        <dd className="break-words font-semibold text-content-strong">
                                            {detail.requester.name}
                                        </dd>
                                    </div>
                                ) : null}
                            </dl>

                            <div className="space-y-2">
                                <h3 className="text-sm font-bold text-content-heading">
                                    รายการที่ขอเบิก
                                </h3>
                                <div className="divide-y divide-border-subtle border-y border-border-subtle">
                                    {detail.items.map((item, index) => (
                                        <div
                                            key={`${item.itemSku}-${item.variantSku ?? "default"}-${index}`}
                                            className="py-3 first:pt-0 last:pb-0"
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="min-w-0">
                                                    <p className="break-words text-sm font-semibold leading-6 text-content-strong">
                                                        {item.itemName}
                                                    </p>
                                                    <p className="break-words text-xs leading-5 text-content-muted">
                                                        {item.variantLabel || item.variantSku || item.itemSku}
                                                    </p>
                                                </div>
                                                <span className="shrink-0 text-sm font-bold tabular-nums text-content-heading">
                                                    {item.quantity} {item.unit}
                                                </span>
                                            </div>
                                            {detail.viewerRole === "PROCESSOR" ? (
                                                <p className={`mt-1 text-xs tabular-nums ${
                                                    item.isAvailableForIssue
                                                        ? "text-status-success-foreground"
                                                        : "text-status-danger-foreground"
                                                }`}>
                                                    คงเหลือจริง {item.currentQuantity ?? "–"} {item.unit}
                                                    {item.isAvailableForIssue ? " · เพียงพอ" : " · ต้องตรวจสอบ"}
                                                </p>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {detail.note || detail.cancelReason ? (
                                <div className="border-t border-border-subtle pt-3 text-sm leading-6 text-content-secondary">
                                    {detail.cancelReason
                                        ? `เหตุผลยกเลิก: ${detail.cancelReason}`
                                        : `หมายเหตุ: ${detail.note}`}
                                </div>
                            ) : null}
                        </div>
                    ) : null}
                </DialogScrollArea>

                {detail && visibleActions.length > 0 ? (
                    <div className="shrink-0 flex gap-2 border-t border-border-subtle bg-surface-raised px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3">
                        {visibleActions.map((action) => (
                            <Button
                                key={action}
                                type="button"
                                variant={action === "ISSUE" ? "default" : "outline"}
                                onClick={() => onAction(action, detail)}
                                className={
                                    action === "ISSUE"
                                        ? "min-h-12 flex-1 bg-status-success-solid font-bold text-content-on-brand hover:bg-status-success-solid-hover"
                                        : "min-h-12 flex-1 border-status-danger-border font-bold text-status-danger-foreground hover:bg-status-danger-surface"
                                }
                            >
                                {action === "ISSUE" ? (
                                    <PackageCheck className="size-4" aria-hidden="true" />
                                ) : (
                                    <Ban className="size-4" aria-hidden="true" />
                                )}
                                {action === "ISSUE" ? "จ่ายวัสดุ" : "ยกเลิกคำขอ"}
                            </Button>
                        ))}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
