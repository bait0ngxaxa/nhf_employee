"use client";

import { useRef, useState, type RefObject } from "react";
import { type StockRequestStatus } from "@prisma/client";
import { CheckCircle, ClipboardList, Loader2, Search, X, XCircle } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { RequestStatusBadge } from "@/components/dashboard/shared/RequestStatusBadge";
import { getStockRequestStatusMeta } from "../../status-meta";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useStockDataContext, useStockUIContext } from "../context";
import { STOCK_REQUESTS_LIMIT as REQUESTS_PER_PAGE } from "../context/provider.shared";
import type { StockRequest } from "../context/types";
import {
    formatStockRequestDate,
    REQUEST_STATUS_OPTIONS,
} from "./stockRequest.shared";
import { getRequestItemDisplayName } from "./stockVariant.shared";
import { getUserDisplayName } from "@/shared/identity/display";
import {
    useStockRequestActions,
    type StockIssueRequestStatusVerification,
} from "./useStockRequestActions";
import { StockRequestNote } from "./StockRequestNote";
import { StockEmptyState } from "./StockLoadingState";
import { StockRequestListSkeleton } from "./StockSkeletons";
import { StockRequestMobileCards } from "./StockRequestMobileCards";

type IssueStatusVerificationState =
    | { requestId: number; kind: "checking" }
    | {
        requestId: number;
        kind: "verified";
        result: StockIssueRequestStatusVerification;
    };

type IssueConfirmationStatus =
    | { kind: "checking" }
    | { kind: "eligible"; isFresh: boolean }
    | { kind: "ineligible"; status: StockRequest["status"] }
    | { kind: "unknown" };

function resolveIssueConfirmationStatus(
    latestStatus: StockRequest["status"] | undefined,
    verification: IssueStatusVerificationState | null,
): IssueConfirmationStatus {
    if (latestStatus !== undefined && latestStatus !== "PENDING_ISSUE") {
        return { kind: "ineligible", status: latestStatus };
    }
    if (verification?.kind === "checking") {
        return { kind: "checking" };
    }
    if (verification?.kind === "verified") {
        if (verification.result.kind === "ineligible") {
            return verification.result;
        }
        if (verification.result.kind === "unknown") {
            return { kind: "unknown" };
        }
        return { kind: "eligible", isFresh: true };
    }
    if (latestStatus === "PENDING_ISSUE") {
        return { kind: "eligible", isFresh: false };
    }
    return { kind: "unknown" };
}

