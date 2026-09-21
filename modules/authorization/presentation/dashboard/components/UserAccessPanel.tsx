"use client";

import { useMemo, useState, type ReactElement } from "react";
import { AlertCircle, Info, Loader2, Plus, Search, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";
import { formatTeamSummary } from "@/shared/identity/team-presentation";

import { addUserGrant, changeUserSystemRole, removeUserGrant } from "../api";
import {
    getAuthorizationChannelLabel,
    getAuthorizationDomainLabel,
    getEffectiveAccessStateLabel,
    getMutationErrorCopy,
    getRequestId,
} from "../display";
import {
    getAuthorizationScopePresentation,
    getAuthorizationContextPresentation,
    getAuthorizationLimitationPresentation,
    getAuthorizationSourceDescription,
    getAuthorizationSourceLabel,
    getCapabilityPresentation,
} from "../permission-presentation";
import type {
    AuthorizationAdministrationGrantProjectionData,
    AuthorizationAdministrationOverviewData,
    AuthorizationAdministrationUserDetailData,
    AuthorizationAdministrationUserSummaryData,
    AuthorizationCapabilityGrantInput,
    SystemRole,
} from "../types";
import { ConfirmAuthorizationAction, GrantFormDialog } from "./AuthorizationDialogs";
import { AuthorizationStatus, LifecycleStatus } from "./AuthorizationStatus";
import { ConfigurationIssues } from "./ConfigurationIssues";

type EffectiveAccessState = AuthorizationAdministrationUserDetailData["effectiveAccess"][number]["effectiveAuthority"]["state"];
type EffectiveFilter = "ALL" | EffectiveAccessState;
type InvalidResolutionStatus = Extract<
    AuthorizationAdministrationUserDetailData["resolverEffectivePermissionStatus"],
    { readonly status: "INVALID_CONFIGURATION" }
>;
type InvalidEffectiveAccessStatus = Extract<
    AuthorizationAdministrationUserDetailData["effectiveAccessStatus"],
    { readonly status: "INVALID_CONFIGURATION" }
>;

function isAuthorizationInspectionInvalid(
    user: AuthorizationAdministrationUserDetailData,
): boolean {
    return user.resolverEffectivePermissionStatus.status === "INVALID_CONFIGURATION"
        || user.effectiveAccessStatus.status === "INVALID_CONFIGURATION";
}

export function UserAccessPanel({
    user,
    loading,
    error,
    overview,
    query,
    directoryUsers,
    directoryLoading,
    directoryError,
    onQueryChange,
    onSelectUser,
    onSelectTeam,
    onRefresh,
}: {
    readonly user: AuthorizationAdministrationUserDetailData | undefined;
    readonly loading: boolean;
    readonly error: Error | undefined;
    readonly overview: AuthorizationAdministrationOverviewData;
    readonly query: string;
    readonly directoryUsers: readonly AuthorizationAdministrationUserSummaryData[];
    readonly directoryLoading: boolean;
    readonly directoryError: Error | undefined;
    readonly onQueryChange: (query: string) => void;
    readonly onSelectUser: (userId: number) => void;
    readonly onSelectTeam: (teamId: number) => void;
    readonly onRefresh: () => Promise<void>;
}): ReactElement {
    const [grantDialogOpen, setGrantDialogOpen] = useState(false);
    const [systemRoleTarget, setSystemRoleTarget] = useState<SystemRole | null>(null);
    const [pending, setPending] = useState<string | null>(null);
    const inspectionInvalid = user ? isAuthorizationInspectionInvalid(user) : false;

    const revalidate = async (): Promise<boolean> => {
        try {
            await onRefresh();
            return true;
        } catch {
            return false;
        }
    };

    const addGrant = async (input: AuthorizationCapabilityGrantInput): Promise<void> => {
        if (!user) return;
        setPending(`user-grant-add:${input.capabilityKey}:${input.scope}`);
        try {
            try {
                await addUserGrant(user.user.id, input);
            } catch (operationError) {
                await revalidate();
                throw operationError;
            }
            const refreshed = await revalidate();
            toast.success("เพิ่มสิทธิ์เฉพาะบุคคลแล้ว", refreshed ? undefined : {
                description: "บันทึกสำเร็จแล้ว แต่โหลดข้อมูลผู้ใช้ล่าสุดไม่สำเร็จ กรุณากดโหลดใหม่",
            });
            setGrantDialogOpen(false);
        } finally {
            setPending(null);
        }
    };

    const removeGrant = async (grant: AuthorizationAdministrationGrantProjectionData): Promise<void> => {
        if (!user) return;
        setPending(`user-grant-remove:${grant.capabilityKey}:${grant.scope}`);
        try {
            try {
                await removeUserGrant(user.user.id, { capabilityKey: grant.capabilityKey, scope: grant.scope });
            } catch (operationError) {
                await revalidate();
                throw operationError;
            }
            const refreshed = await revalidate();
            toast.success("นำสิทธิ์เฉพาะบุคคลออกแล้ว", refreshed ? undefined : {
                description: "บันทึกสำเร็จแล้ว แต่โหลดข้อมูลผู้ใช้ล่าสุดไม่สำเร็จ กรุณากดโหลดใหม่",
            });
        } finally {
            setPending(null);
        }
    };

    const changeRole = async (nextRole: SystemRole): Promise<void> => {
        if (!user) return;
        setPending(`system-role:${nextRole}`);
        try {
            try {
                await changeUserSystemRole(user.user.id, { systemRole: nextRole });
            } catch (operationError) {
                await revalidate();
                throw operationError;
            }
            const refreshed = await revalidate();
            toast.success(nextRole === "ADMIN" ? "อนุญาตให้จัดการสิทธิ์แล้ว" : "ยกเลิกการเข้าถึงการจัดการสิทธิ์แล้ว", refreshed ? undefined : {
                description: "บันทึกสำเร็จแล้ว แต่โหลดข้อมูลผู้ใช้ล่าสุดไม่สำเร็จ กรุณากดโหลดใหม่",
            });
            setSystemRoleTarget(null);
        } finally {
            setPending(null);
        }
    };

    return (
        <div className="space-y-5">
            <UserDirectorySearch
                query={query}
                users={directoryUsers}
                loading={directoryLoading}
                error={directoryError}
                selectedUserId={user?.user.id ?? null}
                onQueryChange={onQueryChange}
                onSelectUser={onSelectUser}
            />
            {loading && !user ? <LoadingState label="กำลังโหลดสิทธิ์ของผู้ใช้" /> : null}
            {error && !user ? <ErrorState title="โหลดข้อมูลผู้ใช้ไม่สำเร็จ" description="ตรวจสอบผู้ใช้และโหลดข้อมูลล่าสุดอีกครั้ง" action={{ label: "ลองใหม่", onClick: () => void onRefresh() }} /> : null}
            {!user && !loading && !error ? <EmptyState title="เลือกผู้ใช้เพื่อดูสิทธิ์" description="ค้นหาผู้ใช้จากชื่อ อีเมล หรือรหัสผู้ใช้ แล้วเลือกผลลัพธ์" icon={<UserRound className="h-6 w-6" aria-hidden="true" />} /> : null}
            {user ? (
                <div className="space-y-5">
                    {error ? <p role="alert" className="text-sm text-status-warning-strong">ข้อมูลผู้ใช้อาจไม่ใช่ข้อมูลล่าสุด กรุณากดโหลดใหม่</p> : null}
                    <section className="space-y-4 rounded-xl border border-border-subtle bg-surface-subtle/45 p-3 sm:p-4" aria-labelledby="authorization-user-information-heading">
                        <div>
                            <h2 id="authorization-user-information-heading" className="text-base font-semibold text-content-heading">ข้อมูลผู้ใช้งาน</h2>
                            <p className="mt-1 text-sm leading-6 text-content-secondary">ข้อมูลตัวตน สถานะบัญชี และข้อมูลพนักงานที่จำเป็นต่อการจัดการ</p>
                        </div>
                        <UserIdentityPanel user={user} />
                        <SystemRoleControl user={user} busy={pending?.startsWith("system-role:") === true} onRequestChange={setSystemRoleTarget} />
                    </section>
                    <ConfigurationIssues issues={user.configurationIssues} />
                    <MembershipsPanel user={user} onSelectTeam={onSelectTeam} />
                    <EffectiveAccessInspector
                        user={user}
                        pending={pending}
                        onAddGrant={addGrant}
                        onRemoveGrant={removeGrant}
                        onOpenFallbackAdd={() => {
                            if (!isAuthorizationInspectionInvalid(user)) setGrantDialogOpen(true);
                        }}
                    />
                    <GrantFormDialog
                        open={grantDialogOpen && !inspectionInvalid}
                        source="USER"
                        capabilities={overview.capabilities}
                        busy={pending?.startsWith("user-grant-add:") ?? false}
                        onClose={() => setGrantDialogOpen(false)}
                        onSubmit={addGrant}
                    />
                    <ConfirmAuthorizationAction
                        open={systemRoleTarget !== null}
                        title={systemRoleTarget === "ADMIN" ? "อนุญาตให้จัดการสิทธิ์หรือไม่?" : "ยกเลิกการเข้าถึงการจัดการสิทธิ์หรือไม่?"}
                        description={systemRoleTarget === "ADMIN"
                            ? "การตั้งค่านี้อนุญาตให้บัญชีนี้เปิดและจัดการหน้าการจัดการสิทธิ์ ไม่ได้เพิ่มสิทธิ์ในงาน Stock, Leave, Routine หรือโมดูลอื่น บัญชีเป้าหมายต้องพร้อมใช้งาน"
                            : "การยกเลิกจะไม่ลบสมาชิกทีม หน้าที่ในทีม หรือสิทธิ์เฉพาะบุคคล สิทธิ์งานยังคงคำนวณจากแหล่งเดิม"
                        }
                        confirmLabel={systemRoleTarget === "ADMIN" ? "อนุญาตให้จัดการสิทธิ์" : "ยกเลิกการเข้าถึง"}
                        destructive={systemRoleTarget === "USER"}
                        busy={pending?.startsWith("system-role:") === true}
                        onClose={() => setSystemRoleTarget(null)}
                        onConfirm={async () => {
                            if (systemRoleTarget) await changeRole(systemRoleTarget);
                        }}
                    />
                </div>
            ) : null}
        </div>
    );
}

function UserDirectorySearch({
    query,
    users,
    loading,
    error,
    selectedUserId,
    onQueryChange,
    onSelectUser,
}: {
    readonly query: string;
    readonly users: readonly AuthorizationAdministrationUserSummaryData[];
    readonly loading: boolean;
    readonly error: Error | undefined;
    readonly selectedUserId: number | null;
    readonly onQueryChange: (query: string) => void;
    readonly onSelectUser: (userId: number) => void;
}): ReactElement {
    return (
        <section className="rounded-xl border border-border-subtle bg-surface-raised">
            <div className="border-b border-border-subtle px-4 py-4 sm:px-5"><h2 className="text-base font-semibold text-content-heading">ค้นหาผู้ใช้งาน</h2><p className="mt-1 text-sm leading-6 text-content-secondary">ค้นหาผู้ใช้งานเพื่อดูทีม หน้าที่ในทีม และสิทธิ์การทำงาน</p></div>
            <div className="px-4 py-4 sm:px-5"><Label htmlFor="authorization-user-search">ชื่อ อีเมล หรือชื่อพนักงาน</Label><div className="relative mt-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" /><Input id="authorization-user-search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="เช่น somchai@example.com" maxLength={100} className="pl-9" autoComplete="off" /></div></div>
            {error ? <div role="alert" className="border-t border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm text-status-danger-strong sm:px-5"><p>ค้นหาผู้ใช้ไม่สำเร็จ กรุณาลองใหม่</p>{getRequestId(error) ? <p className="mt-1 text-xs">Request ID: {getRequestId(error)}</p> : null}</div> : null}
            {query.trim().length > 0 ? <div className="border-t border-border-subtle" aria-live="polite">{loading ? <div className="flex items-center gap-2 px-4 py-4 text-sm text-content-secondary sm:px-5" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />กำลังค้นหา</div> : users.length === 0 ? <p className="px-4 py-4 text-sm text-content-secondary sm:px-5">ไม่พบผู้ใช้งานที่ตรงกับคำค้น</p> : <div className="divide-y divide-border-subtle">{users.map((item) => <button type="button" key={item.id} onClick={() => onSelectUser(item.id)} aria-pressed={item.id === selectedUserId} className={`flex min-h-16 w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 ${item.id === selectedUserId ? "bg-action-primary-surface" : ""}`}><span className="min-w-0"><span className="block truncate font-semibold text-content-heading">{item.name}</span><span className="mt-0.5 block truncate text-sm text-content-secondary">{item.email}</span><span className="mt-0.5 block text-xs text-content-muted">{item.employee?.displayName ?? "ยังไม่มีข้อมูลพนักงาน"}</span><span className="mt-0.5 block truncate text-xs text-content-secondary">{formatTeamSummary(item.teams)}</span></span><span className="flex shrink-0 flex-col items-end gap-1"><LifecycleStatus isActive={item.isActive} deletedAt={item.deletedAt} /></span></button>)}</div>}</div> : <p className="border-t border-border-subtle px-4 py-3 text-xs leading-5 text-content-muted sm:px-5">พิมพ์คำค้นอย่างน้อย 1 ตัวอักษรเพื่อเริ่มค้นหา</p>}
        </section>
    );
}

function UserIdentityPanel({ user }: { readonly user: AuthorizationAdministrationUserDetailData }): ReactElement {
    const identity = user.user;
    return (
        <section className="rounded-xl border border-border-subtle bg-surface-raised">
            <div className="border-b border-border-subtle px-4 py-4 sm:px-5"><div className="flex flex-wrap items-center gap-2"><h3 className="text-lg font-semibold text-content-heading">{identity.name}</h3><LifecycleStatus isActive={identity.isActive} deletedAt={identity.deletedAt} /></div><p className="mt-1 text-sm text-content-secondary">{identity.email}</p></div>
            {!identity.isActive || identity.deletedAt !== null ? <div className="border-b border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm leading-6 text-status-warning-strong sm:px-5">บัญชีนี้ไม่พร้อมใช้งาน การมีสิทธิ์ในระบบไม่ได้ทำให้ผ่านการตรวจสอบสถานะบัญชีหรือพนักงาน</div> : null}
            <dl className="grid gap-4 px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-3 sm:px-5"><IdentityField label="สถานะบัญชี" value={identity.deletedAt !== null ? "ถูกลบ / ใช้งานไม่ได้" : identity.isActive ? "ใช้งานอยู่" : "ปิดใช้งาน"} /><IdentityField label="พนักงาน" value={identity.employee?.displayName ?? "ไม่เชื่อมกับข้อมูลพนักงาน"} /><IdentityField label="สถานะพนักงาน" value={identity.employee ? getEmployeeStatusLabel(identity.employee.status, identity.employee.deletedAt) : "—"} /></dl>
        </section>
    );
}

function SystemRoleControl({
    user,
    busy,
    onRequestChange,
}: {
    readonly user: AuthorizationAdministrationUserDetailData;
    readonly busy: boolean;
    readonly onRequestChange: (nextRole: SystemRole) => void;
}): ReactElement {
    const isAdmin = user.systemRole === "ADMIN";
    return (
        <section className="rounded-xl border border-border-subtle bg-surface-raised" aria-labelledby="authorization-administration-access-heading">
            <div className="border-b border-border-subtle px-4 py-4 sm:px-5">
                <h3 id="authorization-administration-access-heading" className="text-base font-semibold text-content-heading">การเข้าถึงการจัดการสิทธิ์</h3>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-content-secondary">อนุญาตให้บัญชีนี้เปิดและจัดการหน้าการจัดการสิทธิ์</p>
                <p className="mt-1 max-w-3xl text-sm leading-6 text-content-secondary">การตั้งค่านี้ไม่เพิ่มสิทธิ์ในงาน Stock, Leave, Routine หรือโมดูลอื่น</p>
            </div>
            <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                    <p className="text-xs font-semibold text-content-secondary">สถานะการเข้าถึง</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-content-heading">{isAdmin ? "อนุญาต" : "ไม่ได้อนุญาต"}</p>
                        <AuthorizationStatus tone={isAdmin ? "allow" : "neutral"}>{isAdmin ? "เปิดใช้งาน" : "ปิดอยู่"}</AuthorizationStatus>
                    </div>
                </div>
                <Button
                    type="button"
                    variant={isAdmin ? "destructive" : "default"}
                    size="sm"
                    onClick={() => onRequestChange(isAdmin ? "USER" : "ADMIN")}
                    disabled={busy}
                >
                    {isAdmin ? "ยกเลิกการเข้าถึง" : "อนุญาตให้จัดการสิทธิ์"}
                </Button>
            </div>
        </section>
    );
}

function MembershipsPanel({ user, onSelectTeam }: { readonly user: AuthorizationAdministrationUserDetailData; readonly onSelectTeam: (teamId: number) => void }): ReactElement {
    return <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised"><div className="border-b border-border-subtle px-4 py-4 sm:px-5"><h3 className="text-base font-semibold text-content-heading">ทีม</h3><p className="mt-1 text-sm leading-6 text-content-secondary">สมาชิกทีมและหน้าที่ในทีมของผู้ใช้งาน</p></div>{user.teamMemberships.length === 0 ? <p className="px-4 py-8 text-center text-sm text-content-secondary sm:px-5">ยังไม่กำหนดทีม</p> : <div className="overflow-x-auto"><table className="min-w-[680px] w-full text-left text-sm"><caption className="sr-only">ทีมที่ {user.user.name} อยู่</caption><thead className="border-b border-border-subtle bg-surface-subtle text-xs font-semibold text-content-secondary"><tr><th scope="col" className="px-4 py-3 sm:px-5">ทีม</th><th scope="col" className="px-4 py-3">หน้าที่ในทีม</th><th scope="col" className="px-4 py-3">สถานะ</th></tr></thead><tbody className="divide-y divide-border-subtle">{user.teamMemberships.map((membership) => <tr key={`${membership.teamId}:${membership.userId}`}><td className="px-4 py-3 sm:px-5"><Button type="button" variant="link" size="sm" className="h-auto min-h-0 p-0 text-left font-semibold text-action-primary-foreground" onClick={() => onSelectTeam(membership.teamId)}>{membership.team.name}</Button></td><td className="px-4 py-3">{membership.teamRole ? <span><span className="font-semibold text-content-body">หน้าที่ในทีม: </span>{membership.teamRole.name}</span> : <span className="text-content-secondary">ไม่มีหน้าที่เฉพาะ</span>}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1"><LifecycleEntityStatus isActive={membership.team.isActive} />{membership.teamRole ? <LifecycleEntityStatus isActive={membership.teamRole.isActive} /> : null}</div></td></tr>)}</tbody></table></div>}</section>;
}

