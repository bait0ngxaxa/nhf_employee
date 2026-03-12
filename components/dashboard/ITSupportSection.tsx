"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CreateTicketForm } from "@/components/ticket";
import {
    useITSupportUIContext,
    useITSupportDataContext,
} from "@/components/dashboard/context/it-support/ITSupportContext";
import { ITSupportProvider } from "./context";
import { Header, StatsCards, TicketTabs } from "./itsupport";

function ITSupportContent() {
    const { showCreateModal, setShowCreateModal } = useITSupportUIContext();
    const { session, handleTicketCreated } = useITSupportDataContext();

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
        <div className="relative min-h-[calc(100vh-6rem)] bg-slate-50/50 rounded-3xl overflow-hidden border border-white/60 shadow-inner">
            {/* Background Aesthetic Effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(219,234,254,0.6)_0%,transparent_70%)] -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(224,231,255,0.6)_0%,transparent_70%)] translate-y-1/3 -translate-x-1/4" />
            </div>

            <div className="relative z-10 p-4 md:p-8 space-y-8">
                {/* Header */}
                <Header />

                {/* Quick Stats */}
                <StatsCards />

                {/* Main Content */}
                <TicketTabs />

                {/* Create Ticket Modal */}
                <CreateTicketForm
                    isOpen={showCreateModal}
                    onClose={() => setShowCreateModal(false)}
                    onTicketCreated={handleTicketCreated}
                />
            </div>
        </div>
    );
}

export function ITSupportSection() {
    return (
        <ITSupportProvider>
            <ITSupportContent />
        </ITSupportProvider>
    );
}
