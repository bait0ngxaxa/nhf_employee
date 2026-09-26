"use client";

import {
    useEffect,
    useRef,
    useState,
    type FormEvent,
    type ReactElement,
} from "react";
import Link from "next/link";
import {
    ArrowLeft,
    ArrowRight,
    CircleAlert,
    MessageSquareText,
    Plus,
    RefreshCw,
    TicketCheck,
} from "lucide-react";
import type { ITTicketStatus, ITTicketType } from "@prisma/client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createIdempotencyKey } from "@/lib/client/idempotency-key";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { LiffApiError } from "@/modules/line/client";
import {
    IT_TICKET_DESCRIPTION_MAX_LENGTH,
    IT_TICKET_STATUS_LABELS,
    IT_TICKET_TITLE_MAX_LENGTH,
    IT_TICKET_TYPE_LABELS,
    IT_TICKET_TYPE_OPTIONS,
    type ITRequesterTicket,
    type ITRequesterTicketList,
} from "../../contracts";
import {
    fetchLiffITTicket,
    fetchLiffITTickets,
    createLiffITTicket,
} from "./api";
import { LiffITConversation } from "./LiffITConversation";
import {
    formatITTicketDate,
    IT_TICKET_STATUS_STYLES,
} from "../dashboard/ticket-presentation";

type ListState =
    | { readonly key: string; readonly kind: "loaded"; readonly list: ITRequesterTicketList }
    | { readonly key: string; readonly kind: "error"; readonly message: string };

function getErrorMessage(error: unknown, fallback: string): string {
    return error instanceof LiffApiError ? error.message : fallback;
}

function TicketStatus({ status }: { readonly status: ITTicketStatus }): ReactElement {
    return (
        <span className={`inline-flex min-h-7 items-center rounded-full px-3 py-1 text-xs font-semibold ${IT_TICKET_STATUS_STYLES[status]}`}>
            {IT_TICKET_STATUS_LABELS[status]}
        </span>
    );
}

function TicketListLoading(): ReactElement {
    return (
        <div role="status" aria-label="กำลังโหลดรายการ Ticket" className="space-y-3">
            {[0, 1, 2].map((row) => (
                <div key={row} className="animate-pulse motion-reduce:animate-none space-y-3 rounded-xl border border-border-neutral bg-surface-raised p-4">
                    <div className="h-5 w-2/3 rounded bg-surface-subtle" />
                    <div className="h-4 w-1/3 rounded bg-surface-subtle" />
                    <div className="h-4 w-1/2 rounded bg-surface-subtle" />
                </div>
            ))}
        </div>
    );
}

