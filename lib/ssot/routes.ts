import { isDashboardTabEnabled } from "./features";

export const APP_ROUTES = {
    home: "/",
    login: "/login",
    signup: "/signup",
    refreshSession: "/auth/refresh",
    dashboard: "/dashboard",
    dashboardLeave: "/dashboard/leave",
    dashboardStock: "/dashboard/stock",
    dashboardRoutine: "/dashboard/routine",
    dashboardEmailRequest: "/dashboard/email-request",
    dashboardEmployees: "/dashboard/employees",
    dashboardEmployeeNew: "/dashboard/employees/new",
    dashboardEmployeeImport: "/dashboard/employees/import",
    dashboardAudit: "/dashboard/audit",
    dashboardNotifications: "/dashboard/notifications",
    dashboardSessions: "/dashboard/sessions",
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
    leaveManagement: "leave-management",
    leaveHistory: "leave-history",
    managerApproval: "manager-approval",
    stock: "stock",
    routine: "routine",
    emailRequest: "email-request",
    employeeManagement: "employee-management",
    addEmployee: "add-employee",
    importEmployee: "import-employee",
    auditLogs: "audit-logs",
    notifications: "notifications",
    sessions: "sessions",
    itEquipment: "it-equipment",
} as const;

export type DashboardMenuId =
    (typeof APP_DASHBOARD_TABS)[keyof typeof APP_DASHBOARD_TABS];

export const DASHBOARD_MENU_PATHS: Readonly<Record<DashboardMenuId, string>> = {
    dashboard: APP_ROUTES.dashboard,
    "leave-management": APP_ROUTES.dashboardLeave,
    "leave-history": `${APP_ROUTES.dashboardLeave}?leaveTab=my-leave`,
    "manager-approval": `${APP_ROUTES.dashboardLeave}?leaveTab=approvals`,
    stock: APP_ROUTES.dashboardStock,
    "it-equipment": APP_ROUTES.dashboardStock,
    routine: APP_ROUTES.dashboardRoutine,
    "email-request": APP_ROUTES.dashboardEmailRequest,
    "employee-management": APP_ROUTES.dashboardEmployees,
    "add-employee": APP_ROUTES.dashboardEmployeeNew,
    "import-employee": APP_ROUTES.dashboardEmployeeImport,
    "audit-logs": APP_ROUTES.dashboardAudit,
    notifications: APP_ROUTES.dashboardNotifications,
    sessions: APP_ROUTES.dashboardSessions,
};

const DASHBOARD_PATH_MENU_ENTRIES: ReadonlyArray<
    readonly [string, DashboardMenuId]
> = [
    [APP_ROUTES.dashboardEmployeeImport, APP_DASHBOARD_TABS.importEmployee],
    [APP_ROUTES.dashboardEmployeeNew, APP_DASHBOARD_TABS.addEmployee],
    [APP_ROUTES.dashboardEmployees, APP_DASHBOARD_TABS.employeeManagement],
    [APP_ROUTES.dashboardLeave, APP_DASHBOARD_TABS.leaveManagement],
    [APP_ROUTES.dashboardStock, APP_DASHBOARD_TABS.stock],
    [APP_ROUTES.dashboardRoutine, APP_DASHBOARD_TABS.routine],
    [APP_ROUTES.dashboardEmailRequest, APP_DASHBOARD_TABS.emailRequest],
    [APP_ROUTES.dashboardAudit, APP_DASHBOARD_TABS.auditLogs],
    [APP_ROUTES.dashboardNotifications, APP_DASHBOARD_TABS.notifications],
    [APP_ROUTES.dashboardSessions, APP_DASHBOARD_TABS.sessions],
    [APP_ROUTES.dashboard, APP_DASHBOARD_TABS.dashboard],
];

export function toDashboardMenuPath(menuId: string): string {
    return DASHBOARD_MENU_PATHS[menuId as DashboardMenuId]
        ?? APP_ROUTES.dashboard;
}

export function getDashboardMenuIdFromPathname(
    pathname: string | null | undefined,
): DashboardMenuId {
    if (!pathname) {
        return APP_DASHBOARD_TABS.dashboard;
    }

    const match = DASHBOARD_PATH_MENU_ENTRIES.find(([path]) =>
        pathname === path || pathname.startsWith(`${path}/`),
    );

    return match?.[1] ?? APP_DASHBOARD_TABS.dashboard;
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
    const params = new URLSearchParams({ stockTab });
    return `${APP_ROUTES.dashboardStock}?${params.toString()}`;
}

export function toDashboardRoutineTaskPath(
    taskId: number,
    occurrenceId?: number,
): string {
    const params = new URLSearchParams({ taskId: String(taskId) });
    if (occurrenceId !== undefined) {
        params.set("occurrenceId", String(occurrenceId));
    }

    return `${APP_ROUTES.dashboardRoutine}?${params.toString()}`;
}

export type DashboardPageSearchParams = Readonly<
    Record<string, string | string[] | undefined>
>;

const LEGACY_DASHBOARD_TAB_TARGETS: Readonly<
    Record<
        string,
        {
            menuId: DashboardMenuId;
            leaveTab?: "my-leave" | "approvals";
        }
    >
