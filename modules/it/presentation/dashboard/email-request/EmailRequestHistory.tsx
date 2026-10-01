"use client";

import { useState, type ReactElement } from "react";
import type { EmailRequest } from "../../../domain/email-request/contracts";
import { ACCESS_DECISION_LABELS, type AccessDecision } from "../../../domain/email-request/access-requirements";
import { EmailRequestDetail } from "./EmailRequestDetail";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    ChevronLeft,
    ChevronRight,
    AlertCircle,
    RefreshCw,
} from "lucide-react";
import { useEmailRequestHistory } from "./useEmailRequestHistory";
import { formatThaiDateTime } from "@/lib/helpers/date-helpers";
import { useAuth } from "@/modules/auth/client";

function AccessSummary({ request }: { request: EmailRequest }): ReactElement {
    const decision = (label: string, value: AccessDecision): ReactElement => (
        <Badge variant="secondary" className={value === "UNDECIDED" ? "bg-surface-muted text-content-secondary" : ""}>
            {label}: {ACCESS_DECISION_LABELS[value]}
        </Badge>
    );
    return <div className="space-y-2">
        <div>{decision("สารบรรณ", request.documentSystemDecision)}</div>
        <div>{decision("Shared Drive", request.sharedDriveDecision)}</div>
        {request.sharedDriveDecision === "REQUIRED" && <p className="text-sm text-content-secondary [overflow-wrap:anywhere]">{request.sharedDriveAccess.join(", ")}</p>}
    </div>;
}

function EmployeeName({ request }: { request: EmailRequest }): ReactElement {
    return <div className="min-w-0 [overflow-wrap:anywhere]">
        <p className="font-semibold text-content-heading">{request.thaiName}{request.nickname ? ` (${request.nickname})` : ""}</p>
        <p className="text-sm text-content-secondary">{request.englishName}</p>
    </div>;
}

function Contact({ request }: { request: EmailRequest }): ReactElement {
    return <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
        <p><a href={`tel:${request.phone}`} className="text-content-body underline-offset-4 hover:underline">{request.phone}</a></p>
        <a href={`mailto:${request.replyEmail}`} className="text-primary underline-offset-4 hover:underline">{request.replyEmail}</a>
    </div>;
}

