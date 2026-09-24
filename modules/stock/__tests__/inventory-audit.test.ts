import { describe, expect, it } from "vitest";

import {
    classifyStockInventoryAudit,
    determineAuditExitCode,
    type StockInventoryAuditSnapshot,
} from "../domain/inventory-audit";

function createCleanSnapshot(): StockInventoryAuditSnapshot {
    return {
        items: [{
            id: 1,
            sku: "ITEM-1",
            name: "วัสดุทดสอบ",
            defaultVariantId: 11,
            quantity: 5,
            minStock: 1,
            isActive: true,
        }],
        variants: [{
            id: 11,
            stockItemId: 1,
            sku: "VARIANT-11",
            quantity: 5,
            minStock: 1,
            isActive: true,
        }],
        requestItems: [{
            id: 21,
            requestId: 31,
            itemId: 1,
            variantId: 11,
            quantity: 2,
            requestStatus: "ISSUED",
        }],
        transactions: [{
            id: 41,
            itemId: 1,
            variantId: 11,
            type: "OPENING_BALANCE",
            quantity: 5,
        }],
    };
}

describe("stock inventory audit classification", () => {
    it("reports no issues for a consistent inventory snapshot", () => {
        const result = classifyStockInventoryAudit(createCleanSnapshot());

        expect(result.summary).toMatchObject({
            items: 1,
            variants: 1,
            itemsWithoutVariant: 0,
            activeItemsWithoutVariant: 0,
            inactiveItemsWithoutVariant: 0,
            activeItemsWithoutActiveVariant: 0,
            quantityMismatches: 0,
            requestItemsWithoutVariant: 0,
            pendingRequestItemsWithoutVariant: 0,
            transactionsWithoutVariant: 0,
            crossItemReferences: 0,
            defaultVariantInvariantViolations: 0,
            negativeInventoryRecords: 0,
            variantsWithoutLedgerCoverage: 0,
            ledgerDiscrepancies: 0,
        });
        expect(determineAuditExitCode(result, true)).toBe(0);
    });

    it("classifies an active item without a persisted variant as critical", () => {
        const snapshot = createCleanSnapshot();
        snapshot.variants = [];
        snapshot.transactions = [];

        const result = classifyStockInventoryAudit(snapshot);

        expect(result.details.itemsWithoutVariant).toEqual([{
            itemId: 1,
            itemSku: "ITEM-1",
            itemName: "วัสดุทดสอบ",
            isActive: true,
        }]);
        expect(determineAuditExitCode(result, true)).toBe(1);
        expect(determineAuditExitCode(result, false)).toBe(0);
    });

    it("counts inactive items without variants separately without failing strict mode", () => {
        const snapshot = createCleanSnapshot();
        snapshot.items[0].isActive = false;
        snapshot.items[0].defaultVariantId = null;
        snapshot.items[0].quantity = 0;
        snapshot.variants = [];
        snapshot.transactions = [];

        const result = classifyStockInventoryAudit(snapshot);

        expect(result.summary.itemsWithoutVariant).toBe(1);
        expect(result.summary.activeItemsWithoutVariant).toBe(0);
        expect(result.summary.inactiveItemsWithoutVariant).toBe(1);
        expect(determineAuditExitCode(result, true)).toBe(0);
    });

    it("classifies an active item with only inactive variants separately from its default", () => {
        const snapshot = createCleanSnapshot();
        snapshot.variants[0].isActive = false;

        const result = classifyStockInventoryAudit(snapshot);

        expect(result.details.activeItemsWithoutActiveVariant).toEqual([{
            itemId: 1,
            itemSku: "ITEM-1",
            itemName: "วัสดุทดสอบ",
            persistedVariantCount: 1,
        }]);
        expect(result.details.defaultVariantInvariantViolations).toEqual([{
            kind: "DEFAULT_VARIANT_INACTIVE",
            itemId: 1,
            itemSku: "ITEM-1",
            itemName: "วัสดุทดสอบ",
            defaultVariantId: 11,
            activeVariantCount: 0,
            message: "StockItem.defaultVariantId ต้องอ้างถึง active variant",
        }]);
        expect(determineAuditExitCode(result, true)).toBe(1);
    });

    it("accepts an explicit active default that is not the lowest variant ID", () => {
        const snapshot = createCleanSnapshot();
        snapshot.variants.unshift({
            id: 9,
            stockItemId: 1,
            sku: "VARIANT-9",
            quantity: 0,
            minStock: 1,
            isActive: true,
        });

        const result = classifyStockInventoryAudit(snapshot);

        expect(snapshot.items[0].defaultVariantId).toBe(11);
        expect(result.details.defaultVariantInvariantViolations).toEqual([]);
        expect(result.summary.defaultVariantInvariantViolations).toBe(0);
        expect(determineAuditExitCode(result, true)).toBe(0);
    });

    it("fails strict mode when active variants exist without a canonical default", () => {
        const snapshot = createCleanSnapshot();
        snapshot.items[0].defaultVariantId = null;

        const result = classifyStockInventoryAudit(snapshot);

        expect(result.details.defaultVariantInvariantViolations).toMatchObject([{
            kind: "MISSING_DEFAULT_WITH_ACTIVE_VARIANTS",
            itemId: 1,
            defaultVariantId: null,
            activeVariantCount: 1,
        }]);
        expect(result.summary.defaultVariantInvariantViolations).toBe(1);
        expect(determineAuditExitCode(result, true)).toBe(1);
    });

    it("fails strict mode when the canonical default references a missing variant", () => {
        const snapshot = createCleanSnapshot();
        snapshot.items[0].defaultVariantId = 999;

        const result = classifyStockInventoryAudit(snapshot);

        expect(result.details.defaultVariantInvariantViolations).toMatchObject([{
            kind: "DEFAULT_VARIANT_MISSING",
            itemId: 1,
            defaultVariantId: 999,
            activeVariantCount: 1,
        }]);
        expect(determineAuditExitCode(result, true)).toBe(1);
    });

    it("fails strict mode when the canonical default belongs to another item", () => {
        const snapshot = createCleanSnapshot();
        snapshot.items.push({
            id: 2,
            sku: "ITEM-2",
            name: "วัสดุอีกชิ้น",
            defaultVariantId: null,
            quantity: 0,
            minStock: 0,
            isActive: false,
        });
        snapshot.variants.push({
            id: 22,
            stockItemId: 2,
            sku: "VARIANT-22",
            quantity: 0,
            minStock: 0,
            isActive: false,
        });
        snapshot.items[0].defaultVariantId = 22;

        const result = classifyStockInventoryAudit(snapshot);

        expect(result.details.defaultVariantInvariantViolations).toMatchObject([{
            kind: "DEFAULT_VARIANT_CROSS_ITEM",
            itemId: 1,
            defaultVariantId: 22,
            activeVariantCount: 1,
        }]);
        expect(determineAuditExitCode(result, true)).toBe(1);
    });

    it("reports no canonical-default violation for zero active variants and a null default", () => {
        const snapshot = createCleanSnapshot();
        snapshot.items[0].defaultVariantId = null;
        snapshot.variants[0].isActive = false;

        const result = classifyStockInventoryAudit(snapshot);

        expect(result.summary.defaultVariantInvariantViolations).toBe(0);
        expect(result.details.defaultVariantInvariantViolations).toEqual([]);
        expect(result.summary.activeItemsWithoutActiveVariant).toBe(1);
        expect(determineAuditExitCode(result, true)).toBe(1);
    });

    it("reports parent quantity mismatch without failing strict mode", () => {
        const snapshot = createCleanSnapshot();
        snapshot.items[0].quantity = 7;

        const result = classifyStockInventoryAudit(snapshot);

        expect(result.details.quantityMismatches).toEqual([{
            itemId: 1,
            itemSku: "ITEM-1",
            itemName: "วัสดุทดสอบ",
            parentQuantity: 7,
            variantQuantity: 5,
            difference: 2,
        }]);
        expect(determineAuditExitCode(result, true)).toBe(0);
    });

    it("treats a pending request item without variant as critical", () => {
        const snapshot = createCleanSnapshot();
        snapshot.requestItems[0] = {
            ...snapshot.requestItems[0],
            variantId: null,
            requestStatus: "PENDING_ISSUE",
        };

        const result = classifyStockInventoryAudit(snapshot);

        expect(result.summary.requestItemsWithoutVariant).toBe(1);
        expect(result.summary.pendingRequestItemsWithoutVariant).toBe(1);
        expect(determineAuditExitCode(result, true)).toBe(1);
    });

    it("detects request and transaction references to a variant from another item", () => {
        const snapshot = createCleanSnapshot();
        snapshot.items.push({
            id: 2,
            sku: "ITEM-2",
            name: "วัสดุอีกชิ้น",
            defaultVariantId: null,
            quantity: 0,
            minStock: 0,
            isActive: false,
        });
        snapshot.requestItems[0].itemId = 2;
        snapshot.transactions[0].itemId = 2;

        const result = classifyStockInventoryAudit(snapshot);

        expect(result.details.crossItemReferences).toHaveLength(2);
        expect(result.details.crossItemReferences.map((record) => record.source))
            .toEqual(["REQUEST_ITEM", "TRANSACTION"]);
        expect(determineAuditExitCode(result, true)).toBe(1);
    });

    it("detects negative and sign-invalid inventory records", () => {
        const snapshot = createCleanSnapshot();
        snapshot.variants[0].quantity = -1;
        snapshot.requestItems[0].quantity = 0;
        snapshot.transactions[0] = {
            ...snapshot.transactions[0],
            type: "OUT",
            quantity: 2,
        };

        const result = classifyStockInventoryAudit(snapshot);

        expect(result.details.negativeInventoryRecords.map((record) => record.kind))
            .toEqual([
                "VARIANT_QUANTITY",
                "REQUEST_QUANTITY",
                "TRANSACTION_SIGN",
            ]);
        expect(determineAuditExitCode(result, true)).toBe(1);
    });

    it("reports ledger coverage separately from current-balance discrepancy", () => {
        const snapshot = createCleanSnapshot();
        snapshot.transactions[0].quantity = 3;

        const result = classifyStockInventoryAudit(snapshot);

        expect(result.summary.variantsWithoutLedgerCoverage).toBe(0);
        expect(result.details.ledgerDiscrepancies).toEqual([{
            variantId: 11,
            itemId: 1,
            variantSku: "VARIANT-11",
            currentQuantity: 5,
            transactionCount: 1,
            hasOpeningBalance: true,
            ledgerQuantity: 3,
            difference: 2,
        }]);
        expect(determineAuditExitCode(result, true)).toBe(0);
    });

    it("groups variant-less records and reports missing ledger coverage without comparing default order", () => {
        const snapshot = createCleanSnapshot();
        snapshot.variants.push({
            id: 9,
            stockItemId: 1,
            sku: "VARIANT-9",
            quantity: 0,
            minStock: 1,
            isActive: true,
        });
        snapshot.requestItems.push({
            id: 22,
            requestId: 32,
            itemId: 1,
            variantId: null,
            quantity: 1,
            requestStatus: "CANCELLED",
        });
        snapshot.transactions = [{
            id: 42,
            itemId: 1,
            variantId: null,
            type: "IN",
            quantity: 1,
        }];

        const result = classifyStockInventoryAudit(snapshot);

        expect(result.summary.requestItemsWithoutVariantByStatus.CANCELLED).toBe(1);
        expect(result.summary.transactionsWithoutVariantByType.IN).toBe(1);
        expect(result.summary.variantsWithoutLedgerCoverage).toBe(1);
        expect(result.details.defaultVariantInvariantViolations).toEqual([]);
        expect(result.summary.defaultVariantInvariantViolations).toBe(0);
    });
});
