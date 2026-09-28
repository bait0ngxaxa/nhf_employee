import nodemailer from "nodemailer";

import type { EmailData } from "./types";

const DEFAULT_EMAIL_FROM_NAME = "NHFapp";
const TOKEN_SAFETY_WINDOW_MS = 60_000;
const SAFE_OAUTH_ERROR_CODES = new Set([
    "invalid_client",
    "invalid_grant",
    "invalid_request",
    "invalid_scope",
    "server_error",
    "temporarily_unavailable",
    "unauthorized_client",
    "unsupported_grant_type",
]);

interface MicrosoftGraphConfig {
    tenantId: string;
    clientId: string;
    clientSecret: string;
    senderEmail: string;
    fromName: string;
}

interface CachedAccessToken {
    value: string;
    expiresAt: number;
}

let mimeTransporter: nodemailer.Transporter | null = null;
let cachedAccessToken: CachedAccessToken | null = null;
let pendingTokenRequest: Promise<CachedAccessToken | null> | null = null;

function getMicrosoftGraphConfig(): MicrosoftGraphConfig | null {
    const tenantId = process.env.MICROSOFT_TENANT_ID?.trim();
    const clientId = process.env.MICROSOFT_CLIENT_ID?.trim();
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
    const senderEmail = process.env.EMAIL_FROM?.trim();

    if (
        !tenantId ||
        !clientId ||
        !clientSecret ||
        !senderEmail ||
        !/^[^\s@]+@[^\s@]+$/.test(senderEmail)
    ) {
        return null;
    }

    return {
        tenantId,
        clientId,
        clientSecret,
        senderEmail,
        fromName:
            process.env.EMAIL_FROM_NAME?.trim() || DEFAULT_EMAIL_FROM_NAME,
    };
}

function getMimeTransporter(): nodemailer.Transporter {
    if (!mimeTransporter) {
        mimeTransporter = nodemailer.createTransport({
            streamTransport: true,
            buffer: true,
            newline: "windows",
        });
    }

    return mimeTransporter;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

function getHttpFailureCategory(
    operation: "token" | "sendMail",
    status: number,
): string {
    if (status === 429) {
        return "throttling";
    }

    if (status >= 500) {
        return operation === "token"
            ? "temporary_authentication_upstream_failure"
            : "temporary_upstream_failure";
    }

    if (operation === "token") {
        return "authentication_or_configuration";
    }

    if (status === 401) {
        return "authentication";
    }

    if (status === 403) {
        return "permission";
    }

    if (status === 400 || status === 422) {
        return "validation";
    }

    if (status === 404) {
        return "sender_configuration";
    }

    return "http_failure";
}

function logHttpFailure(
    operation: "token" | "sendMail",
    response: Response,
    additionalContext: Record<string, string | number> = {},
): void {
    const context: Record<string, string | number> = {
        provider: "microsoft-graph",
        operation,
        failureCategory: getHttpFailureCategory(operation, response.status),
        status: response.status,
        ...additionalContext,
    };
    const requestId =
        response.headers.get("request-id") ??
        response.headers.get("x-ms-request-id");
    const clientRequestId = response.headers.get("client-request-id");
    const retryAfter = response.headers.get("retry-after");

    if (requestId) {
        context.requestId = requestId;
    }
    if (clientRequestId) {
        context.clientRequestId = clientRequestId;
    }
    if (retryAfter) {
        context.retryAfter = retryAfter;
    }

    console.error("Microsoft Graph email request failed.", context);
}

async function getSafeOAuthErrorContext(
    response: Response,
): Promise<Record<string, string | number>> {
    try {
        const payload: unknown = await response.json();
        if (!isRecord(payload)) {
            return {};
        }

        const context: Record<string, string | number> = {};
        if (
            typeof payload.error === "string" &&
            SAFE_OAUTH_ERROR_CODES.has(payload.error)
        ) {
            context.oauthError = payload.error;
        }

        if (Array.isArray(payload.error_codes)) {
            const codes = payload.error_codes
                .filter(
                    (code): code is number =>
                        typeof code === "number" && Number.isInteger(code),
                )
                .slice(0, 5);
            if (codes.length > 0) {
                context.oauthErrorCodes = codes.join(",");
            }
        }

        return context;
    } catch {
        return {};
    }
}

async function requestAccessToken(
    config: MicrosoftGraphConfig,
): Promise<CachedAccessToken | null> {
    const tokenUrl = `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/token`;
    const tokenBody = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: config.clientSecret,
        scope: "https://graph.microsoft.com/.default",
    });

    let response: Response;
    try {
        response = await fetch(tokenUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
            },
            body: tokenBody.toString(),
        });
    } catch {
        console.error("Microsoft Entra token request failed.", {
            provider: "microsoft-graph",
            operation: "token",
            failureCategory: "ambiguous_network_failure",
        });
        return null;
    }

    if (!response.ok) {
        const oauthErrorContext = await getSafeOAuthErrorContext(response);
        logHttpFailure("token", response, oauthErrorContext);
        return null;
    }

    let payload: unknown;
    try {
        payload = await response.json();
    } catch {
        console.error("Microsoft Entra token response was invalid.", {
            provider: "microsoft-graph",
            operation: "token",
            failureCategory: "invalid_token_response",
        });
        return null;
    }

    if (!isRecord(payload)) {
        console.error("Microsoft Entra token response was invalid.", {
            provider: "microsoft-graph",
            operation: "token",
            failureCategory: "invalid_token_response",
        });
        return null;
    }

    const accessToken = payload.access_token;
    const expiresIn = payload.expires_in;
    if (
        typeof accessToken !== "string" ||
        accessToken.length === 0 ||
        typeof expiresIn !== "number" ||
        !Number.isFinite(expiresIn) ||
        expiresIn <= 0
    ) {
        console.error("Microsoft Entra token response was invalid.", {
            provider: "microsoft-graph",
            operation: "token",
            failureCategory: "invalid_token_response",
        });
        return null;
    }

    return {
        value: accessToken,
        expiresAt: Date.now() + expiresIn * 1000 - TOKEN_SAFETY_WINDOW_MS,
    };
}

