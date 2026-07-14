import { describe, expect, it } from "vitest";

import {
    isActiveLeaveApprover,
    isUsableLeaveEmail,
} from "@/lib/services/leave/approver-eligibility";

const ACTIVE_APPROVER = {
    id: 20,
    status: "ACTIVE",
    deletedAt: null,
    user: {
        id: 200,
        email: "manager@thainhf.org",
        isActive: true,
        deletedAt: null,
    },
};

describe("leave approver eligibility", () => {
    it("requires an active employee, active user, and usable email", () => {
        expect(isActiveLeaveApprover(ACTIVE_APPROVER)).toBe(true);
        expect(isActiveLeaveApprover({
            ...ACTIVE_APPROVER,
            user: { ...ACTIVE_APPROVER.user, email: "manager@temp.local" },
        })).toBe(false);
        expect(isActiveLeaveApprover({
            ...ACTIVE_APPROVER,
            user: { ...ACTIVE_APPROVER.user, isActive: false },
        })).toBe(false);
        expect(isActiveLeaveApprover({ ...ACTIVE_APPROVER, deletedAt: new Date() })).toBe(false);
        expect(isActiveLeaveApprover({ ...ACTIVE_APPROVER, user: null })).toBe(false);
    });

    it.each([
        "",
        "invalid-email",
        "manager@temp.local",
        " manager@temp.local ",
    ])("rejects unusable email %s", (email) => {
        expect(isUsableLeaveEmail(email)).toBe(false);
    });
});
