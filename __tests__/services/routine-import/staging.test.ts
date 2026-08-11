import { beforeEach, describe, expect, it, vi } from "vitest";
import { type Prisma, type PrismaClient } from "@prisma/client";
import { mockDeep, mockReset } from "vitest-mock-extended";

import { prisma } from "@/lib/db/prisma";
import {
    createRoutineImportPreview,
    updateRoutineImportRow,
} from "@/lib/services/routine-import";
import { RoutineConflictError } from "@/lib/services/routine/errors";
import { getRoutineImportReferenceData } from "@/lib/services/routine-import/staging";
import type { RoutineImportRow } from "@/lib/services/routine-import";

const workbookMocks = vi.hoisted(() => ({
    buildRoutineImportManifest: vi.fn(),
    readRoutineWorkbook: vi.fn(),
}));

const xlsxSafetyMocks = vi.hoisted(() => ({
    getRoutineXlsxContainerIssue: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
    prisma: mockDeep<PrismaClient>(),
}));

vi.mock("@/lib/db/transaction", () => ({
    runSerializableTransaction: vi.fn(async (
        callback: (tx: Prisma.TransactionClient) => Promise<unknown>,
    ) => callback(prisma as unknown as Prisma.TransactionClient)),
}));

vi.mock("@/lib/services/routine/authorization", () => ({
    assertActiveAdminInTransaction: vi.fn(),
}));

vi.mock("@/lib/services/routine-import/workbook", () => workbookMocks);

vi.mock("@/lib/services/routine-import/xlsx-safety", () => xlsxSafetyMocks);

const prismaMock = prisma as unknown as ReturnType<typeof mockDeep<PrismaClient>>;

function asNever<T>(value: T): never {
    return value as unknown as never;
}

function actor() {
    return {
        id: 7,
        email: "admin@example.com",
        role: "ADMIN" as const,
        ipAddress: "192.0.2.7",
        userAgent: "routine-import-test",
        requestId: "routine-import-request",
        correlationId: "routine-import-correlation",
    };
}

function rowData(overrides: Partial<RoutineImportRow> = {}): RoutineImportRow {
    return {
        sourceFileName: "routine.xlsx",
        sourceSheet: "มสช.",
        sourceRow: 11,
        sourceFingerprint: "a".repeat(64),
        sourceCells: [],
        categorySourceText: "บุคลากร",
        ownerSourceText: "สมชาย",
        unitCode: "มสช.",
        unitName: "มสช.",
        categoryName: "บุคลากร",
        title: "ตรวจสอบงานประจำ",
        ownerNames: ["สมชาย"],
        mappedEmployeeIds: [],
        mappedEmployeeNames: [],
        mappedAssignees: [],
        reminderRules: [],
        scheduleText: "ทุกเดือน",
        contractText: null,
        extraDetails: null,
        normalizedSchedule: {
            scheduleType: "MANUAL",
            scheduleConfig: {},
            businessDayPolicy: "NONE",
        },
        contractStartDate: null,
        contractEndDate: null,
        requiresReview: true,
        reviewReasons: ["MISSING_OWNER"],
        proposedActivation: "ACTIVE",
        ...overrides,
    };
}

function storedRow(data = rowData(), overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 11,
        batchId: 1,
        sourceKey: "routine.xlsx:มสช.:11",
        sourceSheet: "มสช.",
        sourceRow: 11,
        sourceFingerprint: "a".repeat(64),
        status: "REQUIRES_REVIEW",
        selected: false,
        proposedActivation: "ACTIVE",
        reviewReasons: data.reviewReasons,
        appliedTaskId: null,
        version: 1,
        normalizedData: data,
        categoryName: data.categoryName,
        title: data.title,
        ownerNamesText: data.ownerNames.join(", "),
        batch: {
            id: 1,
            status: "READY",
            expiresAt: null,
        },
        ...overrides,
    };
}

