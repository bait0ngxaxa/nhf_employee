// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { POST as forgotPasswordRoute } from "@/app/api/auth/forgot-password/route";
import { resetAuthRateLimit } from "@/lib/auth/rate-limit";

const { requestPasswordResetMock, sendEmailMock } = vi.hoisted(() => ({
    requestPasswordResetMock: vi.fn(),
    sendEmailMock: vi.fn(),
}));

vi.mock("@/modules/auth", () => ({
    requestPasswordReset: requestPasswordResetMock,
}));

vi.mock("@/lib/email", () => ({
    sendEmail: sendEmailMock,
}));

function buildRequest(body: unknown, ipAddress = "203.0.113.50"): NextRequest {
    return new NextRequest("http://localhost/api/auth/forgot-password", {
        method: "POST",
        headers: {
            "content-type": "application/json",
            "cf-connecting-ip": ipAddress,
            "user-agent": "forgot-password-test-agent",
        },
        body: JSON.stringify(body) ?? "",
    });
}

async function readResponse(response: Response): Promise<unknown> {
    return response.json();
}

const acceptedBody = {
    success: true,
    message: "หากอีเมลนี้มีอยู่ในระบบ คุณจะได้รับลิงก์รีเซ็ตรหัสผ่านทางอีเมล",
};

describe("forgot-password route", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        resetAuthRateLimit();
        requestPasswordResetMock.mockReset();
        sendEmailMock.mockReset();
        sendEmailMock.mockResolvedValue(true);
    });

    it("returns the accepted anti-enumeration response for invalid input", async () => {
        const response = await forgotPasswordRoute(buildRequest({ email: "not-an-email" }));

        expect(response.status).toBe(200);
        await expect(readResponse(response)).resolves.toEqual(acceptedBody);
        expect(requestPasswordResetMock).not.toHaveBeenCalled();
        expect(sendEmailMock).not.toHaveBeenCalled();
    });

    it("keeps unknown and known account responses identical", async () => {
        requestPasswordResetMock
            .mockResolvedValueOnce({ rateLimited: false })
            .mockResolvedValueOnce({
                rateLimited: false,
                rawToken: "raw-token",
                user: { email: "known@thainhf.org", name: "Known User" },
            });

        const unknownResponse = await forgotPasswordRoute(
            buildRequest({ email: "unknown@thainhf.org" }, "203.0.113.51"),
        );
        const knownResponse = await forgotPasswordRoute(
            buildRequest({ email: "known@thainhf.org" }, "203.0.113.52"),
        );

        expect(unknownResponse.status).toBe(200);
        expect(knownResponse.status).toBe(200);
        await expect(readResponse(unknownResponse)).resolves.toEqual(acceptedBody);
        await expect(readResponse(knownResponse)).resolves.toEqual(acceptedBody);
        expect(sendEmailMock).toHaveBeenCalledTimes(1);
    });

    it("keeps database-limited requests in the accepted response path", async () => {
        requestPasswordResetMock.mockResolvedValue({ rateLimited: true });

        const response = await forgotPasswordRoute(
            buildRequest({ email: "user@thainhf.org" }),
        );

        expect(response.status).toBe(200);
        await expect(readResponse(response)).resolves.toEqual(acceptedBody);
        expect(sendEmailMock).not.toHaveBeenCalled();

        requestPasswordResetMock.mockResolvedValue({ rateLimited: false });
        const retryResponse = await forgotPasswordRoute(
            buildRequest({ email: "user@thainhf.org" }),
        );
        expect(retryResponse.status).toBe(200);
        expect(requestPasswordResetMock).toHaveBeenCalledTimes(2);
    });

    it("keeps application rate limiting anti-enumerating", async () => {
        requestPasswordResetMock.mockResolvedValue({ rateLimited: false });

        const responses: Response[] = [];
        for (let attempt = 0; attempt < 4; attempt += 1) {
            responses.push(
                await forgotPasswordRoute(
                    buildRequest({ email: "user@thainhf.org" }),
                ),
            );
        }

        expect(responses.every((response) => response.status === 200)).toBe(true);
        for (const response of responses) {
            await expect(readResponse(response)).resolves.toEqual(acceptedBody);
        }
        expect(requestPasswordResetMock).toHaveBeenCalledTimes(3);
    });
});
