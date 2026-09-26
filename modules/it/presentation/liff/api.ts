import {
    apiGet,
    apiPost,
    type ApiResponse,
} from "@/lib/client/api-client";
import {
    fetchLiffWithSessionRecovery,
    isRecoveredLiffUnauthorizedResponse,
    LIFF_API_REQUEST_OPTIONS,
    LIFF_SESSION_RECOVERED_MUTATION_MESSAGE,
    LiffApiError,
    unwrapLiffResponse,
} from "@/modules/line/client";
import { API_ROUTES } from "@/lib/ssot/routes";
import type {
    ITRequesterTicket,
    ITRequesterTicketDetail,
    ITRequesterTicketList,
    ITTicketCommentSubmission,
    ITTicketTimelinePage,
} from "../../contracts";
import {
    IT_TICKET_LIST_DEFAULT_LIMIT,
    IT_TICKET_TIMELINE_DEFAULT_LIMIT,
} from "../../contracts";
import {
    isITTicketResponseRecord,
    parseITRequesterTicket,
    parseITRequesterTicketDetail,
    parseITRequesterTicketList,
    parseITTicketCommentSubmission,
    parseITTicketTimelinePage,
} from "../dashboard/ticket-presentation";

type ITErrorContext = "list" | "detail" | "comment" | "create" | "attachment";

function getITApiErrorMessage(
    response: Extract<ApiResponse<unknown>, { success: false }>,
    context: ITErrorContext,
): string {
    if (response.status === 401) {
        return isRecoveredLiffUnauthorizedResponse(response)
            ? LIFF_SESSION_RECOVERED_MUTATION_MESSAGE
            : "การยืนยันตัวตนหมดอายุ กรุณาเปิด NHFapp จาก LINE อีกครั้ง";
    }

    switch (response.status) {
        case 400:
        case 415:
        case 422:
            return context === "comment" || context === "attachment"
                ? "ข้อมูลข้อความหรือรูปภาพไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง"
                : "ข้อมูล Ticket ไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง";
        case 403:
            return context === "list"
                ? "บัญชีนี้ยังไม่มีสิทธิ์ดูรายการ Ticket"
                : "คุณไม่มีสิทธิ์เข้าถึง Ticket นี้";
        case 404:
            return context === "attachment"
                ? "ไม่พบรูปภาพนี้หรือคุณไม่มีสิทธิ์ดูรูปภาพ"
                : "ไม่พบ Ticket หรือคุณไม่มีสิทธิ์ดูรายการนี้";
        case 409:
            return "Ticket มีการเปลี่ยนแปลง กรุณาตรวจสอบสถานะล่าสุดก่อนลองอีกครั้ง";
        case 413:
            return "ข้อความหรือรูปภาพมีขนาดใหญ่เกินไป กรุณาลดขนาดแล้วลองอีกครั้ง";
        case 429:
            return "ส่งคำขอบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่";
        default:
            if (response.status === undefined) {
                return response.code === "TIMEOUT"
                    ? "การเชื่อมต่อใช้เวลานานเกินไป กรุณาลองใหม่"
                    : "ไม่สามารถเชื่อมต่อบริการ IT ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่";
            }
            if (response.status >= 500) {
                return context === "attachment"
                    ? "ไม่สามารถเปิดรูปภาพได้ในขณะนี้ กรุณาลองใหม่"
                    : "ระบบ Ticket ขัดข้องชั่วคราว กรุณาลองอีกครั้ง";
            }
            return "ไม่สามารถดำเนินการได้ กรุณาลองอีกครั้ง";
    }
}

async function unwrapITResponse<T>(
    response: ApiResponse<T>,
    context: ITErrorContext,
): Promise<T> {
    return unwrapLiffResponse(response, (failure) => getITApiErrorMessage(failure, context));
}

function invalidResponse(message: string): LiffApiError {
    return new LiffApiError(message, undefined);
}

export async function fetchLiffITTickets(
    page: number,
    signal?: AbortSignal,
): Promise<ITRequesterTicketList> {
    const params = new URLSearchParams({
        page: String(page),
        limit: String(IT_TICKET_LIST_DEFAULT_LIMIT),
    });
    const payload = await unwrapITResponse(
        await apiGet<unknown>(
            `${API_ROUTES.line.itTickets}?${params.toString()}`,
            { ...LIFF_API_REQUEST_OPTIONS, ...(signal ? { signal } : {}) },
        ),
        "list",
    );
    const parsed = parseITRequesterTicketList(payload);
    if (parsed === null) {
        throw invalidResponse("ข้อมูลรายการ Ticket ไม่ถูกต้อง กรุณาลองอีกครั้ง");
    }
    return parsed;
}

