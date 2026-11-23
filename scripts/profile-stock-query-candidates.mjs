import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { setTimeout } from "node:timers/promises";
import { Prisma, PrismaClient } from "@prisma/client";
import { createConnection } from "mysql2/promise";
import { tsImport } from "tsx/esm/api";
import { assertDisposableMysql, validateDisposableTarget } from "./mysql-integration-safety.mjs";

const target = validateDisposableTarget(process.env);
await assertDisposableMysql();
const db = new PrismaClient({ log: [{ emit: "event", level: "query" }] });
globalThis.prisma = db;
const sql = await createConnection({ uri: target.href, timezone: "Z" });
const { getItems, getRequests } = await tsImport("../modules/stock/application/queries/queries.ts", import.meta.url);
const { readStockAnalytics } = await tsImport("../modules/stock/infrastructure/reports/analytics-query.ts", import.meta.url);
const samples = 20;
let queries = [];
db.$on("query", (query) => queries.push(query));
const emit = (record) => console.log("STOCK_PROFILE " + JSON.stringify(record));
const stats = (values) => {
    const sorted = values.toSorted((a,b) => a-b);
    return { p50: sorted[Math.ceil(values.length * .5) - 1], p95: sorted[Math.ceil(values.length * .95) - 1] };
};
const digest = (dto) => createHash("sha256").update(JSON.stringify(dto)).digest("hex");
const comparisons = new Map();

async function measure(stage, name, operation, selectPlan) {
    const times = [];
    let output, expected;
    for (let sample = -2; sample < samples; sample++) {
        queries = [];
        const start = performance.now();
        output = await operation();
        // The output's generatedAt is frozen for analytics; no response fields are discarded.
        const hash = digest(output);
        const elapsed = performance.now() - start;
        expected ??= hash;
        assert.equal(hash, expected);
        await setTimeout(20);
        if (sample >= 0) times.push({ elapsed, queryEvents: queries.length, rss: process.memoryUsage().rss });
    }
    if (comparisons.has(name)) assert.equal(expected, comparisons.get(name));
    else comparisons.set(name, expected);
    const plans = [];
    for (const query of queries.filter(selectPlan).slice(0, 3)) {
        const params = JSON.parse(query.params).map((value) =>
            typeof value === "string" && /^\d{4}-\d\d-\d\d[T ]\d\d:\d\d/.test(value) ? new Date(value) : value);
        const [explain] = await sql.query("EXPLAIN ANALYZE " + query.query, params);
        plans.push({ sql: query.query, tree: explain[0].EXPLAIN });
    }
    emit({ stage, name, ms: stats(times.map((r) => r.elapsed)), queryEvents: [...new Set(times.map((r) => r.queryEvents))],
        digest: expected, plans, maxRss: Math.max(...times.map((r) => r.rss)),
        total: output.total ?? output.kpis, times });
    return output;
}

