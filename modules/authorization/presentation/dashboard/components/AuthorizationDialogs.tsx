"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    AsyncFormDialog,
    AsyncFormDialogClose,
    AsyncFormDialogContent,
} from "@/components/ui/async-form-dialog";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogScrollArea, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatTeamSummary } from "@/shared/identity/team-presentation";

import { LifecycleStatus } from "./AuthorizationStatus";
import { getMutationErrorCopy, getRequestId } from "../display";
import {
    getAuthorizationDomainPresentation,
    getAuthorizationScopePresentation,
    getCapabilityPresentation,
    getCapabilitySearchText,
} from "../permission-presentation";
import { createAuthorizationTechnicalKey } from "../technical-key";
import type {
    AuthorizationAdministrationOverviewData,
    AuthorizationAdministrationTeamDetailData,
    AuthorizationAdministrationUserSummaryData,
    AuthorizationCapabilityGrantInput,
} from "../types";

function FormError({ error }: { readonly error: unknown }): React.ReactElement {
    const copy = getMutationErrorCopy(error);
    const requestId = getRequestId(error);
    return (
        <Alert variant="destructive" className="mt-4">
            <AlertTitle>{copy.title}</AlertTitle>
            <AlertDescription>
                <p>{copy.description}</p>
                {requestId ? (
                    <p className="mt-1 text-xs">Request ID: {requestId}</p>
                ) : null}
            </AlertDescription>
        </Alert>
    );
}

