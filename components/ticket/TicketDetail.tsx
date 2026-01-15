"use client";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Clock,
    MessageSquare,
    Send,
    ArrowLeft,
    CheckCircle,
    AlertCircle,
    XCircle,
} from "lucide-react";
import { useTicketDetail } from "@/hooks/useTicketDetail";
import { TICKET_STATUSES } from "@/constants/tickets";
import {
    getTicketCategoryLabel,
    getTicketPriorityLabel,
    getTicketStatusLabel,
    getPriorityBadgeColor,
    getStatusBadgeColor,
} from "@/lib/helpers/ticket-helpers";
import { CommentItem } from "./CommentItem";

interface TicketDetailProps {
    ticketId: number;
    onBack?: () => void;
    onTicketUpdated?: () => void;
}

export default function TicketDetail({
    ticketId,
    onBack,
    onTicketUpdated,
}: TicketDetailProps) {
    const {
        ticket,
        loading,
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
        canComment,
    } = useTicketDetail(ticketId, onTicketUpdated);

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "OPEN":
                return <AlertCircle className="h-4 w-4" />;
            case "IN_PROGRESS":
                return <Clock className="h-4 w-4" />;
            case "RESOLVED":
                return <CheckCircle className="h-4 w-4" />;
            default:
                return <XCircle className="h-4 w-4" />;
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("th-TH", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="text-center">กำลังโหลด...</div>
                </CardContent>
            </Card>
        );
    }

    if (error || !ticket) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="text-center text-red-600">
                        {error || "ไม่พบข้อมูล ticket"}
                    </div>
                    {onBack && (
                        <div className="text-center mt-4">
                            <Button variant="outline" onClick={onBack}>
                                <ArrowLeft className="h-4 w-4 mr-2" />
                                กลับ
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                {onBack && (
                    <Button variant="outline" onClick={onBack}>
                        <ArrowLeft className="h-4 w-4 mr-2" />
                        กลับ
                    </Button>
                )}
                <div className="flex items-center gap-2">
                    {getStatusIcon(ticket.status)}
                    <span className="text-sm font-medium">
                        Ticket #{ticket.id}
                    </span>
                </div>
            </div>

            {/* Ticket Details */}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-start">
                        <div>
                            <CardTitle>{ticket.title}</CardTitle>
                            <CardDescription>
                                แจ้งโดย{" "}
                                {ticket.reportedBy.employee?.firstName &&
                                ticket.reportedBy.employee?.lastName
                                    ? `${ticket.reportedBy.employee.firstName} ${ticket.reportedBy.employee.lastName}`
                                    : ticket.reportedBy.name}
                                {ticket.reportedBy.employee?.dept &&
                                    ` (${ticket.reportedBy.employee.dept.name})`}
                            </CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Badge
                                className={getPriorityBadgeColor(
                                    ticket.priority
                                )}
                            >
                                {getTicketPriorityLabel(ticket.priority)}
                            </Badge>
                            <Badge
                                className={getStatusBadgeColor(ticket.status)}
                            >
                                {getTicketStatusLabel(ticket.status)}
                            </Badge>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h3 className="font-medium mb-2">รายละเอียดปัญหา</h3>
                        <p className="text-gray-700 whitespace-pre-wrap">
                            {ticket.description}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                            <span className="font-medium">หมวดหมู่:</span>
                            <p>{getTicketCategoryLabel(ticket.category)}</p>
                        </div>
                        <div>
                            <span className="font-medium">วันที่แจ้ง:</span>
                            <p>{formatDate(ticket.createdAt)}</p>
                        </div>
                        <div>
                            <span className="font-medium">อัปเดตล่าสุด:</span>
                            <p>{formatDate(ticket.updatedAt)}</p>
                        </div>
                        {ticket.resolvedAt && (
                            <div>
                                <span className="font-medium">
                                    วันที่แก้ไข:
                                </span>
                                <p>{formatDate(ticket.resolvedAt)}</p>
                            </div>
                        )}
                    </div>

                    {ticket.assignedTo && (
                        <div>
                            <span className="font-medium">มอบหมายให้:</span>
                            <p>
                                {ticket.assignedTo.employee?.firstName &&
                                ticket.assignedTo.employee?.lastName
                                    ? `${ticket.assignedTo.employee.firstName} ${ticket.assignedTo.employee.lastName}`
                                    : ticket.assignedTo.name}
                            </p>
                        </div>
                    )}

                    {/* Admin Controls */}
                    {isAdmin && (
                        <div className="border-t pt-4">
                            <h3 className="font-medium mb-3">จัดการ Ticket</h3>
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="text-sm font-medium">
                                        สถานะ
                                    </label>
                                    <Select
                                        value={statusUpdate}
                                        onValueChange={setStatusUpdate}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {TICKET_STATUSES.map((status) => (
                                                <SelectItem
                                                    key={status.value}
                                                    value={status.value}
                                                >
                                                    {status.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button
                                    onClick={handleStatusUpdate}
                                    disabled={
                                        updateLoading ||
                                        statusUpdate === ticket.status
                                    }
                                >
                                    {updateLoading
                                        ? "กำลังอัปเดต..."
                                        : "อัปเดตสถานะ"}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Comments */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquare className="h-5 w-5" />
                        ความคิดเห็น ({ticket.comments.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {ticket.comments.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">
                            ยังไม่มีความคิดเห็น
                        </p>
                    ) : (
                        <div className="space-y-4">
                            {ticket.comments.map((comment, index) => (
                                <CommentItem
                                    key={comment.id}
                                    {...comment}
                                    showSeparator={
                                        index < ticket.comments.length - 1
                                    }
                                />
                            ))}
                        </div>
                    )}

                    {/* Add Comment */}
                    {canComment && (
                        <div className="border-t pt-4">
                            <h3 className="font-medium mb-3">
                                เพิ่มความคิดเห็น
                            </h3>
                            <div className="space-y-3">
                                <Textarea
                                    placeholder="แสดงความคิดเห็นหรือให้ข้อมูลเพิ่มเติม..."
                                    value={newComment}
                                    onChange={(e) =>
                                        setNewComment(e.target.value)
                                    }
                                    rows={3}
                                />
                                <Button
                                    onClick={handleAddComment}
                                    disabled={
                                        commentLoading || !newComment.trim()
                                    }
                                    className="flex items-center gap-2"
                                >
                                    <Send className="h-4 w-4" />
                                    {commentLoading
                                        ? "กำลังส่ง..."
                                        : "ส่งความคิดเห็น"}
                                </Button>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
