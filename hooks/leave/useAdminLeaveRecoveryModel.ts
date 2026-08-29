import { useState } from "react";
import { toast } from "sonner";

import {
    confirmLeaveCancellation,
    confirmLeaveNotTaken,
    rejectLeaveCancellation,
} from "@/lib/services/leave/client";
import {
    useLeaveAdminRecovery,
    type LeaveAdminRecoveryResponse,
} from "@/hooks/leave/useLeaveAdminRecovery";
import type { PendingLeave } from "@/hooks/useLeaveApprovals";

interface UseAdminLeaveRecoveryModelResult {
    notTakenPending: PendingLeave[];
    cancellationPending: PendingLeave[];
    metadata?: LeaveAdminRecoveryResponse["metadata"];
    isLoading: boolean;
    isError?: Error;
    isProcessing: boolean;
    setNotTakenPage: (page: number) => void;
    setCancellationPage: (page: number) => void;
    confirmNotTaken: (leaveId: string, reason: string) => Promise<boolean>;
    confirmCancellation: (leaveId: string, reason: string) => Promise<boolean>;
    rejectCancellation: (leaveId: string, reason: string) => Promise<boolean>;
    refresh: () => Promise<void>;
}

export function useAdminLeaveRecoveryModel(): UseAdminLeaveRecoveryModelResult {
    const [notTakenPage, setNotTakenPage] = useState(1);
    const [cancellationPage, setCancellationPage] = useState(1);
    const {
        notTakenPending,
        cancellationPending,
        metadata,
        isLoading,
        isError,
        mutate,
    } = useLeaveAdminRecovery({ notTakenPage, cancellationPage });
    const [isProcessing, setIsProcessing] = useState(false);

    const refreshFirstPage = async (): Promise<void> => {
        setNotTakenPage(1);
        setCancellationPage(1);
        await mutate();
    };

    const executeRecovery = async (
        action: "NOT_TAKEN" | "CONFIRM_CANCELLATION" | "REJECT_CANCELLATION",
        leaveId: string,
        reason: string,
    ): Promise<boolean> => {
        setIsProcessing(true);
        try {
            if (action === "NOT_TAKEN") {
                await confirmLeaveNotTaken({ leaveId, reason });
                toast.success("ยืนยันคืนโควต้าแล้ว");
            } else if (action === "CONFIRM_CANCELLATION") {
                await confirmLeaveCancellation({ leaveId, reason });
                toast.success("ยืนยันยกเลิกวันลาและคืนโควต้าแล้ว");
            } else {
                await rejectLeaveCancellation({ leaveId, reason });
                toast.success("ปิดคำขอยกเลิกแล้ว คำขอลายังคงอนุมัติ");
            }
            await refreshFirstPage();
            return true;
        } catch (error: unknown) {
            toast.error(
                error instanceof Error && error.message
                    ? error.message
                    : "เกิดข้อผิดพลาดในการกู้คืนรายการลา",
            );
            return false;
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        notTakenPending,
        cancellationPending,
        metadata,
        isLoading,
        isError,
        isProcessing,
        setNotTakenPage,
        setCancellationPage,
        confirmNotTaken: (leaveId, reason) =>
            executeRecovery("NOT_TAKEN", leaveId, reason),
        confirmCancellation: (leaveId, reason) =>
            executeRecovery("CONFIRM_CANCELLATION", leaveId, reason),
        rejectCancellation: (leaveId, reason) =>
            executeRecovery("REJECT_CANCELLATION", leaveId, reason),
        refresh: async () => {
            await mutate();
        },
    };
}
