"use client";

import { useSession } from "next-auth/react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { TicketListProps } from "@/types/tickets";
import { useTicketList } from "@/hooks/useTicketList";
import { TicketCard } from "./TicketCard";
import { TicketFiltersCard } from "./TicketFiltersCard";

export default function TicketList({
    onTicketSelect,
    refreshTrigger,
}: TicketListProps) {
    const { data: session } = useSession();
    const {
        tickets,
        loading,
        error,
        filters,
        setFilters,
        pagination,
        handlePageChange,
        resetFilters,
        isNewTicket,
    } = useTicketList(refreshTrigger);

    if (!session) {
        return (
            <Card>
                <CardContent className="p-6">
                    <p className="text-center text-gray-500">
                        กรุณาเข้าสู่ระบบเพื่อดูรายการ tickets
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            {/* Filters */}
            <TicketFiltersCard
                filters={filters}
                onFiltersChange={setFilters}
                onReset={resetFilters}
            />

            {/* Tickets List */}
            <Card>
                <CardHeader>
                    <CardTitle>รายการ Tickets</CardTitle>
                    <CardDescription>
                        แสดง {tickets.length} รายการจากทั้งหมด{" "}
                        {pagination.total} รายการ
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="text-center py-8">
                            <p>กำลังโหลด...</p>
                        </div>
                    ) : error ? (
                        <div className="text-center py-8 text-red-600">
                            <p>{error}</p>
                        </div>
                    ) : tickets.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <p>ไม่พบ tickets</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {tickets.map((ticket) => (
                                <TicketCard
                                    key={ticket.id}
                                    ticket={ticket}
                                    isNew={isNewTicket(
                                        ticket.createdAt,
                                        ticket.views
                                    )}
                                    onClick={() => onTicketSelect?.(ticket)}
                                />
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.pages > 1 && (
                        <div className="flex items-center justify-between mt-6">
                            <div className="text-sm text-gray-500">
                                หน้า {pagination.page} จาก {pagination.pages}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
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
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
