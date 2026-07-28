import { StockRequestStatus, StockTxType } from "@prisma/client";

export type AuditRequestStatus = `${StockRequestStatus}`;
export type AuditTransactionType = `${StockTxType}`;

export type StockInventoryAuditSnapshot = {
    items: Array<{
        id: number;
        sku: string;
        name: string;
        quantity: number;
        minStock: number;
        isActive: boolean;
    }>;
    variants: Array<{
        id: number;
        stockItemId: number;
        sku: string;
        quantity: number;
        minStock: number;
        isActive: boolean;
    }>;
    requestItems: Array<{
        id: number;
        requestId: number;
        itemId: number;
        variantId: number | null;
        quantity: number;
        requestStatus: AuditRequestStatus;
    }>;
    transactions: Array<{
        id: number;
        itemId: number;
        variantId: number | null;
        type: AuditTransactionType;
        quantity: number;
    }>;
};

export type QuantityMismatch = {
    itemId: number;
    itemSku: string;
    itemName: string;
    parentQuantity: number;
    variantQuantity: number;
    difference: number;
};

export type ImplicitDefaultVariant = {
    itemId: number;
    itemSku: string;
    activeVariantCount: number;
    implicitDefaultVariantId: number | null;
};

type MissingVariantItem = {
    itemId: number;
    itemSku: string;
    itemName: string;
    isActive: boolean;
};

type ActiveItemWithoutActiveVariant = {
    itemId: number;
    itemSku: string;
    itemName: string;
    persistedVariantCount: number;
};

type RequestItemWithoutVariant = {
    requestItemId: number;
    requestId: number;
    itemId: number;
    quantity: number;
    requestStatus: AuditRequestStatus;
};

type TransactionWithoutVariant = {
    transactionId: number;
    itemId: number;
    type: AuditTransactionType;
    quantity: number;
};

type CrossItemReference = {
    source: "REQUEST_ITEM" | "TRANSACTION";
    recordId: number;
    itemId: number;
    variantId: number;
    variantStockItemId: number;
};

type NegativeInventoryRecord = {
    kind:
        | "ITEM_QUANTITY"
        | "ITEM_MIN_STOCK"
        | "VARIANT_QUANTITY"
        | "VARIANT_MIN_STOCK"
        | "REQUEST_QUANTITY"
        | "TRANSACTION_SIGN";
    recordId: number;
    value: number;
    message: string;
};

type LedgerCoverage = {
    variantId: number;
    itemId: number;
    variantSku: string;
    currentQuantity: number;
    transactionCount: number;
    hasOpeningBalance: boolean;
    ledgerQuantity: number;
};

type LedgerDiscrepancy = LedgerCoverage & {
    difference: number;
};

export type StockInventoryAuditResult = {
    summary: {
        items: number;
        variants: number;
        itemsWithoutVariant: number;
        activeItemsWithoutVariant: number;
        inactiveItemsWithoutVariant: number;
        activeItemsWithoutActiveVariant: number;
        quantityMismatches: number;
        requestItemsWithoutVariant: number;
        pendingRequestItemsWithoutVariant: number;
        transactionsWithoutVariant: number;
        crossItemReferences: number;
        negativeInventoryRecords: number;
        variantsWithoutLedgerCoverage: number;
        ledgerDiscrepancies: number;
        requestItemsWithoutVariantByStatus: Record<AuditRequestStatus, number>;
        transactionsWithoutVariantByType: Record<AuditTransactionType, number>;
    };
    details: {
        itemsWithoutVariant: MissingVariantItem[];
        activeItemsWithoutActiveVariant: ActiveItemWithoutActiveVariant[];
        quantityMismatches: QuantityMismatch[];
        requestItemsWithoutVariant: RequestItemWithoutVariant[];
        transactionsWithoutVariant: TransactionWithoutVariant[];
        crossItemReferences: CrossItemReference[];
        implicitDefaultVariants: ImplicitDefaultVariant[];
        negativeInventoryRecords: NegativeInventoryRecord[];
        ledgerCoverage: LedgerCoverage[];
        ledgerDiscrepancies: LedgerDiscrepancy[];
    };
};

const REQUEST_STATUSES = Object.values(StockRequestStatus);
const TRANSACTION_TYPES = Object.values(StockTxType);

function countByValue<T extends string>(
    values: T[],
    allowedValues: T[],
): Record<T, number> {
    const counts = Object.fromEntries(
        allowedValues.map((value) => [value, 0]),
    ) as Record<T, number>;
    for (const value of values) {
        counts[value] += 1;
    }
    return counts;
}

function hasInvalidTransactionSign(
    type: AuditTransactionType,
    quantity: number,
): boolean {
    if (type === "IN") return quantity <= 0;
    if (type === "OUT") return quantity >= 0;
    if (type === "OPENING_BALANCE") return quantity < 0;
    return quantity === 0;
}

