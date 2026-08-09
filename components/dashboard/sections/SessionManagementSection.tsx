"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

import { useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";
import { SessionManagementSkeleton } from "@/components/dashboard/session-management/SessionManagementSkeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SessionManagementView } from "@/components/dashboard/session-management/SessionManagementView";
import { useSessionManagement } from "@/components/dashboard/session-management/useSessionManagement";

function SessionErrorState({ onRetry }: { onRetry: () => void }) {
    return (
        <div className="min-h-[calc(100dvh-6rem)] overflow-hidden rounded-2xl border border-border-subtle bg-surface-subtle">
            <div className="space-y-5 p-4 md:p-8">
                <h1
                    data-page-heading
                    tabIndex={-1}
                    className="text-2xl font-bold tracking-tight text-content-heading"
                >
                    จัดการเซสชัน
                </h1>
                <Card className="rounded-2xl border-status-danger-border bg-surface-raised shadow-sm">
                    <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 gap-3">
                            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-status-danger-foreground" />
                            <div className="min-w-0 space-y-1">
                                <p className="font-semibold text-status-danger-strong">
                                    โหลดข้อมูลเซสชันไม่สำเร็จ
                                </p>
                                <p className="text-sm leading-6 text-status-danger-strong [overflow-wrap:anywhere]">
                                    กรุณาลองใหม่อีกครั้ง หากยังไม่สำเร็จให้เข้าสู่ระบบใหม่
                                </p>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="outline"
                            className="h-11 shrink-0 border-status-danger-border text-status-danger-strong hover:bg-status-danger-surface"
                            onClick={onRetry}
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            โหลดใหม่
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export function SessionManagementSection() {
    const { handleSignOut } = useDashboardUIContext();
    const {
        sessions,
        currentSession,
        error,
        isLoading,
        isValidating,
        revokingId,
        isRevokingOthers,
        confirmAction,
        setConfirmAction,
        refresh,
        handleConfirmAction,
    } = useSessionManagement({ onSignOutCurrent: handleSignOut });

    if (isLoading) {
        return <SessionManagementSkeleton />;
    }

    if (error) {
        return (
            <SessionErrorState
                onRetry={() => {
                    void refresh();
                }}
            />
        );
    }

    return (
        <SessionManagementView
            sessions={sessions}
            currentSession={currentSession}
            revokingId={revokingId}
            isRevokingOthers={isRevokingOthers}
            isValidating={isValidating}
            confirmAction={confirmAction}
            onSetConfirmAction={setConfirmAction}
            onRefresh={() => {
                void refresh();
            }}
            onConfirmAction={() => {
                void handleConfirmAction();
            }}
        />
    );
}
