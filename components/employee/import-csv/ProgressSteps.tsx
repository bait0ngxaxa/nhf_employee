import { ArrowRight } from "lucide-react";
import { type ProgressStepsProps } from "./types";

export function ProgressSteps({ step }: ProgressStepsProps) {
    const getStepColor = (
        targetStep: "upload" | "preview" | "result",
    ): string => {
        const stepOrder = ["upload", "preview", "result"] as const;
        const currentIndex = stepOrder.indexOf(step);
        const targetIndex = stepOrder.indexOf(targetStep);

        if (targetIndex < currentIndex) return "text-green-600";
        if (targetIndex === currentIndex) return "text-blue-600";
        return "text-gray-400";
    };

    const getBadgeColor = (
        targetStep: "upload" | "preview" | "result",
    ): string => {
        const stepOrder = ["upload", "preview", "result"] as const;
        const currentIndex = stepOrder.indexOf(step);
        const targetIndex = stepOrder.indexOf(targetStep);

        if (targetIndex < currentIndex) return "bg-green-100 text-green-600";
        if (targetIndex === currentIndex) return "bg-blue-100 text-blue-600";
        return "bg-gray-100";
    };

    const steps = [
        { key: "upload" as const, label: "อัพโหลด", number: 1 },
        { key: "preview" as const, label: "ตรวจสอบ", number: 2 },
        { key: "result" as const, label: "ผลลัพธ์", number: 3 },
    ];

    return (
        <div className="flex items-center space-x-4">
            {steps.map((s, index) => (
                <div key={s.key} className="flex items-center space-x-2">
                    {index > 0 && (
                        <ArrowRight className="h-4 w-4 text-gray-400 mr-2" />
                    )}
                    <div
                        className={`flex items-center space-x-2 ${getStepColor(s.key)}`}
                    >
                        <div
                            className={`w-8 h-8 rounded-full flex items-center justify-center ${getBadgeColor(s.key)}`}
                        >
                            {s.number}
                        </div>
                        <span className="font-medium">{s.label}</span>
                    </div>
                </div>
            ))}
        </div>
    );
}
