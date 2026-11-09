import { after } from "next/server";

import { processOutbox } from "@/lib/services/outbox/processor";

/*
 * In-process single-flight for IT mutation wakeups.
 *
 * Assumption: production runs exactly one Next.js process
 * (docs/operations/production-deployment.md, "Process topology"). This state is
 * per process, so it only coalesces wakeups inside that process. With several
 * processes the database claim in processOutbox still prevents two workers from
 * dispatching the same row, but wakeup loops would no longer be coalesced.
 */
let activeRun: Promise<void> | null = null;
let rerunRequested = false;

function logWakeupFailure(error: unknown): void {
    const rawErrorType = error instanceof Error ? error.name : "UnknownError";
    const errorType = /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(rawErrorType)
        ? rawErrorType
        : "UnknownError";
    console.error("IT Ticket outbox processing failed", { errorType });
}

function startRun(): Promise<void> {
    const run = (async (): Promise<void> => {
        do {
            rerunRequested = false;
            try {
                await processOutbox();
            } catch (error) {
                logWakeupFailure(error);
            }
        } while (rerunRequested);
        // Cleared in the same synchronous step as the final rerun check, so a
        // request arriving after that check always starts a new run.
        activeRun = null;
    })();
    activeRun = run;
    return run;
}

/**
 * Runs processOutbox, or, when a wakeup run is already in flight, marks that a
 * further pass is needed and returns the in-flight run. Never rejects.
 */
export function runITTicketOutboxWakeup(): Promise<void> {
    if (activeRun) {
        rerunRequested = true;
        return activeRun;
    }
    return startRun();
}

export function scheduleITTicketOutboxWakeup(): void {
    after(() => runITTicketOutboxWakeup());
}
