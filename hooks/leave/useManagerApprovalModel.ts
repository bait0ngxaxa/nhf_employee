import { useState } from "react";
import { toast } from "sonner";
import { useLeaveApprovals, type PendingLeave } from "@/hooks/useLeaveApprovals";
import {
    submitLeaveApprovalAction,
    type LeaveApprovalAction,
} from "@/lib/services/leave/client";

interface UseManagerApprovalModelResult {
    pending: PendingLeave[];
    history: PendingLeave[];
    isLoading: boolean;
    selectedLeave: PendingLeave | null;
    isRejectDialogOpen: boolean;
    rejectReason: string;
    isProcessing: boolean;
    setRejectReason: (value: string) => void;
    openRejectDialog: (leave: PendingLeave) => void;
    closeRejectDialog: () => void;
    approveLeave: (leaveId: string) => Promise<void>;
    rejectLeave: () => Promise<void>;
}

export function useManagerApprovalModel(): UseManagerApprovalModelResult {
    const { pending, history, isLoading, mutate } = useLeaveApprovals();
    const [selectedLeave, setSelectedLeave] = useState<PendingLeave | null>(null);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const resetRejectDialog = (): void => {
        setIsRejectDialogOpen(false);
        setRejectReason("");
        setSelectedLeave(null);
    };

    const executeAction = async (action: LeaveApprovalAction, leaveId: string, reason?: string): Promise<void> => {
        setIsProcessing(true);
        try {
            await submitLeaveApprovalAction({ leaveId, action, reason });
            await mutate();
            if (action === "APPROVE") {
                toast.success("อนุมัติใบลาเรียบร้อยแล้ว");
            } else {
                toast.success("ปฏิเสธใบลาเรียบร้อยแล้ว");
            }
            resetRejectDialog();
        } catch (error: unknown) {
            toast.error(
                error instanceof Error && error.message
                    ? error.message
                    : "เกิดข้อผิดพลาดในการดำเนินการ",
            );
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        pending,
        history,
        isLoading,
        selectedLeave,
        isRejectDialogOpen,
        rejectReason,
        isProcessing,
        setRejectReason,
        openRejectDialog: (leave: PendingLeave) => {
            setSelectedLeave(leave);
            setIsRejectDialogOpen(true);
        },
        closeRejectDialog: resetRejectDialog,
        approveLeave: async (leaveId: string) => executeAction("APPROVE", leaveId),
        rejectLeave: async () => {
            if (!selectedLeave) return;
            await executeAction("REJECT", selectedLeave.id, rejectReason);
        },
    };
}
