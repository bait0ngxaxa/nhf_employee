"use client";

import { EmailRequestForm, EmailRequestHistory } from "@/components/email";
import { EmailRequestProvider } from "./context";
import { useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";

function EmailRequestContent() {
    const { handleMenuClick } = useDashboardUIContext();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">
                    ขออีเมลพนักงานใหม่
                </h2>
                <p className="text-gray-600">
                    ส่งคำขออีเมลสำหรับพนักงานใหม่ให้ทีมไอที
                </p>
            </div>
            <div className="space-y-6">
                <EmailRequestForm
                    onCancel={() => handleMenuClick("dashboard")}
                    onSuccess={() => handleMenuClick("dashboard")}
                />
            </div>

            {/* Email Request History */}
            <EmailRequestHistory />
        </div>
    );
}

export function EmailRequestSection() {
    return (
        <EmailRequestProvider>
            <EmailRequestContent />
        </EmailRequestProvider>
    );
}
