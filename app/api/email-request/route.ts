import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { lineNotificationService } from "@/lib/line";
import { EmailRequestData } from "@/types/api";

interface EmailRequestBody {
    thaiName: string;
    englishName: string;
    phone: string;
    nickname: string;
    position: string;
    department: string;
    replyEmail: string;
}

export async function POST(req: NextRequest) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return NextResponse.json(
                { success: false, error: "กรุณาเข้าสู่ระบบ" },
                { status: 401 }
            );
        }

        // Admin check - Update this check according to your authentication system
        // Common role values: 'ADMIN', 'USER', 'IT_ADMIN', etc.
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

        // Parse request body
        const body: EmailRequestBody = await req.json();

        // Validate required fields
        const requiredFields = [
            "thaiName",
            "englishName",
            "phone",
            "nickname",
            "position",
            "department",
            "replyEmail",
        ];
        const missingFields = requiredFields.filter(
            (field) => !body[field as keyof EmailRequestBody]
        );

        if (missingFields.length > 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: `กรุณากรอกข้อมูลให้ครบถ้วน: ${missingFields.join(
                        ", "
                    )}`,
                },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(body.replyEmail)) {
            return NextResponse.json(
                { success: false, error: "รูปแบบอีเมลไม่ถูกต้อง" },
                { status: 400 }
            );
        }

        // Validate phone number (basic validation for Thai phone numbers)
        const phoneRegex = /^[0-9\-\s\+\(\)]{10,15}$/;
        if (!phoneRegex.test(body.phone)) {
            return NextResponse.json(
                { success: false, error: "รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง" },
                { status: 400 }
            );
        }

        // Prepare data for LINE notification
        const emailRequestData: EmailRequestData = {
            thaiName: body.thaiName,
            englishName: body.englishName,
            phone: body.phone,
            nickname: body.nickname,
            position: body.position,
            department: body.department,
            replyEmail: body.replyEmail,
            requestedAt: new Date().toISOString(),
        };

        const lineResult =
            await lineNotificationService.sendEmailRequestNotification(
                emailRequestData
            );

        if (lineResult) {
            return NextResponse.json({
                success: true,
                message: "ส่งคำขออีเมลพนักงานใหม่เรียบร้อยแล้ว",
                data: {
                    thaiName: body.thaiName,
                    englishName: body.englishName,
                    nickname: body.nickname,
                    position: body.position,
                    department: body.department,
                    requestedAt: emailRequestData.requestedAt,
                },
            });
        } else {
            return NextResponse.json(
                {
                    success: false,
                    error: "ไม่สามารถส่งแจ้งเตือนได้ กรุณาลองใหม่อีกครั้ง",
                },
                { status: 500 }
            );
        }
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

export async function GET() {
    return NextResponse.json({
        message: "Email Request API is working",
        timestamp: new Date().toISOString(),
    });
}
