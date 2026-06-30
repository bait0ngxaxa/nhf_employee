"use client";

import type { ReactElement } from "react";
import { EmailRequestForm, EmailRequestHistory } from "@/components/email";
import { Mail } from "lucide-react";
import { EmailRequestProvider } from "@/components/dashboard/context/email-request/EmailRequestProvider";
import { useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";

function EmailRequestContent(): ReactElement {
    const { handleMenuClick } = useDashboardUIContext();

    return (
        <div className="min-h-[calc(100vh-6rem)] overflow-hidden rounded-2xl border border-border bg-muted/40">
            <div className="space-y-8 p-4 md:p-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div className="flex min-w-0 items-center gap-4">
                        <div className="shrink-0">
                            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary">
                                <Mail className="h-7 w-7 text-white" />
                            </div>
                        </div>
                        <div className="min-w-0 space-y-1">
                            <h2 className="text-2xl font-bold tracking-tight text-foreground [overflow-wrap:anywhere] md:text-3xl">
                                ส่งคำร้องพนักงานใหม่
                            </h2>
                            <p className="text-sm font-medium leading-6 text-muted-foreground [overflow-wrap:anywhere]">
                                ส่งคำร้องอีเมล ระบบสารบรรณ และ Shared Drive ให้ทีมไอที
                            </p>
                        </div>
                    </div>
                </div>

                <div className="space-y-8">
                    <EmailRequestForm
                        onCancel={() => handleMenuClick("dashboard")}
                        onSuccess={() => handleMenuClick("dashboard")}
                    />
                </div>

                <div>
                    <EmailRequestHistory />
                </div>
            </div>
        </div>
    );
}

export function EmailRequestSection(): ReactElement {
    return (
        <EmailRequestProvider>
            <EmailRequestContent />
        </EmailRequestProvider>
    );
}
