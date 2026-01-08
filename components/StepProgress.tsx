import { ArrowRight } from "lucide-react";

interface StepProgressProps {
    currentStep: "upload" | "preview" | "result";
    steps: {
        key: string;
        label: string;
    }[];
}

export function StepProgress({ currentStep, steps }: StepProgressProps) {
    const getStepStatus = (stepKey: string) => {
        const stepOrder = steps.map((s) => s.key);
        const currentIndex = stepOrder.indexOf(currentStep);
        const stepIndex = stepOrder.indexOf(stepKey);

        if (stepIndex < currentIndex) return "completed";
        if (stepIndex === currentIndex) return "active";
        return "pending";
    };

    const getStepStyles = (status: "completed" | "active" | "pending") => {
        switch (status) {
            case "completed":
                return {
                    container: "text-green-600",
                    circle: "bg-green-100 text-green-600",
                };
            case "active":
                return {
                    container: "text-blue-600",
                    circle: "bg-blue-100 text-blue-600",
                };
            default:
                return {
                    container: "text-gray-400",
                    circle: "bg-gray-100",
                };
        }
    };

    return (
        <div className="flex items-center space-x-4">
            {steps.map((step, index) => {
                const status = getStepStatus(step.key);
                const styles = getStepStyles(status);

                return (
                    <div key={step.key} className="flex items-center">
                        <div
                            className={`flex items-center space-x-2 ${styles.container}`}
                        >
                            <div
                                className={`w-8 h-8 rounded-full flex items-center justify-center ${styles.circle}`}
                            >
                                {index + 1}
                            </div>
                            <span className="font-medium">{step.label}</span>
                        </div>
                        {index < steps.length - 1 && (
                            <ArrowRight className="h-4 w-4 text-gray-400 ml-4" />
                        )}
                    </div>
                );
            })}
        </div>
    );
}
