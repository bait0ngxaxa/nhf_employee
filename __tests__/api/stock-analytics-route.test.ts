import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/stock/reports/analytics/route";
import { StockCapabilityDeniedError } from "@/modules/stock";
import type * as StockModule from "@/modules/stock";

const mocks = vi.hoisted(() => ({ session: vi.fn(), assert: vi.fn(), analytics: vi.fn() }));
vi.mock("@/lib/auth/workforce", () => ({ requireActiveWorkforceSession: mocks.session }));
vi.mock("@/modules/stock", async (original) => ({ ...await original<typeof StockModule>(), assertStockCapability: mocks.assert, getStockAnalytics: mocks.analytics }));

describe("Stock analytics API", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.session.mockResolvedValue({ ok: true, user: { id: 7, role: "USER" }, employeeId: 9 });
        mocks.assert.mockResolvedValue({ scopes: ["ALL"] });
        mocks.analytics.mockResolvedValue({ kpis: { issuedRequests: 2 } });
    });
    const request = (query = ""): NextRequest => new NextRequest(`http://localhost/api/stock/reports/analytics${query}`);
    it("requires an active session before accessing data", async () => {
        mocks.session.mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) });
        expect((await GET(request())).status).toBe(401);
        expect(mocks.assert).not.toHaveBeenCalled();
        expect(mocks.analytics).not.toHaveBeenCalled();
    });
    it("uses independent report read authority and private no-store responses", async () => {
        const response = await GET(request("?year=2024&fromMonth=2&toMonth=2"));
        expect(response.status).toBe(200);
        expect(mocks.assert).toHaveBeenCalledWith(expect.objectContaining({ authorizationActor: expect.objectContaining({ userId: 7, channel: "DASHBOARD" }) }), "stock.report.read");
        expect(response.headers.get("Cache-Control")).toContain("no-store");
        expect(mocks.analytics).toHaveBeenCalledWith(expect.objectContaining({ year: 2024, fromMonth: 2, toMonth: 2 }));
    });
    it("rejects denied or insufficient scopes before querying", async () => {
        mocks.assert.mockRejectedValueOnce(new StockCapabilityDeniedError("stock.report.read", "NO_APPLICABLE_GRANT"));
        expect((await GET(request())).status).toBe(403);
        mocks.assert.mockResolvedValue({ scopes: ["OWN"] });
        expect((await GET(request())).status).toBe(403);
        expect(mocks.analytics).not.toHaveBeenCalled();
    });
    it("validates filters and sanitizes database errors", async () => {
        expect((await GET(request("?fromMonth=12&toMonth=1"))).status).toBe(400);
        expect(mocks.analytics).not.toHaveBeenCalled();
        const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
        mocks.analytics.mockRejectedValue(new Error("private database path"));
        const response = await GET(request());
        expect(response.status).toBe(500);
        expect(await response.text()).not.toContain("private database path");
        spy.mockRestore();
    });
});
