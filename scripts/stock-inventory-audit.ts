/* eslint-disable no-console -- This read-only CLI intentionally writes its report to stdout. */
import { Prisma } from "@prisma/client";

import { prisma } from "../lib/db/prisma";
import {
    classifyStockInventoryAudit,
    determineAuditExitCode,
    type StockInventoryAuditResult,
    type StockInventoryAuditSnapshot,
} from "../lib/services/stock/inventory-audit";

type AuditOptions = {
    strict: boolean;
    json: boolean;
};

const AUDIT_PAGE_SIZE = 1_000;
const AUDIT_TRANSACTION_MAX_WAIT_MS = 10_000;
const AUDIT_TRANSACTION_TIMEOUT_MS = 60_000;

function parseOptions(args: string[]): AuditOptions {
    return {
        strict: args.includes("--fail-on-error"),
        json: args.includes("--json"),
    };
}

async function readAllPages<T extends { id: number }>(
    loadPage: (cursor: number | undefined) => Promise<T[]>,
): Promise<T[]> {
    const rows: T[] = [];
    let cursor: number | undefined;

    while (true) {
        const page = await loadPage(cursor);
        rows.push(...page);
        if (page.length < AUDIT_PAGE_SIZE) break;

        cursor = page.at(-1)?.id;
        if (cursor === undefined) break;
    }

    return rows;
}

async function loadAuditSnapshot(): Promise<StockInventoryAuditSnapshot> {
    return prisma.$transaction(async (tx) => {
        const items = await readAllPages((cursor) => tx.stockItem.findMany({
            select: {
                id: true,
                sku: true,
                name: true,
                quantity: true,
                minStock: true,
                isActive: true,
            },
            orderBy: { id: "asc" },
            take: AUDIT_PAGE_SIZE,
            ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
        }));
        const variants = await readAllPages((cursor) => tx.stockItemVariant.findMany({
            select: {
                id: true,
                stockItemId: true,
                sku: true,
                quantity: true,
                minStock: true,
                isActive: true,
            },
            orderBy: { id: "asc" },
            take: AUDIT_PAGE_SIZE,
            ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
        }));
        const requestItems = await readAllPages((cursor) =>
            tx.stockRequestItem.findMany({
            select: {
                id: true,
                requestId: true,
                itemId: true,
                variantId: true,
                quantity: true,
                request: { select: { status: true } },
            },
            orderBy: { id: "asc" },
            take: AUDIT_PAGE_SIZE,
            ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
        }));
        const transactions = await readAllPages((cursor) =>
            tx.stockTransaction.findMany({
            select: {
                id: true,
                itemId: true,
                variantId: true,
                type: true,
                quantity: true,
            },
            orderBy: { id: "asc" },
            take: AUDIT_PAGE_SIZE,
            ...(cursor !== undefined && { cursor: { id: cursor }, skip: 1 }),
        }));

        return {
            items,
            variants,
            requestItems: requestItems.map(({ request, ...requestItem }) => ({
                ...requestItem,
                requestStatus: request.status,
            })),
            transactions,
        };
    }, {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        maxWait: AUDIT_TRANSACTION_MAX_WAIT_MS,
        timeout: AUDIT_TRANSACTION_TIMEOUT_MS,
    });
}

function printDetail(
    title: string,
    rows: ReadonlyArray<Record<string, unknown>>,
): void {
    if (rows.length === 0) return;
    console.log(`\n${title} (${rows.length})`);
    console.table(rows);
}

function printTerminalReport(result: StockInventoryAuditResult): void {
    console.log("Stock inventory audit (read-only)");
    console.table(
        Object.entries(result.summary)
            .filter((entry): entry is [string, number] => typeof entry[1] === "number")
            .map(([check, count]) => ({ check, count })),
    );
    console.log("\nRequest items without variant by status");
    console.table(result.summary.requestItemsWithoutVariantByStatus);
    console.log("\nTransactions without variant by type");
    console.table(result.summary.transactionsWithoutVariantByType);

    printDetail("Items without variant", result.details.itemsWithoutVariant);
    printDetail(
        "Active items without active variant",
        result.details.activeItemsWithoutActiveVariant,
    );
    printDetail("Parent quantity mismatches", result.details.quantityMismatches);
    printDetail(
        "Request items without variant",
        result.details.requestItemsWithoutVariant,
    );
    printDetail(
        "Transactions without variant",
        result.details.transactionsWithoutVariant,
    );
    printDetail("Cross-item references", result.details.crossItemReferences);
    printDetail(
        "Implicit default variants",
        result.details.implicitDefaultVariants,
    );
    printDetail(
        "Negative or invalid inventory records",
        result.details.negativeInventoryRecords,
    );
    printDetail(
        "Variants with current inventory ledger coverage",
        result.details.ledgerCoverage,
    );
    printDetail("Ledger discrepancies", result.details.ledgerDiscrepancies);
}

async function main(): Promise<number> {
    const options = parseOptions(process.argv.slice(2));
    const result = classifyStockInventoryAudit(await loadAuditSnapshot());

    if (options.json) {
        console.log(JSON.stringify(result, null, 2));
    } else {
        printTerminalReport(result);
    }

    return determineAuditExitCode(result, options.strict);
}

async function run(): Promise<void> {
    try {
        process.exitCode = await main();
    } catch (error: unknown) {
        console.error(
            "Stock inventory audit ทำงานไม่สำเร็จ:",
            error instanceof Error ? error.message : "Unknown error",
        );
        process.exitCode = 1;
    } finally {
        await prisma.$disconnect();
    }
}

void run();
