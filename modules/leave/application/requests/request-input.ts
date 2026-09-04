import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";
import { LEAVE_ATTACHMENT_MAX_REQUEST_BYTES } from "@/modules/leave/infrastructure/attachments/constants";
import { LEAVE_JSON_MUTATION_MAX_BYTES } from "@/lib/ssot/request-limits";
import {
    contentLengthExceedsLimit,
    readBoundedBytes,
    readBoundedJsonBody,
} from "@/lib/server/request-body";
import {
    validateLeaveAttachments,
    type LeaveAttachmentSource,
} from "@/modules/leave/infrastructure/attachments/storage";
import {
    leaveRequestSchema,
    type LeaveRequestValues,
} from "@/modules/leave/schemas/leave";

const JSON_CONTENT_TYPE = "application/json";
const LEGACY_TEXT_CONTENT_TYPE = "text/plain";
const MULTIPART_CONTENT_TYPE = "multipart/form-data";

export class LeaveRequestInputError extends Error {
    readonly statusCode: number;
    readonly details?: Record<string, unknown>;

    constructor(
        message: string,
        statusCode: number,
        details?: Record<string, unknown>,
    ) {
        super(message);
        this.name = "LeaveRequestInputError";
        this.statusCode = statusCode;
        this.details = details;
    }
}

export interface ParsedLeaveRequestInput {
    payload: LeaveRequestValues;
    attachments: LeaveAttachmentSource[];
}

function parsePayload(value: unknown): LeaveRequestValues {
    const parsed = leaveRequestSchema.safeParse(value);
    if (!parsed.success) {
        throw new LeaveRequestInputError(COMMON_API_MESSAGES.invalidInput, 400, {
            details: parsed.error.format(),
        });
    }
    return parsed.data;
}

function parseJsonString(value: string): unknown {
    try {
        return JSON.parse(value) as unknown;
    } catch {
        throw new LeaveRequestInputError(COMMON_API_MESSAGES.invalidInput, 400);
    }
}

async function parseJsonRequest(request: Request): Promise<ParsedLeaveRequestInput> {
    const result = await readBoundedJsonBody(
        request,
        LEAVE_JSON_MUTATION_MAX_BYTES,
    );
    if (!result.ok) {
        throw new LeaveRequestInputError(
            result.reason === "TOO_LARGE"
                ? "คำขอมีขนาดใหญ่เกินไป"
                : COMMON_API_MESSAGES.invalidInput,
            result.reason === "TOO_LARGE" ? 413 : 400,
        );
    }
    return { payload: parsePayload(result.value), attachments: [] };
}

async function parseMultipartRequest(
    request: Request,
): Promise<ParsedLeaveRequestInput> {
    const boundedBody = await readBoundedBytes(
        request,
        LEAVE_ATTACHMENT_MAX_REQUEST_BYTES,
    );
    if (!boundedBody.ok) {
        throw new LeaveRequestInputError(
            boundedBody.reason === "TOO_LARGE"
                ? "คำขอมีขนาดใหญ่เกินไป"
                : COMMON_API_MESSAGES.invalidInput,
            boundedBody.reason === "TOO_LARGE" ? 413 : 400,
        );
    }

    let formData: FormData;
    try {
        const bodyBuffer = new ArrayBuffer(boundedBody.bytes.byteLength);
        new Uint8Array(bodyBuffer).set(boundedBody.bytes);
        const boundedHeaders = new Headers(request.headers);
        boundedHeaders.delete("content-length");
        const boundedRequest = new Request(
            typeof request.url === "string"
                ? request.url
                : "http://localhost/api/leave/request",
            {
                method: request.method
                    && request.method !== "GET"
                    && request.method !== "HEAD"
                    ? request.method
                    : "POST",
                headers: boundedHeaders,
                body: bodyBuffer,
            },
        );
        formData = await boundedRequest.formData();
    } catch {
        throw new LeaveRequestInputError(COMMON_API_MESSAGES.invalidInput, 400);
    }

    const rawPayload = formData.get("payload");
    if (typeof rawPayload !== "string") {
        throw new LeaveRequestInputError(COMMON_API_MESSAGES.invalidInput, 400);
    }

    const rawAttachments = formData.getAll("attachments");
    if (rawAttachments.some((entry) => typeof entry === "string")) {
        throw new LeaveRequestInputError("ไฟล์แนบไม่ถูกต้อง", 400);
    }

    const payload = parsePayload(parseJsonString(rawPayload));
    const attachments = rawAttachments as File[];
    validateLeaveAttachments(attachments);
    return { payload, attachments };
}

export function assertLeaveRequestBodySize(request: Request): void {
    if (contentLengthExceedsLimit(request, LEAVE_ATTACHMENT_MAX_REQUEST_BYTES)) {
        throw new LeaveRequestInputError("คำขอมีขนาดใหญ่เกินไป", 413);
    }
}

function getMediaType(request: Request): string {
    return request.headers.get("content-type")
        ?.split(";", 1)[0]
        ?.trim()
        .toLowerCase() ?? "";
}

export async function parseLeaveRequestInput(
    request: Request,
): Promise<ParsedLeaveRequestInput> {
    const mediaType = getMediaType(request);
    if (
        !mediaType
        || mediaType === JSON_CONTENT_TYPE
        || mediaType === LEGACY_TEXT_CONTENT_TYPE
    ) {
        return parseJsonRequest(request);
    }
    if (mediaType === MULTIPART_CONTENT_TYPE) {
        assertLeaveRequestBodySize(request);
        return parseMultipartRequest(request);
    }
    throw new LeaveRequestInputError("Content-Type ไม่รองรับ", 415);
}
