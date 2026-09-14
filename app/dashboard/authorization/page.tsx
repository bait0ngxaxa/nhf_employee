import type { Metadata } from "next";

import {
    getAuthorizationAdministrationOverview,
} from "@/modules/authorization";
import { requireDashboardAuthorizationAdministration } from "@/app/dashboard/_lib/route-access";

export const metadata: Metadata = {
    title: "Authorization Administration | NHFapp",
};

function formatDate(value: Date): string {
    return value.toLocaleString("th-TH");
}

export default async function AuthorizationAdministrationPage(): Promise<React.ReactElement> {
    const principal = await requireDashboardAuthorizationAdministration();
    const overview = await getAuthorizationAdministrationOverview(principal);

    return (
        <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6">
            <header className="space-y-2">
                <p className="text-sm font-medium text-slate-500">
                    การดูแลสิทธิ์การใช้งาน
                </p>
                <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
                    Authorization Administration
                </h1>
                <p className="max-w-3xl text-sm text-slate-600">
                    พื้นที่ตรวจสอบแบบอ่านอย่างเดียวสำหรับ Team และ capability
                    ข้อมูลในหน้านี้ยังไม่เปิดให้แก้ไขการกำหนดสิทธิ์
                </p>
            </header>

            <section
                aria-label="Authorization Administration summary"
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
            >
                <SummaryCard
                    label="Registered capabilities"
                    value={overview.summary.registeredCapabilityCount}
                />
                <SummaryCard
                    label="Administratively grantable"
                    value={overview.summary.administrativelyGrantableCapabilityCount}
                />
                <SummaryCard
                    label="Deferred capabilities"
                    value={overview.summary.deferredCapabilityCount}
                />
                <SummaryCard
                    label="Active Teams"
                    value={`${overview.summary.activeTeamCount}/${overview.summary.teamCount}`}
                />
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                    <h2 className="font-semibold text-slate-900">Teams</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        แสดง configuration ที่ยังคงอยู่แม้ Team จะ inactive
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3 font-medium sm:px-6">Team</th>
                                <th className="px-4 py-3 font-medium">สถานะ</th>
                                <th className="px-4 py-3 font-medium">Roles</th>
                                <th className="px-4 py-3 font-medium">สมาชิก</th>
                                <th className="px-4 py-3 font-medium">Grants</th>
                                <th className="px-4 py-3 font-medium">ปรับปรุงล่าสุด</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {overview.teams.map((team) => (
                                <tr key={team.id}>
                                    <td className="px-4 py-3 sm:px-6">
                                        <div className="font-medium text-slate-900">
                                            {team.name}
                                        </div>
                                        <div className="text-xs text-slate-500">{team.key}</div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <StatusBadge isActive={team.isActive} />
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">{team.roleCount}</td>
                                    <td className="px-4 py-3 text-slate-700">{team.membershipCount}</td>
                                    <td className="px-4 py-3 text-slate-700">{team.teamGrantCount}</td>
                                    <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                                        {formatDate(team.updatedAt)}
                                    </td>
                                </tr>
                            ))}
                            {overview.teams.length === 0 && (
                                <tr>
                                    <td className="px-4 py-8 text-center text-slate-500 sm:px-6" colSpan={6}>
                                        ยังไม่มี Team configuration
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-4 py-4 sm:px-6">
                    <h2 className="font-semibold text-slate-900">Capability registry</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        รายการมาจาก code-owned registry; Deferred ไม่ใช่ capability ที่พร้อมให้ grant
                    </p>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                            <tr>
                                <th className="px-4 py-3 font-medium sm:px-6">Key</th>
                                <th className="px-4 py-3 font-medium">Domain</th>
                                <th className="px-4 py-3 font-medium">Scopes</th>
                                <th className="px-4 py-3 font-medium">Channels</th>
                                <th className="px-4 py-3 font-medium">Administration status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {overview.capabilities.map((capability) => (
                                <tr key={capability.key}>
                                    <td className="px-4 py-3 font-mono text-xs text-slate-800 sm:px-6">
                                        {capability.key}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">{capability.domain}</td>
                                    <td className="px-4 py-3 text-slate-700">
                                        {capability.supportedScopes.join(", ")}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700">
                                        {capability.supportedChannels.join(", ")}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-slate-800">
                                            {capability.administrativeStatus}
                                        </div>
                                        {capability.nonGrantableReason && (
                                            <div className="mt-1 max-w-sm text-xs text-slate-500">
                                                {capability.nonGrantableReason}
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    );
}

function SummaryCard({
    label,
    value,
}: {
    readonly label: string;
    readonly value: number | string;
}): React.ReactElement {
    return (
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
    );
}

function StatusBadge({ isActive }: { readonly isActive: boolean }): React.ReactElement {
    return (
        <span
            className={isActive
                ? "inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"
                : "inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600"}
        >
            {isActive ? "Active" : "Inactive"}
        </span>
    );
}
