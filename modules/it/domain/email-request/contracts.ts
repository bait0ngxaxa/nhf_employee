import type { AccessDecision } from "./access-requirements";
import type { SharedDriveOption } from "./constants";
import type { EmailRequestInput } from "./validation";

export interface EmailRequestPresentationCapabilities {
    readonly canReadRequests: boolean;
    readonly canCreateRequests: boolean;
    readonly canUpdateOwnRequests: boolean;
    readonly canUpdateAllRequests: boolean;
}

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
    /** Temporary compatibility mirror. */
    needsDocumentSystem: boolean;
    documentSystemDecision: AccessDecision;
    sharedDriveDecision: AccessDecision;
    accessVersion: number;
    canUpdateAccessRequirements: boolean;
    sharedDriveAccess: SharedDriveOption[];
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
export type EmailRequestFormData = EmailRequestInput;

/**
 * API response for email request list
 */
export interface EmailRequestListResponse {
    success: boolean;
    capabilities: EmailRequestPresentationCapabilities;
    emailRequests: EmailRequest[];
    pagination: Pagination;
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

/** Durable payload contract for EMAIL_REQUEST outbox rows. */
export interface EmailRequestData {
    /** Added to new parent facts; absent on historical EMAIL_REQUEST rows. */
    emailRequestId?: number;
    thaiName: string;
    englishName: string;
    phone: string;
    nickname: string;
    position: string;
    department: string;
    replyEmail: string;
    needsDocumentSystem: boolean;
    sharedDriveAccess: SharedDriveOption[];
    requestedAt: string;
}

export interface EmailRequestAccessUpdatedData {
    readonly version: 1;
    readonly emailRequestId: number;
    readonly accessVersion: number;
}

/** Per-recipient transport child payload; the request details stay in the parent fact. */
export interface EmailRequestChannelOutboxPayloadV1 {
    readonly version: 1;
    readonly emailRequestId: number | null;
    readonly accessVersion?: number;
    readonly parentOutboxId: number;
    readonly recipientUserId: number;
}
