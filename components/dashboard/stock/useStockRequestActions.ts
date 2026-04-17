"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { ensureStockApiSuccess } from "./stockAdminInventory.shared";

type UseStockRequestActionsOptions = {
    onCancelSettled?: () => void;
    onCancelSuccess?: () => void;
    onIssueSettled?: () => void;
    onIssueSuccess?: () => void;
};

type UseStockRequestActionsResult = {
    processingRequestId: number | null;
    runCancelRequest: (requestId: number, cancelReason?: string) => Promise<void>;
    runIssueRequest: (requestId: number) => Promise<void>;
};

export function useStockRequestActions({
    onCancelSettled,
    onCancelSuccess,
    onIssueSettled,
    onIssueSuccess,
}: UseStockRequestActionsOptions): UseStockRequestActionsResult {
    const [processingRequestId, setProcessingRequestId] = useState<number | null>(null);

    async function runCancelRequest(
        requestId: number,
        cancelReason?: string,
    ): Promise<void> {
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

    async function runIssueRequest(requestId: number): Promise<void> {
        setProcessingRequestId(requestId);

        try {
            ensureStockApiSuccess(
                await apiPost(API_ROUTES.stock.issueById(requestId), {}),
                "เกิดข้อผิดพลาด",
            );

            toast.success(`จ่ายคำขอ #${requestId} เรียบร้อยแล้ว`);
            onIssueSuccess?.();
        } catch (error: unknown) {
            toast.error(error instanceof Error ? error.message : "เกิดข้อผิดพลาด");
        } finally {
            setProcessingRequestId(null);
            onIssueSettled?.();
        }
    }

    return {
        processingRequestId,
        runCancelRequest,
        runIssueRequest,
    };
}
