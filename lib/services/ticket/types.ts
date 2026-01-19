import type {
    Ticket,
    TicketComment,
    TicketView,
    TicketCategory,
    TicketPriority,
} from "@prisma/client";

// ==================== Input Types ====================

/** Filters for querying tickets list */
export interface TicketFilters {
    status?: string;
    category?: string;
    priority?: string;
    page: number;
    limit: number;
}

/** User context for authorization checks */
export interface UserContext {
    id: number;
    role: string;
    email: string;
}

/** Data for creating a new ticket - uses Prisma enum types */
export interface CreateTicketData {
    title: string;
    description: string;
    category: TicketCategory;
    priority: TicketPriority;
}

/** Data for updating an existing ticket */
export interface UpdateTicketData {
    title?: string;
    description?: string;
    category?: string;
    priority?: string;
    status?: string;
    assignedToId?: number | null;
    resolution?: string | null;
}

// ==================== Relation Types ====================

/** Basic user info with employee details */
export interface UserWithEmployee {
    id: number;
    name: string;
    email: string;
    employee: {
        firstName: string;
        lastName: string;
        dept?: {
            name: string;
        } | null;
    } | null;
}

/** User info for assignedTo (without dept) */
export interface AssignedUserInfo {
    id: number;
    name: string;
    email: string;
    employee: {
        firstName: string;
        lastName: string;
    } | null;
}

/** Comment author info */
export interface CommentAuthorInfo {
    id: number;
    name: string;
    email: string;
    role: string;
    employee: {
        firstName: string;
        lastName: string;
    } | null;
}

/** Comment with author details */
export interface TicketCommentWithAuthor extends TicketComment {
    author: CommentAuthorInfo;
}

// ==================== Output Types ====================

/** Ticket for list view */
export interface TicketListItem extends Ticket {
    reportedBy: UserWithEmployee;
    assignedTo: AssignedUserInfo | null;
    _count: {
        comments: number;
    };
    views: TicketView[];
}

/** Full ticket with all relations */
export interface TicketWithRelations extends Ticket {
    reportedBy: UserWithEmployee;
    assignedTo: AssignedUserInfo | null;
    comments?: TicketCommentWithAuthor[];
}

/** Paginated tickets response */
export interface PaginatedTicketsResult {
    tickets: TicketListItem[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        pages: number;
    };
}

// ==================== Service Result Types ====================

/** Generic service result wrapper */
export interface ServiceResult<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
    };
}

/** Permission check result */
export interface PermissionCheck {
    isOwner: boolean;
    isAdmin: boolean;
    hasAccess: boolean;
}
