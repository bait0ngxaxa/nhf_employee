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
import { getMutationErrorCopy } from "../display";
import { createAuthorizationTechnicalKey } from "../technical-key";
import type {
    AuthorizationAdministrationOverviewData,
    AuthorizationAdministrationGrantProjectionData,
    AuthorizationAdministrationTeamDetailData,
    AuthorizationAdministrationUserSummaryData,
} from "../types";

type TeamDetailTab = "details" | "members" | "permissions";
type LifecycleTarget = {
    readonly kind: "team" | "role";
    readonly id: number;
    readonly name: string;
    readonly nextActive: boolean;
};
type RemoveMemberTarget = {
    readonly userId: number;
    readonly name: string;
};

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
    const [teamEditorSessionId, setTeamEditorSessionId] = useState(0);
    const [memberDialogOpen, setMemberDialogOpen] = useState(false);
    const [memberDialogSessionId, setMemberDialogSessionId] = useState(0);
    const [roleEditor, setRoleEditor] = useState<{
        readonly mode: "create" | "edit";
        readonly role?: AuthorizationAdministrationTeamDetailData["roles"][number];
    } | null>(null);
    const [roleEditorSessionId, setRoleEditorSessionId] = useState(0);
    const [grantSource, setGrantSource] = useState<"TEAM" | "TEAM_ROLE" | null>(null);
    const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
    const [lifecycleTarget, setLifecycleTarget] = useState<LifecycleTarget | null>(null);
    const [removeMemberTarget, setRemoveMemberTarget] = useState<RemoveMemberTarget | null>(null);
    const [confirmationSessionId, setConfirmationSessionId] = useState(0);
    const [pendingKey, setPendingKey] = useState<string | null>(null);

    const openMemberDialog = (): void => {
        onDirectoryQueryChange("");
        setMemberDialogSessionId((current) => current + 1);
        setMemberDialogOpen(true);
    };

    const closeMemberDialog = (): void => {
        onDirectoryQueryChange("");
        setMemberDialogOpen(false);
    };

    const openTeamEditor = (): void => {
        setTeamEditorSessionId((current) => current + 1);
        setTeamEditorOpen(true);
    };

    const openCreateRole = (): void => {
        setRoleEditorSessionId((current) => current + 1);
        setRoleEditor({ mode: "create" });
    };

    const openEditRole = (role: AuthorizationAdministrationTeamDetailData["roles"][number]): void => {
        setRoleEditorSessionId((current) => current + 1);
        setRoleEditor({ mode: "edit", role });
    };

    const openLifecycleConfirmation = (target: LifecycleTarget): void => {
        setConfirmationSessionId((current) => current + 1);
        setLifecycleTarget(target);
    };

    const openRemoveMemberConfirmation = (target: RemoveMemberTarget): void => {
        setConfirmationSessionId((current) => current + 1);
        setRemoveMemberTarget(target);
    };

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

    if (loading && !team) return <LoadingState label="กำลังโหลดรายละเอียดทีม" />;
    if (error && !team) {
        return (
            <ErrorState
                title="โหลดรายละเอียดทีมไม่สำเร็จ"
                description="อาจมีการเปลี่ยนแปลงจากผู้มีสิทธิ์จัดการสิทธิ์คนอื่น หรือไม่สามารถเชื่อมต่อได้"
                action={{ label: "ลองใหม่", onClick: () => void onRefresh(), icon: <RefreshCw aria-hidden="true" /> }}
            />
        );
    }
    if (!team) return <EmptyState title="ยังไม่ได้เลือกทีม" description="เลือกทีมจากรายการด้านบนเพื่อดูรายละเอียด" />;

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
                        <p className="mt-3 max-w-3xl text-sm leading-6 text-content-secondary">{team.description || "ยังไม่มีคำอธิบายทีม"}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => void onRefresh()} disabled={isBusy}>
                            <RefreshCw aria-hidden="true" />โหลดใหม่
                        </Button>
                        <Button type="button" variant="outline" size="sm" onClick={openTeamEditor} disabled={isBusy}>
                            <Edit3 aria-hidden="true" />แก้ไขข้อมูล
                        </Button>
                        <Button type="button" variant={team.isActive ? "destructive" : "default"} size="sm" onClick={() => openLifecycleConfirmation({ kind: "team", id: team.id, name: team.name, nextActive: !team.isActive })} disabled={isBusy}>
                            {team.isActive ? "ปิดใช้งานทีม" : "เปิดใช้งานทีม"}
                        </Button>
                    </div>
                </div>
                <div className="grid gap-3 border-b border-border-subtle bg-surface-subtle/60 px-4 py-3 sm:grid-cols-4 sm:px-5">
                    <Count label="หน้าที่ในทีม" value={team.roleCount} />
                    <Count label="สมาชิก" value={team.membershipCount} />
                    <Count label="สิทธิ์ของทีม" value={team.teamGrantCount} />
                </div>
                <nav aria-label="ส่วนของทีม" className="overflow-x-auto border-b border-border-subtle">
                    <div className="flex min-w-max gap-1 px-3 py-2 sm:px-4">
                        <TeamTabButton active={tab === "details"} onClick={() => setTab("details")}>รายละเอียด</TeamTabButton>
                        <TeamTabButton active={tab === "members"} onClick={() => setTab("members")}>สมาชิก</TeamTabButton>
                        <TeamTabButton active={tab === "permissions"} onClick={() => setTab("permissions")}>หน้าที่ในทีมและสิทธิ์</TeamTabButton>
                    </div>
                </nav>
            </section>

            {error ? <p role="alert" className="text-sm text-status-danger-strong">รายละเอียดอาจไม่ใช่ข้อมูลล่าสุด กรุณาโหลดข้อมูลทีมอีกครั้ง</p> : null}
            <ConfigurationIssues issues={team.configurationIssues} title="พบการตั้งค่าสิทธิ์ของทีมที่ต้องตรวจสอบ" />

            {tab === "details" ? <TeamDetails team={team} /> : null}
            {tab === "members" ? (
                <MembersPanel
                    team={team}
                    busy={isBusy}
                    onAdd={openMemberDialog}
                    onSelectUser={onSelectUser}
                    onChangeRole={(userId, teamRoleId) => void runInlineMutation(`member-role:${userId}`, async () => { await changeMemberRole(team.id, userId, { teamRoleId }); }, userId, "เปลี่ยนหน้าที่ในทีมแล้ว")}
                    onRemove={(userId, name) => openRemoveMemberConfirmation({ userId, name })}
                />
            ) : null}
            {tab === "permissions" ? (
                <PermissionsPanel
                    team={team}
                    selectedRoleId={selectedRoleId}
                    onSelectedRoleIdChange={setSelectedRoleId}
                    busy={isBusy}
                    onAddTeamGrant={() => setGrantSource("TEAM")}
                    onAddRoleGrant={() => setGrantSource("TEAM_ROLE")}
                     onRemoveTeamGrant={(grant) => runMutation(`team-grant-remove:${grant.capabilityKey}:${grant.scope}`, async () => { await removeTeamGrant(team.id, { capabilityKey: grant.capabilityKey, scope: grant.scope }); }, "นำสิทธิ์ของทีมออกแล้ว")}
                     onRemoveRoleGrant={(grant) => selectedRole ? runMutation(`role-grant-remove:${grant.capabilityKey}:${grant.scope}`, async () => { await removeTeamRoleGrant(team.id, selectedRole.id, { capabilityKey: grant.capabilityKey, scope: grant.scope }); }, "นำสิทธิ์ของหน้าที่ในทีมออกแล้ว") : Promise.resolve()}
                     onCreateRole={openCreateRole}
                     onEditRole={openEditRole}
                    onLifecycleRole={(role) => openLifecycleConfirmation({ kind: "role", id: role.id, name: role.name, nextActive: !role.isActive })}
                />
            ) : null}

            <TeamFormDialog
                key={`${team.id}:${teamEditorSessionId}`}
                open={teamEditorOpen}
                mode="edit"
                team={team}
                busy={pendingKey === "team-update"}
                onClose={() => setTeamEditorOpen(false)}
                onSubmit={async (input) => {
                    const { name, description } = input;
                    await runMutation("team-update", async () => { await updateTeam(team.id, { name, description }); }, "บันทึกข้อมูลทีมแล้ว");
                    setTeamEditorOpen(false);
                }}
            />
            <TeamRoleFormDialog
                key={`${team.id}:${roleEditor?.mode ?? "closed"}:${roleEditor?.role?.id ?? "new"}:${roleEditorSessionId}`}
                open={roleEditor !== null}
                mode={roleEditor?.mode ?? "create"}
                role={roleEditor?.role}
                busy={pendingKey === "role-save"}
                onClose={() => setRoleEditor(null)}
                onSubmit={async (input) => {
                    const editingRole = roleEditor?.role;
                    if (roleEditor?.mode === "edit" && editingRole) {
                        await runMutation("role-save", async () => { await updateTeamRole(team.id, editingRole.id, { name: input.name }); }, "บันทึกหน้าที่ในทีมแล้ว");
                    } else if (roleEditor?.mode === "create") {
                        await runMutation("role-save", async () => { await createTeamRole(team.id, { key: input.key ?? createAuthorizationTechnicalKey("role"), name: input.name }); }, "สร้างหน้าที่ในทีมแล้ว");
                    } else {
                        throw new Error("ไม่พบข้อมูลหน้าที่ในทีมที่ต้องการแก้ไข");
                    }
                    setRoleEditor(null);
                }}
            />
            <AddMemberDialog
                key={`${team.id}:${memberDialogSessionId}`}
                open={memberDialogOpen}
                team={team}
                users={directoryUsers}
                roles={team.roles}
                query={directoryQuery}
                usersLoading={directoryLoading}
                usersError={directoryError}
                busy={pendingKey === "member-add"}
                onQueryChange={onDirectoryQueryChange}
                onClose={closeMemberDialog}
                onSubmit={async (input) => {
                    await runMutation("member-add", async () => { await addMember(team.id, input); }, "เพิ่มสมาชิกในทีมแล้ว", input.userId);
                    closeMemberDialog();
                }}
            />
            {grantSource ? (
                <GrantFormDialog
                    key={`${team.id}:${grantSource}:${grantSource === "TEAM_ROLE" ? selectedRole?.id ?? "none" : "team"}`}
                    open
                    source={grantSource}
                    capabilities={overview.capabilities}
                    busy={pendingKey === `grant-add:${grantSource}`}
                    onClose={() => setGrantSource(null)}
                    onSubmit={async (input) => {
                        if (grantSource === "TEAM") {
                            await runMutation("grant-add:TEAM", async () => { await addTeamGrant(team.id, input); }, "เพิ่มสิทธิ์ให้ทีมแล้ว");
                        } else if (selectedRole) {
                            await runMutation("grant-add:TEAM_ROLE", async () => { await addTeamRoleGrant(team.id, selectedRole.id, input); }, "เพิ่มสิทธิ์ให้หน้าที่ในทีมแล้ว");
                        }
                        setGrantSource(null);
                    }}
                />
            ) : null}
            <ConfirmAuthorizationAction
                open={lifecycleTarget !== null}
                sessionId={`lifecycle:${lifecycleTarget?.kind ?? "closed"}:${lifecycleTarget?.id ?? "closed"}:${lifecycleTarget?.nextActive ?? "closed"}:${confirmationSessionId}`}
                title={lifecycleTarget?.nextActive ? `เปิดใช้งาน ${lifecycleTarget.name}` : `ปิดใช้งาน ${lifecycleTarget?.name ?? "รายการ"}`}
                description={lifecycleTarget?.kind === "team" && lifecycleTarget.nextActive === false
                    ? "สมาชิกและสิทธิ์ที่ตั้งค่าไว้จะไม่ถูกลบ แต่การเข้าถึงจากทีมจะหยุดใช้งานจนกว่าจะเปิดทีมอีกครั้ง"
                    : lifecycleTarget?.kind === "role" && lifecycleTarget.nextActive === false
                        ? "การปิดใช้งานจะไม่ลบสมาชิกหรือสิทธิ์ของหน้าที่นี้ แต่สมาชิกจะไม่ได้รับสิทธิ์จากหน้าที่นี้จนกว่าจะเปิดใช้งาน"
                        : "การเปลี่ยนสถานะจะถูกตรวจสอบโดยระบบ และข้อมูลเดิมจะยังคงตรวจสอบได้"}
                confirmLabel={lifecycleTarget?.nextActive ? "เปิดใช้งาน" : "ปิดใช้งาน"}
                destructive={lifecycleTarget?.nextActive === false}
                busy={pendingKey === "lifecycle"}
                onClose={() => setLifecycleTarget(null)}
                onConfirm={async () => {
                    if (!lifecycleTarget) return;
                    if (lifecycleTarget.kind === "team") {
                        await runMutation("lifecycle", async () => { await updateTeam(team.id, { isActive: lifecycleTarget.nextActive }); }, lifecycleTarget.nextActive ? "เปิดใช้งานทีมแล้ว" : "ปิดใช้งานทีมแล้ว");
                    } else {
                        await runMutation("lifecycle", async () => { await updateTeamRole(team.id, lifecycleTarget.id, { isActive: lifecycleTarget.nextActive }); }, lifecycleTarget.nextActive ? "เปิดใช้งานหน้าที่ในทีมแล้ว" : "ปิดใช้งานหน้าที่ในทีมแล้ว");
                    }
                    setLifecycleTarget(null);
                }}
            />
            <ConfirmAuthorizationAction
                open={removeMemberTarget !== null}
                sessionId={`member-remove:${removeMemberTarget?.userId ?? "closed"}:${confirmationSessionId}`}
                 title="นำสมาชิกออกจากทีม?"
                 description={removeMemberTarget ? `นำ ${removeMemberTarget.name} ออกจาก ${team.name} หรือไม่ สิทธิ์ที่มาจากทีมอาจหายไป แต่บัญชีผู้ใช้จะไม่ถูกลบ` : ""}
                 confirmLabel="นำออกจากทีม"
                destructive
                busy={pendingKey === "member-remove"}
                onClose={() => setRemoveMemberTarget(null)}
                onConfirm={async () => {
                    if (!removeMemberTarget) return;
                     await runMutation("member-remove", async () => { await removeMember(team.id, removeMemberTarget.userId); }, "นำสมาชิกออกจากทีมแล้ว", removeMemberTarget.userId);
                    setRemoveMemberTarget(null);
                }}
            />
        </div>
    );
}

