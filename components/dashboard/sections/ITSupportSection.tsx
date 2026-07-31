"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CreateTicketForm } from "@/components/ticket";
import {
    useITSupportUIContext,
    useITSupportDataContext,
} from "@/components/dashboard/context/it-support/ITSupportContext";
import { ITSupportProvider } from "@/components/dashboard/context/it-support/ITSupportProvider";
import { SectionShell } from "@/components/ui/section-shell";
import { Header } from "@/components/dashboard/itsupport/Header";
import { StatsCards } from "@/components/dashboard/itsupport/StatsCards";
import { TicketTabs } from "@/components/dashboard/itsupport/TicketTabs";

function ITSupportContent() {
    const { showCreateModal, setShowCreateModal } = useITSupportUIContext();
    const { session, handleTicketCreated } = useITSupportDataContext();

    if (!session) {
        return (
            <Card>
                <CardContent className="space-y-2 p-6 text-center">
                    <h1
                        data-page-heading
                        tabIndex={-1}
                        className="text-2xl font-bold text-slate-950"
                    >
                        NHF IT-Support
                    </h1>
                    <p className="text-gray-500">
                        กรุณาเข้าสู่ระบบเพื่อใช้งานระบบ IT Support
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <SectionShell
            gradientFrom="rgba(219,234,254,0.6)"
            gradientTo="rgba(224,231,255,0.6)"
        >
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
        </SectionShell>
    );
}

export function ITSupportSection() {
    return (
        <ITSupportProvider>
            <ITSupportContent />
        </ITSupportProvider>
    );
}
