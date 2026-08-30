import useSWR, { type KeyedMutator } from "swr";
import { apiPost } from "@/lib/client/api-client";
import { apiGet } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import {
    requestLeaveCancellation,
    submitLeaveNotTakenRequest,
} from "@/lib/services/leave/client";
import type {
    LeaveHistoryFilters,
    LeaveHistoryMetadata,
} from "@/lib/services/leave/history-filters";
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
    metadata: LeaveHistoryMetadata;
}

export interface UseLeaveProfileOptions {
    page?: number;
    filters?: LeaveHistoryFilters;
}

export interface UseLeaveProfileResult {
    quotas: LeaveQuota[];
    history: LeaveRequest[];
    metadata: LeaveProfileResponse["metadata"] | undefined;
    isLoading: boolean;
    error: unknown;
    mutate: KeyedMutator<LeaveProfileResponse>;
    cancelLeave: (leaveId: string) => Promise<boolean>;
    requestApprovedCancellation: (leaveId: string, reason?: string) => Promise<boolean>;
    requestNotTaken: (leaveId: string, note: string) => Promise<boolean>;
}

export function buildLeaveProfileUrl(
    page: number,
    filters: LeaveHistoryFilters = {},
): string {
    const searchParams = new URLSearchParams({
        page: String(page),
        limit: "10",
    });
    const query = filters.query?.trim();

    if (query) {
        searchParams.set("q", query);
    }
    if (filters.leaveType) {
        searchParams.set("leaveType", filters.leaveType);
    }
    if (filters.status) {
        searchParams.set("status", filters.status);
    }
    if (filters.year !== undefined) {
        searchParams.set("year", String(filters.year));
    }

    return `${API_ROUTES.leave.me}?${searchParams.toString()}`;
}

export function useLeaveProfile(
    options: UseLeaveProfileOptions | number = {},
): UseLeaveProfileResult {
    const normalizedOptions = typeof options === "number"
        ? { page: options }
        : options;
    const normalizedPage = normalizedOptions.page ?? 1;
    const normalizedFilters = normalizedOptions.filters ?? {};
    const { data, error, isLoading, mutate } = useSWR<LeaveProfileResponse, unknown>(
        buildLeaveProfileUrl(normalizedPage, normalizedFilters),
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            shouldRetryOnError: false,
            dedupingInterval: 60_000,
        },
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
