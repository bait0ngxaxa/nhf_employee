import { useState } from "react";
import { toast } from "sonner";
import { useLeaveProfile } from "@/hooks/useLeaveProfile";

export function useEmployeeLeaveDashboardModel() {
    const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cancelConfirmId, setCancelConfirmId] = useState<string | null>(null);
    const { quotas, history, metadata, isLoading, mutate, cancelLeave } = useLeaveProfile(page);

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

    const openCancelDialog = (leaveId: string): void => {
        setCancelConfirmId(leaveId);
    };

    const closeCancelDialog = (): void => {
        setCancelConfirmId(null);
    };

    const confirmCancelLeave = async (): Promise<void> => {
        if (!cancelConfirmId) {
            return;
        }

        try {
            setIsSubmitting(true);
            await cancelLeave(cancelConfirmId);
            toast.success("ยกเลิกคำขอลาเรียบร้อยแล้ว");
        } catch {
            toast.error("เกิดข้อผิดพลาดในการยกเลิกคำขอลา");
        } finally {
            setIsSubmitting(false);
            setCancelConfirmId(null);
        }
    };

    return {
        isLoading,
        isRequestFormOpen,
        history,
        metadata,
        page,
        isSubmitting,
        cancelConfirmId,
        sickQuota: getQuota("SICK"),
        personalQuota: getQuota("PERSONAL"),
        vacationQuota: getQuota("VACATION"),
        setPage,
        openRequestForm,
        closeRequestForm,
        onRequestSuccess,
        openCancelDialog,
        closeCancelDialog,
        confirmCancelLeave,
    };
}
