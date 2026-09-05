import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ApprovalHistoryList } from "./ApprovalHistoryList";

describe("ApprovalHistoryList", () => {
    it("shows a filtered empty state when the history query has no matches", () => {
        render(<ApprovalHistoryList history={[]} isFiltered />);

        expect(
            screen.getByText("ไม่พบประวัติการพิจารณาตามตัวกรองที่เลือก"),
        ).toBeInTheDocument();
        expect(
            screen.getByText("ลองปรับหรือล้างตัวกรองเพื่อดูรายการอื่น"),
        ).toBeInTheDocument();
        expect(screen.queryByText("ยังไม่มีข้อมูลการพิจารณาในระบบ")).not.toBeInTheDocument();
    });
});
