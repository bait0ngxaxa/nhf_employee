import { useMemo, useState } from "react";
import type { LeaveStatusValue as LeaveStatus, LeaveTypeValue as LeaveType } from "../../types";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
    useLeaveProfile,
    type LeaveQuota,
    type LeaveQuotaBalance,
    type LeaveProfileResponse,
    type LeaveRequest,
} from "./useLeaveProfile";
import type { LeaveHistoryFilters } from "../../../application/queries/history-filters";

const EMPTY_LEAVE_QUOTA: LeaveQuotaBalance = {
    totalDays: 0,
    carryBalanceDays: 0,
    effectiveTotalDays: 0,
    usedDays: 0,
    remainingDays: 0,
};

export interface EmployeeLeaveDashboardModel {
    isLoading: boolean;
    isRequestFormOpen: boolean;
    quotas: LeaveQuota[];
    history: LeaveRequest[];
    metadata: LeaveProfileResponse["metadata"] | undefined;
    page: number;
    isSubmitting: boolean;
    cancelConfirmRequest: LeaveRequest | null;
    cancelReason: string;
    notTakenRequestId: string | null;
    notTakenNote: string;
    historyQuery: string;
    historyLeaveType: LeaveType | "";
    historyStatus: LeaveStatus | "";
    historyYear: string;
    historyFilters: LeaveHistoryFilters;
    hasHistoryFilters: boolean;
    sickQuota: LeaveQuotaBalance;
    personalQuota: LeaveQuotaBalance;
    vacationQuota: LeaveQuotaBalance;
    setPage: (page: number) => void;
    setHistoryQuery: (value: string) => void;
    setHistoryLeaveType: (value: LeaveType | "") => void;
    setHistoryStatus: (value: LeaveStatus | "") => void;
    setHistoryYear: (value: string) => void;
    resetHistoryFilters: () => void;
    openRequestForm: () => void;
    closeRequestForm: () => void;
    onRequestSuccess: () => Promise<void>;
    openCancelDialog: (request: LeaveRequest) => void;
    closeCancelDialog: () => void;
    setCancelReason: (value: string) => void;
    confirmCancelLeave: () => Promise<void>;
    openNotTakenDialog: (leaveId: string) => void;
    closeNotTakenDialog: () => void;
    setNotTakenNote: (value: string) => void;
    confirmNotTakenRequest: () => Promise<void>;
}

export function useEmployeeLeaveDashboardModel(): EmployeeLeaveDashboardModel {
    const [isRequestFormOpen, setIsRequestFormOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [cancelConfirmRequest, setCancelConfirmRequest] = useState<LeaveRequest | null>(null);
    const [cancelReason, setCancelReason] = useState("");
    const [notTakenRequestId, setNotTakenRequestId] = useState<string | null>(null);
    const [notTakenNote, setNotTakenNote] = useState("");
    const [historyQuery, setHistoryQuery] = useState("");
    const [historyLeaveType, setHistoryLeaveType] = useState<LeaveType | "">("");
    const [historyStatus, setHistoryStatus] = useState<LeaveStatus | "">("");
    const [historyYear, setHistoryYear] = useState("");
    const debouncedHistoryQuery = useDebouncedValue(historyQuery.trim());
    const historyFilters = useMemo<LeaveHistoryFilters>(() => {
        const filters: LeaveHistoryFilters = {};

        if (debouncedHistoryQuery) {
            filters.query = debouncedHistoryQuery;
        }
        if (historyLeaveType) {
            filters.leaveType = historyLeaveType;
        }
        if (historyStatus) {
            filters.status = historyStatus;
        }
        if (historyYear) {
            filters.year = Number(historyYear);
        }

        return filters;
    }, [debouncedHistoryQuery, historyLeaveType, historyStatus, historyYear]);
    const hasHistoryFilters = Boolean(
        historyQuery.trim()
        || historyLeaveType
        || historyStatus
        || historyYear,
    );
    const {
        quotas,
        history,
        metadata,
        isLoading,
        mutate,
        cancelLeave,
        requestApprovedCancellation,
        requestNotTaken,
    } = useLeaveProfile({ page, filters: historyFilters });

    const getQuota = (type: LeaveType): LeaveQuotaBalance =>
        quotas.find((quota) => quota.leaveType === type) ?? EMPTY_LEAVE_QUOTA;

    const closeRequestForm = (): void => {
        setIsRequestFormOpen(false);
    };

    const handleHistoryQueryChange = (value: string): void => {
        setHistoryQuery(value);
        setPage(1);
    };

    const handleHistoryLeaveTypeChange = (value: LeaveType | ""): void => {
        setHistoryLeaveType(value);
        setPage(1);
    };

    const handleHistoryStatusChange = (value: LeaveStatus | ""): void => {
        setHistoryStatus(value);
        setPage(1);
    };

    const handleHistoryYearChange = (value: string): void => {
        setHistoryYear(value);
        setPage(1);
    };

    const resetHistoryFilters = (): void => {
        setHistoryQuery("");
        setHistoryLeaveType("");
        setHistoryStatus("");
        setHistoryYear("");
        setPage(1);
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
        historyQuery,
        historyLeaveType,
        historyStatus,
        historyYear,
        historyFilters,
        hasHistoryFilters,
        sickQuota: getQuota("SICK"),
        personalQuota: getQuota("PERSONAL"),
        vacationQuota: getQuota("VACATION"),
        setPage,
        setHistoryQuery: handleHistoryQueryChange,
        setHistoryLeaveType: handleHistoryLeaveTypeChange,
        setHistoryStatus: handleHistoryStatusChange,
        setHistoryYear: handleHistoryYearChange,
        resetHistoryFilters,
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
