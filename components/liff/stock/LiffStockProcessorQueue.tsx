"use client";

import { ClipboardCheck, Search, X } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorState, LoadingState } from "@/components/ui/state";
import type {
    LiffStockRequestAction,
    LiffStockRequestsResponse,
    LiffStockRequestSummary,
} from "@/lib/types/stock-liff";

import { LiffStockPagination } from "./LiffStockPagination";
import { LiffStockRequestCard } from "./LiffStockRequestCard";

interface LiffStockProcessorQueueProps {
    response: LiffStockRequestsResponse;
    search: string;
    loading: boolean;
    error: string | null;
    busyRequestId: number | null;
    onSearchChange: (value: string) => void;
    onPageChange: (page: number) => void;
    onRetry: () => void;
    onOpenDetail: (requestId: number) => void;
    onAction: (
        action: LiffStockRequestAction,
        request: LiffStockRequestSummary,
    ) => void;
}

export function LiffStockProcessorQueue({
    response,
    search,
    loading,
    error,
    busyRequestId,
    onSearchChange,
    onPageChange,
    onRetry,
    onOpenDetail,
    onAction,
}: LiffStockProcessorQueueProps): ReactElement {
    return (
        <section aria-labelledby="liff-stock-processing-heading" className="space-y-4">
            <div>
                <h1
                    id="liff-stock-processing-heading"
                    className="text-xl font-bold tracking-tight text-content-heading"
                >
                    คำขอรอดำเนินการ
                </h1>
                <p className="mt-1 text-sm leading-6 text-content-secondary">
                    ตรวจรายการให้ครบก่อนยืนยันจ่ายวัสดุ การจ่ายจะตัดสต็อกทันที
                </p>
            </div>
            <div className="relative rounded-2xl bg-surface-raised p-3 shadow-sm ring-1 ring-border-subtle">
                <Search
                    className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-content-muted"
                    aria-hidden="true"
                />
                <Input
                    aria-label="ค้นหาคำขอรอดำเนินการ"
                    type="search"
                    inputMode="search"
                    autoComplete="off"
                    value={search}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="เลขที่คำขอ โครงการ ผู้เบิก หรือวัสดุ"
                    className="h-12 rounded-xl border-border-subtle bg-surface pl-10 pr-12"
                />
                {search ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => onSearchChange("")}
                        aria-label="ล้างคำค้นหาคิวรอดำเนินการ"
                        className="absolute right-3.5 top-1/2 size-11 -translate-y-1/2 rounded-xl"
                    >
                        <X className="size-4" aria-hidden="true" />
                    </Button>
                ) : null}
            </div>

            {error ? (
                <ErrorState
                    title="โหลดคิวรอดำเนินการไม่สำเร็จ"
                    description={error}
                    action={{ label: "ลองโหลดอีกครั้ง", onClick: onRetry }}
                    className="min-h-64 border-border-subtle bg-surface-raised px-4 py-8"
                />
            ) : loading && response.requests.length === 0 ? (
                <LoadingState
                    label="กำลังโหลดคิวรอดำเนินการ..."
                    className="min-h-64 border-0 bg-transparent"
                />
            ) : response.requests.length === 0 ? (
                <div className="flex min-h-56 flex-col items-center justify-center rounded-2xl bg-surface-raised px-5 text-center shadow-sm ring-1 ring-border-subtle">
                    <ClipboardCheck className="size-9 text-status-success-icon" aria-hidden="true" />
                    <h2 className="mt-3 text-base font-bold text-content-heading">
                        ไม่มีคำขอรอดำเนินการ
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-content-secondary">
                        คิวว่างแล้วในขณะนี้
                    </p>
                </div>
            ) : (
                <>
                    <div className="space-y-3" aria-busy={loading}>
                        {response.requests.map((request) => (
                            <LiffStockRequestCard
                                key={request.id}
                                request={request}
                                showRequester
                                showCurrentQuantity
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
