export const APP_ROUTES = {
    home: "/",
    login: "/login",
    signup: "/signup",
    dashboard: "/dashboard",
    accessDenied: "/access-denied",
    forgotPassword: "/forgot-password",
    resetPassword: "/reset-password",
} as const;

export const APP_DASHBOARD_TABS = {
    dashboard: "dashboard",
    notifications: "notifications",
    sessions: "sessions",
    leaveManagement: "leave-management",
    leaveHistory: "leave-history",
    managerApproval: "manager-approval",
    stock: "stock",
    itSupport: "it-support",
} as const;

export function toDashboardTabPath(tab: string): string {
    return `${APP_ROUTES.dashboard}?tab=${tab}`;
}

export const API_ROUTES = {
    auth: {
        bootstrap: "/api/auth/bootstrap",
        forgotPassword: "/api/auth/forgot-password",
        resetPassword: "/api/auth/reset-password",
        signup: "/api/auth/signup",
        refresh: "/api/auth/refresh",
        logout: "/api/auth/logout",
        logoutAll: "/api/auth/logout-all",
        sessions: "/api/auth/sessions",
        revokeSession: "/api/auth/sessions/revoke",
        cleanup: "/api/auth/cleanup",
    },
    employees: {
        list: "/api/employees",
        stats: "/api/employees/stats",
        import: "/api/employees/import",
        departments: "/api/departments",
        byId: (id: number | string): string => `/api/employees/${id}`,
    },
    tickets: {
        list: "/api/tickets",
        byId: (id: number | string): string => `/api/tickets/${id}`,
    },
    notifications: {
        list: "/api/notifications",
        all: "/api/notifications/all",
        markAllRead: "/api/notifications/mark-all-read",
        read: (id: string): string => `/api/notifications/${id}/read`,
    },
    leave: {
        me: "/api/leave/me",
        approvals: "/api/leave/approvals",
        cancel: "/api/leave/cancel",
        request: "/api/leave/request",
        approvers: "/api/leave/approvers",
        intranetAction: "/api/leave/intranet-action",
        export: "/api/leave/export",
    },
    auditLogs: {
        export: "/api/audit-logs/export",
    },
    uploads: {
        image: "/api/uploads/image",
    },
    emailRequest: {
        list: "/api/email-request",
    },
    stock: {
        categories: "/api/stock/categories",
        items: "/api/stock/items",
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
} as const;
