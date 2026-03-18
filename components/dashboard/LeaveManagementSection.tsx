import { CalendarRange } from "lucide-react";
import { useState, useEffect } from "react";
import { useDashboardDataContext } from "./context/dashboard/DashboardContext";
import { EmployeeLeaveDashboard } from "./leave/EmployeeLeaveDashboard";
import { ManagerApprovalDashboard } from "./leave/ManagerApprovalDashboard";
import { ApproverManagement } from "./leave/ApproverManagement";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LeaveManagementSectionProps {
    defaultTab?: string;
}

export function LeaveManagementSection({ defaultTab = "my-leave" }: LeaveManagementSectionProps) {
    const { user } = useDashboardDataContext();
    const isManager = user?.isManager === true;
    const isAdmin = user?.role === "ADMIN";
    const showApprovalTab = isManager;

    const [activeTab, setActiveTab] = useState(defaultTab);

    // Ensure the tab changes if the user clicks a deep link while already on this page
    useEffect(() => {
        if (defaultTab) {
            setActiveTab(defaultTab);
        }
    }, [defaultTab]);

    return (
        <div className="relative min-h-[calc(100vh-6rem)] bg-slate-50/50 rounded-3xl overflow-hidden border border-white/60 shadow-inner p-4 md:p-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Background Aesthetic Effects */}
            <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
                <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-[radial-gradient(circle_at_center,rgba(199,210,254,0.3)_0%,transparent_70%)] -translate-y-1/2 translate-x-1/3" />
                <div className="absolute bottom-0 left-0 w-[1000px] h-[1000px] bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.15)_0%,transparent_70%)] translate-y-1/3 -translate-x-1/4" />
            </div>

            <div className="relative z-10 space-y-6">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl shadow-sm">
                        <CalendarRange className="h-8 w-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl text-slate-900 font-extrabold pb-1 tracking-tight">
                            ระบบลางาน
                        </h1>
                        <p className="text-gray-500 font-medium mt-1">
                            จัดการวันลาพักผ่อน ลากิจ ลาป่วย
                            และตรวจสอบโควต้าของคุณ
                        </p>
                    </div>
                </div>

                {showApprovalTab || isAdmin ? (
                    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                        <TabsList className="bg-indigo-50 p-1 mb-6 rounded-xl flex max-w-fit">
                            <TabsTrigger
                                value="my-leave"
                                className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm px-4"
                            >
                                วันลาของฉัน
                            </TabsTrigger>
                            {showApprovalTab && (
                                <TabsTrigger
                                    value="approvals"
                                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm px-4"
                                >
                                    อนุมัติการลา
                                </TabsTrigger>
                            )}
                            {isAdmin && (
                                <TabsTrigger
                                    value="approver-settings"
                                    className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-indigo-700 data-[state=active]:shadow-sm px-4"
                                >
                                    จัดการผู้อนุมัติ
                                </TabsTrigger>
                            )}
                        </TabsList>

                        <TabsContent
                            value="my-leave"
                            className="mt-0 outline-none"
                        >
                            <EmployeeLeaveDashboard />
                        </TabsContent>

                        {showApprovalTab && (
                            <TabsContent
                                value="approvals"
                                className="mt-0 outline-none"
                            >
                                <ManagerApprovalDashboard />
                            </TabsContent>
                        )}

                        {isAdmin && (
                            <TabsContent
                                value="approver-settings"
                                className="mt-0 outline-none"
                            >
                                <ApproverManagement />
                            </TabsContent>
                        )}
                    </Tabs>
                ) : (
                    <EmployeeLeaveDashboard />
                )}
            </div>
        </div>
    );
}
