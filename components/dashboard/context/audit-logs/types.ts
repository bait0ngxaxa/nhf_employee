export interface AuditLog {
    id: number;
    action: string;
    entityType: string;
    entityId: number | null;
    userId: number | null;
    userEmail: string | null;
    ipAddress: string | null;
    userAgent: string | null;
    details: Record<string, unknown> | null;
    createdAt: string;
    user: {
        id: number;
        name: string;
        email: string;
    } | null;
}

export interface AuditLogsContextValue {
    // Data
    auditLogs: AuditLog[];
    filteredLogs: AuditLog[];

    // Loading & Error
    isLoading: boolean;
    error: string;

    // Pagination
    currentPage: number;
    setCurrentPage: (page: number) => void;
    totalPages: number;
    handlePreviousPage: () => void;
    handleNextPage: () => void;

    // Filters
    actionFilter: string;
    setActionFilter: (filter: string) => void;
    entityTypeFilter: string;
    setEntityTypeFilter: (filter: string) => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;

    // Actions
    refresh: () => void;
}
