import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeaveReportsDashboard } from "@/components/dashboard/leave/LeaveReportsDashboard";
import {
    downloadLeaveExportFile,
    fetchLeaveExportMeta,
    fetchLeaveExportYears,
} from "@/lib/services/leave/client";

vi.mock("@/lib/services/leave/client", () => ({
    fetchLeaveExportYears: vi.fn(),
    fetchLeaveExportMeta: vi.fn(),
    downloadLeaveExportFile: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

describe("LeaveReportsDashboard", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("loads a newly added year and exports that year", async () => {
        vi.mocked(fetchLeaveExportYears).mockResolvedValue({
            years: [2031, 2030],
        });
        vi.mocked(fetchLeaveExportMeta).mockResolvedValue({
            count: 5,
            maxRows: 3000,
        });

        render(<LeaveReportsDashboard />);

        await waitFor(() => {
            expect(fetchLeaveExportYears).toHaveBeenCalledTimes(1);
            expect(fetchLeaveExportMeta).toHaveBeenCalledWith(2031);
        });

        expect(screen.getByRole("combobox", { name: "เลือกปีรีพอร์ตการลา" })).toHaveTextContent(
            "2031",
        );
        await waitFor(() => {
            expect(screen.getByText("5 รายการ")).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: "ดาวน์โหลด CSV" }),
            ).toBeEnabled();
        });

        fireEvent.click(
            screen.getByRole("button", { name: "ดาวน์โหลด CSV" }),
        );

        await waitFor(() => {
            expect(downloadLeaveExportFile).toHaveBeenCalledWith(2031);
        });
    });
});
