import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";
import {
    ArrowRight,
    CheckCircle2,
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
}

const INTRO_POINTS: IntroPoint[] = [
    {
        title: "พื้นที่เดียวขององค์กร",
        description: "จุดเริ่มต้นสำหรับผู้ใช้งาน NHF",
    },
    {
        title: "เข้าถึงตามบทบาท",
        description: "เหมาะกับผู้ใช้งานในแต่ละบทบาทขององค์กร",
    },
    {
        title: "ใช้งานง่าย",
        description: "หน้าจอเรียบง่าย อ่านสบาย และไม่ซับซ้อนเกินจำเป็น",
    },
    {
        title: "สำหรับพนักงาน NHF",
        description: "สร้างขึ้นเพื่อรองรับการทำงานร่วมกันของคนในองค์กร",
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
            className="flex items-center gap-3 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-foreground focus-visible:ring-offset-4"
            aria-label="NHFapp หน้าแรก"
        >
            <AppLogo variant="navbar" priority />
            <div className="leading-tight">
                <p className="text-base font-bold text-content-heading">NHFapp</p>
                <p className="text-xs font-medium text-content-secondary">
                    ระบบงาน NHF
                </p>
            </div>
        </Link>
    );
}

function IntroPointList() {
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {INTRO_POINTS.map((point) => (
                <div
                    key={point.title}
                    className="border-t border-border-neutral-default/60 pt-3"
                >
                    <h3 className="text-base font-bold leading-6 text-content-heading [overflow-wrap:anywhere]">
                        {point.title}
                    </h3>
                    <p className="mt-1 text-sm font-medium leading-6 text-content-body [overflow-wrap:anywhere]">
                        {point.description}
                    </p>
                </div>
            ))}
        </div>
    );
}

function AccessPanel() {
    return (
        <aside className="rounded-2xl border border-border-neutral-default/70 bg-surface-raised/90 p-6 text-content-heading shadow-sm md:p-8">
            <div>
                <p className="text-sm font-semibold text-action-primary-foreground">
                    แอปสำหรับพนักงาน
                </p>
                <h2 className="mt-3 text-2xl font-bold leading-tight text-content-heading text-balance">
                    เริ่มต้นใช้งาน NHFapp
                </h2>
            </div>

            <div className="mt-6 space-y-3">
                {TRUST_POINTS.map((point) => (
                    <div key={point} className="flex gap-3">
                        <CheckCircle2
                            className="mt-0.5 h-5 w-5 shrink-0 text-action-primary-foreground-muted"
                            aria-hidden="true"
                        />
                        <p className="text-sm font-medium leading-6 text-content-body [overflow-wrap:anywhere]">
                            {point}
                        </p>
                    </div>
                ))}
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:flex-col">
                <Button
                    asChild
                    size="lg"
                    className="rounded-xl bg-gradient-to-r from-action-gradient-start to-action-gradient-end text-content-on-brand hover:from-action-gradient-hover-start hover:to-action-gradient-hover-end"
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
                    className="rounded-xl border-action-primary-border bg-surface-raised/80 text-action-primary-foreground hover:bg-action-primary-surface hover:text-action-primary-strong"
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
        <div className="app-shell-background min-h-screen text-content-heading">
            <header className="border-b border-border-neutral-default/50 bg-surface-raised/70">
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
                            <p className="inline-flex rounded-full bg-action-primary-surface-strong px-3 py-1 text-sm font-bold text-action-primary-strong">
                                National Health Foundation
                            </p>
                            <p className="inline-flex rounded-full bg-surface-raised/80 px-3 py-1 text-sm font-semibold text-content-body ring-1 ring-action-primary-border-subtle">
                                สำหรับผู้ใช้งานของ NHF
                            </p>
                        </div>
                        <h1 className="max-w-4xl text-4xl font-bold leading-tight tracking-tight text-content-heading text-balance sm:text-5xl">
                            National Health Foundation Application
                        </h1>
                        <p className="mt-5 max-w-3xl text-base font-medium leading-8 text-content-body sm:text-lg">
                            พื้นที่ดิจิทัลของมูลนิธิสาธารณสุขแห่งชาติ
                            สำหรับเริ่มใช้งานระบบงานของ NHF
                        </p>
                    </div>

                    <AccessPanel />
                </section>

                <section className="mt-12 border-t border-action-primary-border-subtle pt-8">
                    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
                        <div>
                            <h2 className="text-xl font-bold leading-8 text-content-heading">
                                แอปพลิเคชัน NHFapp
                            </h2>
                            <p className="mt-1 max-w-2xl text-sm font-medium leading-6 text-content-secondary">
                                Single source of truth
                            </p>
                        </div>
                        <p className="text-sm font-semibold text-content-muted">
                            เวอร์ชันสำหรับพนักงานและผู้ดูแลระบบ
                        </p>
                    </div>
                    <IntroPointList />
                </section>
            </main>

            <footer className="border-t border-border-neutral-default/50 bg-surface-raised/70">
                <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-5 text-sm font-medium text-content-secondary sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
                    <p>© {new Date().getFullYear()} National Health Foundation</p>
                    <p>NHFapp สำหรับผู้ใช้งาน NHF</p>
                </div>
            </footer>
        </div>
    );
}
