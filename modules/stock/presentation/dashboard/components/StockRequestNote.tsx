import { CheckCircle } from "lucide-react";
import type { StockRequest } from "../context/types";
import { getEmployeeBackedUserDisplayName } from "@/lib/helpers/employee-helpers";
import { formatStockRequestDate } from "./stockRequest.shared";

/**
 * Renders a contextual callout for processed stock requests.
 * - ISSUED  → green callout with issuer + date
 * - CANCELLED / REJECTED_LEGACY with reason → amber callout with reason
 * - Otherwise → null
 */
export function StockRequestNote({ request }: { request: StockRequest }) {
    if (request.status === "ISSUED" && request.issuedAt) {
        return (
            <div className="flex items-start gap-1.5 rounded-lg border border-status-success-border bg-status-success-surface px-2.5 py-1.5">
                <CheckCircle className="mt-px h-3.5 w-3.5 shrink-0 text-status-success-icon" aria-hidden="true" />
                <p className="text-xs text-status-success-strong">
                    <span className="font-semibold">จ่ายโดย: </span>
                    {request.issuer
                        ? getEmployeeBackedUserDisplayName(request.issuer, "-")
                        : "-"}
                    <br />
                    <span className="font-semibold">เมื่อ: </span>
                    {formatStockRequestDate(request.issuedAt)}
                </p>
            </div>
        );
    }

    const isCancelledWithReason =
        (request.status === "CANCELLED" || request.status === "REJECTED_LEGACY") &&
        request.cancelReason;

    if (isCancelledWithReason) {
        return (
            <div className="flex items-start gap-1.5 rounded-lg border border-status-warning-border bg-status-warning-surface px-2.5 py-1.5">
                <span className="mt-px shrink-0 text-status-warning-icon" aria-hidden="true">⚠</span>
                <p className="text-xs text-status-warning-strong">
                    <span className="font-semibold">หมายเหตุยกเลิก: </span>
                    {request.cancelReason}
                </p>
            </div>
        );
    }

    return null;
}
