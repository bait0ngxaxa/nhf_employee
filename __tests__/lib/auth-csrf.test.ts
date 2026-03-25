// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { assertTrustedMutationRequest } from "@/lib/auth-csrf";

describe("auth csrf guard", () => {
    it("rejects when origin or ajax header is missing", () => {
        const request = new NextRequest("http://localhost/api/auth/refresh", {
            method: "POST",
        });

        const response = assertTrustedMutationRequest(request);
        expect(response?.status).toBe(403);
    });

    it("allows trusted same-origin ajax requests", () => {
        const request = new NextRequest("http://localhost/api/auth/refresh", {
            method: "POST",
            headers: {
                origin: "http://localhost",
                "x-requested-with": "XMLHttpRequest",
            },
        });

        const response = assertTrustedMutationRequest(request);
        expect(response).toBeNull();
    });
});
