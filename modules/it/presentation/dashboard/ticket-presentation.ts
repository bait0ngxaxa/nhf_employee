import {
    IT_TICKET_STATUS_LABELS,
    IT_TICKET_TYPE_LABELS,
    type ITRequesterTicket,
    type ITRequesterTicketList,
} from "../../contracts";
import type { ITTicketStatus, ITTicketType } from "@prisma/client";

export const IT_TICKET_STATUS_STYLES: Readonly<Record<ITTicketStatus, string>> = {
    OPEN: "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
    IN_PROGRESS: "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
    WAITING_REQUESTER: "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    RESOLVED: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100",
    CLOSED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
    CANCELLED: "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
};

export function isITTicketResponseRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isITTicketType(value: unknown): value is ITTicketType {
    return typeof value === "string"
        && Object.prototype.hasOwnProperty.call(IT_TICKET_TYPE_LABELS, value);
}

function isITTicketStatus(value: unknown): value is ITTicketStatus {
    return typeof value === "string"
        && Object.prototype.hasOwnProperty.call(IT_TICKET_STATUS_LABELS, value);
}

export function parseITRequesterTicket(value: unknown): ITRequesterTicket | null {
    if (!isITTicketResponseRecord(value)
        || !Number.isSafeInteger(value.id)
        || !isITTicketType(value.type)
        || typeof value.title !== "string"
        || typeof value.description !== "string"
        || !isITTicketStatus(value.status)
        || typeof value.createdAt !== "string"
        || typeof value.updatedAt !== "string"
        || (value.resolvedAt !== null && typeof value.resolvedAt !== "string")) {
        return null;
    }

    return {
        id: value.id as number,
        type: value.type,
        title: value.title,
        description: value.description,
        status: value.status,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
        resolvedAt: value.resolvedAt,
    };
}

export function parseITRequesterTicketList(value: unknown): ITRequesterTicketList | null {
    if (!isITTicketResponseRecord(value)
        || value.success !== true
        || !Array.isArray(value.tickets)
        || !isITTicketResponseRecord(value.pagination)) {
        return null;
    }

    const tickets = value.tickets.map(parseITRequesterTicket);
    const pagination = value.pagination;
    if (tickets.some((ticket) => ticket === null)
        || !Number.isSafeInteger(pagination.page)
        || !Number.isSafeInteger(pagination.limit)
        || !Number.isSafeInteger(pagination.total)
        || !Number.isSafeInteger(pagination.totalPages)) {
        return null;
    }

    return {
        tickets: tickets.filter((ticket): ticket is ITRequesterTicket => ticket !== null),
        pagination: {
            page: pagination.page as number,
            limit: pagination.limit as number,
            total: pagination.total as number,
            totalPages: pagination.totalPages as number,
        },
    };
}

export function readITRequesterError(
    payload: unknown,
    status: number,
    detail = false,
): string {
    if (status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
    if (status === 403) return detail
        ? "บัญชีนี้ไม่มีสิทธิ์อ่าน Ticket"
        : "บัญชีนี้ไม่มีสิทธิ์อ่านรายการ Ticket";
    if (status === 404 && detail) return "ไม่พบ Ticket หรือคุณไม่มีสิทธิ์ดูรายการนี้";
    if (isITTicketResponseRecord(payload) && typeof payload.error === "string") {
        return payload.error;
    }
    return detail
        ? "ไม่สามารถโหลด Ticket ได้ กรุณาลองอีกครั้ง"
        : "ไม่สามารถเชื่อมต่อระบบได้ กรุณาลองอีกครั้ง";
}

export function formatITTicketDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "ไม่ระบุ";
    return new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}
