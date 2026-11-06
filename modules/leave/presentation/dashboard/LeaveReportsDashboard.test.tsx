import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { LeaveReportsDashboard } from "./LeaveReportsDashboard";
import {
    downloadLeaveExportFile,
    fetchLeaveExportMeta,
    fetchLeaveExportYears,
} from "./api";

vi.mock("./api", () => ({
    fetchLeaveExportYears: vi.fn(),
    fetchLeaveExportMeta: vi.fn(),
    downloadLeaveExportFile: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        info: vi.fn(),
        error: vi.fn(),
    },
}));

describe("LeaveReportsDashboard", () => {
    beforeEach(() => {
        vi.resetAllMocks();
        vi.mocked(downloadLeaveExportFile).mockResolvedValue(undefined);
    });

    it("keeps loading and blocks duplicates through the download response", async () => {
        vi.mocked(fetchLeaveExportYears).mockResolvedValue({ years: [2031] });
        vi.mocked(fetchLeaveExportMeta).mockResolvedValue({ year: 2031, scope: "approver-history", employeeCount: 2, requestCount: 5, maxRows: 3000 });
        let finish: (() => void) | undefined;
        vi.mocked(downloadLeaveExportFile).mockReturnValueOnce(new Promise<void>((resolve) => { finish = resolve; }));
        render(<LeaveReportsDashboard />);
        const button = screen.getByRole("button", { name: "ดาวน์โหลด Excel" });
        await waitFor(() => expect(button).toBeEnabled());
        fireEvent.click(button);
        fireEvent.click(button);
        await waitFor(() => expect(downloadLeaveExportFile).toHaveBeenCalledTimes(1));
        expect(button).toBeDisabled();
        expect(button).toHaveAttribute("aria-busy", "true");
        expect(toast.info).not.toHaveBeenCalled();
        await act(async () => { finish?.(); });
        expect(button).toBeEnabled();
        expect(toast.info).toHaveBeenCalledTimes(1);
    });

    it("reports download failures and enables retry", async () => {
        vi.mocked(fetchLeaveExportYears).mockResolvedValue({ years: [2031] });
        vi.mocked(fetchLeaveExportMeta).mockResolvedValue({ year: 2031, scope: "approver-history", employeeCount: 2, requestCount: 5, maxRows: 3000 });
        vi.mocked(downloadLeaveExportFile).mockRejectedValueOnce(new Error("ไม่มีสิทธิ์ดาวน์โหลด"));
        render(<LeaveReportsDashboard />);
        const button = screen.getByRole("button", { name: "ดาวน์โหลด Excel" });
        await waitFor(() => expect(button).toBeEnabled());
        fireEvent.click(button);
        await waitFor(() => expect(toast.error).toHaveBeenCalledWith("เกิดข้อผิดพลาดในการดาวน์โหลด", { description: "ไม่มีสิทธิ์ดาวน์โหลด" }));
        expect(button).toBeEnabled();
        expect(toast.info).not.toHaveBeenCalled();
    });

    it.each([0, 3001])("retains metadata validation for request count %i", async (count) => {
        vi.mocked(fetchLeaveExportYears).mockResolvedValue({ years: [2031] });
        vi.mocked(fetchLeaveExportMeta).mockResolvedValue({ year: 2031, scope: "approver-history", employeeCount: count === 0 ? 0 : 2, requestCount: count, maxRows: 3000 });
        render(<LeaveReportsDashboard />);
        await waitFor(() => expect(fetchLeaveExportMeta).toHaveBeenCalledWith(2031, "approver-history"));
        expect(screen.getByRole("button", { name: "ดาวน์โหลด Excel" })).toBeDisabled();
        expect(downloadLeaveExportFile).not.toHaveBeenCalled();
    });

    it("loads a newly added year and exports that year", async () => {
        vi.mocked(fetchLeaveExportYears).mockResolvedValue({
            years: [2031, 2030],
        });
        vi.mocked(fetchLeaveExportMeta).mockResolvedValue({
            year: 2031,
            scope: "approver-history",
            employeeCount: 2,
            requestCount: 5,
            maxRows: 3000,
        });

        render(<LeaveReportsDashboard />);

        await waitFor(() => {
            expect(fetchLeaveExportYears).toHaveBeenCalledTimes(1);
            expect(fetchLeaveExportMeta).toHaveBeenCalledWith(2031, "approver-history");
        });

        expect(screen.getByRole("combobox", { name: "เลือกปีรีพอร์ตการลา" })).toHaveTextContent(
            "2031",
        );
        await waitFor(() => {
            expect(screen.getByText("พนักงาน 2 คน / คำขอ 5 รายการ")).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: "ดาวน์โหลด Excel" }),
            ).toBeEnabled();
        });
        expect(
            screen.getByText(
                "ดาวน์โหลดรายละเอียดคำขอลาที่คุณเป็นผู้อนุมัติ โดยไม่แสดงสรุปโควต้าหรือยอดคงเหลือของพนักงาน",
            ),
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("button", { name: "ดาวน์โหลด Excel" }),
        );

        await waitFor(() => {
            expect(downloadLeaveExportFile).toHaveBeenCalledWith(2031, "approver-history");
        });
    });
});
