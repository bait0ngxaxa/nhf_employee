import { cache } from "react";
import { prisma } from "@/lib/db/prisma";
import type {
    EmailRequestFilters,
    EmailRequestReadAuthorization,
    PaginatedEmailRequestsResult,
    EmailRequestWithUser,
} from "./types";

/** User select config */
const EMAIL_REQUEST_USER_SELECT = {
    id: true,
    name: true,
    email: true,
} as const;

/**
 * Get paginated list of email requests
 * The resolved authorization scope selects the query breadth.
 * Cached per request for deduplication
 */
export const getEmailRequests = cache(
    async (
        filters: EmailRequestFilters,
        authorization: EmailRequestReadAuthorization,
    ): Promise<PaginatedEmailRequestsResult> => {
        const page = Math.max(1, filters.page);
        const limit = Math.min(Math.max(1, filters.limit), 100);
        const skip = (page - 1) * limit;

        const where = authorization.scopes.includes("ALL")
            ? {}
            : authorization.scopes.includes("OWN")
                ? { requestedBy: authorization.userId }
                : (() => {
                    throw new Error("Email Request read authorization has no supported scope");
                })();

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
    },
);
