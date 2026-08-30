import { describe, expect, it } from "vitest";

import {
    buildLeaveApprovalsUrl,
} from "@/hooks/useLeaveApprovals";
import { buildLeaveProfileUrl } from "@/hooks/useLeaveProfile";

describe("leave history request URLs", () => {
    it("omits empty employee filters and serializes active filters safely", () => {
        const url = buildLeaveProfileUrl(2, {
            query: " ไข้หวัด ",
            leaveType: "SICK",
            status: "APPROVED",
            year: 2026,
        });
        const params = new URL(`http://localhost${url}`).searchParams;

        expect(params.get("page")).toBe("2");
        expect(params.get("limit")).toBe("10");
        expect(params.get("q")).toBe("ไข้หวัด");
        expect(params.get("leaveType")).toBe("SICK");
        expect(params.get("status")).toBe("APPROVED");
        expect(params.get("year")).toBe("2026");
        expect(params.has("employeeId")).toBe(false);
    });

    it("keeps approval pagination independent while adding only history filters", () => {
        const url = buildLeaveApprovalsUrl({
            pendingPage: 2,
            notTakenPage: 3,
            historyPage: 4,
            cancellationPage: 5,
            historyFilters: {
                query: "สมชาย",
                leaveType: "SICK",
                status: "APPROVED",
                year: 2026,
            },
        });
        const params = new URL(`http://localhost${url}`).searchParams;

        expect(params.get("pendingPage")).toBe("2");
        expect(params.get("notTakenPage")).toBe("3");
        expect(params.get("historyPage")).toBe("4");
        expect(params.get("cancellationPage")).toBe("5");
        expect(params.get("historyQuery")).toBe("สมชาย");
        expect(params.get("historyLeaveType")).toBe("SICK");
        expect(params.get("historyStatus")).toBe("APPROVED");
        expect(params.get("historyYear")).toBe("2026");
        expect(params.has("q")).toBe(false);
        expect(params.has("leaveType")).toBe(false);
    });

    it("does not add empty history parameters", () => {
        expect(buildLeaveProfileUrl(1, { query: " " })).toBe(
            "/api/leave/me?page=1&limit=10",
        );
        expect(
            buildLeaveApprovalsUrl({
                pendingPage: 1,
                notTakenPage: 1,
                historyPage: 1,
                cancellationPage: 1,
                historyFilters: {},
            }),
        ).toBe(
            "/api/leave/approvals?pendingPage=1&notTakenPage=1&historyPage=1&cancellationPage=1",
        );
    });
});