function PermissionsPanel({
    team,
    selectedRoleId,
    onSelectedRoleIdChange,
    busy,
    onAddTeamGrant,
    onAddRoleGrant,
    onRemoveTeamGrant,
    onRemoveRoleGrant,
    onCreateRole,
    onEditRole,
    onLifecycleRole,
}: {
    readonly team: AuthorizationAdministrationTeamDetailData;
    readonly selectedRoleId: number | null;
    readonly onSelectedRoleIdChange: (id: number | null) => void;
    readonly busy: boolean;
    readonly onAddTeamGrant: () => void;
    readonly onAddRoleGrant: () => void;
    readonly onRemoveTeamGrant: (grant: AuthorizationAdministrationGrantProjectionData) => Promise<void>;
    readonly onRemoveRoleGrant: (grant: AuthorizationAdministrationGrantProjectionData) => Promise<void>;
    readonly onCreateRole: () => void;
    readonly onEditRole: (role: AuthorizationAdministrationTeamDetailData["roles"][number]) => void;
    readonly onLifecycleRole: (role: AuthorizationAdministrationTeamDetailData["roles"][number]) => void;
}): ReactElement {
    const selectedRole = team.roles.find((role) => role.id === selectedRoleId) ?? null;
    return (
        <section className="space-y-4 rounded-xl border border-border-subtle bg-surface-subtle/60 p-3 sm:p-4" aria-labelledby="authorization-team-permissions-heading">
            <header>
                <h2 id="authorization-team-permissions-heading" className="text-base font-semibold text-content-heading">สิทธิ์ของทีมและหน้าที่ในทีม</h2>
                <p className="mt-1 text-sm leading-6 text-content-secondary">แยกดูสิทธิ์ของทีม หน้าที่ในทีม และสิทธิ์ของหน้าที่ที่กำลังเลือก</p>
            </header>
            <div className="space-y-4">
                <GrantList
                    title="สิทธิ์ของทีม"
                    description="สมาชิกทุกคนในทีมนี้ได้รับสิทธิ์เพิ่มเติมนี้ตามสถานะและกฎของระบบ"
                    source="TEAM"
                    grants={team.teamGrants}
                    busy={busy}
                    onAdd={onAddTeamGrant}
                    onRemove={onRemoveTeamGrant}
                />
                <RolesPanel
                    team={team}
                    selectedRoleId={selectedRoleId}
                    busy={busy}
                    onCreate={onCreateRole}
                    onEdit={onEditRole}
                    onLifecycle={onLifecycleRole}
                    onSelect={onSelectedRoleIdChange}
                />
                {selectedRole ? (
                    <RoleGrantsPanel
                        team={team}
                        selectedRoleId={selectedRoleId}
                        onSelectedRoleIdChange={onSelectedRoleIdChange}
                        busy={busy}
                        onAdd={onAddRoleGrant}
                        onRemove={onRemoveRoleGrant}
                    />
                ) : (
                    <EmptyState title="เลือกหน้าที่ในทีมเพื่อดูสิทธิ์" description="เลือกหน้าที่จากรายการด้านบนเพื่อดูหรือจัดการสิทธิ์ของหน้าที่นั้น" />
                )}
            </div>
        </section>
    );
}

