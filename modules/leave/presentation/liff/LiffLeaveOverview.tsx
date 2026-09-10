import { Plus } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import type { LiffLeaveQuotaSummary } from "../types";

import { LiffLeaveQuotaCards } from "./LiffLeaveQuotaCards";

interface LiffLeaveOverviewProps {
    quotas: LiffLeaveQuotaSummary[];
    onCreateRequest: () => void;
}

export function LiffLeaveOverview({
    quotas,
    onCreateRequest,
}: LiffLeaveOverviewProps): ReactElement {
    return (
        <div className="space-y-5">
            <section className="border-b border-module-leave-border pb-5">
                <div className="flex flex-col gap-4 min-[360px]:flex-row min-[360px]:items-end min-[360px]:justify-between">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight text-content-heading">Leave</h1>
                        <p className="mt-1 max-w-[28ch] text-sm leading-6 text-content-secondary">
                            ดูสิทธิ์ ส่งคำขอ และติดตามสถานะได้จาก LINE
                        </p>
                    </div>
                    <Button
                        type="button"
                        className="min-h-11 w-full shrink-0 bg-module-leave-solid font-bold text-content-on-brand hover:bg-module-leave-solid-hover min-[360px]:w-auto"
                        onClick={onCreateRequest}
                    >
                        <Plus aria-hidden="true" />
                        ยื่นลา
                    </Button>
                </div>
            </section>
            <LiffLeaveQuotaCards quotas={quotas} />
        </div>
    );
}
