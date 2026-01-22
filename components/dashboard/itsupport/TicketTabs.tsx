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
                                <CardTitle>รายการ IT Support Tickets</CardTitle>
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
    );
});