function SubmitButton({
    busy,
    label,
    form,
}: {
    readonly busy: boolean;
    readonly label: string;
    readonly form?: string;
}): React.ReactElement {
    return (
        <Button type="submit" form={form} disabled={busy} aria-busy={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {busy ? "กำลังบันทึก" : label}
        </Button>
    );
}

function normalizeDescription(value: string): string | null {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

export function TeamFormDialog({
    open,
    mode,
    team,
    busy,
    onClose,
    onSubmit,
}: {
    readonly open: boolean;
    readonly mode: "create" | "edit";
    readonly team?: AuthorizationAdministrationTeamDetailData;
    readonly busy: boolean;
    readonly onClose: () => void;
    readonly onSubmit: (input: {
        readonly key?: string;
        readonly name: string;
        readonly description: string | null;
    }) => Promise<void>;
}): React.ReactElement {
    const [key, setKey] = useState("");
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [error, setError] = useState<unknown>(null);
    const nameId = useId();
    const descriptionId = useId();

    useEffect(() => {
        if (!open) return;
        const nextKey = team?.key ?? createAuthorizationTechnicalKey("team");
        setKey(nextKey);
        setName(team?.name ?? "");
        setDescription(team?.description ?? "");
        setError(null);
    }, [open, team]);

    const initialName = team?.name ?? "";
    const initialDescription = team?.description ?? "";
    const dirty = name !== initialName || description !== initialDescription;

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        setError(null);
        try {
            await onSubmit({
                ...(mode === "create" ? { key: key.trim() } : {}),
                name: name.trim(),
                description: normalizeDescription(description),
            });
        } catch (submitError) {
            setError(submitError);
        }
    };

    return (
        <AsyncFormDialog
            open={open}
            busy={busy}
            dirty={dirty}
            onClose={onClose}
            onDiscard={() => {
                setName(initialName);
                setDescription(initialDescription);
                setError(null);
            }}
        >
            <AsyncFormDialogContent className="rounded-2xl p-0 sm:max-w-lg">
                <AsyncFormDialogClose
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-3 top-3 z-10"
                    aria-label="ปิดแบบฟอร์มทีม"
                >
                    <X aria-hidden="true" />
                </AsyncFormDialogClose>
                <DialogHeader className="border-b border-border-subtle bg-surface-subtle px-5 py-4 pr-14 text-left">
                    <DialogTitle className="text-content-heading">
                        {mode === "create" ? "สร้างทีม" : "แก้ไขข้อมูลทีม"}
                    </DialogTitle>
                    <DialogDescription className="leading-6 text-content-secondary">
                        {mode === "create"
                            ? "สร้างทีมสำหรับสมาชิกที่ทำงานร่วมกัน แล้วกำหนดหน้าที่ในทีมตามต้องการ"
                            : "แก้ไขชื่อและคำอธิบายของทีม"}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-5">
                    <div className="space-y-2">
                        <Label htmlFor={nameId}>ชื่อทีม</Label>
                        <Input
                            id={nameId}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            maxLength={191}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={descriptionId}>คำอธิบายทีม (ไม่บังคับ)</Label>
                        <Textarea
                            id={descriptionId}
                            value={description}
                            onChange={(event) => setDescription(event.target.value)}
                            maxLength={191}
                            rows={3}
                        />
                    </div>
                    {error ? <FormError error={error} /> : null}
                    <DialogFooter className="pt-2">
                        <AsyncFormDialogClose variant="outline" disabled={busy}>ยกเลิก</AsyncFormDialogClose>
                        <SubmitButton busy={busy} label={mode === "create" ? "สร้างทีม" : "บันทึกข้อมูล"} />
                    </DialogFooter>
                </form>
            </AsyncFormDialogContent>
        </AsyncFormDialog>
    );
}

export function TeamRoleFormDialog({
    open,
    mode,
    role,
    busy,
    onClose,
    onSubmit,
}: {
    readonly open: boolean;
    readonly mode: "create" | "edit";
    readonly role?: AuthorizationAdministrationTeamDetailData["roles"][number];
    readonly busy: boolean;
    readonly onClose: () => void;
    readonly onSubmit: (input: { readonly key?: string; readonly name: string }) => Promise<void>;
}): React.ReactElement {
    const [key, setKey] = useState("");
    const [name, setName] = useState("");
    const [error, setError] = useState<unknown>(null);
    const nameId = useId();

    useEffect(() => {
        if (!open) return;
        const nextKey = role?.key ?? createAuthorizationTechnicalKey("role");
        setKey(nextKey);
        setName(role?.name ?? "");
        setError(null);
    }, [open, role]);

    const initialName = role?.name ?? "";
    const dirty = name !== initialName;

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        setError(null);
        try {
            await onSubmit({
                ...(mode === "create" ? { key: key.trim() } : {}),
                name: name.trim(),
            });
        } catch (submitError) {
            setError(submitError);
        }
    };

    return (
        <AsyncFormDialog
            open={open}
            busy={busy}
            dirty={dirty}
            onClose={onClose}
            onDiscard={() => {
                setName(initialName);
                setError(null);
            }}
        >
            <AsyncFormDialogContent className="rounded-2xl p-0 sm:max-w-lg">
                <AsyncFormDialogClose variant="ghost" size="icon-sm" className="absolute right-3 top-3 z-10" aria-label="ปิดแบบฟอร์มหน้าที่ในทีม">
                    <X aria-hidden="true" />
                </AsyncFormDialogClose>
                <DialogHeader className="border-b border-border-subtle bg-surface-subtle px-5 py-4 pr-14 text-left">
                    <DialogTitle className="text-content-heading">
                        {mode === "create" ? "เพิ่มหน้าที่ในทีม" : "แก้ไขหน้าที่ในทีม"}
                    </DialogTitle>
                    <DialogDescription className="leading-6 text-content-secondary">
                        หน้าที่ในทีมช่วยแยกความรับผิดชอบของสมาชิก และกำหนดสิทธิ์ให้แต่ละหน้าที่ได้
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-5">
                    <div className="space-y-2">
                        <Label htmlFor={nameId}>ชื่อหน้าที่</Label>
                        <Input id={nameId} value={name} onChange={(event) => setName(event.target.value)} maxLength={191} required />
                    </div>
                    {error ? <FormError error={error} /> : null}
                    <DialogFooter className="pt-2">
                        <AsyncFormDialogClose variant="outline" disabled={busy}>ยกเลิก</AsyncFormDialogClose>
                        <SubmitButton busy={busy} label={mode === "create" ? "เพิ่มหน้าที่" : "บันทึกข้อมูล"} />
                    </DialogFooter>
                </form>
            </AsyncFormDialogContent>
        </AsyncFormDialog>
    );
}

