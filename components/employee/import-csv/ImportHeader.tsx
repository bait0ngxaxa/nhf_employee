import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft } from "lucide-react";
import { type ImportHeaderProps } from "./types";

export function ImportHeader({ onBack }: ImportHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-5">
                <div className="relative group cursor-default">
                    <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-teal-500/40 to-cyan-500/40 blur-xl opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-[opacity,transform] duration-500 will-change-transform" />
                    <div className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-br from-teal-500 to-cyan-600 rounded-2xl shadow-lg shadow-teal-500/25 ring-1 ring-white/20">
                        <FileText className="h-7 w-7 text-white" />
                    </div>
                </div>
                <div>
                    <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 pb-1">
                        นำเข้าข้อมูลพนักงานจาก CSV
                    </h2>
                    <p className="text-gray-500 font-medium">
                        อัพโหลดไฟล์ CSV เพื่อเพิ่มข้อมูลพนักงานหลายคนพร้อมกัน
                    </p>
                </div>
            </div>
            {onBack && (
                <Button
                    variant="outline"
                    onClick={onBack}
                    className="flex items-center space-x-2 bg-white hover:bg-gray-50 text-gray-700 border-gray-200 shadow-sm"
                >
                    <ArrowLeft className="h-4 w-4" />
                    <span>กลับไปรายชื่อ</span>
                </Button>
            )}
        </div>
    );
}
