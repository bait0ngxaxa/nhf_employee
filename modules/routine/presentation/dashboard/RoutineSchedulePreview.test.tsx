import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import type { ComponentProps } from "react";

import { RoutineSchedulePreview } from "./RoutineSchedulePreview";

type PreviewProps = ComponentProps<typeof RoutineSchedulePreview>;

const DEFAULT_PROPS: PreviewProps = {
    scheduleType: "MONTHLY_DAY" as const,
    scheduleConfig: { day: 10, monthOffset: 0 },
    businessDayPolicy: "NONE" as const,
    contractStartDate: "",
    contractEndDate: "",
};

function renderPreview(overrides: Partial<PreviewProps> = {}) {
    return render(<RoutineSchedulePreview {...DEFAULT_PROPS} {...overrides} />);
}

function getPreviewRegion(): HTMLElement {
    return screen.getByRole("region", { name: "ตัวอย่างกำหนดการถัดไป" });
}

function getDueDates(preview: HTMLElement): string[] {
    const items = within(preview)
        .getByRole("list", { name: "วันที่ครบกำหนดที่คำนวณได้" })
        .querySelectorAll("li");
    return Array.from(items, (item) => item.querySelector("time")?.dateTime ?? "");
}

describe("RoutineSchedulePreview", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2030-01-01T05:00:00.000Z"));
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("previews up to five monthly day dates and preserves missing day 31 months", () => {
        renderPreview({ scheduleConfig: { day: 31, monthOffset: 0 } });

        const preview = getPreviewRegion();
        expect(preview).toHaveTextContent("แสดง 5 รายการแรกจาก 7 รายการในช่วงนี้");
        expect(getDueDates(preview)).toEqual([
            "2030-01-31",
            "2030-03-31",
            "2030-05-31",
            "2030-07-31",
            "2030-08-31",
        ]);
    });

    it("uses month end and keeps February 29 in a leap year", () => {
        vi.setSystemTime(new Date("2028-01-01T05:00:00.000Z"));
        renderPreview({ scheduleType: "MONTH_END", scheduleConfig: {} });

        expect(getDueDates(getPreviewRegion()).slice(0, 5)).toEqual([
            "2028-01-31",
            "2028-02-29",
            "2028-03-31",
            "2028-04-30",
            "2028-05-31",
        ]);
    });

    it("uses interval-month anchors to find upcoming occurrences", () => {
        renderPreview({
            scheduleType: "INTERVAL_MONTHS",
            scheduleConfig: { intervalMonths: 3, anchorDate: "2030-01-31" },
        });

        expect(getDueDates(getPreviewRegion())).toEqual([
            "2030-01-31",
            "2030-07-31",
            "2030-10-31",
            "2031-01-31",
            "2031-07-31",
        ]);
    });

    it("looks far enough ahead to show five leap-day yearly occurrences", () => {
        vi.setSystemTime(new Date("2027-01-01T05:00:00.000Z"));
        renderPreview({
            scheduleType: "YEARLY_DATE",
            scheduleConfig: { month: 2, day: 29 },
        });

        expect(getDueDates(getPreviewRegion())).toEqual([
            "2028-02-29",
            "2032-02-29",
            "2036-02-29",
            "2040-02-29",
            "2044-02-29",
        ]);
    });

    it("shows one-time weekend adjustments and reports no overdue one-time date", () => {
        const view = renderPreview({
            scheduleType: "ONE_TIME",
            scheduleConfig: { date: "2030-03-02" },
            businessDayPolicy: "NEXT_BUSINESS_DAY",
        });

        const preview = getPreviewRegion();
        expect(getDueDates(preview)).toEqual(["2030-03-04"]);
        expect(preview).toHaveTextContent("วันเดิม");
        expect(preview).toHaveTextContent("ตรงกับวันเสาร์ จึงเลื่อนไปวันทำการถัดไป");
        expect(preview).toHaveTextContent("ไม่รวมวันหยุดนักขัตฤกษ์");

        view.rerender(
            <RoutineSchedulePreview
                {...DEFAULT_PROPS}
                scheduleType="ONE_TIME"
                scheduleConfig={{ date: "2029-12-01" }}
            />,
        );
        expect(getPreviewRegion()).toHaveTextContent("พบ 0 รายการในช่วงนี้");
    });

    it("includes a one-time date just before today when its adjustment is upcoming", () => {
        vi.setSystemTime(new Date("2030-03-02T17:00:00.000Z"));
        renderPreview({
            scheduleType: "ONE_TIME",
            scheduleConfig: { date: "2030-03-02" },
            businessDayPolicy: "NEXT_BUSINESS_DAY",
        });

        const preview = getPreviewRegion();
        expect(getDueDates(preview)).toEqual(["2030-03-04"]);
        expect(preview).toHaveTextContent("พบ 1 รายการในช่วงนี้");
    });

    it("applies contract boundaries to adjusted due dates", () => {
        renderPreview({
            scheduleConfig: { day: 10, monthOffset: 0 },
            businessDayPolicy: "NEXT_BUSINESS_DAY",
            contractStartDate: "2030-03-11",
            contractEndDate: "2030-05-10",
        });

        const preview = getPreviewRegion();
        expect(preview).toHaveTextContent("พบ 3 รายการในช่วงนี้");
        expect(getDueDates(preview)).toEqual([
            "2030-03-11",
            "2030-04-10",
            "2030-05-10",
        ]);
    });

    it("recalculates when the business-day policy and contract end date change", () => {
        const view = renderPreview({
            scheduleType: "ONE_TIME",
            scheduleConfig: { date: "2030-03-02" },
        });
        expect(getDueDates(getPreviewRegion())).toEqual(["2030-03-02"]);

        view.rerender(
            <RoutineSchedulePreview
                {...DEFAULT_PROPS}
                scheduleType="ONE_TIME"
                scheduleConfig={{ date: "2030-03-02" }}
                businessDayPolicy="NEXT_BUSINESS_DAY"
                contractStartDate="2030-03-04"
                contractEndDate="2030-03-04"
            />,
        );
        const preview = getPreviewRegion();
        expect(getDueDates(preview)).toEqual(["2030-03-04"]);
        expect(preview).toHaveTextContent("เลื่อนไปวันทำการถัดไป");

        view.rerender(
            <RoutineSchedulePreview
                {...DEFAULT_PROPS}
                scheduleType="ONE_TIME"
                scheduleConfig={{ date: "2030-03-02" }}
                businessDayPolicy="NEXT_BUSINESS_DAY"
                contractEndDate="2029-12-31"
            />,
        );
        const emptyPreview = getPreviewRegion();
        expect(emptyPreview).toHaveTextContent("พบ 0 รายการในช่วงนี้");
        expect(within(emptyPreview).queryByRole("list")).not.toBeInTheDocument();
    });

    it("explains manual schedules without showing generated occurrences", () => {
        renderPreview({ scheduleType: "MANUAL", scheduleConfig: {} });

        const preview = getPreviewRegion();
        expect(preview).toHaveTextContent("ไม่มีรายการที่จะเกิดขึ้นโดยอัตโนมัติ");
        expect(within(preview).queryByRole("list")).not.toBeInTheDocument();
    });

    it("shows schema validation feedback for incomplete or impossible dates", () => {
        const view = renderPreview({ scheduleConfig: {} });
        expect(getPreviewRegion()).toHaveTextContent("กรุณาระบุวันที่ตั้งแต่ 1 ถึง 31");

        view.rerender(
            <RoutineSchedulePreview
                {...DEFAULT_PROPS}
                scheduleType="YEARLY_DATE"
                scheduleConfig={{ month: 2, day: 31 }}
            />,
        );
        expect(getPreviewRegion()).toHaveTextContent("เดือนและวันที่กำหนดไม่สัมพันธ์กัน");
    });

    it("recalculates the next due dates when a schedule value changes", () => {
        const view = renderPreview({ scheduleConfig: { day: 10, monthOffset: 0 } });
        expect(getDueDates(getPreviewRegion())[0]).toBe("2030-01-10");

        view.rerender(
            <RoutineSchedulePreview
                {...DEFAULT_PROPS}
                scheduleConfig={{ day: 20, monthOffset: 0 }}
            />,
        );
        expect(getDueDates(getPreviewRegion())[0]).toBe("2030-01-20");
    });
});
