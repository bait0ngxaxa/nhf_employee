import { type NextRequest, NextResponse } from "next/server";
import { verifyLineSignature } from "@/lib/line/verify-signature";

// Collect all configured channel secrets for signature verification
function getChannelSecrets(): readonly string[] {
    const secrets: string[] = [];

    const itSecret = process.env.LINE_IT_CHANNEL_SECRET;
    if (itSecret) secrets.push(itSecret);

    const stockSecret = process.env.LINE_STOCK_CHANNEL_SECRET;
    if (stockSecret) secrets.push(stockSecret);

    return secrets;
}

// LINE Webhook handler for receiving events
export async function POST(request: NextRequest): Promise<NextResponse> {
    const signature = request.headers.get("x-line-signature");

    if (!signature) {
        return NextResponse.json(
            { error: "Missing x-line-signature header" },
            { status: 401 }
        );
    }

    const channelSecrets = getChannelSecrets();

    if (channelSecrets.length === 0) {
        console.error(
            "❌ [LINE WEBHOOK] No LINE_IT_CHANNEL_SECRET or LINE_STOCK_CHANNEL_SECRET configured"
        );
        return NextResponse.json(
            { error: "Server misconfigured" },
            { status: 500 }
        );
    }

    // Must use raw text body for HMAC verification (not parsed JSON)
    const rawBody = await request.text();

    if (!verifyLineSignature(rawBody, signature, channelSecrets)) {
        console.warn("⚠️ [LINE WEBHOOK] Invalid signature rejected");
        return NextResponse.json(
            { error: "Invalid signature" },
            { status: 401 }
        );
    }

    try {
        const body = JSON.parse(rawBody) as {
            events?: Array<{ source?: { userId?: string } }>;
        };

        if (body.events && Array.isArray(body.events)) {
            for (const event of body.events) {
                if (event.source?.userId) {
                    // User ID found - should be added to environment variables
                }
            }
        }

        return NextResponse.json({ status: "ok" });
    } catch (error) {
        console.error("❌ [LINE WEBHOOK] Error processing webhook:", error);
        return NextResponse.json(
            { error: "Webhook processing failed" },
            { status: 500 }
        );
    }
}