// @vitest-environment node
import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    class MockRoutineServiceError extends Error {
        readonly statusCode: number;

        constructor(message: string, statusCode: number) {
            super(message);
            this.statusCode = statusCode;
        }
    }

    return {
        requireLiffWorkforceSession: vi.fn(),
        getRoutineReferenceData: vi.fn(),
        getLiffRoutineTaskById: vi.fn(),
        createRoutineTask: vi.fn(),
        updateRoutineTask: vi.fn(),
        deleteRoutineTask: vi.fn(),
        enforceAuthenticatedMutationRateLimit: vi.fn(),
        RoutineServiceError: MockRoutineServiceError,
    };
});

vi.mock("@/lib/auth/liff", () => ({
    requireLiffWorkforceSession: mocks.requireLiffWorkforceSession,
}));

vi.mock("@/lib/security/mutation-rate-limit", () => ({
    enforceAuthenticatedMutationRateLimit:
        mocks.enforceAuthenticatedMutationRateLimit,
}));

vi.mock("@/lib/services/routine", () => ({
    RoutineServiceError: mocks.RoutineServiceError,
    getRoutineReferenceData: mocks.getRoutineReferenceData,
    getLiffRoutineTaskById: mocks.getLiffRoutineTaskById,
    getRoutineTaskWorkItems: vi.fn(),
    createRoutineTask: mocks.createRoutineTask,
    updateRoutineTask: mocks.updateRoutineTask,
    deleteRoutineTask: mocks.deleteRoutineTask,
}));

import {
    GET as getReference,
} from "@/app/api/line/routine/reference/route";
import {
    DELETE as deleteTask,
    GET as getTask,
    PATCH as updateTask,
} from "@/app/api/line/routine/tasks/[id]/route";
import {
    POST as createTask,
} from "@/app/api/line/routine/tasks/route";

const AUTH = {
    ok: true as const,
    user: {
        id: 7,
        role: "USER",
        email: "employee@example.com",
        name: "พนักงาน ทดสอบ",
    },
    employeeId: 31,
};

const CREATE_PAYLOAD = {
    unitId: 1,
    categoryId: 2,
    title: "ตรวจสอบระบบ",
    description: "รายละเอียด",
    scheduleType: "MONTHLY_DAY",
    scheduleConfig: { day: 10, monthOffset: 0 },
    scheduleText: "ทุกเดือน",
    businessDayPolicy: "NONE",
    isActive: true,
    reminderRules: [{
        daysBefore: 1,
        sendHour: 9,
        channel: "IN_APP",
        recipientScope: "ASSIGNEES",
        isActive: true,
    }],
};

function request(
    path: string,
    init?: ConstructorParameters<typeof NextRequest>[1],
): NextRequest {
    return new NextRequest(`http://localhost${path}`, init);
}

function taskDetail(
    capabilities: { canEdit: boolean; canDelete: boolean } = {
        canEdit: true,
        canDelete: true,
    },
): Record<string, unknown> {
    return {
        id: 71,
        title: "ตรวจสอบระบบ",
        description: "รายละเอียด",
        scheduleType: "MONTHLY_DAY",
        scheduleConfig: { day: 10, monthOffset: 0 },
        scheduleText: "ทุกเดือน",
        contractStartDate: "2026-01-01",
        contractEndDate: "2026-12-31",
        contractText: "สัญญารายปี",
        extraDetails: "รายละเอียดเพิ่มเติม",
        businessDayPolicy: "NONE",
        isActive: true,
        version: 3,
        unit: { id: 1, code: "IT", name: "ฝ่าย IT" },
        category: { id: 2, name: "ระบบคอมพิวเตอร์" },
        reminderRules: [{
            id: 91,
            daysBefore: 1,
            sendHour: 9,
            channel: "IN_APP",
            recipientScope: "ASSIGNEES",
            isActive: true,
        }],
        occurrences: [{
            id: 81,
            taskId: 71,
            periodKey: "2026-08",
            dueDate: "2026-08-10",
            originalDueDate: "2026-08-10",
            timingStatus: "DUE_TODAY",
            isOverdue: false,
            daysUntilDue: 0,
            scheduleVersion: 3,
            reminderVersion: 1,
            assignees: [{ employeeId: 31, role: "OWNER" }],
        }],
        canEdit: capabilities.canEdit,
        canDelete: capabilities.canDelete,
        createdById: capabilities.canDelete ? 7 : 99,
        sourceFileName: "internal.xlsx",
        sourceSheet: "Sheet1",
        sourceRow: 12,
    };
}