export function AddMemberDialog({
    open,
    team,
    users,
    roles,
    query,
    usersLoading,
    usersError,
    busy,
    onQueryChange,
    onClose,
    onSubmit,
}: {
    readonly open: boolean;
    readonly team: AuthorizationAdministrationTeamDetailData;
    readonly users: readonly AuthorizationAdministrationUserSummaryData[];
    readonly roles: readonly AuthorizationAdministrationTeamDetailData["roles"][number][];
    readonly query: string;
    readonly usersLoading: boolean;
    readonly usersError: Error | undefined;
    readonly busy: boolean;
    readonly onQueryChange: (query: string) => void;
    readonly onClose: () => void;
    readonly onSubmit: (input: { readonly userId: number; readonly teamRoleId: number | null }) => Promise<void>;
}): React.ReactElement {
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [teamRoleId, setTeamRoleId] = useState("");
    const [error, setError] = useState<unknown>(null);
    const queryId = useId();
    const roleId = useId();

    const selectedUser = users.find((user) => user.id === selectedUserId) ?? null;
    const activeRoles = useMemo(() => roles.filter((role) => role.teamId === team.id), [roles, team.id]);
    const dirty = selectedUserId !== null || teamRoleId !== "" || query.trim().length > 0;

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        if (selectedUserId === null) return;
        setError(null);
        try {
            await onSubmit({
                userId: selectedUserId,
                teamRoleId: teamRoleId ? Number(teamRoleId) : null,
            });
        } catch (submitError) {
            setError(submitError);
        }
    };

    return (
        <AsyncFormDialog
            open={open}
            busy={busy}
            dirty={dirty}
            onClose={onClose}
            onDiscard={() => {
                setSelectedUserId(null);
                setTeamRoleId("");
                setError(null);
                onQueryChange("");
            }}
        >
            <AsyncFormDialogContent className="rounded-2xl p-0 sm:max-w-2xl">
                <AsyncFormDialogClose variant="ghost" size="icon-sm" className="absolute right-3 top-3 z-10" aria-label="ปิดแบบฟอร์มเพิ่มสมาชิก">
                    <X aria-hidden="true" />
                </AsyncFormDialogClose>
                <DialogHeader className="border-b border-border-subtle bg-surface-subtle px-5 py-4 pr-14 text-left">
                    <DialogTitle className="text-content-heading">เพิ่มสมาชิกใน {team.name}</DialogTitle>
                    <DialogDescription className="leading-6 text-content-secondary">ค้นหาผู้ใช้ที่จะอยู่ในทีมนี้ แล้วเลือกหน้าที่ในทีมได้ตามต้องการ ระบบจะไม่กำหนดหน้าที่จากแผนกหรือตำแหน่งให้อัตโนมัติ</DialogDescription>
                </DialogHeader>
                <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-5">
                    <div className="space-y-2">
                        <Label htmlFor={queryId}>ค้นหาผู้ใช้</Label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
                            <Input id={queryId} value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="ชื่อ อีเมล หรือรหัสผู้ใช้" className="pl-9" maxLength={100} autoComplete="off" />
                        </div>
                        {usersError ? <div role="alert" className="text-sm text-status-danger-strong"><p>ค้นหาผู้ใช้ไม่สำเร็จ กรุณาลองใหม่</p>{getRequestId(usersError) ? <p className="mt-1 text-xs">Request ID: {getRequestId(usersError)}</p> : null}</div> : null}
                    </div>
                    <div className="max-h-52 overflow-y-auto rounded-lg border border-border-subtle" aria-live="polite">
                        {query.trim().length === 0 ? (
                            <p className="px-3 py-4 text-sm text-content-secondary">พิมพ์คำค้นเพื่อค้นหาผู้ใช้ที่ต้องการ</p>
                        ) : usersLoading ? (
                            <div className="flex items-center gap-2 px-3 py-4 text-sm text-content-secondary" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />กำลังค้นหาผู้ใช้</div>
                        ) : users.length === 0 ? (
                            <p className="px-3 py-4 text-sm text-content-secondary">ไม่พบผู้ใช้ที่ตรงกับคำค้น</p>
                        ) : (
                            <div className="divide-y divide-border-subtle">
                                {users.map((user) => (
                                    <div key={user.id} className={selectedUserId === user.id ? "bg-action-primary-surface" : undefined}>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedUserId(user.id)}
                                            className="flex min-h-14 w-full items-start justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-subtle"
                                            aria-pressed={selectedUserId === user.id}
                                        >
                                            <span className="min-w-0">
                                                <span className="block truncate text-sm font-semibold text-content-heading">{user.name}</span>
                                                <span className="block truncate text-xs text-content-secondary">{user.email}</span>
                                                {user.employee ? <span className="block truncate text-xs text-content-muted">พนักงาน: {user.employee.displayName}</span> : null}
                                                <span className="block truncate text-xs text-content-secondary">{formatTeamSummary(user.teams)}</span>
                                            </span>
                                            <LifecycleStatus isActive={user.isActive} deletedAt={user.deletedAt} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {selectedUser ? (
                        <div className="rounded-lg border border-status-warning-border bg-status-warning-surface px-3 py-3 text-sm text-status-warning-strong">
                            <p className="font-semibold">เลือก {selectedUser.name}</p>
                            {!selectedUser.isActive || selectedUser.deletedAt !== null ? <p className="mt-1">บัญชีนี้ไม่พร้อมใช้งาน การเพิ่มสมาชิกไม่ได้ทำให้บัญชีผ่านการตรวจสอบสถานะของระบบ</p> : null}
                        </div>
                    ) : null}
                    <div className="space-y-2">
                        <Label htmlFor={roleId}>หน้าที่ในทีม (ไม่บังคับ)</Label>
                        <select id={roleId} value={teamRoleId} onChange={(event) => setTeamRoleId(event.target.value)} className="h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                            <option value="">ไม่มีหน้าที่เฉพาะ</option>
                            {activeRoles.map((role) => (
                                <option key={role.id} value={role.id} disabled={!role.isActive}>
                                    {role.name}{role.isActive ? "" : " — ปิดใช้งาน"}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs leading-5 text-content-secondary">แสดงเฉพาะหน้าที่ของทีมนี้ และไม่อนุมานจากตำแหน่งหรือหน่วยงาน</p>
                    </div>
                    {error ? <FormError error={error} /> : null}
                    <DialogFooter className="pt-2">
                        <AsyncFormDialogClose variant="outline" disabled={busy}>ยกเลิก</AsyncFormDialogClose>
                        <SubmitButton busy={busy} label="เพิ่มสมาชิก" />
                    </DialogFooter>
                </form>
            </AsyncFormDialogContent>
        </AsyncFormDialog>
    );
}

type GrantSource = "TEAM" | "TEAM_ROLE" | "USER";
type GrantFormStep = "choose" | "review";

export function GrantFormDialog({
    open,
    source,
    capabilities,
    busy,
    onClose,
    onSubmit,
}: {
    readonly open: boolean;
    readonly source: GrantSource;
    readonly capabilities: AuthorizationAdministrationOverviewData["capabilities"];
    readonly busy: boolean;
    readonly onClose: () => void;
    readonly onSubmit: (input: AuthorizationCapabilityGrantInput) => Promise<void>;
}): React.ReactElement {
    const [query, setQuery] = useState("");
    const [capabilityKey, setCapabilityKey] = useState("");
    const [scope, setScope] = useState("");
    const [step, setStep] = useState<GrantFormStep>("choose");
    const [error, setError] = useState<unknown>(null);
    const queryId = useId();
    const formId = useId();

    const grantableCapabilities = useMemo(
        () => capabilities
            .filter((capability) => capability.administrativelyGrantable)
            .filter((capability) => getCapabilityPresentation(capability.key) !== undefined)
            .sort((left, right) => {
                const leftLabel = getCapabilityPresentation(left.key)?.actionLabel ?? "";
                const rightLabel = getCapabilityPresentation(right.key)?.actionLabel ?? "";
                return leftLabel.localeCompare(rightLabel, "th");
            }),
        [capabilities],
    );
    const normalizedQuery = query.trim().toLocaleLowerCase();
    const groupedCapabilities = useMemo(() => {
        const groups = new Map<string, {
            readonly domain: string;
            readonly capabilities: AuthorizationAdministrationOverviewData["capabilities"][number][];
        }>();
        for (const capability of grantableCapabilities) {
            if (
                normalizedQuery.length > 0
                && !getCapabilitySearchText(capability.key, capability.domain).includes(normalizedQuery)
            ) {
                continue;
            }
            const existing = groups.get(capability.domain);
            if (existing) {
                existing.capabilities.push(capability);
            } else {
                groups.set(capability.domain, {
                    domain: capability.domain,
                    capabilities: [capability],
                });
            }
        }
        return [...groups.values()].sort((left, right) =>
            getAuthorizationDomainPresentation(left.domain).label.localeCompare(
                getAuthorizationDomainPresentation(right.domain).label,
                "th",
            ));
    }, [grantableCapabilities, normalizedQuery]);
    const selectedCapability = grantableCapabilities.find((capability) => capability.key === capabilityKey);
    const selectedPresentation = selectedCapability === undefined
        ? undefined
        : getCapabilityPresentation(selectedCapability.key);
    const supportedScopes = useMemo(
        () => selectedCapability?.supportedScopes.filter((value) => source !== "USER" || value !== "TEAM") ?? [],
        [selectedCapability, source],
    );
    const effectiveScope = supportedScopes.some((value) => value === scope)
        ? scope
        : supportedScopes[0] ?? "";

    const sourceLabel = source === "TEAM"
        ? "ทีม"
        : source === "TEAM_ROLE"
            ? "หน้าที่ในทีม"
            : "ผู้ใช้รายนี้";
    const sourceDescription = source === "USER"
        ? "นี่คือสิทธิ์เฉพาะบุคคล ใช้เป็นข้อยกเว้นเมื่อผู้ใช้ต้องทำงานเพิ่มเติม โดยทั่วไปควรจัดสิทธิ์ผ่านทีมหรือหน้าที่ในทีม"
        : source === "TEAM"
            ? "สมาชิกทุกคนในทีมจะได้รับสิทธิ์เพิ่มเติมนี้ตามสถานะและกฎของระบบ"
            : "สมาชิกที่มีหน้าที่นี้จะได้รับสิทธิ์เพิ่มเติมนี้ตามสถานะและกฎของระบบ";
    const dirty = query.length > 0 || capabilityKey.length > 0 || scope.length > 0 || step === "review";

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        if (!selectedCapability?.administrativelyGrantable || !effectiveScope) return;
        if (step === "choose") {
            setStep("review");
            return;
        }
        setError(null);
        try {
            await onSubmit({ capabilityKey, scope: effectiveScope });
        } catch (submitError) {
            setError(submitError);
        }
    };

    return (
        <AsyncFormDialog
            open={open}
            busy={busy}
            dirty={dirty}
            onClose={onClose}
            onDiscard={() => {
                setQuery("");
                setCapabilityKey("");
                setScope("");
                setStep("choose");
                setError(null);
            }}
        >
            <AsyncFormDialogContent className="rounded-2xl p-0 sm:max-w-4xl">
                <AsyncFormDialogClose variant="ghost" size="icon-sm" className="absolute right-3 top-3 z-10" aria-label="ปิดแบบฟอร์มเพิ่มสิทธิ์">
                    <X aria-hidden="true" />
                </AsyncFormDialogClose>
                <DialogHeader className="border-b border-border-subtle bg-surface-subtle px-5 py-4 pr-14 text-left">
                    <DialogTitle className="text-content-heading">เพิ่มสิทธิ์</DialogTitle>
                    <DialogDescription className="leading-6 text-content-secondary">
                        {sourceDescription} ระบบจะแสดงเฉพาะสิทธิ์ที่พร้อมจัดการ
                    </DialogDescription>
                </DialogHeader>
                <DialogScrollArea className="px-5">
                    <form id={formId} onSubmit={(event) => void handleSubmit(event)} className="space-y-4 py-5">
                        {step === "choose" ? (
                            <>
                                <ol className="grid gap-2 rounded-lg border border-border-subtle bg-surface-subtle/60 px-4 py-3 text-sm text-content-secondary sm:grid-cols-3">
                                    <li><span className="font-semibold text-content-heading">1.</span> เลือกสิ่งที่ต้องการให้ทำ</li>
                                    <li><span className="font-semibold text-content-heading">2.</span> เลือกขอบเขต</li>
                                    <li><span className="font-semibold text-content-heading">3.</span> ตรวจสอบก่อนยืนยัน</li>
                                </ol>
                                <div className="space-y-2">
                                    <Label htmlFor={queryId}>ค้นหาสิทธิ์</Label>
                                    <div className="relative">
                                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
                                        <Input id={queryId} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="เช่น เบิก, คลัง, อนุมัติ, พนักงาน, งานประจำ" className="pl-9" autoComplete="off" />
                                    </div>
                                </div>
                                <div className="grid gap-4 md:grid-cols-[minmax(0,1.05fr)_minmax(18rem,0.95fr)] md:items-start">
                                    <div data-testid="permission-selector" className="space-y-4" aria-live="polite">
                                        <div className="rounded-lg border border-border-subtle p-3">
                                            {groupedCapabilities.length === 0 ? (
                                                <p className="px-2 py-5 text-center text-sm text-content-secondary">ไม่พบสิทธิ์ที่พร้อมให้จัดการจากคำค้นนี้</p>
                                            ) : groupedCapabilities.map((group) => {
                                                const domain = getAuthorizationDomainPresentation(group.domain);
                                                return (
                                                    <section key={group.domain} aria-labelledby={`authorization-permission-domain-${group.domain}`} className="mt-4 first:mt-0">
                                                        <h3 id={`authorization-permission-domain-${group.domain}`} className="px-2 text-sm font-semibold text-content-heading">{domain.label}</h3>
                                                        <div className="mt-2 grid gap-2">
                                                            {group.capabilities.map((capability) => {
                                                                const presentation = getCapabilityPresentation(capability.key);
                                                                if (!presentation) return null;
                                                                const selected = capability.key === capabilityKey;
                                                                return (
                                                                    <button
                                                                        type="button"
                                                                        key={capability.key}
                                                                        aria-pressed={selected}
                                                                        onClick={() => setCapabilityKey(capability.key)}
                                                                        className={`rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${selected ? "border-action-primary-solid bg-action-primary-surface" : "border-border-subtle bg-surface-raised hover:bg-surface-subtle"}`}
                                                                    >
                                                                        <span className="block text-sm font-semibold text-content-heading">{presentation.actionLabel}</span>
                                                                        <span className="mt-1 block text-xs leading-5 text-content-secondary">{presentation.description}</span>
                                                                    </button>
                                                                );
                                                            })}
                                                        </div>
                                                    </section>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    <div data-testid="permission-editor" className="min-w-0 md:sticky md:top-0">
                                        {selectedCapability && selectedPresentation ? (
                                            <div className="space-y-3 rounded-lg border border-action-primary-solid/40 bg-action-primary-surface px-3 py-3">
                                                <div>
                                                    <p className="text-xs font-semibold text-action-primary-foreground">สิ่งที่จะให้ทำ</p>
                                                    <p className="mt-1 font-semibold text-content-heading">{selectedPresentation.actionLabel}</p>
                                                    <p className="mt-1 text-sm leading-6 text-content-secondary">{selectedPresentation.description}</p>
                                                </div>
                                                <fieldset className="space-y-2">
                                                    <legend className="text-sm font-semibold text-content-heading">ขอบเขตการเข้าถึง</legend>
                                                    {supportedScopes.length === 0 ? <p className="text-sm text-status-danger-strong">สิทธิ์นี้ยังไม่มีขอบเขตที่ใช้ได้กับแหล่งที่มา</p> : supportedScopes.map((value) => {
                                                        const presentation = getAuthorizationScopePresentation(value, selectedCapability.key);
                                                        return (
                                                            <label key={value} className={`flex cursor-pointer gap-3 rounded-md border px-3 py-2 transition-colors ${effectiveScope === value ? "border-action-primary-solid bg-surface-raised" : "border-border-subtle bg-surface-raised/70"}`}>
                                                                <input type="radio" name="authorization-scope" value={value} checked={effectiveScope === value} onChange={() => setScope(value)} className="mt-1 h-4 w-4 accent-action-primary-solid" />
                                                                <span><span className="block text-sm font-semibold text-content-heading">{presentation.label}</span><span className="block text-xs leading-5 text-content-secondary">{presentation.description}</span></span>
                                                            </label>
                                                        );
                                                    })}
                                                </fieldset>
                                            </div>
                                        ) : <div className="rounded-lg border border-dashed border-border-subtle px-4 py-6 text-sm leading-6 text-content-secondary">เลือกสิทธิ์จากรายการเพื่อดูขอบเขตการเข้าถึง</div>}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="space-y-4">
                                <div className="rounded-lg border border-action-primary-solid/40 bg-action-primary-surface px-4 py-4">
                                    <h3 className="text-base font-semibold text-content-heading">ตรวจสอบสิ่งที่จะเปลี่ยน</h3>
                                    <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                                        <div><dt className="text-content-secondary">ให้กับ</dt><dd className="mt-1 font-semibold text-content-heading">{sourceLabel}</dd></div>
                                        <div><dt className="text-content-secondary">สิทธิ์</dt><dd className="mt-1 font-semibold text-content-heading">{selectedPresentation?.actionLabel ?? "สิทธิ์ที่ต้องตรวจสอบ"}</dd></div>
                                        <div className="sm:col-span-2"><dt className="text-content-secondary">ขอบเขต</dt><dd className="mt-1 font-semibold text-content-heading">{getAuthorizationScopePresentation(effectiveScope, selectedCapability?.key).label}</dd><dd className="mt-1 text-xs leading-5 text-content-secondary">{getAuthorizationScopePresentation(effectiveScope, selectedCapability?.key).description}</dd></div>
                                    </dl>
                                </div>
                                <p className="text-sm leading-6 text-content-secondary">หลังบันทึก ระบบจะคำนวณสิทธิ์ที่ใช้งานได้ใหม่ และโหลดข้อมูลล่าสุดให้อัตโนมัติ การทำรายการจริงยังขึ้นอยู่กับเจ้าของข้อมูล ผู้รับผิดชอบ สถานะรายการ และขั้นตอนการทำงาน</p>
                            </div>
                        )}
                        {error ? <FormError error={error} /> : null}
                    </form>
                </DialogScrollArea>
                <DialogFooter className="shrink-0 border-t border-border-subtle bg-surface-raised px-5 py-4">
                    <AsyncFormDialogClose variant="outline" disabled={busy}>ยกเลิก</AsyncFormDialogClose>
                    {step === "review" ? <Button type="button" variant="ghost" onClick={() => { setError(null); setStep("choose"); }} disabled={busy}>ย้อนกลับ</Button> : null}
                    <SubmitButton form={formId} busy={busy} label={step === "review" ? "ยืนยันเพิ่มสิทธิ์" : "ตรวจสอบการเปลี่ยนแปลง"} />
                </DialogFooter>
            </AsyncFormDialogContent>
        </AsyncFormDialog>
    );
}

export function ConfirmAuthorizationAction({
    sessionId,
    open,
    title,
    description,
    confirmLabel,
    destructive = false,
    busy,
    onClose,
    onConfirm,
}: {
    readonly sessionId: string;
    readonly open: boolean;
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
    readonly destructive?: boolean;
    readonly busy: boolean;
    readonly onClose: () => void;
    readonly onConfirm: () => Promise<void>;
}): React.ReactElement {
    return (
        <AlertDialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !busy) onClose(); }}>
            <ConfirmAuthorizationActionSession
                key={sessionId}
                busy={busy}
                confirmLabel={confirmLabel}
                destructive={destructive}
                description={description}
                onConfirm={onConfirm}
                title={title}
            />
        </AlertDialog>
    );
}

function ConfirmAuthorizationActionSession({
    title,
    description,
    confirmLabel,
    destructive,
    busy,
    onConfirm,
}: {
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
    readonly destructive: boolean;
    readonly busy: boolean;
    readonly onConfirm: () => Promise<void>;
}): React.ReactElement {
    const [error, setError] = useState<unknown>(null);

    const confirm = async (): Promise<void> => {
        setError(null);
        try {
            await onConfirm();
        } catch (confirmError) {
            setError(confirmError);
        }
    };

    return (
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>{title}</AlertDialogTitle>
                <AlertDialogDescription>{description}</AlertDialogDescription>
            </AlertDialogHeader>
            {error ? <FormError error={error} /> : null}
            <AlertDialogFooter>
                <AlertDialogCancel disabled={busy}>ยกเลิก</AlertDialogCancel>
                <AlertDialogAction variant={destructive ? "destructive" : "default"} disabled={busy} aria-busy={busy} onClick={(event) => { event.preventDefault(); void confirm(); }}>
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    {busy ? "กำลังดำเนินการ" : confirmLabel}
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    );
}
