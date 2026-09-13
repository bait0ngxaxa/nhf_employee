"use client";

import {
    useState,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    startTransition,
    type ReactNode,
} from "react";
import useSWR from "swr";

import { toast } from "sonner";
import type { Employee } from "../types";
import { PAGINATION_DEFAULTS } from "@/constants/ui";
import { triggerDownload } from "@/lib/helpers/download";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { EmployeeDataContext, EmployeeUIContext } from "./EmployeeContext";
import { EXPORT_LIMITS } from "@/lib/ssot/exports";
import { API_ROUTES } from "@/lib/ssot/routes";
import { getEmployeeDisplayName } from "../formatters";
import {
    type EmployeeStats,
    type EmployeeDataContextValue,
    type EmployeeUIContextValue,
} from "./types";
import type { EmployeePresentationCapabilities } from "../../../application/types";

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface EmployeeProviderProps {
    children: ReactNode;
    employeeCapabilities?: EmployeePresentationCapabilities;
}

const defaultPagination: Pagination = {
    page: 1,
    limit: PAGINATION_DEFAULTS.ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0,
};

const defaultEmployeeStats: EmployeeStats = {
    total: 0,
    active: 0,
    admin: 0,
    academic: 0,
};

interface EmployeeStatsResponse {
    stats: EmployeeStats;
}

interface EmployeeListResponse {
    employees: Employee[];
    pagination: Pagination;
}

