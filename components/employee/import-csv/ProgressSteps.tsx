import { ArrowRight } from "lucide-react";
import { type ProgressStepsProps } from "./types";

export function ProgressSteps({ step }: ProgressStepsProps) {
    const getStepColor = (targetStep: "upload" | "preview" | "result"): string => {
        const stepOrder = ["upload", "preview", "result"] as const;
        const currentIndex = stepOrder.indexOf(step);
        const targetIndex = stepOrder.indexOf(targetStep);

        if (targetIndex < currentIndex) return "text-status-success-foreground";
        if (targetIndex === currentIndex) return "text-brand-foreground";
        return "text-content-neutral-muted";
    };

    const getBadgeColor = (targetStep: "upload" | "preview" | "result"): string => {
        const stepOrder = ["upload", "preview", "result"] as const;
        const currentIndex = stepOrder.indexOf(step);
        const targetIndex = stepOrder.indexOf(targetStep);

        if (targetIndex < currentIndex) return "bg-status-success-surface text-status-success-strong";
        if (targetIndex === currentIndex) return "bg-brand-surface text-brand-strong ring-2 ring-brand-solid";
        return "bg-surface-neutral-muted text-content-neutral-secondary";
    };

    const steps = [
        { key: "upload" as const, label: "อัพโหลด", number: 1 },
        { key: "preview" as const, label: "ตรวจสอบ", number: 2 },
        { key: "result" as const, label: "ผลลัพธ์", number: 3 },
    ];

    return (
        <div
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-subtle bg-surface-raised p-3"
            aria-label="ขั้นตอนนำเข้าข้อมูล"
        >
            {steps.map((s, index) => (
                <div key={s.key} className="flex min-w-0 items-center gap-2">
                    {index > 0 && (
                        <ArrowRight className="h-4 w-4 shrink-0 text-content-neutral-subtle" aria-hidden="true" />
                    )}
                    <div
                        className={`flex min-w-0 items-center gap-2 ${getStepColor(s.key)}`}
                        aria-current={step === s.key ? "step" : undefined}
                    >
                        <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${getBadgeColor(s.key)}`}
                        >
                            {s.number}
                        </div>
                        <span className="font-medium [overflow-wrap:anywhere]">{s.label}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
