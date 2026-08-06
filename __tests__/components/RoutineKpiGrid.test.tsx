import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { RoutineKpiGrid } from "@/components/dashboard/routine/RoutineKpiGrid";

describe("RoutineKpiGrid", () => {
    it("shows reminder-focused KPIs without an overdue card", () => {
        render(
            <RoutineKpiGrid
                summary={{
                    today: 1,
                    dueSoon: 2,
                    within30Days: 3,
                    asOfDate: "2026-08-06",
                }}
                isLoading={false}
            />,
        );

        expect(screen.getByText("งานถึงกำหนดวันนี้")).toBeInTheDocument();
        expect(screen.getByText("งานใกล้ถึงกำหนด 7 วัน")).toBeInTheDocument();
        expect(screen.getByText("งานภายใน 30 วัน")).toBeInTheDocument();
        expect(screen.queryByText("งานเกินกำหนด")).not.toBeInTheDocument();
    });
});
