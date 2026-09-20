import { describe, expect, it } from "vitest";

import { formatTeamSummary, NO_TEAM_PRESENTATION } from "./team-presentation";

describe("team identity presentation", () => {
    it("uses a neutral fallback when no active Team is present", () => {
        expect(formatTeamSummary([])).toBe(NO_TEAM_PRESENTATION);
    });

    it("formats one Team as restrained secondary identity context", () => {
        expect(formatTeamSummary([{ id: 1, name: "IT" }])).toBe("ทีม IT");
        expect(formatTeamSummary([{ id: 2, name: "การเงิน" }])).toBe("ทีมการเงิน");
    });

    it("summarizes multiple Teams without rendering a pill row", () => {
        expect(formatTeamSummary([
            { id: 1, name: "IT" },
            { id: 2, name: "การเงิน" },
            { id: 3, name: "Operations" },
        ])).toBe("ทีม IT +2 ทีม");
    });
});
