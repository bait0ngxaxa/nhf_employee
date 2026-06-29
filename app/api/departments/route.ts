import { NextResponse } from "next/server";

import { requireApiSession } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { operationFailed } from "@/lib/ssot/http";

export async function GET(): Promise<NextResponse> {
    try {
        const auth = await requireApiSession({
            unauthorizedResponse: () => operationFailed(403),
        });
        if (!auth.ok) return auth.response;

        const departments = await prisma.department.findMany({
            orderBy: { name: "asc" },
        });

        return NextResponse.json({ departments }, { status: 200 });
    } catch (error) {
        console.error("Error fetching departments:", error);
        return operationFailed(500);
    }
}
