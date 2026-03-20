"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { apiGet, apiPut } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Save, Search, Users, AlertTriangle } from "lucide-react";

interface EmployeeItem {
    id: number;
    firstName: string;
    lastName: string;
    nickname: string | null;
    email: string;
    position: string;
    managerId: number | null;
    dept: { name: string } | null;
}

const NO_APPROVER_VALUE = "";

const fetcher = async (url: string) => {
    const res = await apiGet<{ employees: EmployeeItem[] }>(url);
    if (!res.success) throw new Error(res.error);
    return res.data;
};

const formatName = (e: { firstName: string; lastName: string; nickname: string | null }): string =>
    `${e.firstName} ${e.lastName}${e.nickname ? ` (${e.nickname})` : ""}`;

export function ApproverManagement() {
    const { data, error: fetchError, isLoading, mutate } = useSWR<{ employees: EmployeeItem[] }>(
        "/api/leave/approvers",
        fetcher,
        { revalidateOnFocus: false }
    );

    const employees = data?.employees ?? [];
    const [assignments, setAssignments] = useState<Map<number, number | null>>(new Map());
    const [isSaving, setIsSaving] = useState(false);
    const [search, setSearch] = useState("");
    const [filterApprover, setFilterApprover] = useState("all");
    const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

    const handleAssign = (employeeId: number, rawValue: string) => {
        const managerId = rawValue === NO_APPROVER_VALUE ? null : Number(rawValue);
        const original = employees.find(e => e.id === employeeId)?.managerId ?? null;

        setAssignments(prev => {
            const next = new Map(prev);
            if (managerId === original) {
                next.delete(employeeId);
            } else {
                next.set(employeeId, managerId);
            }
            return next;
        });
    };

    const getManagerId = (emp: EmployeeItem): number | null =>
        assignments.has(emp.id) ? (assignments.get(emp.id) ?? null) : emp.managerId;

    const handleSave = async () => {
        if (assignments.size === 0) return;
        try {
            setIsSaving(true);
            setSaveMsg(null);

            const payload = Array.from(assignments.entries()).map(([employeeId, managerId]) => ({
                employeeId,
                managerId,
            }));

            const res = await apiPut<{ message: string }>("/api/leave/approvers", { assignments: payload });
            if (!res.success) throw new Error(res.error || "Save failed");

            setSaveMsg({ type: "ok", text: res.data.message });
            setAssignments(new Map());
            await mutate();
        } catch (err) {
            setSaveMsg({ type: "err", text: err instanceof Error ? err.message : "บันทึกไม่สำเร็จ" });
        } finally {
            setIsSaving(false);
        }
    };

    const activeApprovers = useMemo(() => {
        const ids = new Set<number>();
        for (const emp of employees) {
            const mid = getManagerId(emp);
            if (mid) ids.add(mid);
        }
        return employees.filter(e => ids.has(e.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employees, assignments]);

    const filteredEmployees = useMemo(() => {
        const q = search.toLowerCase();
        return employees.filter(emp => {
            const matchSearch = q === "" ||
                formatName(emp).toLowerCase().includes(q) ||
                emp.email.toLowerCase().includes(q) ||
                (emp.dept?.name ?? "").toLowerCase().includes(q);

            const mid = getManagerId(emp);
            const matchFilter =
                filterApprover === "all" ||
                (filterApprover === "unassigned" && !mid) ||
                (filterApprover !== "unassigned" && mid === Number(filterApprover));

            return matchSearch && matchFilter;
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [employees, search, filterApprover, assignments]);

    const unassignedCount = useMemo(() =>
        employees.filter(e => !getManagerId(e)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [employees, assignments]);

    // Loading skeleton
    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
                <Skeleton className="h-12 rounded-xl" />
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
        );
    }

    if (fetchError) {
        return (
            <div className="text-center py-12 text-red-500">
                ไม่สามารถโหลดข้อมูลได้ — กรุณาลองใหม่อีกครั้ง
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard icon={Users} label="พนักงานทั้งหมด" value={employees.length} color="indigo" />
                <StatCard icon={Users} label="ผู้อนุมัติ" value={activeApprovers.length} color="emerald" />
                <StatCard
                    icon={AlertTriangle}
                    label="ยังไม่กำหนด"
                    value={unassignedCount}
                    color={unassignedCount > 0 ? "amber" : "gray"}
                />
            </div>

            {/* Main Card */}
            <Card>
                <CardHeader className="pb-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                        <CardTitle className="text-lg">กำหนดผู้อนุมัติ</CardTitle>
                        <Button
                            onClick={handleSave}
                            disabled={assignments.size === 0 || isSaving}
                            className="bg-indigo-600 hover:bg-indigo-700"
                        >
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                            บันทึก {assignments.size > 0 && `(${assignments.size})`}
                        </Button>
                    </div>

                    {saveMsg && (
                        <div className={`px-4 py-2 rounded-lg text-sm mt-2 border ${
                            saveMsg.type === "ok"
                                ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                                : "bg-red-50 border-red-200 text-red-700"
                        }`}>
                            {saveMsg.text}
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-3 mt-4">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input
                                placeholder="ค้นหาชื่อ อีเมล หรือแผนก…"
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <Select value={filterApprover} onValueChange={setFilterApprover}>
                            <SelectTrigger className="w-full sm:w-[220px]">
                                <SelectValue placeholder="กรองตามผู้อนุมัติ" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">ทั้งหมด</SelectItem>
                                <SelectItem value="unassigned">⚠️ ยังไม่กำหนด</SelectItem>
                                {activeApprovers.map(a => (
                                    <SelectItem key={a.id} value={String(a.id)}>
                                        {formatName(a)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>

                <CardContent>
                    {filteredEmployees.length === 0 ? (
                        <p className="text-center text-gray-400 py-8">ไม่พบพนักงานที่ตรงกับการค้นหา</p>
                    ) : (
                        <div className="space-y-2">
                            {filteredEmployees.map(emp => (
                                <EmployeeRow
                                    key={emp.id}
                                    emp={emp}
                                    managerId={getManagerId(emp)}
                                    hasChange={assignments.has(emp.id)}
                                    allEmployees={employees}
                                    onAssign={handleAssign}
                                />
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

/** Stat card sub-component */
function StatCard({ icon: Icon, label, value, color }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    value: number;
    color: string;
}) {
    const colorMap: Record<string, { card: string; icon: string; text: string; bg: string }> = {
        indigo: { card: "from-indigo-50 to-sky-50 border-indigo-100", icon: "text-indigo-600", text: "text-indigo-700", bg: "bg-indigo-100" },
        emerald: { card: "from-emerald-50 to-teal-50 border-emerald-100", icon: "text-emerald-600", text: "text-emerald-700", bg: "bg-emerald-100" },
        amber: { card: "from-amber-50 to-orange-50 border-amber-200", icon: "text-amber-600", text: "text-amber-700", bg: "bg-amber-100" },
        gray: { card: "from-gray-50 to-slate-50 border-gray-100", icon: "text-gray-400", text: "text-gray-400", bg: "bg-gray-100" },
    };
    const c = colorMap[color] ?? colorMap.gray;

    return (
        <Card className={`bg-gradient-to-br ${c.card}`}>
            <CardContent className="pt-5 pb-4">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${c.bg}`}>
                        <Icon className={`h-5 w-5 ${c.icon}`} />
                    </div>
                    <div>
                        <p className="text-sm text-gray-500">{label}</p>
                        <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

/** Native <select> per row — avoids rendering N Radix portals */
function EmployeeRow({ emp, managerId, hasChange, allEmployees, onAssign }: {
    emp: EmployeeItem;
    managerId: number | null;
    hasChange: boolean;
    allEmployees: EmployeeItem[];
    onAssign: (empId: number, value: string) => void;
}) {
    return (
        <div className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-xl border transition-colors ${
            hasChange
                ? "border-indigo-300 bg-indigo-50/50"
                : !managerId
                    ? "border-amber-200 bg-amber-50/30"
                    : "border-gray-100 hover:bg-gray-50"
        }`}>
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-900">{formatName(emp)}</span>
                    {hasChange && (
                        <Badge variant="outline" className="text-indigo-600 border-indigo-300 text-xs">แก้ไข</Badge>
                    )}
                    {!managerId && !hasChange && (
                        <Badge variant="outline" className="text-amber-600 border-amber-300 text-xs">ยังไม่กำหนด</Badge>
                    )}
                </div>
                <p className="text-sm text-gray-500 truncate">
                    {emp.position} · {emp.dept?.name ?? "ไม่ระบุแผนก"}
                </p>
            </div>

            {/* Native select — lightweight, no portal overhead */}
            <select
                value={managerId ? String(managerId) : NO_APPROVER_VALUE}
                onChange={(e) => onAssign(emp.id, e.target.value)}
                className="w-full sm:w-[240px] h-9 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-700 focus-visible:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                aria-label={`เลือกผู้อนุมัติสำหรับ ${formatName(emp)}`}
            >
                <option value={NO_APPROVER_VALUE}>— ไม่ระบุ —</option>
                {allEmployees
                    .filter(c => c.id !== emp.id)
                    .map(c => (
                        <option key={c.id} value={String(c.id)}>
                            {formatName(c)} {c.dept ? `(${c.dept.name})` : ""}
                        </option>
                    ))
                }
            </select>
        </div>
    );
}