export async function fetchLiffITTicket(
    ticketId: number,
    signal?: AbortSignal,
): Promise<ITRequesterTicketDetail> {
    const payload = await unwrapITResponse(
        await apiGet<unknown>(
            API_ROUTES.line.itTicketById(ticketId),
            { ...LIFF_API_REQUEST_OPTIONS, ...(signal ? { signal } : {}) },
        ),
        "detail",
    );
    const parsed = isITTicketResponseRecord(payload) && payload.success === true
        ? parseITRequesterTicketDetail(payload.ticket)
        : null;
    if (parsed === null) {
        throw invalidResponse("ข้อมูล Ticket ไม่ถูกต้อง กรุณาลองอีกครั้ง");
    }
    return parsed;
}

export async function fetchLiffITTicketTimeline(
    ticketId: number,
    input: { readonly cursor?: string; readonly signal?: AbortSignal } = {},
): Promise<ITTicketTimelinePage> {
    const params = new URLSearchParams({ limit: String(IT_TICKET_TIMELINE_DEFAULT_LIMIT) });
    if (input.cursor) params.set("cursor", input.cursor);
    const payload = await unwrapITResponse(
        await apiGet<unknown>(
            `${API_ROUTES.line.itTicketTimelineById(ticketId)}?${params.toString()}`,
            {
                ...LIFF_API_REQUEST_OPTIONS,
                ...(input.signal ? { signal: input.signal } : {}),
            },
        ),
        "detail",
    );
    const parsed = parseITTicketTimelinePage(payload);
    if (parsed === null) {
        throw invalidResponse("ข้อมูลประวัติ Ticket ไม่ถูกต้อง กรุณาลองอีกครั้ง");
    }
    return parsed;
}

export async function createLiffITTicket(
    input: {
        readonly type: ITRequesterTicket["type"];
        readonly title: string;
        readonly description: string;
    },
    files: readonly File[],
    idempotencyKey: string,
): Promise<ITRequesterTicket> {
    let requestBody: Record<string, string> | FormData;
    if (files.length > 0) {
        const formData = new FormData();
        formData.set("type", input.type);
        formData.set("title", input.title);
        formData.set("description", input.description);
        for (const file of files) formData.append("attachments", file, file.name);
        requestBody = formData;
    } else {
        requestBody = input;
    }
    const payload = await unwrapITResponse(
        await apiPost<unknown>(
            API_ROUTES.line.itTickets,
            requestBody,
            {
                ...LIFF_API_REQUEST_OPTIONS,
                headers: { "Idempotency-Key": idempotencyKey },
            },
        ),
        "create",
    );
    const parsed = isITTicketResponseRecord(payload) && payload.success === true
        ? parseITRequesterTicket(payload.ticket)
        : null;
    if (parsed === null) {
        throw invalidResponse("ระบบยืนยันผลการสร้าง Ticket ไม่ได้ กรุณาลองส่งรายการเดิมอีกครั้ง");
    }
    return parsed;
}

export async function postLiffITTicketComment(
    ticketId: number,
    body: string,
    files: readonly File[],
    idempotencyKey: string,
): Promise<ITTicketCommentSubmission> {
    let requestBody: Record<string, string> | FormData;
    if (files.length > 0) {
        const formData = new FormData();
        formData.set("body", body);
        for (const file of files) formData.append("attachments", file, file.name);
        requestBody = formData;
    } else {
        requestBody = { body };
    }

    const payload = await unwrapITResponse(
        await apiPost<unknown>(
            API_ROUTES.line.itTicketCommentsById(ticketId),
            requestBody,
            {
                ...LIFF_API_REQUEST_OPTIONS,
                headers: { "Idempotency-Key": idempotencyKey },
            },
        ),
        "comment",
    );
    const parsed = parseITTicketCommentSubmission(payload);
    if (parsed === null) {
        throw invalidResponse("ระบบยืนยันผลการส่งข้อความไม่ได้ กรุณาลองส่งรายการเดิมอีกครั้ง");
    }
    return parsed;
}

export async function fetchLiffITAttachment(
    attachmentId: string,
    signal?: AbortSignal,
): Promise<Blob> {
    const response = await fetchLiffWithSessionRecovery(
        API_ROUTES.line.itAttachmentById(attachmentId),
        {
            cache: "no-store",
            credentials: "include",
            ...(signal ? { signal } : {}),
        },
    );
    if (!response.ok) {
        const message = getITApiErrorMessage({
            success: false,
            error: "",
            errorThai: "",
            code: "UNKNOWN_ERROR",
            status: response.status,
        }, "attachment");
        throw new LiffApiError(message, response.status);
    }

    const contentType = response.headers.get("content-type")?.split(";")[0]?.trim();
    const blob = await response.blob();
    if (contentType !== "image/webp" || blob.type !== "image/webp") {
        throw new LiffApiError("ชนิดรูปภาพไม่ถูกต้อง ไม่สามารถเปิดไฟล์นี้ได้", response.status);
    }
    return blob;
}
