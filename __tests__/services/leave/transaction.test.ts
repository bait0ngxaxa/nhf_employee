import { describe, expect, it, vi } from "vitest";

import {
    lockEmployeeRows,
    lockLeaveRequestRow,
} from "@/lib/services/leave/transaction";

type QueryRawMock = ReturnType<typeof vi.fn>;

describe("leave transaction helpers", () => {
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
