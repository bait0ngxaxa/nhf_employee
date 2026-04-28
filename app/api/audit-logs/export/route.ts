import { after, type NextRequest, NextResponse } from "next/server";

import { logDataExport } from "@/lib/audit";
import { getApiAuthSession } from "@/lib/server-auth";
import { forbidden, operationFailed } from "@/lib/ssot/http";

export async function POST(request: NextRequest) {
    try {
        const session = await getApiAuthSession();

        if (!session) {
            return forbidden();
        }

        const body = await request.json();
        const { entityType, recordCount, filters } = body;

        after(async () => {
            await logDataExport(
                entityType,
                parseInt(session.user.id, 10),
                session.user.email || "",
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