function EffectiveAccessInspector({
    user,
    pending,
    onAddGrant,
    onRemoveGrant,
    onOpenFallbackAdd,
}: {
    readonly user: AuthorizationAdministrationUserDetailData;
    readonly pending: string | null;
    readonly onAddGrant: (input: AuthorizationCapabilityGrantInput) => Promise<void>;
    readonly onRemoveGrant: (grant: AuthorizationAdministrationGrantProjectionData) => Promise<void>;
    readonly onOpenFallbackAdd: () => void;
}): ReactElement {
    const [filter, setFilter] = useState<EffectiveFilter>("ALL");
    const [domain, setDomain] = useState("ALL");
    const domains = useMemo(() => [...new Set(user.effectiveAccess.map((item) => item.capability.domain))].sort(), [user.effectiveAccess]);
    const rows = useMemo(() => user.effectiveAccess.filter((row) => (filter === "ALL" || row.effectiveAuthority.state === filter) && (domain === "ALL" || row.capability.domain === domain)), [domain, filter, user.effectiveAccess]);
    const groups = useMemo(() => {
        const grouped = new Map<string, { readonly capability: AuthorizationAdministrationUserDetailData["effectiveAccess"][number]["capability"]; readonly rows: AuthorizationAdministrationUserDetailData["effectiveAccess"][number][] }>();
        for (const row of rows) {
            const existing = grouped.get(row.capability.key);
            if (existing) existing.rows.push(row);
            else grouped.set(row.capability.key, { capability: row.capability, rows: [row] });
        }
        return [...grouped.values()].sort((left, right) => {
            const domainOrder = getAuthorizationDomainLabel(left.capability.domain).localeCompare(getAuthorizationDomainLabel(right.capability.domain), "th");
            if (domainOrder !== 0) return domainOrder;
            const leftLabel = getCapabilityPresentation(left.capability.key)?.actionLabel ?? left.capability.key;
            const rightLabel = getCapabilityPresentation(right.capability.key)?.actionLabel ?? right.capability.key;
            return leftLabel.localeCompare(rightLabel, "th");
        });
    }, [rows]);
    const domainGroups = useMemo(() => {
        const grouped = new Map<string, Array<(typeof groups)[number]>>();
        for (const group of groups) {
            const domainGroups = grouped.get(group.capability.domain);
            if (domainGroups) domainGroups.push(group);
            else grouped.set(group.capability.domain, [group]);
        }
        return [...grouped.entries()]
            .sort((left, right) => getAuthorizationDomainLabel(left[0]).localeCompare(getAuthorizationDomainLabel(right[0]), "th"))
            .map(([domain, capabilities]) => ({ domain, capabilities }));
    }, [groups]);
    const rawStatus = user.resolverEffectivePermissionStatus;
    const effectiveStatus = user.effectiveAccessStatus;
    const inspectionInvalid = isAuthorizationInspectionInvalid(user);
    return (
        <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
            <div className="border-b border-border-subtle px-4 py-4 sm:px-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-action-primary-foreground" aria-hidden="true" /><div><h3 className="text-base font-semibold text-content-heading">สิทธิ์ที่ใช้งานได้</h3><p className="mt-1 max-w-4xl text-sm leading-6 text-content-secondary">ดูความสามารถของผู้ใช้นี้ แหล่งที่มา และปรับสิทธิ์เฉพาะบุคคลได้จากความสามารถเดียวกัน</p><p className="mt-2 text-xs leading-5 text-content-muted">สิทธิ์นี้เป็นขอบเขตการใช้งานโดยรวม การทำรายการจริงยังขึ้นอยู่กับเจ้าของข้อมูล ผู้รับผิดชอบ สถานะรายการ และขั้นตอนการทำงาน</p></div></div>{!inspectionInvalid ? <Button type="button" size="sm" variant="outline" onClick={onOpenFallbackAdd} disabled={pending !== null}><Plus aria-hidden="true" />เพิ่มสิทธิ์อื่น</Button> : null}</div></div>
            {rawStatus.status === "INVALID_CONFIGURATION" ? <InvalidResolutionState error={rawStatus.error} /> : effectiveStatus.status === "INVALID_CONFIGURATION" ? <InvalidEffectiveAccessState error={effectiveStatus.error} /> : <>
                <div className="grid gap-3 border-b border-border-subtle bg-surface-subtle/60 px-4 py-3 md:grid-cols-[12rem_15rem] sm:px-5"><div><Label htmlFor="authorization-effective-filter">สถานะสิทธิ์</Label><select id="authorization-effective-filter" value={filter} onChange={(event) => setFilter(event.target.value as EffectiveFilter)} className="mt-2 h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><option value="ALL">ทั้งหมด</option><option value="AVAILABLE">ใช้งานได้</option><option value="UNAVAILABLE">ยังไม่มีสิทธิ์</option><option value="UNSUPPORTED">ช่องทางนี้ไม่รองรับ</option><option value="DEFERRED">ยังไม่เปิดให้จัดการ</option></select></div><div><Label htmlFor="authorization-effective-domain">หมวดงาน</Label><select id="authorization-effective-domain" value={domain} onChange={(event) => setDomain(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><option value="ALL">ทุกหมวดงาน</option>{domains.map((item) => <option key={item} value={item}>{getAuthorizationDomainLabel(item)}</option>)}</select></div></div>
                {groups.length === 0 ? <p className="px-4 py-8 text-center text-sm text-content-secondary sm:px-5">ไม่พบสิทธิ์ตามตัวกรองนี้</p> : <div className="grid gap-4 px-3 py-4 sm:px-4">{domainGroups.map((domainGroup) => <section key={domainGroup.domain} aria-labelledby={`effective-capability-domain-${domainGroup.domain}`} className="rounded-xl border border-border-subtle bg-surface-subtle/60 p-2 sm:p-3"><div className="flex items-center justify-between gap-3 px-2 pb-2"><h4 id={`effective-capability-domain-${domainGroup.domain}`} className="text-sm font-semibold text-content-heading">{getAuthorizationDomainLabel(domainGroup.domain)}</h4><span className="shrink-0 text-xs text-content-secondary">{domainGroup.capabilities.length} ความสามารถ</span></div><div className="space-y-3">{domainGroup.capabilities.map((group) => <EffectiveAccessCapabilityCard key={group.capability.key} group={group} directGrants={user.directGrants.filter((grant) => grant.capabilityKey === group.capability.key)} pending={pending} onAddGrant={onAddGrant} onRemoveGrant={onRemoveGrant} />)}</div></section>)}</div>}
            </>}
        </section>
    );
}

