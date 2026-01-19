/** Select fields for user with employee info (for reportedBy) */
export const USER_WITH_EMPLOYEE_SELECT = {
    id: true,
    name: true,
    email: true,
    employee: {
        select: {
            firstName: true,
            lastName: true,
            dept: {
                select: {
                    name: true,
                },
            },
        },
    },
} as const;

/** Select fields for assignedTo user (without dept) */
export const ASSIGNED_USER_SELECT = {
    id: true,
    name: true,
    email: true,
    employee: {
        select: {
            firstName: true,
            lastName: true,
        },
    },
} as const;

/** Select fields for comment author */
export const COMMENT_AUTHOR_SELECT = {
    id: true,
    name: true,
    email: true,
    role: true,
    employee: {
        select: {
            firstName: true,
            lastName: true,
        },
    },
} as const;

/**
 * Include config for ticket list view
 * @param userId - Current user ID for filtering views
 */
export const getTicketListInclude = (userId: number) => ({
    reportedBy: {
        select: USER_WITH_EMPLOYEE_SELECT,
    },
    assignedTo: {
        select: ASSIGNED_USER_SELECT,
    },
    _count: {
        select: {
            comments: true,
        },
    },
    views: {
        where: {
            userId,
        },
        select: {
            viewedAt: true,
        },
    },
});

/** Include config for single ticket with comments */
export const TICKET_DETAIL_INCLUDE = {
    reportedBy: {
        select: USER_WITH_EMPLOYEE_SELECT,
    },
    assignedTo: {
        select: ASSIGNED_USER_SELECT,
    },
    comments: {
        include: {
            author: {
                select: COMMENT_AUTHOR_SELECT,
            },
        },
        orderBy: {
            createdAt: "asc" as const,
        },
    },
};

/** Include config for ticket after create/update */
export const TICKET_WITH_USERS_INCLUDE = {
    reportedBy: {
        select: USER_WITH_EMPLOYEE_SELECT,
    },
    assignedTo: {
        select: ASSIGNED_USER_SELECT,
    },
};

/** Default pagination values */
export const PAGINATION_DEFAULTS = {
    page: 1,
    limit: 10,
    maxLimit: 100,
} as const;
