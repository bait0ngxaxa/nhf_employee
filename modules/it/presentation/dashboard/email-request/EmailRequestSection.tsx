"use client";

import type { ReactElement } from "react";
import { EmailRequestForm } from "./EmailRequestForm";
import { EmailRequestHistory } from "./EmailRequestHistory";
import { EmailRequestProvider } from "./EmailRequestProvider";
import type { EmailRequestPresentationCapabilities } from "../../../domain/email-request/contracts";

function EmailRequestContent({
    capabilities,
    onCancel,
    onSuccess,
}: {
    capabilities: EmailRequestPresentationCapabilities;
    onCancel?: () => void;
    onSuccess?: () => void;
}): ReactElement {
    return (
        <section className="min-h-[calc(100dvh-6rem)]">
            <div className="space-y-8 p-4 md:p-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div className="min-w-0 space-y-1">
                        <h1
                            data-page-heading
                            tabIndex={-1}
                            className="text-2xl font-bold tracking-tight text-content-heading [overflow-wrap:anywhere] md:text-3xl"
                        >
                            ส่งคำร้องพนักงานใหม่
                        </h1>
                        <p className="text-sm font-medium leading-6 text-content-secondary [overflow-wrap:anywhere]">
                            ส่งคำร้องอีเมล ระบบสารบรรณ และพื้นที่จัดเก็บไฟล์ให้ทีมไอที
                        </p>
                    </div>
                </div>

                {capabilities.canCreateRequests ? (
                    <div className="space-y-8">
                        <EmailRequestForm
                            onCancel={onCancel}
                            onSuccess={onSuccess}
                        />
                    </div>
                ) : null}

                {capabilities.canReadRequests ? (
                    <div>
                        <EmailRequestHistory />
                    </div>
                ) : null}
            </div>
        </section>
    );
}

export function EmailRequestSection({
    capabilities,
    onCancel,
    onSuccess,
}: {
    capabilities: EmailRequestPresentationCapabilities;
    onCancel?: () => void;
    onSuccess?: () => void;
}): ReactElement {
    return (
        <EmailRequestProvider capabilities={capabilities}>
            <EmailRequestContent
                capabilities={capabilities}
                onCancel={onCancel}
                onSuccess={onSuccess}
            />
        </EmailRequestProvider>
    );
}