function TeamDetails({ team }: { readonly team: AuthorizationAdministrationTeamDetailData }): ReactElement {
    return (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(260px,0.7fr)]">
            <div className="rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-5">
                <div className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-action-primary-foreground" aria-hidden="true" /><h3 className="text-base font-semibold text-content-heading">สิทธิ์ของทีมทำงานอย่างไร</h3></div>
                <p className="mt-2 text-sm leading-6 text-content-secondary">สิทธิ์ของทีมมีผลกับสมาชิกทุกคนในทีม ส่วนสิทธิ์ของหน้าที่ในทีมมีผลเฉพาะสมาชิกที่ได้รับหน้าที่นั้น ระบบจะตรวจสอบสถานะของทีม สมาชิก และรายการจริงอีกครั้งเมื่อใช้งาน</p>
                <dl className="mt-5 grid gap-3 border-t border-border-subtle pt-4 text-sm sm:grid-cols-2">
                    <Detail label="ชื่อทีม" value={team.name} />
                    <Detail label="สมาชิก" value={String(team.membershipCount)} />
                    <Detail label="หน้าที่ในทีม" value={String(team.roleCount)} />
                </dl>
            </div>
            <div className="rounded-xl border border-border-subtle bg-surface-subtle/60 p-4 sm:p-5">
                <h3 className="text-base font-semibold text-content-heading">สิ่งที่ยังคงตรวจสอบได้</h3>
                <ul className="mt-3 space-y-2 text-sm leading-6 text-content-secondary">
                    <li>• สมาชิกทั้งหมด รวมบัญชีที่ปิดใช้งาน</li>
                    <li>• หน้าที่ในทีมและสิทธิ์ที่ตั้งค่าไว้</li>
                    <li>• รายการตั้งค่าสิทธิ์ที่ต้องตรวจสอบ</li>
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
                <div><h3 className="text-base font-semibold text-content-heading">สมาชิกทีม</h3><p className="mt-1 text-sm leading-6 text-content-secondary">สมาชิกทีมเป็นรายชื่อที่กำหนดไว้โดยตรง และไม่อนุมานจากแผนกหรือตำแหน่ง</p></div>
                <Button type="button" size="sm" onClick={onAdd} disabled={busy}><Plus aria-hidden="true" />เพิ่มสมาชิก</Button>
            </div>
            {team.memberships.length === 0 ? <EmptyState compact className="m-4 border-dashed" title="ยังไม่มีสมาชิก" description="ค้นหาผู้ใช้เพื่อเพิ่มสมาชิกในทีมนี้" action={{ label: "เพิ่มสมาชิก", onClick: onAdd, icon: <Plus aria-hidden="true" /> }} /> : (
                <div className="overflow-x-auto">
                    <table className="min-w-[920px] w-full text-left text-sm">
                        <caption className="sr-only">สมาชิกของ {team.name}</caption>
                        <thead className="border-b border-border-subtle bg-surface-subtle text-xs font-semibold text-content-secondary"><tr><th scope="col" className="px-4 py-3 sm:px-5">ผู้ใช้</th><th scope="col" className="px-4 py-3">สถานะบัญชี</th><th scope="col" className="px-4 py-3">พนักงาน</th><th scope="col" className="px-4 py-3">หน้าที่ในทีม</th><th scope="col" className="px-4 py-3"><span className="sr-only">การดำเนินการ</span></th></tr></thead>
                        <tbody className="divide-y divide-border-subtle">{team.memberships.map((membership) => <tr key={membership.userId}>
                            <td className="px-4 py-3 sm:px-5"><button type="button" className="text-left hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => onSelectUser(membership.userId)}><span className="block font-semibold text-content-heading">{membership.user.name}</span><span className="mt-0.5 block text-xs text-content-secondary">{membership.user.email}</span></button></td>
                            <td className="px-4 py-3"><LifecycleStatus isActive={membership.user.isActive} deletedAt={membership.user.deletedAt} /></td>
                            <td className="px-4 py-3">{membership.user.employee ? <span className="space-y-1"><span className="block text-content-body">{membership.user.employee.displayName}</span><span className="block text-xs text-content-secondary">{getEmployeeStatusLabel(membership.user.employee.status, membership.user.employee.deletedAt)}</span></span> : <span className="text-content-secondary">ไม่เชื่อมกับพนักงาน</span>}</td>
                            <td className="px-4 py-3"><select aria-label={`หน้าที่ในทีมของ ${membership.user.name}`} value={membership.teamRoleId ? String(membership.teamRoleId) : ""} onChange={(event) => onChangeRole(membership.userId, event.target.value ? Number(event.target.value) : null)} disabled={busy} className="h-11 min-w-48 rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><option value="">ไม่มีหน้าที่เฉพาะ</option>{team.roles.map((role) => <option key={role.id} value={role.id} disabled={!role.isActive}>{role.name}{role.isActive ? "" : " — ปิดใช้งาน"}</option>)}</select></td>
                            <td className="px-4 py-3 text-right"><Button type="button" variant="outline" size="xs" onClick={() => onRemove(membership.userId, membership.user.name)} disabled={busy} aria-label={`นำ ${membership.user.name} ออกจากทีม`}><UserMinus aria-hidden="true" />นำออก</Button></td>
                        </tr>)}</tbody>
                    </table>
                </div>
            )}
        </section>
    );
}

