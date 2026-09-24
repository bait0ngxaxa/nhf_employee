import type { ITTicketStatus, ITTicketType } from "@prisma/client";

export const IT_TICKET_TITLE_MAX_LENGTH = 200;
export const IT_TICKET_DESCRIPTION_MAX_LENGTH = 10_000;
export const IT_TICKET_LIST_DEFAULT_PAGE = 1;
export const IT_TICKET_LIST_DEFAULT_LIMIT = 10;
export const IT_TICKET_LIST_MAX_LIMIT = 100;

export interface ITPresentationCapabilities {
    readonly canReadOwnTickets: boolean;
    readonly canReadAllTickets: boolean;
    readonly canCreateOwnTickets: boolean;
    readonly canCommentOwnTickets: boolean;
    readonly canCommentAllTickets: boolean;
    readonly canManageTickets: boolean;
    readonly canReadAnalytics: boolean;
}

/** Safe requester-facing representation. Never includes ownership or operator data. */
export interface ITRequesterTicket {
    readonly id: number;
    readonly type: ITTicketType;
    readonly title: string;
    readonly description: string;
    readonly status: ITTicketStatus;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly resolvedAt: string | null;
}

export interface ITRequesterTicketPagination {
    readonly page: number;
    readonly limit: number;
    readonly total: number;
    readonly totalPages: number;
}

export interface ITRequesterTicketList {
    readonly tickets: readonly ITRequesterTicket[];
    readonly pagination: ITRequesterTicketPagination;
}

export const IT_TICKET_TYPE_OPTIONS = [
    { value: "INCIDENT", label: "แจ้งปัญหาที่พบ" },
    { value: "SERVICE_REQUEST", label: "ขอรับบริการหรือความช่วยเหลือ" },
    { value: "SUGGESTION", label: "เสนอแนะการปรับปรุง" },
] as const satisfies readonly { value: ITTicketType; label: string }[];

export const IT_TICKET_TYPE_LABELS: Readonly<Record<ITTicketType, string>> = {
    INCIDENT: "ปัญหาที่พบ",
    SERVICE_REQUEST: "ขอรับบริการ",
    SUGGESTION: "ข้อเสนอแนะ",
};

export const IT_TICKET_STATUS_LABELS: Readonly<Record<ITTicketStatus, string>> = {
    OPEN: "รับเรื่องแล้ว",
    IN_PROGRESS: "กำลังดำเนินการ",
    WAITING_REQUESTER: "รอข้อมูลเพิ่มเติม",
    RESOLVED: "แก้ไขแล้ว",
    CLOSED: "ปิดงานแล้ว",
    CANCELLED: "ยกเลิกแล้ว",
};
