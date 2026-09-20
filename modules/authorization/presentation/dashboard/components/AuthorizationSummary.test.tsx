import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AuthorizationSummary } from "./AuthorizationSummary";
import type { AuthorizationAdministrationOverviewData } from "../types";

const overview = {
    capabilities: [],
    teams: [
        {
            id: 1,
            key: "active-team",
            name: "Active Team",
            description: null,
            isActive: true,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            roleCount: 2,
            membershipCount: 4,
            teamGrantCount: 1,
        },
        {
            id: 2,
            key: "legacy-team",
            name: "Legacy Team",
            description: null,
            isActive: false,
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-02T00:00:00.000Z",
            roleCount: 1,
            membershipCount: 2,
            teamGrantCount: 3,
        },
    ],
    summary: {
        registeredCapabilityCount: 0,
        administrativelyGrantableCapabilityCount: 0,
        policyActivationRequiredCapabilityCount: 0,
        deferredCapabilityCount: 0,
        teamCount: 2,
        activeTeamCount: 1,
    },
} satisfies AuthorizationAdministrationOverviewData;

describe("AuthorizationSummary", () => {
    it("renders lifecycle state, filters inactive configuration, and opens a Team", () => {
        const onSelectTeam = vi.fn();

        render(
            <AuthorizationSummary
                overview={overview}
                loading={false}
                error={undefined}
                selectedTeamId={null}
                onSelectTeam={onSelectTeam}
                onCreateTeam={vi.fn()}
                onRefresh={vi.fn()}
            />,
        );

        expect(screen.getByText("Active Team")).toBeInTheDocument();
        expect(screen.getByText("Legacy Team")).toBeInTheDocument();
        expect(screen.getAllByText("ใช้งานอยู่").length).toBeGreaterThan(0);
        expect(screen.getAllByText("ปิดใช้งาน").length).toBeGreaterThan(0);

        fireEvent.change(screen.getByLabelText("สถานะ"), { target: { value: "INACTIVE" } });
        expect(screen.queryByText("Active Team")).not.toBeInTheDocument();
        expect(screen.getByText("Legacy Team")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "จัดการทีม" }));
        expect(onSelectTeam).toHaveBeenCalledWith(2);
    });

    it("submits a focused Team creation payload without an optimistic row", async () => {
        const onCreateTeam = vi.fn();
        render(
            <AuthorizationSummary
                overview={{ ...overview, teams: [] }}
                loading={false}
                error={undefined}
                selectedTeamId={null}
                onSelectTeam={vi.fn()}
                onCreateTeam={onCreateTeam}
                onRefresh={vi.fn()}
            />,
        );

        const createButtons = screen.getAllByRole("button", { name: "สร้างทีม" });
        expect(createButtons.length).toBeGreaterThan(0);
        fireEvent.click(createButtons[0] as HTMLElement);
        expect(onCreateTeam).toHaveBeenCalledTimes(1);
        expect(screen.queryByText("Active Team")).not.toBeInTheDocument();
    });
});
