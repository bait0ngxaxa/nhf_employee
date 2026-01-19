import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
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
    const userId = searchParams.get("userId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    return {
        action: action || undefined,
        entityType: entityType || undefined,
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
        const session = await getServerSession(authOptions);

        if (!session || session.user?.role !== "ADMIN") {
            return NextResponse.json(
                { error: "ไม่มีสิทธิ์เข้าถึง" },
                { status: 403 },
            );
        }

        const filters = parseQueryParams(request.url);
        const result = await auditLogService.getAuditLogs(filters);

        return NextResponse.json(result, { status: 200 });
    } catch (error) {
        console.error("Error fetching audit logs:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการดึงข้อมูล" },
            { status: 500 },
        );
    }
}
