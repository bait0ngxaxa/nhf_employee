"use client";

import { useCallback, useState, type ReactElement } from "react";
import { RefreshCw, Users } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";

import { createTeam } from "./api";
import {
    TeamFormDialog,
} from "./components/AuthorizationDialogs";
import { AuthorizationSummary } from "./components/AuthorizationSummary";
import { TeamAdministration } from "./components/TeamAdministration";
import { UserAccessPanel } from "./components/UserAccessPanel";
import { getMutationErrorCopy } from "./display";
import { useAuthorizationAdministrationData } from "./hooks/useAuthorizationAdministration";
import { createAuthorizationTechnicalKey } from "./technical-key";
import type {
    AuthorizationAdministrationOverviewData,
    CreateAuthorizationTeamInput,
} from "./types";

type WorkspaceTab = "teams" | "users";

export function AuthorizationAdministrationWorkspace({
    initialOverview,
}: {
    readonly initialOverview?: AuthorizationAdministrationOverviewData;
}): ReactElement {
    const [tab, setTab] = useState<WorkspaceTab>("teams");
    const [selectedTeamId, setSelectedTeamId] = useState<number | null>(null);
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [directoryQuery, setDirectoryQuery] = useState("");
    const [createTeamOpen, setCreateTeamOpen] = useState(false);
    const [createTeamBusy, setCreateTeamBusy] = useState(false);

    const data = useAuthorizationAdministrationData({
        initialOverview,
        selectedTeamId,
        selectedUserId,
        userSearchQuery: directoryQuery,
    });
    const overview = data.overview;
    const { refreshDirectory, refreshOverview, refreshTeam, refreshUser } = data;

    const refreshRelevant = useCallback(async (
        affectedUserId?: number,
        includeOverview = true,
    ): Promise<void> => {
        const refreshes: Promise<unknown>[] = includeOverview ? [refreshOverview()] : [];
        if (affectedUserId !== undefined) refreshes.push(refreshDirectory());
        if (selectedTeamId !== null) refreshes.push(refreshTeam());
        if (selectedUserId !== null && (affectedUserId === undefined || affectedUserId === selectedUserId)) {
            refreshes.push(refreshUser());
        }
        await Promise.all(refreshes);
    }, [refreshDirectory, refreshOverview, refreshTeam, refreshUser, selectedTeamId, selectedUserId]);

    const handleCreateTeam = async (input: CreateAuthorizationTeamInput): Promise<void> => {
        setCreateTeamBusy(true);
        let team: Awaited<ReturnType<typeof createTeam>>;
        try {
            team = await createTeam(input);
        } catch (error) {
            const copy = getMutationErrorCopy(error);
            toast.error(copy.title, { description: copy.description });
            setCreateTeamBusy(false);
            throw error;
        }

        setSelectedTeamId(team.id);
        setTab("teams");
        setCreateTeamOpen(false);
        try {
            await refreshOverview();
            toast.success("สร้างทีมแล้ว");
        } catch {
            toast.success("สร้างทีมแล้ว", {
                description: "โหลดรายการล่าสุดไม่สำเร็จ กรุณากดโหลดใหม่เพื่อตรวจสอบทีมที่สร้าง",
            });
        } finally {
            setCreateTeamBusy(false);
        }
    };

    const selectTeam = useCallback((teamId: number): void => {
        setSelectedTeamId(teamId);
        setTab("teams");
    }, []);

    const selectUser = useCallback((userId: number): void => {
        setSelectedUserId(userId);
        setTab("users");
    }, []);

    return (
        <main className="mx-auto w-full max-w-[1440px] space-y-5 px-4 py-5 sm:px-6 sm:py-7 xl:px-8">
            <header className="flex flex-col gap-4 border-b border-border-subtle pb-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-4xl">
                    <h1 className="text-2xl font-semibold tracking-tight text-content-heading sm:text-3xl">การจัดการสิทธิ์</h1>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-content-secondary">จัดทีม สมาชิก และสิทธิ์การทำงานของแต่ละส่วนในระบบ</p>
                </div>
                <Button type="button" variant="outline" size="sm" onClick={() => void refreshRelevant()} disabled={data.overviewLoading} aria-busy={data.overviewLoading}><RefreshCw className={data.overviewLoading ? "animate-spin" : ""} aria-hidden="true" />โหลดข้อมูลล่าสุด</Button>
            </header>

            <nav aria-label="ส่วนการจัดการสิทธิ์" className="overflow-x-auto rounded-xl border border-border-subtle bg-surface-raised">
                <div className="flex min-w-max gap-1 p-2">
                    <WorkspaceTabButton active={tab === "teams"} onClick={() => setTab("teams")}>ทีม</WorkspaceTabButton>
                    <WorkspaceTabButton active={tab === "users"} onClick={() => setTab("users")}><Users aria-hidden="true" />ผู้ใช้งาน</WorkspaceTabButton>
                </div>
            </nav>

            {tab === "teams" ? (
                <>
                    <AuthorizationSummary
                        overview={overview}
                        loading={data.overviewLoading}
                        error={data.overviewError}
                        selectedTeamId={selectedTeamId}
                        onSelectTeam={selectTeam}
                        onCreateTeam={() => setCreateTeamOpen(true)}
                        onRefresh={() => void refreshOverview()}
                    />
                    {overview && selectedTeamId !== null ? (
                        <TeamAdministration
                            team={data.team}
                            loading={data.teamLoading}
                            error={data.teamError}
                            overview={overview}
                            directoryQuery={directoryQuery}
                            directoryUsers={data.directoryUsers ?? []}
                            directoryLoading={data.directoryLoading}
                            directoryError={data.directoryError}
                            onDirectoryQueryChange={setDirectoryQuery}
                            onSelectUser={selectUser}
                            onRefresh={refreshRelevant}
                        />
                    ) : null}
                </>
            ) : null}
            {tab === "users" && overview ? (
                <UserAccessPanel
                    user={data.user}
                    loading={data.userLoading}
                    error={data.userError}
                    overview={overview}
                    query={directoryQuery}
                    directoryUsers={data.directoryUsers ?? []}
                    directoryLoading={data.directoryLoading}
                    directoryError={data.directoryError}
                    onQueryChange={setDirectoryQuery}
                    onSelectUser={selectUser}
                    onSelectTeam={selectTeam}
                    onRefresh={() => refreshRelevant(selectedUserId ?? undefined, false)}
                />
            ) : null}
            <TeamFormDialog
                open={createTeamOpen}
                mode="create"
                busy={createTeamBusy}
                onClose={() => setCreateTeamOpen(false)}
                onSubmit={async (input) => {
                    await handleCreateTeam({
                        key: input.key ?? createAuthorizationTechnicalKey("team"),
                        name: input.name,
                        description: input.description,
                    });
                }}
            />
        </main>
    );
}

function WorkspaceTabButton({ active, onClick, children }: { readonly active: boolean; readonly onClick: () => void; readonly children: React.ReactNode }): ReactElement {
    return <button type="button" onClick={onClick} aria-current={active ? "page" : undefined} className={`inline-flex min-h-11 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${active ? "bg-action-primary-surface text-action-primary-foreground" : "text-content-secondary hover:bg-surface-subtle hover:text-content-heading"}`}>{children}</button>;
}
