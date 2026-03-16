import useSWR from "swr";
import { apiGet } from "@/lib/api-client";

const fetcher = async <T,>(url: string): Promise<T> => {
    const res = await apiGet<T>(url);
    if (!res.success) throw new Error(res.error);
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
}

export function useLeaveProfile() {
    const { data, error, isLoading, mutate } = useSWR<LeaveProfileResponse>(
        "/api/leave/me",
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            shouldRetryOnError: false,
            dedupingInterval: 60_000,
        }
    );

    return {
        quotas: data?.quotas || [],
        history: data?.history || [],
        isLoading,
        isError: error,
        mutate,
    };
}