> = {
    dashboard: { menuId: APP_DASHBOARD_TABS.dashboard },
    "leave-management": { menuId: APP_DASHBOARD_TABS.leaveManagement },
    "manager-approval": {
        menuId: APP_DASHBOARD_TABS.leaveManagement,
        leaveTab: "approvals",
    },
    "leave-history": {
        menuId: APP_DASHBOARD_TABS.leaveManagement,
        leaveTab: "my-leave",
    },
    stock: { menuId: APP_DASHBOARD_TABS.stock },
    "it-equipment": { menuId: APP_DASHBOARD_TABS.stock },
    routine: { menuId: APP_DASHBOARD_TABS.routine },
    "email-request": { menuId: APP_DASHBOARD_TABS.emailRequest },
    "employee-management": {
        menuId: APP_DASHBOARD_TABS.employeeManagement,
    },
    "add-employee": { menuId: APP_DASHBOARD_TABS.addEmployee },
    "import-employee": { menuId: APP_DASHBOARD_TABS.importEmployee },
    "audit-logs": { menuId: APP_DASHBOARD_TABS.auditLogs },
    notifications: { menuId: APP_DASHBOARD_TABS.notifications },
    sessions: { menuId: APP_DASHBOARD_TABS.sessions },
};

const DASHBOARD_QUERY_KEYS_BY_MENU: Readonly<
    Partial<Record<DashboardMenuId, readonly string[]>>
> = {
    "leave-management": ["leaveTab"],
    stock: [
        "stockTab",
        "stockItemsPage",
        "stockInventoryPage",
        "stockSearch",
        "stockCategoryId",
        "stockRequestsPage",
    ],
    routine: ["routineTab", "taskId", "occurrenceId"],
};

const VALID_LEAVE_TABS = new Set<string>([
    "my-leave",
    "approvals",
    "recovery",
    "reports",
    "approver-settings",
]);
const VALID_STOCK_TABS = new Set<string>(Object.values(STOCK_DASHBOARD_TABS));
const VALID_ROUTINE_TABS = new Set<string>([
    "mine",
    "all",
    "manage",
    "settings",
    "import",
]);

function getSingleSearchParam(
    searchParams: DashboardPageSearchParams,
    key: string,
): string | null {
    const value = searchParams[key];
    return typeof value === "string" ? value : null;
}

function isPositiveIntegerParam(value: string): boolean {
    const parsed = Number(value);
    return /^\d+$/.test(value)
        && Number.isSafeInteger(parsed)
        && parsed > 0;
}

function isValidDashboardQueryParam(key: string, value: string): boolean {
    if (key === "leaveTab") {
        return VALID_LEAVE_TABS.has(value);
    }
    if (key === "stockTab") {
        return VALID_STOCK_TABS.has(value);
    }
    if (key === "routineTab") {
        return VALID_ROUTINE_TABS.has(value);
    }
    if (
        key === "stockItemsPage"
        || key === "stockInventoryPage"
        || key === "stockRequestsPage"
        || key === "stockCategoryId"
        || key === "taskId"
        || key === "occurrenceId"
    ) {
        return isPositiveIntegerParam(value);
    }
    return key === "stockSearch";
}

function appendSafeDashboardQueryParams(
    target: URLSearchParams,
    searchParams: DashboardPageSearchParams,
    menuId: DashboardMenuId,
): void {
    const allowedKeys = DASHBOARD_QUERY_KEYS_BY_MENU[menuId] ?? [];
    for (const key of allowedKeys) {
        const value = getSingleSearchParam(searchParams, key);
        if (value !== null && isValidDashboardQueryParam(key, value)) {
            target.set(key, value);
        }
    }
}

export function resolveLegacyDashboardRedirect(
    searchParams: DashboardPageSearchParams,
): string | null {
    const rawLegacyTab = searchParams.tab;
    if (rawLegacyTab === undefined) {
        return null;
    }
    if (typeof rawLegacyTab !== "string") {
        return APP_ROUTES.dashboard;
    }

    const legacyTab = rawLegacyTab;

    const target = LEGACY_DASHBOARD_TAB_TARGETS[legacyTab];
    if (!target || !isDashboardTabEnabled(legacyTab)) {
        return APP_ROUTES.dashboard;
    }

    const targetUrl = new URL(
        toDashboardMenuPath(target.menuId),
        "http://dashboard.local",
    );
    const targetSearchParams = targetUrl.searchParams;

    if (target.leaveTab) {
        targetSearchParams.set("leaveTab", target.leaveTab);
    } else {
        appendSafeDashboardQueryParams(
            targetSearchParams,
            searchParams,
            target.menuId,
        );
    }

    const query = targetSearchParams.toString();
    return query
        ? `${targetUrl.pathname}?${query}`
        : targetUrl.pathname;
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
        stockItems: "/api/line/stock/items",
        stockCategories: "/api/line/stock/categories",
        stockAvailability: "/api/line/stock/availability",
        stockRequests: "/api/line/stock/requests",
        stockProcessing: "/api/line/stock/processing",
        stockRequestById: (id: number | string): string =>
            `/api/line/stock/requests/${id}`,
        stockCancelById: (id: number | string): string =>
            `/api/line/stock/requests/${id}/cancel`,
        stockIssueById: (id: number | string): string =>
            `/api/line/stock/requests/${id}/issue`,
        routineTasks: "/api/line/routine/tasks",
        routineSummary: "/api/line/routine/summary",
        routineReference: "/api/line/routine/reference",
        routineTaskById: (id: number | string): string =>
            `/api/line/routine/tasks/${id}`,
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
