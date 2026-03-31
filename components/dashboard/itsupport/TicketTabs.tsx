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
                <TabsList className="flex h-auto max-w-full overflow-x-auto flex-nowrap md:grid md:w-full md:max-w-md md:grid-cols-2 bg-gradient-to-r from-slate-100 via-indigo-50 to-sky-100 p-1.5 rounded-[2rem] shadow-inner gap-1 hide-scrollbar ring-1 ring-slate-200/80">
                    <TabsTrigger
                        value="tickets"
                        className="flex-1 flex items-center justify-center gap-2 rounded-full px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-indigo-100 transition-[color,background-color,box-shadow] text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap"
                    >
                        <List className="h-4 w-4 shrink-0" />
                        <span>รายการ Tickets</span>
                    </TabsTrigger>
                    {selectedTicket && (
                        <TabsTrigger
                            value="detail"
                            className="flex-1 flex items-center justify-center gap-2 rounded-full px-6 py-2.5 data-[state=active]:bg-white data-[state=active]:text-indigo-600 data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-indigo-100 transition-[color,background-color,box-shadow] text-gray-600 hover:text-gray-900 font-medium whitespace-nowrap"
                        >
                            <TicketIcon className="h-4 w-4 shrink-0" />
                            <span>รายละเอียด</span>
                        </TabsTrigger>
                    )}
                </TabsList>
            </div>

            <TabsContent value="tickets" className="mt-0 focus-visible:outline-none">
                <Card className="border-0 shadow-[0_30px_70px_-38px_rgba(30,41,59,0.45)] overflow-hidden bg-white/95 rounded-2xl ring-1 ring-indigo-100/80">
                    <div className="pointer-events-none absolute inset-0 opacity-80">
                        <div className="absolute -top-12 right-0 h-44 w-44 rounded-full bg-indigo-200/30 blur-3xl" />
                        <div className="absolute -bottom-14 left-8 h-44 w-44 rounded-full bg-sky-200/30 blur-3xl" />
                    </div>
                    <CardHeader className="relative border-b border-indigo-100/70 bg-gradient-to-r from-slate-50 via-indigo-50/70 to-sky-50/70 px-6 py-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl font-bold tracking-tight text-slate-900">รายการ IT Support Tickets</CardTitle>
                                <CardDescription className="text-slate-600 mt-1">
                                    {isAdmin
                                        ? "จัดการและติดตาม tickets ทั้งหมดในระบบ"
                                        : "ดู tickets ที่คุณได้แจ้งปัญหาไว้"}
                                </CardDescription>
                            </div>
                            <Button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white shadow-md shadow-indigo-500/25 transition-[transform,background-color,box-shadow] duration-300 hover:shadow-lg motion-safe:hover:-translate-y-0.5"
                            >
                                <PlusIcon className="h-4 w-4" />
                                แจ้งปัญหาใหม่
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="relative p-0 sm:p-6 bg-gradient-to-b from-white/70 to-slate-50/65">
                        <TicketList
                            onTicketSelect={handleTicketSelect}
                            refreshTrigger={refreshTrigger}
                        />
                    </CardContent>
                </Card>
            </TabsContent>

            {selectedTicket && (
                <TabsContent value="detail" className="mt-0 focus-visible:outline-none">
                    <div className="bg-gradient-to-br from-white/95 via-slate-50/95 to-indigo-50/85 rounded-2xl shadow-[0_24px_64px_-40px_rgba(30,41,59,0.52)] ring-1 ring-indigo-100/80 p-1">
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
