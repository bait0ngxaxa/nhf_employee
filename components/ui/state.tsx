import type { ReactElement, ReactNode } from "react";
import {
    AlertCircle,
    Inbox,
    Loader2,
    LockKeyhole,
    WifiOff,
} from "lucide-react";

import { cn } from "@/lib/ui/utils";

import { Button } from "@/components/ui/button";

export interface StateAction {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
    disabled?: boolean;
}

interface StateLayoutProps {
    title?: ReactNode;
    description?: ReactNode;
    action?: StateAction;
    icon?: ReactNode;
    compact?: boolean;
    className?: string;
}

export interface LoadingStateProps {
    label?: string;
    children?: ReactNode;
    compact?: boolean;
    className?: string;
}

export interface EmptyStateProps extends StateLayoutProps {
    title?: ReactNode;
}

export interface ErrorStateProps
    extends Omit<StateLayoutProps, "action" | "icon"> {
    action: StateAction;
    icon?: ReactNode;
}

export interface PermissionStateProps extends StateLayoutProps {
    title?: ReactNode;
}

export interface OfflineStateProps extends StateLayoutProps {
    title?: ReactNode;
}

const stateLayout = "flex flex-col items-center justify-center text-center";
const stateFrame = "rounded-xl border border-border-subtle bg-surface-raised";

function stateFrameSize(compact: boolean): string {
    return compact
        ? "w-full px-6 py-10"
        : "mx-auto w-full max-w-3xl px-6 py-14";
}

function StateIcon({
    children,
    tone = "default",
}: {
    children: ReactNode;
    tone?: "default" | "danger";
}): ReactElement {
    return (
        <div
            className={cn(
                "mb-4 flex h-12 w-12 items-center justify-center rounded-xl border",
                tone === "danger"
                    ? "border-status-danger-border bg-surface-raised text-status-danger-foreground"
                    : "border-border-subtle bg-surface-subtle text-content-subtle",
            )}
        >
            {children}
        </div>
    );
}

function StateMessage({
    title,
    description,
}: {
    title: ReactNode;
    description?: ReactNode;
}): ReactElement {
    return (
        <>
            <h3 className="text-sm font-semibold text-content-heading">
                {title}
            </h3>
            {description !== undefined ? (
                <p className="mt-1 max-w-sm text-sm leading-6 text-content-secondary">
                    {description}
                </p>
            ) : null}
        </>
    );
}

function StateActionButton({ action }: { action: StateAction }): ReactElement {
    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
            className="mt-4 rounded-lg border-border-subtle bg-surface text-sm font-semibold text-content-body"
        >
            {action.icon}
            {action.label}
        </Button>
    );
}

export function LoadingState({
    label = "กำลังโหลดข้อมูล...",
    children,
    compact = false,
    className,
}: LoadingStateProps): ReactElement {
    if (children !== undefined) {
        return (
            <div
                role="status"
                aria-live="polite"
                aria-busy="true"
                aria-label={label}
                className={cn("relative", className)}
            >
                {children}
            </div>
        );
    }

    return (
        <div
            role="status"
            aria-live="polite"
            aria-busy="true"
            aria-label={label}
            className={cn(
                stateLayout,
                stateFrame,
                stateFrameSize(compact),
                className,
            )}
        >
            <Loader2
                className="mb-3 h-6 w-6 animate-spin text-content-secondary"
                aria-hidden="true"
            />
            <p className="text-sm font-medium text-content-body">{label}</p>
        </div>
    );
}

export function EmptyState({
    title = "ยังไม่มีข้อมูล",
    description,
    action,
    icon = <Inbox className="h-6 w-6" aria-hidden="true" />,
    compact = false,
    className,
}: EmptyStateProps): ReactElement {
    return (
        <div
            role="status"
            className={cn(
                stateLayout,
                stateFrame,
                stateFrameSize(compact),
                className,
            )}
        >
            <StateIcon>{icon}</StateIcon>
            <StateMessage title={title} description={description} />
            {action ? <StateActionButton action={action} /> : null}
        </div>
    );
}

export function ErrorState({
    title = "โหลดข้อมูลไม่สำเร็จ",
    description = "ตรวจสอบการเชื่อมต่อ แล้วลองใหม่อีกครั้ง",
    action,
    icon = <AlertCircle className="h-5 w-5" aria-hidden="true" />,
    compact = false,
    className,
}: ErrorStateProps): ReactElement {
    return (
        <div
            role="alert"
            className={cn(
                stateLayout,
                "rounded-xl border border-status-danger-border bg-status-danger-surface",
                stateFrameSize(compact),
                className,
            )}
        >
            <StateIcon tone="danger">{icon}</StateIcon>
            <StateMessage title={title} description={description} />
            <StateActionButton action={action} />
        </div>
    );
}

export function PermissionState({
    title = "ไม่มีสิทธิ์เข้าถึงข้อมูลนี้",
    description = "กรุณาเข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์เพื่อดำเนินการต่อ",
    action,
    icon = <LockKeyhole className="h-6 w-6" aria-hidden="true" />,
    compact = false,
    className,
}: PermissionStateProps): ReactElement {
    return (
        <div
            role="status"
            className={cn(
                stateLayout,
                stateFrame,
                stateFrameSize(compact),
                className,
            )}
        >
            <StateIcon>{icon}</StateIcon>
            <StateMessage title={title} description={description} />
            {action ? <StateActionButton action={action} /> : null}
        </div>
    );
}

export function OfflineState({
    title = "ไม่สามารถเชื่อมต่อได้",
    description = "ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต แล้วลองใหม่อีกครั้ง",
    action,
    icon = <WifiOff className="h-6 w-6" aria-hidden="true" />,
    compact = false,
    className,
}: OfflineStateProps): ReactElement {
    return (
        <div
            role="alert"
            className={cn(
                stateLayout,
                stateFrame,
                stateFrameSize(compact),
                className,
            )}
        >
            <StateIcon>{icon}</StateIcon>
            <StateMessage title={title} description={description} />
            {action ? <StateActionButton action={action} /> : null}
        </div>
    );
}