function RolesPanel({
    team,
    selectedRoleId,
    busy,
    onCreate,
    onEdit,
    onLifecycle,
    onSelect,
}: {
    readonly team: AuthorizationAdministrationTeamDetailData;
    readonly selectedRoleId: number | null;
    readonly busy: boolean;
    readonly onCreate: () => void;
    readonly onEdit: (role: AuthorizationAdministrationTeamDetailData["roles"][number]) => void;
    readonly onLifecycle: (role: AuthorizationAdministrationTeamDetailData["roles"][number]) => void;
    readonly onSelect: (id: number | null) => void;
}): ReactElement {
    return (
        <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
            <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5"><div><h3 className="text-base font-semibold text-content-heading">หน้าที่ในทีม</h3><p className="mt-1 text-sm leading-6 text-content-secondary">หน้าที่ช่วยแยกความรับผิดชอบของสมาชิกภายในทีม และสิทธิ์ของแต่ละหน้าที่จะแสดงต่อในบริบทเดียวกัน</p></div><Button type="button" size="sm" onClick={onCreate} disabled={busy}><Plus aria-hidden="true" />เพิ่มหน้าที่</Button></div>
            {team.roles.length === 0 ? <EmptyState compact className="m-4 border-dashed" title="ยังไม่มีหน้าที่เฉพาะ" description="เพิ่มหน้าที่เมื่อสมาชิกในทีมมีความรับผิดชอบต่างกัน" action={{ label: "เพิ่มหน้าที่", onClick: onCreate, icon: <Plus aria-hidden="true" /> }} /> : <div className="overflow-x-auto"><table className="min-w-[760px] w-full text-left text-sm"><caption className="sr-only">หน้าที่ในทีมของ {team.name}</caption><thead className="border-b border-border-subtle bg-surface-subtle text-xs font-semibold text-content-secondary"><tr><th scope="col" className="px-4 py-3 sm:px-5">หน้าที่ในทีม</th><th scope="col" className="px-4 py-3">สถานะ</th><th scope="col" className="px-4 py-3">สมาชิก</th><th scope="col" className="px-4 py-3">สิทธิ์</th><th scope="col" className="px-4 py-3"><span className="sr-only">การดำเนินการ</span></th></tr></thead><tbody className="divide-y divide-border-subtle">{team.roles.map((role) => <tr key={role.id} className={selectedRoleId === role.id ? "bg-action-primary-surface" : undefined}><td className="px-4 py-3 sm:px-5"><button type="button" aria-pressed={selectedRoleId === role.id} onClick={() => onSelect(role.id)} className="text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><span className="block font-semibold text-content-heading">{role.name}</span><span className="mt-1 block text-xs text-content-secondary">เลือกเพื่อดูสิทธิ์ของหน้าที่</span></button></td><td className="px-4 py-3"><ActiveStatus isActive={role.isActive} /></td><td className="px-4 py-3 tabular-nums">{role.membershipCount}</td><td className="px-4 py-3 tabular-nums">{role.grantCount}</td><td className="px-4 py-3 text-right"><div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" size="xs" onClick={() => onEdit(role)} disabled={busy}><Edit3 aria-hidden="true" />แก้ไข</Button><Button type="button" variant={role.isActive ? "outline" : "default"} size="xs" onClick={() => onLifecycle(role)} disabled={busy}>{role.isActive ? "ปิดใช้งาน" : "เปิดใช้งาน"}</Button></div></td></tr>)}</tbody></table></div>}
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
            <section className="rounded-xl border border-border-subtle bg-surface-raised px-4 py-4 sm:px-5"><label htmlFor="authorization-selected-team-role" className="text-sm font-semibold text-content-heading">หน้าที่ที่กำลังดูสิทธิ์</label><select id="authorization-selected-team-role" value={selectedRoleId === null ? "" : String(selectedRoleId)} onChange={(event) => onSelectedRoleIdChange(event.target.value ? Number(event.target.value) : null)} className="mt-2 h-11 w-full max-w-xl rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><option value="">เลือกหน้าที่ในทีม</option>{team.roles.map((item) => <option key={item.id} value={item.id}>{item.name}{item.isActive ? "" : " — ปิดใช้งาน"}</option>)}</select><p className="mt-2 text-xs leading-5 text-content-secondary">เฉพาะสมาชิกที่มีหน้าที่นี้ในทีมจะได้รับสิทธิ์ของหน้าที่</p></section>
            {role ? <GrantList title={`สิทธิ์ของหน้าที่ในทีม · ${role.name}`} description="เฉพาะสมาชิกที่มีหน้าที่นี้ในทีมจะได้รับสิทธิ์เพิ่มเติมนี้" source="TEAM_ROLE" grants={grants} busy={busy} onAdd={onAdd} onRemove={(grant) => onRemove(grant)} /> : <EmptyState title="เลือกหน้าที่ในทีม" description="เลือกหน้าที่เพื่อดูหรือจัดการสิทธิ์ของหน้าที่นั้น" />}
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
