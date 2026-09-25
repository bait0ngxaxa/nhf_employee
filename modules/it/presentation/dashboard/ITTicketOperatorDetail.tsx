"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { API_ROUTES, APP_ROUTES } from "@/lib/ssot/routes";
import { ITTicketConversation } from "./ITTicketConversation";

import {
    IT_TICKET_STATUS_LABELS,
    IT_TICKET_TYPE_LABELS,
    type ITOperatorReferenceData,
    type ITOperatorTicket,
    type ITPresentationCapabilities,
} from "../../contracts";
import type { ITTicketStatus } from "@prisma/client";
import { getAllowedITTicketTransitions } from "../../domain/ticket-workflow";
import {
    formatITTicketDate,
    IT_TICKET_STATUS_STYLES,
    isITOperatorMutationVersionConflict,
    isITTicketResponseRecord,
    parseITOperatorReferenceData,
    parseITOperatorTicket,
    parseITOperatorTicketMutationSnapshot,
    readITOperatorError,
} from "./ticket-presentation";

type DetailState =
    | { readonly key: string; readonly kind: "loaded"; readonly ticket: ITOperatorTicket }
    | { readonly key: string; readonly kind: "error"; readonly message: string };

type ReferenceState =
    | { readonly key: number; readonly kind: "loaded"; readonly value: ITOperatorReferenceData }
    | { readonly key: number; readonly kind: "error"; readonly message: string };

const STATUS_ACTION_LABELS: Readonly<Partial<Record<ITTicketStatus, string>>> = {
    IN_PROGRESS: "เริ่มดำเนินการ",
    WAITING_REQUESTER: "รอข้อมูลจากผู้แจ้ง",
    RESOLVED: "ทำเครื่องหมายว่าแก้ไขแล้ว",
};

function TicketStatus({ status }: { readonly status: ITTicketStatus }): ReactElement {
    return (
        <span className={`inline-flex min-h-7 w-fit items-center rounded-full px-3 py-1 text-xs font-semibold ${IT_TICKET_STATUS_STYLES[status]}`}>
            {IT_TICKET_STATUS_LABELS[status]}
        </span>
    );
}

