import { after, type NextRequest, NextResponse } from "next/server";

import { requireApiSession } from "@/lib/api-auth";
import { logDataExport } from "@/lib/audit";
import { forbidden, operationFailed } from "@/lib/ssot/http";

export async function POST(request: NextRequest) {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => forbidden(),
        });
        if (!auth.ok) return auth.response;

        const body = await request.json();
        const { entityType, recordCount, filters } = body;

        after(async () => {
            await logDataExport(
                entityType,
                parseInt(auth.session.user.id, 10),
                auth.user.email,
                {
                metadata: {
                    entityType,
                    recordCount,
                    filters,
                    exportedAt: new Date().toISOString(),
                },
                },
            );
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error logging data export:", error);
        return operationFailed(500);
    }
}
