import { type NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { lineNotificationService } from "@/lib/line";
import { type EmailRequestData } from "@/types/api";
import { createAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { emailRequestSchema } from "@/lib/validations/email-request";

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: "กรุณาเข้าสู่ระบบ" },
                { status: 401 }
            );
        }

        // Admin check
        const adminRoles = ["ADMIN"];
        if (!adminRoles.includes(session.user.role)) {
            return NextResponse.json(
                {
                    success: false,
                    error: `ไม่มีสิทธิ์เข้าถึง (Role: ${session.user.role})`,
                },
                { status: 403 }
            );
        }

        // Parse and validate request body
        const body = await req.json();
        const validation = emailRequestSchema.safeParse(body);

        if (!validation.success) {
            const errorMessages = validation.error.issues
                .map((issue) => issue.message)
                .join(", ");
            return NextResponse.json(
                { success: false, error: errorMessages },
                { status: 400 }
            );
        }

        const validatedData = validation.data;

        // Save to database
        const emailRequest = await prisma.emailRequest.create({
            data: {
                thaiName: validatedData.thaiName,
                englishName: validatedData.englishName,
                phone: validatedData.phone,
                nickname: validatedData.nickname,
                position: validatedData.position,
                department: validatedData.department,
                replyEmail: validatedData.replyEmail,
                requestedBy: parseInt(session.user.id),
            },
        });

        // Prepare data for LINE notification
        const emailRequestData: EmailRequestData = {
            thaiName: validatedData.thaiName,
            englishName: validatedData.englishName,
            phone: validatedData.phone,
            nickname: validatedData.nickname,
            position: validatedData.position,
            department: validatedData.department,
            replyEmail: validatedData.replyEmail,
            requestedAt: new Date().toISOString(),
        };

        // Send LINE notification (non-blocking)
        lineNotificationService
            .sendEmailRequestNotification(emailRequestData)
            .catch((error) => {
                console.error("LINE notification failed:", error);
            });

        // Log audit event
        await createAuditLog({
            action: "EMAIL_REQUEST",
            entityType: "EmailRequest",
            entityId: emailRequest.id,
            userId: parseInt(session.user.id),
            userEmail: session.user.email || "",
            details: {
                after: {
                    thaiName: validatedData.thaiName,
                    englishName: validatedData.englishName,
                    position: validatedData.position,
                    department: validatedData.department,
                },
            },
        });

        return NextResponse.json({
            success: true,
            message: "ส่งคำขออีเมลพนักงานใหม่เรียบร้อยแล้ว",
            data: {
                id: emailRequest.id,
                thaiName: validatedData.thaiName,
                englishName: validatedData.englishName,
                nickname: validatedData.nickname,
                position: validatedData.position,
                department: validatedData.department,
                requestedAt: emailRequest.createdAt.toISOString(),
            },
        });
    } catch (error) {
        console.error("❌ Error processing email request:", error);
        return NextResponse.json(
            {
                success: false,
                error: "เกิดข้อผิดพลาดในระบบ กรุณาลองใหม่อีกครั้ง",
            },
            { status: 500 }
        );
    }
}

export async function GET(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: "กรุณาเข้าสู่ระบบ" },
                { status: 401 }
            );
        }

        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "10");

        const isAdmin = session.user.role === "ADMIN";

        // Build where clause - non-admin users can only see their own requests
        const where = isAdmin ? {} : { requestedBy: parseInt(session.user.id) };

        // Get total count
        const total = await prisma.emailRequest.count({ where });

        // Get email requests with pagination
        const emailRequests = await prisma.emailRequest.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                    },
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            skip: (page - 1) * limit,
            take: limit,
        });

        return NextResponse.json({
            success: true,
            emailRequests,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error("❌ Error fetching email requests:", error);
        return NextResponse.json(
            {
                success: false,
                error: "เกิดข้อผิดพลาดในการโหลดข้อมูล",
            },
            { status: 500 }
        );
    }
}
