"use client";

import { Plus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { ALL_LEAVE_STATUSES } from "../../domain/constants";
import { LeaveRequestForm } from "./LeaveRequestForm";
import { LEAVE_THEME_BUTTON_CLASS } from "./leaveTheme";
import {
    useEmployeeLeaveDashboardModel,
    type EmployeeLeaveDashboardModel,
} from "./hooks/useEmployeeLeaveDashboardModel";
import { LeaveQuotaCards } from "./components/LeaveQuotaCards";
import { EmployeeLeaveHistoryList } from "./components/EmployeeLeaveHistoryList";
import { LeaveHistoryFilters } from "./components/LeaveHistoryFilters";
import { CancelLeaveDialog } from "./components/CancelLeaveDialog";
import { NotTakenRequestDialog } from "./components/NotTakenRequestDialog";
import { EmployeeLeaveDashboardSkeleton } from "./LeaveSkeletons";
import type { LeavePresentationCapabilities } from "../../application/types";
import type { LeaveRequest } from "./hooks/useLeaveProfile";
import { getEmployeeLeaveActions } from "../../domain/action-availability";

interface EmployeeLeaveDashboardProps {
    leaveCapabilities?: LeavePresentationCapabilities;
}

export function EmployeeLeaveDashboard({
    leaveCapabilities,
}: EmployeeLeaveDashboardProps) {
    const model = useEmployeeLeaveDashboardModel(leaveCapabilities);

    if (model.isLoading) {
        return <EmployeeLeaveDashboardSkeleton />;
    }

    if (!model.canReadOwnRequests) {
        return (
            <div
                className="border-y border-status-warning-border bg-status-warning-surface px-4 py-5 text-sm leading-6 text-status-warning-strong"
                role="status"
            >
                บัญชีนี้ยังไม่มีสิทธิ์ดูข้อมูลวันลาของตนเอง
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                    <p className="text-sm/6 font-medium text-module-leave-badge-foreground">วันลาของฉัน</p>
                    <h2 className="mt-1 text-xl/7 font-semibold tracking-tight text-content-heading">
                        โควต้าวันลาของคุณ
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm/6 text-content-secondary">
                        ดูสิทธิ์คงเหลือก่อนยื่นคำขอใหม่
                    </p>
                </div>
                {model.canCreateOwnRequests ? (
                    <EmployeeLeaveRequestCapabilitySession
                        quotas={model.quotas}
                        onRequestSuccess={model.onRequestSuccess}
                    />
                ) : null}
            </div>

            <LeaveQuotaCards
                sickQuota={model.sickQuota}
                personalQuota={model.personalQuota}
                vacationQuota={model.vacationQuota}
            />

            <div className="mt-2 space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                    <div className="min-w-0">
                        <h2 className="text-xl/7 font-semibold tracking-tight text-content-heading">
                            ประวัติการลา
                        </h2>
                        <p className="mt-1 max-w-2xl text-sm/6 text-content-secondary">
                            รายการล่าสุดพร้อมสถานะและการดำเนินการที่ยังทำได้
                        </p>
                    </div>
                    <span className="w-fit rounded-full border border-module-leave-badge-border bg-module-leave-badge-surface px-3 py-1 text-sm font-medium text-module-leave-badge-foreground">
                        {model.metadata?.totalItems ?? model.history.length} รายการ
                    </span>
                </div>
                <LeaveHistoryFilters
                    query={model.historyQuery}
                    queryPlaceholder="ค้นหาเหตุผลหรือรายละเอียด..."
                    queryLabel="ค้นหาประวัติการลา"
                    leaveType={model.historyLeaveType}
                    status={model.historyStatus}
                    year={model.historyYear}
                    yearOptions={model.metadata?.availableYears ?? []}
                    statusOptions={ALL_LEAVE_STATUSES}
                    hasActiveFilters={model.hasHistoryFilters}
                    onQueryChange={model.setHistoryQuery}
                    onLeaveTypeChange={model.setHistoryLeaveType}
                    onStatusChange={model.setHistoryStatus}
                    onYearChange={model.setHistoryYear}
                    onReset={model.resetHistoryFilters}
                />
                <LeaveHistoryActionCapabilitySurface model={model} />
            </div>
        </div>
    );
}

function EmployeeLeaveRequestCapabilitySession({
    quotas,
    onRequestSuccess,
}: {
    quotas: EmployeeLeaveDashboardModel["quotas"];
    onRequestSuccess: () => Promise<void>;
}) {
    const [isOpen, setIsOpen] = useState(false);

    const handleSuccess = async (): Promise<void> => {
        await onRequestSuccess();
        setIsOpen(false);
    };

    return (
        <>
            <Button className={LEAVE_THEME_BUTTON_CLASS} onClick={() => setIsOpen(true)}>
                <Plus data-icon="inline-start" /> ยื่นคำขอลา
            </Button>
            <LeaveRequestForm
                open={isOpen}
                onSuccess={handleSuccess}
                onCancel={() => setIsOpen(false)}
                quotas={quotas}
                canCreateRequests
            />
        </>
    );
}

interface CancelSessionRenderProps {
    onCancelRequest: (request: LeaveRequest) => void;
    dialog: ReactNode;
}

interface NotTakenSessionRenderProps {
    onNotTakenRequest: (leaveId: string) => void;
    dialog: ReactNode;
}

function LeaveHistoryActionCapabilitySurface({
    model,
}: {
    model: EmployeeLeaveDashboardModel;
}) {
    const renderHistory = (
        onCancelRequest: (request: LeaveRequest) => void,
        onNotTakenRequest: (leaveId: string) => void,
        dialogs: ReactNode,
    ): ReactNode => (
        <>
            <EmployeeLeaveHistoryList
                history={model.history}
                metadata={model.metadata}
                isFiltered={model.hasHistoryFilters}
                isSubmitting={model.isSubmitting}
                onCancelRequest={onCancelRequest}
                onNotTakenRequest={onNotTakenRequest}
                onPageChange={model.setPage}
                canCancelOwnRequests={model.canCancelOwnRequests}
                canRequestOwnNotTaken={model.canRequestOwnNotTaken}
            />
            {dialogs}
        </>
    );

    return (
        <LeaveCancelCapabilitySession
            enabled={model.canCancelOwnRequests}
            isSubmitting={model.isSubmitting}
            onConfirm={model.confirmCancelLeave}
        >
            {({ onCancelRequest, dialog: cancelDialog }) => (
                <LeaveNotTakenCapabilitySession
                    enabled={model.canRequestOwnNotTaken}
                    history={model.history}
                    isSubmitting={model.isSubmitting}
                    onConfirm={model.confirmNotTakenRequest}
                >
                    {({ onNotTakenRequest, dialog: notTakenDialog }) =>
                        renderHistory(
                            onCancelRequest,
                            onNotTakenRequest,
                            <>
                                {cancelDialog}
                                {notTakenDialog}
                            </>,
                        )}
                </LeaveNotTakenCapabilitySession>
            )}
        </LeaveCancelCapabilitySession>
    );
}

function LeaveCancelCapabilitySession({
    enabled,
    isSubmitting,
    onConfirm,
    children,
}: {
    enabled: boolean;
    isSubmitting: boolean;
    onConfirm: (request: LeaveRequest, reason: string) => Promise<void>;
    children: (props: CancelSessionRenderProps) => ReactNode;
}) {
    const [session, setSession] = useState({
        enabled,
        cancelTarget: null as LeaveRequest | null,
        cancelReason: "",
    });
    if (session.enabled !== enabled) {
        setSession({
            enabled,
            cancelTarget: null,
            cancelReason: "",
        });
    }
    const cancelTarget = enabled && session.enabled ? session.cancelTarget : null;
    const cancelReason = enabled && session.enabled ? session.cancelReason : "";

    const openCancelDialog = (request: LeaveRequest): void => {
        if (!enabled) return;
        const availableActions = getEmployeeLeaveActions(request);
        if (
            (!availableActions.includes("CANCEL")
                && !availableActions.includes("REQUEST_CANCELLATION"))
        ) {
            return;
        }
        setSession((current) => ({
            ...current,
            cancelTarget: request,
            cancelReason: "",
        }));
    };

    const closeCancelDialog = (): void => {
        setSession((current) => ({
            ...current,
            cancelTarget: null,
            cancelReason: "",
        }));
    };

    const confirmCancelLeave = async (): Promise<void> => {
        if (!cancelTarget) {
            return;
        }
        await onConfirm(cancelTarget, cancelReason);
        closeCancelDialog();
    };

    return children({
        onCancelRequest: openCancelDialog,
        dialog: (
            <CancelLeaveDialog
                open={cancelTarget !== null}
                isSubmitting={isSubmitting}
                requiresApproval={cancelTarget?.status === "APPROVED"}
                reason={cancelReason}
                onReasonChange={(reason) => setSession((current) => ({
                    ...current,
                    cancelReason: reason,
                }))}
                onOpenChange={(open) => {
                    if (!open) closeCancelDialog();
                }}
                onConfirm={confirmCancelLeave}
            />
        ),
    });
}

function LeaveNotTakenCapabilitySession({
    enabled,
    history,
    isSubmitting,
    onConfirm,
    children,
}: {
    enabled: boolean;
    history: LeaveRequest[];
    isSubmitting: boolean;
    onConfirm: (leaveId: string, note: string) => Promise<void>;
    children: (props: NotTakenSessionRenderProps) => ReactNode;
}) {
    const [session, setSession] = useState({
        enabled,
        requestId: null as string | null,
        note: "",
    });
    if (session.enabled !== enabled) {
        setSession({
            enabled,
            requestId: null,
            note: "",
        });
    }
    const notTakenRequestId = enabled && session.enabled ? session.requestId : null;
    const notTakenNote = enabled && session.enabled ? session.note : "";

    const openNotTakenDialog = (leaveId: string): void => {
        if (!enabled) return;
        const request = history.find((item) => item.id === leaveId);
        if (!request || !getEmployeeLeaveActions(request).includes("REQUEST_NOT_TAKEN")) {
            return;
        }
        setSession((current) => ({
            ...current,
            requestId: leaveId,
            note: "",
        }));
    };

    const closeNotTakenDialog = (): void => {
        setSession((current) => ({
            ...current,
            requestId: null,
            note: "",
        }));
    };

    const confirmNotTakenRequest = async (): Promise<void> => {
        if (!notTakenRequestId) {
            return;
        }
        await onConfirm(notTakenRequestId, notTakenNote);
        closeNotTakenDialog();
    };

    return children({
        onNotTakenRequest: openNotTakenDialog,
        dialog: (
            <NotTakenRequestDialog
                open={notTakenRequestId !== null}
                note={notTakenNote}
                isSubmitting={isSubmitting}
                onNoteChange={(note) => setSession((current) => ({
                    ...current,
                    note,
                }))}
                onOpenChange={(open) => {
                    if (!open) closeNotTakenDialog();
                }}
                onConfirm={confirmNotTakenRequest}
            />
        ),
    });
}