type EffectiveAccessRow = AuthorizationAdministrationUserDetailData["effectiveAccess"][number];

function EffectiveAccessCapabilityCard({
    group,
    directGrants,
    pending,
    onAddGrant,
    onRemoveGrant,
}: {
    readonly group: { readonly capability: EffectiveAccessRow["capability"]; readonly rows: readonly EffectiveAccessRow[] };
    readonly directGrants: readonly AuthorizationAdministrationGrantProjectionData[];
    readonly pending: string | null;
    readonly onAddGrant: (input: AuthorizationCapabilityGrantInput) => Promise<void>;
    readonly onRemoveGrant: (grant: AuthorizationAdministrationGrantProjectionData) => Promise<void>;
}): ReactElement {
    const [editing, setEditing] = useState(false);
    const presentation = getCapabilityPresentation(group.capability.key);
    const isGrantable = group.capability.administrativelyGrantable;
    return (
        <article className="rounded-xl border border-border-subtle bg-surface-raised" aria-labelledby={`effective-capability-${group.capability.key}`} data-testid={`effective-capability-card-${group.capability.key}`}>
            <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h5 id={`effective-capability-${group.capability.key}`} className="text-base font-semibold text-content-heading">{presentation?.actionLabel ?? "สิทธิ์ที่ต้องตรวจสอบ"}</h5><AuthorizationStatus tone="neutral">{group.rows.length} บริบทการใช้งาน</AuthorizationStatus></div><p className="mt-1 text-sm leading-6 text-content-secondary">{presentation?.description ?? group.capability.description}</p></div>
                {isGrantable ? <span className="text-xs leading-5 text-content-muted">ปรับสิทธิ์เฉพาะบุคคลได้จากการ์ดนี้</span> : <span className="text-xs leading-5 text-content-muted">{group.capability.administrativeStatus === "DEFERRED" ? "สิทธิ์นี้ยังไม่เปิดให้จัดการ" : "สิทธิ์นี้ยังไม่เปิดให้แก้ไขจากหน้านี้"}</span>}
            </div>
            <div className="space-y-3 px-4 py-4">
                {group.rows.map((row) => <EffectiveAccessContextRow key={`${row.capability.key}:${row.context.key}`} row={row} />)}
                {isGrantable ? editing ? <InlineUserGrantEditor capability={group.capability} rows={group.rows} directGrants={directGrants} pending={pending} onAddGrant={onAddGrant} onRemoveGrant={onRemoveGrant} onClose={() => setEditing(false)} /> : <DirectUserGrantSummary capability={group.capability} directGrants={directGrants} disabled={pending !== null} onEdit={() => setEditing(true)} /> : null}
            </div>
        </article>
    );
}

