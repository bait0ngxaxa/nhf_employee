import { type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { operationFailed } from "@/lib/ssot/http";
import { isAdminRole } from "@/lib/ssot/permissions";
import {
    auditLogService,
    type AuditLogFilters,
} from "@/lib/services/audit-log";

/**
 * Parse query parameters into AuditLogFilters
 */
function parseQueryParams(url: string): AuditLogFilters {
    const { searchParams } = new URL(url);

    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");
    const search = searchParams.get("search");
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    return {
        action: action || undefined,
        entityType: entityType || undefined,
        search: search?.trim() ? search.trim() : undefined,
        userId: userId ? parseInt(userId) : undefined,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        page: parseInt(searchParams.get("page") || "1"),
        limit: parseInt(searchParams.get("limit") || "20"),
    };
}

// GET - Retrieve audit logs (Admin only)
export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();

        if (!session || !isAdminRole(session.user?.role)) {
            return operationFailed(403);
        }

        const filters = parseQueryParams(request.url);
        const result = await auditLogService.getAuditLogs(filters);

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error("Error fetching audit logs:", error);
        return operationFailed(500);
    }
}
