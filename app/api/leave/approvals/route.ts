import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

import { requireApiSession } from "@/lib/auth/api";
import { prisma } from "@/lib/db/prisma";
import { getEmployeeIdFromUserId } from "@/lib/services/leave/get-employee-id";
import { notFound, operationFailed } from "@/lib/ssot/http";
import { FEATURE_KEYS, isFeatureEnabled } from "@/lib/ssot/features";
import { COMMON_API_MESSAGES } from "@/lib/ssot/messages";

const APPROVALS_PAGE_SIZE = 10;
const APPROVALS_PAGINATION_MESSAGES = {
    invalidPage: "หมายเลขหน้าต้องเป็นจำนวนเต็มที่มากกว่าหรือเท่ากับ 1",
} as const;

type ApprovalPageKey = "pendingPage" | "notTakenPage" | "historyPage";

const parsePage = (url: URL, key: ApprovalPageKey): number | null => {
    const page = Number.parseInt(url.searchParams.get(key) || "1", 10);
    return Number.isInteger(page) && page > 0 ? page : null;
};

const createMetadata = (page: number, totalItems: number) => ({
    currentPage: page,
    totalPages: Math.ceil(totalItems / APPROVALS_PAGE_SIZE),
    totalItems,
    itemsPerPage: APPROVALS_PAGE_SIZE,
});

export async function GET(req: Request): Promise<NextResponse> {
    try {
        if (!isFeatureEnabled(FEATURE_KEYS.leave)) {
            return notFound();
        }

        const auth = await requireApiSession();
        if (!auth.ok) return auth.response;

        const userId = Number(auth.session.user.id);
        if (isNaN(userId)) {
            return NextResponse.json({ error: COMMON_API_MESSAGES.invalidUserId }, { status: 400 });
        }

        const managerId = await getEmployeeIdFromUserId(userId);
        if (!managerId) {
            return operationFailed(404);
        }

        const employeeInclude = {
            employee: {
                select: {
                    firstName: true,
                    lastName: true,
                    nickname: true,
                    position: true,
                    departmentId: true,
                    dept: {
                        select: {
                            name: true,
                        },
                    },
                },
            },
        } as const;

        const url = new URL(req.url);
        const pendingPage = parsePage(url, "pendingPage");
        const notTakenPage = parsePage(url, "notTakenPage");
        const historyPage = parsePage(url, "historyPage");
        if (!pendingPage || !notTakenPage || !historyPage) {
            return NextResponse.json(
                { error: APPROVALS_PAGINATION_MESSAGES.invalidPage },
                { status: 400 },
            );
        }

        const pendingWhere: Prisma.LeaveRequestWhereInput = {
            approverId: managerId,
            status: "PENDING",
        };
        const notTakenWhere: Prisma.LeaveRequestWhereInput = {
            approverId: managerId,
            status: "APPROVED",
            notTakenRequestedAt: { not: null },
            notTakenConfirmedAt: null,
        };
        const historyWhere: Prisma.LeaveRequestWhereInput = {
            approverId: managerId,
            OR: [
                { status: { in: ["REJECTED", "NOT_TAKEN"] } },
                {
                    status: "APPROVED",
                    OR: [
                        { notTakenRequestedAt: null },
                        { notTakenConfirmedAt: { not: null } },
                    ],
                },
            ],
        };

        const [
            pendingApprovals,
            pendingCount,
            notTakenPending,
            notTakenCount,
            approvalHistory,
            historyCount,
        ] = await Promise.all([
            prisma.leaveRequest.findMany({
                where: pendingWhere,
                skip: (pendingPage - 1) * APPROVALS_PAGE_SIZE,
                take: APPROVALS_PAGE_SIZE,
                orderBy: {
                    createdAt: "asc",
                },
                include: employeeInclude,
            }),
            prisma.leaveRequest.count({ where: pendingWhere }),
            prisma.leaveRequest.findMany({
                where: notTakenWhere,
                skip: (notTakenPage - 1) * APPROVALS_PAGE_SIZE,
                take: APPROVALS_PAGE_SIZE,
                orderBy: {
                    notTakenRequestedAt: "asc",
                },
                include: employeeInclude,
            }),
            prisma.leaveRequest.count({ where: notTakenWhere }),
            prisma.leaveRequest.findMany({
                where: historyWhere,
                skip: (historyPage - 1) * APPROVALS_PAGE_SIZE,
                take: APPROVALS_PAGE_SIZE,
                orderBy: {
                    updatedAt: "desc",
                },
                include: employeeInclude,
            }),
            prisma.leaveRequest.count({ where: historyWhere }),
        ]);

        return NextResponse.json({
            pending: pendingApprovals,
            notTakenPending,
            history: approvalHistory,
            metadata: {
                pending: createMetadata(pendingPage, pendingCount),
                notTakenPending: createMetadata(notTakenPage, notTakenCount),
                history: createMetadata(historyPage, historyCount),
            },
        });
    } catch (error) {
        console.error("Error fetching leave approvals:", error);
        return NextResponse.json(
            { error: COMMON_API_MESSAGES.failedToFetchApprovals },
            { status: 500 },
        );
    }
}
