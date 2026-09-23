import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    apiGet: vi.fn(),
}));

vi.mock("@/lib/client/api-client", () => ({
    apiGet: mocks.apiGet,
}));

import { useEmailRequestHistory } from "@/hooks/useEmailRequestHistory";

function createApiSuccess(
    page: number,
    totalPages: number,
    thaiName = `รายการหน้า ${page}`,
) {
    return {
        success: true,
        status: 200,
        requestId: `request-${page}-${thaiName}`,
        data: {
            success: true,
            emailRequests: [
                {
                    id: page,
                    thaiName,
                    englishName: "Test User",
                    phone: "0812345678",
                    nickname: "Test",
                    position: "เจ้าหน้าที่",
                    department: "บัญชี",
                    replyEmail: "test@example.com",
                    needsDocumentSystem: false,
                    sharedDriveAccess: [],
                    createdAt: "2026-09-01T00:00:00.000Z",
                    updatedAt: "2026-09-01T00:00:00.000Z",
                    requestedBy: 1,
                },
            ],
            pagination: {
                page,
                limit: 10,
                total: totalPages * 10,
                totalPages,
            },
        },
    };
}

function createDeferred<T>(): {
    promise: Promise<T>;
    resolve: (value: T) => void;
} {
    let resolvePromise: (value: T) => void = () => undefined;
    const promise = new Promise<T>((resolve) => {
        resolvePromise = resolve;
    });

    return { promise, resolve: resolvePromise };
}

describe("useEmailRequestHistory", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.apiGet.mockResolvedValue(createApiSuccess(1, 3));
    });

    it("projects initial loading until the first request settles", async () => {
        const request = createDeferred<ReturnType<typeof createApiSuccess>>();
        mocks.apiGet.mockReturnValueOnce(request.promise);

        const { result } = renderHook(() => useEmailRequestHistory());

        expect(result.current.isLoading).toBe(true);
        expect(result.current.emailRequests).toEqual([]);
        expect(result.current.error).toBeNull();

        await act(async () => {
            request.resolve(createApiSuccess(1, 3));
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.emailRequests[0]?.thaiName).toBe("รายการหน้า 1");
    });

    it("navigates pages and clamps page changes to the available range", async () => {
        const { result } = renderHook(() => useEmailRequestHistory());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => result.current.setCurrentPage(2));
        expect(result.current.currentPage).toBe(2);
        expect(result.current.isLoading).toBe(true);

        await waitFor(() => expect(mocks.apiGet).toHaveBeenLastCalledWith(
            "/api/email-request?page=2&limit=10",
        ));
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => result.current.setCurrentPage(99));
        expect(result.current.currentPage).toBe(3);
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => result.current.setCurrentPage(0));
        expect(result.current.currentPage).toBe(1);
    });

    it("keeps refresh on the current page and shows loading for a new refresh identity", async () => {
        const { result } = renderHook(() => useEmailRequestHistory());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => result.current.setCurrentPage(2));
        await waitFor(() => expect(result.current.isLoading).toBe(false));
        const refreshed = createDeferred<ReturnType<typeof createApiSuccess>>();
        mocks.apiGet.mockReturnValueOnce(refreshed.promise);

        act(() => result.current.refresh());

        expect(result.current.currentPage).toBe(2);
        expect(result.current.isLoading).toBe(true);
        expect(result.current.emailRequests).toEqual([]);
        await waitFor(() => expect(mocks.apiGet).toHaveBeenLastCalledWith(
            "/api/email-request?page=2&limit=10",
        ));

        await act(async () => {
            refreshed.resolve(createApiSuccess(2, 3, "รีเฟรชหน้า 2"));
        });

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.currentPage).toBe(2);
        expect(result.current.emailRequests[0]?.thaiName).toBe("รีเฟรชหน้า 2");
    });

    it("ignores an older page refresh after a newer page request succeeds", async () => {
        const { result } = renderHook(() => useEmailRequestHistory());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const oldPageRefresh = createDeferred<ReturnType<typeof createApiSuccess>>();
        const newPageRequest = createDeferred<ReturnType<typeof createApiSuccess>>();
        mocks.apiGet
            .mockReturnValueOnce(oldPageRefresh.promise)
            .mockReturnValueOnce(newPageRequest.promise);

        act(() => result.current.refresh());
        await waitFor(() => expect(mocks.apiGet).toHaveBeenCalledTimes(2));
        act(() => result.current.setCurrentPage(2));
        await waitFor(() => expect(mocks.apiGet).toHaveBeenCalledTimes(3));

        await act(async () => {
            newPageRequest.resolve(createApiSuccess(2, 3, "ผลลัพธ์หน้า 2"));
        });
        await waitFor(() => expect(result.current.emailRequests[0]?.thaiName).toBe("ผลลัพธ์หน้า 2"));

        await act(async () => {
            oldPageRefresh.resolve(createApiSuccess(1, 3, "ผลลัพธ์เก่าหน้า 1"));
        });

        expect(result.current.currentPage).toBe(2);
        expect(result.current.emailRequests[0]?.thaiName).toBe("ผลลัพธ์หน้า 2");
    });

    it("ignores an older refresh when a newer refresh of the same page succeeds", async () => {
        const { result } = renderHook(() => useEmailRequestHistory());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        const oldRefresh = createDeferred<ReturnType<typeof createApiSuccess>>();
        const newRefresh = createDeferred<ReturnType<typeof createApiSuccess>>();
        mocks.apiGet.mockReturnValueOnce(oldRefresh.promise);
        act(() => result.current.refresh());
        await waitFor(() => expect(mocks.apiGet).toHaveBeenCalledTimes(2));

        mocks.apiGet.mockReturnValueOnce(newRefresh.promise);
        act(() => result.current.refresh());
        await waitFor(() => expect(mocks.apiGet).toHaveBeenCalledTimes(3));

        await act(async () => {
            newRefresh.resolve(createApiSuccess(1, 3, "ผลลัพธ์รีเฟรชล่าสุด"));
        });
        await waitFor(() => expect(result.current.emailRequests[0]?.thaiName).toBe("ผลลัพธ์รีเฟรชล่าสุด"));

        await act(async () => {
            oldRefresh.resolve(createApiSuccess(1, 3, "ผลลัพธ์รีเฟรชเก่า"));
        });

        expect(result.current.emailRequests[0]?.thaiName).toBe("ผลลัพธ์รีเฟรชล่าสุด");
    });

    it("preserves the existing API error message behavior", async () => {
        mocks.apiGet.mockResolvedValueOnce({
            success: false,
            error: "API error",
            errorThai: "ข้อความภาษาไทยจาก API",
            code: "INTERNAL_ERROR",
            status: 500,
        });

        const { result } = renderHook(() => useEmailRequestHistory());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.error).toBe("API error");
    });

    it("uses safe Thai copy for unexpected network failures", async () => {
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.apiGet.mockRejectedValueOnce(new Error("provider details"));

        const { result } = renderHook(() => useEmailRequestHistory());

        await waitFor(() => expect(result.current.isLoading).toBe(false));
        expect(result.current.error).toBe("เกิดข้อผิดพลาดในการเชื่อมต่อ");
        expect(result.current.error).not.toContain("provider details");
        consoleError.mockRestore();
    });
});
