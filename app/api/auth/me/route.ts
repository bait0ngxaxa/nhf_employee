import { NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth/ssot";
import { getCurrentUserProjection } from "@/app/_lib/auth/current-user";

export async function GET(): Promise<NextResponse> {
    const user = await getCurrentUserProjection();
    if (!user) {
        return NextResponse.json({ error: AUTH_ERROR_MESSAGES.unauthorized }, { status: 401 });
    }

    return NextResponse.json({ user });
}
