// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/leave", () => ({}));
vi.mock("@/modules/line", () => ({}));
vi.mock("@/lib/services/outbox/processor", () => ({ processOutbox: vi.fn() }));

import { POST as createDashboard } from "@/app/api/leave/request/route";
import { POST as decideDashboard } from "@/app/api/leave/decision/route";
import { POST as cancelDashboard, PUT as confirmCancelDashboard } from "@/app/api/leave/cancel/route";
import { POST as notTakenDashboard, PUT as confirmNotTakenDashboard } from "@/app/api/leave/not-taken/route";
import { PUT as manageApprovers } from "@/app/api/leave/approvers/route";
import { POST as cleanupAttachments } from "@/app/api/leave/attachments/cleanup/route";
import { POST as createLiff } from "@/app/api/line/leave/request/route";
import { POST as decideLiff } from "@/app/api/line/leave/decision/route";
import { POST as cancelLiff, PUT as confirmCancelLiff } from "@/app/api/line/leave/cancel/route";
import { POST as notTakenLiff, PUT as confirmNotTakenLiff } from "@/app/api/line/leave/not-taken/route";

describe("disabled Leave mutation endpoints", () => {
    afterEach(() => vi.unstubAllEnvs());
    it.each([
        ["Dashboard create", "POST", createDashboard],
        ["Dashboard decision", "POST", decideDashboard],
        ["Dashboard cancellation", "POST", cancelDashboard],
        ["Dashboard cancellation decision", "PUT", confirmCancelDashboard],
        ["Dashboard not taken", "POST", notTakenDashboard],
        ["Dashboard confirm not taken", "PUT", confirmNotTakenDashboard],
        ["Dashboard approver management", "PUT", manageApprovers],
        ["attachment cleanup", "POST", cleanupAttachments],
        ["LIFF create", "POST", createLiff],
        ["LIFF decision", "POST", decideLiff],
        ["LIFF cancellation", "POST", cancelLiff],
        ["LIFF cancellation decision", "PUT", confirmCancelLiff],
        ["LIFF not taken", "POST", notTakenLiff],
        ["LIFF confirm not taken", "PUT", confirmNotTakenLiff],
    ])("rejects %s before invoking operational code", async (_label, method, handler) => {
        vi.stubEnv("NEXT_PUBLIC_FEATURE_LEAVE", "false");
        vi.stubEnv("LEAVE_ATTACHMENT_CLEANUP_SECRET", "test-secret");
        const request = new NextRequest("http://localhost/api/leave", {
            method,
            headers: { "x-cleanup-secret": "test-secret", "content-type": "application/json" },
            body: "{}",
        });
        expect((await handler(request)).status).toBe(404);
    });
});
