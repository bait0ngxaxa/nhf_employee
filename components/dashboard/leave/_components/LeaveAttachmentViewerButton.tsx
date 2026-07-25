"use client";

import { useState } from "react";
import { Images } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { LeaveAttachmentSummary } from "@/lib/types/leave";
import { cn } from "@/lib/ui/utils";
import { LeaveAttachmentViewerDialog } from "./LeaveAttachmentViewerDialog";

interface LeaveAttachmentViewerButtonProps {
    attachments: LeaveAttachmentSummary[];
    className?: string;
}

export function LeaveAttachmentViewerButton({
    attachments,
    className,
}: LeaveAttachmentViewerButtonProps): React.JSX.Element | null {
    const [open, setOpen] = useState(false);

    if (attachments.length === 0) {
        return null;
    }

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                    "border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:text-indigo-800",
                    className,
                )}
                onClick={() => setOpen(true)}
            >
                <Images className="h-4 w-4" aria-hidden="true" />
                ดูหลักฐาน {attachments.length} รูป
            </Button>
            <LeaveAttachmentViewerDialog
                open={open}
                attachments={attachments}
                onOpenChange={setOpen}
            />
        </>
    );
}
