import { describe, expect, it } from "vitest";

import { createITCommandRequestMetadata } from "./command-actor";

describe("createITCommandRequestMetadata", () => {
    it("uses authenticated identity, trusted client IP, and validated trace headers", () => {
        const metadata = createITCommandRequestMetadata(
            { email: "operator@nhf.example" },
            new Headers({
                "cf-connecting-ip": "203.0.113.17",
                "x-forwarded-for": "198.51.100.44",
                "user-agent": "IT11 integration client",
                "x-request-id": " request:it11 ",
                "x-correlation-id": "correlation:it11",
            }),
        );

        expect(metadata).toEqual({
            userEmail: "operator@nhf.example",
            ipAddress: "203.0.113.17",
            userAgent: "IT11 integration client",
            requestId: "request:it11",
            correlationId: "correlation:it11",
        });
    });

    it("ignores untrusted forwarded IP and invalid trace headers", () => {
        const metadata = createITCommandRequestMetadata(
            { email: "requester@nhf.example" },
            new Headers({
                "x-forwarded-for": "198.51.100.44",
                "x-request-id": "unsafe trace value",
                "x-correlation-id": "unsafe trace value",
            }),
        );

        expect(metadata.ipAddress).toBeUndefined();
        expect(metadata.requestId).toMatch(/^[0-9a-f-]{36}$/i);
        expect(metadata.correlationId).toBe(metadata.requestId);
    });
});
