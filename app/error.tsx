"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";

interface ErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
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
            <Card className="w-full max-w-md border-status-danger-border shadow-sm">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 w-16 h-16 bg-status-danger-surface rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-status-danger-foreground" />
                    </div>
                    <CardTitle className="text-xl text-content-neutral-strong">
                        เกิดข้อผิดพลาด
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p className="text-content-neutral-secondary">
                        ขออภัย เกิดข้อผิดพลาดบางอย่างขึ้น กรุณาลองใหม่อีกครั้ง
                    </p>

                    {process.env.NODE_ENV === "development" && (
                        <div className="bg-status-danger-surface border border-status-danger-border rounded-lg p-3 text-left">
                            <p className="text-xs font-mono text-status-danger-foreground break-all">
                                {error.message}
                            </p>
                        </div>
                    )}

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
                            onClick={() => (window.location.href = "/")}
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
