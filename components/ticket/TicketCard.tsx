"use client";

import { Badge } from "@/components/ui/badge";
import {
    Clock,
    MessageSquare,
    User,
    Calendar,
    Sparkles,
    Tag,
} from "lucide-react";
import { type Ticket } from "@/types/tickets";
import { formatThaiDate } from "@/lib/helpers/date-helpers";
import {
    getTicketCategoryLabel,
    getTicketPriorityLabel,
    getTicketStatusLabel,
    getPriorityBadgeColor,
    getStatusBadgeColor,
} from "@/lib/helpers/ticket-helpers";

interface TicketCardProps {
    ticket: Ticket;
    isNew?: boolean;
    onClick?: () => void;
}

export function TicketCard({
    ticket,
    isNew = false,
    onClick,
}: TicketCardProps) {
    return (
        <div
            className={`
                group relative overflow-hidden rounded-2xl p-6 cursor-pointer
                transition-all duration-300 ease-out
                hover:scale-[1.01] hover:-translate-y-1
                ${
                    isNew
                        ? "bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border-2 border-blue-300 shadow-lg shadow-blue-200/40"
                        : "bg-white border border-gray-200 shadow-md hover:shadow-xl hover:border-gray-300"
                }
            `}
            onClick={onClick}
        >
            {/* Decorative gradient overlay for new tickets */}
            {isNew && (
                <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 via-purple-500/5 to-pink-500/5 pointer-events-none" />
            )}

            {/* Header Section */}
            <div className="relative flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                    {isNew && (
                        <div className="flex-shrink-0 flex items-center gap-2">
                            <div className="relative">
                                <div className="absolute inset-0 animate-ping bg-red-400 rounded-full opacity-50" />
                                <span className="relative inline-flex items-center gap-1.5 text-xs font-bold bg-gradient-to-r from-red-500 to-rose-500 text-white px-3 py-1.5 rounded-full shadow-lg">
                                    <Sparkles className="h-3.5 w-3.5" />
                                    ใหม่
                                </span>
                            </div>
                        </div>
                    )}
                    <h3
                        className={`
                        font-bold text-lg sm:text-xl leading-tight line-clamp-2
                        ${isNew ? "text-blue-900" : "text-gray-900"}
                        group-hover:text-indigo-700 transition-colors
                    `}
                    >
                        {ticket.title}
                    </h3>
                </div>

                <div className="flex flex-wrap gap-2 flex-shrink-0">
                    <Badge
                        className={`
                        font-semibold px-3 py-1.5 text-xs rounded-full shadow-sm
                        ${getPriorityBadgeColor(ticket.priority)}
                    `}
                    >
                        {getTicketPriorityLabel(ticket.priority)}
                    </Badge>
                    <Badge
                        className={`
                        font-semibold px-3 py-1.5 text-xs rounded-full shadow-sm
                        ${getStatusBadgeColor(ticket.status)}
                    `}
                    >
                        {getTicketStatusLabel(ticket.status)}
                    </Badge>
                </div>
            </div>

            {/* Description */}
            <p
                className={`
                text-sm sm:text-base mb-5 line-clamp-2 leading-relaxed
                ${isNew ? "text-blue-800/80" : "text-gray-600"}
            `}
            >
                {ticket.description}
            </p>

            {/* Meta Info Grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
                <MetaItem
                    isNew={isNew}
                    icon={<User className="h-4 w-4" />}
                    label="ผู้แจ้ง"
                >
                    {ticket.reportedBy.employee?.firstName &&
                    ticket.reportedBy.employee?.lastName
                        ? `${ticket.reportedBy.employee.firstName} ${ticket.reportedBy.employee.lastName}`
                        : ticket.reportedBy.name}
                </MetaItem>

                <MetaItem
                    isNew={isNew}
                    icon={<Calendar className="h-4 w-4" />}
                    label="วันที่"
                >
                    {formatThaiDate(ticket.createdAt)}
                </MetaItem>

                <MetaItem
                    isNew={isNew}
                    icon={<Tag className="h-4 w-4" />}
                    label="หมวดหมู่"
                >
                    {getTicketCategoryLabel(ticket.category)}
                </MetaItem>

                {(ticket._count?.comments ?? 0) > 0 ? (
                    <MetaItem
                        isNew={isNew}
                        icon={<MessageSquare className="h-4 w-4" />}
                        label="ความคิดเห็น"
                    >
                        {ticket._count?.comments ?? 0} รายการ
                    </MetaItem>
                ) : (
                    <MetaItem
                        isNew={isNew}
                        icon={<Clock className="h-4 w-4" />}
                        label="สถานะ"
                    >
                        {getTicketStatusLabel(ticket.status)}
                    </MetaItem>
                )}
            </div>

            {/* Assigned To - Full Width */}
            {ticket.assignedTo && (
                <div
                    className={`
                    mt-3 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm
                    ${
                        isNew
                            ? "bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200"
                            : "bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 border border-indigo-100"
                    }
                `}
                >
                    <div
                        className={`
                        p-1.5 rounded-lg
                        ${isNew ? "bg-green-200" : "bg-indigo-100"}
                    `}
                    >
                        <User className="h-4 w-4" />
                    </div>
                    <span className="font-medium">มอบหมายให้:</span>
                    <span>
                        {ticket.assignedTo.employee?.firstName &&
                        ticket.assignedTo.employee?.lastName
                            ? `${ticket.assignedTo.employee.firstName} ${ticket.assignedTo.employee.lastName}`
                            : ticket.assignedTo.name}
                    </span>
                </div>
            )}

            {/* Hover indicator */}
            <div
                className={`
                absolute bottom-0 left-0 right-0 h-1 
                bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500
                transform scale-x-0 group-hover:scale-x-100 
                transition-transform duration-300 origin-left
            `}
            />
        </div>
    );
}

interface MetaItemProps {
    isNew?: boolean;
    icon: React.ReactNode;
    label: string;
    children: React.ReactNode;
}

function MetaItem({ isNew, icon, label, children }: MetaItemProps) {
    return (
        <div
            className={`
            flex flex-col gap-1 p-2.5 rounded-xl transition-colors
            ${
                isNew
                    ? "bg-white/60 border border-blue-200/50 hover:bg-white/80"
                    : "bg-gray-50 border border-gray-100 hover:bg-gray-100"
            }
        `}
        >
            <div
                className={`
                flex items-center gap-1.5 text-xs font-medium
                ${isNew ? "text-blue-600" : "text-gray-500"}
            `}
            >
                {icon}
                <span>{label}</span>
            </div>
            <span
                className={`
                text-sm font-medium truncate
                ${isNew ? "text-blue-900" : "text-gray-900"}
            `}
            >
                {children}
            </span>
        </div>
    );
}
