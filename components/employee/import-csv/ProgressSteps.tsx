import { ArrowRight } from "lucide-react";
import { type ProgressStepsProps } from "./types";

export function ProgressSteps({ step }: ProgressStepsProps) {
    const getStepColor = (targetStep: "upload" | "preview" | "result"): string => {
        const stepOrder = ["upload", "preview", "result"] as const;
        const currentIndex = stepOrder.indexOf(step);
        const targetIndex = stepOrder.indexOf(targetStep);

        if (targetIndex < currentIndex) return "text-green-700";
        if (targetIndex === currentIndex) return "text-blue-700";
        return "text-gray-500";
    };

    const getBadgeColor = (targetStep: "upload" | "preview" | "result"): string => {
        const stepOrder = ["upload", "preview", "result"] as const;
        const currentIndex = stepOrder.indexOf(step);
        const targetIndex = stepOrder.indexOf(targetStep);

        if (targetIndex < currentIndex) return "bg-green-100 text-green-800";
        if (targetIndex === currentIndex) return "bg-blue-100 text-blue-800 ring-2 ring-blue-200";
        return "bg-gray-100 text-gray-600";
    };

    const steps = [
        { key: "upload" as const, label: "อัพโหลด", number: 1 },
        { key: "preview" as const, label: "ตรวจสอบ", number: 2 },
        { key: "result" as const, label: "ผลลัพธ์", number: 3 },
    ];

    return (
        <div
            className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3"
            aria-label="ขั้นตอนนำเข้าข้อมูล"
        >
            {steps.map((s, index) => (
                <div key={s.key} className="flex min-w-0 items-center gap-2">
                    {index > 0 && (
                        <ArrowRight className="h-4 w-4 shrink-0 text-gray-400" aria-hidden="true" />
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
