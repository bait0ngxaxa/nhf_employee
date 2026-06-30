import type { SharedDriveOption } from "@/constants/email-request";

/**
 * Email Request data interface matching Prisma model
 */
export interface EmailRequest {
    id: number;
    thaiName: string;
    englishName: string;
    phone: string;
    nickname: string;
    position: string;
    department: string;
    replyEmail: string;
    needsDocumentSystem: boolean;
    sharedDriveAccess: SharedDriveOption[] | null;
    createdAt: string;
    updatedAt: string;
    requestedBy: number;
    user?: {
        id: number;
        name: string;
        email: string;
    };
}

/**
 * Email Request form data for creating new requests
 */
export interface EmailRequestFormData {
    thaiName: string;
    englishName: string;
    phone: string;
    nickname: string;
    position: string;
    department: string;
    replyEmail: string;
    needsDocumentSystem: boolean;
    sharedDriveAccess: SharedDriveOption[];
}

/**
 * API response for email request list
 */
export interface EmailRequestListResponse {
    success: boolean;
    emailRequests: EmailRequest[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}
