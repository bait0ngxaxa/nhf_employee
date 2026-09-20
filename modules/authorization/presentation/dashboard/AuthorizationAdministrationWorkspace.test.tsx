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
    it("presents the simplified Team and User workspace without the technical registry", () => {
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
            refreshDirectory: vi.fn(async () => undefined),
        });

        render(<AuthorizationAdministrationWorkspace initialOverview={overview} />);

        expect(screen.getByRole("heading", { name: "การจัดการสิทธิ์" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ทีม" })).toHaveAttribute("aria-current", "page");
        expect(screen.getByRole("button", { name: "ผู้ใช้งาน" })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "ขั้นสูง" })).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ผู้ใช้งาน" }));

        expect(screen.getByRole("heading", { name: "ค้นหาผู้ใช้งาน" })).toBeInTheDocument();
        expect(screen.queryByText("ข้อมูลสิทธิ์ของระบบ")).not.toBeInTheDocument();
    });
});
