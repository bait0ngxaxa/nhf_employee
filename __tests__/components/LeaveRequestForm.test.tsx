import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LeaveRequestForm } from "@/components/dashboard/leave/LeaveRequestForm";
import type { LeaveQuota } from "@/hooks/useLeaveProfile";
import { submitLeaveRequest } from "@/lib/services/leave/client";

vi.mock("@/lib/services/leave/client", () => ({
    submitLeaveRequest: vi.fn(),
}));

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

function createQuota(totalDays: number, usedDays: number): LeaveQuota {
    return {
        id: 1,
        year: 2031,
        employeeId: 1,
        leaveType: "SICK",
        totalDays,
        usedDays,
        createdAt: "2031-01-01T00:00:00.000Z",
        updatedAt: "2031-01-01T00:00:00.000Z",
    };
}

describe("LeaveRequestForm", () => {
    const onCancel = vi.fn();
    const onSuccess = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(submitLeaveRequest).mockResolvedValue(undefined);
    });

    it("renders the leave request form as an accessible modal dialog", () => {
        render(
            <LeaveRequestForm
                open
                onCancel={onCancel}
                onSuccess={onSuccess}
                quotas={[createQuota(10, 0)]}
            />,
        );

        expect(screen.getByRole("dialog", { name: "ยื่นใบลา" })).toBeInTheDocument();
        expect(
            screen.getByText(
                "กรอกช่วงวันที่และเหตุผลให้ครบถ้วน ระบบจะตรวจเงื่อนไขลาย้อนหลังและการลาเกินสิทธิ์ให้ก่อนส่งคำขอ",
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "ปิดแบบฟอร์มยื่นใบลา" }),
        ).toBeInTheDocument();
    });

    it("calls cancel callback from the dialog footer", () => {
        render(
            <LeaveRequestForm
                open
                onCancel={onCancel}
                onSuccess={onSuccess}
                quotas={[createQuota(10, 0)]}
            />,
        );

        fireEvent.click(screen.getByRole("button", { name: "ยกเลิก" }));

        expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it("shows special reason requirements when the request exceeds quota", () => {
        render(
            <LeaveRequestForm
                open
                onCancel={onCancel}
                onSuccess={onSuccess}
                quotas={[createQuota(1, 1)]}
            />,
        );

        expect(screen.getByLabelText("เหตุผลพิเศษ")).toBeInTheDocument();
        expect(screen.getAllByText(/คำขอนี้เกินสิทธิ์ 1 วัน/).length).toBeGreaterThan(0);
    });
});
