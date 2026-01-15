import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

export function ITEquipmentSection() {
    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">
                    ครุภัณฑ์ไอที
                </h2>
                <p className="text-gray-600">จัดการและติดตามครุภัณฑ์ไอที</p>
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
