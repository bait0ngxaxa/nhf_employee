import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft } from "lucide-react";
import { type ImportHeaderProps } from "./types";

export function ImportHeader({ onBack }: ImportHeaderProps) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-4">
                <div className="p-3 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-xl shadow-lg shadow-indigo-500/20 text-white">
                    <FileText className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        นำเข้าข้อมูลพนักงานจาก CSV
                    </h2>
                    <p className="text-gray-600">
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
