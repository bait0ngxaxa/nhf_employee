"use client";

import { useId, useMemo, useState } from "react";
import { Filter, Plus, RefreshCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { ActiveStatus } from "./AuthorizationStatus";
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
            return team.name.toLocaleLowerCase().includes(normalizedQuery);
        });
    }, [filter, overview?.teams, query]);

    if (loading && !overview) {
        return <LoadingState label="กำลังโหลดการจัดการสิทธิ์" />;
    }
    if (error && !overview) {
        return (
            <ErrorState
                title="โหลดภาพรวมสิทธิ์ไม่สำเร็จ"
                description="ไม่สามารถอ่านทีมและรายการสิทธิ์ได้ในขณะนี้"
                action={{ label: "ลองใหม่", onClick: onRefresh, icon: <RefreshCw aria-hidden="true" /> }}
            />
        );
    }
    if (!overview) return <EmptyState title="ไม่พบข้อมูลการจัดการสิทธิ์" />;

    return (
        <div className="space-y-5">
            {error ? (
                <div role="alert" className="flex flex-col gap-3 rounded-lg border border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm text-status-warning-strong sm:flex-row sm:items-center sm:justify-between">
                    <span>ข้อมูลภาพรวมอาจไม่ใช่ข้อมูลล่าสุด กรุณาโหลดใหม่ก่อนตรวจสอบการเปลี่ยนแปลง</span>
                    <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading} aria-busy={loading}>ลองโหลดใหม่</Button>
                </div>
            ) : null}

            <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
                <div className="flex flex-col gap-4 border-b border-border-subtle px-4 py-4 lg:flex-row lg:items-end lg:justify-between sm:px-5">
                    <div>
                        <h2 className="text-base font-semibold text-content-heading">ทีม</h2>
                        <p className="mt-1 text-sm leading-6 text-content-secondary">{overview.summary.teamCount} ทีม · {overview.summary.activeTeamCount} ทีมใช้งานอยู่</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading} aria-busy={loading}>
                            <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
                            โหลดใหม่
                        </Button>
                        <Button type="button" size="sm" onClick={onCreateTeam}>
                            <Plus aria-hidden="true" />
                            สร้างทีม
                        </Button>
                    </div>
                </div>
                <div className="flex flex-col gap-3 border-b border-border-subtle bg-surface-subtle/60 px-4 py-3 sm:flex-row sm:items-end sm:px-5">
                    <div className="min-w-0 flex-1 space-y-2">
                        <Label htmlFor="authorization-team-search">ค้นหาทีม</Label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
                            <Input id="authorization-team-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ชื่อทีม" className="pl-9" />
                        </div>
                    </div>
                    <div className="space-y-2 sm:w-48">
                        <Label htmlFor={filterId}><Filter className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />สถานะ</Label>
                        <select id={filterId} value={filter} onChange={(event) => setFilter(event.target.value as TeamFilter)} className="h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                            <option value="ALL">ทั้งหมด</option>
                            <option value="ACTIVE">ใช้งานอยู่</option>
                            <option value="INACTIVE">ปิดใช้งาน</option>
                        </select>
                    </div>
                </div>
                {filteredTeams.length === 0 ? (
                    <EmptyState
                        compact
                        className="m-4 border-dashed"
                        title={overview.teams.length === 0 ? "ยังไม่มีทีม" : "ไม่พบทีมที่ตรงกับตัวกรอง"}
                        description={overview.teams.length === 0 ? "สร้างทีม เพิ่มสมาชิก และกำหนดหน้าที่ในทีมตามการทำงาน" : "ลองเปลี่ยนคำค้นหาหรือสถานะที่เลือก"}
                        action={overview.teams.length === 0 ? { label: "สร้างทีม", onClick: onCreateTeam, icon: <Plus aria-hidden="true" /> } : undefined}
                    />
                ) : (
                    <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
                        {filteredTeams.map((team) => (
                            <article key={team.id} className={`rounded-xl border px-4 py-4 ${selectedTeamId === team.id ? "border-action-primary-solid bg-action-primary-surface" : "border-border-subtle bg-surface-raised"}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <button type="button" className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onSelectTeam(team.id)}>
                                            <span className="block break-words font-semibold text-content-heading">{team.name}</span>
                                            <span className="mt-1 block text-sm leading-6 text-content-secondary">{team.description || "ยังไม่มีคำอธิบายทีม"}</span>
                                        </button>
                                    </div>
                                    <ActiveStatus isActive={team.isActive} />
                                </div>
                                <dl className="mt-4 border-t border-border-subtle pt-3 text-sm">
                                    <div><dt className="sr-only">สมาชิกและหน้าที่ในทีม</dt><dd className="font-semibold text-content-body">{team.membershipCount} สมาชิก · {team.roleCount} หน้าที่</dd></div>
                                </dl>
                                <Button type="button" variant="outline" size="sm" className="mt-4 w-full sm:w-auto" onClick={() => onSelectTeam(team.id)}>จัดการทีม</Button>
                            </article>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
