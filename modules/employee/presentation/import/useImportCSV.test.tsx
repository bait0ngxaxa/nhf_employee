import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/helpers/file-validation", () => ({
    validateCSVFile: vi.fn(async () => ({ isValid: true })),
}));

import { ImportEmployeeCSV } from "./ImportEmployeeCSV";

function selectFile(file: File): void {
    fireEvent.change(screen.getByLabelText("เลือกไฟล์ CSV"), {
        target: { files: [file] },
    });
}

function createTextFile(content: string): File {
    const file = new File([content], "employees.csv", { type: "text/csv" });
    Object.defineProperty(file, "text", {
        configurable: true,
        value: async () => content,
    });
    return file;
}

describe("Employee CSV import limits", () => {
    it("rejects files larger than 5 MB in the browser", async () => {
        render(<ImportEmployeeCSV />);

        selectFile(new File(
            [new Uint8Array(5 * 1024 * 1024 + 1)],
            "employees.csv",
            { type: "text/csv" },
        ));

        await waitFor(() => {
            expect(screen.getByText("ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 5MB)")).toBeInTheDocument();
        });
        expect(screen.queryByText("ตรวจสอบข้อมูลก่อนนำเข้า")).not.toBeInTheDocument();
    });

    it("rejects more than 1,000 parsed Employee rows before posting", async () => {
        render(<ImportEmployeeCSV />);

        const rows = Array.from(
            { length: 1001 },
            (_, index) => `ชื่อ${index},นามสกุล${index},นักพัฒนา,ADMIN`,
        );
        selectFile(createTextFile(["ชื่อ,นามสกุล,ตำแหน่ง,แผนก", ...rows].join("\n")));

        await waitFor(() => {
            expect(screen.getByText("นำเข้าได้สูงสุด 1,000 แถวต่อครั้ง")).toBeInTheDocument();
        });
        expect(screen.queryByText("ตรวจสอบข้อมูลก่อนนำเข้า")).not.toBeInTheDocument();
    });
});
