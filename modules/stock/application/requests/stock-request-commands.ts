import { after } from "next/server";

import {
    cancelRequest,
    issueRequest,
} from "./request-mutations";
import type {
    CancelRequestOptions,
    StockCommandActor,
} from "../../domain/types";
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
    ReturnType<typeof issueRequest>
>["request"];

type CancelledStockRequest = Awaited<
    ReturnType<typeof cancelRequest>
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
    const result = await issueRequest(
        command.requestId,
        command.actor,
    );
    wakeOutboxProcessor();
    return result.request;
}

export async function executeCancelStockRequest(
    command: CancelStockRequestCommand,
): Promise<CancelledStockRequest> {
    return cancelRequest(
        command.requestId,
        command.actor,
        command.reason,
        command.options,
    );
}
