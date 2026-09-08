import { StockRequestStatus } from "@prisma/client";

import type {
    LiffStockRequestAction,
    LiffStockViewerRole,
} from "../contracts/liff";

export function getStockRequestActions(
    status: StockRequestStatus,
    viewerRole: LiffStockViewerRole,
): LiffStockRequestAction[] {
    if (status !== StockRequestStatus.PENDING_ISSUE) {
        return [];
    }

    return viewerRole === "PROCESSOR" ? ["ISSUE", "CANCEL"] : ["CANCEL"];
}
