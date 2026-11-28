const emptyPage = { page: 1, limit: 10, total: 0, pages: 0, totalPages: 0 };
const leavePage = { currentPage: 1, totalPages: 0, totalItems: 0, itemsPerPage: 10 };
const ticket = {
    id: 42,
    type: "INCIDENT",
    title: "เข้าใช้งานระบบไม่ได้",
    description: "พบหน้าจอแจ้งข้อผิดพลาด",
    status: "WAITING_REQUESTER",
    createdAt: "2026-09-25T02:00:00.000Z",
    updatedAt: "2026-09-26T03:00:00.000Z",
    resolvedAt: null,
};
const stockRequest = {
    id: 42, projectCode: "NHF-42", status: "PENDING", note: null, cancelReason: null,
    issuedAt: null, cancelledAt: null, createdAt: ticket.createdAt, viewerRole: "REQUESTER",
    availableActions: [], items: [{
        itemName: "กระดาษถ่ายเอกสาร", itemSku: "NHF-PAPER", variantSku: null, variantLabel: null,
        unit: "รีม", quantity: 2, imageUrl: null, currentQuantity: 20, isAvailableForIssue: true,
    }],
};

export function workspaceResponse(pathname, scenario) {
    const available = { enabled: true, status: "available" };
    switch (pathname) {
        case "/api/line/home":
            return {
                workforce: { userId: 10, employeeId: 20, name: "พนักงาน ทดสอบ" },
                modules: { stock: available, leave: available, routine: available, it: available },
                capabilities: {
                    stockCapabilities: { canReadCatalog: true, canReadOwnRequests: true },
                    routineCapabilities: { canReadTasks: scenario !== "restricted", canReadSummary: true },
                    canApproveLeave: scenario === "approvals",
                    leaveCapabilities: {
                        canReadOwnRequests: scenario !== "approvals",
                        canCreateOwnRequests: scenario !== "approvals",
                        canReadAssignedApprovals: scenario === "approvals",
                    },
                },
            };
        case "/api/leave/me":
        case "/api/line/leave/me":
            return { quotas: [], history: [], metadata: { ...leavePage, availableYears: [] } };
        case "/api/line/leave/approvals":
            return {
                pending: [], notTakenPending: [], cancellationPending: [],
                metadata: { pending: leavePage, notTakenPending: leavePage, cancellationPending: leavePage },
                hasActionableWork: true,
            };
        case "/api/stock/items":
            return { items: [], ...emptyPage };
        case "/api/line/stock/items":
            return { ...emptyPage, total: 1, totalPages: 1, items: [{
                id: 1, name: "กระดาษถ่ายเอกสาร", description: null, imageUrl: null, sku: "NHF-PAPER",
                unit: "รีม", defaultVariantId: null, availableQuantity: 20,
                category: { id: 1, name: "วัสดุสำนักงาน" }, variants: [],
            }] };
        case "/api/stock/categories":
        case "/api/line/stock/categories":
            return { categories: [] };
        case "/api/line/stock/requests":
            return { requests: [stockRequest], ...emptyPage, total: 1, totalPages: 1 };
        case "/api/line/stock/requests/42":
            return stockRequest;
        case "/api/line/routine/summary":
            return { summary: { today: 0, dueSoon: 0, within30Days: 0, asOfDate: "2026-11-24" } };
        case "/api/line/routine/tasks":
            return { tasks: [], pagination: emptyPage };
        case "/api/routines/occurrences":
            return { tasks: [], pagination: emptyPage };
        case "/api/it/tickets":
        case "/api/line/it/tickets":
            return { success: true, tickets: [ticket], pagination: { ...emptyPage, total: 1, totalPages: 1 } };
        case "/api/it/operator/tickets":
            return { success: true, tickets: [], nextCursor: null, limit: 10, awaitingClosureCount: 0 };
        case "/api/it/operator/reference":
            return { success: true, categories: [], assignableOperators: [] };
        case "/api/it/analytics":
            return { success: true, dashboard: {
                generatedAt: "2026-11-24T03:00:00.000Z",
                timeZone: "Asia/Bangkok",
                period: { key: "30D", startAt: "2026-10-25T17:00:00.000Z", endAt: "2026-11-24T03:00:00.000Z" },
                filters: { type: null, category: null },
                filterOptions: { categories: [] },
                summary: {
                    currentBacklog: 0, waitingRequester: 0, unassignedBacklog: 0, untriagedBacklog: 0,
                    highPriorityBacklog: 0, agedBacklog: 0, oldestUnresolvedAgeMinutes: null,
                    newTickets: 0, resolvedTickets: 0,
                },
                trend: [], statusDistribution: [], typeDistribution: [], priorityDistribution: [],
                priorityBacklog: [],
                backlogAging: ["0_1", "2_3", "4_7", "8_14", "15_PLUS"].map((bucket) => ({ bucket, count: 0 })),
                categoryBacklog: [], assigneeBacklog: [], departmentCreated: [],
                topCategories: { limit: 10, rows: [], otherCategoryCount: 0, otherTicketCount: 0 },
            } };
        case "/api/audit-logs":
            return { auditLogs: [], pagination: emptyPage };
        case "/api/employees":
            return { employees: [], pagination: emptyPage };
        case "/api/departments":
            return { departments: [] };
        case "/api/line/it/tickets/42":
            return { success: true, ticket: { ...ticket, initialAttachments: [] } };
        case "/api/line/it/tickets/42/conversation":
        case "/api/line/it/tickets/42/activity":
            return { success: true, items: [], olderCursor: null, hasMore: false };
        case "/api/authorization/administration":
            return { overview: {
                capabilities: [], teams: [],
                summary: {
                    registeredCapabilityCount: 0, administrativelyGrantableCapabilityCount: 0,
                    policyActivationRequiredCapabilityCount: 0, deferredCapabilityCount: 0,
                    teamCount: 0, activeTeamCount: 0,
                },
            } };
        default:
            return undefined;
    }
}