function DirectUserGrantSummary({
    capability,
    directGrants,
    disabled,
    onEdit,
}: {
    readonly capability: EffectiveAccessRow["capability"];
    readonly directGrants: readonly AuthorizationAdministrationGrantProjectionData[];
    readonly disabled: boolean;
    readonly onEdit: () => void;
}): ReactElement {
    const validDirectGrants = directGrants.filter((grant) => grant.validation.status === "VALID");
    const scopes = validDirectGrants.map((grant) => getAuthorizationScopePresentation(grant.scope, capability.key).label);
    return (
        <section className="rounded-xl border border-action-primary-solid/35 bg-action-primary-surface/45 px-3 py-3" aria-labelledby={`personal-grant-${capability.key}`}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h6 id={`personal-grant-${capability.key}`} className="text-sm font-semibold text-content-heading">สิทธิ์เฉพาะบุคคล</h6>
                    {validDirectGrants.length === 0 ? <p className="mt-1 text-sm leading-6 text-content-secondary">ยังไม่มีสิทธิ์เฉพาะบุคคล</p> : <><p className="mt-1 text-sm leading-6 text-content-secondary">มี {validDirectGrants.length} ขอบเขตที่เพิ่มไว้</p><p className="mt-1 text-xs leading-5 text-content-secondary">{scopes.join(" · ")}</p></>}
                </div>
                <Button type="button" variant="outline" size="sm" onClick={onEdit} disabled={disabled} aria-expanded={false} aria-controls={`personal-grant-editor-${capability.key}`}>ปรับสิทธิ์เฉพาะบุคคล</Button>
            </div>
        </section>
    );
}

