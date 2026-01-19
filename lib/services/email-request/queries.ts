import { prisma } from "@/lib/prisma";
import type {
    EmailRequestFilters,
    PaginatedEmailRequestsResult,
    EmailRequestWithUser,
    UserContext,
} from "./types";

/** User select config */
const EMAIL_REQUEST_USER_SELECT = {
    id: true,
    name: true,
    email: true,
} as const;

/**
 * Get paginated list of email requests
 * Admin sees all, users see only their own
 */
export async function getEmailRequests(
    filters: EmailRequestFilters,
    user: UserContext,
): Promise<PaginatedEmailRequestsResult> {
    const page = Math.max(1, filters.page);
    const limit = Math.min(Math.max(1, filters.limit), 100);
    const skip = (page - 1) * limit;

    const isAdmin = user.role === "ADMIN";
    const where = isAdmin ? {} : { requestedBy: user.id };

    const [total, emailRequests] = await Promise.all([
        prisma.emailRequest.count({ where }),
        prisma.emailRequest.findMany({
            where,
            include: {
                user: {
                    select: EMAIL_REQUEST_USER_SELECT,
                },
            },
            orderBy: {
                createdAt: "desc",
            },
            skip,
            take: limit,
        }),
    ]);

    return {
        emailRequests: emailRequests as EmailRequestWithUser[],
        pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
        },
    };
}
