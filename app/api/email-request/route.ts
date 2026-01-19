import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createAuditLog } from "@/lib/audit";
import { emailRequestSchema } from "@/lib/validations/email-request";
import {
    emailRequestService,
    type EmailRequestFilters,
} from "@/lib/services/email-request";
import { buildUserContext } from "@/lib/context";

// POST - Create new email request
export async function POST(req: NextRequest): Promise<NextResponse> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: "กรุณาเข้าสู่ระบบ" },
                { status: 401 },
            );
        }

        if (session.user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    error: `ไม่มีสิทธิ์เข้าถึง (Role: ${session.user.role})`,
                },
                { status: 403 },
            );
        }

        const body = await req.json();
        const validation = emailRequestSchema.safeParse(body);

        if (!validation.success) {
            const errorMessages = validation.error.issues
                .map((issue) => issue.message)
                .join(", ");
            return NextResponse.json(
                { success: false, error: errorMessages },
                { status: 400 },
            );
        }

        const user = buildUserContext(session);
        const result = await emailRequestService.createEmailRequest(
            validation.data,
            user,
        );

        if (!result.success) {
            return NextResponse.json(
                { success: false, error: result.error },
                { status: result.status || 500 },
            );
        }

        if (!result.emailRequest) {
            throw new Error("Created email request data is missing");
        }

        // Log audit event
        await createAuditLog({
            action: "EMAIL_REQUEST",
            entityType: "EmailRequest",
            entityId: result.emailRequest.id,
            userId: user.id,
            userEmail: user.email,
            details: {
                after: {
                    thaiName: validation.data.thaiName,
                    englishName: validation.data.englishName,
                    position: validation.data.position,
                    department: validation.data.department,
                },
            },
        });

        return NextResponse.json({
            success: true,
            message: "ส่งคำขออีเมลพนักงานใหม่เรียบร้อยแล้ว",
            data: {
                id: result.emailRequest.id,
                thaiName: validation.data.thaiName,
                englishName: validation.data.englishName,
                nickname: validation.data.nickname,
                position: validation.data.position,
                department: validation.data.department,
                requestedAt: result.emailRequest.createdAt.toISOString(),
            },
        });
    } catch (error) {
        console.error("❌ Error processing email request:", error);
        return NextResponse.json(
            {
                success: false,
                error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง",
            },
            { status: 500 },
        );
    }
}

// GET - List email requests
export async function GET(req: NextRequest): Promise<NextResponse> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: "กรุณาเข้าสู่ระบบ" },
                { status: 401 },
            );
        }

        const { searchParams } = new URL(req.url);
        const filters: EmailRequestFilters = {
            page: parseInt(searchParams.get("page") || "1"),
            limit: parseInt(searchParams.get("limit") || "10"),
        };

        const user = buildUserContext(session);
        const result = await emailRequestService.getEmailRequests(
            filters,
            user,
        );

        return NextResponse.json({
            success: true,
            ...result,
        });
    } catch (error) {
        console.error("❌ Error fetching email requests:", error);
        return NextResponse.json(
            { success: false, error: "เกิดข้อผิดพลาดในการโหลดข้อมูล" },
            { status: 500 },
        );
    }
}
