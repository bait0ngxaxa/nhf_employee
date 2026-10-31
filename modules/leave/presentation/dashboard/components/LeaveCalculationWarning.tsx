import type { ReactElement } from "react";
import { AlertTriangle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function LeaveCalculationWarning({ message }: { message: string | null }): ReactElement | null {
    if (!message) return null;

    return (
        <Alert className="border-status-warning-border bg-status-warning-surface text-status-warning-foreground [&>svg]:text-status-warning-foreground">
            <AlertTriangle className="size-4" aria-hidden="true" />
            <AlertDescription>{message}</AlertDescription>
        </Alert>
    );
}
