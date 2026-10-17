"use client";

import { useRef, useState } from "react";
import type { StockRequestStatus } from "@prisma/client";
import { toast } from "sonner";
import { apiGet, apiPost, type ApiResponse } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { ensureStockApiSuccess } from "./stockAdminInventory.shared";

type UseStockRequestActionsOptions = {
    canCancelRequests: boolean;
    canProcessRequests: boolean;
    onCancelSettled?: () => void;
    onCancelSuccess?: () => void;
    onIssueSettled?: () => void;
    onIssueSuccess?: () => void;
    onIssueFailure?: () => void;
};

export type StockIssueRequestResult =
    | { readonly success: true }
    | {
        readonly success: false;
        readonly message: string;
        readonly status: number | undefined;
        readonly requiresStatusVerification: boolean;
    };

export type StockIssueRequestStatusVerification =
    | { readonly kind: "eligible" }
    | { readonly kind: "ineligible"; readonly status: StockRequestStatus }
    | { readonly kind: "unknown" };

type UseStockRequestActionsResult = {
    processingRequestId: number | null;
    runCancelRequest: (requestId: number, cancelReason?: string) => Promise<void>;
    runIssueRequest: (requestId: number) => Promise<StockIssueRequestResult>;
    verifyIssueRequestStatus: (
        requestId: number,
    ) => Promise<StockIssueRequestStatusVerification>;
};

type StockRequestStatusResponse = {
    requests?: Array<{ id: number; status: StockRequestStatus }>;
};

const STALE_ISSUE_RESPONSE_MESSAGES = [
    "ไม่พบคำขอเบิก",
    "คำขอนี้ถูกดำเนินการแล้ว",
] as const;

function requiresIssueStatusVerification(
    response: ApiResponse<unknown>,
): boolean {
    return !response.success
        && response.status === 400
        && STALE_ISSUE_RESPONSE_MESSAGES.some(
            (message) => response.errorThai === message || response.error === message,
        );
}

export function useStockRequestActions({
    canCancelRequests,
    canProcessRequests,
    onCancelSettled,
    onCancelSuccess,
    onIssueSettled,
    onIssueSuccess,
    onIssueFailure,
}: UseStockRequestActionsOptions): UseStockRequestActionsResult {
    const [processingRequestId, setProcessingRequestId] = useState<number | null>(null);
    const issueInFlightRef = useRef(false);

    async function runCancelRequest(
        requestId: number,
        cancelReason?: string,
    ): Promise<void> {
        if (!canCancelRequests) {
            return;
        }
        setProcessingRequestId(requestId);

        try {
            ensureStockApiSuccess(
                await apiPost(API_ROUTES.stock.cancelById(requestId), {
                    cancelReason: cancelReason?.trim() ? cancelReason.trim() : null,
                }),
                "เกิดข้อผิดพลาด",
            );

            toast.success(`ยกเลิกคำขอ #${requestId} เรียบร้อยแล้ว`);
            onCancelSuccess?.();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
        } finally {
            setProcessingRequestId(null);
            onCancelSettled?.();
        }
    }

    async function runIssueRequest(requestId: number): Promise<StockIssueRequestResult> {
        if (!canProcessRequests) {
            return {
                success: false,
                message: "คุณไม่มีสิทธิ์ดำเนินการนี้",
                status: undefined,
                requiresStatusVerification: false,
            };
        }
        if (issueInFlightRef.current) {
            return {
                success: false,
                message: "กำลังดำเนินการจ่ายคำขออื่นอยู่",
                status: undefined,
                requiresStatusVerification: false,
            };
        }
        issueInFlightRef.current = true;
        setProcessingRequestId(requestId);

        let responseStatus: number | undefined;
        let needsStatusVerification = false;
        let result: StockIssueRequestResult;
        try {
            const response = await apiPost(API_ROUTES.stock.issueById(requestId), {});
            responseStatus = response.status;
            needsStatusVerification = requiresIssueStatusVerification(response);
            ensureStockApiSuccess(
                response,
                "เกิดข้อผิดพลาด",
            );
            result = { success: true };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
            toast.error(message);
            onIssueFailure?.();
            result = {
                success: false,
                message,
                status: responseStatus,
                requiresStatusVerification: needsStatusVerification,
            };
        } finally {
            issueInFlightRef.current = false;
            setProcessingRequestId(null);
            onIssueSettled?.();
        }

        if (result.success) {
            toast.success(`จ่ายคำขอ #${requestId} เรียบร้อยแล้ว`);
            onIssueSuccess?.();
        }

        return result;
    }

    async function verifyIssueRequestStatus(
        requestId: number,
    ): Promise<StockIssueRequestStatusVerification> {
        const params = new URLSearchParams({
            scope: "all",
            search: String(requestId),
            page: "1",
            limit: "100",
        });

        try {
            const response = await apiGet<StockRequestStatusResponse>(
                `${API_ROUTES.stock.requests}?${params.toString()}`,
            );
            if (!response.success) {
                return { kind: "unknown" };
            }

            const request = response.data.requests?.find(
                (candidate) => candidate.id === requestId,
            );
            if (!request) {
                return { kind: "unknown" };
            }

            return request.status === "PENDING_ISSUE"
                ? { kind: "eligible" }
                : { kind: "ineligible", status: request.status };
        } catch {
            return { kind: "unknown" };
        }
    }

    return {
        processingRequestId,
        runCancelRequest,
        runIssueRequest,
        verifyIssueRequestStatus,
    };
}
