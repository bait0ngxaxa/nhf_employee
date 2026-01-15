import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { logDataExport } from "@/lib/audit";

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json(
                { error: "ไม่มีสิทธิ์เข้าถึง" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { entityType, recordCount, filters } = body;

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

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error logging data export:", error);
        return NextResponse.json(
            { error: "เกิดข้อผิดพลาดในการบันทึก" },
            { status: 500 }
        );
    }
}
