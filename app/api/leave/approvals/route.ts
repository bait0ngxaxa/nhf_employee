import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.id) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const userId = Number(session.user.id);
        if (isNaN(userId)) {
            return NextResponse.json({ error: "Invalid user ID" }, { status: 400 });
        }

        const managerId = await getEmployeeIdFromUserId(userId);
        if (!managerId) {
            return NextResponse.json({ error: "ไม่พบข้อมูลพนักงานที่เชื่อมกับบัญชีนี้" }, { status: 404 });
        }
        // Find leaves where the employee's direct manager is this user, OR this user is specifically the assigned approver
        // Since we save approverId directly in LeaveRequest, we just look for that.
        const pendingApprovals = await prisma.leaveRequest.findMany({
            where: {
                approverId: managerId,
                status: "PENDING"
            },
            take: 50,
            orderBy: {
                createdAt: 'asc' // Oldest pending first
            },
            include: {
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                        nickname: true,
                        position: true,
                        departmentId: true,
                        dept: {
                            select: {
                                name: true
                            }
                        }
                    }
                }
            }
        });

        // Also fetch history of leaves this manager previously approved/rejected
        const approvalHistory = await prisma.leaveRequest.findMany({
            where: {
                approverId: managerId,
                status: {
                    in: ["APPROVED", "REJECTED"]
                }
            },
            orderBy: {
                updatedAt: 'desc'
            },
            take: 20, // Limit history to last 20
            include: {
                employee: {
                    select: {
                        firstName: true,
                        lastName: true,
                        nickname: true,
                        position: true
                    }
                }
            }
        });

        return NextResponse.json({
            pending: pendingApprovals,
            history: approvalHistory
        });
    } catch (error) {
        console.error("Error fetching leave approvals:", error);
        return NextResponse.json(
            { error: "Failed to fetch approvals" },
            { status: 500 }
        );
    }
}
