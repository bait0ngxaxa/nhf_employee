"use client";

import { useState } from "react";
import useSWR from "swr";
import { toast } from "sonner";

import { apiGet, apiPost, type ApiResponse } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import type { ConfirmAction, SessionItem, SessionsResponse } from "./types";

const SESSION_LIST_FAILURE = "โหลดรายการเข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่";
const SESSION_REVOKE_FAILURE = "ออกจากระบบรายการนี้ไม่สำเร็จ กรุณาโหลดรายการล่าสุด";

function getSessionError(
    failure: Extract<ApiResponse<unknown>, { success: false }>,
    operation: "list" | "revoke",
): string {
    switch (failure.status) {
        case 401:
            return "กรุณาเข้าสู่ระบบอีกครั้ง";
        case 403:
            return operation === "list"
                ? "บัญชีนี้เปิดรายการเข้าสู่ระบบไม่ได้"
                : "บัญชีนี้ออกจากระบบรายการนี้ไม่ได้";
        case 404:
        case 409:
            return "รายการเข้าสู่ระบบอาจไม่พร้อมใช้งานแล้ว กรุณาโหลดรายการล่าสุด";
        case 400:
        case 422:
            return "ข้อมูลรายการเข้าสู่ระบบไม่ถูกต้อง กรุณาโหลดรายการล่าสุด";
        default:
            if (failure.code === "TIMEOUT") {
                return "การเชื่อมต่อใช้เวลานานเกินไป กรุณาโหลดรายการล่าสุด";
            }
            if (failure.status === undefined) {
                return "เชื่อมต่อไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วโหลดรายการใหม่";
            }
            return operation === "list" ? SESSION_LIST_FAILURE : SESSION_REVOKE_FAILURE;
    }
}

async function fetchSessions(): Promise<SessionsResponse> {
    const result = await apiGet<SessionsResponse>(API_ROUTES.auth.sessions);
    if (!result.success) {
        throw new Error(getSessionError(result, "list"));
    }

    return result.data;
}

interface UseSessionManagementArgs {
    onSignOutCurrent: () => void;
}

interface UseSessionManagementResult {
    sessions: SessionItem[];
    currentSession: SessionItem | null;
    otherSessions: SessionItem[];
    error: Error | undefined;
    isLoading: boolean;
    isValidating: boolean;
    revokingId: string | null;
    isRevokingOthers: boolean;
    confirmAction: ConfirmAction | null;
    setConfirmAction: (action: ConfirmAction | null) => void;
    refresh: () => Promise<SessionsResponse | undefined>;
    handleConfirmAction: () => Promise<void>;
}

export function useSessionManagement({
    onSignOutCurrent,
}: UseSessionManagementArgs): UseSessionManagementResult {
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [isRevokingOthers, setIsRevokingOthers] = useState(false);
    const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

    const { data, error, isLoading, isValidating, mutate } = useSWR<SessionsResponse>(
        API_ROUTES.auth.sessions,
        fetchSessions,
    );

    const sessions = data?.sessions ?? [];
    const currentSession = sessions.find((session) => session.isCurrent) ?? null;
    const otherSessions = sessions.filter((session) => !session.isCurrent);

    const handleRevokeSession = async (sessionId: string): Promise<void> => {
        setRevokingId(sessionId);
        try {
            const result = await apiPost<{ success: true }>(
                API_ROUTES.auth.revokeSession,
                { sessionId },
            );
            if (!result.success) {
                toast.error(getSessionError(result, "revoke"));
                return;
            }

            toast.success("นำอุปกรณ์ออกจากระบบแล้ว");
            await mutate();
        } catch {
            toast.error(SESSION_REVOKE_FAILURE);
        } finally {
            setRevokingId(null);
        }
    };

    const handleRevokeOtherSessions = async (): Promise<void> => {
        if (otherSessions.length === 0) {
            toast.info("ไม่มีอุปกรณ์อื่นที่เข้าสู่ระบบ");
            return;
        }

        setIsRevokingOthers(true);
        try {
            const revokeResults = await Promise.all(
                otherSessions.map((session) =>
                    apiPost<{ success: true }>(
                        API_ROUTES.auth.revokeSession,
                        { sessionId: session.id },
                    ),
                ),
            );

            const failures = revokeResults.filter((result) => !result.success);
            const failedCount = failures.length;
            if (failedCount > 0) {
                const messages = [...new Set(failures.map((result) => getSessionError(result, "revoke")))];
                toast.error(`นำอุปกรณ์ออกจากระบบไม่สำเร็จ ${failedCount} รายการ`, {
                    description: messages.join(" "),
                });
            } else {
                toast.success("ออกจากระบบอุปกรณ์อื่นทั้งหมดแล้ว");
            }

            await mutate();
        } catch {
            toast.error("ไม่สามารถออกจากระบบอุปกรณ์อื่นได้");
        } finally {
            setIsRevokingOthers(false);
        }
    };

    const handleConfirmAction = async (): Promise<void> => {
        if (!confirmAction) {
            return;
        }

        if (confirmAction.type === "revoke-session") {
            setConfirmAction(null);
            await handleRevokeSession(confirmAction.sessionId);
            return;
        }

        if (confirmAction.type === "signout-current") {
            setConfirmAction(null);
            onSignOutCurrent();
            return;
        }

        setConfirmAction(null);
        await handleRevokeOtherSessions();
    };

    return {
        sessions,
        currentSession,
        otherSessions,
        error,
        isLoading,
        isValidating,
        revokingId,
        isRevokingOthers,
        confirmAction,
        setConfirmAction,
        refresh: mutate,
        handleConfirmAction,
    };
}
