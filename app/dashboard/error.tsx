"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

interface ErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
    const router = useRouter();

    useEffect(() => {
        console.error("Dashboard Error:", {
            message: error.message,
            digest: error.digest,
            timestamp: new Date().toISOString(),
            location: "dashboard",
        });
    }, [error]);

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <Card className="w-full max-w-md border-status-attention-border-subtle shadow-sm">
                <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-4 w-14 h-14 bg-status-attention-surface-strong rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-7 h-7 text-status-attention-icon" />
                    </div>
                    <CardTitle className="text-lg text-content-neutral-strong">
                        ไม่สามารถโหลดข้อมูลได้
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-center space-y-4">
                    <p className="text-sm text-content-neutral-secondary">
                        เกิดข้อผิดพลาดในการโหลดข้อมูล Dashboard
                    </p>

                    {process.env.NODE_ENV === "development" && (
                        <div className="bg-status-attention-surface border border-status-attention-border rounded-lg p-2 text-left">
                            <p className="text-xs font-mono text-status-attention-foreground break-all">
                                {error.message}
                            </p>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                        <Button
                            size="sm"
                            onClick={reset}
                            className="flex items-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            ลองใหม่
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push("/")}
                            className="flex items-center gap-2"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            กลับหน้าแรก
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
