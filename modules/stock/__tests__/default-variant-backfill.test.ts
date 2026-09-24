import { describe, expect, it } from "vitest";

import {
    buildDefaultVariantBackfillReport,
    type DefaultVariantBackfillSnapshot,
} from "../application/maintenance/default-variant-backfill";
import {
    assertDefaultVariantApplyAuthorized,
    assertDefaultVariantReportSafeForApply,
    getDefaultVariantDatabaseTarget,
} from "../application/maintenance/default-variant-backfill-safety";

function createSnapshot(): DefaultVariantBackfillSnapshot {
    return {
        items: [
            {
                id: 1,
                sku: "ITEM-1",
                isActive: true,
                defaultVariantId: null,
                explicitDefaultVariantStockItemId: null,
            },
        ],
        variants: [
            { id: 12, stockItemId: 1, isActive: true },
            { id: 11, stockItemId: 1, isActive: true },
        ],
    };
}

describe("default variant backfill planning", () => {
    it("selects the preferred active variant ID for the retained backfill tool", () => {
        const report = buildDefaultVariantBackfillReport(createSnapshot());

        expect(report.summary).toEqual({
            items: 1,
            readyForBackfill: 1,
            alreadyMatches: 0,
            noActiveVariant: 0,
            crossItemDefaults: 0,
            mismatches: 0,
        });
        expect(report.details).toEqual([{
            itemId: 1,
            itemSku: "ITEM-1",
            itemIsActive: true,
            activeVariantCount: 2,
            preferredDefaultVariantId: 11,
            explicitDefaultVariantId: null,
            explicitDefaultVariantStockItemId: null,
            classification: "READY_FOR_BACKFILL",
        }]);
        expect(report.candidateItemIds).toEqual([1]);
    });

    it("classifies an explicit default that matches the preferred variant", () => {
        const snapshot = createSnapshot();
        snapshot.items[0].defaultVariantId = 11;
        snapshot.items[0].explicitDefaultVariantStockItemId = 1;

        const report = buildDefaultVariantBackfillReport(snapshot);

        expect(report.summary.alreadyMatches).toBe(1);
        expect(report.summary.mismatches).toBe(0);
        expect(report.candidateItemIds).toEqual([]);
    });

    it("reports but never overwrites a preferred-default mismatch", () => {
        const snapshot = createSnapshot();
        snapshot.items[0].defaultVariantId = 12;
        snapshot.items[0].explicitDefaultVariantStockItemId = 1;

        const report = buildDefaultVariantBackfillReport(snapshot);

        expect(report.summary.mismatches).toBe(1);
        expect(report.details[0]).toMatchObject({
            preferredDefaultVariantId: 11,
            explicitDefaultVariantId: 12,
            classification: "MISMATCH",
        });
        expect(report.candidateItemIds).toEqual([]);
    });

    it("does not propose a default when no active variant exists", () => {
        const snapshot = createSnapshot();
        snapshot.variants.forEach((variant) => {
            variant.isActive = false;
        });

        const report = buildDefaultVariantBackfillReport(snapshot);

        expect(report.summary.noActiveVariant).toBe(1);
        expect(report.details[0]).toMatchObject({
            activeVariantCount: 0,
            preferredDefaultVariantId: null,
            classification: "NO_ACTIVE_VARIANT",
        });
        expect(report.candidateItemIds).toEqual([]);
    });

    it("reports a mismatch when an explicit default exists without an active variant", () => {
        const snapshot = createSnapshot();
        snapshot.items[0].defaultVariantId = 12;
        snapshot.items[0].explicitDefaultVariantStockItemId = 1;
        snapshot.variants.forEach((variant) => {
            variant.isActive = false;
        });

        const report = buildDefaultVariantBackfillReport(snapshot);

        expect(report.summary.noActiveVariant).toBe(1);
        expect(report.summary.mismatches).toBe(1);
        expect(report.details[0]).toMatchObject({
            preferredDefaultVariantId: null,
            explicitDefaultVariantId: 12,
            classification: "MISMATCH",
        });
    });

    it("classifies an explicit default that belongs to another item", () => {
        const snapshot = createSnapshot();
        snapshot.items[0].defaultVariantId = 12;
        snapshot.items[0].explicitDefaultVariantStockItemId = 2;

        const report = buildDefaultVariantBackfillReport(snapshot);

        expect(report.summary.crossItemDefaults).toBe(1);
        expect(report.details[0]).toMatchObject({
            explicitDefaultVariantId: 12,
            explicitDefaultVariantStockItemId: 2,
            classification: "CROSS_ITEM_DEFAULT",
        });
        expect(report.candidateItemIds).toEqual([]);
    });
});

describe("default variant backfill safety", () => {
    const integrationTarget = getDefaultVariantDatabaseTarget(
        "mysql://user:password@127.0.0.1:3306/employee_nhf_integration",
    );

    it("allows dry-run without write acknowledgements", () => {
        expect(() => assertDefaultVariantApplyAuthorized({
            apply: false,
            acknowledgeDataWrite: false,
            allowProduction: false,
            confirmedDatabaseName: null,
        }, integrationTarget)).not.toThrow();
    });

    it("requires write acknowledgement and exact database confirmation", () => {
        expect(() => assertDefaultVariantApplyAuthorized({
            apply: true,
            acknowledgeDataWrite: false,
            allowProduction: false,
            confirmedDatabaseName: "employee_nhf_integration",
        }, integrationTarget)).toThrow("--acknowledge-data-write");
        expect(() => assertDefaultVariantApplyAuthorized({
            apply: true,
            acknowledgeDataWrite: true,
            allowProduction: false,
            confirmedDatabaseName: "wrong_database",
        }, integrationTarget)).toThrow(
            "--confirm-database=employee_nhf_integration",
        );
    });

    it("fails closed for a database not clearly named as test or development", () => {
        const unclassifiedTarget = getDefaultVariantDatabaseTarget(
            "mysql://user:password@db.internal:3306/employee_nhf",
        );

        expect(() => assertDefaultVariantApplyAuthorized({
            apply: true,
            acknowledgeDataWrite: true,
            allowProduction: false,
            confirmedDatabaseName: "employee_nhf",
        }, unclassifiedTarget)).toThrow("--allow-production");
        expect(() => assertDefaultVariantApplyAuthorized({
            apply: true,
            acknowledgeDataWrite: true,
            allowProduction: true,
            confirmedDatabaseName: "employee_nhf",
        }, unclassifiedTarget)).not.toThrow();
    });

    it("refuses apply when the report contains a cross-item explicit default", () => {
        const snapshot = createSnapshot();
        snapshot.items[0].defaultVariantId = 12;
        snapshot.items[0].explicitDefaultVariantStockItemId = 2;
        const report = buildDefaultVariantBackfillReport(snapshot);

        expect(() => assertDefaultVariantReportSafeForApply(report)).toThrow(
            "อ้างข้าม item",
        );
    });
});
