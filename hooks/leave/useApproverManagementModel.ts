import { useCallback, useMemo, useState } from "react";
import useSWR from "swr";
import {
    fetchApproverEmployees,
    saveApproverAssignments,
    type ApproverEmployeeItem,
} from "@/lib/services/leave/client";

const NO_APPROVER_VALUE = "";
const APPROVER_SAVE_SUCCESS_MESSAGE = "บันทึกการกำหนดผู้อนุมัติเรียบร้อยแล้ว";
const APPROVER_SAVE_ERROR_MESSAGE = "บันทึกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";

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
            setAssignments(new Map());
            await mutate();
        } catch {
            setSaveMsg({ type: "err", text: APPROVER_SAVE_ERROR_MESSAGE });
        } finally {
            setIsSaving(false);
        }
    };

    return {
        NO_APPROVER_VALUE,
        employees,
        activeApprovers,
        filteredEmployees,
        unassignedCount,
        assignments,
        isSaving,
        isLoading,
        fetchError,
        search,
        filterApprover,
        saveMsg,
        setSearch,
        setFilterApprover,
        handleAssign,
        getManagerId,
        handleSave,
        formatName,
    };
}
