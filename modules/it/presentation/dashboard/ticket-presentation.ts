import {
    IT_OPERATOR_QUEUE_MAX_LIMIT,
    IT_TICKET_STATUS_LABELS,
    IT_TICKET_TYPE_LABELS,
    type ITTicketCommentSubmission,
    type ITTicketAttachmentSummary,
    type ITTicketTimelineItem,
    type ITTicketTimelinePage,
    type ITAssignableOperator,
    type ITOperatorReferenceData,
    type ITOperatorTicket,
    type ITOperatorTicketList,
    type ITOperatorTicketMutationSnapshot,
    type ITRequesterTicket,
    type ITRequesterTicketDetail,
    type ITRequesterTicketList,
    type ITOperatorTicketDetail,
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

export function isITTicketStatus(value: unknown): value is ITTicketStatus {
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

export function parseITRequesterTicketDetail(
    value: unknown,
): ITRequesterTicketDetail | null {
    if (!isITTicketResponseRecord(value) || !Array.isArray(value.initialAttachments)) {
        return null;
    }
    const ticket = parseITRequesterTicket(value);
    if (ticket === null) return null;
    const initialAttachments = value.initialAttachments.map(parseITTicketAttachmentSummary);
    if (initialAttachments.some((attachment) => attachment === null)) return null;
    return {
        ...ticket,
        initialAttachments: initialAttachments.filter(
            (attachment): attachment is ITTicketAttachmentSummary => attachment !== null,
        ),
    };
}

function isPositiveSafeInteger(value: unknown): value is number {
    return typeof value === "number"
        && Number.isSafeInteger(value)
        && value > 0;
}

function isNullablePositiveSafeInteger(value: unknown): value is number | null {
    return value === null || isPositiveSafeInteger(value);
}

function isNullableString(value: unknown): value is string | null {
    return value === null || typeof value === "string";
}

function parseOperatorIdentity(value: unknown): {
    readonly userId: number;
    readonly displayName: string;
} | null {
    if (!isITTicketResponseRecord(value)
        || !isPositiveSafeInteger(value.userId)
        || typeof value.displayName !== "string") {
        return null;
    }
    return { userId: value.userId, displayName: value.displayName };
}

export function parseITOperatorTicket(value: unknown): ITOperatorTicket | null {
    if (!isITTicketResponseRecord(value)
        || !isPositiveSafeInteger(value.id)
        || !isITTicketType(value.type)
        || typeof value.title !== "string"
        || typeof value.description !== "string"
        || !isITTicketStatus(value.status)
        || !isPositiveSafeInteger(value.version)
        || typeof value.createdAt !== "string"
        || typeof value.updatedAt !== "string"
        || !isNullableString(value.resolvedAt)
        || !isITTicketResponseRecord(value.requester)
        || !isNullablePositiveSafeInteger(value.requester.departmentId)
        || !isNullableString(value.requester.departmentNameSnapshot)) {
        return null;
    }

    const requesterIdentity = parseOperatorIdentity(value.requester);
    if (requesterIdentity === null) return null;

    let assignee: ITOperatorTicket["assignee"] = null;
    if (value.assignee !== null) {
        const parsedAssignee = parseOperatorIdentity(value.assignee);
        if (parsedAssignee === null) return null;
        assignee = parsedAssignee;
    }

    let category: ITOperatorTicket["category"] = null;
    if (value.category !== null) {
        if (!isITTicketResponseRecord(value.category)
            || !isPositiveSafeInteger(value.category.id)
            || typeof value.category.key !== "string"
            || typeof value.category.name !== "string"
            || typeof value.category.isActive !== "boolean") {
            return null;
        }
        category = {
            id: value.category.id,
            key: value.category.key,
            name: value.category.name,
            isActive: value.category.isActive,
        };
    }

    return {
        id: value.id,
        type: value.type,
        title: value.title,
        description: value.description,
        status: value.status,
        requester: {
            ...requesterIdentity,
            departmentId: value.requester.departmentId,
            departmentNameSnapshot: value.requester.departmentNameSnapshot,
        },
        assignee,
        category,
        version: value.version,
        createdAt: value.createdAt,
        updatedAt: value.updatedAt,
        resolvedAt: value.resolvedAt,
    };
}

export function parseITOperatorTicketDetail(value: unknown): ITOperatorTicketDetail | null {
    if (!isITTicketResponseRecord(value) || !Array.isArray(value.initialAttachments)) {
        return null;
    }
    const ticket = parseITOperatorTicket(value);
    if (ticket === null) return null;
    const initialAttachments = value.initialAttachments.map(parseITTicketAttachmentSummary);
    if (initialAttachments.some((attachment) => attachment === null)) return null;
    return {
        ...ticket,
        initialAttachments: initialAttachments.filter(
            (attachment): attachment is ITTicketAttachmentSummary => attachment !== null,
        ),
    };
}

export function parseITOperatorTicketList(value: unknown): ITOperatorTicketList | null {
    if (!isITTicketResponseRecord(value)
        || value.success !== true
        || !Array.isArray(value.tickets)
        || (value.nextCursor !== null && typeof value.nextCursor !== "string")
        || !isPositiveSafeInteger(value.limit)) {
        return null;
    }
    if (value.limit > IT_OPERATOR_QUEUE_MAX_LIMIT || value.tickets.length > value.limit) {
        return null;
    }

    const tickets = value.tickets.map(parseITOperatorTicket);
    if (tickets.some((ticket) => ticket === null)) return null;

    return {
        tickets: tickets.filter((ticket): ticket is ITOperatorTicket => ticket !== null),
        nextCursor: value.nextCursor,
        limit: value.limit,
    };
}

function parseAssignableOperator(value: unknown): ITAssignableOperator | null {
    if (!isITTicketResponseRecord(value)
        || !isPositiveSafeInteger(value.userId)
        || !isPositiveSafeInteger(value.employeeId)
        || typeof value.displayName !== "string") {
        return null;
    }
    return {
        userId: value.userId,
        employeeId: value.employeeId,
        displayName: value.displayName,
    };
}

export function parseITOperatorReferenceData(value: unknown): ITOperatorReferenceData | null {
    if (!isITTicketResponseRecord(value)
        || value.success !== true
        || !Array.isArray(value.categories)
        || !Array.isArray(value.assignableOperators)) {
        return null;
    }

    const categories = value.categories.map((category): ITOperatorReferenceData["categories"][number] | null => {
        if (!isITTicketResponseRecord(category)
            || !isPositiveSafeInteger(category.id)
            || typeof category.key !== "string"
            || typeof category.name !== "string") {
            return null;
        }
        return { id: category.id, key: category.key, name: category.name };
    });
    const assignableOperators = value.assignableOperators.map(parseAssignableOperator);
    if (categories.some((category) => category === null)
        || assignableOperators.some((operator) => operator === null)) {
        return null;
    }

    return {
        categories: categories.filter((category): category is ITOperatorReferenceData["categories"][number] =>
            category !== null,
        ),
        assignableOperators: assignableOperators.filter(
            (operator): operator is ITAssignableOperator => operator !== null,
        ),
    };
}

export function parseITOperatorTicketMutationSnapshot(value: unknown): {
    readonly ticket: ITOperatorTicketMutationSnapshot;
    readonly changed: boolean;
} | null {
    if (!isITTicketResponseRecord(value)
        || value.success !== true
        || typeof value.changed !== "boolean"
        || !isITTicketResponseRecord(value.ticket)
        || !isPositiveSafeInteger(value.ticket.id)
        || !isPositiveSafeInteger(value.ticket.version)
        || !isITTicketStatus(value.ticket.status)
        || !isNullablePositiveSafeInteger(value.ticket.assignedToUserId)
        || !isNullablePositiveSafeInteger(value.ticket.categoryId)
        || typeof value.ticket.updatedAt !== "string") {
        return null;
    }
    return {
        changed: value.changed,
        ticket: {
            id: value.ticket.id,
            version: value.ticket.version,
            status: value.ticket.status,
            assignedToUserId: value.ticket.assignedToUserId,
            categoryId: value.ticket.categoryId,
            updatedAt: value.ticket.updatedAt,
        },
    };
}

export function isITOperatorMutationVersionConflict(value: unknown): boolean {
    return isITTicketResponseRecord(value)
        && value.code === "MUTATION_CONFLICT"
        && (value.reason === "STALE_VERSION" || value.reason === "CONCURRENT_WRITE");
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

export function readITOperatorError(
    payload: unknown,
    status: number,
    detail = false,
): string {
    if (status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
    if (status === 403) return "บัญชีนี้ไม่มีสิทธิ์ดำเนินการกับคิว IT Ticket";
    if (status === 404 && detail) return "ไม่พบ Ticket ที่ระบุ";
    if (status === 409) {
        return isITTicketResponseRecord(payload) && typeof payload.error === "string"
            ? payload.error
            : "Ticket ถูกเปลี่ยนแปลงหรือไม่สามารถดำเนินการตามสถานะปัจจุบันได้";
    }
    if (isITTicketResponseRecord(payload) && typeof payload.error === "string") {
        return payload.error;
    }
    return detail
        ? "ไม่สามารถโหลด Ticket ได้ กรุณาลองอีกครั้ง"
        : "ไม่สามารถเชื่อมต่อคิว IT Ticket ได้ กรุณาลองอีกครั้ง";
}

export function formatITTicketDate(value: string): string {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "ไม่ระบุ";
    return new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

function isISODateTime(value: unknown): value is string {
    return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isNullableITTicketStatus(value: unknown): value is ITTicketStatus | null {
    return value === null || isITTicketStatus(value);
}

function isNullableDisplayName(value: unknown): value is string | null {
    return value === null || typeof value === "string";
}

export function parseITTicketTimelineItem(value: unknown): ITTicketTimelineItem | null {
    if (!isITTicketResponseRecord(value)
        || !isISODateTime(value.createdAt)) {
        return null;
    }

    if (value.type === "COMMENT") {
        if (typeof value.id !== "string"
            || typeof value.authorDisplayName !== "string"
            || (value.authorSide !== "REQUESTER" && value.authorSide !== "OPERATOR")
            || typeof value.body !== "string"
            || !Array.isArray(value.attachments)
            || value.attachments.length > 3) {
            return null;
        }
        const attachments = value.attachments.map(parseITTicketAttachmentSummary);
        if (attachments.some((attachment, index) =>
            attachment === null || attachment.position !== index,
        )) return null;
        return {
            type: "COMMENT",
            id: value.id,
            createdAt: value.createdAt,
            authorDisplayName: value.authorDisplayName,
            authorSide: value.authorSide,
            body: value.body,
            attachments: attachments.filter(
                (attachment): attachment is ITTicketAttachmentSummary => attachment !== null,
            ),
        };
    }

    if (!isPositiveSafeInteger(value.id) || typeof value.actorDisplayName !== "string") {
        return null;
    }
    const base = {
        id: value.id,
        createdAt: value.createdAt,
        actorDisplayName: value.actorDisplayName,
    };

    if (value.type === "CREATED") return { type: "CREATED", ...base };
    if (value.type === "ASSIGNED" || value.type === "UNASSIGNED") {
        if (!isNullableDisplayName(value.fromAssigneeDisplayName)
            || !isNullableDisplayName(value.toAssigneeDisplayName)) {
            return null;
        }
        return {
            type: value.type,
            ...base,
            fromAssigneeDisplayName: value.fromAssigneeDisplayName,
            toAssigneeDisplayName: value.toAssigneeDisplayName,
        };
    }
    if (value.type === "STATUS_CHANGED") {
        if (!isNullableITTicketStatus(value.fromStatus)
            || !isNullableITTicketStatus(value.toStatus)) {
            return null;
        }
        return {
            type: "STATUS_CHANGED",
            ...base,
            fromStatus: value.fromStatus,
            toStatus: value.toStatus,
        };
    }
    if (value.type === "CATEGORY_CHANGED") {
        if (!isNullableDisplayName(value.fromCategoryName)
            || !isNullableDisplayName(value.toCategoryName)) {
            return null;
        }
        return {
            type: "CATEGORY_CHANGED",
            ...base,
            fromCategoryName: value.fromCategoryName,
            toCategoryName: value.toCategoryName,
        };
    }
    return null;
}

function parseITTicketAttachmentSummary(value: unknown): ITTicketAttachmentSummary | null {
    if (!isITTicketResponseRecord(value)
        || typeof value.id !== "string"
        || !/^[a-f0-9]{32}$/.test(value.id)
        || typeof value.originalName !== "string"
        || value.originalName.length < 1
        || value.originalName.length > 255
        || value.originalName.trim().length === 0
        || value.originalName !== value.originalName.trim()
        || /[\\/]/.test(value.originalName)
        || /\p{Cc}/u.test(value.originalName)
        || value.originalName.includes("..")
        || value.contentType !== "image/webp"
        || !Number.isSafeInteger(value.sizeBytes)
        || (value.sizeBytes as number) <= 0
        || !Number.isSafeInteger(value.width)
        || (value.width as number) <= 0
        || (value.width as number) > 2400
        || !Number.isSafeInteger(value.height)
        || (value.height as number) <= 0
        || (value.height as number) > 2400
        || !Number.isSafeInteger(value.position)
        || (value.position as number) < 0
        || (value.position as number) >= 3) {
        return null;
    }
    return {
        id: value.id,
        originalName: value.originalName,
        contentType: "image/webp",
        sizeBytes: value.sizeBytes as number,
        width: value.width as number,
        height: value.height as number,
        position: value.position as number,
    };
}

export function parseITTicketTimelinePage(value: unknown): ITTicketTimelinePage | null {
    if (!isITTicketResponseRecord(value)
        || value.success !== true
        || !Array.isArray(value.items)
        || (value.olderCursor !== null && typeof value.olderCursor !== "string")
        || typeof value.hasMore !== "boolean"
        || (value.hasMore && typeof value.olderCursor !== "string")) {
        return null;
    }
    const items = value.items.map(parseITTicketTimelineItem);
    if (items.some((item) => item === null)) return null;
    return {
        items: items.filter((item): item is ITTicketTimelineItem => item !== null),
        olderCursor: value.olderCursor,
        hasMore: value.hasMore,
    };
}

export function parseITTicketCommentSubmission(value: unknown): ITTicketCommentSubmission | null {
    if (!isITTicketResponseRecord(value)
        || value.success !== true
        || typeof value.replayed !== "boolean") {
        return null;
    }
    const comment = parseITTicketTimelineItem(value.comment);
    if (comment === null || comment.type !== "COMMENT") return null;
    return { comment, replayed: value.replayed };
}

export function mergeITTicketTimelineItems(
    ...groups: readonly (readonly ITTicketTimelineItem[])[]
): ITTicketTimelineItem[] {
    const unique = new Map<string, ITTicketTimelineItem>();
    for (const item of groups.flat()) {
        unique.set(`${item.type}:${item.id}`, item);
    }
    return [...unique.values()].sort((left, right) => {
        const timeDifference = Date.parse(left.createdAt) - Date.parse(right.createdAt);
        if (timeDifference !== 0) return timeDifference;
        const leftIsEvent = left.type !== "COMMENT";
        const rightIsEvent = right.type !== "COMMENT";
        if (leftIsEvent !== rightIsEvent) return leftIsEvent ? -1 : 1;
        if (typeof left.id === "number" && typeof right.id === "number") {
            return left.id - right.id;
        }
        const leftId = String(left.id);
        const rightId = String(right.id);
        return leftId < rightId ? -1 : leftId > rightId ? 1 : 0;
    });
}

export function readITTicketConversationError(
    payload: unknown,
    status: number,
    operator: boolean,
): string {
    if (status === 401) return "เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง";
    if (status === 403) return "สิทธิ์หรือสถานะพนักงานเปลี่ยนแปลง จึงไม่สามารถดำเนินการได้";
    if (status === 404) return operator
        ? "ไม่พบ Ticket ที่ระบุ"
        : "ไม่พบ Ticket หรือคุณไม่มีสิทธิ์ดูรายการนี้";
    if (status === 409 && isITTicketResponseRecord(payload)
        && typeof payload.error === "string") {
        return payload.error;
    }
    if (isITTicketResponseRecord(payload) && typeof payload.error === "string") {
        return payload.error;
    }
    return status >= 500
        ? "ระบบขัดข้องชั่วคราว กรุณาลองอีกครั้ง"
        : "ไม่สามารถดำเนินการได้ กรุณาตรวจสอบข้อมูลแล้วลองอีกครั้ง";
}
