import path from "node:path";
import { NextResponse } from "next/server";
import { readLocalUpload } from "@/lib/uploads/local";

interface RouteParams {
    params: Promise<{ path: string[] }>;
}

function getContentType(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();

    switch (extension) {
        case ".webp":
            return "image/webp";
        case ".png":
            return "image/png";
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        default:
            return "application/octet-stream";
    }
}

export async function GET(
    _request: Request,
    { params }: RouteParams,
): Promise<NextResponse> {
    try {
        const { path: segments } = await params;

        if (!segments || segments.length === 0) {
            return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });
        }

        const file = await readLocalUpload(segments);
        const contentType = getContentType(segments[segments.length - 1] ?? "");

        const body = new Uint8Array(file);

        return new NextResponse(body, {
            status: 200,
            headers: {
                "Content-Type": contentType,
                "Cache-Control": "public, max-age=31536000, immutable",
            },
        });
    } catch {
        return NextResponse.json({ error: "ไม่พบไฟล์" }, { status: 404 });
    }
}
