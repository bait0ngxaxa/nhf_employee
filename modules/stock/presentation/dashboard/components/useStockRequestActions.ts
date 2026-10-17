"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { apiPost } from "@/lib/client/api-client";
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
    };

type UseStockRequestActionsResult = {
    processingRequestId: number | null;
    runCancelRequest: (requestId: number, cancelReason?: string) => Promise<void>;
    runIssueRequest: (requestId: number) => Promise<StockIssueRequestResult>;
};

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
            };
        }
        if (issueInFlightRef.current) {
            return {
                success: false,
                message: "กำลังดำเนินการจ่ายคำขออื่นอยู่",
                status: undefined,
            };
        }
        issueInFlightRef.current = true;
        setProcessingRequestId(requestId);

        let responseStatus: number | undefined;
        let result: StockIssueRequestResult;
        try {
            const response = await apiPost(API_ROUTES.stock.issueById(requestId), {});
            responseStatus = response.status;
            ensureStockApiSuccess(
                response,
                "เกิดข้อผิดพลาด",
            );
            result = { success: true };
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "เกิดข้อผิดพลาด";
            toast.error(message);
            onIssueFailure?.();
            result = { success: false, message, status: responseStatus };
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

    return {
        processingRequestId,
        runCancelRequest,
        runIssueRequest,
    };
}
