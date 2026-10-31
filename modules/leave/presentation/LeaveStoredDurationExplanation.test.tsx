import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeaveStoredDurationExplanation } from "./LeaveStoredDurationExplanation";

describe("stored leave duration explanation", () => {
    it.each([
        ["2030-05-09", "2030-05-13", 3, "5 วัน − วันเสาร์–อาทิตย์ 2 วัน = วันลาที่นับ 3 วัน"],
        ["2030-05-10", "2030-05-13", 2, "4 วัน − วันเสาร์–อาทิตย์ 2 วัน = วันลาที่นับ 2 วัน"],
        ["2030-05-08T17:00:00Z", "2030-05-12T17:00:00Z", 3, "5 วัน − วันเสาร์–อาทิตย์ 2 วัน = วันลาที่นับ 3 วัน"],
    ])("explains %s to %s", (startDate, endDate, durationDays, expected) => {
        render(<LeaveStoredDurationExplanation startDate={startDate} endDate={endDate} period="FULL_DAY" durationDays={durationDays} />);
        expect(screen.getByText(/จำนวนวันตามปฏิทิน/)).toHaveTextContent(expected);
    });
    it.each([
        ["2030-05-09", "2030-05-13", "FULL_DAY", 4],
        ["2030-05-06", "2030-05-10", "FULL_DAY", 5],
        ["2030-05-09", "2030-05-09", "FULL_DAY", 1],
        ["2030-05-09", "2030-05-09", "MORNING", 0.5],
        ["2030-05-09", "2030-05-09", "AFTERNOON", 0.5],
        ["invalid", "2030-05-09", "FULL_DAY", 1],
    ] as const)("omits unnecessary or inconsistent explanations", (startDate, endDate, period, durationDays) => {
        const { container } = render(<LeaveStoredDurationExplanation startDate={startDate} endDate={endDate} period={period} durationDays={durationDays} />);
        expect(container).toBeEmptyDOMElement();
    });
});