function EffectiveAccessContextRow({ row }: { readonly row: EffectiveAccessRow }): ReactElement {
    const contextPresentation = getAuthorizationContextPresentation(row.context.key);
    const stateTone = row.effectiveAuthority.state === "AVAILABLE" ? "allow" : row.effectiveAuthority.state === "UNAVAILABLE" ? "deny" : row.effectiveAuthority.state === "DEFERRED" ? "deferred" : "neutral";
    return (
        <article className="rounded-lg border border-border-subtle bg-surface-subtle/35 px-3 py-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><h6 className="text-sm font-semibold text-content-heading">{contextPresentation.label}</h6><p className="mt-1 text-xs leading-5 text-content-secondary">{contextPresentation.description}</p></div><div className="flex flex-wrap gap-2 lg:justify-end"><AuthorizationStatus tone={stateTone}>{getEffectiveAccessStateLabel(row.effectiveAuthority.state)}</AuthorizationStatus><AuthorizationStatus tone="neutral">{getAuthorizationChannelLabel(row.context.channel)}</AuthorizationStatus></div></div>
            <div className="mt-3 grid gap-3 md:grid-cols-3"><AuthorityCard label="สิทธิ์พื้นฐาน" detail="สิทธิ์พื้นฐานของระบบ" scopes={row.defaultAuthority.scopes} capabilityKey={row.capability.key} /><AuthorityCard label="สิทธิ์ที่เพิ่มให้" detail="สิทธิ์เพิ่มเติมจากทีม หน้าที่ในทีม หรือบุคคล" scopes={row.additionalAuthority.scopes} capabilityKey={row.capability.key} /><AuthorityCard label="สิทธิ์ที่ใช้งานได้" detail="ขอบเขตโดยรวมก่อนตรวจสอบรายการจริง" scopes={row.effectiveAuthority.scopes} capabilityKey={row.capability.key} state={row.effectiveAuthority.state} /></div>
            {row.effectiveAuthority.redundant ? <p className="mt-3 rounded-md border border-status-warning-border bg-status-warning-surface px-3 py-2 text-sm leading-6 text-status-warning-strong">สิทธิ์นี้ไม่ได้เพิ่มการเข้าถึงในขณะนี้ ผู้ใช้นี้มีขอบเขตเดียวกันจากแหล่งอื่นอยู่แล้ว</p> : null}
            <SourceDisclosure defaultScopes={row.defaultAuthority.scopes} grants={row.additionalAuthority.grants} />
            <LimitationPresentation limitations={row.limitations} />
        </article>
    );
}

