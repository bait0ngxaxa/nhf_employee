import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    isRetryableTransactionError,
    runSerializableTransaction,
} from "@/lib/db/transaction";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
    },
}));

describe("shared transaction helpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.spyOn(Math, "random").mockReturnValue(0.5);
    });

    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it("retries a P2034 conflict and resolves on the next attempt", async () => {
        vi.useFakeTimers();
        const conflict = { code: "P2034" };
        vi.mocked(prisma.$transaction)
            .mockRejectedValueOnce(conflict)
            .mockResolvedValueOnce("done" as never);

        const resultPromise = runSerializableTransaction(async () => "done");
        await vi.advanceTimersByTimeAsync(28);

        await expect(resultPromise).resolves.toBe("done");
        expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it("uses bounded exponential retry delays with jitter", async () => {
        vi.useFakeTimers();
        const delays: number[] = [];
        const originalSetTimeout = globalThis.setTimeout;
        vi.spyOn(globalThis, "setTimeout").mockImplementation((handler, timeout) => {
            delays.push(Number(timeout));
            return originalSetTimeout(handler, timeout);
        });
        vi.mocked(prisma.$transaction).mockRejectedValue({ code: "P2034" });

        const resultPromise = runSerializableTransaction(async () => "done");
        const resultExpectation = expect(resultPromise).rejects.toMatchObject({
            code: "P2034",
        });
        await vi.advanceTimersByTimeAsync(1_000);

        await resultExpectation;
        expect(prisma.$transaction).toHaveBeenCalledTimes(4);
        expect(delays).toEqual([28, 55, 110]);
        expect(Math.max(...delays)).toBeLessThanOrEqual(200);
    });

    it.each([
        ["P2034 object", { code: "P2034" }, true],
        ["different Prisma code", { code: "P2002" }, false],
        ["business conflict", { statusCode: 409 }, false],
        ["ordinary error", new Error("database unavailable"), false],
    ])(
        "classifies retryable transaction errors: %s",
        (_label, error, expected) => {
            expect(isRetryableTransactionError(error)).toBe(expected);
        },
    );

    it.each([
        ["400", { statusCode: 400 }],
        ["403", { statusCode: 403 }],
        ["404", { statusCode: 404 }],
        ["409", { statusCode: 409 }],
        ["non-P2034", new Error("database unavailable")],
    ])("does not retry a business or unrelated %s error", async (_label, error) => {
        vi.mocked(prisma.$transaction).mockRejectedValue(error);

        await expect(runSerializableTransaction(async () => "done")).rejects.toBe(error);
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it("throws the final P2034 error after the retry limit", async () => {
        vi.useFakeTimers();
        const finalConflict = { code: "P2034", attempt: 4 };
        vi.mocked(prisma.$transaction).mockRejectedValue(finalConflict);

        const resultPromise = runSerializableTransaction(async () => "done");
        const resultExpectation = expect(resultPromise).rejects.toBe(finalConflict);
        await vi.advanceTimersByTimeAsync(1_000);

        await resultExpectation;
        expect(prisma.$transaction).toHaveBeenCalledTimes(4);
    });
});
