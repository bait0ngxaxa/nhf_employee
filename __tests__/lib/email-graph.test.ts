import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { sendSmtpEmailMock } = vi.hoisted(() => ({
    sendSmtpEmailMock: vi.fn(),
}));

vi.mock("@/lib/email/smtp", () => ({
    sendSmtpEmail: sendSmtpEmailMock,
}));

const CLIENT_SECRET = "test-client-secret";
const ACCESS_TOKEN = "test-access-token";

async function sendThroughSharedTransport(): Promise<boolean> {
    const { sendEmail } = await import("@/lib/email/transport");
    return sendEmail({
        to: "recipient@example.test",
        subject: "NHF email transport test",
        html: "<p>HTML body รายการภาษาไทย</p>",
        text: "Plain text ข้อความภาษาไทย",
        messageId: "<nhf-stable@example.test>",
        fromName: "NHFapp | ระบบ Routine",
    });
}

function getMimePart(rawMime: string, contentType: string): string {
    const section = rawMime
        .split(/\r?\n(?=----)/)
        .find((part) => part.includes(`Content-Type: ${contentType};`));
    if (!section) {
        throw new Error(`MIME part ${contentType} was not generated`);
    }

    const [headers, encodedBody = ""] = section.split(/\r?\n\r?\n/, 2);
    if (!headers || !encodedBody) {
        throw new Error(`MIME part ${contentType} has no body`);
    }

    const transferEncoding = headers.match(
        /Content-Transfer-Encoding:\s*([^\r\n]+)/i,
    )?.[1]?.trim().toLowerCase();

    if (transferEncoding === "base64") {
        return Buffer.from(encodedBody.trim(), "base64").toString("utf8");
    }

    return encodedBody.trim();
}

function decodeFromHeader(rawMime: string): string {
    const lines = rawMime.split(/\r?\n/);
    const fromLineIndex = lines.findIndex((line) => line.startsWith("From: "));
    if (fromLineIndex < 0) {
        throw new Error("MIME From header was not generated");
    }

    let header = lines[fromLineIndex] ?? "";
    for (let index = fromLineIndex + 1; index < lines.length; index += 1) {
        const line = lines[index];
        if (!line || !/^[ \t]/.test(line)) {
            break;
        }
        header += ` ${line.trim()}`;
    }

    const adjacentWords = header.replace(/\?=\s+=\?/g, "?==?");

    return adjacentWords.replace(
        /=\?UTF-8\?Q\?([^?]*)\?=/gi,
        (_encodedWord, encoded: string) =>
            decodeURIComponent(
                encoded
                    .replace(/_/g, " ")
                    .replace(/=([0-9A-F]{2})/gi, "%$1"),
            ),
    );
}

function configureMicrosoftGraph(): void {
    process.env.EMAIL_PROVIDER = "microsoft-graph";
    process.env.EMAIL_FROM = "nhfapp@thainhf.org";
    process.env.EMAIL_FROM_NAME = "NHFapp";
    process.env.MICROSOFT_TENANT_ID = "test-tenant";
    process.env.MICROSOFT_CLIENT_ID = "test-client-id";
    process.env.MICROSOFT_CLIENT_SECRET = CLIENT_SECRET;
}