export function StockAdminRequests() {
    const {
        requests,
        isLoading,
        refreshRequests,
        refreshItems,
        totalRequests,
        stockCapabilities,
    } = useStockDataContext();
    const canProcessRequests = stockCapabilities.canProcessRequests;
    const canCancelAnyRequests = stockCapabilities.canCancelAnyRequests;
    const {
        requestsPage,
        setRequestsPage,
        statusFilter,
        setStatusFilter,
        requestSearchQuery,
        setRequestSearchQuery,
    } = useStockUIContext();
    const {
        processingRequestId,
        runCancelRequest,
        runIssueRequest,
        verifyIssueRequestStatus,
    } =
        useStockRequestActions({
            canCancelRequests: canCancelAnyRequests,
            canProcessRequests,
            onIssueSuccess: () => {
                refreshRequests();
                refreshItems();
            },
            onIssueFailure: () => {
                refreshRequests();
                refreshItems();
            },
            onCancelSuccess: refreshRequests,
        });
    const [issueRequest, setIssueRequest] = useState<StockRequest | null>(null);
    const [issueError, setIssueError] = useState<string | null>(null);
    const [issueStatusVerification, setIssueStatusVerification] =
        useState<IssueStatusVerificationState | null>(null);
    const issueCancelButtonRef = useRef<HTMLButtonElement>(null);
    const issueTriggerRef = useRef<HTMLButtonElement | null>(null);
    const issueFallbackFocusRef = useRef<HTMLInputElement>(null);
    const totalPages = Math.max(1, Math.ceil(totalRequests / REQUESTS_PER_PAGE));
    const hasActiveFilters =
        statusFilter !== undefined || requestSearchQuery.trim().length > 0;
    const isInitialLoading = isLoading && requests.length === 0;
    const latestIssueRequest = issueRequest
        ? requests.find((request) => request.id === issueRequest.id)
        : undefined;
    const activeIssueStatusVerification = issueRequest
        && issueStatusVerification?.requestId === issueRequest.id
        ? issueStatusVerification
        : null;
    const issueConfirmationStatus = resolveIssueConfirmationStatus(
        latestIssueRequest?.status,
        activeIssueStatusVerification,
    );

    function openIssueConfirmation(
        request: StockRequest,
        trigger: HTMLButtonElement,
    ): void {
        if (!canProcessRequests || request.status !== "PENDING_ISSUE") return;
        issueTriggerRef.current = trigger;
        setIssueError(null);
        setIssueStatusVerification(null);
        setIssueRequest(request);
    }

    async function handleIssue(): Promise<void> {
        const selectedRequest = issueRequest;
        if (
            !selectedRequest
            || processingRequestId !== null
            || issueConfirmationStatus.kind !== "eligible"
        ) return;

        setIssueError(null);
        const result = await runIssueRequest(selectedRequest.id);
        if (result.success) {
            setIssueRequest((current) =>
                current?.id === selectedRequest.id ? null : current,
            );
            setIssueStatusVerification(null);
        } else if (result.requiresStatusVerification) {
            setIssueError(null);
            setIssueStatusVerification({
                requestId: selectedRequest.id,
                kind: "checking",
            });
            const verification = await verifyIssueRequestStatus(selectedRequest.id);
            setIssueStatusVerification({
                requestId: selectedRequest.id,
                kind: "verified",
                result: verification,
            });
        } else {
            setIssueError(result.message);
        }
    }

    async function handleVerifyIssueStatus(): Promise<void> {
        const selectedRequest = issueRequest;
        if (!selectedRequest || processingRequestId !== null) return;

        setIssueError(null);
        setIssueStatusVerification({
            requestId: selectedRequest.id,
            kind: "checking",
        });
        const verification = await verifyIssueRequestStatus(selectedRequest.id);
        setIssueStatusVerification({
            requestId: selectedRequest.id,
            kind: "verified",
            result: verification,
        });
    }

    async function handleCancel(requestId: number, reason: string): Promise<void> {
        if (!canCancelAnyRequests) return;
        await runCancelRequest(requestId, reason);
    }

    return (
        <div className="space-y-4">
            {/* Search & Filter bar */}
            <div className="rounded-xl border border-border-subtle bg-surface-subtle/70 p-3">
                <div className="mb-3 flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <div className="text-sm font-semibold text-content-primary">
                            ค้นหาและกรองคำขอเบิก
                        </div>
                        <div className="text-xs text-content-secondary">
                            ค้นหาจากเลขที่คำขอ รหัสโครงการ ชื่อผู้ขอ อีเมล หรือชื่อรายการที่ขอเบิก
                        </div>
                    </div>
                    <Button
                        type="button"
                        size="sm"
                        variant={statusFilter === "PENDING_ISSUE" ? "default" : "outline"}
                        className="shrink-0 self-start border-action-primary-border text-action-primary-foreground hover:bg-action-primary-surface sm:self-auto"
                        onClick={() => setStatusFilter("PENDING_ISSUE")}
                    >
                        ดูคิวรอจ่าย
                    </Button>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                    <div className="relative flex-1">
                        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-content-subtle" aria-hidden="true" />
                        <Input
                            ref={issueFallbackFocusRef}
                            aria-label="ค้นหาคำขอเบิกวัสดุ"
                            name="stock-admin-request-search"
                            autoComplete="off"
                            value={requestSearchQuery}
                            onChange={(event) => setRequestSearchQuery(event.target.value)}
                            placeholder="ค้นหาเลขที่คำขอ รหัสโครงการ ชื่อ อีเมล หรือรายการ"
                            className="h-12 rounded-lg border-border-subtle bg-surface-raised pl-11 pr-11 text-content-primary placeholder:text-content-muted focus-visible:border-action-primary-border-strong focus-visible:ring-action-primary-border"
                        />
                        {requestSearchQuery.trim().length > 0 && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => setRequestSearchQuery("")}
                                className="absolute right-2 top-1/2 size-11 -translate-y-1/2 rounded-full text-content-muted hover:bg-surface-muted hover:text-content-body sm:size-8"
                                aria-label="ล้างคำค้นหาคำขอเบิกวัสดุ"
                            >
                                <X className="h-4 w-4" aria-hidden="true" />
                            </Button>
                        )}
                    </div>
                    <div className="w-full sm:w-56">
                        <Select
                            value={statusFilter ?? "all"}
                            onValueChange={(value) =>
                                setStatusFilter(
                                    value === "all"
                                        ? undefined
                                        : (value as StockRequestStatus),
                                )
                            }
                        >
                            <SelectTrigger
                                className="h-12 rounded-lg border-border-subtle bg-surface-raised text-content-primary focus:ring-action-primary-border"
                                aria-label="กรองสถานะคำขอเบิกวัสดุ"
                            >
                                <SelectValue placeholder="กรองสถานะ" />
                            </SelectTrigger>
                            <SelectContent>
                                {REQUEST_STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {isInitialLoading ? (
                <StockRequestListSkeleton />
            ) : requests.length === 0 ? (
                <StockEmptyState
                    icon={<ClipboardList className="h-6 w-6" aria-hidden="true" />}
                    message={
                        hasActiveFilters
                            ? "ไม่พบคำขอเบิกที่ตรงกับเงื่อนไขค้นหา"
                            : "ไม่มีคำขอเบิกวัสดุ"
                    }
                />
            ) : (
                <>
                    <StockRequestMobileCards
                        requests={requests}
                        showRequester
                        renderActions={(req) =>
                            req.status === "PENDING_ISSUE" ? (
                                <>
                                    {canProcessRequests ? (
                                        <Button
                                            type="button"
                                            size="sm"
                                            className="h-11 bg-status-success-solid text-content-on-brand shadow-sm transition-colors hover:bg-status-success-solid-hover"
                                            disabled={processingRequestId !== null}
                                            onClick={(event) =>
                                                openIssueConfirmation(req, event.currentTarget)
                                            }
                                        >
                                            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                            จ่ายแล้ว
                                        </Button>
                                    ) : null}
                                    {canCancelAnyRequests ? (
                                        <StockAdminCancelAction
                                            request={req}
                                            loading={processingRequestId === req.id}
                                            disabled={processingRequestId !== null}
                                            onCancel={handleCancel}
                                            className="h-11 border-status-danger-border text-status-danger-foreground transition-colors hover:border-status-danger-border-strong hover:bg-status-danger-surface hover:text-status-danger-strong"
                                        />
                                    ) : null}
                                </>
                            ) : null
                        }
                    />

                    <div className="hidden overflow-x-auto rounded-xl border border-border-subtle bg-surface-raised xl:block">
                        <Table className="min-w-[1240px] border-separate border-spacing-0">
                            <TableHeader>
                                <TableRow className="border-b border-border-subtle bg-surface-subtle hover:bg-surface-subtle">
                                    <TableHead className="w-16 border-r border-border-subtle font-semibold text-content-body">
                                        เลขที่
                                    </TableHead>
                                    <TableHead className="w-40 border-r border-border-subtle font-semibold text-content-body">
                                        วันที่
                                    </TableHead>
                                    <TableHead className="w-40 border-r border-border-subtle font-semibold text-content-body">
                                        รหัสโครงการ
                                    </TableHead>
                                    <TableHead className="w-56 border-r border-border-subtle font-semibold text-content-body">
                                        ผู้เบิก
                                    </TableHead>
                                    <TableHead className="w-[24rem] border-r border-border-subtle font-semibold text-content-body">
                                        รายการ
                                    </TableHead>
                                    <TableHead className="w-32 border-r border-border-subtle font-semibold text-content-body">
                                        สถานะ
                                    </TableHead>
                                    <TableHead className="w-52" />
                                </TableRow>
                            </TableHeader>
                            <TableBody className="[&_tr:nth-child(odd)]:bg-surface-raised [&_tr:nth-child(even)]:bg-surface-subtle/80">
                                {requests.map((req) => {
                                    const isPendingIssue = req.status === "PENDING_ISSUE";
                                    return (
                                        <TableRow
                                            key={req.id}
                                            className="border-b border-border-subtle transition-colors hover:bg-action-primary-surface/60"
                                        >
                                            <TableCell className="border-r border-border-subtle py-4 font-medium text-content-strong">
                                                #{req.id}
                                            </TableCell>
                                            <TableCell className="border-r border-border-subtle py-4 text-sm text-content-body">
                                                {formatStockRequestDate(req.createdAt)}
                                            </TableCell>
                                            <TableCell className="border-r border-border-subtle py-4 text-sm font-medium text-content-body">
                                                {req.projectCode}
                                            </TableCell>
                                            <TableCell className="w-56 border-r border-border-subtle py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-content-strong">
                                                        {getUserDisplayName(req.requester)}
                                                    </span>
                                                    <span className="text-xs font-medium text-content-subtle">
                                                        {req.requester.email}
                                                    </span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="w-[24rem] min-w-[24rem] border-r border-border-subtle py-4">
                                                <div className="space-y-1.5 py-1">
                                                    {req.items.map((ri) => (
                                                        <div
                                                            key={ri.id}
                                                            className="flex flex-wrap items-start gap-x-2 gap-y-0.5 text-sm"
                                                        >
                                                            <span className="min-w-0 font-medium leading-6 text-content-strong">
                                                                {getRequestItemDisplayName(ri)}
                                                            </span>
                                                            <span className="shrink-0 rounded-full bg-surface-muted/80 px-2 py-0.5 text-xs font-medium text-content-secondary">
                                                                x {ri.quantity} {ri.item.unit}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </TableCell>
                                            <TableCell className="border-r border-border-subtle py-4">
                                                <RequestStatusBadge meta={getStockRequestStatusMeta(req.status)} />
                                            </TableCell>
                                            <TableCell className="py-4">
                                                {isPendingIssue && (canProcessRequests || canCancelAnyRequests) ? (
                                                    <div className="flex justify-end gap-2">
                                                        {canProcessRequests ? <Button
                                                            type="button"
                                                            size="sm"
                                                            className="bg-status-success-solid text-content-on-brand shadow-sm transition-colors hover:bg-status-success-solid-hover"
                                                            disabled={processingRequestId !== null}
                                                            onClick={(event) =>
                                                                openIssueConfirmation(req, event.currentTarget)
                                                            }
                                                        >
                                                            <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                                                            จ่ายแล้ว
                                                        </Button> : null}
                                                        {canCancelAnyRequests ? (
                                                            <StockAdminCancelAction
                                                                request={req}
                                                                loading={processingRequestId === req.id}
                                                                disabled={processingRequestId !== null}
                                                                onCancel={handleCancel}
                                                                className="border-status-danger-border text-status-danger-foreground transition-colors hover:border-status-danger-border-strong hover:bg-status-danger-surface hover:text-status-danger-strong"
                                                            />
                                                        ) : null}
                                                    </div>
                                                ) : (
                                                    <StockRequestNote request={req} />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>

                    <Pagination
                        currentPage={requestsPage}
                        totalPages={totalPages}
                        itemsPerPage={REQUESTS_PER_PAGE}
                        onPageChange={setRequestsPage}
                        onPreviousPage={() =>
                            setRequestsPage(Math.max(1, requestsPage - 1))
                        }
                        onNextPage={() =>
                            setRequestsPage(Math.min(totalPages, requestsPage + 1))
                        }
                    />
                </>
            )}

            <StockIssueConfirmationDialog
                request={issueRequest}
                status={issueConfirmationStatus}
                error={issueError}
                loading={processingRequestId === issueRequest?.id}
                cancelButtonRef={issueCancelButtonRef}
                triggerRef={issueTriggerRef}
                fallbackFocusRef={issueFallbackFocusRef}
                onClose={() => {
                    if (issueConfirmationStatus.kind !== "eligible") {
                        refreshRequests();
                    }
                    setIssueError(null);
                    setIssueStatusVerification(null);
                    setIssueRequest(null);
                }}
                onConfirm={() => void handleIssue()}
                onVerifyStatus={() => void handleVerifyIssueStatus()}
            />

        </div>
    );
}

function StockIssueConfirmationDialog({
    request,
    status,
    error,
    loading,
    cancelButtonRef,
    triggerRef,
    fallbackFocusRef,
    onClose,
    onConfirm,
    onVerifyStatus,
}: {
    request: StockRequest | null;
    status: IssueConfirmationStatus;
    error: string | null;
    loading: boolean;
    cancelButtonRef: RefObject<HTMLButtonElement | null>;
    triggerRef: RefObject<HTMLButtonElement | null>;
    fallbackFocusRef: RefObject<HTMLInputElement | null>;
    onClose: () => void;
    onConfirm: () => void;
    onVerifyStatus: () => void;
}) {
    if (!request) return null;

    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open && !loading) onClose();
            }}
        >
            <DialogContent
                scrollMode="content"
                closeLabel="ปิดหน้าต่าง"
                showCloseButton={!loading}
                onOpenAutoFocus={(event) => {
                    event.preventDefault();
                    cancelButtonRef.current?.focus();
                }}
                onCloseAutoFocus={(event) => {
                    event.preventDefault();
                    const trigger = triggerRef.current;
                    if (trigger?.isConnected && !trigger.disabled) {
                        trigger.focus();
                    } else {
                        fallbackFocusRef.current?.focus();
                    }
                }}
                className="gap-5 sm:max-w-lg"
            >
                <div className="space-y-2 pr-9">
                    <DialogTitle className="text-content-heading">
                        ยืนยันจ่ายวัสดุคำขอ #{request.id}
                    </DialogTitle>
                    <DialogDescription className="leading-6 text-content-secondary">
                        เมื่อยืนยัน ระบบจะบันทึกการจ่ายวัสดุและปรับยอดคงเหลือในคลังตามรายการนี้
                    </DialogDescription>
                </div>

                <dl className="grid gap-3 rounded-lg border border-border-subtle bg-surface-subtle p-4 text-sm sm:grid-cols-2">
                    <div className="min-w-0">
                        <dt className="text-xs font-semibold text-content-muted">เลขที่คำขอ</dt>
                        <dd className="mt-1 break-words font-semibold text-content-body">#{request.id}</dd>
                    </div>
                    <div className="min-w-0">
                        <dt className="text-xs font-semibold text-content-muted">รหัสโครงการ</dt>
                        <dd className="mt-1 break-words font-semibold text-content-body">{request.projectCode}</dd>
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                        <dt className="text-xs font-semibold text-content-muted">ผู้เบิก</dt>
                        <dd className="mt-1 break-words font-semibold text-content-body">
                            {getUserDisplayName(request.requester)}
                        </dd>
                    </div>
                </dl>

                <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-content-heading">รายการวัสดุ</h3>
                    {request.items.length > 0 ? (
                        <ul className="space-y-2">
                            {request.items.map((item) => (
                                <li
                                    key={item.id}
                                    className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 rounded-lg border border-border-subtle bg-surface-raised px-3 py-2 text-sm"
                                >
                                    <span className="min-w-0 break-words font-medium text-content-body">
                                        {getRequestItemDisplayName(item)}
                                    </span>
                                    <span className="shrink-0 font-semibold text-content-body">
                                        {item.quantity} {item.variant?.unit ?? item.item.unit}
                                    </span>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm text-content-secondary">ไม่พบรายการวัสดุในคำขอนี้</p>
                    )}
                </div>

                {status.kind === "ineligible" ? (
                    <p role="alert" className="rounded-lg border border-status-warning-border bg-status-warning-surface px-3 py-2 text-sm text-status-warning-foreground">
                        สถานะคำขอเปลี่ยนเป็น “{getStockRequestStatusMeta(status.status).label}” แล้ว จึงไม่สามารถจ่ายคำขอนี้ซ้ำได้ กรุณาตรวจสอบรายการล่าสุด
                    </p>
                ) : status.kind === "unknown" ? (
                    <div className="space-y-2">
                        <p role="alert" className="rounded-lg border border-status-warning-border bg-status-warning-surface px-3 py-2 text-sm text-status-warning-foreground">
                            ไม่สามารถยืนยันสถานะล่าสุดของคำขอนี้ได้ จึงยังจ่ายไม่ได้ กรุณาปิดหน้าต่างเพื่อรีเฟรชรายการและเปิดคำขอใหม่
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={loading}
                            onClick={onVerifyStatus}
                            className="min-h-11 px-4"
                        >
                            ตรวจสอบสถานะอีกครั้ง
                        </Button>
                    </div>
                ) : status.kind === "checking" ? (
                    <p role="status" aria-live="polite" className="text-sm text-content-secondary">
                        กำลังตรวจสอบสถานะคำขอล่าสุด…
                    </p>
                ) : status.isFresh ? (
                    <p role="status" className="rounded-lg border border-status-info-border bg-status-info-surface px-3 py-2 text-sm text-status-info-foreground">
                        ตรวจสอบแล้ว คำขอยังอยู่ในสถานะรอจ่าย กรุณาตรวจสอบข้อมูลก่อนยืนยันอีกครั้ง
                    </p>
                ) : error ? (
                    <p role="alert" className="rounded-lg border border-status-danger-border-subtle bg-status-danger-surface px-3 py-2 text-sm text-status-danger-foreground">
                        {error}
                    </p>
                ) : null}

                {loading ? (
                    <p role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-content-secondary">
                        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                        กำลังบันทึกการจ่ายวัสดุ
                    </p>
                ) : null}

                <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                    <Button
                        ref={cancelButtonRef}
                        type="button"
                        variant="outline"
                        disabled={loading}
                        onClick={onClose}
                        className="min-h-11 px-5"
                    >
                        กลับไปตรวจสอบ
                    </Button>
                    <Button
                        type="button"
                        disabled={loading || status.kind !== "eligible"}
                        aria-busy={loading}
                        onClick={onConfirm}
                        className="min-h-11 px-5"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" />
                                กำลังดำเนินการ…
                            </>
                        ) : "ยืนยันจ่ายวัสดุ"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

type StockAdminCancelActionProps = {
    request: StockRequest;
    loading: boolean;
    disabled: boolean;
    onCancel: (id: number, reason: string) => Promise<void>;
    className: string;
};

function StockAdminCancelAction({
    request,
    loading,
    disabled,
    onCancel,
    className,
}: StockAdminCancelActionProps) {
    const [isOpen, setIsOpen] = useState(false);

    async function handleCancel(id: number, reason: string): Promise<void> {
        await onCancel(id, reason);
        setIsOpen(false);
    }

    return (
        <>
            <Button
                size="sm"
                variant="outline"
                className={className}
                disabled={disabled}
                onClick={() => setIsOpen(true)}
            >
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                ยกเลิก
            </Button>
            {isOpen ? (
                <CancelDialog
                    request={request}
                    onClose={() => setIsOpen(false)}
                    onCancel={handleCancel}
                    loading={loading}
                />
            ) : null}
        </>
    );
}

interface CancelDialogProps {
    request: StockRequest | null;
    onClose: () => void;
    onCancel: (id: number, reason: string) => Promise<void>;
    loading: boolean;
}

function CancelDialog({
    request,
    onClose,
    onCancel,
    loading,
}: CancelDialogProps) {
    const [reason, setReason] = useState("");

    if (!request) return null;

    return (
        <Dialog
            open
            onOpenChange={() => {
                if (!loading) {
                    onClose();
                }
            }}
        >
            <DialogContent scrollMode="area" className="overflow-hidden p-0 sm:max-w-[400px]">
                <div className="border-b border-status-danger-border-subtle bg-status-danger-surface/50 px-5 py-4 sm:px-6">
                    <DialogTitle className="text-lg font-semibold text-status-danger-heading">
                        ยกเลิกคำขอ #{request.id}
                    </DialogTitle>
                </div>
                <div className="space-y-5 px-5 py-5 sm:px-6">
                    <div className="space-y-1.5">
                        <Label
                            htmlFor="cancel-reason"
                            className="text-sm font-semibold text-content-body"
                        >
                            เหตุผล (ถ้ามี)
                        </Label>
                        <Input
                            id="cancel-reason"
                            name="cancel-reason"
                            autoComplete="off"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="ระบุเหตุผลที่ยกเลิกเพื่อแจ้งผู้เบิก"
                            className="h-11 focus-visible:ring-status-danger-focus"
                        />
                    </div>
                    <div className="flex flex-col-reverse gap-2 pt-3 sm:flex-row sm:justify-end">
                        <Button
                            variant="ghost"
                            onClick={onClose}
                            disabled={loading}
                            className="h-11 px-5 font-medium text-content-secondary hover:bg-surface-muted"
                        >
                            ยกเลิก
                        </Button>
                        <Button
                            variant="destructive"
                            disabled={loading}
                            onClick={() => void onCancel(request.id, reason.trim())}
                            className="h-11 bg-status-danger-solid px-7 font-bold text-content-on-brand shadow-sm transition-colors hover:bg-status-danger-solid-hover"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                                    กำลังดำเนินการ…
                                </>
                            ) : (
                                "ยืนยันการยกเลิก"
                            )}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
