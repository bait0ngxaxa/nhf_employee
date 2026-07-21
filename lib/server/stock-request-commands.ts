import { after } from "next/server";

import {
    stockService,
    type CancelRequestOptions,
    type StockCommandActor,
} from "@/lib/services/stock";
import { processOutbox } from "@/lib/services/outbox/processor";

type IssueStockRequestCommand = {
    requestId: number;
    actor: StockCommandActor;
};

type CancelStockRequestCommand = IssueStockRequestCommand & {
    reason?: string | null;
    options: CancelRequestOptions;
};

type IssuedStockRequest = Awaited<
    ReturnType<typeof stockService.issueRequest>
>["request"];

type CancelledStockRequest = Awaited<
    ReturnType<typeof stockService.cancelRequest>
>;

function wakeOutboxProcessor(): void {
    after(() => {
        processOutbox().catch((error) =>
            console.error("Outbox processor failed:", error),
        );
    });
}

export async function executeIssueStockRequest(
    command: IssueStockRequestCommand,
): Promise<IssuedStockRequest> {
    const result = await stockService.issueRequest(
        command.requestId,
        command.actor,
    );
    wakeOutboxProcessor();
    return result.request;
}

export async function executeCancelStockRequest(
    command: CancelStockRequestCommand,
): Promise<CancelledStockRequest> {
    return stockService.cancelRequest(
        command.requestId,
        command.actor,
        command.reason,
        command.options,
    );
}
