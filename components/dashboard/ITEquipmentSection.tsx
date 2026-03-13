import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { MonitorSmartphone } from "lucide-react";

export function ITEquipmentSection() {
    return (
        <div className="relative min-h-[calc(100vh-6rem)] bg-slate-50/50 rounded-3xl overflow-hidden border border-white/60 shadow-inner">
            {/* Background Aesthetic Effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(204,251,241,0.6)_0%,transparent_70%)] -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(209,250,229,0.6)_0%,transparent_70%)] translate-y-1/3 -translate-x-1/4" />
            </div>

            <div className="relative z-10 p-4 md:p-8 space-y-8">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700 ease-out">
                    <div className="flex items-center space-x-5">
                        <div className="relative group cursor-default">
                            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-r from-orange-500/40 to-red-500/40 blur-xl opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-[opacity,transform] duration-500 will-change-transform" />
                            <div className="relative flex items-center justify-center w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl shadow-lg shadow-orange-500/25 ring-1 ring-white/20">
                                <MonitorSmartphone className="h-7 w-7 text-white" />
                            </div>
                        </div>
                        <div className="space-y-1">
                            <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 via-gray-800 to-gray-600 pb-1">
                                ครุภัณฑ์ไอที
                            </h2>
                            <p className="text-gray-500 font-medium">จัดการและติดตามครุภัณฑ์ไอที</p>
                        </div>
                    </div>
                </div>

                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-out delay-150">
                    <div className="bg-white/95 rounded-2xl shadow-lg ring-1 ring-gray-200 p-1">
                        <Card className="border-0 shadow-none bg-transparent">
                            <CardHeader className="border-b border-gray-100 bg-gray-50/50 px-6 py-5 rounded-t-2xl">
                                <CardTitle className="text-xl font-bold tracking-tight text-gray-900">ครุภัณฑ์ไอทีของฉัน</CardTitle>
                                <CardDescription className="text-gray-500 mt-1">
                                    รายการครุภัณฑ์ที่ได้รับมอบหมาย
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-6">
                                <p className="text-gray-500 font-medium">กำลังอยู่ในช่วงพัฒนา...</p>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}
