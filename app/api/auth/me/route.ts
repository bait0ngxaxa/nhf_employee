import { NextResponse } from "next/server";

import { AUTH_ERROR_MESSAGES } from "@/lib/auth-ssot";
import { getApiAuthSession } from "@/lib/server-auth";

export async function GET(): Promise<NextResponse> {
    const session = await getApiAuthSession();
    if (!session) {
        return NextResponse.json(
            { error: AUTH_ERROR_MESSAGES.unauthorized },
            { status: 401 },
        );
    }

    return NextResponse.json({ user: session.user });
}
