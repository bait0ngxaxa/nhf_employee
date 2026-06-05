import { describe, expect, it } from "vitest";

import { parseUserAgent } from "@/components/dashboard/session-management/sessionManagement.utils";

describe("sessionManagement utils", () => {
    it("shows Chrome as a browser name without leaking the user-agent version", () => {
        const parsed = parseUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        );

        expect(parsed.browser).toBe("Google Chrome");
        expect(parsed.os).toBe("Windows 10/11");
        expect(parsed.deviceType).toBe("desktop");
    });

    it("prioritizes Edge over the embedded Chrome token", () => {
        const parsed = parseUserAgent(
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36 Edg/148.0.0.0",
        );

        expect(parsed.browser).toBe("Microsoft Edge");
    });
});
