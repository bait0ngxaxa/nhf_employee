import type {
    ITTicketCommentKind,
    ITTicketStatus,
    ITTicketType,
} from "@prisma/client";

export const IT_TICKET_TITLE_MAX_LENGTH = 200;
export const IT_TICKET_DESCRIPTION_MAX_LENGTH = 10_000;
/** Technical safety bound pending an IT-specific product maximum. */
export const IT_TICKET_COMMENT_MAX_LENGTH = IT_TICKET_DESCRIPTION_MAX_LENGTH;
export const IT_TICKET_TIMELINE_DEFAULT_LIMIT = 25;
export const IT_TICKET_TIMELINE_MAX_LIMIT = 100;
export const IT_TICKET_COMMENTABLE_STATUSES = Object.freeze([
    "OPEN",
    "IN_PROGRESS",
    "WAITING_REQUESTER",
] as const satisfies readonly ITTicketStatus[]);
export const IT_TICKET_LIST_DEFAULT_PAGE = 1;
export const IT_TICKET_LIST_DEFAULT_LIMIT = 10;
export const IT_TICKET_LIST_MAX_LIMIT = 100;
export const IT_TICKET_DATABASE_INT_MAX = 2_147_483_647;
export const IT_OPERATOR_QUEUE_DEFAULT_LIMIT = 25;
export const IT_OPERATOR_QUEUE_MAX_LIMIT = 100;

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

export interface ITTicketOperatorIdentity {
    readonly userId: number;
    readonly displayName: string;
}

export interface ITOperatorTicket {
    readonly id: number;
    readonly type: ITTicketType;
    readonly title: string;
    readonly description: string;
    readonly status: ITTicketStatus;
    readonly requester: ITTicketOperatorIdentity & {
        readonly departmentId: number | null;
        readonly departmentNameSnapshot: string | null;
    };
    readonly assignee: ITTicketOperatorIdentity | null;
    readonly category: {
        readonly id: number;
        readonly key: string;
        readonly name: string;
        readonly isActive: boolean;
    } | null;
    readonly version: number;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly resolvedAt: string | null;
}

export interface ITOperatorTicketList {
    readonly tickets: readonly ITOperatorTicket[];
    readonly nextCursor: string | null;
    readonly limit: number;
}

export interface ITOperatorTicketMutationSnapshot {
    readonly id: number;
    readonly version: number;
    readonly status: ITTicketStatus;
    readonly assignedToUserId: number | null;
    readonly categoryId: number | null;
    readonly updatedAt: string;
}

export interface ITTicketTimelineComment {
    readonly type: "COMMENT";
    readonly id: string;
    readonly createdAt: string;
    readonly authorDisplayName: string;
    readonly authorSide: ITTicketCommentKind;
    readonly body: string;
}

export type ITTicketTimelineEvent =
    | {
        readonly type: "CREATED";
        readonly id: number;
        readonly createdAt: string;
        readonly actorDisplayName: string;
    }
    | {
        readonly type: "ASSIGNED" | "UNASSIGNED";
        readonly id: number;
        readonly createdAt: string;
        readonly actorDisplayName: string;
        readonly fromAssigneeDisplayName: string | null;
        readonly toAssigneeDisplayName: string | null;
    }
    | {
        readonly type: "STATUS_CHANGED";
        readonly id: number;
        readonly createdAt: string;
        readonly actorDisplayName: string;
        readonly fromStatus: ITTicketStatus | null;
        readonly toStatus: ITTicketStatus | null;
    }
    | {
        readonly type: "CATEGORY_CHANGED";
        readonly id: number;
        readonly createdAt: string;
        readonly actorDisplayName: string;
        readonly fromCategoryName: string | null;
        readonly toCategoryName: string | null;
    };

export type ITTicketTimelineItem = ITTicketTimelineComment | ITTicketTimelineEvent;

export interface ITTicketTimelinePage {
    /** Chronological order; the first page contains the latest bounded slice. */
    readonly items: readonly ITTicketTimelineItem[];
    readonly olderCursor: string | null;
    readonly hasMore: boolean;
}

export interface ITTicketCommentSubmission {
    readonly comment: ITTicketTimelineComment;
    readonly replayed: boolean;
}

export interface ITAssignableOperator {
    readonly userId: number;
    readonly employeeId: number;
    readonly displayName: string;
}

export interface ITOperatorReferenceData {
    readonly categories: readonly {
        readonly id: number;
        readonly key: string;
        readonly name: string;
    }[];
    readonly assignableOperators: readonly ITAssignableOperator[];
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
    WAITING_REQUESTER: "รอข้อมูลจากผู้แจ้ง",
    RESOLVED: "แก้ไขแล้ว",
    CLOSED: "ปิดงานแล้ว",
    CANCELLED: "ยกเลิกแล้ว",
};
