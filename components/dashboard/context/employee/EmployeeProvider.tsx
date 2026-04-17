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
import { type Employee } from "@/types/employees";
import { PAGINATION_DEFAULTS } from "@/constants/ui";
import { triggerDownload } from "@/lib/helpers/download";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { EmployeeDataContext, EmployeeUIContext } from "./EmployeeContext";
import { EXPORT_LIMITS } from "@/lib/ssot/exports";
import { API_ROUTES } from "@/lib/ssot/routes";
import {
    type EmployeeDataContextValue,
    type EmployeeUIContextValue,
} from "./types";

interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

interface EmployeeProviderProps {
    children: ReactNode;
}

const defaultPagination: Pagination = {
    page: 1,
    limit: PAGINATION_DEFAULTS.ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0,
};

export function EmployeeProvider({ children }: EmployeeProviderProps) {
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

    const debouncedSearchTerm = useDebouncedValue(searchTerm, 300);

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

    // SWR Hook
    const {
        data,
        mutate,
        isLoading,
        error: swrError,
    } = useSWR(swrKey, { keepPreviousData: true });

    // Keep mutate stable using ref to prevent unnecessary re-renders
    const mutateRef = useRef(mutate);
    useEffect(() => {
        mutateRef.current = mutate;
    }, [mutate]);

    // Derived data - wrapped in useMemo to prevent exhaustive-deps warning in dataValue
    const { employees, pagination, error } = useMemo(() => {
        return {
            employees: data?.employees || [],
            pagination: data?.pagination || defaultPagination,
            error: swrError
                ? swrError.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล"
                : "",
        };
    }, [data, swrError]);

    // Force refresh when refreshTrigger changes
    useEffect(() => {
        if (refreshTrigger > 0) {
            mutateRef.current();
        }
    }, [refreshTrigger]);

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
    }, [debouncedSearchTerm, pagination.total, statusFilter]);

    const handleEditEmployee = useCallback((employee: Employee) => {
        setEmployeeToEdit(employee);
        setIsEditFormOpen(true);
    }, []);

    const handleCloseEditForm = useCallback(() => {
        setIsEditFormOpen(false);
        setEmployeeToEdit(null);
    }, []);

    const handleEmployeeUpdate = useCallback(() => {
        const employeeName = employeeToEdit
            ? `${employeeToEdit.firstName} ${employeeToEdit.lastName}`
            : "พนักงาน";

        setIsEditFormOpen(false);
        setEmployeeToEdit(null);

        // Show toast notification instead of modal
        toast.success("อัปเดตข้อมูลสำเร็จ", {
            description: `ข้อมูลของ ${employeeName} ได้รับการอัปเดตเรียบร้อยแล้ว`,
        });

        mutateRef.current(); // Revalidate SWR
    }, [employeeToEdit]);

    // Stable triggerRefresh that doesn't depend on mutate identity
    const triggerRefresh = useCallback(async () => {
        await mutateRef.current();
        setRefreshTrigger((prev) => prev + 1);
    }, []);

    // Split data into stable references to reduce context updates
    // triggerRefresh is intentionally excluded - it's kept stable via ref pattern
    const dataValue = useMemo<EmployeeDataContextValue>(
        () => ({
            employees,
            currentEmployees: employees,
            totalEmployees: pagination.total,
            totalPages: pagination.totalPages,
            isLoading,
            error,
            fetchEmployees: triggerRefresh,
            refreshTrigger,
            triggerRefresh,
        }),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            employees,
            pagination.total,
            pagination.totalPages,
            isLoading,
            error,
            refreshTrigger,
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
