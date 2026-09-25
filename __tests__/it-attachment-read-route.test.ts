// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import type * as ITModule from "@/modules/it";

const mocks = vi.hoisted(() => ({
    requireWorkforce: vi.fn(),
    buildContext: vi.fn(),
    getAttachment: vi.fn(),
    readAttachment: vi.fn(),
}));

vi.mock("@/lib/auth/workforce", () => ({
    requireActiveWorkforceSession: mocks.requireWorkforce,
}));
vi.mock("@/modules/it", async (importOriginal) => {
    const actual = await importOriginal<typeof ITModule>();
    return {
        ...actual,
        buildCurrentITAuthorizationContext: mocks.buildContext,
        getITTicketAttachmentForDownload: mocks.getAttachment,
        readITTicketAttachment: mocks.readAttachment,
    };
});

import { GET } from "@/app/api/it/attachments/[attachmentId]/route";
import { ITCapabilityDeniedError, ITTicketNotFoundError } from "@/modules/it";

const user = { id: 41, role: "USER", name: "Staff", email: "staff@example.test" };
const context = { authorizationActor: { userId: 41, employeeId: 84, systemRole: "USER", channel: "DASHBOARD" } };
const attachmentId = "a".repeat(32);

function route() {
    return GET(new Request("http://localhost/api/it/attachments"), {
        params: Promise.resolve({ attachmentId }),
    });
}

describe("private IT attachment read route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.requireWorkforce.mockResolvedValue({ ok: true, user, employeeId: 84 });
        mocks.buildContext.mockResolvedValue(context);
        mocks.getAttachment.mockResolvedValue({
            id: attachmentId,
            ticketId: 19,
            storageKey: `it/19/${"b".repeat(32)}.webp`,
            contentType: "image/webp",
        });
        mocks.readAttachment.mockResolvedValue(Buffer.from("webp-bytes"));
    });

    it("serves WEBP inline with private no-store and nosniff headers", async () => {
        const response = await route();
        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toBe("image/webp");
        expect(response.headers.get("Content-Disposition")).toBe("inline");
        expect(response.headers.get("Cache-Control")).toBe("private, no-store");
        expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
        expect(await response.text()).toBe("webp-bytes");
        expect(mocks.getAttachment).toHaveBeenCalledWith(context, attachmentId);
        expect(mocks.readAttachment).toHaveBeenCalledWith(
            `it/19/${"b".repeat(32)}.webp`,
            19,
        );
    });

    it("requires active workforce before resolving read permission", async () => {
        mocks.requireWorkforce.mockResolvedValue({
            ok: false,
            response: NextResponse.json({ error: "forbidden" }, { status: 403 }),
        });
        expect((await route()).status).toBe(403);
        expect(mocks.getAttachment).not.toHaveBeenCalled();
        expect(mocks.readAttachment).not.toHaveBeenCalled();
    });

    it("conceals missing or foreign resources and distinguishes capability denial", async () => {
        mocks.getAttachment.mockRejectedValueOnce(new ITTicketNotFoundError());
        expect((await route()).status).toBe(404);
        mocks.getAttachment.mockRejectedValueOnce(new ITCapabilityDeniedError(
            "it.ticket.read",
            "NO_APPLICABLE_GRANT",
        ));
        expect((await route()).status).toBe(403);
        expect(mocks.readAttachment).not.toHaveBeenCalled();
    });

    it("returns safe 404 for missing bytes and refuses inconsistent persisted media type", async () => {
        mocks.readAttachment.mockRejectedValueOnce(Object.assign(new Error("missing"), { code: "ENOENT" }));
        expect((await route()).status).toBe(404);

        mocks.getAttachment.mockResolvedValueOnce({
            id: attachmentId,
            ticketId: 19,
            storageKey: `it/19/${"c".repeat(32)}.webp`,
            contentType: "image/png",
        });
        const response = await route();
        expect(response.status).toBe(500);
        expect(mocks.readAttachment).toHaveBeenCalledTimes(1);
    });
});
