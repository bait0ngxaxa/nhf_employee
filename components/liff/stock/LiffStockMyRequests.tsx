"use client";

import type { StockRequestStatus } from "@prisma/client";
import { ClipboardList } from "lucide-react";
import type { ReactElement } from "react";

import { ErrorState, LoadingState } from "@/components/ui/state";
import type {
    LiffStockRequestAction,
    LiffStockRequestsResponse,
    LiffStockRequestSummary,
} from "@/lib/types/stock-liff";

import { LiffStockRequestFilters } from "./LiffStockFilters";
import { LiffStockPagination } from "./LiffStockPagination";
import { LiffStockRequestCard } from "./LiffStockRequestCard";

interface LiffStockMyRequestsProps {
    response: LiffStockRequestsResponse;
    search: string;
    status: StockRequestStatus | undefined;
    loading: boolean;
    error: string | null;
    busyRequestId: number | null;
    onSearchChange: (value: string) => void;
    onStatusChange: (value: StockRequestStatus | undefined) => void;
    onPageChange: (page: number) => void;
    onRetry: () => void;
    onOpenDetail: (requestId: number) => void;
    onAction: (
        action: LiffStockRequestAction,
        request: LiffStockRequestSummary,
    ) => void;
}

export function LiffStockMyRequests({
    response,
    search,
    status,
    loading,
    error,
    busyRequestId,
    onSearchChange,
    onStatusChange,
    onPageChange,
    onRetry,
    onOpenDetail,
    onAction,
}: LiffStockMyRequestsProps): ReactElement {
    return (
        <section aria-labelledby="liff-stock-history-heading" className="space-y-4">
            <div>
                <h1
                    id="liff-stock-history-heading"
                    className="text-xl font-bold tracking-tight text-content-heading"
                >
                    คำขอเบิกของฉัน
                </h1>
                <p className="mt-1 text-sm leading-6 text-content-secondary">
                    ติดตามสถานะและยกเลิกคำขอที่ยังรอจ่ายได้
                </p>
            </div>
            <LiffStockRequestFilters
                search={search}
                status={status}
                onSearchChange={onSearchChange}
                onStatusChange={onStatusChange}
            />

            {error ? (
                <ErrorState
                    title="โหลดประวัติการเบิกไม่สำเร็จ"
                    description={error}
                    action={{ label: "ลองใหม่", onClick: onRetry }}
                    className="min-h-64 border-border-subtle bg-surface-raised px-4 py-8"
                />
            ) : loading && response.requests.length === 0 ? (
                <LoadingState
                    label="กำลังโหลดประวัติการเบิก..."
                    className="min-h-64 border-0 bg-transparent"
                />
            ) : response.requests.length === 0 ? (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-surface-raised px-5 text-center shadow-sm ring-1 ring-border-subtle">
                    <ClipboardList className="size-9 text-content-muted" aria-hidden="true" />
                    <h2 className="mt-3 text-base font-bold text-content-heading">
                        ยังไม่มีประวัติการเบิก
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-content-secondary">
                        คำขอที่ส่งแล้วจะแสดงในหน้านี้
                    </p>
                </div>
            ) : (
                <>
                    <div className="space-y-3" aria-busy={loading}>
                        {response.requests.map((request) => (
                            <LiffStockRequestCard
                                key={request.id}
                                request={request}
                                busy={busyRequestId === request.id}
                                onOpenDetail={onOpenDetail}
                                onAction={onAction}
                            />
                        ))}
                    </div>
                    <LiffStockPagination
                        page={response.page}
                        totalPages={response.totalPages}
                        onPageChange={onPageChange}
                    />
                </>
            )}
        </section>
    );
}
