"use client";

import { EmailRequestForm, EmailRequestHistory } from "@/components/email";
import { Mail } from "lucide-react";
import { EmailRequestProvider } from "./context";
import { useDashboardUIContext } from "@/components/dashboard/context/dashboard/DashboardContext";

function EmailRequestContent() {
    const { handleMenuClick } = useDashboardUIContext();

    return (
        <div className="space-y-6">
            <div className="flex items-start space-x-4">
                <div className="p-3 bg-gradient-to-br from-violet-500 to-fuchsia-500 rounded-xl shadow-lg shadow-violet-500/20 text-white">
                    <Mail className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        ขออีเมลพนักงานใหม่
                    </h2>
                    <p className="text-gray-600">
                        ส่งคำขออีเมลสำหรับพนักงานใหม่ให้ทีมไอที
                    </p>
                </div>
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
