import { NextResponse } from "next/server";
import { readLocalUpload } from "@/lib/uploads/local";
import { isPublicImageUploadPath } from "@/lib/uploads/public-path";

interface RouteParams {
    params: Promise<{ path: string[] }>;
}

function notFoundResponse(): NextResponse {
    return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });
}

export async function GET(
    _request: Request,
    { params }: RouteParams,
): Promise<NextResponse> {
    try {
        const { path: segments } = await params;

        // Allowlist only the exact shape saveLocalImageUpload writes. Any other
        // folder under the upload root (e.g. private attachments) stays unreachable.
        if (!segments || !isPublicImageUploadPath(segments)) {
            return notFoundResponse();
        }

        // readLocalUpload keeps the resolveUploadPath containment check as
        // defense in depth.
        const file = await readLocalUpload(segments);
        const body = new Uint8Array(file);

        return new NextResponse(body, {
            status: 200,
            headers: {
                "Content-Type": "image/webp",
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch {
        return notFoundResponse();
    }
}
