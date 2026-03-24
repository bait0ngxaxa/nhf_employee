import { NextResponse } from "next/server";
import { getApiAuthSession } from "@/lib/server-auth";
import { prisma } from "@/lib/prisma";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { logLeaveEvent } from "@/lib/audit";

export async function POST(req: Request) {
    try {
        const session = await getApiAuthSession();
        if (!session?.user?.id) {
            return NextResponse.json(
                { error: "Unauthorized" },
                { status: 401 }
            );
        }

        const userId = Number(session.user.id);
        const employeeId = await getEmployeeIdFromUserId(userId);

        if (!employeeId) {
            return NextResponse.json(
                { error: "Employee profile not found" },
                { status: 404 }
            );
        }

        const { leaveId } = await req.json();

        if (!leaveId) {
            return NextResponse.json(
                { error: "Leave ID is required" },
                { status: 400 }
            );
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Find the leave request
            const leaveRequest = await tx.leaveRequest.findUnique({
                where: { id: leaveId }
            });

            if (!leaveRequest) {
                throw new Error("Operation failed");
            }

            if (leaveRequest.employeeId !== employeeId) {
                throw new Error("Operation failed");
            }

            if (leaveRequest.status !== "PENDING") {
                throw new Error("Operation failed");
            }

            // 2. Mark the leave as CANCELLED
            const updatedRequest = await tx.leaveRequest.update({
                where: { id: leaveId },
                data: {
                    status: "CANCELLED"
                }
            });

            return updatedRequest;
        });

        // Audit Logging
        await logLeaveEvent(
            "LEAVE_REQUEST_CANCEL",
            leaveId,
            userId,
            session.user.email || "",
            {
                after: { status: "CANCELLED" }
            }
        ).catch(err => console.error("Failed to log leave cancel:", err));

        return NextResponse.json({ success: true, data: result });
    } catch (error) {
        console.error("Cancel leave error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Internal Error" },
            { status: 500 }
        );
    }
}

