export const APP_ROUTES = {
    home: "/",
    login: "/login",
    signup: "/signup",
    refreshSession: "/auth/refresh",
    dashboard: "/dashboard",
    accessDenied: "/access-denied",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
    line: {
        root: "/liff",
        stock: "/liff/stock",
        leave: "/liff/leave",
        routine: "/liff/routine",
    },
} as const;

export function isLiffAppPath(pathname: string | null | undefined): boolean {
    return pathname === APP_ROUTES.line.root
        || Boolean(pathname?.startsWith(`${APP_ROUTES.line.root}/`));
}

export const APP_DASHBOARD_TABS = {
    dashboard: "dashboard",
    notifications: "notifications",
    sessions: "sessions",
    leaveManagement: "leave-management",
    leaveHistory: "leave-history",
    managerApproval: "manager-approval",
    stock: "stock",
    routine: "routine",
} as const;

export function toDashboardTabPath(tab: string): string {
    return `${APP_ROUTES.dashboard}?tab=${tab}`;
}

export const STOCK_DASHBOARD_TABS = {
    browse: "browse",
    myRequests: "my-requests",
    adminRequests: "admin-requests",
    inventory: "inventory",
    reports: "reports",
} as const;

export type StockDashboardTab =
    (typeof STOCK_DASHBOARD_TABS)[keyof typeof STOCK_DASHBOARD_TABS];

export function toDashboardStockTabPath(
    stockTab: StockDashboardTab,
): string {
    return `${toDashboardTabPath(APP_DASHBOARD_TABS.stock)}&stockTab=${stockTab}`;
}

export const API_ROUTES = {
    auth: {
        forgotPassword: "/api/auth/forgot-password",
        hybridLogin: "/api/auth/hybrid-login",
        resetPassword: "/api/auth/reset-password",
        signup: "/api/auth/signup",
        refresh: "/api/auth/refresh",
        logout: "/api/auth/logout",
        logoutAll: "/api/auth/logout-all",
        me: "/api/auth/me",
        sessions: "/api/auth/sessions",
        revokeSession: "/api/auth/sessions/revoke",
        cleanup: "/api/auth/cleanup",
    },
    employees: {
        list: "/api/employees",
        export: "/api/employees/export",
        stats: "/api/employees/stats",
        import: "/api/employees/import",
        departments: "/api/departments",
        byId: (id: number | string): string => `/api/employees/${id}`,
    },
    notifications: {
        list: "/api/notifications",
        all: "/api/notifications/all",
        markAllRead: "/api/notifications/mark-all-read",
        read: (id: string): string => `/api/notifications/${id}/read`,
    },
    cron: {
        routineScheduler: "/api/cron/routine-scheduler",
    },
    leave: {
        me: "/api/leave/me",
        approvals: "/api/leave/approvals",
        adminRecovery: "/api/leave/admin/recovery",
        cancel: "/api/leave/cancel",
        request: "/api/leave/request",
        notTaken: "/api/leave/not-taken",
        approvers: "/api/leave/approvers",
        decision: "/api/leave/decision",
        export: "/api/leave/export",
        attachmentById: (id: string): string =>
            `/api/leave/attachments/${id}`,
    },
    auditLogs: {
        cleanup: "/api/audit-logs/cleanup",
        export: "/api/audit-logs/export",
    },
    uploads: {
        image: "/api/uploads/image",
    },
    emailRequest: {
        list: "/api/email-request",
    },
    line: {
        accountLink: "/api/line/account-link",
        liffSession: "/api/line/liff/session",
        home: "/api/line/home",
        leaveMe: "/api/line/leave/me",
        leaveRequest: "/api/line/leave/request",
        leaveApprovals: "/api/line/leave/approvals",
        leaveCancel: "/api/line/leave/cancel",
        leaveNotTaken: "/api/line/leave/not-taken",
        leaveDecision: "/api/line/leave/decision",
        leaveRequestById: (id: string): string =>
            `/api/line/leave/requests/${id}`,
        leaveAttachmentById: (id: string): string =>
            `/api/line/leave/attachments/${id}`,
        routineTasks: "/api/line/routine/tasks",
        routineSummary: "/api/line/routine/summary",
    },
    stock: {
        categories: "/api/stock/categories",
        items: "/api/stock/items",
        reportsExport: "/api/stock/reports/export",
        itemById: (id: number | string): string => `/api/stock/items/${id}`,
        adjustById: (id: number | string): string =>
            `/api/stock/items/${id}/adjust`,
        requests: "/api/stock/requests",
        issueById: (id: number | string): string =>
            `/api/stock/requests/${id}/issue`,
        cancelById: (id: number | string): string =>
            `/api/stock/requests/${id}/cancel`,
        reviewById: (id: number | string): string =>
            `/api/stock/requests/${id}/review`,
    },
    routines: {
        summary: "/api/routines/summary",
        occurrences: "/api/routines/occurrences",
        occurrenceById: (id: number | string): string =>
            `/api/routines/occurrences/${id}`,
        occurrenceDueDateById: (id: number | string): string =>
            `/api/routines/occurrences/${id}/due-date`,
        occurrenceAssigneesById: (id: number | string): string =>
            `/api/routines/occurrences/${id}/assignees`,
        tasks: "/api/routines/tasks",
        taskById: (id: number | string): string => `/api/routines/tasks/${id}`,
        reference: "/api/routines/reference",
        imports: {
            reference: "/api/routines/imports/reference",
            preview: "/api/routines/imports/preview",
            batchById: (id: number | string): string => `/api/routines/imports/${id}`,
            rows: (id: number | string): string => `/api/routines/imports/${id}/rows`,
            rowById: (batchId: number | string, rowId: number | string): string =>
                `/api/routines/imports/${batchId}/rows/${rowId}`,
            apply: (id: number | string): string => `/api/routines/imports/${id}/apply`,
            cancel: (id: number | string): string => `/api/routines/imports/${id}/cancel`,
        },
    },
} as const;
