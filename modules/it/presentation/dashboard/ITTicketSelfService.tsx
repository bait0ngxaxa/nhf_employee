"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactElement } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CircleAlert, Plus, RefreshCw, TicketCheck } from "lucide-react";

import { API_ROUTES, APP_ROUTES } from "@/lib/ssot/routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

import {
    IT_TICKET_DESCRIPTION_MAX_LENGTH,
    IT_TICKET_LIST_DEFAULT_LIMIT,
    IT_TICKET_STATUS_LABELS,
    IT_TICKET_TITLE_MAX_LENGTH,
    IT_TICKET_TYPE_LABELS,
    IT_TICKET_TYPE_OPTIONS,
    type ITRequesterTicketList,
    type ITPresentationCapabilities,
} from "../../contracts";
import type { ITTicketStatus, ITTicketType } from "@prisma/client";
import {
    formatITTicketDate,
    IT_TICKET_STATUS_STYLES,
    isITTicketType,
    isITTicketResponseRecord,
    parseITRequesterTicket,
    parseITRequesterTicketList,
    readITRequesterError,
} from "./ticket-presentation";

type ITRequesterListState =
    | { readonly key: string; readonly kind: "loaded"; readonly list: ITRequesterTicketList }
    | { readonly key: string; readonly kind: "error"; readonly message: string };

function TicketStatus({ status }: { status: ITTicketStatus }): ReactElement {
    return (
        <span className={`inline-flex min-h-7 items-center rounded-full px-3 py-1 text-xs font-semibold ${IT_TICKET_STATUS_STYLES[status]}`}>
            {IT_TICKET_STATUS_LABELS[status]}
        </span>
    );
}

function TicketListSkeleton(): ReactElement {
    return (
        <div role="status" aria-label="กำลังโหลด Ticket" className="space-y-4 p-5">
            {[0, 1, 2].map((row) => (
                <div key={row} className="space-y-3 border-b border-border-neutral pb-4 last:border-b-0">
                    <Skeleton className="h-5 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                </div>
            ))}
        </div>
    );
}

