import useSWR from "swr";
import { apiPost } from "@/lib/api-client";
import { apiGet } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";

const fetcher = async <T,>(url: string): Promise<T> => {
    const res = await apiGet<T>(url);
    if (!res.success) throw new Error(res.errorThai || res.error);
    return res.data;
};

export interface LeaveQuota {
    id: number;
    year: number;
    employeeId: number;
    leaveType: "SICK" | "PERSONAL" | "VACATION";
    totalDays: number;
    usedDays: number;
    createdAt: string;
    updatedAt: string;
}

export interface LeaveRequest {
    id: string;
    employeeId: number;
    leaveType: "SICK" | "PERSONAL" | "VACATION";
    startDate: string;
    endDate: string;
    period: "FULL_DAY" | "MORNING" | "AFTERNOON";
    durationDays: number;
    reason: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
    approverId: number | null;
    approvedAt: string | null;
    rejectReason: string | null;
    attachmentUrl: string | null;
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

    return {
        quotas: data?.quotas || [],
        history: data?.history || [],
        metadata: data?.metadata,
        isLoading,
        error,
        mutate,
        cancelLeave,
    };
}
