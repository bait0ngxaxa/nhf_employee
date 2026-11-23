import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";
import { createConnection } from "mysql2/promise";
import { tsImport } from "tsx/esm/api";
import { assertDisposableMysql, validateDisposableTarget } from "./mysql-integration-safety.mjs";

const baseline = "7c49424c0bd185035c928f3dbaf8562243718f4e";
const path = "modules/stock/infrastructure/reports/analytics-query.ts";
const root = fileURLToPath(new URL("../", import.meta.url));
const dir = await mkdtemp(fileURLToPath(new URL("./.stock-analytics-profile-", import.meta.url)));
const samples = 20;
const emit = (record) => process.stdout.write("STOCK_ANALYTICS " + JSON.stringify(record) + "\n");
const query = { year: 2026, fromMonth: 5, toMonth: 5, metric: "frequency", page: 1 };

// Instrument only temporary copies. Resolve relative imports from the original source.
async function load(name, source) {
    const snapshot = "const snapshot = await readInventorySnapshot(tx, materials);";
    const enter = "return prisma.$transaction(async (tx) => {";
    const exit = "const issuedLines = number(totals[0]?.lineCount ?? 0);";
    assert.ok(source.includes(snapshot));
    assert.ok(source.includes(enter) && source.includes(exit));
    const file = dir + "/" + name + ".ts";
    const imports = source.replace(/from "(\.{1,2}\/[^"]+)"/g, (_, relative) =>
        'from "' + new URL(relative, new URL("../" + path, import.meta.url)).pathname
            .replace(new URL("../", import.meta.url).pathname, "@/") + '"');
    await writeFile(file, imports
        .replace(enter, enter + " globalThis.stockAnalyticsProfile.transactionStart = performance.now();")
        .replace(exit, exit + " globalThis.stockAnalyticsProfile.transactionEnd = performance.now();")
        .replace(snapshot, "globalThis.stockAnalyticsProfile.start = performance.now(); " + snapshot +
            " globalThis.stockAnalyticsProfile.end = performance.now();"));
    return (await tsImport(file, import.meta.url)).readStockAnalytics;
}

async function seed(db, sql) {
    const user = await db.user.create({ data: { name: "Stock Analytics fixture", email: "analytics@fixture.test", password: "fixture" } });
    const categories = [];
    const attributes = [];
    for (let i = 0; i < 10; i++) {
        categories.push(await db.stockCategory.create({ data: { name: "หมวด " + i } }));
    }
    for (const name of ["สี", "ขนาด", "วัสดุ", "รุ่น"]) {
        const attribute = await db.stockAttribute.create({ data: { name } });
        attributes.push(await db.stockAttributeValue.create({ data: { attributeId: attribute.id, value: "ค่าทดสอบ" } }));
    }
    for (let start = 0; start < 10000; start += 500) {
        const items = Array.from({ length: 500 }, (_, index) => {
            const i = start + index + 1;
            return { id: i, name: "อุปกรณ์ " + i, sku: "FIX-" + i, unit: "pc", categoryId: categories[i % 10].id, isActive: i <= 8000 };
        });
        await db.stockItem.createMany({ data: items });
        await db.stockItemVariant.createMany({ data: items.flatMap((item) => [
            { id: item.id * 2 - 1, sku: item.sku, stockItemId: item.id, unit: "pc", quantity: 25, minStock: 4 },
            { id: item.id * 2, sku: "VAR-" + item.sku, stockItemId: item.id, unit: item.id % 2 ? "PC" : "กล่อง", quantity: 25, minStock: 4 },
        ]) });
    }
    await sql.query("UPDATE stock_items SET defaultVariantId = 2 * id - 1");
    for (let start = 0; start < 50000; start += 500) {
        const requests = Array.from({ length: 500 }, (_, index) => {
            const i = start + index + 1;
            const issued = i % 10 !== 7;
            const date = new Date(Date.UTC(2026, 0, 1) + i * 660000);
            return { id: i, requestedBy: user.id, idempotencyKey: "seed-" + i, requestHash: "0".repeat(64),
                projectCode: "PROJECT-" + (i % 70), status: issued ? "ISSUED" : "PENDING_ISSUE", issuedAt: issued ? date : null, createdAt: date };
        });
        await db.stockRequest.createMany({ data: requests });
        await db.stockRequestItem.createMany({ data: requests.map(({ id }) => {
            const itemId = 1 + (id - 1) % 10000;
            return { requestId: id, itemId, variantId: id % 200 === 0 ? null : 2 * itemId - (id % 2), quantity: id % 7 + 1 };
        }) });
    }
    await sql.query("ANALYZE TABLE stock_requests, stock_request_items, stock_items, stock_item_variants");
    return attributes;
}

