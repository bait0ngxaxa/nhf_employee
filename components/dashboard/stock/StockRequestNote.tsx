import { CheckCircle } from "lucide-react";
import type { StockRequest } from "../context/stock/types";
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
            <div className="flex items-start gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5">
                <CheckCircle className="mt-px h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                <p className="text-xs text-emerald-800">
                    <span className="font-semibold">จ่ายโดย: </span>
                    {request.issuer?.name ?? "-"}
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
            <div className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5">
                <span className="mt-px shrink-0 text-amber-500" aria-hidden="true">⚠</span>
                <p className="text-xs text-amber-800">
                    <span className="font-semibold">หมายเหตุยกเลิก: </span>
                    {request.cancelReason}
                </p>
            </div>
        );
    }

    return null;
}
