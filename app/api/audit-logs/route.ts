import { type NextRequest, NextResponse } from "next/server";
import { requireApiSession } from "@/lib/auth/api";
import { operationFailed } from "@/lib/ssot/http";
import {
    assertAuditCapabilityForMigration,
    assertAuditCapabilityScope,
    buildAuditAuthorizationContext,
    AuditCapabilityDeniedError,
    getAuditLogs,
    type AuditLogFilters,
} from "@/modules/audit";

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

// GET - Retrieve audit logs through the centralized Audit capability.
export async function GET(request: NextRequest): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => operationFailed(403),
            forbiddenResponse: () => operationFailed(403),
        });
        if (!auth.ok) return auth.response;

        const authorization = await assertAuditCapabilityForMigration(
            buildAuditAuthorizationContext(auth.user),
            "audit.read",
        );
        assertAuditCapabilityScope(authorization, "ALL");

        const filters = parseQueryParams(request.url);
        const result = await getAuditLogs(filters);

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        if (error instanceof AuditCapabilityDeniedError) {
            return operationFailed(403);
        }
        console.error("Error fetching audit logs:", error);
        return operationFailed(500);
    }
}
