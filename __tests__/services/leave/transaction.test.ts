import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

import { prisma } from "@/lib/db/prisma";
import {
    lockEmployeeRows,
    lockLeaveRequestRow,
    runSerializableTransaction,
} from "@/lib/services/leave/transaction";

vi.mock("@/lib/db/prisma", () => ({
    prisma: {
        $transaction: vi.fn(),
    },
}));

type QueryRawMock = ReturnType<typeof vi.fn>;

describe("leave transaction helpers", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("retries a P2034 conflict and resolves on the next attempt", async () => {
        vi.useFakeTimers();
        const conflict = { code: "P2034" };
        vi.mocked(prisma.$transaction)
            .mockRejectedValueOnce(conflict)
            .mockResolvedValueOnce("done" as never);

        const resultPromise = runSerializableTransaction(async () => "done");
        await vi.advanceTimersByTimeAsync(25);

        await expect(resultPromise).resolves.toBe("done");
        expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    it("uses bounded exponential retry delays", async () => {
        vi.useFakeTimers();
        const delays: number[] = [];
        const originalSetTimeout = globalThis.setTimeout;
        vi.spyOn(globalThis, "setTimeout").mockImplementation((handler, timeout) => {
            delays.push(Number(timeout));
            return originalSetTimeout(handler, timeout);
        });
        vi.mocked(prisma.$transaction).mockRejectedValue({ code: "P2034" });

        const resultPromise = runSerializableTransaction(async () => "done");
        const resultExpectation = expect(resultPromise).rejects.toMatchObject({ code: "P2034" });
        await vi.advanceTimersByTimeAsync(1_000);

        await resultExpectation;
        expect(prisma.$transaction).toHaveBeenCalledTimes(4);
        expect(delays).toEqual([25, 50, 100]);
        expect(Math.max(...delays)).toBeLessThanOrEqual(200);
    });

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

    it("deduplicates and sorts employee IDs before acquiring the row lock", async () => {
        const queryRaw: QueryRawMock = vi.fn().mockResolvedValue([]);
        const tx = { $queryRaw: queryRaw };

        await lockEmployeeRows(tx as never, [4, 2, 4, 1, 2]);

        expect(queryRaw).toHaveBeenCalledTimes(1);
        const values = queryRaw.mock.calls[0][1] as { values: number[] };
        expect(values.values).toEqual([1, 2, 4]);
    });

    it("does not query when there are no employee IDs", async () => {
        const queryRaw: QueryRawMock = vi.fn();

        await lockEmployeeRows({ $queryRaw: queryRaw } as never, []);

        expect(queryRaw).not.toHaveBeenCalled();
    });

    it("locks the requested leave row with the correct ID", async () => {
        const queryRaw: QueryRawMock = vi.fn().mockResolvedValue([]);

        await lockLeaveRequestRow({ $queryRaw: queryRaw } as never, "leave-42");

        expect(queryRaw).toHaveBeenCalledTimes(1);
        expect(queryRaw.mock.calls[0][1]).toBe("leave-42");
    });

    it("fails closed when a transaction client cannot execute raw SQL", async () => {
        await expect(lockEmployeeRows({} as never, [1])).rejects.toThrow();
        await expect(lockLeaveRequestRow({} as never, "leave-1")).rejects.toThrow();
    });
});
