import type {
    ITTicketCommentKind,
    ITTicketPriority,
    ITTicketStatus,
    ITTicketType,
} from "@prisma/client";

import { IT_TICKET_ACTIVE_WORK_STATUSES } from "./domain/ticket-workflow";

export const IT_TICKET_TITLE_MAX_LENGTH = 200;
export const IT_TICKET_DESCRIPTION_MAX_LENGTH = 10_000;
/** Technical safety bound pending an IT-specific product maximum. */
export const IT_TICKET_COMMENT_MAX_LENGTH = IT_TICKET_DESCRIPTION_MAX_LENGTH;
export const IT_TICKET_CONVERSATION_DEFAULT_LIMIT = 25;
export const IT_TICKET_CONVERSATION_MAX_LIMIT = 100;
export const IT_TICKET_ACTIVITY_DEFAULT_LIMIT = 25;
export const IT_TICKET_ACTIVITY_MAX_LIMIT = 100;
export const IT_TICKET_COMMENTABLE_STATUSES = Object.freeze([
    "OPEN",
    "IN_PROGRESS",
    "WAITING_REQUESTER",
] as const satisfies readonly ITTicketStatus[]);
export const IT_TICKET_LIST_DEFAULT_PAGE = 1;
export const IT_TICKET_LIST_DEFAULT_LIMIT = 10;
export const IT_TICKET_LIST_MAX_LIMIT = 100;
export const IT_TICKET_DATABASE_INT_MAX = 2_147_483_647;

export function isValidITTicketId(value: number): boolean {
    return Number.isSafeInteger(value)
        && value > 0
        && value <= IT_TICKET_DATABASE_INT_MAX;
}

export const IT_OPERATOR_QUEUE_DEFAULT_LIMIT = 25;

/**
 * Named operator queue views. `ACTIVE` is the default work queue; `RESOLVED`
 * (an exact status) is the awaiting-closure view; `HISTORY` holds the
 * terminal outcomes. `ALL` removes the status predicate.
 */
export const IT_OPERATOR_QUEUE_STATUS_GROUPS = Object.freeze({
    ACTIVE: IT_TICKET_ACTIVE_WORK_STATUSES,
    HISTORY: Object.freeze(["CLOSED", "CANCELLED"] as const satisfies readonly ITTicketStatus[]),
});
export type ITOperatorQueueStatusGroup = keyof typeof IT_OPERATOR_QUEUE_STATUS_GROUPS;
export type ITOperatorQueueStatusFilter = ITOperatorQueueStatusGroup | "ALL" | ITTicketStatus;
export const IT_OPERATOR_QUEUE_MAX_LIMIT = 100;
export const IT_TICKET_ATTACHMENT_MAX_FILES = 3;
export const IT_TICKET_ATTACHMENT_MAX_BYTES = 8 * 1024 * 1024;
export const IT_TICKET_ATTACHMENT_MAX_TOTAL_BYTES = 20 * 1024 * 1024;
export const IT_TICKET_ATTACHMENT_MAX_REQUEST_BYTES = 25_000_000;
export const IT_TICKET_ATTACHMENT_MAX_INPUT_PIXELS = 40_000_000;
export const IT_TICKET_ATTACHMENT_MAX_WIDTH = 2400;
export const IT_TICKET_ATTACHMENT_MAX_HEIGHT = 2400;
export const IT_TICKET_ATTACHMENT_WEBP_QUALITY = 88;
export const IT_TICKET_ATTACHMENT_ORPHAN_SAFETY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const IT_TICKET_ATTACHMENT_ACCEPTED_TYPES = Object.freeze([
    "image/jpeg",
    "image/png",
    "image/webp",
] as const);

export const IT_ANALYTICS_PERIODS = Object.freeze(["7D", "30D", "90D"] as const);
export const IT_ANALYTICS_TIME_ZONE = "Asia/Bangkok" as const;

export type ITAnalyticsPeriod = (typeof IT_ANALYTICS_PERIODS)[number];

/** Canonical filter value for Tickets whose current category is null. */
export const IT_ANALYTICS_UNCATEGORIZED_FILTER = "uncategorized" as const;
export type ITAnalyticsCategoryFilter = number | typeof IT_ANALYTICS_UNCATEGORIZED_FILTER;

/** Ranked category chart size; remaining groups are summarized, never dropped silently. */
export const IT_ANALYTICS_TOP_CATEGORY_LIMIT = 10;

/** Current priorities counted as the high-priority backlog. */
export const IT_ANALYTICS_HIGH_PRIORITIES = Object.freeze([
    "P0",
    "P1",
] as const satisfies readonly ITTicketPriority[]);

/**
 * Backlog age uses completed elapsed 24-hour periods since `ITTicket.createdAt`.
 * Buckets are contiguous and exhaustive; `maxDays: null` is open-ended.
 */
