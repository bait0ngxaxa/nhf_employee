import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";
import {
    fetchApproverEmployees,
    saveApproverAssignments,
    type ApproverEmployeeItem,
} from "@/lib/services/leave/client";

const NO_APPROVER_VALUE = "";
const APPROVER_SAVE_SUCCESS_MESSAGE = "บันทึกการกำหนดผู้อนุมัติเรียบร้อยแล้ว";
const APPROVER_SAVE_ERROR_MESSAGE = "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
const APPROVER_ITEMS_PER_PAGE = 25;

const formatName = (employee: {
    firstName: string;
    lastName: string;
    nickname: string | null;
}): string => `${employee.firstName} ${employee.lastName}${employee.nickname ? ` (${employee.nickname})` : ""}`;

export function useApproverManagementModel() {
    const { data, error: fetchError, isLoading, mutate } = useSWR<ApproverEmployeeItem[]>(
        "leave-approver-employees",
        fetchApproverEmployees,
        { revalidateOnFocus: false },
    );

    const employees = useMemo(() => data ?? [], [data]);
    const [assignments, setAssignments] = useState<Map<number, number | null>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [filterApprover, setFilterApprover] = useState("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

    const getManagerId = useCallback(
        (employee: ApproverEmployeeItem): number | null =>
            assignments.has(employee.id) ? (assignments.get(employee.id) ?? null) : employee.managerId,
        [assignments],
    );

    const activeApprovers = useMemo(() => {
        const ids = new Set<number>();
        for (const employee of employees) {
            const managerId = getManagerId(employee);
            if (managerId) ids.add(managerId);
        }
        return employees.filter((employee) => ids.has(employee.id));
    }, [employees, getManagerId]);

    const filteredEmployees = useMemo(() => {
        const query = search.toLowerCase();
        return employees.filter((employee) => {
            const matchSearch =
                query === "" ||
                formatName(employee).toLowerCase().includes(query) ||
                employee.email.toLowerCase().includes(query) ||
                (employee.dept?.name ?? "").toLowerCase().includes(query);

            const managerId = getManagerId(employee);
            const matchFilter =
                filterApprover === "all" ||
                (filterApprover === "unassigned" && !managerId) ||
                (filterApprover !== "unassigned" && managerId === Number(filterApprover));

            return matchSearch && matchFilter;
        });
    }, [employees, search, filterApprover, getManagerId]);

    const unassignedCount = useMemo(
        () => employees.filter((employee) => !getManagerId(employee)).length,
        [employees, getManagerId],
    );

    const totalPages = useMemo(
        () => Math.max(1, Math.ceil(filteredEmployees.length / APPROVER_ITEMS_PER_PAGE)),
        [filteredEmployees.length],
    );

    const pagedEmployees = useMemo(() => {
        const startIndex = (currentPage - 1) * APPROVER_ITEMS_PER_PAGE;
        return filteredEmployees.slice(startIndex, startIndex + APPROVER_ITEMS_PER_PAGE);
    }, [currentPage, filteredEmployees]);

    useEffect(() => {
        setCurrentPage((prev) => Math.min(prev, totalPages));
    }, [totalPages]);

    const handleSearchChange = useCallback((value: string) => {
        setSearch(value);
        setCurrentPage(1);
    }, []);

    const handleFilterApproverChange = useCallback((value: string) => {
        setFilterApprover(value);
        setCurrentPage(1);
    }, []);

    const handlePreviousPage = useCallback(() => {
        setCurrentPage((prev) => Math.max(1, prev - 1));
    }, []);

    const handleNextPage = useCallback(() => {
        setCurrentPage((prev) => Math.min(totalPages, prev + 1));
    }, [totalPages]);

    const handleAssign = (employeeId: number, rawValue: string): void => {
        const managerId = rawValue === NO_APPROVER_VALUE ? null : Number(rawValue);
        const original = employees.find((employee) => employee.id === employeeId)?.managerId ?? null;
        setAssignments((prev) => {
            const next = new Map(prev);
            if (managerId === original) {
                next.delete(employeeId);
            } else {
                next.set(employeeId, managerId);
            }
            if (prev.size === 0 && next.size > 0) {
                toast.info("มีการเปลี่ยนแปลงที่ยังไม่บันทึก", {
                    description: "อย่าลืมกดปุ่มบันทึกเพื่อยืนยันการแก้ไข",
                });
            }
            return next;
        });
    };

    const handleSave = async (): Promise<void> => {
        if (assignments.size === 0) return;
        try {
            setIsSaving(true);
            setSaveMsg(null);

            const payload = Array.from(assignments.entries()).map(([employeeId, managerId]) => ({
                employeeId,
                managerId,
            }));

            await saveApproverAssignments({ assignments: payload });
            setSaveMsg({ type: "ok", text: APPROVER_SAVE_SUCCESS_MESSAGE });
            toast.success(APPROVER_SAVE_SUCCESS_MESSAGE);
            setAssignments(new Map());
            await mutate();
        } catch {
            setSaveMsg({ type: "err", text: APPROVER_SAVE_ERROR_MESSAGE });
            toast.error(APPROVER_SAVE_ERROR_MESSAGE);
        } finally {
            setIsSaving(false);
        }
    };

    return {
        NO_APPROVER_VALUE,
        employees,
        activeApprovers,
        filteredEmployees,
        pagedEmployees,
        unassignedCount,
        currentPage,
        totalPages,
        itemsPerPage: APPROVER_ITEMS_PER_PAGE,
        assignments,
        isSaving,
        isLoading,
        fetchError,
        search,
        filterApprover,
        saveMsg,
        setSearch: handleSearchChange,
        setFilterApprover: handleFilterApproverChange,
        setCurrentPage,
        handlePreviousPage,
        handleNextPage,
        handleAssign,
        getManagerId,
        handleSave,
        formatName,
    };
}
