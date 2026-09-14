"use client";

import { useCallback, useState, type ReactElement } from "react";
import { AlertTriangle, Edit3, Plus, RefreshCw, UserMinus } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/state";

import {
    addMember,
    addTeamGrant,
    addTeamRoleGrant,
    changeMemberRole,
    createTeamRole,
    removeMember,
    removeTeamGrant,
    removeTeamRoleGrant,
    updateTeam,
    updateTeamRole,
} from "../api";
import {
    AddMemberDialog,
    ConfirmAuthorizationAction,
    GrantFormDialog,
    TeamFormDialog,
    TeamRoleFormDialog,
} from "./AuthorizationDialogs";
import { ActiveStatus, LifecycleStatus } from "./AuthorizationStatus";
import { ConfigurationIssues } from "./ConfigurationIssues";
import { GrantList } from "./GrantList";
import { formatAuthorizationDate, getMutationErrorCopy } from "../display";
import type {
    AuthorizationAdministrationOverviewData,
    AuthorizationAdministrationGrantProjectionData,
    AuthorizationAdministrationTeamDetailData,
    AuthorizationAdministrationUserSummaryData,
} from "../types";

type TeamDetailTab = "details" | "members" | "roles" | "team-grants" | "role-grants";

export function TeamAdministration({
    team,
    loading,
    error,
    overview,
    directoryQuery,
    directoryUsers,
    directoryLoading,
    directoryError,
    onDirectoryQueryChange,
    onSelectUser,
    onRefresh,
}: {
    readonly team: AuthorizationAdministrationTeamDetailData | undefined;
    readonly loading: boolean;
    readonly error: Error | undefined;
    readonly overview: AuthorizationAdministrationOverviewData;
    readonly directoryQuery: string;
    readonly directoryUsers: readonly AuthorizationAdministrationUserSummaryData[];
    readonly directoryLoading: boolean;
    readonly directoryError: Error | undefined;
    readonly onDirectoryQueryChange: (query: string) => void;
    readonly onSelectUser: (userId: number) => void;
    readonly onRefresh: (affectedUserId?: number) => Promise<void>;
}): ReactElement {
    const [tab, setTab] = useState<TeamDetailTab>("details");
    const [teamEditorOpen, setTeamEditorOpen] = useState(false);
    const [memberDialogOpen, setMemberDialogOpen] = useState(false);
    const [roleEditor, setRoleEditor] = useState<{
        readonly mode: "create" | "edit";
        readonly role?: AuthorizationAdministrationTeamDetailData["roles"][number];
    } | null>(null);
    const [grantSource, setGrantSource] = useState<"TEAM" | "TEAM_ROLE" | null>(null);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [lifecycleTarget, setLifecycleTarget] = useState<{
        readonly kind: "team" | "role";
        readonly id: number;
        readonly name: string;
        readonly nextActive: boolean;
    } | null>(null);
    const [removeMemberTarget, setRemoveMemberTarget] = useState<{
        readonly userId: number;
        readonly name: string;
    } | null>(null);
    const [pendingKey, setPendingKey] = useState<string | null>(null);

    const revalidate = useCallback(async (affectedUserId?: number): Promise<boolean> => {
        try {
            await onRefresh(affectedUserId);
            return true;
        } catch {
            return false;
        }
    }, [onRefresh]);

    const runMutation = useCallback(async (
        key: string,
        operation: () => Promise<void>,
        successMessage: string,
        affectedUserId?: number,
    ): Promise<void> => {
        setPendingKey(key);
        try {
            try {
                await operation();
            } catch (operationError) {
                await revalidate(affectedUserId);
                throw operationError;
            }
            const refreshed = await revalidate(affectedUserId);
            toast.success(successMessage, refreshed ? undefined : {
                description: "คำสั่งสำเร็จแล้ว แต่โหลดข้อมูลล่าสุดไม่สำเร็จ กรุณากดโหลดใหม่",
            });
        } finally {
            setPendingKey(null);
        }
    }, [revalidate]);

    const runInlineMutation = useCallback(async (
        key: string,
        operation: () => Promise<void>,
        affectedUserId: number,
        successMessage: string,
    ): Promise<void> => {
        try {
            await runMutation(key, operation, successMessage, affectedUserId);
        } catch (mutationError) {
            const copy = getMutationErrorCopy(mutationError);
            toast.error(copy.title, { description: copy.description });
        }
    }, [runMutation]);

    if (loading && !team) return <LoadingState label="กำลังโหลดรายละเอียด Team" />;
    if (error && !team) {
        return (
            <ErrorState
                title="โหลดรายละเอียด Team ไม่สำเร็จ"
                description="อาจมีการเปลี่ยนแปลงจากผู้ดูแลระบบคนอื่น หรือไม่สามารถเชื่อมต่อได้"
                action={{ label: "ลองใหม่", onClick: () => void onRefresh(), icon: <RefreshCw aria-hidden="true" /> }}
            />
        );
    }
    if (!team) return <EmptyState title="ยังไม่ได้เลือก Team" description="เลือก Team จากรายการด้านบนเพื่อดูรายละเอียด" />;

    const selectedRole = team.roles.find((role) => role.id === selectedRoleId) ?? null;
    const isBusy = pendingKey !== null;

    return (
        <div className="space-y-5">
            <section className="rounded-xl border border-border-subtle bg-surface-raised">
                <div className="flex flex-col gap-4 border-b border-border-subtle px-4 py-4 sm:px-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                            <h2 className="break-words text-xl font-semibold tracking-tight text-content-heading">{team.name}</h2>
                            <ActiveStatus isActive={team.isActive} />
                        </div>
                        <p className="mt-1 break-all font-mono text-xs text-content-secondary">{team.key}</p>
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-content-secondary">{team.description || "ไม่มีคำอธิบาย Team"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => void onRefresh()} disabled={isBusy}>
                            <RefreshCw aria-hidden="true" />โหลดใหม่
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={() => setTeamEditorOpen(true)} disabled={isBusy}>
                            <Edit3 aria-hidden="true" />แก้ไขข้อมูล
                        </Button>
                        <Button type="button" variant={team.isActive ? "destructive" : "default"} size="sm" onClick={() => setLifecycleTarget({ kind: "team", id: team.id, name: team.name, nextActive: !team.isActive })} disabled={isBusy}>
                            {team.isActive ? "ปิดใช้งาน Team" : "เปิดใช้งาน Team"}
                        </Button>
                    </div>
                </div>
                <div className="grid gap-3 border-b border-border-subtle bg-surface-subtle/60 px-4 py-3 sm:grid-cols-4 sm:px-5">
                    <Count label="TeamRoles" value={team.roleCount} />
                    <Count label="สมาชิก" value={team.membershipCount} />
                    <Count label="Team grants" value={team.teamGrantCount} />
                    <Count label="แก้ไขล่าสุด" value={formatAuthorizationDate(team.updatedAt)} compact />
                </div>
                <nav aria-label="Team detail sections" className="overflow-x-auto border-b border-border-subtle">
                    <div className="flex min-w-max gap-1 px-3 py-2 sm:px-4">
                        <TeamTabButton active={tab === "details"} onClick={() => setTab("details")}>รายละเอียด</TeamTabButton>
                        <TeamTabButton active={tab === "members"} onClick={() => setTab("members")}>สมาชิก</TeamTabButton>
                        <TeamTabButton active={tab === "roles"} onClick={() => setTab("roles")}>TeamRoles</TeamTabButton>
                        <TeamTabButton active={tab === "team-grants"} onClick={() => setTab("team-grants")}>Team Permissions</TeamTabButton>
                        <TeamTabButton active={tab === "role-grants"} onClick={() => setTab("role-grants")}>TeamRole Permissions</TeamTabButton>
                    </div>
                </nav>
            </section>

            {error ? <p role="alert" className="text-sm text-status-danger-strong">รายละเอียดอาจไม่ใช่ข้อมูลล่าสุด: {error.message}</p> : null}
            <ConfigurationIssues issues={team.configurationIssues} title="Team configuration issues" />

            {tab === "details" ? <TeamDetails team={team} /> : null}
            {tab === "members" ? (
                <MembersPanel
                    team={team}
                    busy={isBusy}
                    onAdd={() => setMemberDialogOpen(true)}
                    onSelectUser={onSelectUser}
                    onChangeRole={(userId, teamRoleId) => void runInlineMutation(`member-role:${userId}`, async () => { await changeMemberRole(team.id, userId, { teamRoleId }); }, userId, "เปลี่ยน TeamRole แล้ว")}
                    onRemove={(userId, name) => setRemoveMemberTarget({ userId, name })}
                />
            ) : null}
            {tab === "roles" ? (
                <RolesPanel
                    team={team}
                    busy={isBusy}
                    onCreate={() => setRoleEditor({ mode: "create" })}
                    onEdit={(role) => setRoleEditor({ mode: "edit", role })}
                    onLifecycle={(role) => setLifecycleTarget({ kind: "role", id: role.id, name: role.name, nextActive: !role.isActive })}
                />
            ) : null}
            {tab === "team-grants" ? (
                <GrantList
                    title="Team Permissions"
                    description="Team grants มีผลกับสมาชิก Active ของ Team นี้ตาม resolver semantics"
                    source="TEAM"
                    grants={team.teamGrants}
                    busy={isBusy}
                    onAdd={() => setGrantSource("TEAM")}
                    onRemove={(grant) => runMutation(`team-grant-remove:${grant.capabilityKey}:${grant.scope}`, async () => { await removeTeamGrant(team.id, { capabilityKey: grant.capabilityKey, scope: grant.scope }); }, "ลบ Team grant แล้ว")}
                />
            ) : null}
            {tab === "role-grants" ? (
                <RoleGrantsPanel
                    team={team}
                    selectedRoleId={selectedRoleId}
                    onSelectedRoleIdChange={setSelectedRoleId}
                    busy={isBusy}
                    onAdd={() => setGrantSource("TEAM_ROLE")}
                    onRemove={(grant) => selectedRole ? runMutation(`role-grant-remove:${grant.capabilityKey}:${grant.scope}`, async () => { await removeTeamRoleGrant(team.id, selectedRole.id, { capabilityKey: grant.capabilityKey, scope: grant.scope }); }, "ลบ TeamRole grant แล้ว") : Promise.resolve()}
                />
            ) : null}

            <TeamFormDialog
                open={teamEditorOpen}
                mode="edit"
                team={team}
                busy={pendingKey === "team-update"}
                onClose={() => setTeamEditorOpen(false)}
                onSubmit={async (input) => {
                    const { name, description } = input;
                    await runMutation("team-update", async () => { await updateTeam(team.id, { name, description }); }, "บันทึกข้อมูล Team แล้ว");
                    setTeamEditorOpen(false);
                }}
            />
            <TeamRoleFormDialog
                open={roleEditor !== null}
                mode={roleEditor?.mode ?? "create"}
                role={roleEditor?.role}
                busy={pendingKey === "role-save"}
                onClose={() => setRoleEditor(null)}
                onSubmit={async (input) => {
                    const editingRole = roleEditor?.role;
                    if (roleEditor?.mode === "edit" && editingRole) {
                        await runMutation("role-save", async () => { await updateTeamRole(team.id, editingRole.id, { name: input.name }); }, "บันทึก TeamRole แล้ว");
                    } else if (roleEditor?.mode === "create") {
                        await runMutation("role-save", async () => { await createTeamRole(team.id, { key: input.key ?? "", name: input.name }); }, "สร้าง TeamRole แล้ว");
                    } else {
                        throw new Error("ไม่พบ TeamRole ที่ต้องการแก้ไข");
                    }
                    setRoleEditor(null);
                }}
            />
            <AddMemberDialog
                open={memberDialogOpen}
                team={team}
                users={directoryUsers}
                roles={team.roles}
                query={directoryQuery}
                usersLoading={directoryLoading}
                usersError={directoryError}
                busy={pendingKey === "member-add"}
                onQueryChange={onDirectoryQueryChange}
                onClose={() => setMemberDialogOpen(false)}
                onSubmit={async (input) => {
                    await runMutation("member-add", async () => { await addMember(team.id, input); }, "เพิ่มสมาชิกใน Team แล้ว", input.userId);
                    setMemberDialogOpen(false);
                }}
            />
            {grantSource ? (
                <GrantFormDialog
                    open
                    source={grantSource}
                    capabilities={overview.capabilities}
                    busy={pendingKey === `grant-add:${grantSource}`}
                    onClose={() => setGrantSource(null)}
                    onSubmit={async (input) => {
                        if (grantSource === "TEAM") {
                            await runMutation("grant-add:TEAM", async () => { await addTeamGrant(team.id, input); }, "เพิ่ม Team grant แล้ว");
                        } else if (selectedRole) {
                            await runMutation("grant-add:TEAM_ROLE", async () => { await addTeamRoleGrant(team.id, selectedRole.id, input); }, "เพิ่ม TeamRole grant แล้ว");
                        }
                        setGrantSource(null);
                    }}
                />
            ) : null}
            <ConfirmAuthorizationAction
                open={lifecycleTarget !== null}
                title={lifecycleTarget?.nextActive ? `เปิดใช้งาน ${lifecycleTarget.name}` : `ปิดใช้งาน ${lifecycleTarget?.name ?? "รายการ"}`}
                description={lifecycleTarget?.kind === "team" && lifecycleTarget.nextActive === false
                    ? "สมาชิกและ configuration จะไม่ถูกลบ Team grants, TeamRoles และ memberships ยังคงตรวจสอบได้ แต่ effective Team authorization จะไม่ active"
                    : lifecycleTarget?.kind === "role" && lifecycleTarget.nextActive === false
                        ? "การปิดใช้งานจะไม่ลบสมาชิกหรือ grants ของ TeamRole นี้ แต่จะหยุดการนำ role นี้ไปใช้ใน effective authorization"
                        : "การเปลี่ยนสถานะจะถูกยืนยันโดย server และข้อมูลเดิมจะยังคงตรวจสอบได้"}
                confirmLabel={lifecycleTarget?.nextActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                destructive={lifecycleTarget?.nextActive === false}
                busy={pendingKey === "lifecycle"}
                onClose={() => setLifecycleTarget(null)}
                onConfirm={async () => {
                    if (!lifecycleTarget) return;
                    if (lifecycleTarget.kind === "team") {
                        await runMutation("lifecycle", async () => { await updateTeam(team.id, { isActive: lifecycleTarget.nextActive }); }, lifecycleTarget.nextActive ? "เปิดใช้งาน Team แล้ว" : "ปิดใช้งาน Team แล้ว");
                    } else {
                        await runMutation("lifecycle", async () => { await updateTeamRole(team.id, lifecycleTarget.id, { isActive: lifecycleTarget.nextActive }); }, lifecycleTarget.nextActive ? "เปิดใช้งาน TeamRole แล้ว" : "ปิดใช้งาน TeamRole แล้ว");
                    }
                    setLifecycleTarget(null);
                }}
            />
            <ConfirmAuthorizationAction
                open={removeMemberTarget !== null}
                title="นำสมาชิกออกจาก Team?"
                description={removeMemberTarget ? `นำ ${removeMemberTarget.name} ออกจาก ${team.name} หรือไม่ การดำเนินการนี้อาจลบ Team-derived central authorization ทันที แต่ไม่ใช่การลบ User` : ""}
                confirmLabel="นำออกจาก Team"
                destructive
                busy={pendingKey === "member-remove"}
                onClose={() => setRemoveMemberTarget(null)}
                onConfirm={async () => {
                    if (!removeMemberTarget) return;
                    await runMutation("member-remove", async () => { await removeMember(team.id, removeMemberTarget.userId); }, "นำสมาชิกออกจาก Team แล้ว", removeMemberTarget.userId);
                    setRemoveMemberTarget(null);
                }}
            />
        </div>
    );
}

function TeamDetails({ team }: { readonly team: AuthorizationAdministrationTeamDetailData }): ReactElement {
    return (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
            <div className="rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-5">
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-action-primary-foreground" aria-hidden="true" /><h3 className="text-base font-semibold text-content-heading">ขอบเขตของ Team</h3></div>
                <p className="mt-2 text-sm leading-6 text-content-secondary">Team grants ใช้กับสมาชิกของ Team ส่วน TeamRole grants ใช้กับสมาชิกที่ถูกกำหนด TeamRole นั้น โดยทั้ง Team และ TeamRole ต้องอยู่ในสถานะที่ resolver รองรับ</p>
                <dl className="mt-5 grid gap-3 border-t border-border-subtle pt-4 text-sm sm:grid-cols-2">
                    <Detail label="key" value={team.key} mono />
                    <Detail label="ชื่อ" value={team.name} />
                    <Detail label="สร้างเมื่อ" value={formatAuthorizationDate(team.createdAt)} />
                    <Detail label="แก้ไขเมื่อ" value={formatAuthorizationDate(team.updatedAt)} />
                </dl>
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface-subtle/60 p-4 sm:p-5">
                <h3 className="text-base font-semibold text-content-heading">สิ่งที่ยังคงตรวจสอบได้</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-content-secondary">
                    <li>• สมาชิกทั้งหมด แม้ account จะ Inactive</li>
                    <li>• TeamRoles และ grants ที่ persisted อยู่</li>
                    <li>• configuration issues ที่ระบบพบ</li>
                </ul>
            </div>
        </section>
    );
}

function MembersPanel({
    team,
    busy,
    onAdd,
    onSelectUser,
    onChangeRole,
    onRemove,
}: {
    readonly team: AuthorizationAdministrationTeamDetailData;
    readonly busy: boolean;
    readonly onAdd: () => void;
    readonly onSelectUser: (userId: number) => void;
    readonly onChangeRole: (userId: number, teamRoleId: number | null) => void;
    readonly onRemove: (userId: number, name: string) => void;
}): ReactElement {
    return (
        <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
            <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                <div><h3 className="text-base font-semibold text-content-heading">สมาชิกใน Team</h3><p className="mt-1 text-sm leading-6 text-content-secondary">Membership เป็น configuration แยกจากสถานะ account และ employee</p></div>
                <Button type="button" size="sm" onClick={onAdd} disabled={busy}><Plus aria-hidden="true" />เพิ่มสมาชิก</Button>
            </div>
            {team.memberships.length === 0 ? <EmptyState compact className="m-4 border-dashed" title="ยังไม่มีสมาชิก" description="ค้นหา User เพื่อเพิ่มสมาชิกใน Team นี้" action={{ label: "เพิ่มสมาชิก", onClick: onAdd, icon: <Plus aria-hidden="true" /> }} /> : (
                <div className="overflow-x-auto">
                    <table className="min-w-[920px] w-full text-left text-sm">
                        <caption className="sr-only">สมาชิกของ {team.name}</caption>
                        <thead className="border-b border-border-subtle bg-surface-subtle text-xs font-semibold text-content-secondary"><tr><th scope="col" className="px-4 py-3 sm:px-5">User</th><th scope="col" className="px-4 py-3">Account</th><th scope="col" className="px-4 py-3">Employee</th><th scope="col" className="px-4 py-3">TeamRole</th><th scope="col" className="px-4 py-3"><span className="sr-only">การดำเนินการ</span></th></tr></thead>
                        <tbody className="divide-y divide-border-subtle">{team.memberships.map((membership) => <tr key={membership.userId}>
                            <td className="px-4 py-3 sm:px-5"><button type="button" className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onSelectUser(membership.userId)}><span className="block font-semibold text-content-heading">{membership.user.name}</span><span className="mt-0.5 block text-xs text-content-secondary">{membership.user.email}</span><span className="mt-0.5 block font-mono text-xs text-content-muted">User ID {membership.user.id}</span></button></td>
                            <td className="px-4 py-3"><LifecycleStatus isActive={membership.user.isActive} deletedAt={membership.user.deletedAt} /></td>
                            <td className="px-4 py-3">{membership.user.employee ? <span className="space-y-1"><span className="block text-content-body">{membership.user.employee.displayName}</span><span className="block text-xs text-content-secondary">{membership.user.employee.status}{membership.user.employee.deletedAt ? " · Deleted" : ""}</span></span> : <span className="text-content-secondary">ไม่เชื่อมกับพนักงาน</span>}</td>
                            <td className="px-4 py-3"><select aria-label={`TeamRole ของ ${membership.user.name}`} value={membership.teamRoleId ? String(membership.teamRoleId) : ""} onChange={(event) => onChangeRole(membership.userId, event.target.value ? Number(event.target.value) : null)} disabled={busy} className="h-11 min-w-48 rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><option value="">ไม่กำหนด TeamRole</option>{team.roles.map((role) => <option key={role.id} value={role.id} disabled={!role.isActive}>{role.name} ({role.key}){role.isActive ? "" : " — Inactive"}</option>)}</select></td>
                            <td className="px-4 py-3 text-right"><Button type="button" variant="outline" size="xs" onClick={() => onRemove(membership.userId, membership.user.name)} disabled={busy} aria-label={`นำ ${membership.user.name} ออกจาก Team`}><UserMinus aria-hidden="true" />นำออก</Button></td>
                        </tr>)}</tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function RolesPanel({
    team,
    busy,
    onCreate,
    onEdit,
    onLifecycle,
}: {
    readonly team: AuthorizationAdministrationTeamDetailData;
    readonly busy: boolean;
    readonly onCreate: () => void;
    readonly onEdit: (role: AuthorizationAdministrationTeamDetailData["roles"][number]) => void;
    readonly onLifecycle: (role: AuthorizationAdministrationTeamDetailData["roles"][number]) => void;
}): ReactElement {
    return (
        <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
            <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5"><div><h3 className="text-base font-semibold text-content-heading">TeamRoles</h3><p className="mt-1 text-sm leading-6 text-content-secondary">บทบาทภายใน Team นี้ key ย้ายข้าม Team หรือแก้ไขหลังสร้างไม่ได้ และชื่ออย่าง HEAD/MANAGER ไม่ได้ให้ authority เอง</p></div><Button type="button" size="sm" onClick={onCreate} disabled={busy}><Plus aria-hidden="true" />สร้าง TeamRole</Button></div>
            {team.roles.length === 0 ? <EmptyState compact className="m-4 border-dashed" title="ยังไม่มี TeamRole" description="สร้างบทบาทเมื่อ Team ต้องแยกความรับผิดชอบภายใน" action={{ label: "สร้าง TeamRole", onClick: onCreate, icon: <Plus aria-hidden="true" /> }} /> : <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><caption className="sr-only">TeamRoles ของ {team.name}</caption><thead className="border-b border-border-subtle bg-surface-subtle text-xs font-semibold text-content-secondary"><tr><th scope="col" className="px-4 py-3 sm:px-5">TeamRole</th><th scope="col" className="px-4 py-3">สถานะ</th><th scope="col" className="px-4 py-3">สมาชิก</th><th scope="col" className="px-4 py-3">Grants</th><th scope="col" className="px-4 py-3"><span className="sr-only">การดำเนินการ</span></th></tr></thead><tbody className="divide-y divide-border-subtle">{team.roles.map((role) => <tr key={role.id}><td className="px-4 py-3 sm:px-5"><span className="block font-semibold text-content-heading">{role.name}</span><span className="mt-0.5 block font-mono text-xs text-content-secondary">{role.key}</span></td><td className="px-4 py-3"><ActiveStatus isActive={role.isActive} /></td><td className="px-4 py-3 tabular-nums">{role.membershipCount}</td><td className="px-4 py-3 tabular-nums">{role.grantCount}</td><td className="px-4 py-3 text-right"><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" size="xs" onClick={() => onEdit(role)} disabled={busy}><Edit3 aria-hidden="true" />แก้ไข</Button><Button type="button" variant={role.isActive ? "outline" : "default"} size="xs" onClick={() => onLifecycle(role)} disabled={busy}>{role.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}</Button></div></td></tr>)}</tbody></table></div>}
        </section>
    );
}

function RoleGrantsPanel({
    team,
    selectedRoleId,
    onSelectedRoleIdChange,
    busy,
    onAdd,
    onRemove,
}: {
    readonly team: AuthorizationAdministrationTeamDetailData;
    readonly selectedRoleId: number | null;
    readonly onSelectedRoleIdChange: (id: number | null) => void;
    readonly busy: boolean;
    readonly onAdd: () => void;
    readonly onRemove: (grant: AuthorizationAdministrationGrantProjectionData) => Promise<void>;
}): ReactElement {
    const role = team.roles.find((item) => item.id === selectedRoleId) ?? null;
    const grants = role ? team.teamRoleGrants.filter((grant) => grant.teamRoleId === role.id) : [];
    return (
        <div className="space-y-4">
            <section className="rounded-xl border border-border-subtle bg-surface-raised px-4 py-4 sm:px-5"><label htmlFor="authorization-selected-team-role" className="text-sm font-semibold text-content-heading">เลือก TeamRole เพื่อดู permissions</label><select id="authorization-selected-team-role" value={selectedRoleId === null ? "" : String(selectedRoleId)} onChange={(event) => onSelectedRoleIdChange(event.target.value ? Number(event.target.value) : null)} className="mt-2 h-11 w-full max-w-xl rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><option value="">เลือก TeamRole</option>{team.roles.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.key}){item.isActive ? "" : " — Inactive"}</option>)}</select><p className="mt-2 text-xs leading-5 text-content-secondary">TeamRole grants จะใช้กับสมาชิกที่ assigned role นี้เมื่อ TeamRole และ Team อยู่ในสถานะ active ตาม resolver</p></section>
            {role ? <GrantList title={`Permissions · ${role.name}`} description="รายการนี้แยกจาก Team grants และใช้กับสมาชิกของ Team ที่เลือก TeamRole นี้" source="TEAM_ROLE" grants={grants} busy={busy} onAdd={onAdd} onRemove={(grant) => onRemove(grant)} /> : <EmptyState title="เลือก TeamRole" description="เลือกบทบาทเพื่อดูหรือจัดการ grants ของบทบาทนั้น" />}
        </div>
    );
}

function TeamTabButton({ active, onClick, children }: { readonly active: boolean; readonly onClick: () => void; readonly children: React.ReactNode }): ReactElement {
    return <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} className={`min-h-10 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-action-primary-surface text-action-primary-foreground" : "text-content-secondary hover:bg-surface-subtle hover:text-content-heading"}`}>{children}</button>;
}

function Count({ label, value, compact = false }: { readonly label: string; readonly value: number | string; readonly compact?: boolean }): ReactElement {
    return <div><p className="text-xs text-content-secondary">{label}</p><p className={compact ? "mt-1 text-xs font-medium text-content-body" : "mt-1 text-lg font-semibold tabular-nums text-content-heading"}>{value}</p></div>;
}

function Detail({ label, value, mono = false }: { readonly label: string; readonly value: string; readonly mono?: boolean }): ReactElement {
    return <div><dt className="text-xs text-content-secondary">{label}</dt><dd className={`mt-1 break-words text-content-body ${mono ? "font-mono text-xs" : ""}`}>{value}</dd></div>;
}
