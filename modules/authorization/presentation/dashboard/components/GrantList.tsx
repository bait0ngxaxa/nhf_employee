"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ConfirmAuthorizationAction } from "./AuthorizationDialogs";
import { AuthorizationStatus } from "./AuthorizationStatus";
import {
    getAuthorizationDomainPresentation,
    getAuthorizationScopePresentation,
    getAuthorizationSourceLabel,
    getCapabilityPresentation,
} from "../permission-presentation";
import type { AuthorizationAdministrationGrantProjectionData } from "../types";

type GrantSource = "TEAM" | "TEAM_ROLE" | "USER";

export function GrantList({
    title,
    description,
    source,
    grants,
    busy,
    onAdd,
    onRemove,
}: {
    readonly title: string;
    readonly description: string;
    readonly source: GrantSource;
    readonly grants: readonly AuthorizationAdministrationGrantProjectionData[];
    readonly busy: boolean;
    readonly onAdd: () => void;
    readonly onRemove: (grant: AuthorizationAdministrationGrantProjectionData) => Promise<void>;
}): React.ReactElement {
    const [removeTarget, setRemoveTarget] = useState<AuthorizationAdministrationGrantProjectionData | null>(null);
    const [confirmationSessionId, setConfirmationSessionId] = useState(0);
    const sourceLabel = getAuthorizationSourceLabel(source);

    return (
        <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
            <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                <div>
                    <h3 className="text-base font-semibold text-content-heading">{title}</h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-content-secondary">{description}</p>
                </div>
                <Button type="button" size="sm" onClick={onAdd} disabled={busy}>
                    <Plus aria-hidden="true" />เพิ่มสิทธิ์
                </Button>
            </div>
            {grants.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-content-secondary sm:px-5">ยังไม่มีสิทธิ์เพิ่มเติมในส่วนนี้</div>
            ) : (
                <div className="divide-y divide-border-subtle">
                    {grants.map((grant) => (
                        <GrantItem
                            key={`${grant.capabilityKey}:${grant.scope}`}
                            grant={grant}
                            busy={busy}
                            onRemove={() => {
                                setConfirmationSessionId((current) => current + 1);
                                setRemoveTarget(grant);
                            }}
                        />
                    ))}
                </div>
            )}
            <ConfirmAuthorizationAction
                sessionId={`grant-remove:${source}:${removeTarget?.capabilityKey ?? "closed"}:${removeTarget?.scope ?? "closed"}:${confirmationSessionId}`}
                open={removeTarget !== null}
                title="นำสิทธิ์ออกหรือไม่?"
                description={removeTarget ? removalDescription(removeTarget, sourceLabel) : ""}
                confirmLabel="นำสิทธิ์ออก"
                destructive
                busy={busy}
                onClose={() => setRemoveTarget(null)}
                onConfirm={async () => {
                    if (!removeTarget) return;
                    await onRemove(removeTarget);
                    setRemoveTarget(null);
                }}
            />
        </section>
    );
}

function GrantItem({
    grant,
    busy,
    onRemove,
}: {
    readonly grant: AuthorizationAdministrationGrantProjectionData;
    readonly busy: boolean;
    readonly onRemove: () => void;
}): React.ReactElement {
    const presentation = getCapabilityPresentation(grant.capabilityKey);
    const scope = getAuthorizationScopePresentation(grant.scope, grant.capabilityKey);
    const canRemove = grant.validation.status === "VALID"
        && grant.capability?.administrativelyGrantable === true;
    const domain = grant.capability
        ? getAuthorizationDomainPresentation(grant.capability.domain)
        : undefined;

    return (
        <article className="px-4 py-4 sm:px-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h4 className="text-sm font-semibold text-content-heading">{presentation?.actionLabel ?? "สิทธิ์ที่ต้องตรวจสอบ"}</h4>
                        <AuthorizationStatus tone={grant.validation.status === "VALID" ? "grantable" : "danger"}>
                            {grant.validation.status === "VALID" ? "พร้อมใช้งาน" : "ต้องตรวจสอบ"}
                        </AuthorizationStatus>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-content-secondary">{presentation?.description ?? (grant.validation.status === "INVALID" ? "ข้อมูลสิทธิ์นี้ต้องตรวจสอบก่อนจึงจะนำไปใช้งานได้" : "ระบบยังไม่มีคำอธิบายสิทธิ์นี้")}</p>
                    <p className="mt-2 text-xs text-content-secondary">หมวดงาน: {domain?.label ?? "ต้องตรวจสอบ"}</p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="xs"
                    onClick={onRemove}
                    disabled={!canRemove || busy}
                    aria-label={`นำสิทธิ์ ${presentation?.actionLabel ?? "ที่ต้องตรวจสอบ"} ออกจากรายการ`}
                    title={!canRemove ? "รายการนี้ยังนำออกไม่ได้" : undefined}
                >
                    <Trash2 aria-hidden="true" />นำสิทธิ์ออก
                </Button>
            </div>
            <div className="mt-3 rounded-lg border border-border-subtle bg-surface-subtle/50 px-3 py-3">
                <p className="text-xs font-semibold text-content-secondary">ขอบเขตการเข้าถึง</p>
                <p className="mt-1 text-sm font-semibold text-content-heading">{scope.label}</p>
                <p className="mt-1 text-xs leading-5 text-content-secondary">{scope.description}</p>
            </div>
            {grant.validation.status === "INVALID" ? <p className="mt-3 text-sm leading-6 text-status-danger-strong">ข้อมูลสิทธิ์นี้ต้องตรวจสอบก่อนจึงจะนำออกได้</p> : null}
        </article>
    );
}

function removalDescription(
    grant: AuthorizationAdministrationGrantProjectionData,
    sourceLabel: string,
): string {
    const presentation = getCapabilityPresentation(grant.capabilityKey);
    const scope = getAuthorizationScopePresentation(grant.scope, grant.capabilityKey);
    return `นำสิทธิ์ "${presentation?.actionLabel ?? "ที่ต้องตรวจสอบ"} · ${scope.label}" ออกจาก${sourceLabel}หรือไม่? สิทธิ์พื้นฐานของระบบหรือสิทธิ์จากแหล่งอื่นอาจยังคงอยู่หลังนำสิทธิ์เพิ่มเติมนี้ออก`;
}
