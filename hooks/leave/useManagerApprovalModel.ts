import { useState } from "react";
import { toast } from "sonner";
import {
    useLeaveApprovals,
    type LeaveApprovalPaginationMetadata,
    type PendingLeave,
} from "@/hooks/useLeaveApprovals";
import {
    confirmLeaveCancellation,
    confirmLeaveNotTaken,
    rejectLeaveCancellation,
    submitLeaveDecision,
    type LeaveDecisionAction,
} from "@/lib/services/leave/client";

interface UseManagerApprovalModelResult {
    pending: PendingLeave[];
    notTakenPending: PendingLeave[];
    history: PendingLeave[];
    cancellationPending: PendingLeave[];
    metadata?: {
        pending: LeaveApprovalPaginationMetadata;
        notTakenPending: LeaveApprovalPaginationMetadata;
        history: LeaveApprovalPaginationMetadata;
        cancellationPending: LeaveApprovalPaginationMetadata;
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
    setCancellationPage: (page: number) => void;
    openRejectDialog: (leave: PendingLeave) => void;
    closeRejectDialog: () => void;
    approveLeave: (leave: PendingLeave) => Promise<void>;
    closeApprovalConfirmDialog: () => void;
    confirmApproveLeave: () => Promise<void>;
    confirmNotTaken: (leaveId: string, reason?: string) => Promise<boolean>;
    confirmCancellation: (leaveId: string, reason?: string) => Promise<boolean>;
    rejectCancellation: (leaveId: string, reason?: string) => Promise<boolean>;
    rejectLeave: () => Promise<void>;
}

export function useManagerApprovalModel(): UseManagerApprovalModelResult {
    const [pendingPage, setPendingPage] = useState(1);
    const [notTakenPage, setNotTakenPage] = useState(1);
    const [historyPage, setHistoryPage] = useState(1);
    const [cancellationPage, setCancellationPage] = useState(1);
    const { pending, notTakenPending, history, cancellationPending, metadata, isLoading, mutate } = useLeaveApprovals({
        pendingPage,
        notTakenPage,
        historyPage,
        cancellationPage,
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
        setCancellationPage(1);
        await mutate();
    };

    const executeAction = async (action: LeaveDecisionAction, leaveId: string, reason?: string): Promise<void> => {
        setIsProcessing(true);
        try {
            await submitLeaveDecision({ leaveId, action, reason });
            await refreshFirstPages();
            if (action === "APPROVE") {
                toast.success("อนุมัติคำขอลาเรียบร้อยแล้ว");
            } else {
                toast.success("ปฏิเสธคำขอลาเรียบร้อยแล้ว");
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

    const confirmNotTaken = async (leaveId: string, reason?: string): Promise<boolean> => {
        setIsProcessing(true);
        try {
            await confirmLeaveNotTaken({ leaveId, reason });
            await refreshFirstPages();
            toast.success("ยืนยันไม่ได้ใช้วันลาและคืนโควต้าแล้ว");
            return true;
        } catch (error: unknown) {
            toast.error(
                error instanceof Error && error.message
                    ? error.message
                    : "เกิดข้อผิดพลาดในการยืนยันไม่ได้ใช้วันลา",
            );
            return false;
        } finally {
            setIsProcessing(false);
        }
    };

    const confirmCancellation = async (leaveId: string, reason?: string): Promise<boolean> => {
        setIsProcessing(true);
        try {
            await confirmLeaveCancellation({ leaveId, reason });
            await refreshFirstPages();
            toast.success("ยืนยันยกเลิกวันลาและคืนโควต้าแล้ว");
            return true;
        } catch (error: unknown) {
            toast.error(
                error instanceof Error && error.message
                    ? error.message
                    : "เกิดข้อผิดพลาดในการยืนยันยกเลิกวันลา",
            );
            return false;
        } finally {
            setIsProcessing(false);
        }
    };

    const rejectCancellation = async (leaveId: string, reason?: string): Promise<boolean> => {
        setIsProcessing(true);
        try {
            await rejectLeaveCancellation({ leaveId, reason });
            await refreshFirstPages();
            toast.success("ปิดคำขอยกเลิกแล้ว คำขอลายังคงอนุมัติ");
            return true;
        } catch (error: unknown) {
            toast.error(
                error instanceof Error && error.message
                    ? error.message
                    : "เกิดข้อผิดพลาดในการปิดคำขอยกเลิก",
            );
            return false;
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        pending,
        notTakenPending,
        history,
        cancellationPending,
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
        setCancellationPage,
        openRejectDialog: (leave: PendingLeave) => {
            setSelectedLeave(leave);
            setIsRejectDialogOpen(true);
        },
        closeRejectDialog: resetRejectDialog,
        approveLeave,
        closeApprovalConfirmDialog: () => setApprovalConfirmLeave(null),
        confirmApproveLeave,
        confirmNotTaken,
        confirmCancellation,
        rejectCancellation,
        rejectLeave: async () => {
            if (!selectedLeave) return;
            await executeAction("REJECT", selectedLeave.id, rejectReason);
        },
    };
}

function hasApprovalWarnings(leave: PendingLeave): boolean {
    return Boolean(leave.emergencyReason || leave.specialReason || leave.overQuotaDays > 0);
}