function storedBatch(id: number, status: "READY" | "COMPLETED"): Record<string, unknown> {
    return {
        id,
        originalFileName: "routine.xlsx",
        fileHash: "b".repeat(64),
        targetSheet: "มสช.",
        ignoredSheets: [],
        asOfDate: new Date("2026-08-04T00:00:00.000Z"),
        status,
        uploadedById: 7,
        totalRows: 1,
        validRows: status === "READY" ? 1 : 0,
        reviewRows: status === "COMPLETED" ? 1 : 0,
        excludedRows: 0,
        alreadyImportedRows: 0,
        appliedRows: 0,
        conflictRows: 0,
        failedRows: 0,
        selectedRows: 1,
        unresolvedOwnerRows: status === "COMPLETED" ? 1 : 0,
        expiresAt: null,
        appliedAt: status === "COMPLETED" ? new Date("2026-08-04T01:00:00.000Z") : null,
        errorMessage: null,
        version: 1,
        createdAt: new Date("2026-08-04T00:00:00.000Z"),
        updatedAt: new Date("2026-08-04T00:00:00.000Z"),
        uploadedBy: { id: 7, name: "ผู้ดูแลระบบ" },
    };
}

function configureReference(employees: Array<Record<string, unknown>>): void {
    prismaMock.routineUnit.findMany.mockResolvedValue(asNever([{
        id: 1,
        code: "มสช.",
        name: "มสช.",
        isActive: true,
    }]));
    prismaMock.routineCategory.findMany.mockResolvedValue(asNever([{
        id: 2,
        name: "บุคลากร",
        sortOrder: 1,
        isActive: true,
    }]));
    prismaMock.employee.findMany.mockResolvedValue(asNever(employees));
}

const activeEmployee = {
    id: 10,
    firstName: "สมชาย",
    lastName: "ใจดี",
    nickname: "ชาย",
    departmentId: 3,
    status: "ACTIVE",
    deletedAt: null,
    user: { isActive: true, deletedAt: null },
};

const inactiveEmployee = {
    id: 11,
    firstName: "อดีต",
    lastName: "พนักงาน",
    nickname: "เก่า",
    departmentId: 3,
    status: "INACTIVE",
    deletedAt: null,
    user: { isActive: true, deletedAt: null },
};

describe("routine import preview reuse", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        vi.clearAllMocks();
        configureReference([activeEmployee]);
        xlsxSafetyMocks.getRoutineXlsxContainerIssue.mockReturnValue(null);
        workbookMocks.readRoutineWorkbook.mockReturnValue({
            SheetNames: ["มสช."],
            Sheets: { "มสช.": { "!ref": "A1:A2" } },
        });
        workbookMocks.buildRoutineImportManifest.mockReturnValue({
            rows: [rowData()],
            inspection: {
                sheets: [{ sheetName: "มสช.", dataRows: [{}] }],
            },
        });
    });

    it("reuses READY/PREVIEW/APPLYING but not terminal batches for the same workbook", async () => {
        const editableBatch = storedBatch(2, "READY");
        prismaMock.routineImportBatch.findFirst
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(asNever(editableBatch));
        prismaMock.routineImportBatch.findUnique.mockResolvedValue(asNever(editableBatch));
        const bytes = Uint8Array.from([0x50, 0x4b, 0x03, 0x04]);
        const file = {
            name: "routine.xlsx",
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            size: bytes.length,
            arrayBuffer: async () => bytes.buffer,
        } as unknown as File;

        const result = await createRoutineImportPreview(file, actor(), "2026-08-04");

        expect(result.batch).toEqual(expect.objectContaining({ id: 2, status: "READY" }));
        expect(result.reusedExisting).toBe(true);
        expect(prismaMock.routineImportBatch.findFirst).toHaveBeenNthCalledWith(
            1,
            expect.objectContaining({
                where: expect.objectContaining({
                    status: { in: ["READY", "PREVIEW", "APPLYING"] },
                }),
            }),
        );
        expect(prismaMock.routineImportBatch.findFirst).toHaveBeenNthCalledWith(
            2,
            expect.objectContaining({
                where: expect.objectContaining({
                    status: { in: ["READY", "PREVIEW", "APPLYING"] },
                }),
            }),
        );
    });
});