export function classifyStockInventoryAudit(
    snapshot: StockInventoryAuditSnapshot,
): StockInventoryAuditResult {
    const variantsByItemId = new Map<number, StockInventoryAuditSnapshot["variants"]>();
    const variantById = new Map(snapshot.variants.map((variant) => [variant.id, variant]));
    const transactionsByVariantId =
        new Map<number, StockInventoryAuditSnapshot["transactions"]>();

    for (const variant of snapshot.variants) {
        const variants = variantsByItemId.get(variant.stockItemId) ?? [];
        variants.push(variant);
        variantsByItemId.set(variant.stockItemId, variants);
    }
    for (const transaction of snapshot.transactions) {
        if (transaction.variantId === null) continue;
        const transactions = transactionsByVariantId.get(transaction.variantId) ?? [];
        transactions.push(transaction);
        transactionsByVariantId.set(transaction.variantId, transactions);
    }

    const itemsWithoutVariant = snapshot.items
        .filter((item) => (variantsByItemId.get(item.id) ?? []).length === 0)
        .map((item) => ({
            itemId: item.id,
            itemSku: item.sku,
            itemName: item.name,
            isActive: item.isActive,
        }));
    const activeItemsWithoutActiveVariant = snapshot.items
        .filter((item) => {
            const variants = variantsByItemId.get(item.id) ?? [];
            return item.isActive
                && variants.length > 0
                && variants.every((variant) => !variant.isActive);
        })
        .map((item) => ({
            itemId: item.id,
            itemSku: item.sku,
            itemName: item.name,
            persistedVariantCount: (variantsByItemId.get(item.id) ?? []).length,
        }));
    const quantityMismatches = snapshot.items.flatMap((item) => {
        const variantQuantity = (variantsByItemId.get(item.id) ?? [])
            .reduce((sum, variant) => sum + variant.quantity, 0);
        if (item.quantity === variantQuantity) return [];
        return [{
            itemId: item.id,
            itemSku: item.sku,
            itemName: item.name,
            parentQuantity: item.quantity,
            variantQuantity,
            difference: item.quantity - variantQuantity,
        }];
    });
    const requestItemsWithoutVariant = snapshot.requestItems
        .filter((requestItem) => requestItem.variantId === null)
        .map((requestItem) => ({
            requestItemId: requestItem.id,
            requestId: requestItem.requestId,
            itemId: requestItem.itemId,
            quantity: requestItem.quantity,
            requestStatus: requestItem.requestStatus,
        }));
    const transactionsWithoutVariant = snapshot.transactions
        .filter((transaction) => transaction.variantId === null)
        .map((transaction) => ({
            transactionId: transaction.id,
            itemId: transaction.itemId,
            type: transaction.type,
            quantity: transaction.quantity,
        }));
    const crossItemReferences: CrossItemReference[] = [
        ...snapshot.requestItems.flatMap((requestItem) => {
            if (requestItem.variantId === null) return [];
            const variant = variantById.get(requestItem.variantId);
            if (!variant || variant.stockItemId === requestItem.itemId) return [];
            return [{
                source: "REQUEST_ITEM" as const,
                recordId: requestItem.id,
                itemId: requestItem.itemId,
                variantId: requestItem.variantId,
                variantStockItemId: variant.stockItemId,
            }];
        }),
        ...snapshot.transactions.flatMap((transaction) => {
            if (transaction.variantId === null) return [];
            const variant = variantById.get(transaction.variantId);
            if (!variant || variant.stockItemId === transaction.itemId) return [];
            return [{
                source: "TRANSACTION" as const,
                recordId: transaction.id,
                itemId: transaction.itemId,
                variantId: transaction.variantId,
                variantStockItemId: variant.stockItemId,
            }];
        }),
    ];
    const implicitDefaultVariants = snapshot.items.map((item) => {
        const activeVariants = (variantsByItemId.get(item.id) ?? [])
            .filter((variant) => variant.isActive)
            .sort((left, right) => left.id - right.id);
        return {
            itemId: item.id,
            itemSku: item.sku,
            activeVariantCount: activeVariants.length,
            implicitDefaultVariantId: activeVariants[0]?.id ?? null,
        };
    });
    const negativeInventoryRecords: NegativeInventoryRecord[] = [
        ...snapshot.items.flatMap((item) => [
            ...(item.quantity < 0 ? [{
                kind: "ITEM_QUANTITY" as const,
                recordId: item.id,
                value: item.quantity,
                message: "StockItem.quantity ต้องไม่ติดลบ",
            }] : []),
            ...(item.minStock < 0 ? [{
                kind: "ITEM_MIN_STOCK" as const,
                recordId: item.id,
                value: item.minStock,
                message: "StockItem.minStock ต้องไม่ติดลบ",
            }] : []),
        ]),
        ...snapshot.variants.flatMap((variant) => [
            ...(variant.quantity < 0 ? [{
                kind: "VARIANT_QUANTITY" as const,
                recordId: variant.id,
                value: variant.quantity,
                message: "StockItemVariant.quantity ต้องไม่ติดลบ",
            }] : []),
            ...(variant.minStock < 0 ? [{
                kind: "VARIANT_MIN_STOCK" as const,
                recordId: variant.id,
                value: variant.minStock,
                message: "StockItemVariant.minStock ต้องไม่ติดลบ",
            }] : []),
        ]),
        ...snapshot.requestItems.flatMap((requestItem) =>
            requestItem.quantity <= 0 ? [{
                kind: "REQUEST_QUANTITY" as const,
                recordId: requestItem.id,
                value: requestItem.quantity,
                message: "StockRequestItem.quantity ต้องเป็นค่าบวก",
            }] : [],
        ),
        ...snapshot.transactions.flatMap((transaction) =>
            hasInvalidTransactionSign(transaction.type, transaction.quantity) ? [{
                kind: "TRANSACTION_SIGN" as const,
                recordId: transaction.id,
                value: transaction.quantity,
                message: `StockTransaction.quantity ไม่สอดคล้องกับ ${transaction.type}`,
            }] : [],
        ),
    ];
    const ledgerCoverage = snapshot.variants
        .filter((variant) => variant.quantity !== 0)
        .map((variant) => {
            const transactions = transactionsByVariantId.get(variant.id) ?? [];
            return {
                variantId: variant.id,
                itemId: variant.stockItemId,
                variantSku: variant.sku,
                currentQuantity: variant.quantity,
                transactionCount: transactions.length,
                hasOpeningBalance: transactions.some(
                    (transaction) => transaction.type === "OPENING_BALANCE",
                ),
                ledgerQuantity: transactions.reduce(
                    (sum, transaction) => sum + transaction.quantity,
                    0,
                ),
            };
        });
    const ledgerDiscrepancies = ledgerCoverage
        .filter((coverage) => coverage.currentQuantity !== coverage.ledgerQuantity)
        .map((coverage) => ({
            ...coverage,
            difference: coverage.currentQuantity - coverage.ledgerQuantity,
        }));

    return {
        summary: {
            items: snapshot.items.length,
            variants: snapshot.variants.length,
            itemsWithoutVariant: itemsWithoutVariant.length,
            activeItemsWithoutVariant: itemsWithoutVariant.filter(
                (item) => item.isActive,
            ).length,
            inactiveItemsWithoutVariant: itemsWithoutVariant.filter(
                (item) => !item.isActive,
            ).length,
            activeItemsWithoutActiveVariant: activeItemsWithoutActiveVariant.length,
            quantityMismatches: quantityMismatches.length,
            requestItemsWithoutVariant: requestItemsWithoutVariant.length,
            pendingRequestItemsWithoutVariant: requestItemsWithoutVariant.filter(
                (requestItem) => requestItem.requestStatus === "PENDING_ISSUE",
            ).length,
            transactionsWithoutVariant: transactionsWithoutVariant.length,
            crossItemReferences: crossItemReferences.length,
            negativeInventoryRecords: negativeInventoryRecords.length,
            variantsWithoutLedgerCoverage: ledgerCoverage.filter(
                (coverage) => coverage.transactionCount === 0,
            ).length,
            ledgerDiscrepancies: ledgerDiscrepancies.length,
            requestItemsWithoutVariantByStatus: countByValue(
                requestItemsWithoutVariant.map(
                    (requestItem) => requestItem.requestStatus,
                ),
                REQUEST_STATUSES,
            ),
            transactionsWithoutVariantByType: countByValue(
                transactionsWithoutVariant.map((transaction) => transaction.type),
                TRANSACTION_TYPES,
            ),
        },
        details: {
            itemsWithoutVariant,
            activeItemsWithoutActiveVariant,
            quantityMismatches,
            requestItemsWithoutVariant,
            transactionsWithoutVariant,
            crossItemReferences,
            implicitDefaultVariants,
            negativeInventoryRecords,
            ledgerCoverage,
            ledgerDiscrepancies,
        },
    };
}

export function determineAuditExitCode(
    result: StockInventoryAuditResult,
    strict: boolean,
): number {
    if (!strict) return 0;

    const activeItemsWithoutPersistedVariant =
        result.details.itemsWithoutVariant.some((item) => item.isActive);
    return activeItemsWithoutPersistedVariant
        || result.summary.activeItemsWithoutActiveVariant > 0
        || result.summary.pendingRequestItemsWithoutVariant > 0
        || result.summary.crossItemReferences > 0
        || result.summary.negativeInventoryRecords > 0
        ? 1
        : 0;
}
