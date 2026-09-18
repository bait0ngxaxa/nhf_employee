import type { ReactNode } from "react";

import { cn } from "@/lib/ui/utils";

export type AuthorizationStatusTone =
    | "active"
    | "inactive"
    | "grantable"
    | "warning"
    | "deferred"
    | "allow"
    | "deny"
    | "neutral"
    | "danger";

const toneClasses: Record<AuthorizationStatusTone, string> = {
    active: "border-status-success-border bg-status-success-surface text-status-success-foreground",
    inactive: "border-border-subtle bg-surface-subtle text-content-secondary",
    grantable: "border-status-success-border bg-status-success-surface text-status-success-foreground",
    warning: "border-status-warning-border bg-status-warning-surface text-status-warning-foreground",
    deferred: "border-border-subtle bg-surface-subtle text-content-secondary",
    allow: "border-status-success-border bg-status-success-surface text-status-success-foreground",
    deny: "border-status-danger-border bg-status-danger-surface text-status-danger-foreground",
    neutral: "border-border-subtle bg-surface-raised text-content-secondary",
    danger: "border-status-danger-border bg-status-danger-surface text-status-danger-foreground",
};

export function AuthorizationStatus({
    children,
    tone,
    className,
}: {
    readonly children: ReactNode;
    readonly tone: AuthorizationStatusTone;
    readonly className?: string;
}): React.ReactElement {
    return (
        <span
            className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium leading-4",
                toneClasses[tone],
                className,
            )}
        >
            {children}
        </span>
    );
}

export function ActiveStatus({
    isActive,
}: {
    readonly isActive: boolean;
}): React.ReactElement {
    return (
        <AuthorizationStatus tone={isActive ? "active" : "inactive"}>
            {isActive ? "ใช้งานอยู่" : "ปิดใช้งาน"}
        </AuthorizationStatus>
    );
}

export function LifecycleStatus({
    isActive,
    deletedAt,
}: {
    readonly isActive: boolean;
    readonly deletedAt: string | Date | null;
}): React.ReactElement {
    if (deletedAt !== null) {
        return <AuthorizationStatus tone="danger">ถูกลบ / ใช้งานไม่ได้</AuthorizationStatus>;
    }
    return <ActiveStatus isActive={isActive} />;
}
