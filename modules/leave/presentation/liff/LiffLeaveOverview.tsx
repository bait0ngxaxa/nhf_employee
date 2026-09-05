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
            <section className="overflow-hidden rounded-3xl bg-module-leave-dashboard-strong px-5 py-5 text-content-on-brand shadow-lg shadow-module-leave-focus/10">
                <div className="flex items-end justify-between gap-4">
                    <div className="min-w-0">
                        <h1 className="text-2xl font-bold tracking-tight">Leave</h1>
                        <p className="mt-1 max-w-[28ch] text-sm font-medium leading-6 text-module-leave-dashboard-muted">
                            ดูสิทธิ์ ส่งคำขอ และติดตามสถานะได้จาก LINE
                        </p>
                    </div>
                    <Button
                        type="button"
                        className="min-h-12 shrink-0 bg-surface text-module-leave-dashboard-strong hover:bg-module-leave-dashboard-surface"
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
