"use client";

import { useState, useCallback, useEffect } from "react";
import { useSession } from "next-auth/react";
import useSWR from "swr";
import { apiPost, apiPatch } from "@/lib/api-client";

interface Comment {
    id: number;
    content: string;
    createdAt: string;
    author: {
        id: number;
        name: string;
        email: string;
        role: string;
        employee?: {
            firstName: string;
            lastName: string;
        };
    };
}

interface TicketDetailData {
    id: number;
    title: string;
    description: string;
    category: string;
    priority: string;
    status: string;
    createdAt: string;
    updatedAt: string;
    resolvedAt?: string;
    reportedBy: {
        id: number;
        name: string;
        email: string;
        employee?: {
            firstName: string;
            lastName: string;
            dept?: {
                name: string;
            };
        };
    };
    assignedTo?: {
        id: number;
        name: string;
        email: string;
        employee?: {
            firstName: string;
            lastName: string;
        };
    };
    comments: Comment[];
}

interface UseTicketDetailReturn {
    ticket: TicketDetailData | null;
    loading: boolean;
    error: string;
    newComment: string;
    setNewComment: (value: string) => void;
    commentLoading: boolean;
    updateLoading: boolean;
    statusUpdate: string;
    setStatusUpdate: (value: string) => void;
    handleAddComment: () => Promise<void>;
    handleStatusUpdate: () => Promise<void>;
    isAdmin: boolean;
    isOwner: boolean;
    canComment: boolean;
}

export function useTicketDetail(
    ticketId: number,
    onTicketUpdated?: () => void,
): UseTicketDetailReturn {
    const { data: session } = useSession();
    const [newComment, setNewComment] = useState("");
    const [commentLoading, setCommentLoading] = useState(false);
    const [updateLoading, setUpdateLoading] = useState(false);
    const [statusUpdate, setStatusUpdate] = useState("");

    const swrKey = ticketId ? `/api/tickets/${ticketId}` : null;
    const { data, error: swrError, mutate, isLoading } = useSWR(swrKey);

    const ticket = data?.ticket || null;
    const error = swrError ? swrError.message || "เกิดข้อผิดพลาด" : "";

    useEffect(() => {
        setStatusUpdate(ticket?.status ?? "");
    }, [ticketId, ticket?.status]);

    const handleAddComment = useCallback(async () => {
        if (!newComment.trim()) return;

        try {
            setCommentLoading(true);

            const result = await apiPost(`/api/tickets/${ticketId}/comments`, {
                content: newComment,
            });

            if (!result.success) {
                throw new Error(result.error);
            }

            setNewComment("");
            mutate(); // Refresh data
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "เกิดข้อผิดพลาดในการเพิ่มความคิดเห็น";
            alert(errorMessage);
        } finally {
            setCommentLoading(false);
        }
    }, [ticketId, newComment, mutate]);

    const handleStatusUpdate = useCallback(async () => {
        if (!statusUpdate || statusUpdate === ticket?.status) return;

        try {
            setUpdateLoading(true);

            const result = await apiPatch(`/api/tickets/${ticketId}`, {
                status: statusUpdate,
            });

            if (!result.success) {
                throw new Error(result.error);
            }

            await mutate(); // Refresh data

            if (onTicketUpdated) {
                onTicketUpdated();
            }
        } catch (err: unknown) {
            const errorMessage =
                err instanceof Error
                    ? err.message
                    : "เกิดข้อผิดพลาดในการอัปเดตสถานะ";
            alert(errorMessage);
        } finally {
            setUpdateLoading(false);
        }
    }, [ticketId, statusUpdate, ticket?.status, onTicketUpdated, mutate]);

    const isAdmin = session?.user?.role === "ADMIN";
    const isOwner =
        ticket && session && ticket.reportedBy.id === parseInt(session.user.id);
    const canComment =
        isAdmin ||
        isOwner ||
        ticket?.assignedTo?.id === parseInt(session?.user?.id || "");

    return {
        ticket,
        loading: isLoading,
        error,
        newComment,
        setNewComment,
        commentLoading,
        updateLoading,
        statusUpdate,
        setStatusUpdate,
        handleAddComment,
        handleStatusUpdate,
        isAdmin,
        isOwner: !!isOwner,
        canComment: !!canComment,
    };
}
