import type { Prisma } from "@prisma/client";
import { mockDeep } from "vitest-mock-extended";
import { describe, expect, it } from "vitest";

import { lockStockInventoryRows } from "@/lib/services/stock/locks";

function rawQueryText(call: readonly unknown[]): string {
    const [template] = call;
    if (
        !Array.isArray(template)
        || !template.every((part) => typeof part === "string")
    ) {
        throw new Error("Expected a tagged-template raw query");
    }

    return template.join("?");
}

describe("Stock inventory row locks", () => {
    it("should quote the variant foreign key with MySQL backticks", async () => {
        const tx = mockDeep<Prisma.TransactionClient>();

        await lockStockInventoryRows(tx, [20, 10, 20]);

        expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
        const variantQuery = rawQueryText(tx.$queryRaw.mock.calls[1]);
        expect(variantQuery).toContain("WHERE `stockItemId` IN");
        expect(variantQuery).not.toContain('WHERE "stockItemId" IN');
    });
});