function LiffITTicketList(): ReactElement {
    const [listState, setListState] = useState<ListState | null>(null);
    const [page, setPage] = useState(1);
    const [retry, setRetry] = useState(0);
    const [creating, setCreating] = useState(false);
    const [ticketType, setTicketType] = useState<ITTicketType>("INCIDENT");
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");
    const [createError, setCreateError] = useState<string | null>(null);
    const [createdTicket, setCreatedTicket] = useState<ITRequesterTicket | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const createAttemptRef = useRef<{ readonly signature: string; readonly key: string } | null>(null);
    const createInFlightRef = useRef(false);

    const requestKey = `${page}:${retry}`;
    const currentList = listState?.key === requestKey ? listState : null;
    const loadedList = currentList?.kind === "loaded" ? currentList.list : null;
    const listError = currentList?.kind === "error" ? currentList.message : null;

    useEffect(() => {
        const controller = new AbortController();
        void fetchLiffITTickets(page, controller.signal)
            .then((list) => {
                if (!controller.signal.aborted) {
                    setListState({ key: requestKey, kind: "loaded", list });
                }
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setListState({
                    key: requestKey,
                    kind: "error",
                    message: getErrorMessage(error, "ไม่สามารถโหลดรายการ Ticket ได้ กรุณาลองอีกครั้ง"),
                });
            });
        return () => controller.abort();
    }, [page, requestKey]);

    const currentPayload = (): { readonly type: ITTicketType; readonly title: string; readonly description: string } => ({
        type: ticketType,
        title: title.trim(),
        description: description.trim(),
    });

    const clearChangedAttempt = (
        next: { readonly type: ITTicketType; readonly title: string; readonly description: string },
    ): void => {
        if (createAttemptRef.current?.signature !== JSON.stringify(next)) {
            createAttemptRef.current = null;
        }
    };

    const handleCreate = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
        event.preventDefault();
        if (createInFlightRef.current) return;

        const payload = currentPayload();
        if (!payload.title || !payload.description) {
            setCreateError("กรุณากรอกหัวข้อและรายละเอียดให้ครบถ้วน");
            return;
        }

        const signature = JSON.stringify(payload);
        let attempt = createAttemptRef.current;
        if (attempt === null || attempt.signature !== signature) {
            attempt = { signature, key: createIdempotencyKey() };
            createAttemptRef.current = attempt;
        }

        createInFlightRef.current = true;
        setSubmitting(true);
        setCreateError(null);
        try {
            const created = await createLiffITTicket(payload, attempt.key);
            createAttemptRef.current = null;
            setTitle("");
            setDescription("");
            setTicketType("INCIDENT");
            setCreating(false);
            setCreatedTicket(created);

            if (page !== 1) {
                setPage(1);
            } else if (loadedList !== null) {
                setListState((current) => {
                    if (current?.key !== requestKey || current.kind !== "loaded") return current;
                    const alreadyPresent = current.list.tickets.some((ticket) => ticket.id === created.id);
                    const tickets = [
                        created,
                        ...current.list.tickets.filter((ticket) => ticket.id !== created.id),
                    ].slice(0, current.list.pagination.limit);
                    const total = current.list.pagination.total + (alreadyPresent ? 0 : 1);
                    return {
                        key: requestKey,
                        kind: "loaded",
                        list: {
                            tickets,
                            pagination: {
                                ...current.list.pagination,
                                total,
                                totalPages: Math.ceil(total / current.list.pagination.limit),
                            },
                        },
                    };
                });
            } else {
                setRetry((value) => value + 1);
            }
        } catch (error) {
            setCreateError(getErrorMessage(error, "ไม่สามารถสร้าง Ticket ได้ กรุณาลองอีกครั้ง"));
        } finally {
            createInFlightRef.current = false;
            setSubmitting(false);
        }
    };

    const listHeading = (
        <header className="space-y-2">
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-content-heading">IT Ticket ของฉัน</h1>
            <p className="text-sm leading-6 text-content-secondary">
                แจ้งปัญหาหรือขอความช่วยเหลือ แล้วติดตามความคืบหน้าได้ที่นี่
            </p>
        </header>
    );

    if (creating) {
        return (
            <main className="space-y-5 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5">
                <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-content-secondary underline-offset-4 hover:text-content-heading hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                    <ArrowLeft aria-hidden="true" className="size-4" />
                    กลับรายการ Ticket
                </button>
                <section className="space-y-5">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold leading-tight tracking-tight text-content-heading">สร้าง Ticket</h1>
                        <p className="text-sm leading-6 text-content-secondary">
                            แจ้งรายละเอียดที่ช่วยให้เจ้าหน้าที่ IT เข้าใจเรื่องที่ต้องการให้ช่วยได้ชัดเจน
                        </p>
                    </div>
                    <form className="space-y-5" onSubmit={(event) => void handleCreate(event)}>
                        <div className="space-y-2">
                            <label htmlFor="liff-it-ticket-type" className="block text-sm font-semibold text-content-heading">ประเภทคำขอ</label>
                            <select
                                id="liff-it-ticket-type"
                                value={ticketType}
                                onChange={(event) => {
                                    const nextType = event.currentTarget.value as ITTicketType;
                                    clearChangedAttempt({ ...currentPayload(), type: nextType });
                                    setTicketType(nextType);
                                    setCreateError(null);
                                }}
                                disabled={submitting}
                                className="min-h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-base text-content-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60"
                            >
                                {IT_TICKET_TYPE_OPTIONS.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="liff-it-ticket-title" className="block text-sm font-semibold text-content-heading">หัวข้อ</label>
                            <Input
                                id="liff-it-ticket-title"
                                value={title}
                                onChange={(event) => {
                                    const nextTitle = event.currentTarget.value;
                                    clearChangedAttempt({ ...currentPayload(), title: nextTitle.trim() });
                                    setTitle(nextTitle);
                                    setCreateError(null);
                                }}
                                maxLength={IT_TICKET_TITLE_MAX_LENGTH}
                                required
                                disabled={submitting}
                                autoComplete="off"
                                aria-describedby="liff-it-ticket-title-count"
                                placeholder="เช่น เข้าใช้งานระบบไม่ได้"
                                className="min-h-12 text-base"
                            />
                            <p id="liff-it-ticket-title-count" className="text-right text-xs tabular-nums text-content-muted">{title.length}/{IT_TICKET_TITLE_MAX_LENGTH}</p>
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="liff-it-ticket-description" className="block text-sm font-semibold text-content-heading">รายละเอียด</label>
                            <Textarea
                                id="liff-it-ticket-description"
                                value={description}
                                onChange={(event) => {
                                    const nextDescription = event.currentTarget.value;
                                    clearChangedAttempt({ ...currentPayload(), description: nextDescription.trim() });
                                    setDescription(nextDescription);
                                    setCreateError(null);
                                }}
                                maxLength={IT_TICKET_DESCRIPTION_MAX_LENGTH}
                                rows={6}
                                required
                                disabled={submitting}
                                aria-describedby="liff-it-ticket-description-count"
                                placeholder="อธิบายสิ่งที่พบหรือบริการที่ต้องการ"
                                className="min-h-36 resize-y text-base leading-7"
                            />
                            <p id="liff-it-ticket-description-count" className="text-right text-xs tabular-nums text-content-muted">{description.length}/{IT_TICKET_DESCRIPTION_MAX_LENGTH}</p>
                        </div>
                        {createError ? <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">{createError}</p> : null}
                        <div className="flex flex-col gap-3 pt-1">
                            <Button type="submit" disabled={submitting} className="min-h-12 w-full text-base">
                                {submitting ? <RefreshCw aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Plus aria-hidden="true" className="size-4" />}
                                {submitting ? "กำลังส่ง Ticket…" : "ส่ง Ticket"}
                            </Button>
                            <p aria-live="polite" className="text-center text-xs leading-5 text-content-muted">
                                การส่ง Ticket จะไม่แนบรูปภาพ รูปภาพหลักฐานส่งเพิ่มได้ในหน้าการสนทนา
                            </p>
                        </div>
                    </form>
                </section>
            </main>
        );
    }

    return (
        <main className="space-y-5 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5">
            {listHeading}
            <Button type="button" className="min-h-12 w-full text-base" onClick={() => {
                setCreatedTicket(null);
                setCreateError(null);
                setCreating(true);
            }}>
                <Plus aria-hidden="true" className="size-5" />
                สร้าง Ticket
            </Button>

            {createdTicket ? (
                <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
                    <TicketCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                    <div className="min-w-0">
                        <p className="font-semibold">ส่ง Ticket #{createdTicket.id} เรียบร้อยแล้ว</p>
                        <Link href={APP_ROUTES.line.itTicket(createdTicket.id)} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            เปิดรายละเอียดและการสนทนา
                        </Link>
                    </div>
                </div>
            ) : null}

            <section aria-labelledby="liff-it-ticket-list-heading" className="space-y-3">
                <div className="flex items-end justify-between gap-3">
                    <div className="space-y-1">
                        <h2 id="liff-it-ticket-list-heading" className="text-lg font-semibold text-content-heading">รายการ Ticket</h2>
                        {loadedList ? <p className="text-sm text-content-secondary">ทั้งหมด {loadedList.pagination.total} รายการ</p> : null}
                    </div>
                    {listError ? (
                        <Button type="button" size="sm" variant="outline" onClick={() => setRetry((value) => value + 1)}>
                            <RefreshCw aria-hidden="true" className="size-4" />
                            ลองอีกครั้ง
                        </Button>
                    ) : null}
                </div>

                {currentList === null ? <TicketListLoading /> : null}
                {listError ? (
                    <div role="alert" className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                        <div className="flex items-start gap-2">
                            <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />
                            <p>{listError}</p>
                        </div>
                        <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setRetry((value) => value + 1)}>
                            <RefreshCw aria-hidden="true" className="size-4" />
                            โหลดรายการอีกครั้ง
                        </Button>
                    </div>
                ) : null}
                {loadedList && loadedList.tickets.length === 0 ? (
                    <div className="space-y-3 rounded-xl border border-dashed border-border-neutral bg-surface-raised px-5 py-8 text-center">
                        <TicketCheck aria-hidden="true" className="mx-auto size-8 text-content-muted" />
                        <h3 className="font-semibold text-content-heading">ยังไม่มี Ticket</h3>
                        <p className="text-sm leading-6 text-content-secondary">เมื่อส่งคำขอแล้ว รายการและสถานะจะแสดงที่นี่</p>
                    </div>
                ) : null}
                {loadedList && loadedList.tickets.length > 0 ? (
                    <ul className="space-y-3">
                        {loadedList.tickets.map((ticket) => (
                            <li key={ticket.id}>
                                <Link
                                    href={APP_ROUTES.line.itTicket(ticket.id)}
                                    aria-label={`เปิด Ticket #${ticket.id}: ${ticket.title}`}
                                    className="block rounded-xl border border-border-neutral bg-surface-raised p-4 transition-colors hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                >
                                    <div className="space-y-3">
                                        <div className="flex flex-wrap items-start justify-between gap-2">
                                            <div className="min-w-0 space-y-1">
                                                <p className="text-xs font-semibold tabular-nums text-content-muted">Ticket #{ticket.id}</p>
                                                <h3 className="break-words text-base font-semibold leading-6 text-content-heading">{ticket.title}</h3>
                                            </div>
                                            <TicketStatus status={ticket.status} />
                                        </div>
                                        <p className="text-sm text-content-secondary">{IT_TICKET_TYPE_LABELS[ticket.type]}</p>
                                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border-neutral pt-3 text-xs leading-5 text-content-muted">
                                            <span>สร้างเมื่อ <time dateTime={ticket.createdAt}>{formatITTicketDate(ticket.createdAt)}</time></span>
                                            <span>ปรับปรุงล่าสุด <time dateTime={ticket.updatedAt}>{formatITTicketDate(ticket.updatedAt)}</time></span>
                                        </div>
                                        <span className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-foreground">
                                            ดูรายละเอียด <ArrowRight aria-hidden="true" className="size-4" />
                                        </span>
                                    </div>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : null}

                {loadedList && loadedList.pagination.totalPages > 1 ? (
                    <nav aria-label="แบ่งหน้ารายการ Ticket" className="flex items-center justify-between gap-3 pt-2">
                        <Button type="button" variant="outline" className="min-h-11 flex-1" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                            <ArrowLeft aria-hidden="true" className="size-4" />
                            ก่อนหน้า
                        </Button>
                        <span aria-live="polite" className="shrink-0 text-sm tabular-nums text-content-secondary">หน้า {loadedList.pagination.page} จาก {loadedList.pagination.totalPages}</span>
                        <Button type="button" variant="outline" className="min-h-11 flex-1" disabled={page >= loadedList.pagination.totalPages} onClick={() => setPage((value) => Math.min(loadedList.pagination.totalPages, value + 1))}>
                            ถัดไป
                            <ArrowRight aria-hidden="true" className="size-4" />
                        </Button>
                    </nav>
                ) : null}
            </section>
        </main>
    );
}

function LiffITTicketDetail({ ticketId }: { readonly ticketId: string }): ReactElement {
    const numericId = /^\d+$/.test(ticketId) ? Number(ticketId) : Number.NaN;
    const validId = Number.isSafeInteger(numericId) && numericId > 0;
    const [refreshVersion, setRefreshVersion] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const [ticketState, setTicketState] = useState<
        | { readonly kind: "loaded"; readonly ticket: ITRequesterTicket }
        | { readonly kind: "error"; readonly message: string }
        | null
    >(null);

    useEffect(() => {
        if (!validId) return;
        const controller = new AbortController();
        void fetchLiffITTicket(numericId, controller.signal)
            .then((ticket) => {
                if (!controller.signal.aborted) {
                    setTicketState({ kind: "loaded", ticket });
                    setRefreshing(false);
                }
            })
            .catch((error: unknown) => {
                if (controller.signal.aborted) return;
                setRefreshing(false);
                setTicketState({
                    kind: "error",
                    message: getErrorMessage(error, "ไม่สามารถโหลด Ticket ได้ กรุณาลองอีกครั้ง"),
                });
            });
        return () => controller.abort();
    }, [numericId, refreshVersion, validId]);

    const ticket = ticketState?.kind === "loaded" ? ticketState.ticket : null;
    const error = ticketState?.kind === "error" ? ticketState.message : null;

    return (
        <main className="space-y-5 px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-5">
            <Link href={APP_ROUTES.line.it} className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-semibold text-content-secondary underline-offset-4 hover:text-content-heading hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ArrowLeft aria-hidden="true" className="size-4" />
                กลับรายการ Ticket
            </Link>

            {!validId ? <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">หมายเลข Ticket ไม่ถูกต้อง</p> : null}
            {validId && ticketState === null ? (
                <div role="status" aria-label="กำลังโหลด Ticket" className="space-y-4 rounded-xl border border-border-neutral bg-surface-raised p-5">
                    <div className="h-5 w-1/3 animate-pulse motion-reduce:animate-none rounded bg-surface-subtle" />
                    <div className="h-7 w-4/5 animate-pulse motion-reduce:animate-none rounded bg-surface-subtle" />
                    <div className="h-24 animate-pulse motion-reduce:animate-none rounded bg-surface-subtle" />
                </div>
            ) : null}
            {refreshing ? <p role="status" className="text-sm text-content-secondary">กำลังโหลดสถานะ Ticket ล่าสุด…</p> : null}
            {error ? (
                <div role="alert" className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                    <p className="flex items-start gap-2"><CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" />{error}</p>
                    <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => {
                        setRefreshing(true);
                        setRefreshVersion((value) => value + 1);
                    }}>
                        <RefreshCw aria-hidden="true" className="size-4" />
                        โหลด Ticket อีกครั้ง
                    </Button>
                </div>
            ) : null}
            {ticket ? (
                <>
                    <article className="space-y-5 rounded-xl border border-border-neutral bg-surface-raised p-4">
                        <header className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold tabular-nums text-content-muted">Ticket #{ticket.id}</p>
                                <TicketStatus status={ticket.status} />
                            </div>
                            <div className="space-y-1">
                                <p className="text-sm text-content-secondary">{IT_TICKET_TYPE_LABELS[ticket.type]}</p>
                                <h1 className="break-words text-xl font-bold leading-7 tracking-tight text-content-heading">{ticket.title}</h1>
                            </div>
                        </header>
                        <section aria-labelledby="liff-it-ticket-description-heading" className="space-y-2 border-t border-border-neutral pt-4">
                            <h2 id="liff-it-ticket-description-heading" className="text-sm font-semibold text-content-heading">รายละเอียด</h2>
                            <p className="whitespace-pre-wrap break-words text-sm leading-7 text-content-body">{ticket.description}</p>
                        </section>
                        <dl className="grid grid-cols-1 gap-3 border-t border-border-neutral pt-4 text-sm sm:grid-cols-2">
                            <div className="space-y-1">
                                <dt className="text-xs font-medium text-content-muted">สร้างเมื่อ</dt>
                                <dd><time dateTime={ticket.createdAt}>{formatITTicketDate(ticket.createdAt)}</time></dd>
                            </div>
                            <div className="space-y-1">
                                <dt className="text-xs font-medium text-content-muted">ปรับปรุงล่าสุด</dt>
                                <dd><time dateTime={ticket.updatedAt}>{formatITTicketDate(ticket.updatedAt)}</time></dd>
                            </div>
                            {ticket.resolvedAt ? (
                                <div className="space-y-1 sm:col-span-2">
                                    <dt className="text-xs font-medium text-content-muted">ดำเนินการเสร็จสิ้น</dt>
                                    <dd><time dateTime={ticket.resolvedAt}>{formatITTicketDate(ticket.resolvedAt)}</time></dd>
                                </div>
                            ) : null}
                        </dl>
                    </article>
                    <section aria-labelledby="liff-it-conversation-heading" className="space-y-3">
                        <header className="space-y-1">
                            <h2 id="liff-it-conversation-heading" className="flex items-center gap-2 text-lg font-semibold text-content-heading">
                                <MessageSquareText aria-hidden="true" className="size-5 text-brand-foreground" />
                                การสนทนาและประวัติ
                            </h2>
                            <p className="text-sm leading-6 text-content-secondary">ข้อความและความคืบหน้าของ Ticket นี้</p>
                        </header>
                        <LiffITConversation
                            key={ticket.id}
                            ticketId={ticket.id}
                            status={ticket.status}
                            refreshVersion={refreshVersion}
                            ticketRefreshing={refreshing}
                            onTicketRefresh={() => {
                                setRefreshing(true);
                                setRefreshVersion((value) => value + 1);
                            }}
                        />
                    </section>
                </>
            ) : null}
        </main>
    );
}

export function LiffITApp({ ticketId }: { readonly ticketId?: string }): ReactElement {
    return ticketId === undefined
        ? <LiffITTicketList />
        : <LiffITTicketDetail key={ticketId} ticketId={ticketId} />;
}
