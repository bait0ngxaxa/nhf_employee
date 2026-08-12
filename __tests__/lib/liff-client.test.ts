import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiGetMock, apiPostMock } = vi.hoisted(() => ({
    apiGetMock: vi.fn(),
    apiPostMock: vi.fn(),
}));

vi.mock("@/lib/client/api-client", () => ({
    apiGet: apiGetMock,
    apiPost: apiPostMock,
}));

import {
    establishLiffSession,
    LiffApiError,
    linkLiffAccount,
} from "@/lib/client/liff";
import { fetchLiffRoutineSummary } from "@/lib/client/liff-routine";
import { API_ROUTES } from "@/lib/ssot/routes";

const WORKFORCE = {
    userId: 10,
    employeeId: 20,
    name: "พนักงาน ทดสอบ",
};

function failedResponse(status: number) {
    return {
        success: false as const,
        error: "provider detail",
        errorThai: "",
        code: status === 403 ? "FORBIDDEN" as const : "UNKNOWN_ERROR" as const,
        status,
    };
}

describe("global LIFF client", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("establishes the shared LIFF session without hybrid auth refresh", async () => {
        apiPostMock.mockResolvedValueOnce({
            success: true,
            data: { linked: true, workforce: WORKFORCE },
            status: 200,
            requestId: "request-1",
        });

        await expect(establishLiffSession("line-id-token")).resolves.toEqual({
            linked: true,
            workforce: WORKFORCE,
        });
        expect(apiPostMock).toHaveBeenCalledWith(
            API_ROUTES.line.liffSession,
            { idToken: "line-id-token" },
            { retryCount: 0, skipAuthRefresh: true },
        );
    });

    it("keeps account-link conflict messaging global", async () => {
        apiPostMock.mockResolvedValueOnce(failedResponse(409));

        await expect(linkLiffAccount("line-id-token")).rejects.toMatchObject({
            name: "LiffApiError",
            status: 409,
            message:
                "บัญชี LINE หรือบัญชี NHFapp นี้ถูกเชื่อมกับบัญชีอื่นอยู่แล้ว กรุณาติดต่อผู้ดูแลระบบ",
        });
    });

    it("uses generic non-Routine authorization errors for platform operations", async () => {
        apiPostMock.mockResolvedValueOnce(failedResponse(403));

        let error: unknown;
        try {
            await establishLiffSession("line-id-token");
        } catch (caught) {
            error = caught;
        }

        expect(error).toBeInstanceOf(LiffApiError);
        expect(error).toMatchObject({
            message: "บัญชี NHFapp นี้ยังไม่สามารถใช้บริการผ่าน LINE ได้",
        });
        expect(String(error)).not.toContain("Routine");
    });

    it("retains Routine-specific errors in the Routine client", async () => {
        apiGetMock.mockResolvedValueOnce(failedResponse(403));

        await expect(fetchLiffRoutineSummary()).rejects.toMatchObject({
            name: "LiffApiError",
            status: 403,
            message: "บัญชี NHF นี้ยังไม่สามารถเข้าถึง Routine ได้",
        });
    });
});
