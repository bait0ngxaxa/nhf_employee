import { after } from "next/server";

import { processOutbox } from "@/lib/services/outbox/processor";

export function scheduleITTicketOutboxWakeup(): void {
    after(() => {
        processOutbox().catch((error: unknown) => {
            const rawErrorType = error instanceof Error ? error.name : "UnknownError";
            const errorType = /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(rawErrorType)
                ? rawErrorType
                : "UnknownError";
            console.error("IT Ticket outbox processing failed", { errorType });
        });
    });
}
