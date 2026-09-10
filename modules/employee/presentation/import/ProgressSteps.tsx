import { type ProgressStepsProps } from "./types";

export function ProgressSteps({ step }: ProgressStepsProps) {
    const getStepColor = (targetStep: "upload" | "preview" | "result"): string => {
        const stepOrder = ["upload", "preview", "result"] as const;
        const currentIndex = stepOrder.indexOf(step);
        const targetIndex = stepOrder.indexOf(targetStep);

        if (targetIndex < currentIndex) return "text-status-positive-foreground";
        if (targetIndex === currentIndex) return "text-action-primary-foreground";
        return "text-content-neutral-muted";
    };

    const getBadgeColor = (targetStep: "upload" | "preview" | "result"): string => {
        const stepOrder = ["upload", "preview", "result"] as const;
        const currentIndex = stepOrder.indexOf(step);
        const targetIndex = stepOrder.indexOf(targetStep);

        if (targetIndex < currentIndex) return "bg-status-positive-surface-strong text-status-positive-strong";
        if (targetIndex === currentIndex) return "bg-action-primary-surface-strong text-action-primary-strong ring-2 ring-action-primary-border";
        return "bg-surface-neutral-muted text-content-neutral-secondary";
    };

    const steps = [
        { key: "upload" as const, label: "อัปโหลด", number: 1 },
        { key: "preview" as const, label: "ตรวจสอบ", number: 2 },
        { key: "result" as const, label: "ผลลัพธ์", number: 3 },
    ];

    return (
        <nav
            className="border-b border-border-subtle pb-4"
            aria-label="ขั้นตอนนำเข้าข้อมูล"
        >
            <ol className="grid grid-cols-3 gap-2">
                {steps.map((s) => (
                    <li key={s.key} className="min-w-0">
                        <div
                            className={`flex min-w-0 items-center gap-2 rounded-lg px-2 py-2 ${getStepColor(s.key)}`}
                            aria-current={step === s.key ? "step" : undefined}
                        >
                            <div
                                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${getBadgeColor(s.key)}`}
                            >
                                {s.number}
                            </div>
                            <span className="font-medium [overflow-wrap:anywhere]">
                                {s.label}
                            </span>
                        </div>
                    </li>
                ))}
            </ol>
        </nav>
    );
}
