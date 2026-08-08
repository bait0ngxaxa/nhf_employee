"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
    EmptyState,
    ErrorState,
    LoadingState,
    PermissionState,
} from "@/components/ui/state";
import { type TicketListProps } from "@/types/tickets";
import { useTicketList } from "@/hooks/useTicketList";
import { TicketCard } from "./TicketCard";
import { TicketFiltersCard } from "./TicketFiltersCard";
import { useAuth } from "@/components/auth/HybridAuthProvider";

export default function TicketList({
    onTicketSelect,
    refreshTrigger,
}: TicketListProps) {
    const { user } = useAuth();
    const {
        tickets,
        loading,
        error,
        retry,
        filters,
        setFilters,
        pagination,
        handlePageChange,
        isNewTicket,
    } = useTicketList(refreshTrigger);

    if (!user) {
        return (
            <PermissionState
                title="กรุณาเข้าสู่ระบบเพื่อดูรายการ tickets"
                description={undefined}
            />
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <TicketFiltersCard
                filters={filters}
                onFiltersChange={setFilters}
            />

            {/* Tickets List */}
            <Card className="ticket-list-shadow border-indigo-100/80 bg-gradient-to-b from-surface-raised/95 via-surface-subtle/90 to-indigo-50/50 overflow-hidden">
                <CardHeader className="border-b border-indigo-100/80 bg-gradient-to-r from-surface-raised via-surface-subtle to-indigo-50/70">
                    <CardTitle className="min-w-0 [overflow-wrap:anywhere]">รายการ Tickets</CardTitle>
                    <CardDescription className="text-content-secondary">
                        แสดง {tickets.length} รายการจากทั้งหมด{" "}
                        {pagination.total} รายการ
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-4 bg-gradient-to-b from-surface-raised/45 to-indigo-50/45">
                    {loading ? (
                        <LoadingState
                            label="กำลังโหลดรายการ tickets"
                            className="space-y-4 py-4"
                        >
                            {/* Filter Bar Skeleton */}
                            <div className="flex flex-wrap gap-3 mb-6">
                                <Skeleton className="h-10 flex-1 min-w-[200px]" />
                                <Skeleton className="h-10 w-40" />
                                <Skeleton className="h-10 w-40" />
                            </div>

                            {/* Ticket Cards Skeleton */}
                            {Array.from({ length: 4 }).map((_, i) => (
                                <div
                                    key={i}
                                    className="p-4 border rounded-lg space-y-3"
                                >
                                    <div className="flex justify-between">
                                        <Skeleton className="h-5 w-48" />
                                        <Skeleton className="h-5 w-20" />
                                    </div>
                                    <Skeleton className="h-4 w-full" />
                                    <div className="flex gap-2">
                                        <Skeleton className="h-6 w-16" />
                                        <Skeleton className="h-6 w-16" />
                                    </div>
                                </div>
                            ))}
                        </LoadingState>
                    ) : error ? (
                        <ErrorState
                            title="โหลดรายการ tickets ไม่สำเร็จ"
                            action={{ label: "ลองใหม่", onClick: retry }}
                        />
                    ) : tickets.length === 0 ? (
                        <EmptyState
                            title="ไม่พบ tickets"
                            description="ลองเปลี่ยนตัวกรองหรือคำค้นหา แล้วค้นหาอีกครั้ง"
                        />
                    ) : (
                        <div
                            className="space-y-4 p-1"
                            style={{
                                contentVisibility: "auto",
                                containIntrinsicSize: "0 500px",
                            }}
                        >
                            {tickets.map((ticket) => (
                                <TicketCard
                                    key={ticket.id}
                                    ticket={ticket}
                                    isNew={isNewTicket(
                                        ticket.createdAt,
                                        ticket.views,
                                    )}
                                    onClick={() => onTicketSelect?.(ticket)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.pages > 1 ? (
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm text-content-neutral-muted">
                                หน้า {pagination.page} จาก {pagination.pages}
                            </div>
                            <div className="flex w-full gap-2 sm:w-auto">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="min-w-0 flex-1 sm:flex-none"
                                    onClick={() =>
                                        handlePageChange(pagination.page - 1)
                                    }
                                    disabled={pagination.page <= 1}
                                >
                                    <ChevronLeft className="h-4 w-4" />
                                    ก่อนหน้า
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="min-w-0 flex-1 sm:flex-none"
                                    onClick={() =>
                                        handlePageChange(pagination.page + 1)
                                    }
                                    disabled={
                                        pagination.page >= pagination.pages
                                    }
                                >
                                    ถัดไป
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
