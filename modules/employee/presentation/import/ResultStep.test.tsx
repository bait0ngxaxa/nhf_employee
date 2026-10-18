import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { downloadFailedRowsCSVMock } = vi.hoisted(() => ({
    downloadFailedRowsCSVMock: vi.fn(),
}));

vi.mock("./csv", () => ({
    downloadFailedRowsCSV: downloadFailedRowsCSVMock,
}));

import { ResultStep } from "./ResultStep";
import type { ImportResult } from "./types";

function createResult(): ImportResult {
    return {
        success: [],
        errors: Array.from({ length: 51 }, (_, index) => ({
            row: index + 2,
            data: {
                firstName: "พนักงาน" + index,
                lastName: "ทดสอบ",
                email: "employee" + index + "@thainhf.org",
                position: "เจ้าหน้าที่",
                department: "ADMIN",
            },
            error: "ข้อมูลไม่ผ่านการตรวจสอบ",
        })),
    };
}

describe("Employee import results", () => {
    it("paginates all rejected rows and exports the complete failed set", () => {
        const result = createResult();
        render(
            <ResultStep
                importResult={result}
                isRetryAttempt={false}
                onResetUpload={vi.fn()}
                onRetryFailedRows={vi.fn()}
            />,
        );

        expect(screen.getByText("แถว CSV ที่ 2")).toBeInTheDocument();
        expect(screen.getByText("employee0@thainhf.org")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /หน้าถัดไป/ }));
        expect(screen.getByText("แถว CSV ที่ 27")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /หน้าถัดไป/ }));
        expect(screen.getByText("แถว CSV ที่ 52")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", {
            name: "ดาวน์โหลดทุกรายการที่ไม่สำเร็จ",
        }));

        expect(downloadFailedRowsCSVMock).toHaveBeenCalledWith(result.errors);
        expect(screen.getAllByText(/51 แถวที่ไม่สำเร็จ/).length).toBeGreaterThan(0);
    });
});
