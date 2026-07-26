import { useState } from "react";
import { toast } from "sonner";
import { useLeaveProfile, type LeaveRequest } from "@/hooks/useLeaveProfile";

export function useEmployeeLeaveDashboardModel() {
    const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cancelConfirmRequest, setCancelConfirmRequest] = useState<LeaveRequest | null>(null);
    const [cancelReason, setCancelReason] = useState("");
    const [notTakenRequestId, setNotTakenRequestId] = useState<string | null>(null);
    const [notTakenNote, setNotTakenNote] = useState("");
    const {
        quotas,
        history,
        metadata,
        isLoading,
        mutate,
        cancelLeave,
        requestApprovedCancellation,
        requestNotTaken,
    } = useLeaveProfile(page);

    const getQuota = (type: "SICK" | "PERSONAL" | "VACATION") =>
        quotas.find((quota) => quota.leaveType === type) || { totalDays: 0, usedDays: 0 };

    const closeRequestForm = (): void => {
        setIsRequestFormOpen(false);
    };

    const openRequestForm = (): void => {
        setIsRequestFormOpen(true);
    };

    const onRequestSuccess = async (): Promise<void> => {
        await mutate();
        setIsRequestFormOpen(false);
    };

    const openCancelDialog = (request: LeaveRequest): void => {
        setCancelConfirmRequest(request);
        setCancelReason("");
    };

    const closeCancelDialog = (): void => {
        setCancelConfirmRequest(null);
        setCancelReason("");
    };

    const openNotTakenDialog = (leaveId: string): void => {
        setNotTakenRequestId(leaveId);
        setNotTakenNote("");
    };

    const closeNotTakenDialog = (): void => {
        setNotTakenRequestId(null);
        setNotTakenNote("");
    };

    const confirmCancelLeave = async (): Promise<void> => {
        if (!cancelConfirmRequest) {
            return;
        }

        try {
            setIsSubmitting(true);
            if (cancelConfirmRequest.status === "PENDING") {
                await cancelLeave(cancelConfirmRequest.id);
                toast.success("ยกเลิกคำขอลาเรียบร้อยแล้ว");
            } else {
                await requestApprovedCancellation(cancelConfirmRequest.id, cancelReason);
                toast.success("ส่งคำขอยกเลิกวันลาแล้ว รอผู้อนุมัติยืนยัน");
            }
        } catch (error: unknown) {
            toast.error(
                error instanceof Error && error.message
                    ? error.message
                    : "เกิดข้อผิดพลาดในการยกเลิกคำขอลา",
            );
        } finally {
            setIsSubmitting(false);
            closeCancelDialog();
        }
    };

    const confirmNotTakenRequest = async (): Promise<void> => {
        if (!notTakenRequestId || !notTakenNote.trim()) {
            return;
        }

        try {
            setIsSubmitting(true);
            await requestNotTaken(notTakenRequestId, notTakenNote);
            toast.success("ส่งคำขอแจ้งไม่ได้ใช้วันลาแล้ว");
        } catch (error: unknown) {
            toast.error(
                error instanceof Error && error.message
                    ? error.message
                    : "เกิดข้อผิดพลาดในการแจ้งไม่ได้ใช้วันลา",
            );
        } finally {
            setIsSubmitting(false);
            closeNotTakenDialog();
        }
    };

    return {
        isLoading,
        isRequestFormOpen,
        quotas,
        history,
        metadata,
        page,
        isSubmitting,
        cancelConfirmRequest,
        cancelReason,
        notTakenRequestId,
        notTakenNote,
        sickQuota: getQuota("SICK"),
        personalQuota: getQuota("PERSONAL"),
        vacationQuota: getQuota("VACATION"),
        setPage,
        openRequestForm,
        closeRequestForm,
        onRequestSuccess,
        openCancelDialog,
        closeCancelDialog,
        setCancelReason,
        confirmCancelLeave,
        openNotTakenDialog,
        closeNotTakenDialog,
        setNotTakenNote,
        confirmNotTakenRequest,
    };
}