export const IT_ANALYTICS_BACKLOG_AGE_BUCKETS = Object.freeze([
    { key: "0_1", minDays: 0, maxDays: 1, label: "0–1 วัน" },
    { key: "2_3", minDays: 2, maxDays: 3, label: "2–3 วัน" },
    { key: "4_7", minDays: 4, maxDays: 7, label: "4–7 วัน" },
    { key: "8_14", minDays: 8, maxDays: 14, label: "8–14 วัน" },
    { key: "15_PLUS", minDays: 15, maxDays: null, label: "15 วันขึ้นไป" },
] as const);
export type ITAnalyticsBacklogAgeBucketKey =
    (typeof IT_ANALYTICS_BACKLOG_AGE_BUCKETS)[number]["key"];

/** Labels the aggregate DTO uses for null dimension identities. */
export const IT_ANALYTICS_UNCATEGORIZED_LABEL = "ยังไม่จัดหมวดหมู่";
export const IT_ANALYTICS_UNASSIGNED_LABEL = "ยังไม่มีผู้รับผิดชอบ";

/** "Older than seven completed days" means at least eight completed days. */
export const IT_ANALYTICS_AGED_BACKLOG_MIN_DAYS = 8;

export interface ITPresentationCapabilities {
    readonly canReadOwnTickets: boolean;
    readonly canReadAllTickets: boolean;
    readonly canCreateOwnTickets: boolean;
    readonly canCommentOwnTickets: boolean;
    readonly canCommentAllTickets: boolean;
    readonly canManageTickets: boolean;
    readonly canReadAnalytics: boolean;
}