try {
    const u0 = await db.user.create({ data: { name: "Stock profiles small", email: "small@fixture.test", role: "USER", password: "fixture" } });
    const u1 = await db.user.create({ data: { name: "Stock profiles large", email: "large@fixture.test", role: "USER", password: "fixture" } });
    const categories = [];
    for (let i = 0; i < 10; i++) categories.push(await db.stockCategory.create({ data: { name: "Synthetic category " + i } }));
    const categoryIndex = (i) => Math.floor(i / 5) % 10;
    const itemsCount = 10_000;
    const requestsCount = 50_000;
    for (let start = 0; start < itemsCount; start += 500) {
        await db.stockItem.createMany({ data: Array.from({ length: 500 }, (_, index) => {
            const i = start + index;
            const sku = "FIX-" + String(i).padStart(5, "0");
            const name = i === 1 ? "อุปกรณ์ FIX-00102 สำหรับทดสอบ" : (i % 4 === 0 ? "กระดาษ" : "อุปกรณ์") + " " + sku;
            return { name, sku, unit: "ชิ้น", categoryId: categories[categoryIndex(i)].id, isActive: i % 5 !== 4 };
        }) });
    }
    const items = await db.stockItem.findMany({ select: { id: true, sku: true }, orderBy: { id: "asc" } });
    for (let start = 0; start < itemsCount; start += 500) {
        await db.stockItemVariant.createMany({ data: items.slice(start, start + 500).flatMap((item, index) => [
            { stockItemId: item.id, sku: item.sku, unit: "ชิ้น", quantity: (start + index) % 14, minStock: 4 },
            { stockItemId: item.id, sku: "VAR-" + item.sku, unit: index % 8 === 0 ? "กล่อง" : "ชิ้น", quantity: index % 17, minStock: 5 },
        ]) });
    }
    await sql.query("UPDATE stock_items i JOIN stock_item_variants v ON v.sku=i.sku SET i.defaultVariantId=v.id");
    const variants = await db.stockItem.findMany({ select: { id: true, defaultVariantId: true }, orderBy: { id: "asc" } });
    const origin = Date.parse("2026-01-01T00:00:00Z");
    const request = (i, key = "seed-") => {
        const date = new Date(origin + i * 11 * 60_000);
        const issued = i % 10 !== 7;
        return { requestedBy: i % 97 === 0 ? u0.id : u1.id, idempotencyKey: key + i, requestHash: "0".repeat(64),
            projectCode: i % 127 === 0 ? "related-1000-code" : "PROJECT-" + (i % 70),
            status: issued ? "ISSUED" : "PENDING_ISSUE", issuedAt: issued ? date : null, createdAt: date };
    };
    for (let start = 0; start < requestsCount; start += 500) {
        await db.stockRequest.createMany({ data: Array.from({ length: 500 }, (_, index) => request(start + index)) });
    }
    const requests = await db.stockRequest.findMany({ select: { id: true }, orderBy: { id: "asc" } });
    for (let start = 0; start < requestsCount; start += 500) {
        await db.stockRequestItem.createMany({ data: requests.slice(start, start + 500).map((row, index) => {
            const item = variants[(start + index) % variants.length];
            return { requestId: row.id, itemId: item.id, variantId: item.defaultVariantId, quantity: index % 5 + 1 };
        }) });
    }
    await sql.query("ANALYZE TABLE stock_requests, stock_request_items, stock_items, stock_item_variants");
    await sql.query("SET SESSION information_schema_stats_expiry=0");
    const [[server]] = await sql.query("SELECT VERSION() AS mysql, @@collation_server AS collation");
    emit({ environment: { ...server, node: process.version, prisma: Prisma.prismaVersion.client, cpu: os.cpus()[0].model, logicalCpus: os.availableParallelism(), memory: os.totalmem(), samples, itemsCount, requestsCount, requestLines: requestsCount, variantsCount: itemsCount * 2 } });
    const whereOptions = { page: 1, limit: 25 };
    const wantItem = (event) => /^SELECT\b/i.test(event.query) && event.query.includes("LIKE") && event.query.includes("stock_items");
    for (const [label, search, extra] of [
        ["exact-sku-as-substring", "FIX-00102", {}], ["prefix-as-substring", "FIX-00", {}],
        ["Thai-substring", "กระดาษ", {}], ["variant-sku", "VAR-FIX-00102", {}],
        ["Thai-category-active", "กระดาษ", { categoryId: categories[0].id, activeOnly: true }],
    ]) {
        const result = await measure("before", label, () => getItems({ ...whereOptions, search, ...extra }), wantItem);
        if (label === "exact-sku-as-substring") {
            assert.ok(result.items.some((item) => item.sku === search));
            assert.ok(result.items.some((item) => item.sku !== search && item.name.includes(search)));
        }
    }
    for (const pattern of ["FIX-00102", "FIX-00%"]) {
        const query = pattern.endsWith("%")
            ? "SELECT id FROM stock_items WHERE sku LIKE ?"
            : "SELECT id FROM stock_items WHERE sku = ?";
        const [plan] = await sql.query("EXPLAIN ANALYZE " + query, [pattern]);
        emit({ shape: pattern, plan: plan[0].EXPLAIN });
    }
    const authority = { userId: u0.id, scopes: ["ALL"] };
    const wantRequest = ({ query }) => /^SELECT\b/i.test(query) && /FROM .*stock_requests/.test(query) && (query.includes("ORDER BY") || query.includes("COUNT"));
    const numeric = await measure("before", "numeric-search-with-text-matches", () => getRequests({ ...whereOptions, search: "1000" }, authority, "all"), wantRequest);
    assert.ok(numeric.total > 1);
    const denied = await getRequests({ ...whereOptions, search: "1000" }, { userId: u0.id, scopes: [] }, "all");
    assert.ok(denied.requests.every((row) => row.requestedBy === u0.id));

    const FrozenDate = Date;
    for (const stage of ["before", "candidate-indexes"]) {
        if (stage !== "before") {
            await sql.query("ALTER TABLE stock_requests ADD INDEX profile_requested_created (requestedBy, createdAt, id), ADD INDEX profile_status_created (status, createdAt, id), ADD INDEX profile_status_reviewed (status, reviewedAt, id)");
            await sql.query("ANALYZE TABLE stock_requests");
        }
        const [[storage]] = await sql.query("SELECT INDEX_LENGTH AS indexBytes FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='stock_requests'");
        const inserted = [];
        const batch = Array.from({ length: 500 }, (_, index) => request(index, "write-"));
        for (let sample = -2; sample < samples; sample++) {
            const t = performance.now();
            assert.equal((await db.stockRequest.createMany({ data: batch })).count, batch.length);
            if (sample >= 0) inserted.push(performance.now() - t);
            await db.stockRequest.deleteMany({ where: { idempotencyKey: { startsWith: "write-" } } });
        }
        emit({ stage, indexBytes: storage.indexBytes, writeBatch: 500, ms: stats(inserted) });
        await measure(stage, "mine-sparse-deep", () => getRequests({ page: 16, limit: 25 }, authority), wantRequest);
        await measure(stage, "mine-dense-deep", () => getRequests({ page: 200, limit: 25 }, { userId: u1.id, scopes: [] }), wantRequest);
        await measure(stage, "status-issued-deep", () => getRequests({ status: "ISSUED", page: 200, limit: 25 }, authority, "all"), wantRequest);
        globalThis.Date = class extends FrozenDate {
            constructor(...args) {
                super(...(args.length ? args : ["2026-11-23T02:00:00Z"]));
            }
        };
        try {
            await measure(stage, "inventory-and-issued-month", () => readStockAnalytics({ year: 2026, fromMonth: 5, toMonth: 5, metric: "frequency", page: 1 }),
                ({ query }) => query.includes("reviewedAt") || query.includes("GROUP BY") && query.includes("variantId"));
        } finally {
            globalThis.Date = FrozenDate;
        }
    }
} finally {
    await sql.end();
    await db.$disconnect();
}
