import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const useAuthorizationAdministrationData = vi.hoisted(() => vi.fn());

vi.mock("./hooks/useAuthorizationAdministration", () => ({
    useAuthorizationAdministrationData,
}));

import { AuthorizationAdministrationWorkspace } from "./AuthorizationAdministrationWorkspace";
import type { AuthorizationAdministrationOverviewData } from "./types";

const capability = {
    key: "employee.read",
    registered: true,
    domain: "employee",
    description: "อ่านข้อมูลพนักงาน",
    supportedScopes: ["ALL"],
    supportedChannels: ["DASHBOARD"],
    runtimeAuthorizationMode: "CENTRAL_WITH_DEFAULT_POLICY",
    administrativeStatus: "GRANTABLE",
    administrativelyGrantable: true,
} satisfies AuthorizationAdministrationOverviewData["capabilities"][number];

const overview = {
    capabilities: [capability],
    teams: [],
    summary: {
        registeredCapabilityCount: 1,
        administrativelyGrantableCapabilityCount: 1,
        policyActivationRequiredCapabilityCount: 0,
        deferredCapabilityCount: 0,
        teamCount: 0,
        activeTeamCount: 0,
    },
} satisfies AuthorizationAdministrationOverviewData;

describe("AuthorizationAdministrationWorkspace", () => {
    it("presents task-oriented navigation and keeps the system view advanced", () => {
        useAuthorizationAdministrationData.mockReturnValue({
            overview,
            overviewError: undefined,
            overviewLoading: false,
            refreshOverview: vi.fn(async () => undefined),
            team: undefined,
            teamError: undefined,
            teamLoading: false,
            refreshTeam: vi.fn(async () => undefined),
            user: undefined,
            userError: undefined,
            userLoading: false,
            refreshUser: vi.fn(async () => undefined),
            directoryUsers: [],
            directoryError: undefined,
            directoryLoading: false,
        });

        render(<AuthorizationAdministrationWorkspace initialOverview={overview} />);

        expect(screen.getByRole("heading", { name: "การจัดการสิทธิ์" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "กลุ่มและบทบาท" })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("button", { name: "ผู้ใช้และสิทธิ์" })).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ขั้นสูง" }));

        expect(screen.getByRole("heading", { name: "ข้อมูลสิทธิ์ของระบบ" })).toBeInTheDocument();
        expect(screen.getByText("employee.read").closest("details")).not.toHaveAttribute("open");
    });
});
