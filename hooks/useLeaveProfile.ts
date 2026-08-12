import useSWR from "swr";
import { apiPost } from "@/lib/client/api-client";
import { apiGet } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import {
    requestLeaveCancellation,
    submitLeaveNotTakenRequest,
} from "@/lib/services/leave/client";
import type { LeaveAttachmentSummary } from "@/lib/types/leave";

const fetcher = async <T,>(url: string): Promise<T> => {
    const res = await apiGet<T>(url);
    if (!res.success) throw new Error(res.errorThai || res.error);
    return res.data;
};

export interface LeaveQuota {
    id: string;
    year: number;
    employeeId: number;
    leaveType: "SICK" | "PERSONAL" | "VACATION";
    totalDays: number;
    carryBalanceDays: number;
    effectiveTotalDays: number;
    usedDays: number;
    remainingDays: number;
}

export type LeaveQuotaBalance = Pick<
    LeaveQuota,
    | "totalDays"
    | "carryBalanceDays"
    | "effectiveTotalDays"
    | "usedDays"
    | "remainingDays"
>;

export interface LeaveRequest {
    id: string;
    employeeId: number;
    leaveType: "SICK" | "PERSONAL" | "VACATION";
    startDate: string;
    endDate: string;
    period: "FULL_DAY" | "MORNING" | "AFTERNOON";
    durationDays: number;
    reason: string;
    emergencyReason: string | null;
    specialReason: string | null;
    overQuotaDays: number;
    status:
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | "CANCELLED"
        | "NOT_TAKEN"
        | "CANCELLATION_REQUESTED"
        | "CANCELLED_AFTER_APPROVAL";
    approverId: number | null;
    approvedAt: string | null;
    rejectReason: string | null;
    notTakenReason: string | null;
    notTakenRequestedAt: string | null;
    notTakenConfirmedAt: string | null;
    notTakenConfirmedById: number | null;
    cancellationReason: string | null;
    cancellationRequestedAt: string | null;
    cancellationConfirmedAt: string | null;
    cancellationConfirmedById: number | null;
    attachments: LeaveAttachmentSummary[];
    createdAt: string;
    updatedAt: string;
    approver?: {
        firstName: string;
        lastName: string;
        nickname: string | null;
    } | null;
}

export interface LeaveProfileResponse {
    quotas: LeaveQuota[];
    history: LeaveRequest[];
    metadata: {
        currentPage: number;
        totalPages: number;
        totalItems: number;
        itemsPerPage: number;
    };
}

export function useLeaveProfile(page: number = 1) {
    const { data, error, isLoading, mutate } = useSWR<LeaveProfileResponse>(
        `${API_ROUTES.leave.me}?page=${page}&limit=10`,
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            shouldRetryOnError: false,
            dedupingInterval: 60_000,
        }
    );

    const cancelLeave = async (leaveId: string) => {
        try {
            const response = await apiPost(API_ROUTES.leave.cancel, { leaveId });

            if (!response.success) {
                throw new Error(
                    response.errorThai || response.error || "ไม่สามารถยกเลิกคำขอลาได้",
                );
            }

            // Immediately re-fetch the data to reflect the CANCELLED status & restored quota
            await mutate();
            return true;
        } catch (error) {
            console.error("Cancel leave error:", error);
            throw error;
        }
    };

    const requestNotTaken = async (leaveId: string, note: string): Promise<boolean> => {
        await submitLeaveNotTakenRequest({ leaveId, note });
        await mutate();
        return true;
    };

    const requestApprovedCancellation = async (
        leaveId: string,
        reason?: string,
    ): Promise<boolean> => {
        await requestLeaveCancellation({ leaveId, reason });
        await mutate();
        return true;
    };

    return {
        quotas: data?.quotas || [],
        history: data?.history || [],
        metadata: data?.metadata,
        isLoading,
        error,
        mutate,
        cancelLeave,
        requestApprovedCancellation,
        requestNotTaken,
    };
}
