import { useMemo, useState } from "react";
import type { LeaveStatusValue as LeaveStatus, LeaveTypeValue as LeaveType } from "../../types";
import { toast } from "sonner";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
    useLeaveApprovals,
    type LeaveApprovalPaginationMetadata,
    type PendingLeave,
} from "./useLeaveApprovals";
import type { LeaveHistoryFilters, LeaveHistoryMetadata } from "../../../application/queries/history-filters";
import type { LeavePresentationCapabilities } from "../../../application/types";
import {
    confirmLeaveCancellation,
    confirmLeaveNotTaken,
    rejectLeaveCancellation,
    submitLeaveDecision,
    type LeaveDecisionAction,
} from "../api";

export interface UseManagerApprovalModelResult {
    canReadAssignedApprovals: boolean;
    canApproveAssignedRequests: boolean;
    canConfirmAssignedNotTaken: boolean;
    canDecideAssignedCancellations: boolean;
    hasApprovalRelationship: boolean;
    canShowApprovalSurface: boolean;
    pending: PendingLeave[];
    notTakenPending: PendingLeave[];
    history: PendingLeave[];
    cancellationPending: PendingLeave[];
    metadata?: {
        pending: LeaveApprovalPaginationMetadata;
        notTakenPending: LeaveApprovalPaginationMetadata;
        history: LeaveHistoryMetadata;
        cancellationPending: LeaveApprovalPaginationMetadata;
    };
    isLoading: boolean;
    isProcessing: boolean;
    setPendingPage: (page: number) => void;
    setNotTakenPage: (page: number) => void;
    setHistoryPage: (page: number) => void;
    setCancellationPage: (page: number) => void;
    historyQuery: string;
    historyLeaveType: LeaveType | "";
    historyStatus: LeaveStatus | "";
    historyYear: string;
    historyFilters: LeaveHistoryFilters;
    hasHistoryFilters: boolean;
    setHistoryQuery: (value: string) => void;
    setHistoryLeaveType: (value: LeaveType | "") => void;
    setHistoryStatus: (value: LeaveStatus | "") => void;
    setHistoryYear: (value: string) => void;
    resetHistoryFilters: () => void;
    approveLeave: (leave: PendingLeave) => Promise<boolean>;
    confirmNotTaken: (leaveId: string, reason?: string) => Promise<boolean>;
    confirmCancellation: (leaveId: string, reason?: string) => Promise<boolean>;
    rejectCancellation: (leaveId: string, reason?: string) => Promise<boolean>;
    rejectLeave: (leave: PendingLeave, reason: string) => Promise<boolean>;
}

interface UseManagerApprovalModelOptions {
    leaveCapabilities?: LeavePresentationCapabilities;
    hasApprovalRelationship?: boolean;
}

export function useManagerApprovalModel({
    leaveCapabilities,
    hasApprovalRelationship = false,
}: UseManagerApprovalModelOptions = {}): UseManagerApprovalModelResult {
    const canReadAssignedApprovals = leaveCapabilities?.canReadAssignedApprovals === true;
    const canApproveAssignedRequests = leaveCapabilities?.canApproveAssignedRequests === true;
    const canConfirmAssignedNotTaken = leaveCapabilities?.canConfirmAssignedNotTaken === true;
    const canDecideAssignedCancellations = leaveCapabilities?.canDecideAssignedCancellations === true;
    const canShowApprovalSurface = canReadAssignedApprovals && hasApprovalRelationship;
    const [pendingPage, setPendingPage] = useState(1);
    const [notTakenPage, setNotTakenPage] = useState(1);
    const [historyPage, setHistoryPage] = useState(1);
    const [cancellationPage, setCancellationPage] = useState(1);
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
    const { pending, notTakenPending, history, cancellationPending, metadata, isLoading, mutate } = useLeaveApprovals({
        pendingPage,
        notTakenPage,
        historyPage,
        cancellationPage,
        historyFilters,
        enabled: canShowApprovalSurface,
    });
    const [isProcessing, setIsProcessing] = useState(false);

    const handleHistoryQueryChange = (value: string): void => {
        setHistoryQuery(value);
        setHistoryPage(1);
    };

    const handleHistoryLeaveTypeChange = (value: LeaveType | ""): void => {
        setHistoryLeaveType(value);
        setHistoryPage(1);
    };

    const handleHistoryStatusChange = (value: LeaveStatus | ""): void => {
        setHistoryStatus(value);
        setHistoryPage(1);
    };

    const handleHistoryYearChange = (value: string): void => {
        setHistoryYear(value);
        setHistoryPage(1);
    };

    const resetHistoryFilters = (): void => {
        setHistoryQuery("");
        setHistoryLeaveType("");
        setHistoryStatus("");
        setHistoryYear("");
        setHistoryPage(1);
    };

    const refreshFirstPages = async (): Promise<void> => {
        setPendingPage(1);
        setNotTakenPage(1);
        setHistoryPage(1);
        setCancellationPage(1);
        await mutate();
    };

    const executeAction = async (
        action: LeaveDecisionAction,
        leaveId: string,
        reason?: string,
    ): Promise<boolean> => {
        if (!canApproveAssignedRequests) return false;
        setIsProcessing(true);
        try {
            await submitLeaveDecision({ leaveId, action, reason });
            await refreshFirstPages();
            if (action === "APPROVE") {
                toast.success("อนุมัติคำขอลาเรียบร้อยแล้ว");
            } else {
                toast.success("ปฏิเสธคำขอลาเรียบร้อยแล้ว");
            }
            return true;
        } catch (error: unknown) {
            toast.error(
                error instanceof Error && error.message
                    ? error.message
                    : "เกิดข้อผิดพลาดในการดำเนินการ",
            );
            return false;
        } finally {
            setIsProcessing(false);
        }
    };

    const approveLeave = async (leave: PendingLeave): Promise<boolean> => {
        if (!canApproveAssignedRequests) return false;
        return executeAction("APPROVE", leave.id);
    };

    const rejectLeave = async (
        leave: PendingLeave,
        reason: string,
    ): Promise<boolean> => {
        if (!canApproveAssignedRequests) return false;
        return executeAction("REJECT", leave.id, reason);
    };

    const confirmNotTaken = async (leaveId: string, reason?: string): Promise<boolean> => {
        if (!canConfirmAssignedNotTaken) return false;
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
        if (!canDecideAssignedCancellations) return false;
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
        if (!canDecideAssignedCancellations) return false;
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
        canReadAssignedApprovals,
        canApproveAssignedRequests,
        canConfirmAssignedNotTaken,
        canDecideAssignedCancellations,
        hasApprovalRelationship,
        canShowApprovalSurface,
        pending,
        notTakenPending,
        history,
        cancellationPending,
        metadata,
        isLoading,
        isProcessing,
        setPendingPage,
        setNotTakenPage,
        setHistoryPage,
        setCancellationPage,
        historyQuery,
        historyLeaveType,
        historyStatus,
        historyYear,
        historyFilters,
        hasHistoryFilters,
        setHistoryQuery: handleHistoryQueryChange,
        setHistoryLeaveType: handleHistoryLeaveTypeChange,
        setHistoryStatus: handleHistoryStatusChange,
        setHistoryYear: handleHistoryYearChange,
        resetHistoryFilters,
        approveLeave,
        confirmNotTaken,
        confirmCancellation,
        rejectCancellation,
        rejectLeave,
    };
}

export function hasApprovalWarnings(leave: PendingLeave): boolean {
    return Boolean(leave.emergencyReason || leave.specialReason || leave.overQuotaDays > 0);
}
