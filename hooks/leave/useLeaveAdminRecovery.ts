import useSWR from "swr";

import { apiGet } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { LeaveApprovalPaginationMetadata, PendingLeave } from "@/hooks/useLeaveApprovals";

export interface LeaveAdminRecoveryResponse {
    notTakenPending: PendingLeave[];
    cancellationPending: PendingLeave[];
    metadata: {
        notTakenPending: LeaveApprovalPaginationMetadata;
        cancellationPending: LeaveApprovalPaginationMetadata;
    };
}

interface UseLeaveAdminRecoveryPages {
    notTakenPage: number;
    cancellationPage: number;
}

interface UseLeaveAdminRecoveryResult {
    notTakenPending: PendingLeave[];
    cancellationPending: PendingLeave[];
    metadata?: LeaveAdminRecoveryResponse["metadata"];
    isLoading: boolean;
    isError?: Error;
    mutate: () => Promise<LeaveAdminRecoveryResponse | undefined>;
}

async function fetcher(url: string): Promise<LeaveAdminRecoveryResponse> {
    const response = await apiGet<LeaveAdminRecoveryResponse>(url);
    if (!response.success) {
        throw new Error(response.errorThai || response.error);
    }
    return response.data;
}

export function useLeaveAdminRecovery({
    notTakenPage,
    cancellationPage,
}: UseLeaveAdminRecoveryPages): UseLeaveAdminRecoveryResult {
    const { data, error, isLoading, mutate } = useSWR<
        LeaveAdminRecoveryResponse,
        Error
    >(
        `${API_ROUTES.leave.adminRecovery}?notTakenPage=${notTakenPage}&cancellationPage=${cancellationPage}`,
        fetcher,
        {
            revalidateOnFocus: false,
            revalidateIfStale: false,
            shouldRetryOnError: false,
            dedupingInterval: 60_000,
        },
    );

    return {
        notTakenPending: data?.notTakenPending || [],
        cancellationPending: data?.cancellationPending || [],
        metadata: data?.metadata,
        isLoading,
        isError: error,
        mutate: () => mutate(),
    };
}
