import { after } from "next/server";

import { processOutbox } from "@/lib/services/outbox/processor";

export function scheduleITTicketOutboxWakeup(): void {
    after(() => {
        processOutbox().catch((error: unknown) =>
            console.error("IT Ticket outbox processing failed", {
                errorType: error instanceof Error ? error.name : "UnknownError",
            }),
        );
    });
}
