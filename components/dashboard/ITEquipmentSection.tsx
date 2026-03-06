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
        <div className="space-y-6">
            <div className="flex items-start space-x-4">
                <div className="p-3 bg-gradient-to-br from-teal-500 to-emerald-500 rounded-xl shadow-lg shadow-teal-500/20 text-white">
                    <MonitorSmartphone className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-gray-900">
                        ครุภัณฑ์ไอที
                    </h2>
                    <p className="text-gray-600">จัดการและติดตามครุภัณฑ์ไอที</p>
                </div>
            </div>
            <Card>
                <CardHeader>
                    <CardTitle>ครุภัณฑ์ไอทีของฉัน</CardTitle>
                    <CardDescription>
                        รายการครุภัณฑ์ที่ได้รับมอบหมาย
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-700">กำลังอยู่ในช่วงพัฒนา</p>
                </CardContent>
            </Card>
        </div>
    );
}
