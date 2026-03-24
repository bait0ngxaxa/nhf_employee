import { after, type NextRequest, NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { logDataExport } from "@/lib/audit";

export async function POST(request: NextRequest) {
    try {
        const session = await getApiAuthSession();

        if (!session) {
            return NextResponse.json(
                { error: "Operation failed" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { entityType, recordCount, filters } = body;

        after(async () => {
            await logDataExport(
                parseInt(session.user.id),
                session.user.email || "",
                {
                    metadata: {
                        entityType,
                        recordCount,
                        filters,
                        exportedAt: new Date().toISOString(),
                    },
                }
            );
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error logging data export:", error);
        return NextResponse.json(
            { error: "Operation failed" },
            { status: 500 }
        );
    }
}

