import { ArrowRight, CircleOff, LockKeyhole } from "lucide-react";
import Link from "next/link";
import type { ReactElement } from "react";

import { APP_ROUTES } from "@/lib/ssot/routes";

const MODULE_LABELS = {
    leave: "บริการวันลา",
    routine: "บริการงานประจำ",
} as const;

export function LiffModuleLanding({
    module,
    reason,
}: {
    module: keyof typeof MODULE_LABELS;
    reason: "disabled" | "account-unavailable";
}): ReactElement {
    const disabled = reason === "disabled";
    const Icon = disabled ? CircleOff : LockKeyhole;

    return (
        <main
            id="main"
            className="space-y-6 px-[max(1rem,env(safe-area-inset-left))] pb-8 pt-6 pr-[max(1rem,env(safe-area-inset-right))] sm:pt-8"
        >
            <section className="flex items-start gap-3 border-b border-border-subtle pb-5">
                <Icon className="mt-1 size-6 shrink-0 text-content-muted" aria-hidden="true" />
                <div className="min-w-0 space-y-2">
                    <h1 className="text-2xl font-bold leading-tight text-content-heading">
                        {disabled ? `${MODULE_LABELS[module]}บน LINE ปิดอยู่` : `บัญชีนี้เปิด${MODULE_LABELS[module]}ไม่ได้`}
                    </h1>
                    <p className="text-sm leading-6 text-content-secondary">
                        {disabled
                            ? "คุณยังสามารถกลับไปใช้บริการอื่นบน LINE ได้"
                            : "หากต้องใช้บริการนี้ กรุณาติดต่อผู้ดูแลระบบ"}
                    </p>
                </div>
            </section>
            <Link
                href={APP_ROUTES.line.root}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-md border border-brand-border bg-surface-raised px-4 py-3 text-sm font-semibold text-brand-strong hover:border-brand-border-strong hover:bg-brand-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-focus/40"
            >
                กลับหน้าบริการบน LINE
                <ArrowRight className="size-5 shrink-0" aria-hidden="true" />
            </Link>
        </main>
    );
}
