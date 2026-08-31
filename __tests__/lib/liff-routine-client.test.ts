import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
    apiPatch: vi.fn(),
    apiDelete: vi.fn(),
}));

vi.mock("@/lib/client/api-client", () => ({
    apiGet: mocks.apiGet,
    apiPost: mocks.apiPost,
    apiPatch: mocks.apiPatch,
    apiDelete: mocks.apiDelete,
}));

import {
    createLiffRoutineTask,
    deleteLiffRoutineTask,
    fetchLiffRoutineReference,
    fetchLiffRoutineTask,
    updateLiffRoutineTask,
} from "@/lib/client/liff-routine";
import { API_ROUTES } from "@/lib/ssot/routes";

const OPTIONS = {
    retryCount: 0,
    skipAuthRefresh: true,
};

function success<T>(data: T) {
    return {
        success: true as const,
        data,
        status: 200,
        requestId: "request-1",
    };
}

describe("LIFF Routine client contract", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("fetches reference data through the shared API client", async () => {
        const reference = {
            units: [],
            categories: [],
            scheduleTypes: ["MANUAL"],
            businessDayPolicies: ["NONE"],
        };
        mocks.apiGet.mockResolvedValueOnce(success(reference));

        await expect(fetchLiffRoutineReference()).resolves.toEqual(reference);
        expect(mocks.apiGet).toHaveBeenCalledWith(
            API_ROUTES.line.routineReference,
            OPTIONS,
        );
    });

    it("keeps the caller-provided idempotency key for repeated create attempts", async () => {
        const response = {
            task: { id: 71 },
            replayed: false,
        };
        mocks.apiPost.mockResolvedValue(success(response));
        const payload = {
            unitId: 1,
            categoryId: 2,
            title: "ตรวจสอบระบบ",
            scheduleType: "MANUAL" as const,
            scheduleConfig: {},
            businessDayPolicy: "NONE" as const,
            isActive: true,
        };

        await createLiffRoutineTask(payload, "same-key");
        await createLiffRoutineTask(payload, "same-key");

        expect(mocks.apiPost).toHaveBeenNthCalledWith(
            1,
            API_ROUTES.line.routineTasks,
            payload,
            { ...OPTIONS, headers: { "Idempotency-Key": "same-key" } },
        );
        expect(mocks.apiPost).toHaveBeenNthCalledWith(
            2,
            API_ROUTES.line.routineTasks,
            payload,
            { ...OPTIONS, headers: { "Idempotency-Key": "same-key" } },
        );
    });

    it("sends the expected version to update and uses the shared DELETE client", async () => {
        mocks.apiPatch.mockResolvedValueOnce(success({ task: { id: 71 } }));
        mocks.apiDelete.mockResolvedValueOnce(success({ success: true }));

        await updateLiffRoutineTask(71, { version: 4, title: "แก้ไขแล้ว" });
        await deleteLiffRoutineTask(71);

        expect(mocks.apiPatch).toHaveBeenCalledWith(
            API_ROUTES.line.routineTaskById(71),
            { version: 4, title: "แก้ไขแล้ว" },
            OPTIONS,
        );
        expect(mocks.apiDelete).toHaveBeenCalledWith(
            API_ROUTES.line.routineTaskById(71),
            OPTIONS,
        );
    });

    it("normalizes a stale-update conflict to an actionable Thai message", async () => {
        mocks.apiGet.mockResolvedValueOnce({
            success: false as const,
            error: "Conflict",
            errorThai: "",
            code: "UNKNOWN_ERROR" as const,
            status: 409,
        });

        await expect(fetchLiffRoutineTask(71)).rejects.toMatchObject({
            name: "LiffApiError",
            status: 409,
            message: "ข้อมูล Routine เปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่",
        });
    });

    it("preserves a server-provided resource-not-found message", async () => {
        mocks.apiGet.mockResolvedValueOnce({
            success: false as const,
            error: "ไม่พบงานประจำ",
            errorThai: "ไม่พบงานประจำ",
            code: "UNKNOWN_ERROR" as const,
            status: 404,
        });

        await expect(fetchLiffRoutineTask(71)).rejects.toMatchObject({
            name: "LiffApiError",
            status: 404,
            message: "ไม่พบงานประจำ",
        });
    });

    it("uses a resource-not-found fallback instead of the feature-disabled message", async () => {
        mocks.apiGet.mockResolvedValueOnce({
            success: false as const,
            error: "Not found",
            errorThai: "",
            code: "UNKNOWN_ERROR" as const,
            status: 404,
        });

        await expect(fetchLiffRoutineTask(71)).rejects.toMatchObject({
            name: "LiffApiError",
            status: 404,
            message: "ไม่พบข้อมูล Routine ที่ต้องการ",
        });
    });

    it("keeps the feature-disabled message for a feature guard response", async () => {
        mocks.apiGet.mockResolvedValueOnce({
            success: false as const,
            error: "ขณะนี้ยังไม่เปิดใช้งาน Routine ผ่าน LIFF",
            errorThai: "ขณะนี้ยังไม่เปิดใช้งาน Routine ผ่าน LIFF",
            code: "UNKNOWN_ERROR" as const,
            status: 404,
        });

        await expect(fetchLiffRoutineTask(71)).rejects.toMatchObject({
            name: "LiffApiError",
            status: 404,
            message: "ขณะนี้ยังไม่เปิดใช้งาน Routine ผ่าน LIFF",
        });
    });
});
