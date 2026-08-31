// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const {
    requireLiffWorkforceSessionMock,
    getRoutineTaskWorkItemsMock,
    getRoutineSummaryMock,
} = vi.hoisted(() => ({
    requireLiffWorkforceSessionMock: vi.fn(),
    getRoutineTaskWorkItemsMock: vi.fn(),
    getRoutineSummaryMock: vi.fn(),
}));

vi.mock("@/lib/auth/liff", () => ({
    requireLiffWorkforceSession: requireLiffWorkforceSessionMock,
}));

vi.mock("@/lib/services/routine", () => ({
    getRoutineTaskWorkItems: getRoutineTaskWorkItemsMock,
    getRoutineSummary: getRoutineSummaryMock,
}));

import { GET as tasksRoute } from "@/app/api/line/routine/tasks/route";
import { GET as summaryRoute } from "@/app/api/line/routine/summary/route";

const ADMIN_LIFF_AUTH = {
    ok: true as const,
    user: {
        id: 7,
        role: "ADMIN",
        email: "admin@example.com",
        name: "Admin",
    },
    employeeId: 31,
};

function getRequest(path: string): NextRequest {
    return new NextRequest(`http://localhost${path}`, {
        method: "GET",
    });
}

describe("LIFF Routine API authorization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.unstubAllEnvs();
        requireLiffWorkforceSessionMock.mockResolvedValue(ADMIN_LIFF_AUTH);
        getRoutineTaskWorkItemsMock.mockResolvedValue({
            tasks: [],
            pagination: { page: 1, limit: 12, total: 0, pages: 0 },
        });
        getRoutineSummaryMock.mockResolvedValue({
            today: 1,
            dueSoon: 2,
            within30Days: 3,
            asOfDate: "2026-08-10",
        });
    });

    it("forces mine scope and ignores client identity/elevation parameters", async () => {
        const response = await tasksRoute(
            getRequest(
                "/api/line/routine/tasks?scope=all&employeeId=999&assigneeId=999&timingStatus=DUE_TODAY&page=2&limit=12",
            ),
        );

        expect(response.status).toBe(200);
        expect(getRoutineTaskWorkItemsMock).toHaveBeenCalledWith(
            {
                timingStatus: "DUE_TODAY",
                scope: "mine",
                page: 2,
                limit: 12,
            },
            expect.objectContaining({
                employeeId: 31,
                actor: expect.objectContaining({
                    id: 7,
                    role: "ADMIN",
                    email: "admin@example.com",
                }),
            }),
        );
    });

    it("projects Routine data to the fields needed by the LIFF card", async () => {
        getRoutineTaskWorkItemsMock.mockResolvedValueOnce({
            tasks: [{
                id: 71,
                title: "ตรวจสอบระบบ",
                description: "รายละเอียด",
                scheduleType: "MANUAL",
                scheduleText: "ตรวจตามรอบ",
                isActive: true,
                unit: { id: 1, code: "IT", name: "ฝ่าย IT" },
                category: { id: 2, name: "ระบบคอมพิวเตอร์" },
                assignees: [{ employeeId: 999, role: "OWNER" }],
                relevantOccurrence: {
                    id: 91,
                    taskId: 71,
                    periodKey: "2026-08",
                    dueDate: "2026-08-10",
                    originalDueDate: "2026-08-10",
                    scheduleVersion: 4,
                    reminderVersion: 2,
                    timingStatus: "DUE_TODAY",
                    isOverdue: false,
                    daysUntilDue: 0,
                    assignees: [{ employeeId: 999, role: "OWNER" }],
                },
            }],
            pagination: { page: 1, limit: 12, total: 1, pages: 1 },
        });

        const response = await tasksRoute(
            getRequest("/api/line/routine/tasks"),
        );

        await expect(response.json()).resolves.toEqual({
            tasks: [{
                id: 71,
                title: "ตรวจสอบระบบ",
                description: "รายละเอียด",
                scheduleType: "MANUAL",
                scheduleText: "ตรวจตามรอบ",
                unit: { code: "IT", name: "ฝ่าย IT" },
                category: { name: "ระบบคอมพิวเตอร์" },
                relevantOccurrence: {
                    dueDate: "2026-08-10",
                    timingStatus: "DUE_TODAY",
                    isOverdue: false,
                    daysUntilDue: 0,
                },
            }],
            pagination: { page: 1, limit: 12, total: 1, pages: 1 },
        });
    });

    it("passes deep-link focus through while keeping the server-enforced mine scope", async () => {
        const response = await tasksRoute(
            getRequest(
                "/api/line/routine/tasks?taskId=71&occurrenceId=91&scope=all&employeeId=999",
            ),
        );

        expect(response.status).toBe(200);
        expect(getRoutineTaskWorkItemsMock).toHaveBeenCalledWith(
            expect.objectContaining({
                taskId: 71,
                occurrenceId: 91,
                scope: "mine",
            }),
            expect.objectContaining({ employeeId: 31 }),
        );
    });

    it("returns unauthorized without a LIFF session", async () => {
        requireLiffWorkforceSessionMock.mockResolvedValueOnce({
            ok: false,
            response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        });

        const response = await tasksRoute(
            getRequest("/api/line/routine/tasks"),
        );

        expect(response.status).toBe(401);
        expect(getRoutineTaskWorkItemsMock).not.toHaveBeenCalled();
    });

    it("returns forbidden for an inactive workforce session", async () => {
        requireLiffWorkforceSessionMock.mockResolvedValueOnce({
            ok: false,
            response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        });

        const response = await summaryRoute(
            getRequest("/api/line/routine/summary"),
        );

        expect(response.status).toBe(403);
        expect(getRoutineSummaryMock).not.toHaveBeenCalled();
    });

    it("keeps an ADMIN LIFF summary employee-scoped even when scope=all is supplied", async () => {
        const response = await summaryRoute(
            getRequest("/api/line/routine/summary?scope=all&employeeId=999"),
        );

        expect(response.status).toBe(200);
        await expect(response.json()).resolves.toEqual({
            summary: {
                today: 1,
                dueSoon: 2,
                within30Days: 3,
                asOfDate: "2026-08-10",
            },
        });
        expect(getRoutineSummaryMock).toHaveBeenCalledWith(
            expect.objectContaining({
                employeeId: 31,
                scope: "mine",
                actor: expect.objectContaining({ id: 7, role: "ADMIN" }),
            }),
        );
    });

    it("rejects invalid timing filters before calling the Routine service", async () => {
        const response = await tasksRoute(
            getRequest("/api/line/routine/tasks?timingStatus=ALL"),
        );

        expect(response.status).toBe(400);
        expect(getRoutineTaskWorkItemsMock).not.toHaveBeenCalled();
    });

    it("follows the existing Routine feature guard", async () => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_ROUTINE", "false");

        const response = await tasksRoute(
            getRequest("/api/line/routine/tasks"),
        );

        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({
            error: "ขณะนี้ยังไม่เปิดใช้งาน Routine ผ่าน LIFF",
        });
        expect(requireLiffWorkforceSessionMock).not.toHaveBeenCalled();
    });
});
