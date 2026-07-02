import { useState } from "react";
import { toast } from "sonner";
import {
    useLeaveApprovals,
    type LeaveApprovalPaginationMetadata,
    type PendingLeave,
} from "@/hooks/useLeaveApprovals";
import {
    confirmLeaveNotTaken,
    submitLeaveApprovalAction,
    type LeaveApprovalAction,
} from "@/lib/services/leave/client";

interface UseManagerApprovalModelResult {
    pending: PendingLeave[];
    notTakenPending: PendingLeave[];
    history: PendingLeave[];
    metadata?: {
        pending: LeaveApprovalPaginationMetadata;
        notTakenPending: LeaveApprovalPaginationMetadata;
        history: LeaveApprovalPaginationMetadata;
    };
    isLoading: boolean;
    selectedLeave: PendingLeave | null;
    approvalConfirmLeave: PendingLeave | null;
    isRejectDialogOpen: boolean;
    rejectReason: string;
    isProcessing: boolean;
    setRejectReason: (value: string) => void;
    setPendingPage: (page: number) => void;
    setNotTakenPage: (page: number) => void;
    setHistoryPage: (page: number) => void;
    openRejectDialog: (leave: PendingLeave) => void;
    closeRejectDialog: () => void;
    approveLeave: (leave: PendingLeave) => Promise<void>;
    closeApprovalConfirmDialog: () => void;
    confirmApproveLeave: () => Promise<void>;
    confirmNotTaken: (leaveId: string) => Promise<void>;
    rejectLeave: () => Promise<void>;
}

export function useManagerApprovalModel(): UseManagerApprovalModelResult {
    const [pendingPage, setPendingPage] = useState(1);
    const [notTakenPage, setNotTakenPage] = useState(1);
    const [historyPage, setHistoryPage] = useState(1);
    const { pending, notTakenPending, history, metadata, isLoading, mutate } = useLeaveApprovals({
        pendingPage,
        notTakenPage,
        historyPage,
    });
    const [selectedLeave, setSelectedLeave] = useState<PendingLeave | null>(null);
    const [approvalConfirmLeave, setApprovalConfirmLeave] = useState<PendingLeave | null>(null);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);

    const resetRejectDialog = (): void => {
        setIsRejectDialogOpen(false);
        setRejectReason("");
        setSelectedLeave(null);
    };

    const refreshFirstPages = async (): Promise<void> => {
        setPendingPage(1);
        setNotTakenPage(1);
        setHistoryPage(1);
        await mutate();
    };

    const executeAction = async (action: LeaveApprovalAction, leaveId: string, reason?: string): Promise<void> => {
        setIsProcessing(true);
        try {
            await submitLeaveApprovalAction({ leaveId, action, reason });
            await refreshFirstPages();
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

    const approveLeave = async (leave: PendingLeave): Promise<void> => {
        if (hasApprovalWarnings(leave)) {
            setApprovalConfirmLeave(leave);
            return;
        }
        await executeAction("APPROVE", leave.id);
    };

    const confirmApproveLeave = async (): Promise<void> => {
        if (!approvalConfirmLeave) {
            return;
        }

        const leaveId = approvalConfirmLeave.id;
        setApprovalConfirmLeave(null);
        await executeAction("APPROVE", leaveId);
    };

    const confirmNotTaken = async (leaveId: string): Promise<void> => {
        setIsProcessing(true);
        try {
            await confirmLeaveNotTaken({ leaveId });
            await refreshFirstPages();
            toast.success("ยืนยันไม่ได้ใช้วันลาและคืนโควต้าแล้ว");
        } catch (error: unknown) {
            toast.error(
                error instanceof Error && error.message
                    ? error.message
                    : "เกิดข้อผิดพลาดในการยืนยันไม่ได้ใช้วันลา",
            );
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        pending,
        notTakenPending,
        history,
        metadata,
        isLoading,
        selectedLeave,
        approvalConfirmLeave,
        isRejectDialogOpen,
        rejectReason,
        isProcessing,
        setRejectReason,
        setPendingPage,
        setNotTakenPage,
        setHistoryPage,
        openRejectDialog: (leave: PendingLeave) => {
            setSelectedLeave(leave);
            setIsRejectDialogOpen(true);
        },
        closeRejectDialog: resetRejectDialog,
        approveLeave,
        closeApprovalConfirmDialog: () => setApprovalConfirmLeave(null),
        confirmApproveLeave,
        confirmNotTaken,
        rejectLeave: async () => {
            if (!selectedLeave) return;
            await executeAction("REJECT", selectedLeave.id, rejectReason);
        },
    };
}

function hasApprovalWarnings(leave: PendingLeave): boolean {
    return Boolean(leave.emergencyReason || leave.specialReason || leave.overQuotaDays > 0);
}