export function EmailRequestHistory(): ReactElement | null {
    const { user } = useAuth();
    const [selected, setSelected] = useState<EmailRequest | null>(null);
    const {
        emailRequests,
        pagination,
        isLoading,
        error,
        currentPage,
        setCurrentPage,
        refresh,
    } = useEmailRequestHistory();

    if (!user) {
        return null;
    }

    const refreshIconClassName = isLoading
        ? "mr-2 h-4 w-4 animate-spin"
        : "mr-2 h-4 w-4";

    return (
        <Card className="rounded-xl border-border-subtle bg-surface-raised shadow-none">
            <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                        <CardTitle className="text-xl [overflow-wrap:anywhere]">
                            ประวัติคำร้องพนักงานใหม่
                        </CardTitle>
                        <p className="text-sm leading-6 text-content-secondary [overflow-wrap:anywhere]">
                            รายการคำร้องพนักงานใหม่ที่เคยส่งไปแล้ว
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={refresh}
                        disabled={isLoading}
                        aria-label="รีเฟรชประวัติคำร้องพนักงานใหม่"
                        className="h-11 shrink-0"
                    >
                        <RefreshCw className={refreshIconClassName} />
                        รีเฟรช
                    </Button>
                </div>
            </CardHeader>

            <CardContent>
                {isLoading ? (
                    <div
                        className="space-y-4 py-6"
                        role="status"
                        aria-busy="true"
                        aria-label="กำลังโหลดประวัติคำร้องพนักงานใหม่"
                    >
                        <div className="flex gap-4 border-b border-border pb-4">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <Skeleton key={i} className="h-4 flex-1" />
                            ))}
                        </div>
                        <div className="space-y-4">
                            {Array.from({ length: 4 }).map((_, rowIndex) => (
                                <div key={rowIndex} className="flex items-center gap-4">
                                    {Array.from({ length: 5 }).map((_, colIndex) => (
                                        <Skeleton
                                            key={colIndex}
                                            className="h-12 flex-1"
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center gap-4 rounded-xl border border-status-error-border bg-status-error-surface px-4 py-8 text-center text-status-error-foreground">
                        <AlertCircle className="h-6 w-6 text-status-error-muted" />
                        <p className="max-w-xl text-sm leading-6 [overflow-wrap:anywhere]">
                            {error}
                        </p>
                        <Button
                            type="button"
                            variant="outline"
                            className="border-status-error-border bg-surface-raised text-status-error-foreground hover:bg-status-error-surface"
                            onClick={refresh}
                        >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            โหลดใหม่
                        </Button>
                    </div>
                ) : emailRequests.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border-subtle px-4 py-12 text-center text-sm leading-6 text-content-secondary">
                        ยังไม่มีรายการคำร้อง เมื่อส่งคำร้องแล้วรายการจะแสดงที่นี่
                    </div>
                ) : (
                    <>
                        <div className="hidden overflow-x-auto overscroll-x-contain rounded-lg border border-border-subtle xl:block">
                            <Table className="tabular-nums">
                                <TableHeader><TableRow className="bg-surface-subtle">
                                    {["พนักงาน", "ตำแหน่ง / สังกัด", "ติดต่อ", "สิทธิ์ที่ขอ", "วันที่ส่ง"].map((label) => <TableHead key={label} className="font-semibold">{label}</TableHead>)}
                                    <TableHead><span className="sr-only">การดำเนินการ</span></TableHead>
                                </TableRow></TableHeader>
                                <TableBody>{emailRequests.map((request) => (
                                    <TableRow key={request.id} className="hover:bg-surface-subtle">
                                        <TableCell className="max-w-56 align-top"><EmployeeName request={request} /></TableCell>
                                        <TableCell className="max-w-48 align-top [overflow-wrap:anywhere]"><p>{request.position}</p><p className="text-sm text-content-secondary">{request.department}</p></TableCell>
                                        <TableCell className="max-w-56 align-top"><Contact request={request} /></TableCell>
                                        <TableCell className="max-w-56 align-top"><AccessSummary request={request} /></TableCell>
                                        <TableCell className="align-top text-sm">{formatThaiDateTime(request.createdAt)}</TableCell>
                                        <TableCell className="align-top"><Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setSelected(request)}>ดูรายละเอียด</Button></TableCell>
                                    </TableRow>
                                ))}</TableBody>
                            </Table>
                        </div>
                        <ul aria-label="ประวัติคำร้องพนักงานใหม่สำหรับหน้าจอขนาดเล็ก" className="space-y-3 xl:hidden">
                            {emailRequests.map((request) => (
                                <li key={request.id} className="min-w-0 rounded-lg border border-border-subtle bg-surface-raised p-4">
                                    <EmployeeName request={request} />
                                    <dl className="mt-4 grid min-w-0 gap-4 border-t border-border-subtle pt-3 text-sm sm:grid-cols-2">
                                        <div className="min-w-0"><dt className="text-content-secondary">ตำแหน่ง / สังกัด</dt><dd className="mt-1 [overflow-wrap:anywhere]"><p>{request.position}</p><p>{request.department}</p></dd></div>
                                        <div className="min-w-0"><dt className="text-content-secondary">ติดต่อ</dt><dd className="mt-1"><Contact request={request} /></dd></div>
                                        <div className="min-w-0"><dt className="text-content-secondary">สิทธิ์ที่ขอ</dt><dd className="mt-1"><AccessSummary request={request} /></dd></div>
                                        <div className="min-w-0"><dt className="text-content-secondary">วันที่ส่ง</dt><dd className="mt-1">{formatThaiDateTime(request.createdAt)}</dd></div>
                                    </dl>
                                    <Button type="button" variant="outline" className="mt-4 min-h-11 w-full" onClick={() => setSelected(request)}>ดูรายละเอียด</Button>
                                </li>
                            ))}
                        </ul>

                        {pagination.totalPages > 1 && (
                            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <p className="text-sm text-content-secondary">
                                    แสดง {emailRequests.length.toLocaleString("th-TH")} จาก{" "}
                                    {pagination.total.toLocaleString("th-TH")} รายการ
                                </p>
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage(currentPage - 1)
                                        }
                                        disabled={currentPage <= 1}
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        ก่อนหน้า
                                    </Button>
                                    <span className="text-sm text-content-secondary">
                                        หน้า {currentPage.toLocaleString("th-TH")} /{" "}
                                        {pagination.totalPages.toLocaleString("th-TH")}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            setCurrentPage(currentPage + 1)
                                        }
                                        disabled={
                                            currentPage >= pagination.totalPages
                                        }
                                    >
                                        ถัดไป
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </>
                )}
                {selected && <EmailRequestDetail key={selected.id} request={selected} onClose={() => setSelected(null)} onSaved={refresh} />}
            </CardContent>
        </Card>
    );
}
