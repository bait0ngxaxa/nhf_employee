export const EMPLOYEE_IMPORT_MAX_ROWS = 1000;
export const EMPLOYEE_EXPORT_MAX_ROWS = 2000;
export const EMPLOYEE_EXPORT_BATCH_SIZE = 250;

export const EMPLOYEE_PAGINATION_DEFAULTS = {
    page: 1,
    limit: 10,
    maxLimit: 100,
} as const;

export const EMPLOYEE_DEPARTMENT_CODE_MAP: Readonly<Record<string, string>> = {
    ADMIN: "ADMIN",
    บริหาร: "ADMIN",
    ACADEMIC: "ACADEMIC",
    วิชาการ: "ACADEMIC",
};
