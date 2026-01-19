/** Select fields for user associated with employee */
export const EMPLOYEE_USER_SELECT = {
    id: true,
    email: true,
    role: true,
} as const;

/** Include config for employee with relations */
export const EMPLOYEE_WITH_RELATIONS_INCLUDE = {
    dept: true,
    user: {
        select: EMPLOYEE_USER_SELECT,
    },
} as const;

/** Default pagination values */
export const PAGINATION_DEFAULTS = {
    page: 1,
    limit: 10,
    maxLimit: 100,
} as const;

/** Department code mappings for CSV import */
export const DEPARTMENT_CODE_MAP: Record<string, string> = {
    ADMIN: "ADMIN",
    บริหาร: "ADMIN",
    ACADEMIC: "ACADEMIC",
    วิชาการ: "ACADEMIC",
} as const;