function InlineUserGrantEditor({
    capability,
    rows,
    directGrants,
    pending,
    onAddGrant,
    onRemoveGrant,
    onClose,
}: {
    readonly capability: EffectiveAccessRow["capability"];
    readonly rows: readonly EffectiveAccessRow[];
    readonly directGrants: readonly AuthorizationAdministrationGrantProjectionData[];
    readonly pending: string | null;
    readonly onAddGrant: (input: AuthorizationCapabilityGrantInput) => Promise<void>;
    readonly onRemoveGrant: (grant: AuthorizationAdministrationGrantProjectionData) => Promise<void>;
    readonly onClose: () => void;
}): ReactElement {
    const [selectedScope, setSelectedScope] = useState("");
    const [reviewScope, setReviewScope] = useState<string | null>(null);
    const [removeTarget, setRemoveTarget] = useState<AuthorizationAdministrationGrantProjectionData | null>(null);
    const [error, setError] = useState<unknown>(null);
    const validDirectGrants = useMemo(() => directGrants.filter((grant) => grant.validation.status === "VALID"), [directGrants]);
    const persistedScopes = useMemo(() => new Set(validDirectGrants.map((grant) => grant.scope)), [validDirectGrants]);
    const availableScopes = useMemo(() => capability.supportedScopes.filter((scope) => scope !== "TEAM" && !persistedScopes.has(scope)), [capability.supportedScopes, persistedScopes]);
    const effectiveSelectedScope = availableScopes.some((scope) => scope === selectedScope)
        ? selectedScope
        : availableScopes[0] ?? "";
    const cardBusy = pending?.startsWith(`user-grant-add:${capability.key}:`) === true || pending?.startsWith(`user-grant-remove:${capability.key}:`) === true;

    const confirmAdd = async (): Promise<void> => {
        if (!reviewScope) return;
        setError(null);
        try {
            await onAddGrant({ capabilityKey: capability.key, scope: reviewScope });
            setReviewScope(null);
        } catch (reason) {
            setError(reason);
        }
    };

    const actionLabel = getCapabilityPresentation(capability.key)?.actionLabel ?? "สิทธิ์ที่ต้องตรวจสอบ";
    return (
        <section id={`personal-grant-editor-${capability.key}`} className="rounded-xl border border-action-primary-solid/35 bg-action-primary-surface/45 px-3 py-3" aria-labelledby={`personal-grant-${capability.key}`}>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"><div><h6 id={`personal-grant-${capability.key}`} className="text-sm font-semibold text-content-heading">สิทธิ์เฉพาะบุคคล</h6><p className="mt-1 text-xs leading-5 text-content-secondary">ใช้เป็นข้อยกเว้นเฉพาะผู้ใช้นี้ โดยปกติควรจัดสิทธิ์ผ่านทีมหรือหน้าที่ในทีม</p></div><Button type="button" variant="ghost" size="xs" onClick={onClose} disabled={cardBusy}>ปิดการแก้ไข</Button></div>
            <div className="mt-3 rounded-lg border border-border-subtle bg-surface-raised px-3 py-3"><p className="text-xs font-semibold text-content-secondary">สิทธิ์ที่ใช้งานได้ตอนนี้</p><ul className="mt-2 grid gap-2 sm:grid-cols-2">{rows.map((row) => <li key={`${row.context.key}:${row.effectiveAuthority.state}`} className="text-sm"><p className="font-semibold text-content-heading">{getAuthorizationContextPresentation(row.context.key).label}</p><p className="text-xs leading-5 text-content-secondary">{row.effectiveAuthority.scopes.length === 0 ? "ยังไม่มีสิทธิ์ในบริบทนี้" : row.effectiveAuthority.scopes.map((scope) => getAuthorizationScopePresentation(scope, capability.key).label).join(" · ")}</p></li>)}</ul></div>
            <div className="mt-3 rounded-lg border border-border-subtle bg-surface-raised px-3 py-3"><p className="text-xs font-semibold text-content-secondary">สิทธิ์เฉพาะบุคคลที่เพิ่มไว้</p>{validDirectGrants.length === 0 ? <p className="mt-2 text-sm text-content-secondary">ยังไม่มีสิทธิ์เฉพาะบุคคลสำหรับความสามารถนี้</p> : <ul className="mt-2 grid gap-2">{validDirectGrants.map((grant) => { const scope = getAuthorizationScopePresentation(grant.scope, capability.key); return <li key={`${grant.capabilityKey}:${grant.scope}`} className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-surface-subtle/45 px-3 py-2 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-content-heading">{scope.label}</p><p className="text-xs leading-5 text-content-secondary">ผู้ใช้รายนี้ได้รับสิทธิ์นี้โดยเฉพาะ</p></div><Button type="button" variant="outline" size="xs" onClick={() => { setError(null); setRemoveTarget(grant); }} disabled={cardBusy} aria-label={`นำสิทธิ์เฉพาะบุคคล ${actionLabel} ${scope.label} ออก`}><Trash2 aria-hidden="true" />นำออก</Button></li>; })}</ul>}</div>
            {availableScopes.length > 0 ? <fieldset className="mt-3 space-y-2"><legend className="text-xs font-semibold text-content-secondary">เพิ่มขอบเขต</legend>{availableScopes.map((scope) => { const presentation = getAuthorizationScopePresentation(scope, capability.key); return <label key={scope} className={`flex cursor-pointer gap-3 rounded-lg border bg-surface-raised px-3 py-2 transition-colors ${effectiveSelectedScope === scope ? "border-action-primary-solid ring-1 ring-action-primary-solid/30" : "border-border-subtle"}`}><input type="radio" name={`personal-scope-${capability.key}`} value={scope} checked={effectiveSelectedScope === scope} onChange={() => setSelectedScope(scope)} disabled={cardBusy} className="mt-1 h-4 w-4 accent-action-primary-solid" /><span><span className="block text-sm font-semibold text-content-heading">{presentation.label}</span><span className="block text-xs leading-5 text-content-secondary">{presentation.description}</span></span></label>; })}</fieldset> : <p className="mt-3 text-sm text-content-secondary">ไม่มีขอบเขตเพิ่มเติมที่พร้อมให้เพิ่มสำหรับผู้ใช้นี้</p>}
            {availableScopes.length > 0 && reviewScope === null ? <Button type="button" className="mt-3" size="sm" onClick={() => { setError(null); setReviewScope(effectiveSelectedScope); }} disabled={cardBusy || !effectiveSelectedScope}><Plus aria-hidden="true" />เพิ่มสิทธิ์</Button> : null}
            {reviewScope !== null ? <div className="mt-3 rounded-lg border border-action-primary-solid/45 bg-surface-raised px-3 py-3" aria-live="polite"><p className="text-sm font-semibold text-content-heading">กำลังเพิ่มสิทธิ์เฉพาะบุคคล</p><dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2"><div><dt className="text-content-secondary">ความสามารถ</dt><dd className="mt-1 font-semibold text-content-heading">{actionLabel}</dd></div><div><dt className="text-content-secondary">ขอบเขต</dt><dd className="mt-1 font-semibold text-content-heading">{getAuthorizationScopePresentation(reviewScope, capability.key).label}</dd></div></dl><div className="mt-3 flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" onClick={() => setReviewScope(null)} disabled={cardBusy}>ยกเลิก</Button><Button type="button" onClick={() => void confirmAdd()} disabled={cardBusy} aria-busy={cardBusy}>{cardBusy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}{cardBusy ? "กำลังบันทึก" : "ยืนยันเพิ่มสิทธิ์"}</Button></div></div> : null}
            {error ? <InlineMutationError error={error} /> : null}
            <ConfirmAuthorizationAction open={removeTarget !== null} title="นำสิทธิ์เฉพาะบุคคลออกหรือไม่?" description={removeTarget ? removalDescription(removeTarget, actionLabel) : ""} confirmLabel="นำสิทธิ์ออก" destructive busy={cardBusy} onClose={() => setRemoveTarget(null)} onConfirm={async () => { if (!removeTarget) return; await onRemoveGrant(removeTarget); setRemoveTarget(null); }} />
        </section>
    );
}

function InlineMutationError({ error }: { readonly error: unknown }): ReactElement {
    const copy = getMutationErrorCopy(error);
    const requestId = getRequestId(error);
    return <div role="alert" className="mt-3 rounded-lg border border-status-danger-border bg-status-danger-surface px-3 py-3 text-sm text-status-danger-strong"><p className="font-semibold">{copy.title}</p><p className="mt-1 leading-6">{copy.description}</p>{requestId ? <p className="mt-1 text-xs">Request ID: {requestId}</p> : null}</div>;
}

function AuthorityCard({ label, detail, scopes, capabilityKey, state }: { readonly label: string; readonly detail: string; readonly scopes: readonly string[]; readonly capabilityKey: string; readonly state?: EffectiveAccessState }): ReactElement {
    return <div className="rounded-lg border border-border-subtle bg-surface-subtle/50 px-3 py-3"><p className="text-xs font-semibold text-content-secondary">{label}</p><p className="mt-1 text-xs leading-5 text-content-muted">{detail}</p>{state ? <p className="mt-2"><AuthorizationStatus tone={state === "AVAILABLE" ? "allow" : state === "UNAVAILABLE" ? "deny" : state === "DEFERRED" ? "deferred" : "neutral"}>{getEffectiveAccessStateLabel(state)}</AuthorizationStatus></p> : null}{scopes.length === 0 ? <p className="mt-2 text-sm text-content-muted">ไม่มีขอบเขตที่ใช้งานได้</p> : <ul className="mt-2 space-y-2">{scopes.map((scope) => { const presentation = getAuthorizationScopePresentation(scope, capabilityKey); return <li key={scope}><p className="text-sm font-semibold text-content-heading">{presentation.label}</p><p className="text-xs leading-5 text-content-secondary">{presentation.description}</p></li>; })}</ul>}</div>;
}

function SourceDisclosure({ defaultScopes, grants }: { readonly defaultScopes: readonly string[]; readonly grants: readonly AuthorizationAdministrationUserDetailData["effectiveAccess"][number]["additionalAuthority"]["grants"][number][] }): ReactElement | null {
    if (defaultScopes.length === 0 && grants.length === 0) return null;
    return <div className="mt-3 rounded-lg border border-border-subtle bg-surface-raised px-3 py-3"><p className="text-sm font-semibold text-content-secondary">ที่มาของสิทธิ์</p><ul className="mt-2 grid gap-2 md:grid-cols-2">{defaultScopes.length > 0 ? <li className="rounded-lg border border-border-subtle bg-surface-subtle/45 px-3 py-2 text-sm leading-6"><p className="font-semibold text-content-heading">สิทธิ์พื้นฐานของระบบ</p><p className="text-xs text-content-secondary">สิทธิ์พื้นฐานที่ระบบกำหนดให้ตามบริบทนี้</p></li> : null}{grants.map((grant, index) => <li key={`${grant.origin.type}-${grant.scope}-${index}`} className="rounded-lg border border-border-subtle bg-surface-subtle/45 px-3 py-2 text-sm leading-6"><p className="font-semibold text-content-heading">{getSourceOriginLabel(grant.origin)}</p><p className="text-xs text-content-secondary">{getAuthorizationSourceDescription(grant.origin.type)}</p></li>)}</ul></div>;
}

function LimitationPresentation({ limitations }: { readonly limitations: readonly EffectiveAccessRow["limitations"][number][] }): ReactElement | null {
    if (limitations.length === 0) return null;
    return <div className="mt-3 border-t border-border-subtle pt-3"><p className="text-sm font-semibold text-content-secondary">เงื่อนไขการใช้งาน</p><ul className="mt-2 grid gap-2 text-sm leading-6 text-content-secondary">{limitations.map((limitation) => { const presentation = getAuthorizationLimitationPresentation(limitation.code); return <li key={limitation.code}><p className="font-semibold text-content-heading">{presentation.label}</p><p className="text-xs leading-5 text-content-secondary">{presentation.description}</p></li>; })}</ul></div>;
}

function removalDescription(grant: AuthorizationAdministrationGrantProjectionData, actionLabel: string): string {
    const scope = getAuthorizationScopePresentation(grant.scope, grant.capabilityKey);
    return `นำสิทธิ์เฉพาะบุคคล "${actionLabel} · ${scope.label}" ออกจากผู้ใช้รายนี้หรือไม่? สิทธิ์พื้นฐาน หรือสิทธิ์จากทีม/หน้าที่ในทีมอาจยังทำให้ผู้ใช้นี้เข้าถึงรายการนี้ได้`;
}

function InvalidResolutionState({ error: _error }: { readonly error: InvalidResolutionStatus["error"] }): ReactElement {
    return <div role="alert" className="border-b border-status-danger-border bg-status-danger-surface px-4 py-5 text-status-danger-strong sm:px-5"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div><h4 className="font-semibold">พบการตั้งค่าสิทธิ์ที่ต้องตรวจสอบ</h4><p className="mt-1 text-sm leading-6">บางสิทธิ์ของผู้ใช้นี้ไม่สามารถนำมาใช้งานได้อย่างปลอดภัย ระบบจึงไม่แสดงผลแบบอนุญาตโดยอัตโนมัติ</p></div></div></div>;
}

function InvalidEffectiveAccessState({ error: _error }: { readonly error: InvalidEffectiveAccessStatus["error"] }): ReactElement {
    return <div role="alert" className="border-b border-status-danger-border bg-status-danger-surface px-4 py-5 text-status-danger-strong sm:px-5"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div><h4 className="font-semibold">พบการตั้งค่าสิทธิ์ที่ต้องตรวจสอบ</h4><p className="mt-1 text-sm leading-6">บางสิทธิ์ของผู้ใช้นี้ไม่สามารถนำมาใช้งานได้อย่างปลอดภัย ระบบจึงคงสถานะผิดปกติไว้</p></div></div></div>;
}

function getSourceOriginLabel(origin: AuthorizationAdministrationUserDetailData["resolverEffectivePermissions"][number]["grants"][number]["origin"]): string {
    switch (origin.type) {
        case "TEAM": return origin.team?.name ? `จากทีม ${origin.team.name}` : "จากทีมที่ต้องตรวจสอบ";
        case "TEAM_ROLE": return origin.teamRole?.name
            ? `จากหน้าที่ "${origin.teamRole.name}"${origin.team?.name ? ` ในทีม ${origin.team.name}` : ""}`
            : "จากหน้าที่ในทีมที่ต้องตรวจสอบ";
        case "USER": return getAuthorizationSourceLabel("USER");
    }
}

function IdentityField({ label, value }: { readonly label: string; readonly value: string }): ReactElement { return <div><dt className="text-xs text-content-secondary">{label}</dt><dd className="mt-1 break-words text-content-body">{value}</dd></div>; }
function LifecycleEntityStatus({ isActive }: { readonly isActive: boolean }): ReactElement { return <AuthorizationStatus tone={isActive ? "active" : "inactive"}>{isActive ? "ใช้งานอยู่" : "ปิดใช้งาน"}</AuthorizationStatus>; }

function getEmployeeStatusLabel(status: string, deletedAt: Date | string | null): string {
    if (deletedAt !== null) return "ข้อมูลพนักงานถูกลบ";
    switch (status) {
        case "ACTIVE":
            return "พนักงานใช้งานอยู่";
        case "INACTIVE":
            return "พนักงานปิดใช้งาน";
        case "SUSPENDED":
            return "พนักงานถูกระงับ";
        default:
            return "ต้องตรวจสอบสถานะพนักงาน";
    }
}
