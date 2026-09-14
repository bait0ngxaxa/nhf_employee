"use client";

import { useId, useMemo, useState, type ReactElement } from "react";
import { Filter, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/state";

import { AuthorizationStatus } from "./AuthorizationStatus";
import { getReadinessLabel, getRuntimeModeLabel } from "../display";
import type { AuthorizationAdministrationOverviewData } from "../types";

type StatusFilter = "ALL" | AuthorizationAdministrationOverviewData["capabilities"][number]["administrativeStatus"];

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
            return `${capability.key} ${capability.description} ${capability.domain}`.toLocaleLowerCase().includes(normalizedQuery);
        });
    }, [capabilities, domain, query, status]);

    return (
        <section className="overflow-hidden rounded-xl border border-border-subtle bg-surface-raised">
            <div className="border-b border-border-subtle px-4 py-4 sm:px-5">
                <h2 className="text-base font-semibold text-content-heading">Capability Registry</h2>
                <p className="mt-1 max-w-4xl text-sm leading-6 text-content-secondary">รายการนี้มาจาก server-owned catalog เพื่อให้ operator เห็นว่า Capability ใดพร้อมจัดการ ใดต้องเปิด Policy ก่อน และใดถูกเลื่อนไว้ ไม่ได้ซ่อนรายการที่ยังใช้งานไม่ได้</p>
            </div>
            <div className="grid gap-3 border-b border-border-subtle bg-surface-subtle/60 px-4 py-3 md:grid-cols-[minmax(0,1fr)_12rem_15rem] sm:px-5">
                <div className="space-y-2"><Label htmlFor="authorization-capability-search">ค้นหา Capability</Label><div className="relative"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" /><Input id="authorization-capability-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="key, domain หรือคำอธิบาย" className="pl-9" /></div></div>
                <div className="space-y-2"><Label htmlFor={domainId}><Filter className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />Domain</Label><select id={domainId} value={domain} onChange={(event) => setDomain(event.target.value)} className="h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><option value="ALL">ทุก Domain</option>{domains.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
                <div className="space-y-2"><Label htmlFor={statusId}>สถานะการจัดการ</Label><select id={statusId} value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)} className="h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"><option value="ALL">ทุกสถานะ</option><option value="GRANTABLE">GRANTABLE</option><option value="POLICY_ACTIVATION_REQUIRED">POLICY_ACTIVATION_REQUIRED</option><option value="DEFERRED">DEFERRED</option></select></div>
            </div>
            {filtered.length === 0 ? <EmptyState compact className="m-4 border-dashed" title="ไม่พบ Capability" description="ลองเปลี่ยนคำค้นหรือ filter" /> : <div className="overflow-x-auto"><table className="min-w-[1080px] w-full text-left text-sm"><caption className="sr-only">Capability Registry</caption><thead className="border-b border-border-subtle bg-surface-subtle text-xs font-semibold text-content-secondary"><tr><th scope="col" className="px-4 py-3 sm:px-5">Capability</th><th scope="col" className="px-4 py-3">Domain</th><th scope="col" className="px-4 py-3">Supported scopes / channels</th><th scope="col" className="px-4 py-3">Runtime mode</th><th scope="col" className="px-4 py-3">Administration status</th></tr></thead><tbody className="divide-y divide-border-subtle">{filtered.map((capability) => <tr key={capability.key}><td className="max-w-sm px-4 py-3 sm:px-5"><span className="block break-all font-mono text-xs font-semibold text-content-heading">{capability.key}</span><span className="mt-1 block leading-5 text-content-secondary">{capability.description}</span></td><td className="px-4 py-3 align-top text-content-body">{capability.domain}</td><td className="px-4 py-3 align-top"><p className="font-mono text-xs text-content-body">{capability.supportedScopes.join(", ") || "—"}</p><p className="mt-1 text-xs text-content-secondary">Channels: {capability.supportedChannels.join(", ") || "—"}</p></td><td className="px-4 py-3 align-top"><AuthorizationStatus tone={capability.runtimeAuthorizationMode === "CENTRAL_WITH_COMPATIBILITY" ? "warning" : capability.runtimeAuthorizationMode === "DEFERRED" ? "deferred" : "neutral"}>{getRuntimeModeLabel(capability.runtimeAuthorizationMode)}</AuthorizationStatus>{capability.runtimeAuthorizationMode === "CENTRAL_WITH_COMPATIBILITY" ? <p className="mt-2 max-w-56 text-xs leading-5 text-status-warning-strong">มี compatibility policy เพิ่มเติมในบาง domain</p> : null}</td><td className="px-4 py-3 align-top"><ReadinessStatus status={capability.administrativeStatus} /><p className="mt-2 text-xs leading-5 text-content-secondary">{capability.administrativelyGrantable ? "เพิ่ม/ลบ ordinary grant ได้" : capability.nonGrantableReason ?? getReadinessLabel(capability.administrativeStatus)}</p></td></tr>)}</tbody></table></div>}
        </section>
    );
}

function ReadinessStatus({ status }: { readonly status: StatusFilter extends "ALL" ? never : Exclude<StatusFilter, "ALL"> }): ReactElement {
    const tone = status === "GRANTABLE" ? "grantable" : status === "POLICY_ACTIVATION_REQUIRED" ? "warning" : "deferred";
    return <AuthorizationStatus tone={tone}>{status}</AuthorizationStatus>;
}
