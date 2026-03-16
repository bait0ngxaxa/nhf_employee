import useSWR from "swr";
import { apiGet } from "@/lib/api-client";

const fetcher = async <T,>(url: string): Promise<T> => {
    const res = await apiGet<T>(url);
    if (!res.success) throw new Error(res.error);
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
    status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
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
    history: PendingLeave[];
}

export function useLeaveApprovals() {
    const { data, error, isLoading, mutate } = useSWR<LeaveApprovalsResponse>(
        "/api/leave/approvals",
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
        history: data?.history || [],
        isLoading,
        isError: error,
        mutate,
    };
}
