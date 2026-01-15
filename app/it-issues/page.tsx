"use client";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    Plus as PlusIcon,
    Ticket as TicketIcon,
    List,
    Settings,
    BarChart3,
    Sparkles,
} from "lucide-react";
import {
    CreateTicketForm,
    TicketList,
    TicketDetail,
} from "@/components/ticket";
import { useTitle } from "@/hooks/useTitle";
import { useITIssues } from "@/hooks/useITIssues";

export default function ITIssuesPage() {
    useTitle("IT Support | NHF IT System");

    const {
        session,
        activeTab,
        setActiveTab,
        selectedTicket,
        refreshTrigger,
        showCreateModal,
        setShowCreateModal,
        ticketStats,
        statsLoading,
        isAdmin,
        handleTicketCreated,
        handleTicketSelect,
        handleTicketUpdated,
        handleBackToList,
    } = useITIssues();

    if (!session) {
        return (
            <Card>
                <CardContent className="p-6">
                    <p className="text-center text-gray-500">
                        กรุณาเข้าสู่ระบบเพื่อใช้งานระบบ IT Support
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">
                        IT Support System
                    </h1>
                    <p className="text-gray-600">
                        ระบบแจ้งปัญหาและติดตามการแก้ไขปัญหาไอที
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-sm">
                        {isAdmin ? "ผู้ดูแลระบบ" : "ผู้ใช้งาน"}
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                        {session.user?.department}
                    </Badge>
                </div>
            </div>

            {/* Quick Stats */}
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
                            {statsLoading
                                ? "กำลังโหลดข้อมูล"
                                : "tickets ในระบบ"}
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
                            {statsLoading
                                ? isAdmin
                                    ? "มอบหมายให้ฉัน"
                                    : "ที่ฉันแจ้ง"
                                : isAdmin
                                ? "มอบหมายให้ฉัน"
                                : "ที่ฉันแจ้ง"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Content */}
            <Tabs
                value={activeTab}
                onValueChange={setActiveTab}
                className="space-y-4"
            >
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger
                        value="tickets"
                        className="flex items-center gap-2"
                    >
                        <List className="h-4 w-4" />
                        รายการ Tickets
                    </TabsTrigger>
                    {selectedTicket && (
                        <TabsTrigger
                            value="detail"
                            className="flex items-center gap-2"
                        >
                            <TicketIcon className="h-4 w-4" />
                            รายละเอียด
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="tickets" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>
                                        รายการ IT Support Tickets
                                    </CardTitle>
                                    <CardDescription>
                                        {isAdmin
                                            ? "จัดการและติดตาม tickets ทั้งหมดในระบบ"
                                            : "ดู tickets ที่คุณได้แจ้งปัญหาไว้"}
                                    </CardDescription>
                                </div>
                                <Button
                                    onClick={() => setShowCreateModal(true)}
                                    className="flex items-center gap-2"
                                >
                                    <PlusIcon className="h-4 w-4" />
                                    แจ้งปัญหาใหม่
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <TicketList
                                onTicketSelect={handleTicketSelect}
                                refreshTrigger={refreshTrigger}
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {selectedTicket && (
                    <TabsContent value="detail" className="space-y-4">
                        <TicketDetail
                            ticketId={selectedTicket.id}
                            onBack={handleBackToList}
                            onTicketUpdated={handleTicketUpdated}
                        />
                    </TabsContent>
                )}
            </Tabs>

            {/* Create Ticket Modal */}
            <CreateTicketForm
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onTicketCreated={handleTicketCreated}
            />
        </div>
    );
}
