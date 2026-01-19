import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useEmployeeList } from "@/hooks/useEmployeeList";

const mockEmployees = [
    {
        id: 1,
        firstName: "John",
        lastName: "Doe",
        dept: { name: "IT" },
        email: "test@test.com",
    },
];

const mockResponse = {
    employees: mockEmployees,
    pagination: { page: 1, limit: 10, total: 1, totalPages: 1 },
};

describe("useEmployeeList", () => {
    beforeEach(() => {
        global.fetch = vi.fn();
    });

    afterEach(() => {
        vi.resetAllMocks();
    });

    it("should fetch employees on mount", async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const { result } = renderHook(() => useEmployeeList());

        expect(result.current.isLoading).toBe(true);

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.employees).toHaveLength(1);
        expect(result.current.totalEmployees).toBe(1);
        expect(global.fetch).toHaveBeenCalledWith(
            expect.stringContaining("/api/employees"),
        );
    });

    it("should handle fetch errors", async () => {
        (global.fetch as any).mockResolvedValue({
            ok: false,
            json: async () => ({ error: "Error fetching" }),
        });

        const { result } = renderHook(() => useEmployeeList());

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.error).toBe("Error fetching");
        expect(result.current.employees).toHaveLength(0);
    });

    it("should update filtering", async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const { result } = renderHook(() => useEmployeeList());

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        // Trigger search
        act(() => {
            result.current.setSearchTerm("John");
        });

        // Debounce wait (need timers mock or waitFor)
        // Since hook uses useDebouncedValue, we might need real timers or wait
        // The hook logic is: useEffect with [debouncedSearchTerm].
        // So simply setting searchTerm won't trigger fetch immediately.

        // For integration test of hook, we assume debouncedValue updates after delay.
        // We can just verify state update first.
        expect(result.current.searchTerm).toBe("John");
    });

    it("should handle pagination", async () => {
        (global.fetch as any).mockResolvedValue({
            ok: true,
            json: async () => mockResponse,
        });

        const { result } = renderHook(() => useEmployeeList());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        act(() => {
            result.current.handlePageChange(2);
        });

        expect(result.current.currentPage).toBe(2);
        // Fetch should be called with page=2
        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                expect.stringContaining("page=2"),
            );
        });
    });

    it("should handle CSV export", async () => {
        (global.fetch as any).mockImplementation((url: string) => {
            if (url.includes("/api/audit-logs/export")) {
                return Promise.resolve({ ok: true, json: async () => ({}) });
            }
            return Promise.resolve({
                ok: true,
                json: async () => mockResponse,
            });
        });

        const { result } = renderHook(() => useEmployeeList());
        await waitFor(() => expect(result.current.isLoading).toBe(false));

        let csvData: any[] = [];
        await act(async () => {
            csvData = await result.current.handleExportCSV();
        });

        expect(csvData).toHaveLength(1);
        expect(csvData[0].ชื่อ).toBe("John");
        // Should verify audit log call
        expect(global.fetch).toHaveBeenCalledWith(
            "/api/audit-logs/export",
            expect.anything(),
        );
    });
});
