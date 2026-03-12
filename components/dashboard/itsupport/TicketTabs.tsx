"use client";

import { Plus as PlusIcon, Ticket as TicketIcon, List } from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TicketList, TicketDetail } from "@/components/ticket";
import {
    useITSupportUIContext,
    useITSupportDataContext,
} from "@/components/dashboard/context/it-support/ITSupportContext";

import { memo } from "react";

export const TicketTabs = memo(function TicketTabs() {
    const {
        activeTab,
        setActiveTab,
        selectedTicket,
        setShowCreateModal,
        handleTicketSelect,
        handleBackToList,
    } = useITSupportUIContext();

    const { refreshTrigger, isAdmin, handleTicketUpdated } =
        useITSupportDataContext();

    return (
        <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out"
        >
            <div className="flex justify-center md:justify-start w-full md:pb-0 mb-2">
                <TabsList className="flex h-auto max-w-full overflow-x-auto flex-nowrap md:grid md:w-full md:max-w-md md:grid-cols-2 bg-gray-100 p-1.5 rounded-[2rem] shadow-inner gap-1 hide-scrollbar">
                    <TabsTrigger
                        value="tickets"
                        className="flex-1 flex items-center justify-center gap-2 rounded-full px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap"
                    >
                        <List className="h-4 w-4 shrink-0" />
                        <span>รายการ Tickets</span>
                    </TabsTrigger>
                    {selectedTicket && (
                        <TabsTrigger
                            value="detail"
                            className="flex-1 flex items-center justify-center gap-2 rounded-full px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm transition-all text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap"
                        >
                            <TicketIcon className="h-4 w-4 shrink-0" />
                            <span>รายละเอียด</span>
                        </TabsTrigger>
                    )}
                </TabsList>
            </div>

            <TabsContent value="tickets" className="mt-0 outline-none">
                <Card className="border-0 shadow-lg shadow-gray-200/50 overflow-hidden bg-white/95 rounded-2xl ring-1 ring-gray-200">
                    <CardHeader className="border-b border-gray-100 bg-gray-50/50 px-6 py-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl font-bold tracking-tight text-gray-900">รายการ IT Support Tickets</CardTitle>
                                <CardDescription className="text-gray-500 mt-1">
                                    {isAdmin
                                        ? "จัดการและติดตาม tickets ทั้งหมดในระบบ"
                                        : "ดู tickets ที่คุณได้แจ้งปัญหาไว้"}
                                </CardDescription>
                            </div>
                            <Button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md shadow-indigo-500/25 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5"
                            >
                                <PlusIcon className="h-4 w-4" />
                                แจ้งปัญหาใหม่
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 sm:p-6">
                        <TicketList
                            onTicketSelect={handleTicketSelect}
                            refreshTrigger={refreshTrigger}
                        />
                    </CardContent>
                </Card>
            </TabsContent>

            {selectedTicket && (
                <TabsContent value="detail" className="mt-0 outline-none">
                    <div className="bg-white/95 rounded-2xl shadow-lg ring-1 ring-gray-200 p-1">
                        <TicketDetail
                            ticketId={selectedTicket?.id ?? 0}
                            onBack={handleBackToList}
                            onTicketUpdated={handleTicketUpdated}
                        />
                    </div>
                </TabsContent>
            )}
        </Tabs>
    );
});
