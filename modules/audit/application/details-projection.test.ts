import { describe, expect, it } from "vitest";

import {
    projectAuditDetails,
    projectSerializedAuditDetails,
} from "./details-projection";

const CANARY = "CANARY-7f3a-เหตุผลส่วนตัวห้ามรั่ว";
const ACTION = "LEAVE_REQUEST_SPECIAL_REASON_UPDATE" as const;

const legacyDetails = {
    before: { status: "PENDING", specialReason: `${CANARY}-previous` },
    after: { status: "PENDING", specialReason: CANARY },
    metadata: {
        leaveRequestId: "cm0leave0001",
        employeeId: 41,
        employeeName: "สมหญิง ใจดี",
        leaveType: "PERSONAL",
        startDate: "2031-01-06T00:00:00.000Z",
        endDate: "2031-01-07T00:00:00.000Z",
        period: "FULL_DAY",
        durationDays: 2,
        reason: CANARY,
    },
    specialReason: CANARY,
    request: { specialReason: CANARY },
};

describe("projectAuditDetails", () => {
    it("reduces legacy special-reason rows to presence markers and safe context", () => {
        const projected = projectAuditDetails(ACTION, legacyDetails);

        expect(JSON.stringify(projected)).not.toContain("CANARY");
        expect(projected).toEqual({
            before: { status: "PENDING", hasSpecialReason: true },
            after: { status: "PENDING", hasSpecialReason: true },
            metadata: {
                leaveRequestId: "cm0leave0001",
                employeeId: 41,
                employeeName: "สมหญิง ใจดี",
                leaveType: "PERSONAL",
                startDate: "2031-01-06T00:00:00.000Z",
                endDate: "2031-01-07T00:00:00.000Z",
                period: "FULL_DAY",
                durationDays: 2,
                changedField: "specialReason",
                changeType: "UPDATED",
            },
        });
    });

    it("derives an ADDED change for legacy rows without a previous reason", () => {
        const projected = projectAuditDetails(ACTION, {
            before: { status: "PENDING", specialReason: null },
            after: { status: "PENDING", specialReason: CANARY },
            metadata: { leaveRequestId: "cm0leave0001" },
        });

        expect(projected).toEqual({
            before: { status: "PENDING", hasSpecialReason: false },
            after: { status: "PENDING", hasSpecialReason: true },
            metadata: {
                leaveRequestId: "cm0leave0001",
                changedField: "specialReason",
                changeType: "ADDED",
            },
        });
    });

    it("keeps the minimized payload written by the current producer", () => {
        const current = {
            before: { status: "PENDING", hasSpecialReason: false },
            after: { status: "PENDING", hasSpecialReason: true },
            metadata: {
                leaveRequestId: "cm0leave0001",
                leaveType: "SICK",
                period: "MORNING",
                startDate: "2031-01-06T00:00:00.000Z",
                endDate: "2031-01-06T00:00:00.000Z",
                durationDays: 0.5,
                changedField: "specialReason",
                changeType: "ADDED",
            },
        };

        expect(projectAuditDetails(ACTION, current)).toEqual(current);
    });

    it.each([
        ["nested objects in known fields", {
            before: { status: { text: CANARY }, specialReason: { text: CANARY } },
            after: { status: CANARY, hasSpecialReason: CANARY },
            metadata: { leaveRequestId: CANARY, employeeName: { CANARY }, leaveType: CANARY, startDate: CANARY, changeType: CANARY },
        }],
        ["sections that are arrays or strings", { before: [CANARY], after: CANARY, metadata: [CANARY] }],
        ["an overlong free-text name", { metadata: { employeeName: `${CANARY}${"x".repeat(300)}` } }],
    ])("fails safely for %s", (_label, details) => {
        const projected = projectAuditDetails(ACTION, details);

        expect(JSON.stringify(projected)).not.toContain("CANARY");
        expect(projected).toMatchObject({ metadata: { changedField: "specialReason" } });
    });

    it.each([[["array", CANARY]], [CANARY], [42]])("returns null for a non-object payload %#", (details) => {
        expect(projectAuditDetails(ACTION, details as unknown as Record<string, unknown>)).toBeNull();
    });

    it("leaves unrelated actions untouched, including fields named reason", () => {
        const details = {
            after: { status: "REJECTED", reason: "เอกสารไม่ครบ" },
            metadata: { reason: "เอกสารไม่ครบ", specialReason: "unrelated" },
        };

        expect(projectAuditDetails("LEAVE_REQUEST_REJECT", details)).toBe(details);
        expect(projectAuditDetails("EMPLOYEE_UPDATE", null)).toBeNull();
    });
});

describe("projectSerializedAuditDetails", () => {
    it("projects serialized legacy rows for raw history readers", () => {
        const projected = projectSerializedAuditDetails(ACTION, JSON.stringify(legacyDetails));

        expect(projected).not.toContain("CANARY");
        expect(JSON.parse(projected ?? "null")).toMatchObject({
            after: { hasSpecialReason: true },
            metadata: { leaveRequestId: "cm0leave0001", changeType: "UPDATED" },
        });
    });

    it("returns null for malformed serialized details of a protected action", () => {
        expect(projectSerializedAuditDetails(ACTION, `{"after":{"specialReason":"${CANARY}"`)).toBeNull();
        expect(projectSerializedAuditDetails(ACTION, JSON.stringify(CANARY))).toBeNull();
        expect(projectSerializedAuditDetails(ACTION, null)).toBeNull();
    });

    it("returns unrelated serialized details byte-for-byte", () => {
        const raw = '{"after":{"employeeId":21},"reason":"keep"}';
        expect(projectSerializedAuditDetails("ROUTINE_OCCURRENCE_REASSIGN", raw)).toBe(raw);
        expect(projectSerializedAuditDetails("ROUTINE_OCCURRENCE_REASSIGN", "not-json")).toBe("not-json");
    });
});
