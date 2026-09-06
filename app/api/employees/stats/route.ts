import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { getEmployeeStats } from "@/modules/employee";
import { operationFailed } from "@/lib/ssot/http";

export async function GET(): Promise<NextResponse> {
    try {
        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const stats = await getEmployeeStats();

        return NextResponse.json({
            success: true,
            stats,
        });
    } catch (error) {
        console.error("Error fetching employee stats:", error);
        return operationFailed(500);
    }
}
