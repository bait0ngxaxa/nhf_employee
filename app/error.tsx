"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { useRouter } from "next/navigation";

interface ErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
    const router = useRouter();

    useEffect(() => {
        // Log error to monitoring service (e.g., Sentry)
        console.error("Application Error:", {
            message: error.message,
            digest: error.digest,
            timestamp: new Date().toISOString(),
        });
    }, [error]);

    return (
        <div className="flex min-h-screen items-center justify-center bg-surface-subtle p-4">
            <Card className="w-full max-w-md rounded-xl border-status-error-border-subtle shadow-none">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-status-error-border bg-status-error-surface-strong">
                        <AlertTriangle className="w-8 h-8 text-status-error-muted" />
                    </div>
                    <CardTitle className="text-xl text-content-neutral-strong">
                        เกิดข้อผิดพลาด
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p className="text-content-neutral-secondary">
                        กรุณาลองอีกครั้ง หากยังพบปัญหา กรุณาติดต่อผู้ดูแลระบบ
                    </p>

                    <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                        <Button
                            onClick={reset}
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            ลองใหม่อีกครั้ง
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => router.push("/")}
                            className="flex items-center gap-2"
                        >
                            <Home className="w-4 h-4" />
                            กลับหน้าหลัก
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
