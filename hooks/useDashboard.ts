import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Employee, EmployeeCSVData } from "@/types/employees";
import { MenuItem } from "@/types/dashboard";
import { useEmployeeExport } from "@/hooks/useEmployeeExport";
import {
    DASHBOARD_MENU_ITEMS,
    getAvailableMenuItems,
} from "@/constants/dashboard";

interface EmployeeStats {
    total: number;
    active: number;
    admin: number;
    academic: number;
}

interface UseDashboardReturn {
    // Session
    session: ReturnType<typeof useSession>["data"];
    status: ReturnType<typeof useSession>["status"];
    user:
        | {
              id?: string;
              name?: string | null;
              email?: string | null;
              role?: string;
              department?: string;
          }
        | undefined;
    isAdmin: boolean;

    // Navigation
    selectedMenu: string;
    setSelectedMenu: (menu: string) => void;
    sidebarOpen: boolean;
    setSidebarOpen: (open: boolean) => void;
    availableMenuItems: MenuItem[];
    handleMenuClick: (menuId: string) => void;
    handleSignOut: () => void;

    // Employee Stats
    employeeStats: EmployeeStats;
    refreshTrigger: number;
    handleEmployeeAdded: () => void;
    fetchEmployeeStats: () => Promise<void>;

    // Export
    allEmployees: Employee[];
    isExporting: boolean;
    prepareCsvData: () => EmployeeCSVData[];
    generateFileName: () => string;
    handleExportCSV: () => Promise<void>;

    // Router
    router: ReturnType<typeof useRouter>;
}

export function useDashboard(): UseDashboardReturn {
    const { data: session, status } = useSession();
    const router = useRouter();
    const user = session?.user;
    const isAdmin = user?.role === "ADMIN";

    const [selectedMenu, setSelectedMenu] = useState<string>("dashboard");
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [employeeStats, setEmployeeStats] = useState<EmployeeStats>({
        total: 0,
        active: 0,
        admin: 0,
        academic: 0,
    });
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    const {
        allEmployees,
        setAllEmployees,
        isExporting,
        setIsExporting,
        prepareCsvData,
        generateFileName,
    } = useEmployeeExport();

    const availableMenuItems = getAvailableMenuItems(isAdmin);

    const fetchEmployeeStats = useCallback(async () => {
        if (isAdmin) {
            try {
                const response = await fetch("/api/employees");
                if (response.ok) {
                    const data = await response.json();
                    const employees: Employee[] = data.employees;

                    setAllEmployees(employees);

                    const stats = {
                        total: employees.length,
                        active: employees.filter(
                            (emp: Employee) => emp.status === "ACTIVE"
                        ).length,
                        admin: employees.filter(
                            (emp: Employee) => emp.dept.code === "ADMIN"
                        ).length,
                        academic: employees.filter(
                            (emp: Employee) => emp.dept.code === "ACADEMIC"
                        ).length,
                    };

                    setEmployeeStats(stats);
                }
            } catch (error) {
                console.error("Error fetching employee stats:", error);
            }
        }
    }, [isAdmin, setAllEmployees]);

    useEffect(() => {
        fetchEmployeeStats();
    }, [fetchEmployeeStats, refreshTrigger]);

    const handleEmployeeAdded = () => {
        setRefreshTrigger((prev) => prev + 1);
    };

    const handleMenuClick = (menuId: string) => {
        const menuItem = DASHBOARD_MENU_ITEMS.find(
            (item) => item.id === menuId
        );
        if (menuItem?.requiredRole === "ADMIN" && !isAdmin) {
            window.location.href = "/access-denied";
            return;
        }

        setSelectedMenu(menuId);

        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    };

    const handleSignOut = () => {
        signOut({ callbackUrl: "/login" });
    };

    const handleExportCSV = async () => {
        setIsExporting(true);
        try {
            await fetchEmployeeStats();
        } catch (error) {
            console.error("Error preparing export:", error);
        } finally {
            setIsExporting(false);
        }
    };

    return {
        session,
        status,
        user,
        isAdmin,
        selectedMenu,
        setSelectedMenu,
        sidebarOpen,
        setSidebarOpen,
        availableMenuItems,
        handleMenuClick,
        handleSignOut,
        employeeStats,
        refreshTrigger,
        handleEmployeeAdded,
        fetchEmployeeStats,
        allEmployees,
        isExporting,
        prepareCsvData,
        generateFileName,
        handleExportCSV,
        router,
    };
}
