import { AuthStatus } from "@/components/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Shield, Database, Zap, ArrowRight } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Home() {
    const session = await getServerSession(authOptions);

    // Redirect authenticated users to dashboard on the server
    if (session) {
        redirect("/dashboard");
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-200/50 rounded-full blur-3xl" />
                <div className="absolute top-1/2 -left-40 w-96 h-96 bg-purple-200/40 rounded-full blur-3xl" />
                <div className="absolute bottom-20 right-1/4 w-72 h-72 bg-cyan-200/30 rounded-full blur-3xl" />
            </div>

            {/* Header */}
            <header className="relative z-10 border-b border-gray-200/50 backdrop-blur-sm bg-white/70">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center py-4">
                        <Link
                            href="/"
                            className="flex items-center space-x-3 group rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-4"
                        >
                            <div className="bg-gradient-to-br from-blue-600 to-cyan-500 p-2.5 rounded-xl shadow-md shadow-blue-500/20 group-hover:shadow-blue-500/40 transition duration-300 motion-safe:group-hover:scale-105">
                                <Zap className="h-5 w-5 text-white" />
                            </div>
                            <div className="flex flex-col justify-center">
                                <span className="text-xl font-black tracking-tight text-gray-900 leading-none">
                                    NHF
                                </span>
                                <span className="text-[10px] font-bold tracking-widest text-blue-600 uppercase mt-1">
                                    Workspace
                                </span>
                            </div>
                        </Link>
                        <AuthStatus />
                    </div>
                </div>
            </header>

            {/* Hero Section */}
            <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
                <div className="text-center mb-16 mt-8">
                    <div className="inline-flex items-center px-4 py-2 rounded-full bg-white/60 backdrop-blur-md border border-gray-200/60 shadow-sm mb-8">
                        <span className="flex h-2 w-2 rounded-full bg-blue-600 mr-3 motion-safe:animate-pulse" />
                        <span className="text-sm text-gray-600 font-medium tracking-wide">
                            ระบบสารสนเทศภายในองค์กร
                        </span>
                    </div>
                    <h2 className="text-5xl md:text-7xl font-extrabold tracking-tight text-gray-900 mb-6 leading-[1.15]">
                        National Health Foundation
                        <br />
                        <span className="relative inline-block mt-2">
                            <span className="relative z-10 bg-gradient-to-r from-blue-600 via-cyan-600 to-teal-500 bg-clip-text text-transparent">
                                Platform
                            </span>
                            <span className="absolute -bottom-2 left-0 w-full h-4 bg-blue-100/50 -z-10 rounded-full blur-sm" />
                        </span>
                    </h2>
                    <p className="text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-10 leading-relaxed font-light">
                        แพลตฟอร์มส่วนกลางสำหรับ{" "}
                        <strong>มูลนิธิสาธารณสุขแห่งชาติ</strong>{" "}
                        ในการจัดเก็บข้อมูลพนักงาน แจ้งปัญหา/ซ่อมอุปกรณ์
                        และติดตามสถานะช่วยเหลือ
                    </p>
                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <Button
                            asChild
                            size="lg"
                            className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white px-8 py-6 text-lg rounded-xl shadow-lg shadow-blue-500/25 transition duration-300 motion-safe:hover:scale-105 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                        >
                            <Link href="/login">
                                เข้าสู่ระบบ
                                <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                        </Button>
                    </div>
                </div>

                {/* Hero Card */}
                <div className="relative max-w-4xl mx-auto">
                    {/* Card Glow Effect */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 via-cyan-400 to-purple-400 rounded-3xl blur-lg opacity-20" />

                    {/* Main Card */}
                    <div className="relative bg-white/80 backdrop-blur-xl rounded-3xl p-8 md:p-12 border border-gray-200/50 shadow-xl shadow-gray-200/50">
                        {/* Features Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Feature 1 */}
                            <div className="group text-center md:text-left">
                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-50 to-blue-100 border border-blue-200 mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <Shield className="h-7 w-7 text-blue-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    IT Support Ticket
                                </h3>
                                <p className="text-sm text-gray-600">
                                    แจ้งปัญหาและติดตามสถานะการแก้ไขปัญหาสารสนเทศ
                                </p>
                            </div>

                            {/* Feature 2 */}
                            <div className="group text-center md:text-left">
                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-50 to-teal-100 border border-cyan-200 mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <Database className="h-7 w-7 text-cyan-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    Employee Management
                                </h3>
                                <p className="text-sm text-gray-600">
                                    บันทึกและจัดการข้อมูลพนักงานอย่างเป็นระบบเพื่อเป็น
                                    Single Source of Truth
                                </p>
                            </div>

                            {/* Feature 3 */}
                            <div className="group text-center md:text-left">
                                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-50 to-violet-100 border border-purple-200 mb-4 group-hover:scale-110 transition-transform duration-300">
                                    <Zap className="h-7 w-7 text-purple-600" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                    IT Equipments
                                </h3>
                                <p className="text-sm text-gray-600">
                                    จัดการครุภัณฑ์และอุปกรณ์ไอทีขององค์กร
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="relative z-10 border-t border-gray-200/50 py-6">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <p className="text-center text-sm text-gray-500">
                        &copy; {new Date().getFullYear()} National Health
                        Foundation. All rights reserved.
                    </p>
                </div>
            </footer>
        </div>
    );
}