export function ITTicketOperatorDetail({
    ticketId,
    capabilities,
}: {
    readonly ticketId: number;
    readonly capabilities: ITPresentationCapabilities;
}): ReactElement {
    const [detailState, setDetailState] = useState<DetailState | null>(null);
    const [referenceState, setReferenceState] = useState<ReferenceState | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [referenceRefreshKey, setReferenceRefreshKey] = useState(0);
    const [busy, setBusy] = useState(false);
    const [actionError, setActionError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<string | null>(null);
    const [conflictReviewRequired, setConflictReviewRequired] = useState(false);
    const [mutationAccessDenied, setMutationAccessDenied] = useState(false);
    const inFlightRef = useRef(false);
    const requiredVersionRef = useRef(0);

    const detailKey = `${ticketId}:${refreshKey}`;
    const currentDetail = detailState?.key === detailKey ? detailState : null;
    const ticket = currentDetail?.kind === "loaded" ? currentDetail.ticket : null;
    const detailError = currentDetail?.kind === "error" ? currentDetail.message : null;
    const loading = currentDetail === null;
    const currentReference = referenceState?.key === referenceRefreshKey ? referenceState : null;
    const reference = currentReference?.kind === "loaded" ? currentReference.value : null;
    const referenceError = currentReference?.kind === "error" ? currentReference.message : null;

    useEffect(() => {
        const controller = new AbortController();
        void fetch(API_ROUTES.itOperatorTickets.byId(ticketId), { signal: controller.signal })
            .then(async (response) => {
                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok) throw new Error(readITOperatorError(payload, response.status, true));
                if (!isITTicketResponseRecord(payload) || payload.success !== true) {
                    throw new Error("ข้อมูล Ticket ไม่ถูกต้อง กรุณาลองอีกครั้ง");
                }
                const parsed = parseITOperatorTicket(payload.ticket);
                if (parsed === null) throw new Error("ข้อมูล Ticket ไม่ถูกต้อง กรุณาลองอีกครั้ง");
                if (controller.signal.aborted) return;
                if (parsed.version < requiredVersionRef.current) {
                    setDetailState({
                        key: detailKey,
                        kind: "error",
                        message: "ข้อมูล Ticket ยังไม่ตรงกับผลการบันทึกล่าสุด กรุณาโหลดข้อมูลใหม่",
                    });
                    return;
                }
                requiredVersionRef.current = 0;
                setDetailState({ key: detailKey, kind: "loaded", ticket: parsed });
            })
            .catch((cause: unknown) => {
                if (controller.signal.aborted) return;
                setDetailState({
                    key: detailKey,
                    kind: "error",
                    message: cause instanceof Error
                        ? cause.message
                        : readITOperatorError(null, 500, true),
                });
            });
        return () => controller.abort();
    }, [ticketId, detailKey]);

    useEffect(() => {
        const controller = new AbortController();
        void fetch(API_ROUTES.itOperatorTickets.reference, { signal: controller.signal })
            .then(async (response) => {
                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok) throw new Error(readITOperatorError(payload, response.status));
                const parsed = parseITOperatorReferenceData(payload);
                if (parsed === null) throw new Error("ข้อมูลตัวเลือก Ticket ไม่ถูกต้อง กรุณาลองอีกครั้ง");
                if (controller.signal.aborted) return;
                setReferenceState({ key: referenceRefreshKey, kind: "loaded", value: parsed });
            })
            .catch((cause: unknown) => {
                if (controller.signal.aborted) return;
                setReferenceState({
                    key: referenceRefreshKey,
                    kind: "error",
                    message: cause instanceof Error ? cause.message : readITOperatorError(null, 500),
                });
            });
        return () => controller.abort();
    }, [referenceRefreshKey]);

    const refreshTicket = (): void => setRefreshKey((current) => current + 1);

    const runMutation = async (
        route: string,
        body: Record<string, number | string | null>,
        successMessage: string,
    ): Promise<void> => {
        if (!ticket || inFlightRef.current || conflictReviewRequired || mutationAccessDenied) return;
        inFlightRef.current = true;
        setBusy(true);
        setActionError(null);
        setActionMessage(null);

        try {
            const response = await fetch(route, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...body, expectedVersion: ticket.version }),
            });
            const payload: unknown = await response.json().catch(() => null);
            if (!response.ok) {
                const message = readITOperatorError(payload, response.status, true);
                if (response.status === 409) {
                    if (isITOperatorMutationVersionConflict(payload)) {
                        setConflictReviewRequired(true);
                        setActionError(null);
                    } else {
                        setActionError(message);
                        if (isITTicketResponseRecord(payload)) {
                            if (payload.code === "ASSIGNEE_NOT_ELIGIBLE") {
                                setAssignmentDraft(null);
                                setReferenceRefreshKey((key) => key + 1);
                            } else if (payload.code === "CATEGORY_INACTIVE") {
                                setCategoryDraft(null);
                                setReferenceRefreshKey((key) => key + 1);
                            }
                        }
                    }
                    refreshTicket();
                } else {
                    setActionError(message);
                    if (response.status === 401 || response.status === 403) {
                        setMutationAccessDenied(true);
                    } else if (response.status >= 500) {
                        setConflictReviewRequired(true);
                        refreshTicket();
                    }
                }
                return;
            }

            const result = parseITOperatorTicketMutationSnapshot(payload);
            if (result === null || result.ticket.id !== ticket.id
                || result.ticket.version < ticket.version) {
                setActionError("ระบบบันทึกผลตอบกลับไม่ครบถ้วน กำลังโหลด Ticket ล่าสุดเพื่อยืนยันผล");
                setConflictReviewRequired(true);
                refreshTicket();
                return;
            }

            requiredVersionRef.current = result.ticket.version;
            setActionMessage(`${successMessage} · รุ่น ${result.ticket.version}`);
            refreshTicket();
        } catch {
            setActionError("ไม่สามารถยืนยันผลการบันทึกได้ กำลังโหลด Ticket ล่าสุดเพื่อให้ตรวจสอบก่อนดำเนินการต่อ");
            setConflictReviewRequired(true);
            refreshTicket();
        } finally {
            inFlightRef.current = false;
            setBusy(false);
        }
    };

    const assignmentDraftKey = ticket ? `${ticket.id}:${ticket.version}` : "";
    const [assignmentDraft, setAssignmentDraft] = useState<{
        readonly key: string;
        readonly value: string;
    } | null>(null);
    const [categoryDraft, setCategoryDraft] = useState<{
        readonly key: string;
        readonly value: string;
    } | null>(null);
    const assignmentValue = assignmentDraft?.key === assignmentDraftKey
        ? assignmentDraft.value
        : ticket?.assignee ? String(ticket.assignee.userId) : "";
    const categoryValue = categoryDraft?.key === assignmentDraftKey
        ? categoryDraft.value
        : ticket?.category ? String(ticket.category.id) : "";
    const canManage = capabilities.canManageTickets && !mutationAccessDenied;
    const actionsDisabled = busy || loading || conflictReviewRequired || !ticket;

    const handleAssignment = (): void => {
        if (!ticket) return;
        const assigneeUserId = assignmentValue === "" ? null : Number(assignmentValue);
        if (assigneeUserId !== null && !Number.isSafeInteger(assigneeUserId)) {
            setActionError("ผู้รับผิดชอบที่เลือกไม่ถูกต้อง");
            return;
        }
        void runMutation(
            API_ROUTES.itOperatorTickets.assigneeById(ticket.id),
            { assigneeUserId },
            "บันทึกผู้รับผิดชอบแล้ว",
        );
    };

    const handleCategory = (): void => {
        if (!ticket) return;
        const categoryId = categoryValue === "" ? null : Number(categoryValue);
        if (categoryId !== null && !Number.isSafeInteger(categoryId)) {
            setActionError("หมวดหมู่ที่เลือกไม่ถูกต้อง");
            return;
        }
        void runMutation(
            API_ROUTES.itOperatorTickets.categoryById(ticket.id),
            { categoryId },
            "บันทึกหมวดหมู่แล้ว",
        );
    };

    const handleTransition = (targetStatus: ITTicketStatus): void => {
        if (!ticket) return;
        void runMutation(
            API_ROUTES.itOperatorTickets.statusById(ticket.id),
            { targetStatus },
            `เปลี่ยนสถานะเป็น${IT_TICKET_STATUS_LABELS[targetStatus]}แล้ว`,
        );
    };

    const fieldClassName = "mt-1 h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-content-body outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60";

    return (
        <section className="min-h-[calc(100dvh-6rem)] p-4 md:p-8">
            <div className="mx-auto max-w-6xl space-y-5">
                <Link href={APP_ROUTES.dashboardITQueue} className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-brand-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                    <ArrowLeft aria-hidden="true" className="size-4" />
                    กลับไปยังคิว IT Ticket
                </Link>

                {loading ? (
                    <div role="status" aria-label="กำลังโหลด Ticket" className="space-y-4">
                        <Skeleton className="h-8 w-2/5" />
                        <Skeleton className="h-72 w-full rounded-xl" />
                        <Skeleton className="h-48 w-full rounded-xl" />
                    </div>
                ) : null}

                {!loading && detailError ? (
                    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                        <div className="flex gap-3">
                            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                            <p>{detailError}</p>
                        </div>
                        <Button type="button" variant="outline" onClick={refreshTicket}>
                            <RefreshCw aria-hidden="true" />
                            โหลดอีกครั้ง
                        </Button>
                    </div>
                ) : null}

                {!loading && !detailError && ticket ? (
                    <>
                        <header className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                            <div className="min-w-0 space-y-1">
                                <h1 data-page-heading tabIndex={-1} className="text-2xl font-bold tracking-tight text-content-heading [overflow-wrap:anywhere] md:text-3xl">
                                    Ticket #{ticket.id}
                                </h1>
                                <p className="text-sm text-content-secondary">{IT_TICKET_TYPE_LABELS[ticket.type]}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-3">
                                <TicketStatus status={ticket.status} />
                                <span className="rounded-md border border-border-neutral px-3 py-1.5 text-xs font-medium tabular-nums text-content-secondary">
                                    รุ่น {ticket.version}
                                </span>
                            </div>
                        </header>

                        {conflictReviewRequired ? (
                            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                                <p>
                                    Ticket เปลี่ยนแปลงโดยผู้ใช้อื่นแล้ว ระบบโหลดข้อมูลล่าสุดให้ตรวจสอบ กรุณาตรวจสอบสถานะ รุ่น และผู้รับผิดชอบก่อนทำรายการต่อ
                                </p>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={busy || loading || !ticket}
                                    onClick={() => {
                                        setConflictReviewRequired(false);
                                        setActionError(null);
                                    }}
                                >
                                    ตรวจสอบข้อมูลล่าสุดแล้ว
                                </Button>
                            </div>
                        ) : null}
                        {mutationAccessDenied ? (
                            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                                สิทธิ์หรือสถานะพนักงานเปลี่ยนแปลง จึงปิดการดำเนินการไว้ กรุณาโหลดหน้าใหม่เพื่อตรวจสอบสิทธิ์ปัจจุบัน
                            </div>
                        ) : null}
                        {actionError ? (
                            <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                                {actionError}
                            </div>
                        ) : null}
                        {actionMessage ? (
                            <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                                {actionMessage}
                            </p>
                        ) : null}
                        {referenceError ? (
                            <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                                <p>{referenceError}</p>
                                <Button type="button" size="sm" variant="outline" onClick={() => setReferenceRefreshKey((key) => key + 1)}>
                                    โหลดตัวเลือกอีกครั้ง
                                </Button>
                            </div>
                        ) : null}

                        <Card>
                            <CardHeader className="gap-4 border-b border-border-neutral sm:flex-row sm:items-center sm:justify-between">
                                <div className="min-w-0 space-y-1">
                                    <p className="text-xs font-semibold text-content-muted">หัวข้อ</p>
                                    <CardTitle className="text-xl leading-7 text-content-heading [overflow-wrap:anywhere]">
                                        {ticket.title}
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <h2 className="text-sm font-semibold text-content-heading">รายละเอียด</h2>
                                    <p className="mt-2 max-w-[75ch] whitespace-pre-wrap break-words text-sm leading-7 text-content-body">
                                        {ticket.description}
                                    </p>
                                </div>
                                <dl className="grid gap-x-6 gap-y-4 border-t border-border-neutral pt-5 sm:grid-cols-2 lg:grid-cols-4">
                                    <div>
                                        <dt className="text-xs font-semibold text-content-muted">ผู้แจ้ง</dt>
                                        <dd className="mt-1 break-words text-sm text-content-body">{ticket.requester.displayName}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-semibold text-content-muted">แผนกขณะส่งคำขอ</dt>
                                        <dd className="mt-1 break-words text-sm text-content-body">{ticket.requester.departmentNameSnapshot ?? "ไม่ระบุแผนก"}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-semibold text-content-muted">ผู้รับผิดชอบปัจจุบัน</dt>
                                        <dd className="mt-1 break-words text-sm text-content-body">
                                            {ticket.assignee?.displayName ?? "ยังไม่มีผู้รับผิดชอบ"}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-semibold text-content-muted">หมวดหมู่</dt>
                                        <dd className="mt-1 break-words text-sm text-content-body">
                                            {ticket.category?.name ?? "ยังไม่จัดหมวดหมู่"}
                                            {ticket.category && !ticket.category.isActive ? " (ปิดใช้งาน)" : ""}
                                        </dd>
                                    </div>
                                </dl>
                                <dl className="grid gap-x-6 gap-y-4 border-t border-border-neutral pt-5 sm:grid-cols-2 lg:grid-cols-3">
                                    <div>
                                        <dt className="text-xs font-semibold text-content-muted">สร้างเมื่อ</dt>
                                        <dd className="mt-1 text-sm text-content-body">{formatITTicketDate(ticket.createdAt)}</dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs font-semibold text-content-muted">อัปเดตล่าสุด</dt>
                                        <dd className="mt-1 text-sm text-content-body">{formatITTicketDate(ticket.updatedAt)}</dd>
                                    </div>
                                    {ticket.resolvedAt ? (
                                        <div>
                                            <dt className="text-xs font-semibold text-content-muted">แก้ไขเมื่อ</dt>
                                            <dd className="mt-1 text-sm text-content-body">{formatITTicketDate(ticket.resolvedAt)}</dd>
                                        </div>
                                    ) : null}
                                </dl>
                            </CardContent>
                        </Card>

                        <ITTicketConversation
                            ticketId={ticket.id}
                            status={ticket.status}
                            canComment={capabilities.canCommentAllTickets}
                            operator
                        />

                        {canManage ? (
                            <section aria-labelledby="it-ticket-operator-actions-heading" className="space-y-4 rounded-xl border border-border-neutral bg-surface-subtle p-4 md:p-5">
                                <div className="space-y-1">
                                    <h2 id="it-ticket-operator-actions-heading" className="text-lg font-semibold text-content-heading">ดำเนินการกับ Ticket</h2>
                                    <p className="text-sm text-content-secondary">ทุกการบันทึกใช้รุ่น {ticket.version} ที่กำลังแสดงอยู่</p>
                                </div>
                                <div className="grid gap-5 lg:grid-cols-2">
                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold text-content-heading">ผู้รับผิดชอบ</h3>
                                        <label className="block text-sm font-medium text-content-secondary">
                                            เลือกผู้รับผิดชอบ
                                            <select
                                                aria-label="ผู้รับผิดชอบ Ticket"
                                                className={fieldClassName}
                                                disabled={actionsDisabled}
                                                value={assignmentValue}
                                                onChange={(event) => setAssignmentDraft({
                                                    key: assignmentDraftKey,
                                                    value: event.target.value,
                                                })}
                                            >
                                                <option value="">ยังไม่มีผู้รับผิดชอบ</option>
                                                {ticket.assignee && !reference?.assignableOperators.some((operator) =>
                                                    operator.userId === ticket.assignee?.userId,
                                                ) ? (
                                                    <option value={ticket.assignee.userId}>
                                                        {ticket.assignee.displayName} · ผู้รับผิดชอบปัจจุบัน
                                                    </option>
                                                ) : null}
                                                {reference?.assignableOperators.map((operator) => (
                                                    <option key={operator.userId} value={operator.userId}>
                                                        {operator.displayName}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <Button type="button" variant="outline" disabled={actionsDisabled} onClick={handleAssignment}>
                                            บันทึกผู้รับผิดชอบ
                                        </Button>
                                    </div>

                                    <div className="space-y-3">
                                        <h3 className="text-sm font-semibold text-content-heading">หมวดหมู่</h3>
                                        <label className="block text-sm font-medium text-content-secondary">
                                            จัดหมวดหมู่ Ticket
                                            <select
                                                aria-label="หมวดหมู่ Ticket"
                                                className={fieldClassName}
                                                disabled={actionsDisabled}
                                                value={categoryValue}
                                                onChange={(event) => setCategoryDraft({
                                                    key: assignmentDraftKey,
                                                    value: event.target.value,
                                                })}
                                            >
                                                <option value="">ไม่จัดหมวดหมู่</option>
                                                {ticket.category && !ticket.category.isActive
                                                    && !reference?.categories.some((category) => category.id === ticket.category?.id)
                                                    ? (
                                                        <option value={ticket.category.id}>
                                                            {ticket.category.name} · ปิดใช้งานแล้ว
                                                        </option>
                                                    )
                                                    : null}
                                                {reference?.categories.map((category) => (
                                                    <option key={category.id} value={category.id}>{category.name}</option>
                                                ))}
                                            </select>
                                        </label>
                                        {reference?.categories.length === 0 ? (
                                            <p className="text-xs leading-5 text-content-muted">
                                                ยังไม่มีหมวดหมู่ที่เปิดใช้งาน คุณยังบันทึก Ticket แบบไม่จัดหมวดหมู่ได้
                                            </p>
                                        ) : null}
                                        <Button type="button" variant="outline" disabled={actionsDisabled} onClick={handleCategory}>
                                            บันทึกหมวดหมู่
                                        </Button>
                                    </div>
                                </div>

                                <div className="space-y-3 border-t border-border-neutral pt-4">
                                    <div>
                                        <h3 className="text-sm font-semibold text-content-heading">สถานะ</h3>
                                        <p className="mt-1 text-sm text-content-secondary">
                                            {ticket.status === "WAITING_REQUESTER"
                                                ? "Ticket นี้กำลังรอข้อมูลจากผู้แจ้ง การกลับมาดำเนินการต้องทำโดยผู้ปฏิบัติงาน"
                                                : "เลือกการดำเนินการที่อนุมัติสำหรับสถานะปัจจุบัน"}
                                        </p>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {getAllowedITTicketTransitions(ticket.status).map((targetStatus) => (
                                            <Button
                                                key={targetStatus}
                                                type="button"
                                                disabled={actionsDisabled}
                                                onClick={() => handleTransition(targetStatus)}
                                            >
                                                {STATUS_ACTION_LABELS[targetStatus] ?? IT_TICKET_STATUS_LABELS[targetStatus]}
                                            </Button>
                                        ))}
                                        {getAllowedITTicketTransitions(ticket.status).length === 0 ? (
                                            <p className="text-sm text-content-muted">ไม่มีการเปลี่ยนสถานะที่อนุมัติสำหรับสถานะนี้</p>
                                        ) : null}
                                    </div>
                                </div>
                            </section>
                        ) : (
                            <p className="rounded-lg border border-border-neutral bg-surface-subtle px-4 py-3 text-sm text-content-secondary">
                                บัญชีนี้มีสิทธิ์อ่านคิว แต่ไม่มีสิทธิ์ดำเนินการกับ Ticket
                            </p>
                        )}
                    </>
                ) : null}
            </div>
        </section>
    );
}
