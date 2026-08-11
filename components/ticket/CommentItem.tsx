"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User } from "lucide-react";
import { formatThaiDateTime } from "@/lib/helpers/date-helpers";
import { getEmployeeBackedUserDisplayName } from "@/lib/helpers/employee-helpers";
import { isAdminRole } from "@/lib/ssot/permissions";

interface CommentAuthor {
    id: number;
    name: string;
    email: string;
    role: string;
    employee?: {
        firstName: string;
        lastName: string;
        nickname?: string | null;
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
    const authorName = getEmployeeBackedUserDisplayName(author);

    return (
        <div>
            <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="font-medium">{authorName}</span>
                    {isAdminRole(author.role) && (
                        <Badge variant="secondary" className="text-xs">
                            Admin
                        </Badge>
                    )}
                </div>
                <span className="text-sm text-content-neutral-muted">
                    {formatThaiDateTime(createdAt)}
                </span>
            </div>
            <p className="text-content-neutral-body whitespace-pre-wrap ml-6">{content}</p>
            {showSeparator && <Separator className="mt-4" />}
        </div>
    );
}