async function getAccessToken(
    config: MicrosoftGraphConfig,
): Promise<string | null> {
    if (cachedAccessToken && Date.now() < cachedAccessToken.expiresAt) {
        return cachedAccessToken.value;
    }

    if (pendingTokenRequest) {
        return (await pendingTokenRequest)?.value ?? null;
    }

    const tokenRequest = requestAccessToken(config);
    pendingTokenRequest = tokenRequest;

    try {
        cachedAccessToken = await tokenRequest;
        return cachedAccessToken?.value ?? null;
    } finally {
        if (pendingTokenRequest === tokenRequest) {
            pendingTokenRequest = null;
        }
    }
}

async function generateMimeMessage(emailData: EmailData, config: MicrosoftGraphConfig): Promise<Buffer | null> {
    try {
        const info = await getMimeTransporter().sendMail({
            from: {
                name: emailData.fromName?.trim() || config.fromName,
                address: config.senderEmail,
            },
            to: emailData.to,
            subject: emailData.subject,
            html: emailData.html,
            text: emailData.text,
            messageId: emailData.messageId,
        });

        const message: unknown = info.message;
        if (Buffer.isBuffer(message)) {
            return message;
        }
    } catch {
        // Do not log Nodemailer's error text because it may include message data.
    }

    console.error("Failed to generate email MIME content.", {
        provider: "microsoft-graph",
        operation: "mime_generation",
        failureCategory: "mime_generation_failure",
    });
    return null;
}

export async function sendMicrosoftGraphEmail(
    emailData: EmailData,
): Promise<boolean> {
    const config = getMicrosoftGraphConfig();
    if (!config) {
        console.error("Microsoft Graph email configuration is incomplete.", {
            provider: "microsoft-graph",
            operation: "configuration",
            failureCategory: "configuration_error",
        });
        return false;
    }

    const mimeMessage = await generateMimeMessage(emailData, config);
    if (!mimeMessage) {
        return false;
    }

    const accessToken = await getAccessToken(config);
    if (!accessToken) {
        return false;
    }

    const senderPath = encodeURIComponent(config.senderEmail).replace(
        /%40/gi,
        "@",
    );

    let response: Response;
    try {
        response = await fetch(
            `https://graph.microsoft.com/v1.0/users/${senderPath}/sendMail`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "text/plain",
                },
                body: mimeMessage.toString("base64"),
            },
        );
    } catch {
        console.error("Microsoft Graph email request failed.", {
            provider: "microsoft-graph",
            operation: "sendMail",
            failureCategory: "ambiguous_network_failure",
        });
        return false;
    }

    if (response.status !== 202) {
        logHttpFailure("sendMail", response);
        return false;
    }

    return true;
}
