import { describe, expect, it } from "vitest";

import { evaluateITAssigneeEligibility } from "./assignee-eligibility";

const ELIGIBLE_EVIDENCE = {
    activeWorkforce: true,
    hasConfiguredReadAll: true,
    hasConfiguredCommentAll: true,
    hasConfiguredManageAll: true,
} as const;

describe("IT Ticket assignee eligibility", () => {
    it("requires active workforce and configured ALL authority for all operator actions", () => {
        expect(evaluateITAssigneeEligibility(ELIGIBLE_EVIDENCE)).toBe(true);
    });

    it.each([
        ["active workforce", "activeWorkforce"],
        ["configured read ALL", "hasConfiguredReadAll"],
        ["configured comment ALL", "hasConfiguredCommentAll"],
        ["configured manage ALL", "hasConfiguredManageAll"],
    ] as const)("rejects eligibility when %s is missing", (_label, key) => {
        expect(evaluateITAssigneeEligibility({
            ...ELIGIBLE_EVIDENCE,
            [key]: false,
        })).toBe(false);
    });

    it("does not treat self-service defaults as configured operator authority", () => {
        expect(evaluateITAssigneeEligibility({
            activeWorkforce: true,
            hasConfiguredReadAll: false,
            hasConfiguredCommentAll: false,
            hasConfiguredManageAll: false,
        })).toBe(false);
    });

    it("does not require analytics authority", () => {
        expect(evaluateITAssigneeEligibility(ELIGIBLE_EVIDENCE)).toBe(true);
    });

    it("does not make an analytics-only user assignable", () => {
        expect(evaluateITAssigneeEligibility({
            activeWorkforce: true,
            hasConfiguredReadAll: false,
            hasConfiguredCommentAll: false,
            hasConfiguredManageAll: false,
        })).toBe(false);
    });

    it("ignores roles, organizational names, and default or analytics scopes", () => {
        const nonAuthorityEvidence = {
            activeWorkforce: true,
            hasConfiguredReadAll: false,
            hasConfiguredCommentAll: false,
            hasConfiguredManageAll: false,
            systemRole: "ADMIN",
            departmentName: "IT",
            teamName: "IT",
            teamRoleName: "Admin",
            defaultReadScopes: ["OWN"],
            defaultCommentScopes: ["OWN"],
            analyticsScopes: ["ALL"],
        };

        expect(evaluateITAssigneeEligibility(nonAuthorityEvidence)).toBe(false);
    });
});
