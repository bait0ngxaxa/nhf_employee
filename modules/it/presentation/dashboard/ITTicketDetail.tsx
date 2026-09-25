"use client";

import { useEffect, useState, type ReactElement } from "react";
import Link from "next/link";
import { ArrowLeft, CircleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { API_ROUTES, APP_ROUTES } from "@/lib/ssot/routes";
import { ITTicketConversation } from "./ITTicketConversation";

import {
    IT_TICKET_STATUS_LABELS,
    IT_TICKET_TYPE_LABELS,
    type ITRequesterTicket,
} from "../../contracts";
import {
    formatITTicketDate,
    IT_TICKET_STATUS_STYLES,
    isITTicketResponseRecord,
    parseITRequesterTicket,
    readITRequesterError,
} from "./ticket-presentation";

type ITRequesterDetailState =
    | { readonly key: string; readonly kind: "loaded"; readonly ticket: ITRequesterTicket }
    | { readonly key: string; readonly kind: "error"; readonly message: string };

export function ITTicketDetail({
    ticketId,
    canCommentOwnTickets,
}: {
    readonly ticketId: number;
    readonly canCommentOwnTickets: boolean;
}): ReactElement {
    const [detailState, setDetailState] = useState<ITRequesterDetailState | null>(null);
    const [retryKey, setRetryKey] = useState(0);
    const requestKey = `${ticketId}:${retryKey}`;
    const currentDetailState = detailState?.key === requestKey ? detailState : null;
    const ticket = currentDetailState?.kind === "loaded" ? currentDetailState.ticket : null;
    const error = currentDetailState?.kind === "error" ? currentDetailState.message : null;
    const loading = currentDetailState === null;

    useEffect(() => {
        const controller = new AbortController();
        void fetch(API_ROUTES.itTickets.byId(ticketId), { signal: controller.signal })
            .then(async (response) => {
                const payload: unknown = await response.json().catch(() => null);
                if (!response.ok) throw new Error(readITRequesterError(payload, response.status, true));
                if (!isITTicketResponseRecord(payload) || payload.success !== true) {
                    throw new Error("ข้อมูล Ticket ไม่ถูกต้อง กรุณาลองอีกครั้ง");
                }
                const parsed = parseITRequesterTicket(payload.ticket);
                if (parsed === null) throw new Error("ข้อมูล Ticket ไม่ถูกต้อง กรุณาลองอีกครั้ง");
                if (controller.signal.aborted) return;
                setDetailState({ key: requestKey, kind: "loaded", ticket: parsed });
            })
            .catch((cause: unknown) => {
                if (controller.signal.aborted) return;
                setDetailState({
                    key: requestKey,
                    kind: "error",
                    message: cause instanceof Error
                        ? cause.message
                        : readITRequesterError(null, 500, true),
                });
            });

        return () => controller.abort();
    }, [ticketId, retryKey, requestKey]);

    return (
        <section className="min-h-[calc(100dvh-6rem)] p-4 md:p-8">
            <div className="mx-auto max-w-4xl space-y-5">
                <Link href={APP_ROUTES.dashboardIT} className="inline-flex min-h-11 items-center gap-2 rounded-md text-sm font-medium text-brand-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                    <ArrowLeft aria-hidden="true" className="size-4" />
                    กลับไปยังรายการ Ticket
                </Link>

                {loading ? (
                    <div role="status" aria-label="กำลังโหลด Ticket" className="space-y-5">
                        <Skeleton className="h-8 w-1/2" />
                        <Skeleton className="h-64 w-full rounded-xl" />
                    </div>
                ) : null}
                {!loading && error ? (
                    <div role="alert" className="space-y-4 rounded-xl border border-rose-200 bg-rose-50 p-5 text-rose-900 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-100">
                        <div className="flex gap-3">
                            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                            <p>{error}</p>
                        </div>
                        <Button type="button" variant="outline" onClick={() => setRetryKey((current) => current + 1)}>
                            ลองอีกครั้ง
                        </Button>
                    </div>
                ) : null}
                {!loading && !error && ticket ? (
                    <>
                        <header className="space-y-1">
                            <h1 data-page-heading tabIndex={-1} className="text-2xl font-bold tracking-tight text-content-heading [overflow-wrap:anywhere] md:text-3xl">
                                Ticket #{ticket.id}
                            </h1>
                            <p className="text-sm text-content-secondary">{IT_TICKET_TYPE_LABELS[ticket.type]}</p>
                        </header>

                        <Card>
                            <CardHeader className="gap-4 border-b border-border-neutral sm:flex-row sm:items-center sm:justify-between">
                                <CardTitle className="text-xl leading-7 text-content-heading [overflow-wrap:anywhere]">
                                    {ticket.title}
                                </CardTitle>
                                <span className={`inline-flex min-h-7 w-fit shrink-0 items-center rounded-full px-3 py-1 text-xs font-semibold ${IT_TICKET_STATUS_STYLES[ticket.status]}`}>
                                    {IT_TICKET_STATUS_LABELS[ticket.status]}
                                </span>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <h2 className="text-sm font-semibold text-content-heading">รายละเอียด</h2>
                                    <p className="mt-2 max-w-[75ch] whitespace-pre-wrap break-words text-sm leading-7 text-content-body">
                                        {ticket.description}
                                    </p>
                                </div>
                                <dl className="grid gap-x-6 gap-y-4 border-t border-border-neutral pt-5 sm:grid-cols-2">
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
                            canComment={canCommentOwnTickets}
                            operator={false}
                        />
                    </>
                ) : null}
            </div>
        </section>
    );
}
