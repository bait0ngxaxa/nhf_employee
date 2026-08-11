"use client";

import type { ReactNode } from "react";
import { RequestStatusBadge } from "@/components/dashboard/shared/RequestStatusBadge";
import type { StockRequest } from "../context/stock/types";
import {
    formatStockRequestDate,
} from "./stockRequest.shared";
import { getRequestItemDisplayName } from "./stockVariant.shared";
import { StockRequestNote } from "./StockRequestNote";
import { getEmployeeBackedUserDisplayName } from "@/lib/helpers/employee-helpers";

type StockRequestMobileCardsProps = {
    requests: StockRequest[];
    showRequester?: boolean;
    renderActions?: (request: StockRequest) => ReactNode;
};

export function StockRequestMobileCards({
    requests,
    showRequester = false,
    renderActions,
}: StockRequestMobileCardsProps) {
    return (
        <div className="space-y-3 xl:hidden">
            {requests.map((request) => (
                <article
                    key={request.id}
                    className="rounded-2xl border border-border-subtle bg-surface-raised p-4 shadow-sm"
                >
                    <div className="flex items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold text-content-strong">
                                คำขอ #{request.id}
                            </div>
                            <div className="text-xs text-content-muted">
                                {formatStockRequestDate(request.createdAt)}
                            </div>
                        </div>
                        <RequestStatusBadge status={request.status} />
                    </div>

                    <div className="mt-3 grid gap-2 text-sm">
                        <InfoRow label="รหัสโครงการ" value={request.projectCode} />
                        {showRequester ? (
                            <InfoRow
                                label="ผู้เบิก"
                                value={`${getEmployeeBackedUserDisplayName(request.requester)} (${request.requester.email})`}
                            />
                        ) : null}
                    </div>

                    <div className="mt-3 space-y-1.5">
                        <div className="text-xs font-semibold text-content-muted">
                            รายการ
                        </div>
                        {request.items.map((item) => (
                            <div
                                key={item.id}
                                className="flex flex-wrap items-start gap-x-2 gap-y-1 rounded-xl bg-surface-subtle px-3 py-2 text-sm"
                            >
                                <span className="font-medium text-content-strong">
                                    {getRequestItemDisplayName(item)}
                                </span>
                                <span className="shrink-0 rounded-full bg-surface-raised px-2 py-0.5 text-xs font-medium text-content-secondary ring-1 ring-border-subtle">
                                    x {item.quantity} {item.variant?.unit ?? item.item.unit}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-3">
                        <StockRequestNote request={request} />
                    </div>

                    {renderActions ? (
                        <div className="mt-4 flex flex-wrap justify-end gap-2">
                            {renderActions(request)}
                        </div>
                    ) : null}
                </article>
            ))}
        </div>
    );
}

function InfoRow({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex gap-2">
            <span className="shrink-0 text-content-muted">{label}:</span>
            <span className="min-w-0 font-medium text-content-strong [overflow-wrap:anywhere]">
                {value}
            </span>
        </div>
    );
}
