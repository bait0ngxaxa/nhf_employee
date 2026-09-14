"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { ConfirmAuthorizationAction } from "./AuthorizationDialogs";
import { AuthorizationStatus } from "./AuthorizationStatus";
import { getReadinessLabel } from "../display";
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

    return (
        <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
            <div className="flex flex-col gap-3 border-b border-border-subtle px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                <div>
                    <h3 className="text-base font-semibold text-content-heading">{title}</h3>
                    <p className="mt-1 max-w-3xl text-sm leading-6 text-content-secondary">{description}</p>
                </div>
                <Button type="button" size="sm" onClick={onAdd} disabled={busy}>
                    <Plus aria-hidden="true" />เพิ่ม grant
                </Button>
            </div>
            {grants.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-content-secondary sm:px-5">ยังไม่มี grant ในส่วนนี้</div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="min-w-[720px] w-full text-left text-sm">
                        <caption className="sr-only">{title}</caption>
                        <thead className="border-b border-border-subtle bg-surface-subtle text-xs font-semibold text-content-secondary">
                            <tr>
                                <th scope="col" className="px-4 py-3 sm:px-5">Capability</th>
                                <th scope="col" className="px-4 py-3">Domain</th>
                                <th scope="col" className="px-4 py-3">Scope</th>
                                <th scope="col" className="px-4 py-3">Readiness / validation</th>
                                <th scope="col" className="px-4 py-3"><span className="sr-only">การดำเนินการ</span></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border-subtle">
                            {grants.map((grant) => {
                                const canRemove = grant.validation.status === "VALID"
                                    && grant.capability?.administrativelyGrantable === true;
                                const capability = grant.capability;
                                return (
                                    <tr key={`${grant.capabilityKey}:${grant.scope}`}>
                                        <td className="px-4 py-3 sm:px-5">
                                            <span className="block break-all font-mono text-xs font-semibold text-content-heading">{grant.capabilityKey}</span>
                                            {grant.validation.status === "INVALID" ? <span className="mt-1 block text-xs text-status-danger-strong">{grant.validation.reason}</span> : null}
                                        </td>
                                        <td className="px-4 py-3 text-content-body">{capability?.domain ?? "ไม่พบใน registry"}</td>
                                        <td className="px-4 py-3 font-mono text-xs text-content-body">{grant.scope}</td>
                                        <td className="px-4 py-3">
                                            <GrantReadiness grant={grant} />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="xs"
                                                onClick={() => setRemoveTarget(grant)}
                                                disabled={!canRemove || busy}
                                                aria-label={`ลบ grant ${grant.capabilityKey} ${grant.scope}`}
                                                title={!canRemove ? "รายการนี้ไม่อยู่ในสถานะที่คำสั่งลบรองรับ" : undefined}
                                            >
                                                <Trash2 aria-hidden="true" />ลบ
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
            <ConfirmAuthorizationAction
                open={removeTarget !== null}
                title="ยืนยันการลบ grant"
                description={removeTarget ? `ลบ ${removeTarget.capabilityKey} / ${removeTarget.scope} จาก ${source} หรือไม่ การเปลี่ยนแปลงนี้จะถูกส่งเป็นคำสั่ง atomic ไปยัง server` : ""}
                confirmLabel="ลบ grant"
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

function GrantReadiness({
    grant,
}: {
    readonly grant: AuthorizationAdministrationGrantProjectionData;
}): React.ReactElement {
    if (grant.validation.status === "INVALID") {
        return <AuthorizationStatus tone="danger">INVALID · {grant.validation.code}</AuthorizationStatus>;
    }
    const status = grant.capability?.administrativeStatus;
    if (status === "GRANTABLE") {
        return <AuthorizationStatus tone="grantable">VALID · GRANTABLE</AuthorizationStatus>;
    }
    if (status === "POLICY_ACTIVATION_REQUIRED") {
        return (
            <span className="space-y-1">
                <AuthorizationStatus tone="warning">VALID · POLICY_ACTIVATION_REQUIRED</AuthorizationStatus>
                <span className="block text-xs text-status-warning-strong">{getReadinessLabel(status)}</span>
            </span>
        );
    }
    if (status === "DEFERRED") {
        return (
            <span className="space-y-1">
                <AuthorizationStatus tone="deferred">VALID · DEFERRED</AuthorizationStatus>
                <span className="block text-xs text-content-secondary">{getReadinessLabel(status)}</span>
            </span>
        );
    }
    return <AuthorizationStatus tone="neutral">ไม่พบ readiness</AuthorizationStatus>;
}
