"use client";

import { Card, CardContent } from "@/components/ui/card";
import { CreateTicketForm } from "@/components/ticket";
import {
    useITSupportUIContext,
    useITSupportDataContext,
} from "@/components/dashboard/context/it-support/ITSupportContext";
import { ITSupportProvider } from "./context";
import { SectionShell } from "@/components/ui/section-shell";
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
