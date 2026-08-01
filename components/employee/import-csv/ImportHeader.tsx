import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft } from "lucide-react";
import { type ImportHeaderProps } from "./types";

export function ImportHeader({ onBack }: ImportHeaderProps) {
    return (
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 items-center gap-4">
                <div className="shrink-0">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-700">
                        <FileText className="h-7 w-7 text-content-on-brand" />
                    </div>
                </div>
                <div className="min-w-0 space-y-1">
                    <h1
                        data-page-heading
                        tabIndex={-1}
                        className="text-2xl font-bold tracking-tight text-content-heading [overflow-wrap:anywhere] md:text-3xl"
                    >
                        นำเข้าข้อมูลพนักงานจาก CSV
                    </h1>
                    <p className="text-sm font-medium leading-6 text-content-secondary [overflow-wrap:anywhere]">
                        อัพโหลดไฟล์ CSV เพื่อเพิ่มข้อมูลพนักงานหลายคนพร้อมกัน
                    </p>
                </div>
            </div>
            {onBack && (
                <Button
                    variant="outline"
                    onClick={onBack}
                    className="h-11 w-full justify-center gap-2 rounded-xl border-border-neutral-default bg-surface-raised text-content-neutral-body hover:bg-surface-neutral-subtle sm:w-auto"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>กลับไปรายชื่อ</span>
                </Button>
            )}
        </div>
    );
}
