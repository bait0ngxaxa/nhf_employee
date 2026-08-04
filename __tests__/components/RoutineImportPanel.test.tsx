import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { RoutineImportPanel } from "@/components/dashboard/routine/RoutineImportPanel";

describe("RoutineImportPanel", () => {
    beforeEach(() => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({ units: [], categories: [], employees: [] }),
        }));
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("explains the exact sheet scope before upload", () => {
        render(<RoutineImportPanel />);

        expect(screen.getByText("นำเข้าข้อมูลจาก Excel")).toBeInTheDocument();
        expect(screen.getByText(/อ่านเฉพาะชีต มสช/)).toBeInTheDocument();
        expect(screen.getByText(/ขนาดไฟล์ไม่เกิน 10 MB/)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /อัปโหลดและดูตัวอย่าง/ })).toBeDisabled();
    });
});
