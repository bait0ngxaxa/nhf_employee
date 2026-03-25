import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getApiAuthSession } from "@/lib/server-auth";
import { operationFailed } from "@/lib/ssot/http";

export async function GET(): Promise<NextResponse> {
    try {
        const session = await getApiAuthSession();
        if (!session) {
            return operationFailed(403);
        }

        const departments = await prisma.department.findMany({
            orderBy: { name: "asc" },
        });

        return NextResponse.json({ departments }, { status: 200 });
    } catch (error) {
        console.error("Error fetching departments:", error);
        return operationFailed(500);
    }
}
