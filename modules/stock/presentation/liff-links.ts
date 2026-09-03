import { buildLiffUrl } from "@/lib/line/liff-links";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { stockRequestIdParamSchema } from "../schemas/stock";

export type StockLiffAction = "issue" | "review";

export function buildStockLiffUrl(): string {
    return buildLiffUrl(APP_ROUTES.line.stock);
}

export function buildStockLiffRequestUrl(
    requestId: number | string,
    options: { action?: StockLiffAction } = {},
): string {
    const parsedRequestId = stockRequestIdParamSchema.safeParse(String(requestId));
    if (!parsedRequestId.success) {
        throw new Error("Invalid Stock request ID");
    }
    return buildLiffUrl(APP_ROUTES.line.stock, {
        requestId: parsedRequestId.data,
        action: options.action,
    });
}
