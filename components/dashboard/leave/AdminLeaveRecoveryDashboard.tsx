"use client";

import { useState, type ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { useAdminLeaveRecoveryModel } from "@/hooks/leave/useAdminLeaveRecoveryModel";
import {
    AdminRecoveryReasonDialog,
    type AdminRecoveryDecision,
} from "./_components/AdminRecoveryReasonDialog";
import { CancellationPendingList } from "./_components/CancellationPendingList";
import {
    ApprovalPagination,
    ApprovalSectionHeader,
} from "./_components/ApprovalDashboardPrimitives";
import { NotTakenPendingList } from "./_components/NotTakenPendingList";
import { AdminLeaveRecoveryDashboardSkeleton } from "./LeaveSkeletons";

export function AdminLeaveRecoveryDashboard(): ReactElement {
    const model = useAdminLeaveRecoveryModel();
    const [recoveryAction, setRecoveryAction] = useState<{
        decision: AdminRecoveryDecision;
        leaveId: string;
    } | null>(null);
    const [recoveryReason, setRecoveryReason] = useState("");

    const openRecoveryDialog = (
        decision: AdminRecoveryDecision,
        leaveId: string,
    ): Promise<boolean> => {
        setRecoveryAction({ decision, leaveId });
        setRecoveryReason("");
        return Promise.resolve(true);
    };

    const closeRecoveryDialog = (): void => {
        if (model.isProcessing) return;
        setRecoveryAction(null);
        setRecoveryReason("");
    };

    const submitRecoveryDecision = async (): Promise<void> => {
        if (!recoveryAction || !recoveryReason.trim()) return;

        const { decision, leaveId } = recoveryAction;
        const succeeded = decision === "NOT_TAKEN"
            ? await model.confirmNotTaken(leaveId, recoveryReason)
            : decision === "CONFIRM_CANCELLATION"
                ? await model.confirmCancellation(leaveId, recoveryReason)
                : await model.rejectCancellation(leaveId, recoveryReason);
        if (succeeded) {
            closeRecoveryDialog();
        }
    };

    if (model.isLoading) {
        return <AdminLeaveRecoveryDashboardSkeleton />;
    }

    if (model.isError) {
        return (
            <div
                className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm/6 text-rose-900"
                role="alert"
            >
                <p className="font-semibold">ไม่สามารถโหลดรายการกู้คืนได้</p>
                <p className="mt-1">กรุณาลองใหม่อีกครั้ง หากยังไม่สำเร็จให้ติดต่อผู้ดูแลระบบ</p>
                <Button
                    type="button"
                    variant="outline"
                    className="mt-3 border-rose-300 bg-white text-rose-800 hover:bg-rose-100 hover:text-rose-900"
                    onClick={() => void model.refresh()}
                    disabled={model.isProcessing}
                >
                    ลองใหม่
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm/6 text-amber-950">
                <p className="font-semibold">การกู้คืนรายการลาโดยผู้ดูแลระบบ</p>
                <p className="mt-1">
                    ใช้เฉพาะกรณีผู้อนุมัติที่มีผลไม่พร้อมใช้งาน การดำเนินการทุกครั้งต้องระบุเหตุผลและถูกบันทึกเพื่อตรวจสอบย้อนหลัง
                </p>
            </div>

            <div className="space-y-3">
                <ApprovalSectionHeader
                    title="รายการกู้คืนไม่ได้ใช้วันลา"
                    description="ยืนยันคืนโควต้าแทนผู้อนุมัติเดิมที่ไม่พร้อมใช้งาน"
                    count={model.metadata?.notTakenPending.totalItems ?? model.notTakenPending.length}
                    tone="info"
                />
                <NotTakenPendingList
                    items={model.notTakenPending}
                    isProcessing={model.isProcessing}
                    onConfirm={(leaveId) => openRecoveryDialog("NOT_TAKEN", leaveId)}
                />
                <ApprovalPagination
                    metadata={model.metadata?.notTakenPending}
                    onPageChange={model.setNotTakenPage}
                />
            </div>

            <div className="space-y-3 pt-2">
                <ApprovalSectionHeader
                    title="รายการกู้คืนคำขอยกเลิกวันลา"
                    description="ยืนยันเพื่อคืนโควต้า หรือปิดคำขอเพื่อคงสถานะอนุมัติเดิม"
                    count={model.metadata?.cancellationPending.totalItems ?? model.cancellationPending.length}
                    tone="attention"
                />
                <CancellationPendingList
                    items={model.cancellationPending}
                    isProcessing={model.isProcessing}
                    onConfirm={(leaveId) =>
                        openRecoveryDialog("CONFIRM_CANCELLATION", leaveId)}
                    onReject={(leaveId) =>
                        openRecoveryDialog("REJECT_CANCELLATION", leaveId)}
                />
                <ApprovalPagination
                    metadata={model.metadata?.cancellationPending}
                    onPageChange={model.setCancellationPage}
                />
            </div>

            <AdminRecoveryReasonDialog
                open={recoveryAction !== null}
                decision={recoveryAction?.decision ?? null}
                reason={recoveryReason}
                isProcessing={model.isProcessing}
                onOpenChange={(open) => {
                    if (!open) closeRecoveryDialog();
                }}
                onReasonChange={setRecoveryReason}
                onConfirm={submitRecoveryDecision}
            />
        </div>
    );
}