export function ITTicketSelfService({
    capabilities,
}: {
    capabilities: ITPresentationCapabilities;
}): ReactElement {
    const [listState, setListState] = useState<ITRequesterListState | null>(null);
    const [page, setPage] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [ticketType, setTicketType] = useState<ITTicketType>("INCIDENT");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [createError, setCreateError] = useState<string | null>(null);
    const [createdMessage, setCreatedMessage] = useState<string | null>(null);
    const [creating, setCreating] = useState(false);
    const attemptRef = useRef<{ readonly signature: string; readonly key: string } | null>(null);
    const createInFlightRef = useRef(false);

    const requestKey = `${capabilities.canReadOwnTickets}:${page}:${refreshKey}`;
    const currentListState = listState?.key === requestKey ? listState : null;
    const list = currentListState?.kind === "loaded" ? currentListState.list : null;
    const listError = currentListState?.kind === "error" ? currentListState.message : null;
    const loading = capabilities.canReadOwnTickets && currentListState === null;

    useEffect(() => {
        if (!capabilities.canReadOwnTickets) return;
        const controller = new AbortController();
        const query = new URLSearchParams({
            page: String(page),
            limit: String(IT_TICKET_LIST_DEFAULT_LIMIT),
        });
        void fetch(`${API_ROUTES.itTickets.list}?${query}`, { signal: controller.signal })
            .then(async (response) => {
                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok) throw new Error(readITRequesterError(payload, response.status));
                const parsed = parseITRequesterTicketList(payload);
                if (parsed === null) throw new Error("ข้อมูลรายการ Ticket ไม่ถูกต้อง กรุณาลองอีกครั้ง");
                if (controller.signal.aborted) return;
                setListState({ key: requestKey, kind: "loaded", list: parsed });
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setListState({
                    key: requestKey,
                    kind: "error",
                    message: error instanceof Error
                        ? error.message
                        : "ไม่สามารถโหลดรายการ Ticket ได้ กรุณาลองอีกครั้ง",
                });
            });

        return () => controller.abort();
    }, [capabilities.canReadOwnTickets, page, refreshKey, requestKey]);

    /*
     * Loading is derived from the current request key. A new page or retry is
     * immediately represented as loading without synchronously setting state
     * from an effect.
     */

    const handleCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        if (createInFlightRef.current) return;

        const payload = {
            type: ticketType,
            title: title.trim(),
            description: description.trim(),
        };
        if (!payload.title || !payload.description) {
            setCreateError("กรุณากรอกหัวข้อและรายละเอียดให้ครบถ้วน");
            return;
        }

        const signature = JSON.stringify(payload);
        let attempt = attemptRef.current;
        if (attempt === null || attempt.signature !== signature) {
            attempt = { signature, key: globalThis.crypto.randomUUID() };
            attemptRef.current = attempt;
        }

        setCreating(true);
        createInFlightRef.current = true;
        setCreateError(null);
        setCreatedMessage(null);
        try {
            const response = await fetch(API_ROUTES.itTickets.list, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Idempotency-Key": attempt.key,
                },
                body: JSON.stringify(payload),
            });
            const body: unknown = await response.json().catch(() => null);
            if (!response.ok) throw new Error(readITRequesterError(body, response.status));
            const createdTicket = isITTicketResponseRecord(body) && body.success === true
                ? parseITRequesterTicket(body.ticket)
                : null;
            if (createdTicket === null) {
                throw new Error("ระบบตอบกลับข้อมูลไม่ครบถ้วน กรุณาลองส่งรายการเดิมอีกครั้ง");
            }

            attemptRef.current = null;
            setTitle("");
            setDescription("");
            setTicketType("INCIDENT");
            setDialogOpen(false);
            setCreatedMessage(`ส่ง Ticket #${createdTicket.id} เรียบร้อยแล้ว`);
            setPage(1);
            setRefreshKey((current) => current + 1);
        } catch (error) {
            setCreateError(error instanceof Error
                ? error.message
                : "ไม่สามารถส่ง Ticket ได้ กรุณาลองอีกครั้ง");
        } finally {
            createInFlightRef.current = false;
            setCreating(false);
        }
    };

    return (
        <section className="min-h-[calc(100dvh-6rem)]">
            <div className="mx-auto max-w-6xl space-y-7">
                <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
                    <div className="min-w-0 space-y-1">
                        <h1 data-page-heading tabIndex={-1} className="text-2xl font-bold tracking-tight text-content-heading [overflow-wrap:anywhere] md:text-3xl">
                            IT Ticket ของฉัน
                        </h1>
                        <p className="max-w-[70ch] text-sm font-medium leading-6 text-content-secondary">
                            แจ้งปัญหาหรือขอความช่วยเหลือ และติดตามสถานะคำขอของคุณได้ที่นี่
                        </p>
                    </div>
                    {capabilities.canCreateOwnTickets ? (
                        <Button className="w-full sm:w-auto" onClick={() => {
                            setCreateError(null);
                            setCreatedMessage(null);
                            setDialogOpen(true);
                        }}>
                            <Plus aria-hidden="true" />
                            สร้าง Ticket
                        </Button>
                    ) : null}
                </header>

                {createdMessage ? (
                    <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                        {createdMessage}
                    </p>
                ) : null}

                {capabilities.canReadOwnTickets ? (
                    <section aria-labelledby="it-ticket-list-heading" className="space-y-3">
                        <div className="flex items-end justify-between gap-3">
                            <div>
                                <h2 id="it-ticket-list-heading" className="text-lg font-semibold text-content-heading">
                                    รายการ Ticket
                                </h2>
                                {list ? (
                                    <p className="mt-1 text-sm text-content-secondary">
                                        ทั้งหมด {list.pagination.total} รายการ
                                    </p>
                                ) : null}
                            </div>
                            {listError ? (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setRefreshKey((current) => current + 1)}
                                >
                                    <RefreshCw aria-hidden="true" />
                                    ลองอีกครั้ง
                                </Button>
                            ) : null}
                        </div>

                        {loading ? <Card><TicketListSkeleton /></Card> : null}
                        {!loading && listError ? (
                            <div role="alert" className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                                <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                                <p>{listError}</p>
                            </div>
                        ) : null}
                        {!loading && !listError && list?.tickets.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-border-neutral bg-surface-subtle px-5 py-10 text-center">
                                <TicketCheck aria-hidden="true" className="mx-auto size-8 text-content-muted" />
                                <h3 className="mt-3 font-semibold text-content-heading">ยังไม่มี Ticket</h3>
                                <p className="mx-auto mt-1 max-w-[52ch] text-sm leading-6 text-content-secondary">
                                    เมื่อส่งคำขอแล้ว คุณจะกลับมาติดตามสถานะได้จากรายการนี้
                                </p>
                                {capabilities.canCreateOwnTickets ? (
                                    <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                                        <Plus aria-hidden="true" />
                                        สร้าง Ticket แรก
                                    </Button>
                                ) : null}
                            </div>
                        ) : null}
                        {!loading && !listError && list && list.tickets.length > 0 ? (
                            <Card className="gap-0 overflow-hidden py-0">
                                <CardContent className="px-0 py-0">
                                    <ul aria-label="Ticket ของฉัน" className="divide-y divide-border-neutral">
                                        {list.tickets.map((ticket) => (
                                            <li key={ticket.id}>
                                                <Link
                                                    href={`${APP_ROUTES.dashboardIT}/${ticket.id}`}
                                                    className="flex min-w-0 flex-col gap-3 p-4 outline-none transition-colors hover:bg-surface-subtle focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:flex-row sm:items-center sm:justify-between sm:px-5"
                                                >
                                                    <span className="min-w-0 space-y-1">
                                                        <span className="block break-words font-semibold text-content-heading [overflow-wrap:anywhere]">
                                                            #{ticket.id} · {ticket.title}
                                                        </span>
                                                        <span className="block text-sm text-content-secondary">
                                                            {IT_TICKET_TYPE_LABELS[ticket.type]} · สร้างเมื่อ {formatITTicketDate(ticket.createdAt)}
                                                        </span>
                                                    </span>
                                                    <span className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 gap-y-1 sm:shrink-0 sm:justify-end">
                                                        <TicketStatus status={ticket.status} />
                                                        <span className="text-xs text-content-muted">อัปเดต {formatITTicketDate(ticket.updatedAt)}</span>
                                                    </span>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </CardContent>
                            </Card>
                        ) : null}

                        {!loading && !listError && list && list.pagination.totalPages > 1 ? (
                            <nav aria-label="แบ่งหน้ารายการ Ticket" className="flex items-center justify-between gap-3 pt-2">
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={list.pagination.page <= 1}
                                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                                >
                                    <ArrowLeft aria-hidden="true" />
                                    ก่อนหน้า
                                </Button>
                                <span aria-live="polite" className="text-sm text-content-secondary">
                                    หน้า {list.pagination.page} จาก {list.pagination.totalPages}
                                </span>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    disabled={list.pagination.page >= list.pagination.totalPages}
                                    onClick={() => setPage((current) => current + 1)}
                                >
                                    ถัดไป
                                    <ArrowRight aria-hidden="true" />
                                </Button>
                            </nav>
                        ) : null}
                    </section>
                ) : (
                    <p className="rounded-lg border border-border-neutral bg-surface-subtle p-4 text-sm text-content-secondary">
                        คุณสามารถสร้าง Ticket ได้ แต่บัญชีนี้ไม่มีสิทธิ์อ่านรายการ Ticket
                    </p>
                )}
            </div>

            <Dialog open={dialogOpen} onOpenChange={(open) => {
                if (!creating) setDialogOpen(open);
            }}>
                <DialogContent showCloseButton={!creating}>
                    <DialogHeader>
                        <DialogTitle>สร้าง IT Ticket</DialogTitle>
                        <DialogDescription>
                            ระบุประเภท หัวข้อ และรายละเอียด ระบบจะบันทึก Ticket ในนามบัญชีของคุณ
                        </DialogDescription>
                    </DialogHeader>
                    <form className="min-h-0 flex flex-1 flex-col" onSubmit={handleCreate}>
                        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
                            <div className="space-y-2">
                                <label htmlFor="it-ticket-type" className="text-sm font-medium text-content-heading">ประเภท Ticket</label>
                                <select
                                    id="it-ticket-type"
                                    value={ticketType}
                                    onChange={(event) => {
                                        if (isITTicketType(event.target.value)) {
                                            setTicketType(event.target.value);
                                        }
                                    }}
                                    className="h-11 w-full rounded-md border border-input bg-background px-3 text-sm text-content-body outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                                >
                                    {IT_TICKET_TYPE_OPTIONS.map((option) => (
                                        <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="it-ticket-title" className="text-sm font-medium text-content-heading">หัวข้อ</label>
                                <Input
                                    id="it-ticket-title"
                                    autoFocus
                                    required
                                    maxLength={IT_TICKET_TITLE_MAX_LENGTH}
                                    value={title}
                                    onChange={(event) => setTitle(event.target.value)}
                                    placeholder="สรุปปัญหาหรือสิ่งที่ต้องการ"
                                    aria-describedby="it-ticket-title-count"
                                />
                                <p id="it-ticket-title-count" className="text-right text-xs text-content-muted">
                                    {title.length}/{IT_TICKET_TITLE_MAX_LENGTH}
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="it-ticket-description" className="text-sm font-medium text-content-heading">รายละเอียด</label>
                                <Textarea
                                    id="it-ticket-description"
                                    required
                                    maxLength={IT_TICKET_DESCRIPTION_MAX_LENGTH}
                                    rows={6}
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
                                    placeholder="อธิบายสิ่งที่เกิดขึ้นหรือความช่วยเหลือที่ต้องการ"
                                    aria-describedby="it-ticket-description-count"
                                    className="max-h-60 min-h-32 resize-y"
                                />
                                <p id="it-ticket-description-count" className="text-right text-xs text-content-muted">
                                    {description.length}/{IT_TICKET_DESCRIPTION_MAX_LENGTH}
                                </p>
                            </div>
                            {createError ? <p role="alert" className="text-sm font-medium text-rose-700 dark:text-rose-300">{createError}</p> : null}
                        </div>
                        <DialogFooter className="mt-4 shrink-0 border-t border-border-neutral pt-4">
                            <Button type="button" variant="outline" disabled={creating} onClick={() => setDialogOpen(false)}>
                                ยกเลิก
                            </Button>
                            <Button type="submit" disabled={creating} aria-busy={creating}>
                                {creating ? "กำลังส่ง…" : "ส่ง Ticket"}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </section>
    );
}