describe("LIFF Routine self-service route contracts", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        mocks.requireLiffWorkforceSession.mockResolvedValue(AUTH);
        mocks.enforceAuthenticatedMutationRateLimit.mockReturnValue(null);
        mocks.getRoutineReferenceData.mockResolvedValue({
            units: [{ id: 1, code: "IT", name: "ฝ่าย IT" }],
            categories: [{ id: 2, name: "ระบบคอมพิวเตอร์", sortOrder: 1 }],
            employees: [{
                id: 31,
                firstName: "พนักงาน",
                lastName: "ทดสอบ",
                nickname: null,
                departmentId: 4,
                notificationReady: true,
            }],
        });
        mocks.getLiffRoutineTaskById.mockResolvedValue(taskDetail());
        mocks.createRoutineTask.mockResolvedValue({
            task: { id: 71 },
            replayed: false,
        });
        mocks.updateRoutineTask.mockResolvedValue({ id: 71 });
        mocks.deleteRoutineTask.mockResolvedValue(undefined);
    });

    it("returns only self-service reference data", async () => {
        const response = await getReference(
            request("/api/line/routine/reference"),
        );
        const body = await response.json() as Record<string, unknown>;

        expect(response.status).toBe(200);
        expect(body).toEqual({
            units: [{ id: 1, code: "IT", name: "ฝ่าย IT" }],
            categories: [{ id: 2, name: "ระบบคอมพิวเตอร์", sortOrder: 1 }],
            scheduleTypes: [
                "MONTHLY_DAY",
                "MONTH_END",
                "INTERVAL_MONTHS",
                "YEARLY_DATE",
                "ONE_TIME",
                "MANUAL",
            ],
            businessDayPolicies: [
                "NONE",
                "PREVIOUS_BUSINESS_DAY",
                "NEXT_BUSINESS_DAY",
            ],
        });
        expect(body).not.toHaveProperty("employees");
    });

    it("creates with the linked employee as OWNER and preserves the idempotency key", async () => {
        const response = await createTask(
            request("/api/line/routine/tasks", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "Idempotency-Key": "routine-create-1",
                },
                body: JSON.stringify(CREATE_PAYLOAD),
            }),
        );

        expect(response.status).toBe(201);
        expect(mocks.createRoutineTask).toHaveBeenCalledWith(
            expect.objectContaining({
                title: "ตรวจสอบระบบ",
                assignees: [{ employeeId: 31, role: "OWNER" }],
            }),
            expect.objectContaining({ id: 7, role: "USER" }),
            { idempotencyKey: "routine-create-1" },
        );
        expect(mocks.getLiffRoutineTaskById).toHaveBeenCalledWith(
            71,
            expect.objectContaining({ employeeId: 31 }),
        );
    });

    it("rejects assignee and import metadata at the LIFF boundary", async () => {
        const response = await createTask(
            request("/api/line/routine/tasks", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "Idempotency-Key": "routine-create-2",
                },
                body: JSON.stringify({
                    ...CREATE_PAYLOAD,
                    assignees: [{ employeeId: 999, role: "OWNER" }],
                    sourceFileName: "spoof.xlsx",
                    sourceSheet: "Spoof",
                    sourceRow: 1,
                }),
            }),
        );

        expect(response.status).toBe(400);
        expect(mocks.createRoutineTask).not.toHaveBeenCalled();
    });

    it("rejects invalid input and missing idempotency keys before mutation", async () => {
        const invalid = await createTask(
            request("/api/line/routine/tasks", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "Idempotency-Key": "routine-create-3",
                },
                body: JSON.stringify({ ...CREATE_PAYLOAD, title: "" }),
            }),
        );
        expect(invalid.status).toBe(400);

        const missingKey = await createTask(
            request("/api/line/routine/tasks", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(CREATE_PAYLOAD),
            }),
        );
        expect(missingKey.status).toBe(400);
        expect(mocks.createRoutineTask).not.toHaveBeenCalled();
    });

    it("returns a replay without changing the LIFF contract", async () => {
        mocks.createRoutineTask.mockResolvedValueOnce({
            task: { id: 71 },
            replayed: true,
        });

        const response = await createTask(
            request("/api/line/routine/tasks", {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    "Idempotency-Key": "routine-create-replay",
                },
                body: JSON.stringify(CREATE_PAYLOAD),
            }),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toMatchObject({
            replayed: true,
            task: { id: 71, canEdit: true, canDelete: true },
        });
    });

    it("exposes assigned detail with edit but no delete and no internal metadata", async () => {
        mocks.getLiffRoutineTaskById.mockResolvedValueOnce(taskDetail({
            canEdit: true,
            canDelete: false,
        }));

        const response = await getTask(
            request("/api/line/routine/tasks/71"),
            { params: Promise.resolve({ id: "71" }) },
        );
        const body = await response.json() as { task: Record<string, unknown> };

        expect(response.status).toBe(200);
        expect(body.task).toMatchObject({ id: 71, canEdit: true, canDelete: false });
        expect(body.task).not.toHaveProperty("createdById");
        expect(body.task).not.toHaveProperty("sourceFileName");
        expect(body.task).not.toHaveProperty("sourceSheet");
        expect(body.task).not.toHaveProperty("sourceRow");
        expect(body.task).toEqual(expect.objectContaining({
            reminderRules: [{
                daysBefore: 1,
                sendHour: 9,
                channel: "IN_APP",
                recipientScope: "ASSIGNEES",
                isActive: true,
            }],
        }));
    });

    it("passes the expected version to the existing update service", async () => {
        const response = await updateTask(
            request("/api/line/routine/tasks/71", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ version: 3, title: "แก้ไขแล้ว" }),
            }),
            { params: Promise.resolve({ id: "71" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.updateRoutineTask).toHaveBeenCalledWith(
            71,
            { version: 3, title: "แก้ไขแล้ว" },
            expect.objectContaining({
                id: 7,
                role: "USER",
                mode: "LIFF_SELF_SERVICE",
            }),
        );
    });

    it("returns a conflict when the service rejects a stale version", async () => {
        mocks.updateRoutineTask.mockRejectedValueOnce(
            new mocks.RoutineServiceError(
                "ข้อมูลแม่แบบงานเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่",
                409,
            ),
        );

        const response = await updateTask(
            request("/api/line/routine/tasks/71", {
                method: "PATCH",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ version: 2, title: "ข้อมูลเก่า" }),
            }),
            { params: Promise.resolve({ id: "71" }) },
        );

        expect(response.status).toBe(409);
        await expect(response.json()).resolves.toEqual({
            error: "ข้อมูลแม่แบบงานเปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่",
        });
    });

    it("delegates delete authorization to the existing Routine service", async () => {
        const response = await deleteTask(
            request("/api/line/routine/tasks/71", { method: "DELETE" }),
            { params: Promise.resolve({ id: "71" }) },
        );

        expect(response.status).toBe(200);
        expect(mocks.deleteRoutineTask).toHaveBeenCalledWith(
            71,
            expect.objectContaining({
                id: 7,
                role: "USER",
                mode: "LIFF_SELF_SERVICE",
            }),
        );

        mocks.deleteRoutineTask.mockRejectedValueOnce(
            new mocks.RoutineServiceError("ไม่พบงานประจำ", 404),
        );
        const denied = await deleteTask(
            request("/api/line/routine/tasks/71", { method: "DELETE" }),
            { params: Promise.resolve({ id: "71" }) },
        );
        expect(denied.status).toBe(404);
    });

    it("requires an authenticated LIFF workforce session for mutation routes", async () => {
        mocks.requireLiffWorkforceSession.mockResolvedValueOnce({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        });

        const response = await deleteTask(
            request("/api/line/routine/tasks/71", { method: "DELETE" }),
            { params: Promise.resolve({ id: "71" }) },
        );

        expect(response.status).toBe(401);
        expect(mocks.deleteRoutineTask).not.toHaveBeenCalled();
    });
});
