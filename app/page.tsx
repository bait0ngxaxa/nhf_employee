import type { Metadata } from "next";
import Link from "next/link";
import type { ElementType, ReactElement } from "react";
import {
    ArrowRight,
    Building2,
    CheckCircle2,
    ShieldCheck,
    Sparkles,
    UsersRound,
} from "lucide-react";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { AppLogo } from "@/components/brand/AppLogo";
import { getApiAuthSession } from "@/lib/auth/server";
import { APP_ROUTES } from "@/lib/ssot/routes";

export const metadata: Metadata = {
    title: "NHFapp",
    description: "แอปพลิเคชันสำหรับผู้ใช้งาน NHF",
};

interface IntroPoint {
    title: string;
    description: string;
    icon: ElementType;
    cardClassName: string;
    iconClassName: string;
}

const INTRO_POINTS: IntroPoint[] = [
    {
        title: "พื้นที่เดียวขององค์กร",
        description: "จุดเริ่มต้นสำหรับผู้ใช้งาน NHF",
        icon: Building2,
        cardClassName: "bg-blue-50 ring-blue-100",
        iconClassName: "bg-white text-blue-700 ring-1 ring-blue-200",
    },
    {
        title: "เข้าถึงตามบทบาท",
        description: "เหมาะกับผู้ใช้งานในแต่ละบทบาทขององค์กร",
        icon: ShieldCheck,
        cardClassName: "bg-indigo-50 ring-indigo-100",
        iconClassName: "bg-white text-indigo-700 ring-1 ring-indigo-200",
    },
    {
        title: "ใช้งานง่าย",
        description: "หน้าจอเรียบง่าย อ่านสบาย และไม่ซับซ้อนเกินจำเป็น",
        icon: Sparkles,
        cardClassName: "bg-cyan-50 ring-cyan-100",
        iconClassName: "bg-white text-cyan-700 ring-1 ring-cyan-200",
    },
    {
        title: "สำหรับพนักงาน NHF",
        description: "สร้างขึ้นเพื่อรองรับการทำงานร่วมกันของคนในองค์กร",
        icon: UsersRound,
        cardClassName: "bg-slate-50 ring-slate-200",
        iconClassName: "bg-white text-blue-700 ring-1 ring-blue-200",
    },
];

const TRUST_POINTS = [
    "สำหรับผู้ใช้งานของมูลนิธิสาธารณสุขแห่งชาติ",
    "ใช้บัญชีที่ได้รับอนุญาตจากองค์กร",
    "ใช้งานได้ทุกสถานที่ไม่ต้องมี VPN",
] as const;

function BrandMark(): ReactElement {
    return (
        <Link
            href={APP_ROUTES.home}
            className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-4"
            aria-label="NHFapp หน้าแรก"
        >
            <AppLogo variant="navbar" priority />
            <div className="leading-tight">
                <p className="text-base font-bold text-slate-950">NHFapp</p>
                <p className="text-xs font-medium text-slate-600">
                    ระบบงาน NHF
                </p>
            </div>
        </Link>
    );
}

function IntroPointList() {
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {INTRO_POINTS.map((point) => {
                const Icon = point.icon;
                return (
                    <div
                        key={point.title}
                        className={`rounded-xl p-4 ring-1 ${point.cardClassName}`}
                    >
                        <div
                            className={`mb-3 flex h-10 w-10 items-center justify-center rounded-lg ${point.iconClassName}`}
                        >
                            <Icon className="h-5 w-5" aria-hidden="true" />
                        </div>
                        <h3 className="text-base font-bold leading-6 text-slate-950 [overflow-wrap:anywhere]">
                            {point.title}
                        </h3>
                        <p className="mt-1 text-sm font-medium leading-6 text-slate-700 [overflow-wrap:anywhere]">
                            {point.description}
                        </p>
                    </div>
                );
            })}
        </div>
    );
}

function AccessPanel() {
    return (
        <aside className="rounded-2xl border border-gray-200/70 bg-white/90 p-6 text-slate-950 shadow-sm md:p-8">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-sm font-semibold text-blue-700">
                        แอปสำหรับพนักงาน
                    </p>
                    <h2 className="mt-3 text-2xl font-bold leading-tight text-slate-950 text-balance">
                        เริ่มต้นใช้งาน NHFapp
                    </h2>
                </div>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                    <ShieldCheck className="h-5 w-5" aria-hidden="true" />
                </div>
            </div>

            <div className="mt-6 space-y-3">
                {TRUST_POINTS.map((point) => (
                    <div key={point} className="flex gap-3">
                        <CheckCircle2
                            className="mt-0.5 h-5 w-5 shrink-0 text-blue-600"
                            aria-hidden="true"
                        />
                        <p className="text-sm font-medium leading-6 text-slate-700 [overflow-wrap:anywhere]">
                            {point}
                        </p>
                    </div>
                ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Button
                    asChild
                    size="lg"
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:from-blue-700 hover:to-cyan-700"
                >
                    <Link href={APP_ROUTES.login}>
                        เข้าสู่ระบบ
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                </Button>
                <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="rounded-xl border-blue-200 bg-white/80 text-blue-700 hover:bg-blue-50 hover:text-blue-800"
                >
                    <Link href={APP_ROUTES.signup}>ลงทะเบียนบัญชี</Link>
                </Button>
            </div>
        </aside>
    );
}

export default async function Home() {
    const session = await getApiAuthSession();

    if (session) {
        redirect(APP_ROUTES.dashboard);
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 text-slate-950">
            <header className="border-b border-gray-200/50 bg-white/70">
                <div className="mx-auto flex max-w-7xl items-center px-4 py-4 sm:px-6 lg:px-8">
                    <BrandMark />
                </div>
            </header>

            <main
                id="main"
                className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
            >
                <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-12">
                    <div className="min-w-0">
                        <div className="mb-5 flex flex-wrap items-center gap-3">
                            <p className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-800">
                                National Health Foundation
                            </p>
                            <p className="inline-flex rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-slate-700 ring-1 ring-blue-100">
                                สำหรับผู้ใช้งานของ NHF
                            </p>
                        </div>
                        <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight text-slate-950 text-balance sm:text-5xl">
                            National Health Foundation Application
                        </h1>
                        <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-slate-700 sm:text-lg">
                            พื้นที่ดิจิทัลของมูลนิธิสาธารณสุขแห่งชาติ
                            สำหรับเริ่มใช้งานระบบงานของ NHF
                        </p>
                    </div>

                    <AccessPanel />
                </section>

                <section className="mt-12 border-t border-blue-100 pt-8">
                    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                        <div>
                            <h2 className="text-xl font-bold leading-8 text-slate-950">
                                แอปพลิเคชัน NHFapp
                            </h2>
                            <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-slate-600">
                                Single source of truth
                            </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-500">
                            เวอร์ชันสำหรับพนักงานและผู้ดูแลระบบ
                        </p>
                    </div>
                    <IntroPointList />
                </section>
            </main>

            <footer className="border-t border-gray-200/50 bg-white/70">
                <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm font-medium text-slate-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                    <p>© {new Date().getFullYear()} National Health Foundation</p>
                    <p>NHFapp สำหรับผู้ใช้งาน NHF</p>
                </div>
            </footer>
        </div>
    );
}
