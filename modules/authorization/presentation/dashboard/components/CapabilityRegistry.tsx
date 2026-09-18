"use client";

import { useId, useMemo, useState, type ReactElement } from "react";
import { Filter, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/state";

import { AuthorizationStatus } from "./AuthorizationStatus";
import { getReadinessLabel, getRuntimeModeLabel } from "../display";
import {
    getAuthorizationChannelPresentation,
    getAuthorizationDomainPresentation,
    getAuthorizationScopePresentation,
    getCapabilityPresentation,
} from "../permission-presentation";
import type { AuthorizationAdministrationOverviewData } from "../types";

type CapabilityStatus = AuthorizationAdministrationOverviewData["capabilities"][number]["administrativeStatus"];
type StatusFilter = "ALL" | CapabilityStatus;

export function CapabilityRegistry({
    capabilities,
}: {
    readonly capabilities: AuthorizationAdministrationOverviewData["capabilities"];
}): ReactElement {
    const [query, setQuery] = useState("");
    const [domain, setDomain] = useState("ALL");
    const [status, setStatus] = useState<StatusFilter>("ALL");
    const domainId = useId();
    const statusId = useId();
    const domains = useMemo(() => [...new Set(capabilities.map((capability) => capability.domain))].sort(), [capabilities]);
    const filtered = useMemo(() => {
        const normalizedQuery = query.trim().toLocaleLowerCase();
        return capabilities.filter((capability) => {
            if (domain !== "ALL" && capability.domain !== domain) return false;
            if (status !== "ALL" && capability.administrativeStatus !== status) return false;
            if (!normalizedQuery) return true;
            const presentation = getCapabilityPresentation(capability.key);
            return `${capability.key} ${capability.description} ${capability.domain} ${presentation?.actionLabel ?? ""} ${presentation?.description ?? ""}`.toLocaleLowerCase().includes(normalizedQuery);
        });
    }, [capabilities, domain, query, status]);

    return (
        <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
            <div className="border-b border-border-subtle px-4 py-4 sm:px-5">
                <p className="text-xs font-semibold text-action-primary-foreground">สำหรับผู้ดูแลระบบด้านเทคนิค</p>
                <h2 className="mt-1 text-base font-semibold text-content-heading">ข้อมูลสิทธิ์ของระบบ</h2>
                <p className="mt-1 max-w-4xl text-sm leading-6 text-content-secondary">ใช้ตรวจสอบรหัสสิทธิ์ ขอบเขต ช่องทาง และสถานะการจัดการจากข้อมูลที่ระบบส่งมา รายการนี้ไม่ใช่ขั้นตอนหลักสำหรับการเพิ่มสิทธิ์</p>
            </div>
            <div className="grid gap-3 border-b border-border-subtle bg-surface-subtle/60 px-4 py-3 md:grid-cols-[minmax(0,1fr)_12rem_15rem] sm:px-5">
                <div className="space-y-2"><Label htmlFor="authorization-capability-search">ค้นหาข้อมูลสิทธิ์</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" /><Input id="authorization-capability-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ชื่อสิทธิ์ หมวดงาน หรือรหัสทางเทคนิค" className="pl-9" /></div></div>
                <div className="space-y-2"><Label htmlFor={domainId}><Filter className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />หมวดงาน</Label><select id={domainId} value={domain} onChange={(event) => setDomain(event.target.value)} className="h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><option value="ALL">ทุกหมวดงาน</option>{domains.map((item) => <option key={item} value={item}>{getAuthorizationDomainPresentation(item).label} ({item})</option>)}</select></div>
                <div className="space-y-2"><Label htmlFor={statusId}>สถานะการจัดการ</Label><select id={statusId} value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><option value="ALL">ทุกสถานะ</option><option value="GRANTABLE">GRANTABLE</option><option value="POLICY_ACTIVATION_REQUIRED">POLICY_ACTIVATION_REQUIRED</option><option value="DEFERRED">DEFERRED</option></select></div>
            </div>
            {filtered.length === 0 ? <EmptyState compact className="m-4 border-dashed" title="ไม่พบข้อมูลสิทธิ์" description="ลองเปลี่ยนคำค้นหรือ filter" /> : <div className="overflow-x-auto"><table className="min-w-[1080px] w-full text-left text-sm"><caption className="sr-only">ข้อมูลสิทธิ์ของระบบ</caption><thead className="border-b border-border-subtle bg-surface-subtle text-xs font-semibold text-content-secondary"><tr><th scope="col" className="px-4 py-3 sm:px-5">สิทธิ์</th><th scope="col" className="px-4 py-3">หมวดงาน</th><th scope="col" className="px-4 py-3">ขอบเขต / ช่องทาง</th><th scope="col" className="px-4 py-3">runtime mode</th><th scope="col" className="px-4 py-3">administrative status</th></tr></thead><tbody className="divide-y divide-border-subtle">{filtered.map((capability) => <CapabilityRow key={capability.key} capability={capability} />)}</tbody></table></div>}
        </section>
    );
}

function CapabilityRow({
    capability,
}: {
    readonly capability: AuthorizationAdministrationOverviewData["capabilities"][number];
}): ReactElement {
    const presentation = getCapabilityPresentation(capability.key);
    const domain = getAuthorizationDomainPresentation(capability.domain);
    return (
        <tr>
            <td className="max-w-sm px-4 py-3 sm:px-5"><span className="block text-sm font-semibold text-content-heading">{presentation?.actionLabel ?? "สิทธิ์ที่ต้องตรวจสอบ"}</span><span className="mt-1 block leading-5 text-content-secondary">{presentation?.description ?? capability.description}</span><details className="mt-2 text-xs"><summary className="cursor-pointer text-content-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">capability key</summary><span className="mt-1 block break-all font-mono text-content-muted">{capability.key}</span></details></td>
            <td className="px-4 py-3 align-top text-content-body">{domain.label}<span className="mt-1 block font-mono text-xs text-content-muted">{capability.domain}</span></td>
            <td className="px-4 py-3 align-top"><p className="font-mono text-xs text-content-body">{capability.supportedScopes.map((scope) => `${getAuthorizationScopePresentation(scope, capability.key).label} (${scope})`).join(", ") || "—"}</p><p className="mt-2 text-xs leading-5 text-content-secondary">{capability.supportedChannels.map((channel) => getAuthorizationChannelPresentation(channel).label).join(", ") || "—"}</p><details className="mt-2 text-xs"><summary className="cursor-pointer text-content-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">raw values</summary><p className="mt-1 font-mono text-content-muted">scopes: {capability.supportedScopes.join(", ") || "—"}</p><p className="font-mono text-content-muted">channels: {capability.supportedChannels.join(", ") || "—"}</p></details></td>
            <td className="px-4 py-3 align-top"><AuthorizationStatus tone={capability.runtimeAuthorizationMode === "CENTRAL_WITH_COMPATIBILITY" ? "warning" : capability.runtimeAuthorizationMode === "DEFERRED" ? "deferred" : "neutral"}>{getRuntimeModeLabel(capability.runtimeAuthorizationMode)}</AuthorizationStatus></td>
            <td className="px-4 py-3 align-top"><ReadinessStatus status={capability.administrativeStatus} /><p className="mt-2 text-xs leading-5 text-content-secondary">{capability.administrativelyGrantable ? "เพิ่มหรือนำสิทธิ์ออกได้" : capability.nonGrantableReason ?? getReadinessLabel(capability.administrativeStatus)}</p></td>
        </tr>
    );
}

function ReadinessStatus({ status }: { readonly status: CapabilityStatus }): ReactElement {
    const tone = status === "GRANTABLE" ? "grantable" : status === "POLICY_ACTIVATION_REQUIRED" ? "warning" : "deferred";
    return <AuthorizationStatus tone={tone}>{status}</AuthorizationStatus>;
}
