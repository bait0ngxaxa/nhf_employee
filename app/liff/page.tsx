import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { APP_ROUTES } from "@/lib/ssot/routes";

export const metadata: Metadata = {
    title: "บริการผ่าน LINE | NHFapp",
};

export default function Page(): ReactElement {
    return (
        <main
            id="main"
            className="flex min-h-svh items-center bg-surface-subtle pb-[calc(1rem+env(safe-area-inset-bottom))] pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] pt-[calc(1rem+env(safe-area-inset-top))] sm:pb-[calc(1.5rem+env(safe-area-inset-bottom))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pt-[calc(1.5rem+env(safe-area-inset-top))]"
        >
            <div className="mx-auto w-full max-w-lg">
                <Card className="w-full gap-4 rounded-2xl border-brand-border bg-surface-raised p-5 shadow-sm sm:gap-5 sm:p-8">
                    <div className="space-y-2">
                        <h1 className="text-2xl font-bold tracking-tight text-content-heading">
                            บริการ NHFapp ผ่าน LINE
                        </h1>
                        <p className="text-sm leading-6 text-content-secondary">
                            เลือกบริการที่เปิดใช้งานสำหรับบัญชีพนักงานของคุณ
                        </p>
                    </div>
                    <Button
                        asChild
                        className="min-h-12 w-full rounded-xl bg-gradient-to-r from-action-gradient-start to-action-gradient-end text-base font-semibold text-content-on-brand hover:from-action-gradient-hover-start hover:to-action-gradient-hover-end"
                    >
                        <Link href={APP_ROUTES.line.routine}>
                            เปิดงาน Routine ของฉัน
                        </Link>
                    </Button>
                </Card>
            </div>
        </main>
    );
}
