import { NextResponse } from "next/server";

import { getApiAuthSession } from "@/lib/server-auth";

export async function GET(): Promise<NextResponse> {
    const session = await getApiAuthSession();
    if (!session) {
        return NextResponse.json({ user: null });
    }

    return NextResponse.json({ user: session.user });
}
