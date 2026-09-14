"use client";

import { useId, useMemo, useState } from "react";
import { Filter, Plus, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { ActiveStatus } from "./AuthorizationStatus";
import { formatAuthorizationDate } from "../display";
import type { AuthorizationAdministrationOverviewData } from "../types";

type TeamFilter = "ALL" | "ACTIVE" | "INACTIVE";

export function AuthorizationSummary({
    overview,
    loading,
    error,
    selectedTeamId,
    onSelectTeam,
    onCreateTeam,
    onRefresh,
}: {
    readonly overview: AuthorizationAdministrationOverviewData | undefined;
    readonly loading: boolean;
    readonly error: Error | undefined;
    readonly selectedTeamId: number | null;
    readonly onSelectTeam: (teamId: number) => void;
    readonly onCreateTeam: () => void;
    readonly onRefresh: () => void;
}): React.ReactElement {
    const [query, setQuery] = useState("");
    const [filter, setFilter] = useState<TeamFilter>("ALL");
    const filterId = useId();

    const filteredTeams = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        return (overview?.teams ?? []).filter((team) => {
            const matchesFilter = filter === "ALL"
                || (filter === "ACTIVE" && team.isActive)
                || (filter === "INACTIVE" && !team.isActive);
            if (!matchesFilter) return false;
            if (!normalizedQuery) return true;
            return `${team.name} ${team.key}`.toLocaleLowerCase().includes(normalizedQuery);
        });
    }, [filter, overview?.teams, query]);

    if (loading && !overview) {
        return <LoadingState label="กำลังโหลด Authorization Administration" />;
    }
    if (error && !overview) {
        return (
            <ErrorState
                title="โหลดภาพรวมสิทธิ์ไม่สำเร็จ"
                description="ไม่สามารถอ่าน Team และ capability catalog ได้ในขณะนี้"
                action={{ label: "ลองใหม่", onClick: onRefresh, icon: <RefreshCw aria-hidden="true" /> }}
            />
        );
    }
    if (!overview) return <EmptyState title="ไม่พบข้อมูล Authorization Administration" />;

    return (
        <div className="space-y-5">
            <section aria-label="Authorization Administration summary" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <SummaryMetric label="Registered capabilities" value={overview.summary.registeredCapabilityCount} detail="รายการใน registry" />
                <SummaryMetric label="Safe ordinary grants" value={overview.summary.administrativelyGrantableCapabilityCount} detail="พร้อมจัดการแบบ atomic" tone="positive" />
                <SummaryMetric label="Policy activation required" value={overview.summary.policyActivationRequiredCapabilityCount} detail="ยังไม่เปิดให้ grant" tone="warning" />
                <SummaryMetric label="Deferred capabilities" value={overview.summary.deferredCapabilityCount} detail="เลื่อนการรองรับ" />
                <SummaryMetric label="Active Teams" value={`${overview.summary.activeTeamCount}/${overview.summary.teamCount}`} detail="Active / ทั้งหมด" tone="primary" />
            </section>
            {error ? (
                <div role="alert" className="flex flex-col gap-3 rounded-lg border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm text-status-warning-strong sm:flex-row sm:items-center sm:justify-between">
                    <span>ข้อมูลภาพรวมอาจไม่ใช่ข้อมูลล่าสุด กรุณาโหลดใหม่ก่อนตรวจสอบการเปลี่ยนแปลง</span>
                    <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading} aria-busy={loading}>ลองโหลดใหม่</Button>
                </div>
            ) : null}

            <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
                <div className="flex flex-col gap-4 border-b border-border-subtle px-4 py-4 lg:flex-row lg:items-end lg:justify-between sm:px-5">
                    <div>
                        <h2 className="text-base font-semibold text-content-heading">Teams</h2>
                        <p className="mt-1 text-sm leading-6 text-content-secondary">กลุ่มสิทธิ์การทำงานที่ใช้เป็นแหล่งกำหนดสมาชิก บทบาท และ Team grants</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading} aria-busy={loading}>
                            <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
                            โหลดใหม่
                        </Button>
                        <Button type="button" size="sm" onClick={onCreateTeam}>
                            <Plus aria-hidden="true" />
                            สร้าง Team
                        </Button>
                    </div>
                </div>
                <div className="flex flex-col gap-3 border-b border-border-subtle bg-surface-subtle/60 px-4 py-3 sm:flex-row sm:items-end sm:px-5">
                    <div className="min-w-0 flex-1 space-y-2">
                        <Label htmlFor="authorization-team-search">ค้นหา Team</Label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
                            <Input id="authorization-team-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ชื่อหรือ key" className="pl-9" />
                        </div>
                    </div>
                    <div className="space-y-2 sm:w-48">
                        <Label htmlFor={filterId}><Filter className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />สถานะ</Label>
                        <select id={filterId} value={filter} onChange={(event) => setFilter(event.target.value as TeamFilter)} className="h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                            <option value="ALL">ทั้งหมด</option>
                            <option value="ACTIVE">Active</option>
                            <option value="INACTIVE">Inactive</option>
                        </select>
                    </div>
                </div>
                {filteredTeams.length === 0 ? (
                    <EmptyState
                        compact
                        className="m-4 border-dashed"
                        title={overview.teams.length === 0 ? "ยังไม่มี Team configuration" : "ไม่พบ Team ที่ตรงกับตัวกรอง"}
                        description={overview.teams.length === 0 ? "สร้าง Team แรกเพื่อเริ่มจัดการสมาชิกและสิทธิ์" : "ลองเปลี่ยนคำค้นหาหรือสถานะที่เลือก"}
                        action={overview.teams.length === 0 ? { label: "สร้าง Team", onClick: onCreateTeam, icon: <Plus aria-hidden="true" /> } : undefined}
                    />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-[760px] w-full text-left text-sm">
                            <caption className="sr-only">รายการ Teams</caption>
                            <thead className="border-b border-border-subtle bg-surface-subtle text-xs font-semibold text-content-secondary">
                                <tr>
                                    <th scope="col" className="px-4 py-3 sm:px-5">Team</th>
                                    <th scope="col" className="px-4 py-3">สถานะ</th>
                                    <th scope="col" className="px-4 py-3">TeamRoles</th>
                                    <th scope="col" className="px-4 py-3">สมาชิก</th>
                                    <th scope="col" className="px-4 py-3">Grants</th>
                                    <th scope="col" className="px-4 py-3">ปรับปรุงล่าสุด</th>
                                    <th scope="col" className="px-4 py-3"><span className="sr-only">การดำเนินการ</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border-subtle">
                                {filteredTeams.map((team) => (
                                    <tr key={team.id} className={selectedTeamId === team.id ? "bg-action-primary-surface" : ""}>
                                        <td className="px-4 py-3 sm:px-5">
                                            <button type="button" className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onSelectTeam(team.id)}>
                                                <span className="block font-semibold text-content-heading">{team.name}</span>
                                                <span className="mt-0.5 block font-mono text-xs text-content-secondary">{team.key}</span>
                                            </button>
                                        </td>
                                        <td className="px-4 py-3"><ActiveStatus isActive={team.isActive} /></td>
                                        <td className="px-4 py-3 tabular-nums text-content-body">{team.roleCount}</td>
                                        <td className="px-4 py-3 tabular-nums text-content-body">{team.membershipCount}</td>
                                        <td className="px-4 py-3 tabular-nums text-content-body">{team.teamGrantCount}</td>
                                        <td className="whitespace-nowrap px-4 py-3 text-xs text-content-secondary">{formatAuthorizationDate(team.updatedAt)}</td>
                                        <td className="px-4 py-3 text-right">
                                            <Button type="button" variant="outline" size="xs" onClick={() => onSelectTeam(team.id)}>เปิดรายละเอียด</Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}

function SummaryMetric({
    label,
    value,
    detail,
    tone = "default",
}: {
    readonly label: string;
    readonly value: number | string;
    readonly detail: string;
    readonly tone?: "default" | "positive" | "warning" | "primary";
}): React.ReactElement {
    const valueClass = tone === "warning"
        ? "text-status-warning-strong"
        : tone === "positive"
            ? "text-status-success-strong"
            : tone === "primary"
                ? "text-action-primary-foreground"
                : "text-content-heading";
    return (
        <div className="rounded-xl border border-border-subtle bg-surface-raised px-4 py-3">
            <p className="text-xs font-medium text-content-secondary">{label}</p>
            <p className={`mt-1 text-2xl font-semibold tabular-nums ${valueClass}`}>{value}</p>
            <p className="mt-1 text-xs text-content-muted">{detail}</p>
        </div>
    );
}
