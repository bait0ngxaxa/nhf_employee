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
        selectedTicketId,
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
                <TabsList className="flex h-auto max-w-full flex-nowrap gap-1 overflow-x-auto rounded-[2rem] bg-gradient-to-r from-module-it-tabs-start via-module-it-tabs-mid to-module-it-tabs-end p-1.5 shadow-inner ring-1 ring-module-it-tab-border/80 hide-scrollbar md:grid md:w-full md:max-w-md md:grid-cols-2">
                    <TabsTrigger
                        value="tickets"
                        className="flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 py-2.5 font-medium text-content-neutral-secondary transition-[color,background-color,box-shadow] hover:text-content-neutral-primary data-[state=active]:bg-surface data-[state=active]:text-module-it-tab-active data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-module-it-tab-border"
                    >
                        <List className="h-4 w-4 shrink-0" />
                        <span>รายการ Tickets</span>
                    </TabsTrigger>
                    {selectedTicketId !== null && (
                        <TabsTrigger
                            value="detail"
                            className="flex min-h-11 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-full px-6 py-2.5 font-medium text-content-neutral-secondary transition-[color,background-color,box-shadow] hover:text-content-neutral-primary data-[state=active]:bg-surface data-[state=active]:text-module-it-tab-active data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-module-it-tab-border"
                        >
                            <TicketIcon className="h-4 w-4 shrink-0" />
                            <span>รายละเอียด</span>
                        </TabsTrigger>
                    )}
                </TabsList>
            </div>

            <TabsContent value="tickets" className="mt-0 focus-visible:outline-none">
                <Card className="module-it-ticket-shadow overflow-hidden rounded-2xl border-0 bg-surface/95 ring-1 ring-module-it-tab-border/80">
                    <div className="pointer-events-none absolute inset-0 opacity-80">
                        <div className="absolute -top-12 right-0 h-44 w-44 rounded-full bg-module-it-indigo-glow/30 blur-3xl" />
                        <div className="absolute -bottom-14 left-8 h-44 w-44 rounded-full bg-module-it-sky-glow/30 blur-3xl" />
                    </div>
                    <CardHeader className="relative border-b border-module-it-tab-border/70 bg-gradient-to-r from-surface-subtle via-module-it-tabs-mid/70 to-brand-surface/70 px-6 py-5">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div>
                                <CardTitle className="text-xl font-bold tracking-tight text-content-primary">รายการ IT Support Tickets</CardTitle>
                                <CardDescription className="mt-1 text-content-secondary">
                                    {isAdmin
                                        ? "จัดการและติดตาม tickets ทั้งหมดในระบบ"
                                        : "ดู tickets ที่คุณได้แจ้งปัญหาไว้"}
                                </CardDescription>
                            </div>
                            <Button
                                onClick={() => setShowCreateModal(true)}
                                className="flex items-center gap-2 bg-gradient-to-r from-module-it-action-start to-module-it-action-end text-content-on-brand shadow-md shadow-module-it-action-shadow/25 transition-[transform,background-color,box-shadow] duration-300 hover:from-module-it-action-hover-start hover:to-module-it-action-hover-end focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 motion-safe:hover:-translate-y-0.5"
                            >
                                <PlusIcon className="h-4 w-4" />
                                แจ้งปัญหาใหม่
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="relative bg-gradient-to-b from-surface/70 to-surface-subtle/65 p-0 sm:p-6">
                        <TicketList
                            onTicketSelect={handleTicketSelect}
                            refreshTrigger={refreshTrigger}
                        />
                    </CardContent>
                </Card>
            </TabsContent>

            {selectedTicketId !== null && (
                <TabsContent value="detail" className="mt-0 focus-visible:outline-none">
                    <div className="module-it-detail-shadow rounded-2xl bg-gradient-to-br from-surface/95 via-surface-subtle/95 to-module-it-tabs-mid/85 p-1 ring-1 ring-module-it-tab-border/80">
                        <TicketDetail
                            ticketId={selectedTicketId}
                            onBack={handleBackToList}
                            onTicketUpdated={handleTicketUpdated}
                        />
                    </div>
                </TabsContent>
            )}
        </Tabs>
    );
});
