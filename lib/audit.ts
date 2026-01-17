import { prisma } from "@/lib/prisma";
import { type AuditAction } from "@prisma/client";
import { headers } from "next/headers";

/**
 * Audit log details interface
 */
export interface AuditLogDetails {
    /** Previous values before update */
    before?: Record<string, unknown>;
    /** New values after update */
    after?: Record<string, unknown>;
    /** Additional metadata */
    metadata?: Record<string, unknown>;
}

/**
 * Audit log parameters interface
 */
export interface CreateAuditLogParams {
    /** Action type from AuditAction enum */
    action: AuditAction;
    /** Entity type (e.g., "Employee", "Ticket", "User") */
    entityType: string;
    /** ID of the affected entity */
    entityId?: number;
    /** User ID who performed the action */
    userId?: number;
    /** User email for reference */
    userEmail?: string;
    /** Additional details as JSON */
    details?: AuditLogDetails;
}

/**
 * Get client IP address from request headers
 */
async function getClientIp(): Promise<string | null> {
    try {
        const headersList = await headers();
        return (
            headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            headersList.get("x-real-ip") ||
            null
        );
    } catch {
        return null;
    }
}

/**
 * Get user agent from request headers
 */
async function getUserAgent(): Promise<string | null> {
    try {
        const headersList = await headers();
        return headersList.get("user-agent") || null;
    } catch {
        return null;
    }
}

/**
 * Create an audit log entry
 *
 * @example
 * ```ts
 * await createAuditLog({
 *   action: "EMPLOYEE_CREATE",
 *   entityType: "Employee",
 *   entityId: newEmployee.id,
 *   userId: session.user.id,
 *   userEmail: session.user.email,
 *   details: { after: { firstName, lastName, email } }
 * });
 * ```
 */
export async function createAuditLog(
    params: CreateAuditLogParams
): Promise<void> {
    const { action, entityType, entityId, userId, userEmail, details } = params;

    try {
        const [ipAddress, userAgent] = await Promise.all([
            getClientIp(),
            getUserAgent(),
        ]);

        await prisma.auditLog.create({
            data: {
                action,
                entityType,
                entityId,
                userId,
                userEmail,
                ipAddress,
                userAgent,
                details: details ? JSON.stringify(details) : null,
            },
        });
    } catch (error) {
        // Log error but don't throw - audit logging should not break the main flow
        console.error("[AuditLog] Failed to create audit log:", {
            action,
            entityType,
            entityId,
            error: error instanceof Error ? error.message : "Unknown error",
        });
    }
}

/**
 * Create audit log for authentication events
 */
export async function logAuthEvent(
    action:
        | "LOGIN_SUCCESS"
        | "LOGIN_FAILED"
        | "LOGOUT"
        | "PASSWORD_CHANGE"
        | "PASSWORD_RESET",
    userId?: number,
    userEmail?: string,
    details?: AuditLogDetails
): Promise<void> {
    await createAuditLog({
        action,
        entityType: "User",
        entityId: userId,
        userId,
        userEmail,
        details,
    });
}

/**
 * Create audit log for employee management events
 */
export async function logEmployeeEvent(
    action:
        | "EMPLOYEE_CREATE"
        | "EMPLOYEE_UPDATE"
        | "EMPLOYEE_DELETE"
        | "EMPLOYEE_STATUS_CHANGE"
        | "EMPLOYEE_IMPORT",
    entityId: number,
    userId: number,
    userEmail: string,
    details?: AuditLogDetails
): Promise<void> {
    await createAuditLog({
        action,
        entityType: "Employee",
        entityId,
        userId,
        userEmail,
        details,
    });
}

/**
 * Create audit log for ticket management events
 */
export async function logTicketEvent(
    action:
        | "TICKET_CREATE"
        | "TICKET_UPDATE"
        | "TICKET_STATUS_CHANGE"
        | "TICKET_ASSIGN"
        | "TICKET_COMMENT",
    entityId: number,
    userId: number,
    userEmail: string,
    details?: AuditLogDetails
): Promise<void> {
    await createAuditLog({
        action,
        entityType: "Ticket",
        entityId,
        userId,
        userEmail,
        details,
    });
}

/**
 * Create audit log for data export events
 */
export async function logDataExport(
    userId: number,
    userEmail: string,
    details?: AuditLogDetails
): Promise<void> {
    await createAuditLog({
        action: "DATA_EXPORT",
        entityType: "Employee",
        userId,
        userEmail,
        details,
    });
}
