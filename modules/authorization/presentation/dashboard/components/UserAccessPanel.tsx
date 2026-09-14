"use client";

import { useMemo, useState, type ReactElement } from "react";
import { AlertCircle, Info, Loader2, Search, UserRound } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";

import { addUserGrant, removeUserGrant } from "../api";
import { GrantFormDialog } from "./AuthorizationDialogs";
import { AuthorizationStatus, LifecycleStatus } from "./AuthorizationStatus";
import { ConfigurationIssues } from "./ConfigurationIssues";
import { GrantList } from "./GrantList";
import { getRequestId, getRuntimeModeLabel } from "../display";
import type {
    AuthorizationAdministrationGrantProjectionData,
    AuthorizationAdministrationOverviewData,
    AuthorizationAdministrationUserDetailData,
    AuthorizationAdministrationUserSummaryData,
    AuthorizationCapabilityGrantInput,
} from "../types";

type EffectiveFilter = "ALL" | "ALLOWED" | "DENIED";
type InvalidResolutionStatus = Extract<
    AuthorizationAdministrationUserDetailData["resolverEffectivePermissionStatus"],
    { readonly status: "INVALID_CONFIGURATION" }
>;

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
    const [pending, setPending] = useState<string | null>(null);

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
        setPending("user-grant-add");
        try {
            try {
                await addUserGrant(user.user.id, input);
            } catch (operationError) {
                await revalidate();
                throw operationError;
            }
            const refreshed = await revalidate();
            toast.success("เพิ่ม Direct User grant แล้ว", refreshed ? undefined : {
                description: "คำสั่งสำเร็จแล้ว แต่โหลดข้อมูล User ล่าสุดไม่สำเร็จ กรุณากดโหลดใหม่",
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
            toast.success("ลบ Direct User grant แล้ว", refreshed ? undefined : {
                description: "คำสั่งสำเร็จแล้ว แต่โหลดข้อมูล User ล่าสุดไม่สำเร็จ กรุณากดโหลดใหม่",
            });
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
            {loading && !user ? <LoadingState label="กำลังโหลด User detail และ resolver result" /> : null}
            {error && !user ? <ErrorState title="โหลด User detail ไม่สำเร็จ" description="ตรวจสอบ User ID และโหลดข้อมูลล่าสุดอีกครั้ง" action={{ label: "ลองใหม่", onClick: () => void onRefresh() }} /> : null}
            {!user && !loading && !error ? <EmptyState title="เลือก User เพื่อดูสิทธิ์" description="ค้นหา User จากชื่อ email หรือ User ID แล้วเลือกผลลัพธ์" icon={<UserRound className="h-6 w-6" aria-hidden="true" />} /> : null}
            {user ? (
                <div className="space-y-5">
                    {error ? <p role="alert" className="text-sm text-status-danger-strong">ข้อมูล User อาจไม่ใช่ข้อมูลล่าสุด: {error.message}</p> : null}
                    <UserIdentityPanel user={user} />
                    <ConfigurationIssues issues={user.configurationIssues} title="User authorization configuration issues" />
                    <MembershipsPanel user={user} onSelectTeam={onSelectTeam} />
                    <GrantList
                        title="User Exceptions"
                        description="สิทธิ์เฉพาะผู้ใช้ควรใช้เฉพาะกรณียกเว้น สิทธิ์ปกติควรมาจาก Team และ TeamRole รายการนี้เป็น additive direct grant แยกจาก Team configuration"
                        source="USER"
                        grants={user.directGrants}
                        busy={pending !== null}
                        onAdd={() => setGrantDialogOpen(true)}
                        onRemove={removeGrant}
                    />
                    <EffectiveAccessInspector user={user} />
                    <GrantFormDialog
                        open={grantDialogOpen}
                        source="USER"
                        capabilities={overview.capabilities}
                        busy={pending === "user-grant-add"}
                        onClose={() => setGrantDialogOpen(false)}
                        onSubmit={addGrant}
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
            <div className="border-b border-border-subtle px-4 py-4 sm:px-5"><h2 className="text-base font-semibold text-content-heading">ค้นหา User</h2><p className="mt-1 text-sm leading-6 text-content-secondary">เลือกจาก directory ที่จำกัดเฉพาะ identity และ lifecycle fields ที่จำเป็นต่อการตรวจสอบ configuration</p></div>
            <div className="px-4 py-4 sm:px-5"><Label htmlFor="authorization-user-search">ชื่อ, email หรือ User ID</Label><div className="relative mt-2"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" /><Input id="authorization-user-search" value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="เช่น somchai@example.com หรือ 42" maxLength={100} className="pl-9" autoComplete="off" /></div></div>
            {error ? <div role="alert" className="border-t border-status-danger-border bg-status-danger-surface px-4 py-3 text-sm text-status-danger-strong sm:px-5"><p>ค้นหา User ไม่สำเร็จ กรุณาลองใหม่</p>{getRequestId(error) ? <p className="mt-1 text-xs">Request ID: {getRequestId(error)}</p> : null}</div> : null}
            {query.trim().length > 0 ? <div className="border-t border-border-subtle" aria-live="polite">{loading ? <div className="flex items-center gap-2 px-4 py-4 text-sm text-content-secondary sm:px-5" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />กำลังค้นหา</div> : users.length === 0 ? <p className="px-4 py-4 text-sm text-content-secondary sm:px-5">ไม่พบ User ที่ตรงกับคำค้น</p> : <div className="divide-y divide-border-subtle">{users.map((item) => <button type="button" key={item.id} onClick={() => onSelectUser(item.id)} aria-pressed={item.id === selectedUserId} className={`flex min-h-16 w-full items-start justify-between gap-4 px-4 py-3 text-left transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5 ${item.id === selectedUserId ? "bg-action-primary-surface" : ""}`}><span className="min-w-0"><span className="block truncate font-semibold text-content-heading">{item.name}</span><span className="mt-0.5 block truncate text-sm text-content-secondary">{item.email}</span><span className="mt-0.5 block text-xs text-content-muted">User ID {item.id}{item.employee ? ` · ${item.employee.displayName}` : ""}</span></span><span className="flex shrink-0 flex-col items-end gap-1"><LifecycleStatus isActive={item.isActive} deletedAt={item.deletedAt} />{item.role === "ADMIN" ? <AuthorizationStatus tone="warning">ADMIN</AuthorizationStatus> : null}</span></button>)}</div>}</div> : <p className="border-t border-border-subtle px-4 py-3 text-xs leading-5 text-content-muted sm:px-5">พิมพ์คำค้นอย่างน้อย 1 ตัวอักษรเพื่อเริ่มค้นหา ระบบจะแสดงผลลัพธ์แบบ bounded เท่านั้น</p>}
        </section>
    );
}

function UserIdentityPanel({ user }: { readonly user: AuthorizationAdministrationUserDetailData }): ReactElement {
    const identity = user.user;
    return (
        <section className="rounded-xl border border-border-subtle bg-surface-raised">
            <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5"><div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-content-heading">{identity.name}</h2><LifecycleStatus isActive={identity.isActive} deletedAt={identity.deletedAt} />{user.systemRole === "ADMIN" ? <AuthorizationStatus tone="warning">SYSTEM ADMIN</AuthorizationStatus> : null}</div><p className="mt-1 text-sm text-content-secondary">{identity.email}</p></div><span className="font-mono text-xs text-content-secondary">User ID {identity.id}</span></div>
            {!identity.isActive || identity.deletedAt !== null ? <div className="border-b border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm leading-6 text-status-warning-strong sm:px-5">บัญชีนี้ไม่ Active การกำหนด configuration ไม่ได้ทำให้บัญชีผ่าน runtime lifecycle checks</div> : null}
            <dl className="grid gap-4 px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4 sm:px-5"><IdentityField label="System role" value={user.systemRole} /><IdentityField label="Account status" value={identity.deletedAt !== null ? "Deleted / unavailable" : identity.isActive ? "Active" : "Inactive"} /><IdentityField label="Employee" value={identity.employee?.displayName ?? "ไม่เชื่อมกับพนักงาน"} /><IdentityField label="Employee status" value={identity.employee ? `${identity.employee.status}${identity.employee.deletedAt ? " · Deleted" : ""}` : "—"} /></dl>
        </section>
    );
}

function MembershipsPanel({ user, onSelectTeam }: { readonly user: AuthorizationAdministrationUserDetailData; readonly onSelectTeam: (teamId: number) => void }): ReactElement {
    return <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised"><div className="border-b border-border-subtle px-4 py-4 sm:px-5"><h3 className="text-base font-semibold text-content-heading">Team memberships</h3><p className="mt-1 text-sm leading-6 text-content-secondary">แสดง configuration ทั้งหมด รวมถึง Team หรือ TeamRole ที่ inactive</p></div>{user.teamMemberships.length === 0 ? <p className="px-4 py-8 text-center text-sm text-content-secondary sm:px-5">User นี้ยังไม่มี Team membership</p> : <div className="overflow-x-auto"><table className="min-w-[680px] w-full text-left text-sm"><caption className="sr-only">Team memberships ของ {user.user.name}</caption><thead className="border-b border-border-subtle bg-surface-subtle text-xs font-semibold text-content-secondary"><tr><th scope="col" className="px-4 py-3 sm:px-5">Team</th><th scope="col" className="px-4 py-3">Team status</th><th scope="col" className="px-4 py-3">TeamRole</th><th scope="col" className="px-4 py-3">Role status</th></tr></thead><tbody className="divide-y divide-border-subtle">{user.teamMemberships.map((membership) => <tr key={`${membership.teamId}:${membership.userId}`}><td className="px-4 py-3 sm:px-5"><Button type="button" variant="link" size="sm" className="h-auto min-h-0 p-0 text-left font-semibold text-action-primary-foreground" onClick={() => onSelectTeam(membership.teamId)}>{membership.team.name}<span className="ml-2 font-mono text-xs font-normal">({membership.team.key})</span></Button></td><td className="px-4 py-3"><LifecycleEntityStatus isActive={membership.team.isActive} /></td><td className="px-4 py-3">{membership.teamRole ? `${membership.teamRole.name} (${membership.teamRole.key})` : <span className="text-content-secondary">ไม่กำหนด TeamRole</span>}</td><td className="px-4 py-3">{membership.teamRole ? <LifecycleEntityStatus isActive={membership.teamRole.isActive} /> : "—"}</td></tr>)}</tbody></table></div>}</section>;
}

function EffectiveAccessInspector({ user }: { readonly user: AuthorizationAdministrationUserDetailData }): ReactElement {
    const [filter, setFilter] = useState<EffectiveFilter>("ALL");
    const [domain, setDomain] = useState("ALL");
    const status = user.resolverEffectivePermissionStatus;
    const domains = useMemo(() => [...new Set(user.resolverEffectivePermissions.map((item) => item.capability.domain))].sort(), [user.resolverEffectivePermissions]);
    const permissions = useMemo(() => user.resolverEffectivePermissions.filter((permission) => (filter === "ALL" || (filter === "ALLOWED" && permission.allowed) || (filter === "DENIED" && !permission.allowed)) && (domain === "ALL" || permission.capability.domain === domain)), [domain, filter, user.resolverEffectivePermissions]);
    const hasCompatibility = user.resolverEffectivePermissions.some((permission) => permission.capability.runtimeAuthorizationMode === "CENTRAL_WITH_COMPATIBILITY");
    return (
        <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
            <div className="border-b border-border-subtle px-4 py-4 sm:px-5"><div className="flex items-start gap-3"><Info className="mt-0.5 h-5 w-5 shrink-0 text-action-primary-foreground" aria-hidden="true" /><div><h3 className="text-base font-semibold text-content-heading">Effective Access Inspector</h3><p className="mt-1 max-w-4xl text-sm leading-6 text-content-secondary">ผลจาก Central Authorization Resolver แสดงการตัดสินของ central resolver เท่านั้น บาง domain ยังมี compatibility policy หรือ resource-level policy เพิ่มเติม จึงไม่ใช่คำตัดสินสุดท้ายของทุก runtime operation</p></div></div></div>
            {status.status === "INVALID_CONFIGURATION" ? <InvalidResolutionState error={status.error} /> : <><CompatibilityNotice visible={hasCompatibility} /><div className="grid gap-3 border-b border-border-subtle bg-surface-subtle/60 px-4 py-3 md:grid-cols-[12rem_15rem] sm:px-5"><div><Label htmlFor="authorization-effective-filter">ผล resolver</Label><select id="authorization-effective-filter" value={filter} onChange={(event) => setFilter(event.target.value as EffectiveFilter)} className="mt-2 h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><option value="ALL">ทั้งหมด</option><option value="ALLOWED">Allowed</option><option value="DENIED">Denied</option></select></div><div><Label htmlFor="authorization-effective-domain">Domain</Label><select id="authorization-effective-domain" value={domain} onChange={(event) => setDomain(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><option value="ALL">ทุก Domain</option>{domains.map((item) => <option key={item} value={item}>{item}</option>)}</select></div></div>{permissions.length === 0 ? <p className="px-4 py-8 text-center text-sm text-content-secondary sm:px-5">ไม่พบผล resolver ตาม filter นี้</p> : <div className="divide-y divide-border-subtle">{permissions.map((permission) => <EffectivePermissionRow key={permission.capability.key} permission={permission} />)}</div>}</>}
        </section>
    );
}

function EffectivePermissionRow({ permission }: { readonly permission: AuthorizationAdministrationUserDetailData["resolverEffectivePermissions"][number] }): ReactElement {
    const mode = permission.capability.runtimeAuthorizationMode;
    return <article className="px-4 py-4 sm:px-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="break-all font-mono text-xs font-semibold text-content-heading">{permission.capability.key}</span><AuthorizationStatus tone={permission.allowed ? "allow" : "deny"}>{permission.allowed ? "ALLOW" : "DENY"}</AuthorizationStatus><AuthorizationStatus tone={mode === "CENTRAL_WITH_COMPATIBILITY" ? "warning" : mode === "DEFERRED" ? "deferred" : "neutral"}>{getRuntimeModeLabel(mode)}</AuthorizationStatus></div><p className="mt-1 text-xs text-content-secondary">{permission.capability.domain} · {permission.capability.description}</p></div><div className="text-left lg:text-right"><p className="text-xs text-content-secondary">Effective scopes</p><p className="mt-1 font-mono text-xs text-content-body">{permission.scopes.join(", ") || "—"}</p></div></div>{!permission.allowed && permission.reason ? <p className="mt-3 flex gap-2 text-sm text-status-warning-strong"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Resolver reason: {permission.reason}</p> : null}<div className="mt-3 border-t border-border-subtle pt-3"><p className="text-xs font-semibold text-content-secondary">Grant sources</p>{permission.grants.length === 0 ? <p className="mt-1 text-xs text-content-muted">ไม่มี grant ที่ใช้กับผลนี้</p> : <ul className="mt-2 grid gap-2 md:grid-cols-2">{permission.grants.map((grant, index) => <li key={`${grant.origin.type}-${grant.scope}-${index}`} className="rounded-lg border border-border-subtle bg-surface-subtle/50 px-3 py-2 text-xs leading-5"><div className="flex flex-wrap items-center gap-2"><AuthorizationStatus tone="neutral">{grant.origin.type}</AuthorizationStatus><span className="font-mono text-content-body">{grant.scope}</span></div><p className="mt-1 text-content-secondary">{formatGrantOrigin(grant.origin)}</p>{grant.constraint ? <p className="mt-1 font-mono text-content-body">constraint.teamId: {grant.constraint.teamId}</p> : null}</li>)}</ul>}</div>{mode === "DEFERRED" ? <p className="mt-3 text-xs leading-5 text-content-secondary">Capability นี้อยู่ในสถานะ DEFERRED; แสดงเพื่อการตรวจสอบเท่านั้น</p> : null}</article>;
}

function CompatibilityNotice({ visible }: { readonly visible: boolean }): ReactElement | null {
    if (!visible) return null;
    return <div className="border-b border-status-warning-border bg-status-warning-surface px-4 py-3 text-sm leading-6 text-status-warning-strong sm:px-5"><p className="font-semibold">มี Compatibility Policy</p><p>หาก resolver คืน NO_APPLICABLE_GRANT domain adapter อาจยังอนุญาตสิทธิ์ตาม migration compatibility policy ผลในหน้านี้จึงไม่ควรถูกอ่านว่าเป็น final runtime result</p></div>;
}

function InvalidResolutionState({ error }: { readonly error: InvalidResolutionStatus["error"] }): ReactElement {
    return <div role="alert" className="border-b border-status-danger-border bg-status-danger-surface px-4 py-5 text-status-danger-strong sm:px-5"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div><h4 className="font-semibold">Resolver ไม่สามารถเชื่อถือผลลัพธ์ได้</h4><p className="mt-1 text-sm leading-6">พบ INVALID_CONFIGURATION จาก server ห้ามตีความรายการนี้เป็นผล ALLOW/DENY ปกติ และห้ามซ่อมแซมจาก client</p><dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">{Object.entries(error).filter(([, value]) => value !== undefined).map(([key, value]) => <div key={key}><dt className="font-semibold">{key}</dt><dd className="font-mono">{String(value)}</dd></div>)}</dl></div></div></div>;
}

function formatGrantOrigin(origin: AuthorizationAdministrationUserDetailData["resolverEffectivePermissions"][number]["grants"][number]["origin"]): string {
    switch (origin.type) {
        case "SYSTEM_ROLE": return "ADMIN · system role (ไม่ขึ้นกับ Team grants)";
        case "TEAM": return `Team: ${origin.team?.name ?? `Team ${origin.teamId}`} · Team ID ${origin.teamId}`;
        case "TEAM_ROLE": return `TeamRole: ${origin.teamRole?.name ?? `TeamRole ${origin.teamRoleId}`} @ ${origin.team?.name ?? `Team ${origin.teamId}`}`;
        case "USER": return `Direct User Grant · User ID ${origin.userId}`;
    }
}

function IdentityField({ label, value }: { readonly label: string; readonly value: string }): ReactElement { return <div><dt className="text-xs text-content-secondary">{label}</dt><dd className="mt-1 break-words text-content-body">{value}</dd></div>; }
function LifecycleEntityStatus({ isActive }: { readonly isActive: boolean }): ReactElement { return <AuthorizationStatus tone={isActive ? "active" : "inactive"}>{isActive ? "Active" : "Inactive"}</AuthorizationStatus>; }