export function EmployeeProvider({
    children,
    employeeCapabilities,
}: EmployeeProviderProps) {
    const canReadEmployees = employeeCapabilities?.canReadEmployees === true;
    const canReadStats = employeeCapabilities?.canReadStats === true;
    const canUpdateEmployees = employeeCapabilities?.canUpdateEmployees === true;
    const canExportEmployees = employeeCapabilities?.canExportEmployees === true;
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage] = useState(PAGINATION_DEFAULTS.ITEMS_PER_PAGE);

    const handleSearchTermChange = useCallback((value: string) => {
        startTransition(() => {
            setSearchTerm(value);
            setCurrentPage(1);
        });
    }, []);

    const handleStatusFilterChange = useCallback((value: string) => {
        startTransition(() => {
            setStatusFilter(value);
            setCurrentPage(1);
        });
    }, []);

    // UI states
    const [isExporting, setIsExporting] = useState(false);
    const [isEditFormOpen, setIsEditFormOpen] = useState(false);
    const [employeeToEdit, setEmployeeToEdit] = useState<Employee | null>(null);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const debouncedSearchTerm = useDebouncedValue(searchTerm);

    // Prepare SWR key
    const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: itemsPerPage.toString(),
    });

    if (debouncedSearchTerm) {
        params.append("search", debouncedSearchTerm);
    }
    if (statusFilter && statusFilter !== "all") {
        params.append("status", statusFilter);
    }
    const swrKey = `${API_ROUTES.employees.list}?${params.toString()}`;
    const employeeListKey = canReadEmployees ? swrKey : null;
    const employeeStatsKey = canReadStats ? API_ROUTES.employees.stats : null;

    // SWR Hook
    const {
        data,
        mutate,
        isLoading,
        error: swrError,
    } = useSWR<EmployeeListResponse>(employeeListKey, { keepPreviousData: true });
    const { data: statsData, mutate: mutateStats } = useSWR<EmployeeStatsResponse>(
        employeeStatsKey,
    );

    // Keep mutate stable using ref to prevent unnecessary re-renders
    const mutateRef = useRef(mutate);
    const mutateStatsRef = useRef(mutateStats);
    useEffect(() => {
        mutateRef.current = mutate;
    }, [mutate]);
    useEffect(() => {
        mutateStatsRef.current = mutateStats;
    }, [mutateStats]);

    const revalidatePermittedData = useCallback(async (): Promise<void> => {
        const refreshes: Promise<unknown>[] = [];
        if (canReadEmployees) {
            refreshes.push(mutateRef.current());
        }
        if (canReadStats) {
            refreshes.push(mutateStatsRef.current());
        }
        await Promise.all(refreshes);
    }, [canReadEmployees, canReadStats]);

    // Derived data - wrapped in useMemo to prevent exhaustive-deps warning in dataValue
    const { employees, pagination, error } = useMemo(() => {
        return {
            employees: canReadEmployees ? data?.employees || [] : [],
            pagination: canReadEmployees
                ? data?.pagination || defaultPagination
                : defaultPagination,
            error: canReadEmployees && swrError
                ? swrError.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล"
                : "",
        };
    }, [canReadEmployees, data, swrError]);
    const employeeStats = canReadStats
        ? statsData?.stats ?? defaultEmployeeStats
        : defaultEmployeeStats;

    const handlePageChange = useCallback((page: number) => {
        startTransition(() => {
            setCurrentPage(page);
        });
    }, []);

    const handlePreviousPage = useCallback(() => {
        startTransition(() => {
            setCurrentPage((prev) => Math.max(prev - 1, 1));
        });
    }, []);

    const handleNextPage = useCallback(() => {
        startTransition(() => {
            setCurrentPage((prev) => Math.min(prev + 1, pagination.totalPages));
        });
    }, [pagination.totalPages]);

    const handleExportCSV = useCallback(async (): Promise<void> => {
        if (!canExportEmployees) {
            return;
        }

        setIsExporting(true);
        try {
            if (pagination.total === 0) {
                toast.error("ไม่มีข้อมูลสำหรับดาวน์โหลด");
                return;
            }

            if (pagination.total > EXPORT_LIMITS.employee.maxRows) {
                toast.error("ข้อมูลเกินขนาดที่กำหนด", {
                    description: `ส่งออกข้อมูลพนักงานได้ไม่เกิน ${EXPORT_LIMITS.employee.maxRows} รายการต่อครั้ง กรุณากรองข้อมูลเพิ่มเติม`,
                });
                return;
            }

            const exportParams = new URLSearchParams();
            if (debouncedSearchTerm) {
                exportParams.set("search", debouncedSearchTerm);
            }
            if (statusFilter && statusFilter !== "all") {
                exportParams.set("status", statusFilter);
            }

            const queryString = exportParams.toString();
            const exportUrl = queryString
                ? `${API_ROUTES.employees.export}?${queryString}`
                : API_ROUTES.employees.export;

            triggerDownload(exportUrl);

            toast.success("เริ่มดาวน์โหลดไฟล์แล้ว", {
                description: `กำลังส่งออกข้อมูลพนักงาน ${pagination.total} รายการ`,
            });
        } catch (err) {
            console.error("Error preparing employee export:", err);
            toast.error("เกิดข้อผิดพลาดในการดาวน์โหลด", {
                description:
                    "ไม่สามารถเริ่มการดาวน์โหลดไฟล์ได้ กรุณาลองใหม่อีกครั้ง",
            });
        } finally {
            setTimeout(() => setIsExporting(false), 500);
        }
    }, [canExportEmployees, debouncedSearchTerm, pagination.total, statusFilter]);

    const handleEditEmployee = useCallback((employee: Employee) => {
        if (!canUpdateEmployees) {
            return;
        }

        setEmployeeToEdit(employee);
        setIsEditFormOpen(true);
    }, [canUpdateEmployees]);

    const handleCloseEditForm = useCallback(() => {
        setIsEditFormOpen(false);
        setEmployeeToEdit(null);
    }, []);

    const handleEmployeeUpdate = useCallback(() => {
        if (!canUpdateEmployees) {
            setIsEditFormOpen(false);
            setEmployeeToEdit(null);
            return;
        }

        const employeeName = employeeToEdit
            ? getEmployeeDisplayName(employeeToEdit)
            : "พนักงาน";

        setIsEditFormOpen(false);
        setEmployeeToEdit(null);

        // Show toast notification instead of modal
        toast.success("อัปเดตข้อมูลสำเร็จ", {
            description: `ข้อมูลของ ${employeeName} ได้รับการอัปเดตเรียบร้อยแล้ว`,
        });

        const refreshes: Promise<unknown>[] = [];
        if (canReadEmployees) {
            refreshes.push(mutateRef.current());
        }
        if (canReadStats) {
            refreshes.push(mutateStatsRef.current());
        }
        void Promise.all(refreshes);
    }, [canReadEmployees, canReadStats, canUpdateEmployees, employeeToEdit]);

    useEffect(() => {
        if (canUpdateEmployees) {
            return;
        }

        if (isEditFormOpen || employeeToEdit !== null) {
            setIsEditFormOpen(false);
            setEmployeeToEdit(null);
        }
    }, [canUpdateEmployees, employeeToEdit, isEditFormOpen]);

    // Stable triggerRefresh that doesn't depend on mutate identity
    const triggerRefresh = useCallback(async () => {
        await revalidatePermittedData();
        setRefreshTrigger((prev) => prev + 1);
    }, [revalidatePermittedData]);

    // Split data into stable references to reduce context updates.
    const dataValue = useMemo<EmployeeDataContextValue>(
        () => ({
            employees,
            currentEmployees: employees,
            employeeStats,
            totalEmployees: pagination.total,
            totalPages: pagination.totalPages,
            isLoading: canReadEmployees && isLoading,
            error,
            fetchEmployees: triggerRefresh,
            refreshTrigger,
            triggerRefresh,
        }),
        [
            employees,
            employeeStats,
            pagination.total,
            pagination.totalPages,
            isLoading,
            error,
            refreshTrigger,
            canReadEmployees,
            triggerRefresh,
        ],
    );

    // Split UI handlers into a separate memoized object to reduce dependencies
    const uiHandlers = useMemo(
        () => ({
            handleSearchTermChange,
            handleStatusFilterChange,
            handlePageChange,
            handlePreviousPage,
            handleNextPage,
            handleExportCSV,
            handleEditEmployee,
            handleCloseEditForm,
            handleEmployeeUpdate,
        }),
        [
            handleSearchTermChange,
            handleStatusFilterChange,
            handlePageChange,
            handlePreviousPage,
            handleNextPage,
            handleExportCSV,
            handleEditEmployee,
            handleCloseEditForm,
            handleEmployeeUpdate,
        ],
    );

    const uiValue = useMemo<EmployeeUIContextValue>(
        () => ({
            searchTerm,
            debouncedSearchTerm,
            setSearchTerm: uiHandlers.handleSearchTermChange,
            statusFilter,
            setStatusFilter: uiHandlers.handleStatusFilterChange,
            currentPage,
            itemsPerPage,
            handlePageChange: uiHandlers.handlePageChange,
            handlePreviousPage: uiHandlers.handlePreviousPage,
            handleNextPage: uiHandlers.handleNextPage,
            isExporting,
            handleExportCSV: uiHandlers.handleExportCSV,
            isEditFormOpen,
            employeeToEdit,
            handleEditEmployee: uiHandlers.handleEditEmployee,
            handleCloseEditForm: uiHandlers.handleCloseEditForm,
            handleEmployeeUpdate: uiHandlers.handleEmployeeUpdate,
        }),
        [
            searchTerm,
            debouncedSearchTerm,
            statusFilter,
            currentPage,
            itemsPerPage,
            isExporting,
            isEditFormOpen,
            employeeToEdit,
            uiHandlers,
        ],
    );

    return (
        <EmployeeDataContext.Provider value={dataValue}>
            <EmployeeUIContext.Provider value={uiValue}>
                {children}
            </EmployeeUIContext.Provider>
        </EmployeeDataContext.Provider>
    );
}
