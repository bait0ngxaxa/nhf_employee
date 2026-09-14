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
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { LifecycleStatus } from "./AuthorizationStatus";
import { getMutationErrorCopy, getRequestId } from "../display";
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
}: {
    readonly busy: boolean;
    readonly label: string;
}): React.ReactElement {
    return (
        <Button type="submit" disabled={busy} aria-busy={busy}>
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
    const keyId = useId();
    const descriptionId = useId();

    useEffect(() => {
        if (!open) return;
        setKey(team?.key ?? "");
        setName(team?.name ?? "");
        setDescription(team?.description ?? "");
        setError(null);
    }, [open, team]);

    const initialKey = team?.key ?? "";
    const initialName = team?.name ?? "";
    const initialDescription = team?.description ?? "";
    const dirty = key !== initialKey || name !== initialName || description !== initialDescription;

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
                setKey(initialKey);
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
                    aria-label="ปิดแบบฟอร์ม Team"
                >
                    <X aria-hidden="true" />
                </AsyncFormDialogClose>
                <DialogHeader className="border-b border-border-subtle bg-surface-subtle px-5 py-4 pr-14 text-left">
                    <DialogTitle className="text-content-heading">
                        {mode === "create" ? "สร้าง Team" : "แก้ไขข้อมูล Team"}
                    </DialogTitle>
                    <DialogDescription className="leading-6 text-content-secondary">
                        {mode === "create"
                            ? "Team คือกลุ่มสิทธิ์การทำงานสำหรับจัดระเบียบสมาชิกและ grants"
                            : "แก้ไขเฉพาะข้อมูลแสดงผลของ Team; key เป็นตัวระบุถาวรและแก้ไขไม่ได้"}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-5">
                    {mode === "create" ? (
                        <div className="space-y-2">
                            <Label htmlFor={keyId}>key</Label>
                            <Input
                                id={keyId}
                                value={key}
                                onChange={(event) => setKey(event.target.value)}
                                placeholder="routine-operations"
                                maxLength={191}
                                required
                                autoComplete="off"
                            />
                            <p className="text-xs leading-5 text-content-secondary">
                                Stable technical identifier; ปกติไม่ควรเปลี่ยนหลังสร้าง
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            <Label htmlFor={keyId}>key</Label>
                            <Input id={keyId} value={key} readOnly aria-readonly="true" className="bg-surface-subtle font-mono" />
                        </div>
                    )}
                    <div className="space-y-2">
                        <Label htmlFor={nameId}>ชื่อ Team</Label>
                        <Input
                            id={nameId}
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            maxLength={191}
                            required
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={descriptionId}>คำอธิบาย (ไม่บังคับ)</Label>
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
                        <SubmitButton busy={busy} label={mode === "create" ? "สร้าง Team" : "บันทึกข้อมูล"} />
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
    const keyId = useId();
    const nameId = useId();

    useEffect(() => {
        if (!open) return;
        setKey(role?.key ?? "");
        setName(role?.name ?? "");
        setError(null);
    }, [open, role]);

    const initialKey = role?.key ?? "";
    const initialName = role?.name ?? "";
    const dirty = key !== initialKey || name !== initialName;

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
                setKey(initialKey);
                setName(initialName);
                setError(null);
            }}
        >
            <AsyncFormDialogContent className="rounded-2xl p-0 sm:max-w-lg">
                <AsyncFormDialogClose variant="ghost" size="icon-sm" className="absolute right-3 top-3 z-10" aria-label="ปิดแบบฟอร์ม TeamRole">
                    <X aria-hidden="true" />
                </AsyncFormDialogClose>
                <DialogHeader className="border-b border-border-subtle bg-surface-subtle px-5 py-4 pr-14 text-left">
                    <DialogTitle className="text-content-heading">
                        {mode === "create" ? "สร้าง TeamRole" : "แก้ไข TeamRole"}
                    </DialogTitle>
                    <DialogDescription className="leading-6 text-content-secondary">
                        TeamRole คือบทบาทภายใน Team; ชื่อหรือ key ไม่ได้ให้สิทธิ์เองจนกว่าจะมี grant
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-5">
                    <div className="space-y-2">
                        <Label htmlFor={keyId}>key</Label>
                        <Input id={keyId} value={key} onChange={(event) => setKey(event.target.value)} readOnly={mode === "edit"} maxLength={191} required className={mode === "edit" ? "bg-surface-subtle font-mono" : "font-mono"} />
                        <p className="text-xs leading-5 text-content-secondary">{mode === "edit" ? "key แก้ไขไม่ได้หลังสร้าง" : "Stable technical identifier ของบทบาท"}</p>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={nameId}>ชื่อ TeamRole</Label>
                        <Input id={nameId} value={name} onChange={(event) => setName(event.target.value)} maxLength={191} required />
                    </div>
                    {error ? <FormError error={error} /> : null}
                    <DialogFooter className="pt-2">
                        <AsyncFormDialogClose variant="outline" disabled={busy}>ยกเลิก</AsyncFormDialogClose>
                        <SubmitButton busy={busy} label={mode === "create" ? "สร้าง TeamRole" : "บันทึกข้อมูล"} />
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

    useEffect(() => {
        if (!open) return;
        setSelectedUserId(null);
        setTeamRoleId("");
        setError(null);
        onQueryChange("");
    }, [open, onQueryChange]);

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
                    <DialogDescription className="leading-6 text-content-secondary">ค้นหาจากชื่อ อีเมล หรือ User ID แล้วเลือก TeamRole ได้ตามต้องการ ระบบจะไม่กำหนดบทบาทให้อัตโนมัติ</DialogDescription>
                </DialogHeader>
                <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-5">
                    <div className="space-y-2">
                        <Label htmlFor={queryId}>ค้นหา User</Label>
                        <div className="relative">
                            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-content-muted" aria-hidden="true" />
                            <Input id={queryId} value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="ชื่อ, email หรือ User ID" className="pl-9" maxLength={100} autoComplete="off" />
                        </div>
                        {usersError ? <div role="alert" className="text-sm text-status-danger-strong"><p>ค้นหา User ไม่สำเร็จ กรุณาลองใหม่</p>{getRequestId(usersError) ? <p className="mt-1 text-xs">Request ID: {getRequestId(usersError)}</p> : null}</div> : null}
                    </div>
                    <div className="max-h-52 overflow-y-auto rounded-lg border border-border-subtle" aria-live="polite">
                        {query.trim().length === 0 ? (
                            <p className="px-3 py-4 text-sm text-content-secondary">พิมพ์คำค้นเพื่อค้นหา User ที่ต้องการ</p>
                        ) : usersLoading ? (
                            <div className="flex items-center gap-2 px-3 py-4 text-sm text-content-secondary" role="status"><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />กำลังค้นหา User</div>
                        ) : users.length === 0 ? (
                            <p className="px-3 py-4 text-sm text-content-secondary">ไม่พบ User ที่ตรงกับคำค้น</p>
                        ) : (
                            <div className="divide-y divide-border-subtle">
                                {users.map((user) => (
                                    <button
                                        type="button"
                                        key={user.id}
                                        onClick={() => setSelectedUserId(user.id)}
                                        className={`flex min-h-14 w-full items-start justify-between gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-subtle ${selectedUserId === user.id ? "bg-action-primary-surface" : ""}`}
                                        aria-pressed={selectedUserId === user.id}
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-sm font-semibold text-content-heading">{user.name}</span>
                                            <span className="block truncate text-xs text-content-secondary">{user.email} · ID {user.id}</span>
                                            {user.employee ? <span className="block truncate text-xs text-content-muted">พนักงาน: {user.employee.displayName}</span> : null}
                                        </span>
                                        <LifecycleStatus isActive={user.isActive} deletedAt={user.deletedAt} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {selectedUser ? (
                        <div className="rounded-lg border border-status-warning-border bg-status-warning-surface px-3 py-3 text-sm text-status-warning-strong">
                            <p className="font-semibold">เลือก {selectedUser.name}</p>
                            {!selectedUser.isActive || selectedUser.deletedAt !== null ? <p className="mt-1">บัญชีนี้ไม่ Active การกำหนด configuration ไม่ได้ทำให้บัญชีผ่าน runtime lifecycle checks</p> : null}
                        </div>
                    ) : null}
                    <div className="space-y-2">
                        <Label htmlFor={roleId}>TeamRole (ไม่บังคับ)</Label>
                        <select id={roleId} value={teamRoleId} onChange={(event) => setTeamRoleId(event.target.value)} className="h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                            <option value="">ไม่กำหนด TeamRole</option>
                            {activeRoles.map((role) => (
                                <option key={role.id} value={role.id} disabled={!role.isActive}>
                                    {role.name} ({role.key}){role.isActive ? "" : " — Inactive"}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs leading-5 text-content-secondary">แสดงเฉพาะ TeamRole ของ Team นี้ และไม่อนุมานจากตำแหน่งหรือ Department</p>
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

export function GrantFormDialog({
    open,
    source,
    capabilities,
    busy,
    onClose,
    onSubmit,
}: {
    readonly open: boolean;
    readonly source: "TEAM" | "TEAM_ROLE" | "USER";
    readonly capabilities: AuthorizationAdministrationOverviewData["capabilities"];
    readonly busy: boolean;
    readonly onClose: () => void;
    readonly onSubmit: (input: AuthorizationCapabilityGrantInput) => Promise<void>;
}): React.ReactElement {
    const [capabilityKey, setCapabilityKey] = useState("");
    const [scope, setScope] = useState("");
    const [error, setError] = useState<unknown>(null);
    const capabilityId = useId();
    const scopeId = useId();

    useEffect(() => {
        if (!open) return;
        setCapabilityKey("");
        setScope("");
        setError(null);
    }, [open]);

    const selectedCapability = capabilities.find((capability) => capability.key === capabilityKey);
    const supportedScopes = useMemo(
        () => selectedCapability?.supportedScopes.filter((value) => source !== "USER" || value !== "TEAM") ?? [],
        [selectedCapability, source],
    );
    const dirty = capabilityKey.length > 0 || scope.length > 0;

    useEffect(() => {
        if (!supportedScopes.some((value) => value === scope)) setScope(supportedScopes[0] ?? "");
    }, [scope, supportedScopes]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        if (!selectedCapability?.administrativelyGrantable || !scope) return;
        setError(null);
        try {
            await onSubmit({ capabilityKey, scope });
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
                setCapabilityKey("");
                setScope("");
                setError(null);
            }}
        >
            <AsyncFormDialogContent className="rounded-2xl p-0 sm:max-w-2xl">
                <AsyncFormDialogClose variant="ghost" size="icon-sm" className="absolute right-3 top-3 z-10" aria-label="ปิดแบบฟอร์ม grant">
                    <X aria-hidden="true" />
                </AsyncFormDialogClose>
                <DialogHeader className="border-b border-border-subtle bg-surface-subtle px-5 py-4 pr-14 text-left">
                    <DialogTitle className="text-content-heading">เพิ่ม {source === "TEAM" ? "Team" : source === "TEAM_ROLE" ? "TeamRole" : "Direct User"} grant</DialogTitle>
                    <DialogDescription className="leading-6 text-content-secondary">เพิ่ม grant แบบ atomic รายการเดียวจาก catalog ของ server; ไม่มีการแทนที่ permission matrix ทั้งชุด</DialogDescription>
                </DialogHeader>
                <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4 px-5 py-5">
                    <div className="space-y-2">
                        <Label htmlFor={capabilityId}>Capability</Label>
                        <select id={capabilityId} value={capabilityKey} onChange={(event) => setCapabilityKey(event.target.value)} className="h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
                            <option value="">เลือก Capability</option>
                            {capabilities.map((capability) => (
                                <option key={capability.key} value={capability.key} disabled={!capability.administrativelyGrantable}>
                                    {capability.key} — {capability.administrativeStatus}
                                </option>
                            ))}
                        </select>
                    </div>
                    {selectedCapability ? (
                        <div className={`rounded-lg border px-3 py-3 text-sm ${selectedCapability.administrativelyGrantable ? "border-status-success-border bg-status-success-surface text-status-success-text" : "border-status-warning-border bg-status-warning-surface text-status-warning-strong"}`}>
                            <p className="font-semibold">{selectedCapability.description}</p>
                            <p className="mt-1">สถานะการจัดการ: {selectedCapability.administrativeStatus}</p>
                            {!selectedCapability.administrativelyGrantable && selectedCapability.nonGrantableReason ? <p className="mt-1">เหตุผล: {selectedCapability.nonGrantableReason}</p> : null}
                        </div>
                    ) : null}
                    <div className="space-y-2">
                        <Label htmlFor={scopeId}>Scope</Label>
                        <select id={scopeId} value={scope} onChange={(event) => setScope(event.target.value)} disabled={!selectedCapability || supportedScopes.length === 0} className="h-11 w-full rounded-md border border-input bg-surface-raised px-3 text-sm text-content-body focus-visible:border-ring focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60">
                            <option value="">เลือก Scope</option>
                            {supportedScopes.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                        {source === "USER" ? <p className="text-xs leading-5 text-content-secondary">Direct User grant ไม่แสดง TEAM scope เพราะไม่มี Team origin</p> : null}
                    </div>
                    {error ? <FormError error={error} /> : null}
                    <DialogFooter className="pt-2">
                        <AsyncFormDialogClose variant="outline" disabled={busy}>ยกเลิก</AsyncFormDialogClose>
                        <SubmitButton busy={busy} label="เพิ่ม grant" />
                    </DialogFooter>
                </form>
            </AsyncFormDialogContent>
        </AsyncFormDialog>
    );
}

export function ConfirmAuthorizationAction({
    open,
    title,
    description,
    confirmLabel,
    destructive = false,
    busy,
    onClose,
    onConfirm,
}: {
    readonly open: boolean;
    readonly title: string;
    readonly description: string;
    readonly confirmLabel: string;
    readonly destructive?: boolean;
    readonly busy: boolean;
    readonly onClose: () => void;
    readonly onConfirm: () => Promise<void>;
}): React.ReactElement {
    const [error, setError] = useState<unknown>(null);

    useEffect(() => {
        if (open) setError(null);
    }, [open]);

    const confirm = async (): Promise<void> => {
        setError(null);
        try {
            await onConfirm();
        } catch (confirmError) {
            setError(confirmError);
        }
    };

    return (
        <AlertDialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen && !busy) onClose(); }}>
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
        </AlertDialog>
    );
}
