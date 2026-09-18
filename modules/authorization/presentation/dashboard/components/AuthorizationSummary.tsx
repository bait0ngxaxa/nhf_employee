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
                description="ไม่สามารถอ่านกลุ่มผู้ใช้งานและรายการสิทธิ์ได้ในขณะนี้"
                action={{ label: "ลองใหม่", onClick: onRefresh, icon: <RefreshCw aria-hidden="true" /> }}
            />
        );
    }
    if (!overview) return <EmptyState title="ไม่พบข้อมูลการจัดการสิทธิ์" />;

    return (
        <div className="space-y-5">
            <section aria-label="สรุปการจัดการสิทธิ์" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <SummaryMetric label="สิทธิ์ในระบบ" value={overview.summary.registeredCapabilityCount} detail="รายการที่ระบบรองรับ" />
                <SummaryMetric label="สิทธิ์ที่เพิ่มได้" value={overview.summary.administrativelyGrantableCapabilityCount} detail="พร้อมกำหนดให้กลุ่มหรือบุคคล" tone="positive" />
                <SummaryMetric label="รอตรวจสอบ" value={overview.summary.policyActivationRequiredCapabilityCount} detail="ยังไม่พร้อมให้จัดการ" tone="warning" />
                <SummaryMetric label="ยังไม่เปิดให้จัดการ" value={overview.summary.deferredCapabilityCount} detail="แสดงในข้อมูลขั้นสูง" />
                <SummaryMetric label="กลุ่มที่ใช้งาน" value={`${overview.summary.activeTeamCount}/${overview.summary.teamCount}`} detail="ใช้งานอยู่ / ทั้งหมด" tone="primary" />
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
                        <h2 className="text-base font-semibold text-content-heading">กลุ่มผู้ใช้งาน</h2>
                        <p className="mt-1 text-sm leading-6 text-content-secondary">รวมผู้ใช้ที่ควรได้รับสิทธิ์ร่วมกัน และแยกบทบาทตามหน้าที่การทำงาน</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={onRefresh} disabled={loading} aria-busy={loading}>
                            <RefreshCw className={loading ? "animate-spin" : ""} aria-hidden="true" />
                            โหลดใหม่
                        </Button>
                        <Button type="button" size="sm" onClick={onCreateTeam}>
                            <Plus aria-hidden="true" />
                            สร้างกลุ่มผู้ใช้งาน
                        </Button>
                    </div>
                </div>
                <div className="flex flex-col gap-3 border-b border-border-subtle bg-surface-subtle/60 px-4 py-3 sm:flex-row sm:items-end sm:px-5">
                    <div className="min-w-0 flex-1 space-y-2">
                        <Label htmlFor="authorization-team-search">ค้นหากลุ่ม</Label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
                            <Input id="authorization-team-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ชื่อกลุ่ม" className="pl-9" />
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
                        title={overview.teams.length === 0 ? "ยังไม่มีกลุ่มผู้ใช้งาน" : "ไม่พบกลุ่มที่ตรงกับตัวกรอง"}
                        description={overview.teams.length === 0 ? "เริ่มต้นโดย 1) สร้างกลุ่มตามหน้าที่การทำงาน 2) เพิ่มสมาชิก 3) สร้างบทบาทหากหน้าที่ต่างกัน 4) เพิ่มสิทธิ์ที่จำเป็น" : "ลองเปลี่ยนคำค้นหาหรือสถานะที่เลือก"}
                        action={overview.teams.length === 0 ? { label: "สร้างกลุ่มผู้ใช้งาน", onClick: onCreateTeam, icon: <Plus aria-hidden="true" /> } : undefined}
                    />
                ) : (
                    <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-3">
                        {filteredTeams.map((team) => (
                            <article key={team.id} className={`rounded-xl border px-4 py-4 ${selectedTeamId === team.id ? "border-action-primary-solid bg-action-primary-surface" : "border-border-subtle bg-surface-raised"}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <button type="button" className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onSelectTeam(team.id)}>
                                            <span className="block break-words font-semibold text-content-heading">{team.name}</span>
                                            <span className="mt-1 block text-sm leading-6 text-content-secondary">{team.description || "ยังไม่มีคำอธิบายกลุ่ม"}</span>
                                        </button>
                                        <details className="mt-2 text-xs">
                                            <summary className="cursor-pointer text-content-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">รหัสทางเทคนิค</summary>
                                            <span className="mt-1 block break-all font-mono text-content-muted">{team.key}</span>
                                        </details>
                                    </div>
                                    <ActiveStatus isActive={team.isActive} />
                                </div>
                                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border-subtle pt-3 text-sm">
                                    <div><dt className="text-xs text-content-secondary">บทบาท</dt><dd className="mt-1 font-semibold tabular-nums text-content-body">{team.roleCount}</dd></div>
                                    <div><dt className="text-xs text-content-secondary">สมาชิก</dt><dd className="mt-1 font-semibold tabular-nums text-content-body">{team.membershipCount}</dd></div>
                                    <div><dt className="text-xs text-content-secondary">สิทธิ์</dt><dd className="mt-1 font-semibold tabular-nums text-content-body">{team.teamGrantCount}</dd></div>
                                </dl>
                                <p className="mt-3 text-xs text-content-secondary">ปรับปรุงล่าสุด {formatAuthorizationDate(team.updatedAt)}</p>
                                <Button type="button" variant="outline" size="sm" className="mt-4 w-full sm:w-auto" onClick={() => onSelectTeam(team.id)}>ดูรายละเอียด</Button>
                            </article>
                        ))}
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