export interface ITAnalyticsDashboard {
    readonly generatedAt: string;
    readonly timeZone: typeof IT_ANALYTICS_TIME_ZONE;
    readonly period: {
        readonly key: ITAnalyticsPeriod;
        readonly startAt: string;
        readonly endAt: string;
    };
    /** Applied Ticket filters; they narrow both period and current-snapshot metrics. */
    readonly filters: {
        readonly type: ITTicketType | null;
        readonly category: ITAnalyticsCategoryFilter | null;
    };
    readonly filterOptions: {
        /** Active categories plus inactive categories still referenced by a Ticket. */
        readonly categories: readonly {
            readonly id: number;
            readonly key: string;
            readonly name: string;
            readonly isActive: boolean;
        }[];
    };
    readonly summary: {
        readonly currentBacklog: number;
        readonly waitingRequester: number;
        readonly unassignedBacklog: number;
        readonly untriagedBacklog: number;
        /** Current backlog with a current priority in `IT_ANALYTICS_HIGH_PRIORITIES`. */
        readonly highPriorityBacklog: number;
        /** Current backlog aged at least `IT_ANALYTICS_AGED_BACKLOG_MIN_DAYS` completed days. */
        readonly agedBacklog: number;
        readonly oldestUnresolvedAgeMinutes: number | null;
        readonly newTickets: number;
        readonly resolvedTickets: number;
        readonly firstRespondedTickets: number;
        readonly averageFirstResponseMinutes: number | null;
        readonly averageResolutionMinutes: number | null;
    };
    readonly trend: readonly {
        readonly date: string;
        readonly created: number;
        readonly resolved: number;
    }[];
    readonly statusDistribution: readonly {
        readonly status: ITTicketStatus;
        readonly count: number;
    }[];
    readonly typeDistribution: readonly {
        readonly type: ITTicketType;
        readonly count: number;
    }[];
    readonly priorityDistribution: readonly {
        readonly priority: ITTicketPriority;
        readonly count: number;
    }[];
    readonly priorityBacklog: readonly {
        readonly priority: ITTicketPriority;
        readonly count: number;
    }[];
    readonly responseResolutionByPriority: readonly {
        readonly priority: ITTicketPriority;
        readonly firstRespondedTickets: number;
        readonly averageFirstResponseMinutes: number | null;
        readonly resolvedTickets: number;
        readonly averageResolutionMinutes: number | null;
    }[];
    /**
     * Period-created Tickets grouped by their *current* category identity.
     * This is not category-at-creation; later reclassification moves a Ticket.
     */
    readonly topCategories: {
        readonly limit: number;
        readonly rows: readonly {
            /** `null` is the explicit uncategorized group. */
            readonly categoryId: number | null;
            readonly label: string;
            readonly count: number;
        }[];
        readonly otherCategoryCount: number;
        readonly otherTicketCount: number;
    };
    /** Current backlog grouped by completed days since creation, in bucket order. */
    readonly backlogAging: readonly {
        readonly bucket: ITAnalyticsBacklogAgeBucketKey;
        readonly count: number;
    }[];
    readonly categoryBacklog: readonly {
        readonly label: string;
        readonly count: number;
    }[];
    readonly assigneeBacklog: readonly {
        readonly label: string;
        readonly count: number;
    }[];
    readonly departmentCreated: readonly {
        readonly label: string;
        readonly count: number;
    }[];
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

export interface ITRequesterTicketDetail extends ITRequesterTicket {
    readonly initialAttachments: readonly ITTicketAttachmentSummary[];
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
    readonly priority: ITTicketPriority;
    readonly triagedAt: string | null;
    readonly isTriaged: boolean;
    readonly triagedBy: ITTicketOperatorIdentity | null;
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

export interface ITOperatorTicketDetail extends ITOperatorTicket {
    readonly initialAttachments: readonly ITTicketAttachmentSummary[];
}

export interface ITOperatorTicketList {
    readonly tickets: readonly ITOperatorTicket[];
    readonly nextCursor: string | null;
    readonly limit: number;
    /** All current `RESOLVED` Tickets, independent of the requested filters. */
    readonly awaitingClosureCount: number;
}

export interface ITOperatorTicketMutationSnapshot {
    readonly id: number;
    readonly version: number;
    readonly status: ITTicketStatus;
    readonly priority: ITTicketPriority;
    readonly triagedAt: string | null;
    readonly triagedByUserId: number | null;
    readonly isTriaged: boolean;
    readonly assignedToUserId: number | null;
    readonly categoryId: number | null;
    readonly updatedAt: string;
}

export interface ITTicketConversationItem {
    readonly id: string;
    readonly createdAt: string;
    readonly authorDisplayName: string;
    readonly authorSide: ITTicketCommentKind;
    readonly body: string;
    readonly attachments: readonly ITTicketAttachmentSummary[];
}

export interface ITTicketAttachmentSummary {
    readonly id: string;
    readonly originalName: string;
    readonly contentType: "image/webp";
    readonly sizeBytes: number;
    readonly width: number;
    readonly height: number;
    readonly position: number;
}

export type ITTicketActivityItem =
    | {
        readonly type: "CREATED";
        readonly id: number;
        readonly occurredAt: string;
        readonly actorDisplayName: string;
    }
    | {
        readonly type: "ASSIGNED" | "UNASSIGNED";
        readonly id: number;
        readonly occurredAt: string;
        readonly actorDisplayName: string;
        readonly fromAssigneeDisplayName: string | null;
        readonly toAssigneeDisplayName: string | null;
    }
    | {
        readonly type: "STATUS_CHANGED";
        readonly id: number;
        readonly occurredAt: string;
        readonly actorDisplayName: string;
        readonly fromStatus: ITTicketStatus | null;
        readonly toStatus: ITTicketStatus | null;
    }
    | {
        readonly type: "CATEGORY_CHANGED";
        readonly id: number;
        readonly occurredAt: string;
        readonly actorDisplayName: string;
        readonly fromCategoryName: string | null;
        readonly toCategoryName: string | null;
    }
    | {
        readonly type: "PRIORITY_TRIAGED" | "PRIORITY_CHANGED";
        readonly id: number;
        readonly occurredAt: string;
        readonly actorDisplayName: string;
        readonly fromPriority: ITTicketPriority;
        readonly toPriority: ITTicketPriority;
        readonly reason: string | null;
    };

export interface ITTicketConversationPage {
    /** Chronological order; the first page contains the latest bounded comment slice. */
    readonly items: readonly ITTicketConversationItem[];
    readonly olderCursor: string | null;
    readonly hasMore: boolean;
}

export interface ITTicketActivityPage {
    /** Chronological order; the first page contains the latest bounded event slice. */
    readonly items: readonly ITTicketActivityItem[];
    readonly olderCursor: string | null;
    readonly hasMore: boolean;
}

export interface ITTicketCommentSubmission {
    readonly comment: ITTicketConversationItem;
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

export const IT_TICKET_STATUS_OPTIONS = [
    { value: "OPEN", label: "รับเรื่องแล้ว" },
    { value: "IN_PROGRESS", label: "กำลังดำเนินการ" },
    { value: "WAITING_REQUESTER", label: "รอข้อมูลจากผู้แจ้ง" },
    { value: "RESOLVED", label: "แก้ไขแล้ว" },
    { value: "CLOSED", label: "ปิดงานแล้ว" },
    { value: "CANCELLED", label: "ยกเลิกแล้ว" },
] as const satisfies readonly { value: ITTicketStatus; label: string }[];

export const IT_TICKET_TYPE_LABELS: Readonly<Record<ITTicketType, string>> = {
    INCIDENT: "ปัญหาที่พบ",
    SERVICE_REQUEST: "ขอรับบริการ",
    SUGGESTION: "ข้อเสนอแนะ",
};

export const IT_TICKET_PRIORITY_OPTIONS = [
    { value: "P0", label: "P0 — วิกฤต" },
    { value: "P1", label: "P1 — สูง" },
    { value: "P2", label: "P2 — ปกติ" },
    { value: "P3", label: "P3 — ต่ำ" },
] as const satisfies readonly { value: ITTicketPriority; label: string }[];

export const IT_TICKET_PRIORITY_LABELS: Readonly<Record<ITTicketPriority, string>> = {
    P0: "P0 — วิกฤต",
    P1: "P1 — สูง",
    P2: "P2 — ปกติ",
    P3: "P3 — ต่ำ",
};

export const IT_TICKET_STATUS_LABELS: Readonly<Record<ITTicketStatus, string>> = {
    OPEN: "รับเรื่องแล้ว",
    IN_PROGRESS: "กำลังดำเนินการ",
    WAITING_REQUESTER: "รอข้อมูลจากผู้แจ้ง",
    RESOLVED: "แก้ไขแล้ว",
    CLOSED: "ปิดงานแล้ว",
    CANCELLED: "ยกเลิกแล้ว",
};
