import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";
import { requireActiveWorkforceSession } from "@/lib/auth/workforce";
import { findLinkedUserIdsByUserIds } from "@/modules/line";
import { GET } from "@/app/api/line/account-status/route";

vi.mock("@/lib/auth/workforce", () => ({ requireActiveWorkforceSession: vi.fn() }));
vi.mock("@/modules/line", () => ({ findLinkedUserIdsByUserIds: vi.fn() }));

describe("LINE account status", () => {
    beforeEach(() => vi.resetAllMocks());
    it.each([[[], "unlinked"], [[42], "linked"]] as const)("returns only the current user's status", async (links, status) => {
        vi.mocked(requireActiveWorkforceSession).mockResolvedValue({ ok: true, user: { id: 42 } } as never);
        vi.mocked(findLinkedUserIdsByUserIds).mockResolvedValue([...links]);
        const response = await GET();
        expect(findLinkedUserIdsByUserIds).toHaveBeenCalledWith([42]);
        expect(await response.json()).toEqual({ status });
        expect(response.headers.get("cache-control")).toBe("no-store");
    });
    it("does not query links for unauthenticated or ineligible users", async () => {
        vi.mocked(requireActiveWorkforceSession).mockResolvedValueOnce({ ok: false, response: NextResponse.json({}, { status: 401 }) });
        expect((await GET()).status).toBe(401);
        vi.mocked(requireActiveWorkforceSession).mockResolvedValueOnce({ ok: false, response: NextResponse.json({}, { status: 404 }) });
        expect((await GET()).status).toBe(404);
        vi.mocked(requireActiveWorkforceSession).mockResolvedValueOnce({ ok: false, response: NextResponse.json({}, { status: 403 }) });
        expect((await GET()).status).toBe(403);
        expect(findLinkedUserIdsByUserIds).not.toHaveBeenCalled();
    });
    it("sanitizes lookup errors", async () => {
        vi.mocked(requireActiveWorkforceSession).mockRejectedValue(new Error("private details"));
        const log = vi.spyOn(console, "error").mockImplementation(() => {});
        const response = await GET();
        expect(response.status).toBe(500);
        expect(JSON.stringify(await response.json())).not.toContain("private details");
        log.mockRestore();
    });
});
