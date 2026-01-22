"use client";

import { memo } from "react";
import {
    Ticket as TicketIcon,
    Settings,
    BarChart3,
    Sparkles,
    List,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useITSupportDataContext } from "../context";

export const StatsCards = memo(function StatsCards() {
    const { ticketStats, statsLoading, isAdmin } = useITSupportDataContext();

    return (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        Tickets ทั้งหมด
                    </CardTitle>
                    <TicketIcon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {statsLoading ? "-" : ticketStats.total}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {statsLoading ? "กำลังโหลดข้อมูล" : "tickets ในระบบ"}
                    </p>
                </CardContent>
            </Card>

            <Card
                className={
                    (ticketStats.newTickets ?? 0) > 0
                        ? "ring-2 ring-blue-200 bg-blue-50/30"
                        : ""
                }
            >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium flex items-center gap-1">
                        <Sparkles className="h-4 w-4 text-blue-500" />
                        Tickets ใหม่
                    </CardTitle>
                    <div className="text-blue-500">
                        {(ticketStats.newTickets ?? 0) > 0 && (
                            <Sparkles className="h-4 w-4 animate-pulse" />
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold text-blue-600">
                        {statsLoading ? "-" : ticketStats.newTickets}
                    </div>
                    <p className="text-xs text-blue-600">
                        {statsLoading
                            ? "กำลังโหลดข้อมูล"
                            : "24 ชั่วโมงที่ผ่านมา"}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        กำลังดำเนินการ
                    </CardTitle>
                    <Settings className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {statsLoading
                            ? "-"
                            : ticketStats.open + ticketStats.inProgress}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {statsLoading
                            ? "รอการแก้ไข"
                            : `เปิด: ${ticketStats.open}, ดำเนินการ: ${ticketStats.inProgress}`}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        แก้ไขแล้ว
                    </CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {statsLoading ? "-" : ticketStats.resolved}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {statsLoading
                            ? "เสร็จสิ้นแล้ว"
                            : "tickets ที่แก้ไขแล้ว"}
                    </p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        ของฉัน
                    </CardTitle>
                    <List className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">
                        {statsLoading ? "-" : ticketStats.userTickets}
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {isAdmin ? "มอบหมายให้ฉัน" : "ที่ฉันแจ้ง"}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
});
