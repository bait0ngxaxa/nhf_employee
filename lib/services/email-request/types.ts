import type { EmailRequest } from "@prisma/client";

// ==================== Input Types ====================

/** Data for creating a new email request */
export interface CreateEmailRequestData {
    thaiName: string;
    englishName: string;
    phone: string;
    nickname?: string;
    position: string;
    department: string;
    replyEmail: string;
}

/** Filters for querying email requests */
export interface EmailRequestFilters {
    page: number;
    limit: number;
}

/** User context for authorization checks */
export interface UserContext {
    id: number;
    role: string;
    email: string;
}

// ==================== Relation Types ====================

/** User info for email request */
export interface EmailRequestUserInfo {
    id: number;
    name: string;
    email: string;
}

/** Email request with user relation */
export interface EmailRequestWithUser extends EmailRequest {
    user: EmailRequestUserInfo;
}

// ==================== Output Types ====================

/** Paginated email requests response */
export interface PaginatedEmailRequestsResult {
    emailRequests: EmailRequestWithUser[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

/** Result of create operation */
export interface CreateEmailRequestResult {
    success: boolean;
    emailRequest?: EmailRequest;
    error?: string;
    status?: number;
}
