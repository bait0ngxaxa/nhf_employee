import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Prisma, type PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import {
    applyRoutineImportManifest,
    assertRoutineImportManifestApplySafe,
    buildRoutineImportTaskInput,
    computeRoutineImportRowFingerprint,
} from "@/lib/services/routine-import";
import { prisma } from "@/lib/db/prisma";
import type {
    RoutineImportManifest,
    RoutineImportRow,
} from "@/lib/services/routine-import";

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/db/transaction", () => ({
    hasPrismaErrorCode: (error: unknown, code: string) =>
        typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === code,
    runSerializableTransaction: vi.fn(async (
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) => callback(prisma as unknown as Prisma.TransactionClient)),
}));

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

function makeRow(): RoutineImportRow {
    const sourceCells = [{
        address: "C4",
        value: "ค่าไฟฟ้า" as const,
        formula: null,
        type: "s",
    }];
    return {
        sourceFileName: "fixture.xls",
        sourceSheet: "U1",
        sourceRow: 4,
        sourceFingerprint: computeRoutineImportRowFingerprint(
            "fixture.xls",
            "U1",
            4,
            sourceCells,
            {
                categoryName: "สาธารณูปโภค",
                title: "ค่าไฟฟ้า",
                ownerNames: ["กัลยาณี"],
                scheduleText: "วันที่ 10 ของเดือน",
                contractText: null,
                extraDetails: null,
            },
        ),
        sourceCells,
        categorySourceText: "สาธารณูปโภค",
        ownerSourceText: "กัลยาณี",
        unitCode: "U1",
        unitName: "หน่วย U1",
        categoryName: "สาธารณูปโภค",
        title: "ค่าไฟฟ้า",
        ownerNames: ["กัลยาณี"],
        mappedEmployeeIds: [10],
        mappedEmployeeNames: ["กัลยาณี ศรีตะพันธ์"],
        scheduleText: "วันที่ 10 ของเดือน",
        contractText: null,
        extraDetails: null,
        normalizedSchedule: {
            scheduleType: "MONTHLY_DAY",
            scheduleConfig: { day: 10, monthOffset: 0 },
            businessDayPolicy: "NONE",
        },
        contractStartDate: null,
        contractEndDate: null,
        requiresReview: false,
        reviewReasons: [],
        proposedActivation: "ACTIVE",
    };
}

function makeManifest(row: RoutineImportRow): RoutineImportManifest {
    return {
        manifestVersion: 1,
        sourceFileName: row.sourceFileName,
        sourceSha256: "a".repeat(64),
        generatedAt: "2026-08-03T00:00:00.000Z",
        asOfDate: "2026-08-03",
        inspection: { fileName: row.sourceFileName, sheetCount: 1, sheets: [] },
        rows: [row],
        summary: {
            totalRows: 1,
            validRows: 1,
            requiresReview: 0,
            unresolvedOwners: 0,
            ambiguousSchedules: 0,
            expiredContracts: 0,
            missingCategory: 0,
            missingUnit: 0,
            duplicateSourceRows: 0,
            proposedActive: 1,
            proposedInactive: 0,
            proposedHistoryOnly: 0,
        },
    };
}

describe("routine import apply safety", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        prismaMock.$queryRaw.mockResolvedValue(asNever([]));
        prismaMock.auditLog.create.mockResolvedValue(asNever({ id: 1 }));
    });

    it("builds a validated RoutineTask input and accepts an unchanged manifest", () => {
        const row = makeRow();
        const input = buildRoutineImportTaskInput(row, 1, 2);
        expect(input.isActive).toBe(true);
        expect(input.assignees).toEqual([{ employeeId: 10, role: "OWNER" }]);
        expect(input.scheduleType).toBe("MONTHLY_DAY");
        expect(() => assertRoutineImportManifestApplySafe(makeManifest(row))).not.toThrow();
    });

    it("rejects a manifest that attempts to activate a row requiring review", () => {
        const row = { ...makeRow(), requiresReview: true, reviewReasons: ["AMBIGUOUS_SCHEDULE"] };
        expect(() => assertRoutineImportManifestApplySafe(makeManifest(row))).toThrow(
            "activate row",
        );
    });

    it("applies a row once and skips the same source fingerprint on rerun", async () => {
        const row = makeRow();
        const manifest = makeManifest(row);
        const task = {
            id: 101,
            version: 1,
        };
        const generationTask = {
            id: 101,
            isActive: true,
            scheduleType: "MONTHLY_DAY",
            scheduleConfig: { day: 10, monthOffset: 0 },
            businessDayPolicy: "NONE",
            version: 1,
            contractStartDate: null,
            contractEndDate: null,
            assignees: [{ employeeId: 10, role: "OWNER" }],
        };
        prismaMock.user.findUnique.mockResolvedValue(asNever({
            id: 99,
            role: "ADMIN",
            isActive: true,
            deletedAt: null,
            employee: { id: 99, status: "ACTIVE", deletedAt: null },
        }));
        prismaMock.routineUnit.findFirst.mockResolvedValue(asNever({ id: 1 }));
        prismaMock.routineCategory.findFirst.mockResolvedValue(asNever({ id: 2 }));
        prismaMock.employee.findMany.mockResolvedValue(asNever([{ id: 10 }]));
        prismaMock.routineImportLedger.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(asNever({
                sourceFingerprint: row.sourceFingerprint,
                status: "APPLIED",
                taskId: task.id,
            }));
        prismaMock.routineTask.findFirst.mockResolvedValue(null);
        prismaMock.routineUnit.upsert.mockResolvedValue(asNever({ id: 1 }));
        prismaMock.routineCategory.upsert.mockResolvedValue(asNever({ id: 2 }));
        prismaMock.routineTask.create.mockResolvedValue(asNever(task));
        prismaMock.routineTask.findUnique.mockResolvedValue(asNever(generationTask));
        prismaMock.routineOccurrence.findUnique.mockResolvedValue(null);
        prismaMock.routineOccurrence.upsert.mockResolvedValue(asNever({ id: 501 }));
        prismaMock.routineTask.findUniqueOrThrow.mockResolvedValue(asNever({ id: 101 }));
        prismaMock.routineImportLedger.create.mockResolvedValue(asNever({ id: 1 }));

        const actor = { id: 99, role: "ADMIN", email: "admin@example.com" };
        const first = await applyRoutineImportManifest(manifest, actor);
        const second = await applyRoutineImportManifest(manifest, actor);

        expect(first.inserted).toBe(1);
        expect(second.skipped).toBe(1);
        expect(prismaMock.routineTask.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.routineImportLedger.create).toHaveBeenCalledTimes(1);
    });

    it("marks a changed source row as conflict without overwriting the task", async () => {
        const row = makeRow();
        const manifest = makeManifest(row);
        prismaMock.routineImportLedger.findUnique.mockResolvedValue(asNever({
            id: 7,
            sourceFingerprint: "b".repeat(64),
            status: "APPLIED",
            taskId: 101,
        }));
        prismaMock.routineImportLedger.update.mockResolvedValue(asNever({ id: 7 }));

        const result = await applyRoutineImportManifest(
            manifest,
            { id: 99, role: "ADMIN", email: "admin@example.com" },
        );

        expect(result.conflicts).toBe(1);
        expect(prismaMock.routineImportLedger.update).toHaveBeenCalledWith({
            where: { id: 7 },
            data: {
                status: "CONFLICT",
                resolutionNote: "source fingerprint เปลี่ยนจาก manifest เดิม",
            },
        });
        expect(prismaMock.routineTask.create).not.toHaveBeenCalled();
    });
});
