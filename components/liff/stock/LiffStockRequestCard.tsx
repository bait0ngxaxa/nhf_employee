"use client";

import { Ban, Eye, PackageCheck } from "lucide-react";
import type { ReactElement } from "react";

import { RequestStatusBadge } from "@/components/dashboard/shared/RequestStatusBadge";
import { formatStockRequestDate } from "@/components/dashboard/stock/stockRequest.shared";
import { Button } from "@/components/ui/button";
import type {
    LiffStockRequestAction,
    LiffStockRequestSummary,
} from "@/lib/types/stock-liff";

interface LiffStockRequestCardProps {
    request: LiffStockRequestSummary;
    showRequester?: boolean;
    showCurrentQuantity?: boolean;
    busy?: boolean;
    onOpenDetail: (requestId: number) => void;
    onAction: (
        action: LiffStockRequestAction,
        request: LiffStockRequestSummary,
    ) => void;
}

export function LiffStockRequestCard({
    request,
    showRequester = false,
    showCurrentQuantity = false,
    busy = false,
    onOpenDetail,
    onAction,
}: LiffStockRequestCardProps): ReactElement {
    return (
        <article className="rounded-2xl bg-surface-raised p-4 shadow-sm ring-1 ring-border-subtle">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="text-base font-bold tabular-nums text-content-heading">
                        คำขอ #{request.id}
                    </h3>
                    <p className="mt-0.5 text-xs leading-5 text-content-muted">
                        {formatStockRequestDate(request.createdAt)}
                    </p>
                </div>
                <RequestStatusBadge status={request.status} />
            </div>

            <dl className="mt-3 grid gap-2 text-sm">
                <div className="flex items-start gap-2">
                    <dt className="shrink-0 text-content-muted">โครงการ</dt>
                    <dd className="min-w-0 break-all font-semibold text-content-strong">
                        {request.projectCode}
                    </dd>
                </div>
                {showRequester && request.requester ? (
                    <div className="flex items-start gap-2">
                        <dt className="shrink-0 text-content-muted">ผู้เบิก</dt>
                        <dd className="min-w-0 break-words font-semibold text-content-strong">
                            {request.requester.name}
                        </dd>
                    </div>
                ) : null}
            </dl>

            <div className="mt-3 space-y-2">
                {request.items.map((item, index) => (
                    <div
                        key={`${item.itemSku}-${item.variantSku ?? "default"}-${index}`}
                        className="rounded-xl bg-surface-subtle px-3 py-2.5"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <p className="break-words text-sm font-semibold leading-6 text-content-strong">
                                    {item.itemName}
                                </p>
                                {item.variantLabel || item.variantSku ? (
                                    <p className="break-words text-xs leading-5 text-content-muted">
                                        {item.variantLabel || item.variantSku}
                                    </p>
                                ) : null}
                            </div>
                            <span className="shrink-0 rounded-full bg-surface-raised px-2 py-1 text-xs font-bold tabular-nums text-content-secondary ring-1 ring-border-subtle">
                                {item.quantity} {item.unit}
                            </span>
                        </div>
                        {showCurrentQuantity ? (
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

            {request.note || request.cancelReason ? (
                <div className="mt-3 rounded-xl bg-surface-subtle px-3 py-2 text-sm leading-6 text-content-secondary">
                    {request.cancelReason
                        ? `เหตุผลยกเลิก: ${request.cancelReason}`
                        : `หมายเหตุ: ${request.note}`}
                </div>
            ) : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onOpenDetail(request.id)}
                    className="min-h-11 rounded-xl px-3"
                >
                    <Eye className="size-4" aria-hidden="true" />
                    รายละเอียด
                </Button>
                {request.availableActions.map((action) => (
                    <Button
                        key={action}
                        type="button"
                        variant={action === "ISSUE" ? "default" : "outline"}
                        onClick={() => onAction(action, request)}
                        disabled={busy}
                        className={
                            action === "ISSUE"
                                ? "min-h-11 rounded-xl bg-status-success-solid px-3 font-bold text-content-on-brand hover:bg-status-success-solid-hover"
                                : "min-h-11 rounded-xl border-status-danger-border px-3 font-bold text-status-danger-foreground hover:bg-status-danger-surface"
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
        </article>
    );
}
