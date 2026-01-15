"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User } from "lucide-react";

interface CommentAuthor {
    id: number;
    name: string;
    email: string;
    role: string;
    employee?: {
        firstName: string;
        lastName: string;
    };
}

interface CommentItemProps {
    id: number;
    content: string;
    createdAt: string;
    author: CommentAuthor;
    showSeparator?: boolean;
}

export function CommentItem({
    content,
    createdAt,
    author,
    showSeparator = false,
}: CommentItemProps) {
    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString("th-TH", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const authorName =
        author.employee?.firstName && author.employee?.lastName
            ? `${author.employee.firstName} ${author.employee.lastName}`
            : author.name;

    return (
        <div>
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{authorName}</span>
                    {author.role === "ADMIN" && (
                        <Badge variant="secondary" className="text-xs">
                            Admin
                        </Badge>
                    )}
                </div>
                <span className="text-sm text-gray-500">
                    {formatDate(createdAt)}
                </span>
            </div>
            <p className="text-gray-700 whitespace-pre-wrap ml-6">{content}</p>
            {showSeparator && <Separator className="mt-4" />}
        </div>
    );
}
