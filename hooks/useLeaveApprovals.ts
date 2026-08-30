import useSWR, { type KeyedMutator } from "swr";
import { apiGet } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { LeaveAttachmentSummary } from "@/lib/types/leave";
import type { LeaveApprovalPaginationMetadata } from "@/lib/services/leave/approval-queries";
import type {
    LeaveHistoryFilters,
    LeaveHistoryMetadata,
} from "@/lib/services/leave/history-filters";

export type { LeaveApprovalPaginationMetadata } from "@/lib/services/leave/approval-queries";

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
    status:
        | "PENDING"
        | "APPROVED"
        | "REJECTED"
        | "CANCELLED"
        | "NOT_TAKEN"
        | "CANCELLATION_REQUESTED"
        | "CANCELLED_AFTER_APPROVAL";
    cancellationReason: string | null;
    cancellationRequestedAt: string | null;
    cancellationConfirmedAt: string | null;
    cancellationConfirmedById: number | null;
    notTakenReason: string | null;
    notTakenRequestedAt: string | null;
    notTakenConfirmedAt: string | null;
    createdAt: string;
    attachments: LeaveAttachmentSummary[];
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
    cancellationPending: PendingLeave[];
    metadata: {
        pending: LeaveApprovalPaginationMetadata;
        notTakenPending: LeaveApprovalPaginationMetadata;
        history: LeaveHistoryMetadata;
        cancellationPending: LeaveApprovalPaginationMetadata;
    };
}

export interface UseLeaveApprovalsOptions {
    pendingPage: number;
    notTakenPage: number;
    historyPage: number;
    cancellationPage: number;
    historyFilters?: LeaveHistoryFilters;
}

export interface UseLeaveApprovalsResult {
    pending: PendingLeave[];
    notTakenPending: PendingLeave[];
    history: PendingLeave[];
    cancellationPending: PendingLeave[];
    metadata: LeaveApprovalsResponse["metadata"] | undefined;
    isLoading: boolean;
    isError: unknown;
    mutate: KeyedMutator<LeaveApprovalsResponse>;
}

export function buildLeaveApprovalsUrl({
    pendingPage,
    notTakenPage,
    historyPage,
    cancellationPage,
    historyFilters = {},
}: UseLeaveApprovalsOptions): string {
    const searchParams = new URLSearchParams({
        pendingPage: String(pendingPage),
        notTakenPage: String(notTakenPage),
        historyPage: String(historyPage),
        cancellationPage: String(cancellationPage),
    });
    const query = historyFilters.query?.trim();

    if (query) {
        searchParams.set("historyQuery", query);
    }
    if (historyFilters.leaveType) {
        searchParams.set("historyLeaveType", historyFilters.leaveType);
    }
    if (historyFilters.status) {
        searchParams.set("historyStatus", historyFilters.status);
    }
    if (historyFilters.year !== undefined) {
        searchParams.set("historyYear", String(historyFilters.year));
    }

    return `${API_ROUTES.leave.approvals}?${searchParams.toString()}`;
}

export function useLeaveApprovals({
    historyFilters,
    ...pages
}: UseLeaveApprovalsOptions): UseLeaveApprovalsResult {
    const { data, error, isLoading, mutate } = useSWR<LeaveApprovalsResponse, unknown>(
        buildLeaveApprovalsUrl({ ...pages, historyFilters }),
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
        cancellationPending: data?.cancellationPending || [],
        metadata: data?.metadata,
        isLoading,
        isError: error,
        mutate,
    };
}