async function configureFixture(sql, attributes, size, distribution, density) {
    await sql.query(`UPDATE stock_item_variants SET isActive = id <= ?, minStock = IF(MOD(id, 23) = 0, 0, 4),
        quantity = CASE WHEN ? = 'mixed' THEN MOD(id, 17)
                        WHEN ? = 'few' AND id IN (3, 13, 23, 43, 73, 103, 123) THEN MOD(id, 4)
                        ELSE 100 END`, [size, distribution, distribution]);
    await sql.query("DELETE FROM stock_variant_attribute_values");
    if (density === "dense") {
        for (const { id } of attributes) {
            await sql.query(`INSERT INTO stock_variant_attribute_values (variantId, attributeValueId)
                SELECT id, ? FROM stock_item_variants WHERE isActive AND MOD(id, 31) <> 0`, [id]);
        }
    } else {
        await sql.query(`INSERT INTO stock_variant_attribute_values (variantId, attributeValueId)
            SELECT id, ? FROM stock_item_variants WHERE isActive AND MOD(id, 29) = 0`, [attributes[0].id]);
    }
    const [[{ relationRows }]] = await sql.query("SELECT COUNT(*) AS relationRows FROM stock_variant_attribute_values");
    return relationRows;
}

function shape({ query: sql }) {
    if (/^\s*SELECT\b/i.test(sql)) {
        if (sql.includes("reviewedAt")) {
            if (sql.includes("LIMIT 51")) return "detail";
            if (sql.includes("GROUP BY c.id")) return "category";
            if (sql.includes("ORDER BY unit")) return "unitOptions";
            return "issued";
        }
        const table = sql.match(/FROM `[^`]+`\.`([a-z_]+)`/i)?.[1];
        if (["stock_variant_attribute_values", "stock_attribute_values", "stock_attributes"].includes(table)) return "attributes";
        if (table === "stock_item_variants") return sql.includes("`isActive`") ? "variantScan" : "alertVariants";
        if (table === "stock_items") return "itemNames";
        if (table === "stock_request_items") return sql.includes("GROUP BY") ? "reservations" : "invariant";
        return "optionsAndPending";
    }
    return "transactionControl";
}

async function counters(sql) {
    const [[row]] = await sql.query(`SELECT SUM(COUNT_STAR) AS statements, SUM(SUM_ROWS_EXAMINED) AS examined,
        SUM(SUM_ROWS_SENT) AS returned, SUM(SUM_TIMER_WAIT) / 1000000000 AS executionMs
        FROM performance_schema.events_statements_summary_by_account_by_event_name
        WHERE USER = 'integration_user' AND EVENT_NAME = 'statement/com/Execute'`);
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, Number(value)]));
}

function stats(values) {
    const sorted = values.toSorted((a, b) => a - b);
    return { p50: sorted[Math.ceil(values.length * 0.5) - 1], p95: sorted[Math.ceil(values.length * 0.95) - 1] };
}

function normalize(dto) {
    return { ...dto, freshness: { ...dto.freshness, generatedAt: "normalized" } };
}

async function main() {
    await assertDisposableMysql();
    const sql = await createConnection({ uri: validateDisposableTarget(process.env).href, timezone: "Z" });
    const db = new PrismaClient({ log: [{ level: "query", emit: "event" }] });
    globalThis.prisma = db;
    globalThis.stockAnalyticsProfile = {};
    let events;
    db.$on("query", (event) => events?.push(event));
    try {
        const original = execFileSync("git", ["show", baseline + ":" + path], { cwd: root, encoding: "utf8" });
        const current = await readFile(root + path, "utf8");
        const modes = { baseline: await load("baseline", original) };
        if (original.replaceAll("\r\n", "\n") !== current.replaceAll("\r\n", "\n")) {
            modes.candidate = await load("candidate", current);
        }
        const attributes = await seed(db, sql);
        const [[server]] = await sql.query("SELECT VERSION() AS mysql, @@collation_server AS collation");
        emit({ environment: { ...server, node: process.version, prisma: Prisma.prismaVersion.client,
            cpu: os.cpus()[0].model, logicalCpus: os.availableParallelism(), memory: os.totalmem(), samples, baseline,
            items: 10000, variants: 20000, requests: 50000 } });
        async function measure(run, input) {
            const before = await counters(sql);
            events = [];
            const cpu = process.cpuUsage();
            const start = performance.now();
            const dto = await run(input);
            const end = performance.now();
            JSON.stringify(dto);
            const serialized = performance.now();
            const usage = process.cpuUsage(cpu);
            const memory = process.memoryUsage();
            const captured = events;
            events = undefined;
            const after = await counters(sql);
            const groups = {};
            for (const event of captured) {
                const group = groups[shape(event)] ??= { count: 0, clientMs: 0 };
                group.count++;
                group.clientMs += event.duration;
            }
            const { start: snapshotStart, end: snapshotEnd, transactionStart, transactionEnd } = globalThis.stockAnalyticsProfile;
            return { dto, captured, sample: { overallMs: serialized - start, transactionMs: end - start,
                transactionBodyMs: transactionEnd - transactionStart,
                snapshotMs: snapshotEnd - snapshotStart, serializationMs: serialized - end,
                cpuMs: (usage.user + usage.system) / 1000, rss: memory.rss, heap: memory.heapUsed,
                queryEvents: captured.length, ...Object.fromEntries(Object.keys(after).map((key) => [key, after[key] - before[key]])),
                groups } };
        }
        for (const [size, distribution, density] of [[16000, "mixed", "dense"], [16000, "mixed", "sparse"],
            [16000, "healthy", "dense"], [1000, "healthy", "sparse"], [5000, "few", "sparse"]]) {
            const relationRows = await configureFixture(sql, attributes, size, distribution, density);
            const records = Object.fromEntries(Object.keys(modes).map((mode) => [mode, []]));
            let expected;
            for (let n = -2; n < samples; n++) {
                const entries = Object.entries(modes);
                if (n % 2 !== 0) entries.reverse();
                for (const [mode, run] of entries) {
                    globalThis.gc();
                    const { dto, sample, captured } = await measure(run, query);
                    expected ??= normalize(dto);
                    assert.deepEqual(normalize(dto), expected);
                    if (n >= 0) records[mode].push(sample);
                    if (n === samples - 1 && size === 16000 && distribution === "mixed" && density === "dense") {
                        for (const [group, event] of new Map(captured.filter((event) => /^\s*SELECT\b/i.test(event.query))
                            .map((event) => [shape(event) === "attributes"
                                ? event.query.match(/FROM `[^`]+`\.`([a-z_]+)`/i)?.[1] : shape(event), event]))) {
                            // Take a nonempty scan; the final scan is the end-of-cursor probe.
                            const sampleEvent = group === "variantScan" ? captured.find((e) => shape(e) === group) : event;
                            const params = JSON.parse(sampleEvent.params).map((value) =>
                                typeof value === "string" && /^\d{4}-\d\d-\d\d[T ]\d\d:\d\d/.test(value) ? new Date(value) : value);
                            const [rows] = await sql.query("EXPLAIN ANALYZE " + sampleEvent.query, params);
                            // MySQL inlines synthetic bind values in the plan. Bound the retained tree.
                            emit({ mode, group, plan: rows[0].EXPLAIN.split("\n").map((line) => line.slice(0, 420)).join("\n") });
                        }
                    }
                }
            }
            assert.equal(Object.values(expected.stockHealth).reduce((sum, count) => sum + count, 0), size);
            if (distribution === "healthy") assert.equal(expected.lowStockTotal, 0);
            if (distribution === "few") assert.ok(expected.lowStockTotal > 0 && expected.lowStockTotal < 20);
            if (distribution === "mixed") assert.ok(expected.lowStockTotal > 20);
            for (const [mode, times] of Object.entries(records)) {
                const keys = Object.keys(times[0]).filter((key) => key !== "groups");
                emit({ mode, size, distribution, density, relationRows, health: expected.stockHealth,
                    dto: createHash("sha256").update(JSON.stringify(expected)).digest("hex"),
                    metrics: Object.fromEntries(keys.map((key) => [key, stats(times.map((time) => time[key]))])), times });
            }
        }
        const user = await db.user.findFirstOrThrow({ where: { email: "analytics@fixture.test" } });
        const itemId = 8001;
        const detailVariants = Array.from({ length: 52 }, (_, i) => ({
            id: 20001 + i, sku: "DETAIL-" + i, stockItemId: itemId, unit: i % 2 ? "PC" : "pc",
        }));
        await db.stockItemVariant.createMany({ data: detailVariants });
        await db.stockRequest.create({ data: {
            requestedBy: user.id, idempotencyKey: "issued-detail", requestHash: "0".repeat(64), status: "ISSUED",
            projectCode: "DETAIL", issuedAt: new Date("2024-01-31T17:00:00Z"),
            items: { create: [
                { itemId, variantId: null, quantity: 1 },
                ...detailVariants.map(({ id }) => ({ itemId, variantId: id, quantity: 1 })),
            ] },
        } });
        const detail = { ...query, year: 2024, fromMonth: 2, toMonth: 2, projectCode: "DETAIL", itemId };
        for (const [label, input] of Object.entries({
            "no historical rows": { ...query, projectCode: "missing" },
            "legacy detail page 1": detail,
            "inactive historical detail page 2": { ...detail, page: 2 },
            "binary quantity with filters": { ...detail, metric: "quantity", unit: "PC", categoryId: 2 },
        })) {
            const expected = normalize(await modes.baseline(input));
            for (const run of Object.values(modes)) assert.deepEqual(normalize(await run(input)), expected);
            if (label === "legacy detail page 1") {
                assert.equal(expected.detail.hasMore, true);
                assert.equal(expected.detail.rows.length, 50);
                assert.equal(expected.detail.rows[0].variantId, null);
            }
            if (label === "inactive historical detail page 2") {
                assert.equal(expected.detail.hasMore, false);
                assert.equal(expected.detail.rows.length, 3);
                assert.deepEqual(expected.topMaterials[0].available, []);
            }
            if (label === "binary quantity with filters") {
                assert.deepEqual(expected.topMaterials[0].quantities, [{ unit: "PC", quantity: 26 }, { unit: "pc", quantity: 27 }]);
            }
            emit({ dtoCheck: label, modes: Object.keys(modes) });
        }
        await configureFixture(sql, attributes, 0, "healthy", "sparse");
        const empty = normalize(await modes.baseline(query));
        assert.deepEqual(empty.stockHealth, { healthy: 0, low: 0, out: 0 });
        for (const run of Object.values(modes)) assert.deepEqual(normalize(await run(query)), empty);
        emit({ dtoCheck: "empty", modes: Object.keys(modes) });
        await db.stockRequest.create({ data: {
            requestedBy: user.id, idempotencyKey: "invalid-pending", requestHash: "0".repeat(64), status: "PENDING_ISSUE", projectCode: "INVALID",
            items: { create: { itemId, variantId: null, quantity: 1 } },
        } });
        for (const run of Object.values(modes)) {
            await assert.rejects(() => run(query), { message: "พบคำขอรอจ่ายที่ไม่มี variant snapshot" });
        }
        emit({ dtoCheck: "pending null variant rejected", modes: Object.keys(modes) });
    } finally {
        await db.$disconnect();
        await sql.end();
    }
}

try {
    await main();
} finally {
    await rm(dir, { recursive: true, force: true });
}