describe("routine import staging row updates", () => {
    beforeEach(() => {
        mockReset(prismaMock);
        configureReference([activeEmployee, inactiveEmployee]);
        prismaMock.routineImportRow.findUnique.mockResolvedValue(
            asNever(storedRow()),
        );
        prismaMock.routineImportRow.updateMany.mockResolvedValue(asNever({ count: 1 }));
        prismaMock.routineImportRow.findMany.mockResolvedValue(asNever([]));
        prismaMock.routineImportRow.findUniqueOrThrow.mockResolvedValue(
            asNever(storedRow(rowData({
                mappedEmployeeIds: [10],
                mappedEmployeeNames: ["สมชาย ใจดี"],
                mappedAssignees: [{ employeeId: 10, role: "OWNER" }],
                requiresReview: false,
                reviewReasons: [],
            }), {
                status: "VALID",
                selected: true,
                version: 2,
            })),
        );
        prismaMock.routineImportBatch.update.mockResolvedValue(asNever({ id: 1 }));
        prismaMock.auditLog.create.mockResolvedValue(asNever({ id: 1 }));
    });

    it("returns import reference employees with lifecycle and notification readiness", async () => {
        const result = await getRoutineImportReferenceData();

        expect(result.employees).toEqual(expect.arrayContaining([
            expect.objectContaining({
                id: 10,
                status: "ACTIVE",
                departmentId: 3,
                notificationReady: true,
            }),
            expect.objectContaining({
                id: 11,
                status: "INACTIVE",
                deletedAt: null,
                departmentId: 3,
                notificationReady: false,
            }),
        ]));
        expect(prismaMock.employee.findMany).toHaveBeenCalledWith(expect.objectContaining({
            select: expect.objectContaining({
                departmentId: true,
                status: true,
                deletedAt: true,
                user: { select: { isActive: true, deletedAt: true } },
            }),
        }));
    });

    it("marks a row VALID when it has one active owner and remains selected", async () => {
        prismaMock.routineImportRow.findMany.mockResolvedValue(asNever([
            { status: "VALID", selected: true, reviewReasons: [] },
            { status: "REQUIRES_REVIEW", selected: true, reviewReasons: ["MISSING_OWNER"] },
            { status: "EXCLUDED", selected: false, reviewReasons: [] },
        ]));
        const result = await updateRoutineImportRow(1, 11, {
            version: 1,
            categoryName: "บุคลากร",
            title: "ตรวจสอบงานประจำ",
            mappedAssignees: [{ employeeId: 10, role: "OWNER" }],
            scheduleText: "ทุกเดือน",
            scheduleType: "MANUAL",
            scheduleConfig: {},
            businessDayPolicy: "NONE",
            contractStartDate: null,
            contractEndDate: null,
            contractText: null,
            extraDetails: null,
            selected: true,
            reminderRules: [],
        }, actor());

        expect(result.status).toBe("VALID");
        expect(result.selected).toBe(true);
        expect(result.data.mappedEmployeeIds).toEqual([10]);
        expect(result.data.mappedEmployeeNames).toEqual(["สมชาย ใจดี"]);
        expect(prismaMock.routineImportBatch.update).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({
                totalRows: 3,
                validRows: 1,
                selectedRows: 2,
                unresolvedOwnerRows: 1,
            }),
        }));
    });

    it("keeps selected intent while unresolved and excludes only after a deliberate unselect", async () => {
        prismaMock.routineImportRow.findUniqueOrThrow.mockResolvedValue(
            asNever(storedRow(rowData(), { status: "REQUIRES_REVIEW", selected: true, version: 2 })),
        );

        const review = await updateRoutineImportRow(1, 11, {
            version: 1,
            categoryName: "บุคลากร",
            title: "ตรวจสอบงานประจำ",
            mappedAssignees: [],
            scheduleText: "ทุกเดือน",
            scheduleType: "MANUAL",
            scheduleConfig: {},
            businessDayPolicy: "NONE",
            contractStartDate: null,
            contractEndDate: null,
            contractText: null,
            extraDetails: null,
            selected: true,
            reminderRules: [],
        }, actor());

        expect(review.status).toBe("REQUIRES_REVIEW");
        expect(review.selected).toBe(true);
        expect(review.reviewReasons).toContain("MISSING_OWNER");
        expect(prismaMock.routineImportRow.updateMany).toHaveBeenCalledWith(expect.objectContaining({
            data: expect.objectContaining({ status: "REQUIRES_REVIEW", selected: true }),
        }));

        prismaMock.routineImportRow.findUniqueOrThrow.mockResolvedValue(
            asNever(storedRow(rowData({
                mappedEmployeeIds: [10],
                mappedEmployeeNames: ["สมชาย ใจดี"],
                mappedAssignees: [{ employeeId: 10, role: "OWNER" }],
                requiresReview: false,
                reviewReasons: [],
            }), { status: "EXCLUDED", selected: false, version: 2 })),
        );
        const excluded = await updateRoutineImportRow(1, 11, {
            version: 1,
            categoryName: "บุคลากร",
            title: "ตรวจสอบงานประจำ",
            mappedAssignees: [{ employeeId: 10, role: "OWNER" }],
            scheduleText: "ทุกเดือน",
            scheduleType: "MANUAL",
            scheduleConfig: {},
            businessDayPolicy: "NONE",
            contractStartDate: null,
            contractEndDate: null,
            contractText: null,
            extraDetails: null,
            selected: false,
            reminderRules: [],
        }, actor());

        expect(excluded.status).toBe("EXCLUDED");
        expect(excluded.selected).toBe(false);
    });

    it("keeps review reasons for missing, inactive, duplicate, and multiple owners", async () => {
        const cases = [
            {
                assignees: [{ employeeId: 999, role: "OWNER" as const }],
                reason: "OWNER_MAPPING_EMPLOYEE_NOT_FOUND:999",
            },
            {
                assignees: [{ employeeId: 11, role: "OWNER" as const }],
                reason: "OWNER_MAPPING_EMPLOYEE_INACTIVE:11",
            },
            {
                assignees: [
                    { employeeId: 10, role: "OWNER" as const },
                    { employeeId: 10, role: "CO_OWNER" as const },
                ],
                reason: "DUPLICATE_OWNER",
            },
            {
                assignees: [
                    { employeeId: 10, role: "OWNER" as const },
                    { employeeId: 11, role: "OWNER" as const },
                ],
                reason: "INVALID_OWNER_ROLE",
            },
        ];

        for (const testCase of cases) {
            prismaMock.routineImportRow.findUniqueOrThrow.mockResolvedValue(
                asNever(storedRow(rowData({
                    mappedEmployeeIds: testCase.assignees.map((assignee) => assignee.employeeId),
                    mappedEmployeeNames: [],
                    mappedAssignees: testCase.assignees,
                    requiresReview: true,
                    reviewReasons: [testCase.reason],
                }), { status: "REQUIRES_REVIEW", selected: true, version: 2 })),
            );
            const result = await updateRoutineImportRow(1, 11, {
                version: 1,
                categoryName: "บุคลากร",
                title: "ตรวจสอบงานประจำ",
                mappedAssignees: testCase.assignees,
                scheduleText: "ทุกเดือน",
                scheduleType: "MANUAL",
                scheduleConfig: {},
                businessDayPolicy: "NONE",
                contractStartDate: null,
                contractEndDate: null,
                contractText: null,
                extraDetails: null,
                selected: true,
                reminderRules: [],
            }, actor());

            expect(result.status).toBe("REQUIRES_REVIEW");
            expect(result.reviewReasons).toContain(testCase.reason);
        }
    });

    it("keeps an unknown employee visible in normalized names for removal", async () => {
        prismaMock.routineImportRow.findUniqueOrThrow.mockResolvedValue(
            asNever(storedRow(rowData({
                mappedEmployeeIds: [999],
                mappedEmployeeNames: ["ไม่พบข้อมูลพนักงาน (ID: 999)"],
                mappedAssignees: [{ employeeId: 999, role: "OWNER" }],
                requiresReview: true,
                reviewReasons: ["OWNER_MAPPING_EMPLOYEE_NOT_FOUND:999"],
            }), { status: "REQUIRES_REVIEW", selected: true, version: 2 })),
        );

        const result = await updateRoutineImportRow(1, 11, {
            version: 1,
            categoryName: "บุคลากร",
            title: "ตรวจสอบงานประจำ",
            mappedAssignees: [{ employeeId: 999, role: "OWNER" }],
            scheduleText: "ทุกเดือน",
            scheduleType: "MANUAL",
            scheduleConfig: {},
            businessDayPolicy: "NONE",
            contractStartDate: null,
            contractEndDate: null,
            contractText: null,
            extraDetails: null,
            selected: true,
            reminderRules: [],
        }, actor());

        expect(result.data.mappedEmployeeIds).toEqual([999]);
        expect(result.data.mappedEmployeeNames).toEqual(["ไม่พบข้อมูลพนักงาน (ID: 999)"]);
        expect(result.reviewReasons).toContain("OWNER_MAPPING_EMPLOYEE_NOT_FOUND:999");
    });

    it("clears a stale employee review reason after mapping an active employee", async () => {
        prismaMock.routineImportRow.findUnique.mockResolvedValue(
            asNever(storedRow(rowData({
                mappedEmployeeIds: [11],
                mappedEmployeeNames: ["อดีต พนักงาน"],
                mappedAssignees: [{ employeeId: 11, role: "OWNER" }],
                requiresReview: true,
                reviewReasons: ["OWNER_MAPPING_EMPLOYEE_INACTIVE:11"],
            }), { status: "REQUIRES_REVIEW", selected: true })),
        );
        prismaMock.routineImportRow.findUniqueOrThrow.mockResolvedValue(
            asNever(storedRow(rowData({
                mappedEmployeeIds: [10],
                mappedEmployeeNames: ["สมชาย ใจดี"],
                mappedAssignees: [{ employeeId: 10, role: "OWNER" }],
                requiresReview: false,
                reviewReasons: [],
            }), { status: "VALID", selected: true, version: 2 })),
        );

        const result = await updateRoutineImportRow(1, 11, {
            version: 1,
            categoryName: "บุคลากร",
            title: "ตรวจสอบงานประจำ",
            mappedAssignees: [{ employeeId: 10, role: "OWNER" }],
            scheduleText: "ทุกเดือน",
            scheduleType: "MANUAL",
            scheduleConfig: {},
            businessDayPolicy: "NONE",
            contractStartDate: null,
            contractEndDate: null,
            contractText: null,
            extraDetails: null,
            selected: true,
            reminderRules: [],
        }, actor());

        expect(result.status).toBe("VALID");
        expect(result.reviewReasons).toEqual([]);
        expect(result.data.mappedEmployeeIds).toEqual([10]);
        expect(result.data.mappedEmployeeNames).toEqual(["สมชาย ใจดี"]);
    });

    it("rejects a version mismatch and terminal rows or batches", async () => {
        prismaMock.routineImportRow.updateMany.mockResolvedValue(asNever({ count: 0 }));
        await expect(updateRoutineImportRow(1, 11, {
            version: 1,
            categoryName: "บุคลากร",
            title: "ตรวจสอบงานประจำ",
            mappedAssignees: [{ employeeId: 10, role: "OWNER" }],
            scheduleText: "ทุกเดือน",
            scheduleType: "MANUAL",
            scheduleConfig: {},
            businessDayPolicy: "NONE",
            contractStartDate: null,
            contractEndDate: null,
            contractText: null,
            extraDetails: null,
            selected: true,
            reminderRules: [],
        }, actor())).rejects.toBeInstanceOf(RoutineConflictError);

        prismaMock.routineImportRow.findUnique.mockResolvedValue(
            asNever(storedRow(rowData(), { status: "APPLIED" })),
        );
        await expect(updateRoutineImportRow(1, 11, {
            version: 1,
            categoryName: "บุคลากร",
            title: "ตรวจสอบงานประจำ",
            mappedAssignees: [{ employeeId: 10, role: "OWNER" }],
            scheduleText: "ทุกเดือน",
            scheduleType: "MANUAL",
            scheduleConfig: {},
            businessDayPolicy: "NONE",
            contractStartDate: null,
            contractEndDate: null,
            contractText: null,
            extraDetails: null,
            selected: true,
            reminderRules: [],
        }, actor())).rejects.toBeInstanceOf(RoutineConflictError);

        prismaMock.routineImportRow.findUnique.mockResolvedValue(
            asNever(storedRow(rowData(), { status: "REQUIRES_REVIEW", batch: { id: 1, status: "COMPLETED", expiresAt: null } })),
        );
        await expect(updateRoutineImportRow(1, 11, {
            version: 1,
            categoryName: "บุคลากร",
            title: "ตรวจสอบงานประจำ",
            mappedAssignees: [{ employeeId: 10, role: "OWNER" }],
            scheduleText: "ทุกเดือน",
            scheduleType: "MANUAL",
            scheduleConfig: {},
            businessDayPolicy: "NONE",
            contractStartDate: null,
            contractEndDate: null,
            contractText: null,
            extraDetails: null,
            selected: true,
            reminderRules: [],
        }, actor())).rejects.toBeInstanceOf(RoutineConflictError);
    });
});