describe("Microsoft Graph email transport", () => {
    beforeEach(() => {
        vi.resetModules();
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
        sendSmtpEmailMock.mockReset();
        configureMicrosoftGraph();
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        vi.resetModules();
        delete process.env.EMAIL_PROVIDER;
        delete process.env.EMAIL_FROM;
        delete process.env.EMAIL_FROM_NAME;
        delete process.env.MICROSOFT_TENANT_ID;
        delete process.env.MICROSOFT_CLIENT_ID;
        delete process.env.MICROSOFT_CLIENT_SECRET;
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;
    });

    it("uses client credentials, sends MIME, and reuses its cached token", async () => {
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        access_token: ACCESS_TOKEN,
                        expires_in: 3600,
                    }),
                    { status: 200 },
                ),
            )
            .mockResolvedValueOnce(new Response(null, { status: 202 }))
            .mockResolvedValueOnce(new Response(null, { status: 202 }));
        vi.stubGlobal("fetch", fetchMock);

        expect(await sendThroughSharedTransport()).toBe(true);
        expect(await sendThroughSharedTransport()).toBe(true);
        expect(fetchMock).toHaveBeenCalledTimes(3);

        const [tokenEndpoint, tokenRequest] = fetchMock.mock.calls[0] ?? [];
        expect(tokenEndpoint).toBe(
            "https://login.microsoftonline.com/test-tenant/oauth2/v2.0/token",
        );
        expect(tokenRequest?.method).toBe("POST");
        expect(tokenRequest?.headers).toEqual({
            "Content-Type": "application/x-www-form-urlencoded",
        });
        const tokenParameters = new URLSearchParams(
            String(tokenRequest?.body),
        );
        expect(tokenParameters.get("grant_type")).toBe("client_credentials");
        expect(tokenParameters.get("client_id")).toBe("test-client-id");
        expect(tokenParameters.get("client_secret")).toBe(CLIENT_SECRET);
        expect(tokenParameters.get("scope")).toBe(
            "https://graph.microsoft.com/.default",
        );

        const [graphEndpoint, graphRequest] = fetchMock.mock.calls[1] ?? [];
        expect(graphEndpoint).toBe(
            "https://graph.microsoft.com/v1.0/users/nhfapp@thainhf.org/sendMail",
        );
        expect(graphRequest?.method).toBe("POST");
        expect(graphRequest?.headers).toEqual({
            Authorization: `Bearer ${ACCESS_TOKEN}`,
            "Content-Type": "text/plain",
        });

        const encodedMime = String(graphRequest?.body);
        const rawMime = Buffer.from(encodedMime, "base64").toString("utf8");
        expect(getMimePart(rawMime, "text/plain")).toBe(
            "Plain text ข้อความภาษาไทย",
        );
        expect(getMimePart(rawMime, "text/html")).toBe(
            "<p>HTML body รายการภาษาไทย</p>",
        );
        expect(decodeFromHeader(rawMime)).toContain("NHFapp | ระบบ Routine");
        expect(rawMime).toContain("Message-ID: <nhf-stable@example.test>");

        const secondRawMime = Buffer.from(
            String(fetchMock.mock.calls[2]?.[1]?.body),
            "base64",
        ).toString("utf8");
        expect(secondRawMime).toContain(
            "Message-ID: <nhf-stable@example.test>",
        );
        expect(sendSmtpEmailMock).not.toHaveBeenCalled();
    });

    it("returns false for Graph permission errors without logging credentials or using SMTP", async () => {
        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        access_token: ACCESS_TOKEN,
                        expires_in: 3600,
                    }),
                    { status: 200 },
                ),
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        error: `${CLIENT_SECRET} ${ACCESS_TOKEN}`,
                    }),
                    {
                        status: 403,
                        headers: {
                            "request-id": "graph-request-id",
                            "retry-after": "30",
                        },
                    },
                ),
            );
        vi.stubGlobal("fetch", fetchMock);

        expect(await sendThroughSharedTransport()).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(sendSmtpEmailMock).not.toHaveBeenCalled();

        const loggedValues = consoleErrorSpy.mock.calls
            .flat()
            .map((value) =>
                typeof value === "string" ? value : JSON.stringify(value),
            )
            .join(" ");
        expect(loggedValues).toContain("permission");
        expect(loggedValues).toContain("graph-request-id");
        expect(loggedValues).toContain("30");
        expect(loggedValues).not.toContain(CLIENT_SECRET);
        expect(loggedValues).not.toContain(ACCESS_TOKEN);
    });

    it("does not retry or switch providers after an ambiguous Graph network failure", async () => {
        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        access_token: ACCESS_TOKEN,
                        expires_in: 3600,
                    }),
                    { status: 200 },
                ),
            )
            .mockRejectedValueOnce(
                new Error(`${CLIENT_SECRET} ${ACCESS_TOKEN}`),
            );
        vi.stubGlobal("fetch", fetchMock);

        expect(await sendThroughSharedTransport()).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(sendSmtpEmailMock).not.toHaveBeenCalled();

        const loggedValues = consoleErrorSpy.mock.calls
            .flat()
            .map((value) =>
                typeof value === "string" ? value : JSON.stringify(value),
            )
            .join(" ");
        expect(loggedValues).not.toContain(CLIENT_SECRET);
        expect(loggedValues).not.toContain(ACCESS_TOKEN);
    });

    it("logs the safe Entra OAuth error code for token failures", async () => {
        const consoleErrorSpy = vi
            .spyOn(console, "error")
            .mockImplementation(() => undefined);
        const privateErrorDetail = "private-oauth-error-description";
        const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    error: "invalid_client",
                    error_description: `${privateErrorDetail} ${CLIENT_SECRET}`,
                    error_codes: [7000215],
                }),
                {
                    status: 401,
                    headers: { "request-id": "entra-request-id" },
                },
            ),
        );
        vi.stubGlobal("fetch", fetchMock);

        expect(await sendThroughSharedTransport()).toBe(false);
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(sendSmtpEmailMock).not.toHaveBeenCalled();

        const loggedValues = consoleErrorSpy.mock.calls
            .flat()
            .map((value) =>
                typeof value === "string" ? value : JSON.stringify(value),
            )
            .join(" ");
        expect(loggedValues).toContain("invalid_client");
        expect(loggedValues).toContain("7000215");
        expect(loggedValues).toContain("entra-request-id");
        expect(loggedValues).not.toContain(privateErrorDetail);
        expect(loggedValues).not.toContain(CLIENT_SECRET);
        expect(loggedValues).not.toContain(ACCESS_TOKEN);
    });

    it("returns false without making a request when Graph configuration is incomplete", async () => {
        delete process.env.MICROSOFT_CLIENT_SECRET;
        const fetchMock = vi.fn<typeof fetch>();
        vi.stubGlobal("fetch", fetchMock);

        expect(await sendThroughSharedTransport()).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(sendSmtpEmailMock).not.toHaveBeenCalled();
    });

    it("returns false without switching providers for an unsupported setting", async () => {
        process.env.EMAIL_PROVIDER = "unsupported-provider";
        const fetchMock = vi.fn<typeof fetch>();
        vi.stubGlobal("fetch", fetchMock);

        expect(await sendThroughSharedTransport()).toBe(false);
        expect(fetchMock).not.toHaveBeenCalled();
        expect(sendSmtpEmailMock).not.toHaveBeenCalled();
    });
});
