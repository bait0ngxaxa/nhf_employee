"use client";

import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    useDashboardUIContext,
    useDashboardDataContext,
} from "@/components/dashboard/context/dashboard/DashboardContext";

export function DashboardHomeSection() {
    const { user, availableMenuItems } = useDashboardDataContext();
    const { handleMenuClick } = useDashboardUIContext();

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-2xl font-bold text-gray-900">
                    ยินดีต้อนรับ, {user?.name}
                </h2>
                <p className="text-gray-600">ระบบจัดการพนักงาน</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {availableMenuItems.map((item) => {
                    const IconComponent = item.icon;
                    return (
                        <Card
                            key={item.id}
                            className="cursor-pointer bg-white/60 backdrop-blur-md border-gray-100 shadow-lg hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 rounded-2xl group"
                            onClick={() => handleMenuClick(item.id)}
                        >
                            <CardHeader>
                                <div className="flex items-center space-x-4">
                                    <div className="p-3 bg-blue-50 rounded-xl group-hover:bg-blue-100 transition-colors duration-300">
                                        <IconComponent className="h-8 w-8 text-blue-600" />
                                    </div>
                                    <CardTitle className="text-xl group-hover:text-blue-700 transition-colors">
                                        {item.label}
                                    </CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <CardDescription className="text-base">
                                    {item.description}
                                </CardDescription>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>
        </div>
    );
}
