import useSWR from "swr";
import { apiGet } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";

const fetcher = async <T,>(url: string): Promise<T> => {
    const res = await apiGet<T>(url);
    if (!res.success) throw new Error(res.errorThai || res.error);
    return res.data;
};

export interface PendingLeave {
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
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED" | "NOT_TAKEN";
    notTakenReason: string | null;
    notTakenRequestedAt: string | null;
    notTakenConfirmedAt: string | null;
    createdAt: string;
    employee: {
        firstName: string;
        lastName: string;
        nickname: string | null;
        position: string;
        departmentId: number;
        dept?: {
            name: string;
        };
    };
}

export interface LeaveApprovalsResponse {
    pending: PendingLeave[];
    notTakenPending: PendingLeave[];
    history: PendingLeave[];
}

export function useLeaveApprovals() {
    const { data, error, isLoading, mutate } = useSWR<LeaveApprovalsResponse>(
        API_ROUTES.leave.approvals,
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            shouldRetryOnError: false,
            dedupingInterval: 60_000,
        }
    );

    return {
        pending: data?.pending || [],
        notTakenPending: data?.notTakenPending || [],
        history: data?.history || [],
        isLoading,
        isError: error,
        mutate,
    };
}
