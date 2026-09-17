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
import {
    getAuthorizationChannelLabel,
    getEffectiveAccessStateLabel,
    getRequestId,
    getRuntimeModeLabel,
} from "../display";
import type {
    AuthorizationAdministrationGrantProjectionData,
    AuthorizationAdministrationOverviewData,
    AuthorizationAdministrationUserDetailData,
    AuthorizationAdministrationUserSummaryData,
    AuthorizationCapabilityGrantInput,
} from "../types";

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
            {loading && !user ? <LoadingState label="กำลังโหลด User detail และ effective access" /> : null}
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
    const domains = useMemo(() => [...new Set(user.effectiveAccess.map((item) => item.capability.domain))].sort(), [user.effectiveAccess]);
    const rows = useMemo(() => user.effectiveAccess.filter((row) =>
        (filter === "ALL" || row.effectiveAuthority.state === filter)
        && (domain === "ALL" || row.capability.domain === domain),
    ), [domain, filter, user.effectiveAccess]);
    const rawStatus = user.resolverEffectivePermissionStatus;
    const effectiveStatus = user.effectiveAccessStatus;
    return (
        <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
            <div className="border-b border-border-subtle px-4 py-4 sm:px-5">
                <div className="flex items-start gap-3">
                    <Info className="mt-0.5 h-5 w-5 shrink-0 text-action-primary-foreground" aria-hidden="true" />
                    <div>
                        <h3 className="text-base font-semibold text-content-heading">Effective Access Inspector</h3>
                        <p className="mt-1 max-w-4xl text-sm leading-6 text-content-secondary">
                            แสดง Default Domain Policy + Additional / Resolver authority = Effective capability authority แยกตาม context และ channel ที่ระบบรองรับ ผลนี้เป็น capability-layer inspection ไม่ใช่คำตัดสินสิทธิ์ต่อ resource หรือ workflow รายการใดรายการหนึ่ง
                        </p>
                        <p className="mt-2 text-xs leading-5 text-content-muted">
                            Configuration ที่แสดงไม่ทำให้ User ที่ inactive/deleted หรือ Employee ที่ไม่เข้าเงื่อนไขผ่าน lifecycle checks ได้
                        </p>
                    </div>
                </div>
            </div>
            {rawStatus.status === "INVALID_CONFIGURATION" ? <InvalidResolutionState error={rawStatus.error} /> : effectiveStatus.status === "INVALID_CONFIGURATION" ? <InvalidEffectiveAccessState error={effectiveStatus.error} /> : <>
                <EffectiveAccessSummary summary={user.effectiveAccessSummary} />
                <div className="grid gap-3 border-b border-border-subtle bg-surface-subtle/60 px-4 py-3 md:grid-cols-[12rem_15rem] sm:px-5">
                    <div>
                        <Label htmlFor="authorization-effective-filter">Effective state</Label>
                        <select id="authorization-effective-filter" value={filter} onChange={(event) => setFilter(event.target.value as EffectiveFilter)} className="mt-2 h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                            <option value="ALL">ทั้งหมด</option>
                            <option value="AVAILABLE">Available</option>
                            <option value="UNAVAILABLE">Unavailable</option>
                            <option value="UNSUPPORTED">Unsupported / N/A</option>
                            <option value="DEFERRED">Deferred</option>
                        </select>
                    </div>
                    <div>
                        <Label htmlFor="authorization-effective-domain">Domain</Label>
                        <select id="authorization-effective-domain" value={domain} onChange={(event) => setDomain(event.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                            <option value="ALL">ทุก Domain</option>
                            {domains.map((item) => <option key={item} value={item}>{item}</option>)}
                        </select>
                    </div>
                </div>
                {rows.length === 0 ? <p className="px-4 py-8 text-center text-sm text-content-secondary sm:px-5">ไม่พบ effective access ตาม filter นี้</p> : <div className="divide-y divide-border-subtle">{rows.map((row) => <EffectiveAccessRow key={`${row.capability.key}:${row.context.key}`} row={row} />)}</div>}
            </>}
            <RawResolverEvidence permissions={user.resolverEffectivePermissions} />
        </section>
    );
}

function EffectiveAccessSummary({ summary }: { readonly summary: AuthorizationAdministrationUserDetailData["effectiveAccessSummary"] }): ReactElement {
    const metrics = [
        { label: "Available contexts", value: summary.availableContextCount, description: "capability authority ที่มีผลใน context" },
        { label: "Default-backed", value: summary.defaultBackedContextCount, description: "context ที่มี Default Domain Policy" },
        { label: "Additional authority", value: summary.additionalAuthorityContextCount, description: "context ที่มี configured/system grant" },
        { label: "Deferred capabilities", value: summary.deferredCapabilityCount, description: "ยังไม่ migrate เป็น effective policy" },
        { label: "Configuration issues", value: summary.configurationIssueCount, description: "ปัญหาที่ต้องตรวจสอบจาก server" },
    ];
    return <div className="grid gap-3 border-b border-border-subtle px-4 py-4 sm:grid-cols-2 sm:px-5 lg:grid-cols-5">{metrics.map((metric) => <div key={metric.label} className="rounded-lg border border-border-subtle bg-surface-subtle/50 px-3 py-3"><p className="text-xs text-content-secondary">{metric.label}</p><p className="mt-1 text-xl font-semibold tabular-nums text-content-heading">{metric.value}</p><p className="mt-1 text-xs leading-5 text-content-muted">{metric.description}</p></div>)}</div>;
}

function EffectiveAccessRow({ row }: { readonly row: AuthorizationAdministrationUserDetailData["effectiveAccess"][number] }): ReactElement {
    const stateTone = row.effectiveAuthority.state === "AVAILABLE"
        ? "allow"
        : row.effectiveAuthority.state === "DEFERRED"
            ? "deferred"
            : "neutral";
    return <article className="px-4 py-5 sm:px-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="break-all font-mono text-xs font-semibold text-content-heading">{row.capability.key}</span>
                    <AuthorizationStatus tone={stateTone}>{getEffectiveAccessStateLabel(row.effectiveAuthority.state)}</AuthorizationStatus>
                </div>
                <p className="mt-1 text-xs text-content-secondary">{row.capability.domain} · {row.capability.description}</p>
            </div>
            <div className="flex flex-wrap gap-2 lg:justify-end">
                <AuthorizationStatus tone="neutral">{row.context.label}</AuthorizationStatus>
                <AuthorizationStatus tone="neutral">{getAuthorizationChannelLabel(row.context.channel)}</AuthorizationStatus>
            </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
            <AuthorityCard label="Default Domain Policy" detail="code-owned · ไม่ใช่ persisted grant" scopes={row.defaultAuthority.scopes} />
            <AuthorityCard label="Additional / Resolver authority" detail={row.additionalAuthority.reason ? `resolver: ${row.additionalAuthority.reason}` : "configured/system authority"} scopes={row.additionalAuthority.scopes} />
            <AuthorityCard label="Effective capability authority" detail="ยังไม่ใช่ unconditional resource access" scopes={row.effectiveAuthority.scopes} state={row.effectiveAuthority.state} />
        </div>
        {row.effectiveAuthority.redundant ? <p className="mt-3 rounded-md border border-status-warning-border bg-status-warning-surface px-3 py-2 text-xs leading-5 text-status-warning-strong">Additional authority มีอยู่ แต่ไม่ขยาย normalized composed scope จาก Default ใน context นี้ (ไม่ใช่ configuration error)</p> : null}
        {row.additionalAuthority.grants.length > 0 ? <details className="mt-3 rounded-lg border border-border-subtle bg-surface-subtle/40 px-3 py-2"><summary className="cursor-pointer text-xs font-semibold text-content-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">ดู source / provenance ของ Additional</summary><ul className="mt-2 grid gap-2 md:grid-cols-2">{row.additionalAuthority.grants.map((grant, index) => <li key={`${grant.origin.type}-${grant.scope}-${index}`} className="rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-xs leading-5"><div className="flex flex-wrap items-center gap-2"><AuthorizationStatus tone="neutral">{grant.origin.type}</AuthorizationStatus><span className="font-mono text-content-body">{grant.scope}</span></div><p className="mt-1 text-content-secondary">{formatGrantOrigin(grant.origin)}</p>{grant.constraint ? <p className="mt-1 font-mono text-content-body">constraint.teamId: {grant.constraint.teamId}</p> : null}</li>)}</ul></details> : null}
        {row.limitations.length > 0 ? <div className="mt-3 border-t border-border-subtle pt-3"><p className="text-xs font-semibold text-content-secondary">Domain limits</p><ul className="mt-1 grid gap-1 text-xs leading-5 text-content-secondary">{row.limitations.map((limitation) => <li key={limitation.code}>• {limitation.label}</li>)}</ul></div> : null}
    </article>;
}

function AuthorityCard({ label, detail, scopes, state }: { readonly label: string; readonly detail: string; readonly scopes: readonly string[]; readonly state?: EffectiveAccessState }): ReactElement {
    return <div className="rounded-lg border border-border-subtle bg-surface-subtle/50 px-3 py-3"><p className="text-xs font-semibold text-content-secondary">{label}</p><p className="mt-1 text-xs leading-5 text-content-muted">{detail}</p>{state ? <p className="mt-2"><AuthorizationStatus tone={state === "AVAILABLE" ? "allow" : state === "DEFERRED" ? "deferred" : "neutral"}>{getEffectiveAccessStateLabel(state)}</AuthorizationStatus></p> : null}<p className="mt-2 font-mono text-xs text-content-body">{scopes.join(", ") || "None"}</p></div>;
}

function RawResolverEvidence({ permissions }: { readonly permissions: AuthorizationAdministrationUserDetailData["resolverEffectivePermissions"] }): ReactElement {
    return <details className="border-t border-border-subtle"><summary className="cursor-pointer px-4 py-4 text-sm font-semibold text-content-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:px-5">Advanced: Central resolver evidence (Dashboard)</summary><div className="border-t border-border-subtle"><p className="px-4 py-3 text-xs leading-5 text-content-secondary sm:px-5">ข้อมูลนี้เป็น configured/system authority จาก central resolver เท่านั้น เก็บไว้เพื่อวินิจฉัย source, reason, origin และ Team constraint; ห้ามอ่านแทน Effective capability authority ด้านบน</p>{permissions.length === 0 ? <p className="px-4 py-6 text-center text-sm text-content-secondary sm:px-5">ไม่มี raw resolver rows เนื่องจาก configuration invalid หรือยังไม่มีข้อมูล</p> : <div className="divide-y divide-border-subtle">{permissions.map((permission) => <ResolverPermissionRow key={permission.capability.key} permission={permission} />)}</div>}</div></details>;
}

function ResolverPermissionRow({ permission }: { readonly permission: AuthorizationAdministrationUserDetailData["resolverEffectivePermissions"][number] }): ReactElement {
    const mode = permission.capability.runtimeAuthorizationMode;
    return <article className="px-4 py-4 sm:px-5"><div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="break-all font-mono text-xs font-semibold text-content-heading">{permission.capability.key}</span><AuthorizationStatus tone={permission.allowed ? "allow" : "deny"}>{permission.allowed ? "ALLOW" : "DENY"}</AuthorizationStatus><AuthorizationStatus tone={mode === "CENTRAL_WITH_COMPATIBILITY" ? "warning" : mode === "DEFERRED" ? "deferred" : "neutral"}>{getRuntimeModeLabel(mode)}</AuthorizationStatus></div><p className="mt-1 text-xs text-content-secondary">{permission.capability.domain} · {permission.capability.description}</p></div><div className="text-left lg:text-right"><p className="text-xs text-content-secondary">Resolver scopes</p><p className="mt-1 font-mono text-xs text-content-body">{permission.scopes.join(", ") || "—"}</p></div></div>{!permission.allowed && permission.reason ? <p className="mt-3 flex gap-2 text-sm text-status-warning-strong"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />Resolver reason: {permission.reason}</p> : null}<div className="mt-3 border-t border-border-subtle pt-3"><p className="text-xs font-semibold text-content-secondary">Grant sources</p>{permission.grants.length === 0 ? <p className="mt-1 text-xs text-content-muted">ไม่มี grant ที่ใช้กับผลนี้</p> : <ul className="mt-2 grid gap-2 md:grid-cols-2">{permission.grants.map((grant, index) => <li key={`${grant.origin.type}-${grant.scope}-${index}`} className="rounded-lg border border-border-subtle bg-surface-subtle/50 px-3 py-2 text-xs leading-5"><div className="flex flex-wrap items-center gap-2"><AuthorizationStatus tone="neutral">{grant.origin.type}</AuthorizationStatus><span className="font-mono text-content-body">{grant.scope}</span></div><p className="mt-1 text-content-secondary">{formatGrantOrigin(grant.origin)}</p>{grant.constraint ? <p className="mt-1 font-mono text-content-body">constraint.teamId: {grant.constraint.teamId}</p> : null}</li>)}</ul>}</div>{mode === "DEFERRED" ? <p className="mt-3 text-xs leading-5 text-content-secondary">Capability นี้อยู่ในสถานะ DEFERRED; แสดงเพื่อการตรวจสอบเท่านั้น</p> : null}</article>;
}

function InvalidResolutionState({ error }: { readonly error: InvalidResolutionStatus["error"] }): ReactElement {
    return <div role="alert" className="border-b border-status-danger-border bg-status-danger-surface px-4 py-5 text-status-danger-strong sm:px-5"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div><h4 className="font-semibold">Resolver ไม่สามารถเชื่อถือผลลัพธ์ได้</h4><p className="mt-1 text-sm leading-6">พบ INVALID_CONFIGURATION จาก server ห้ามตีความรายการนี้เป็นผล ALLOW/DENY ปกติ และห้ามซ่อมแซมจาก client</p><dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">{Object.entries(error).filter(([, value]) => value !== undefined).map(([key, value]) => <div key={key}><dt className="font-semibold">{key}</dt><dd className="font-mono">{String(value)}</dd></div>)}</dl></div></div></div>;
}

function InvalidEffectiveAccessState({ error }: { readonly error: InvalidEffectiveAccessStatus["error"] }): ReactElement {
    return <div role="alert" className="border-b border-status-danger-border bg-status-danger-surface px-4 py-5 text-status-danger-strong sm:px-5"><div className="flex items-start gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" /><div><h4 className="font-semibold">Effective access projection ไม่สามารถเชื่อถือได้</h4><p className="mt-1 text-sm leading-6">พบ configuration error ระหว่าง compose policy จาก server จึงไม่แสดงผล Effective แบบ permissive</p><dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">{Object.entries(error).filter(([, value]) => value !== undefined).map(([key, value]) => <div key={key}><dt className="font-semibold">{key}</dt><dd className="font-mono">{String(value)}</dd></div>)}</dl></div></div></div>;
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
