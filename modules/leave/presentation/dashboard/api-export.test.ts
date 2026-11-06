import { describe, expect, it, vi } from "vitest";
import { downloadXlsx } from "@/lib/client/xlsx-download";
import { downloadLeaveExportFile } from "./api";

vi.mock("@/lib/client/xlsx-download", () => ({ downloadXlsx: vi.fn() }));

describe("leave XLSX download API", () => {
    it.each(["current-team", "approver-history"] as const)("forwards year and %s scope and errors", async (scope) => {
        vi.mocked(downloadXlsx).mockRejectedValueOnce(new Error("export failed"));
        await expect(downloadLeaveExportFile(2031, scope)).rejects.toThrow("export failed");
        expect(downloadXlsx).toHaveBeenLastCalledWith(`/api/leave/export?year=2031&format=xlsx&scope=${scope}`);
    });
});
