import type { DefaultVariantBackfillReport } from "./default-variant-backfill";

export type DefaultVariantApplyAuthorization = {
    apply: boolean;
    acknowledgeDataWrite: boolean;
    allowProduction: boolean;
    confirmedDatabaseName: string | null;
};

export type DefaultVariantDatabaseTarget = {
    databaseName: string;
    isClearlyNonProduction: boolean;
};

export function getDefaultVariantDatabaseTarget(
    rawUrl: string | undefined,
): DefaultVariantDatabaseTarget {
    if (!rawUrl) {
        throw new Error("ไม่พบ DATABASE_URL");
    }

    const url = new URL(rawUrl);
    if (url.protocol !== "mysql:") {
        throw new Error("รองรับเฉพาะ MySQL DATABASE_URL");
    }

    const databaseName = decodeURIComponent(url.pathname.slice(1));
    if (!databaseName) {
        throw new Error("DATABASE_URL ไม่มีชื่อฐานข้อมูล");
    }

    return {
        databaseName,
        isClearlyNonProduction:
            /(?:_integration|_test|_development|_dev)$/.test(databaseName),
    };
}

export function assertDefaultVariantApplyAuthorized(
    options: DefaultVariantApplyAuthorization,
    target: DefaultVariantDatabaseTarget,
): void {
    if (!options.apply) return;
    if (!options.acknowledgeDataWrite) {
        throw new Error(
            "apply ต้องระบุ --acknowledge-data-write เพื่อยืนยันการเขียนข้อมูล",
        );
    }
    if (options.confirmedDatabaseName !== target.databaseName) {
        throw new Error(
            `apply ถูกปฏิเสธ: ระบุ --confirm-database=${target.databaseName} ให้ตรงกับฐานเป้าหมาย`,
        );
    }
    if (!target.isClearlyNonProduction && !options.allowProduction) {
        throw new Error(
            "ฐานที่ไม่ใช่ test/development ต้องระบุ --allow-production เพิ่มเติม",
        );
    }
}

export function assertDefaultVariantReportSafeForApply(
    report: DefaultVariantBackfillReport,
): void {
    if (report.summary.crossItemDefaults > 0) {
        throw new Error(
            "apply ถูกปฏิเสธ: พบ explicit default variant อ้างข้าม item",
        );
    }
}
