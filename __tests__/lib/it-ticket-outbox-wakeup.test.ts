// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type * as WakeupModule from "@/lib/server/it-ticket-outbox-wakeup";

const mocks = vi.hoisted(() => ({
    after: vi.fn<(callback: () => unknown) => void>(),
    processOutbox: vi.fn<() => Promise<{ processed: number; failed: number }>>(),
}));

vi.mock("next/server", () => ({
    after: mocks.after,
}));

vi.mock("@/lib/services/outbox/processor", () => ({
    processOutbox: mocks.processOutbox,
}));

const RUN_DURATION_MS = 1_000;

// Re-import per test so the module-level single-flight state starts clean.
async function loadWakeup(): Promise<typeof WakeupModule> {
    return import("@/lib/server/it-ticket-outbox-wakeup");
}

function scheduledCallbacks(): Array<() => unknown> {
    return mocks.after.mock.calls.map(([callback]) => callback);
}

describe("IT Ticket outbox wakeup single-flight", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.useFakeTimers();
        mocks.after.mockReset();
        mocks.processOutbox.mockReset();
        mocks.processOutbox.mockImplementation(
            () =>
                new Promise((resolve) => {
                    setTimeout(
                        () => resolve({ processed: 0, failed: 0 }),
                        RUN_DURATION_MS,
                    );
                }),
        );
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("returns the processing promise from the after() callback", async () => {
        const { scheduleITTicketOutboxWakeup } = await loadWakeup();

        scheduleITTicketOutboxWakeup();
        const [callback] = scheduledCallbacks();
        const returned = callback?.();

        expect(returned).toBeInstanceOf(Promise);
        let settled = false;
        void (returned as Promise<void>).then(() => {
            settled = true;
        });
        await vi.advanceTimersByTimeAsync(RUN_DURATION_MS - 1);
        expect(settled).toBe(false);
        await vi.advanceTimersByTimeAsync(1);
        expect(settled).toBe(true);
        expect(mocks.processOutbox).toHaveBeenCalledTimes(1);
    });

    it("coalesces wakeups during an active run into one follow-up pass", async () => {
        const { scheduleITTicketOutboxWakeup } = await loadWakeup();

        scheduleITTicketOutboxWakeup();
        scheduleITTicketOutboxWakeup();
        scheduleITTicketOutboxWakeup();
        const [first, second, third] = scheduledCallbacks().map((callback) =>
            callback() as Promise<void>,
        );

        expect(mocks.processOutbox).toHaveBeenCalledTimes(1);
        expect(second).toBe(first);
        expect(third).toBe(first);

        await vi.advanceTimersByTimeAsync(RUN_DURATION_MS);
        expect(mocks.processOutbox).toHaveBeenCalledTimes(2);

        await vi.advanceTimersByTimeAsync(RUN_DURATION_MS);
        await first;
        expect(mocks.processOutbox).toHaveBeenCalledTimes(2);
    });

    it("starts a fresh run for a wakeup that arrives after the previous run finished", async () => {
        const { runITTicketOutboxWakeup } = await loadWakeup();

        const first = runITTicketOutboxWakeup();
        await vi.advanceTimersByTimeAsync(RUN_DURATION_MS);
        await first;

        const second = runITTicketOutboxWakeup();
        expect(second).not.toBe(first);
        expect(mocks.processOutbox).toHaveBeenCalledTimes(2);
        await vi.advanceTimersByTimeAsync(RUN_DURATION_MS);
        await second;
        expect(mocks.processOutbox).toHaveBeenCalledTimes(2);
    });

    it("logs a sanitized failure, never rejects, and still honors a pending rerun", async () => {
        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        mocks.processOutbox.mockImplementationOnce(
            () =>
                new Promise((_resolve, reject) => {
                    setTimeout(
                        () => reject(new TypeError("secret-token leaked")),
                        RUN_DURATION_MS,
                    );
                }),
        );
        const { runITTicketOutboxWakeup } = await loadWakeup();

        const first = runITTicketOutboxWakeup();
        void runITTicketOutboxWakeup();
        await vi.advanceTimersByTimeAsync(RUN_DURATION_MS * 2);

        await expect(first).resolves.toBeUndefined();
        expect(mocks.processOutbox).toHaveBeenCalledTimes(2);
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            "IT Ticket outbox processing failed",
            { errorType: "TypeError" },
        );
        expect(JSON.stringify(consoleErrorSpy.mock.calls)).not.toContain(
            "secret-token",
        );
    });
});
