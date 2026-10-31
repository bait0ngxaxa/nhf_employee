"use client";

import { useEffect, useId, useRef, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ManagedHolidayCalendar } from "../../domain/holiday-calendar";
import type { CalendarImpactReport, CalendarImpactRow } from "../../domain/calendar-reconciliation";
import {
    getLeavePeriodLabel,
    getLeaveTypeLabel,
    formatLeaveDate as formatHolidayDate,
} from "../../application/notifications/notification-format";
import { getLeaveRequestStatusMeta } from "../status-meta";
import { confirmCalendarReconciliation, loadCalendarImpact } from "./api";

const ACTION_LABELS: Record<CalendarImpactRow["action"], string> = {
    CANCEL_AND_RESUBMIT: "เจ้าของต้องยกเลิกและยื่นใหม่ก่อนอนุมัติ",
    RECONCILE: "รอ ADMIN ตรวจและยืนยันปรับโควต้า",
    WAIT_CANCELLATION: "รอพิจารณาการยกเลิกก่อนปรับโควต้า",
    NONE: "ไม่ต้องดำเนินการ",
};

export function CalendarImpactReview({
    calendar,
    autoLoad = false,
    onReviewed,
}: {
    calendar: ManagedHolidayCalendar;
    autoLoad?: boolean;
    onReviewed?: (reviewed: boolean) => void;
}): ReactElement {
    const id = useId();
    const [versionId, setVersionId] = useState(calendar.versions[0]?.id ?? "");
    const [report, setReport] = useState<CalendarImpactReport | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [onlyActionable, setOnlyActionable] = useState(false);
    const inFlight = useRef(false);

    useEffect(() => {
        if (!autoLoad || !versionId) return;
        let current = true;
        void loadCalendarImpact(calendar.year, versionId)
            .then((next) => {
                if (current) {
                    setReport(next);
                    onReviewed?.(true);
                }
            })
            .catch((cause: unknown) => {
                if (current) {
                    setError(cause instanceof Error ? cause.message : "ตรวจผลกระทบไม่สำเร็จ");
                    onReviewed?.(false);
                }
            });
        return () => {
            current = false;
        };
    }, [calendar.year, versionId, autoLoad, onReviewed]);

    async function load(more = false): Promise<void> {
        if (inFlight.current || !versionId) return;
        inFlight.current = true;
        setBusy(true);
        setError("");
        try {
            const next = await loadCalendarImpact(
                calendar.year,
                versionId,
                more ? (report?.nextCursor ?? undefined) : undefined,
            );
            if (
                more &&
                report &&
                (next.activeVersionId !== report.activeVersionId ||
                    next.proposedRevision !== report.proposedRevision)
            )
                throw new Error("ปฏิทินเปลี่ยนระหว่างโหลด กรุณาตรวจผลกระทบใหม่ตั้งแต่หน้าแรก");
            setReport(more && report ? { ...next, rows: [...report.rows, ...next.rows] } : next);
            onReviewed?.(true);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "ตรวจผลกระทบไม่สำเร็จ");
        } finally {
            inFlight.current = false;
            setBusy(false);
        }
    }

    return (
        <section
            aria-labelledby={`${id}-heading`}
            className="space-y-5 rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-6"
        >
            <div className="space-y-2">
                <h2 id={`${id}-heading`} className="text-lg font-semibold text-content-heading">
                    ตรวจผลกระทบและปรับโควต้า
                </h2>
                <p className="max-w-prose text-sm leading-6 text-content-secondary">
                    ตรวจได้ทั้งฉบับร่างก่อนเผยแพร่และฉบับที่ใช้อยู่ การเผยแพร่ไม่ปรับโควต้าเดิม
                    ต้องยืนยันทีละคำขอ พร้อมเหตุผลและประวัติที่ตรวจสอบย้อนหลังได้
                </p>
            </div>
            <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-0 flex-1 space-y-2">
                    <label htmlFor={`${id}-version`}>ฉบับที่ต้องการตรวจ</label>
                    <select
                        id={`${id}-version`}
                        className="h-11 w-full rounded-md border border-input bg-background px-3"
                        disabled={busy || autoLoad}
                        value={versionId}
                        onChange={(event) => {
                            setVersionId(event.target.value);
                            setReport(null);
                            setNotice("");
                        }}
                    >
                        {calendar.versions.map((version) => (
                            <option key={version.id} value={version.id}>
                                ฉบับ {version.number} ·{" "}
                                {!version.publishedAt
                                    ? "ฉบับร่าง"
                                    : version.number === calendar.activeVersionNumber
                                      ? "เผยแพร่อยู่"
                                      : "ฉบับก่อนหน้า"}
                            </option>
                        ))}
                    </select>
                </div>
                <Button variant="outline" disabled={busy || !versionId} onClick={() => void load()}>
                    ตรวจผลกระทบใหม่
                </Button>
            </div>
            {error && (
                <p role="alert" className="text-destructive">
                    {error}
                </p>
            )}
            <p role="status" className="text-sm">
                {busy ? "กำลังตรวจผลกระทบ…" : notice}
            </p>
            {report && (
                <>
                    <p className="text-sm">
                        ปี พ.ศ. {report.year + 543} · ฉบับใช้งาน{" "}
                        {report.activeVersion ?? "ยังไม่มี"} → ตรวจฉบับ {report.proposedVersion}{" "}
                        {!report.proposedPublished && "(ฉบับร่าง)"}
                    </p>
                    <div className="grid gap-4 text-sm sm:grid-cols-2">
                        <div>
                            <h3 className="font-medium">
                                เพิ่มวันหยุด ({report.addedHolidays.length})
                            </h3>
                            <p className="leading-6">
                                {report.addedHolidays.map(formatHolidayDate).join(" · ") || "ไม่มี"}
                            </p>
                        </div>
                        <div>
                            <h3 className="font-medium">
                                นำวันหยุดออก ({report.removedHolidays.length})
                            </h3>
                            <p className="leading-6">
                                {report.removedHolidays.map(formatHolidayDate).join(" · ") ||
                                    "ไม่มี"}
                            </p>
                        </div>
                    </div>
                    <label className="flex items-center gap-3 text-sm">
                        <input
                            type="checkbox"
                            className="size-5"
                            checked={onlyActionable}
                            onChange={(event) => setOnlyActionable(event.target.checked)}
                        />
                        แสดงเฉพาะคำขอที่ต้องดำเนินการในหน้าที่โหลดแล้ว
                    </label>
                    {report.rows.length === 0 && <p>ไม่พบคำขอลาในปีนี้</p>}
                    <div className="divide-y divide-border-subtle">
                        {report.rows
                            .filter((row) => !onlyActionable || row.action !== "NONE")
                            .map((row) => (
                                <article key={row.id} className="space-y-3 py-5">
                                    <div className="flex flex-wrap justify-between gap-2">
                                        <h3 className="font-semibold">
                                            {row.employeeName} · {getLeaveTypeLabel(row.leaveType)}
                                        </h3>
                                        <span className="text-sm">
                                            {getLeaveRequestStatusMeta(row.status).label}
                                        </span>
                                    </div>
                                    <p className="text-sm">
                                        {formatHolidayDate(row.startDate)} –{" "}
                                        {formatHolidayDate(row.endDate)} ·{" "}
                                        {getLeavePeriodLabel(row.period)}
                                    </p>
                                    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                                        <div>
                                            <dt className="text-content-secondary">
                                                ระยะเวลาคำขอเดิม
                                            </dt>
                                            <dd className="font-medium tabular-nums">
                                                {row.originalDurationHalfDays / 2} วัน
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-content-secondary">
                                                หักโควต้าอยู่จริง
                                            </dt>
                                            <dd className="font-medium tabular-nums">
                                                {row.chargedHalfDays / 2} วัน
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-content-secondary">
                                                ยอดหักที่เสนอ
                                            </dt>
                                            <dd className="font-medium tabular-nums">
                                                {row.proposedChargeHalfDays / 2} วัน
                                            </dd>
                                        </div>
                                        <div>
                                            <dt className="text-content-secondary">ผลต่าง</dt>
                                            <dd className="font-medium tabular-nums">
                                                {row.differenceHalfDays > 0 ? "+" : ""}
                                                {row.differenceHalfDays / 2} วัน
                                            </dd>
                                        </div>
                                    </dl>
                                    <p className="text-sm font-medium">
                                        {ACTION_LABELS[row.action]}
                                    </p>
                                    {row.status === "PENDING" && (
                                        <p className="text-sm text-content-secondary">
                                            ระยะเวลาตามฉบับที่ตรวจ:{" "}
                                            {row.proposedDurationHalfDays / 2} วัน · ยังไม่หักโควต้า
                                        </p>
                                    )}
                                    {!row.validForNewRequest && (
                                        <p className="text-sm text-content-secondary">
                                            ช่วงนี้ไม่ถูกต้องสำหรับคำขอใหม่ตามปฏิทินที่ตรวจ
                                            รายละเอียดคำขอเดิมยังคงเดิม
                                        </p>
                                    )}
                                    {row.action === "RECONCILE" &&
                                        report.proposedPublished &&
                                        report.proposedVersionId === report.activeVersionId && (
                                            <ReconcileRequestForm
                                                key={`${row.id}:${row.chargedHalfDays}:${report.activeVersionId}`}
                                                row={row}
                                                report={report}
                                                onApplied={async () => {
                                                    setNotice(
                                                        "ปรับโควต้าคำขอนี้สำเร็จแล้ว พร้อมคำนวณยอดยกไปปีถัดไป",
                                                    );
                                                    await load();
                                                }}
                                            />
                                        )}
                                    {row.action === "RECONCILE" &&
                                        report.proposedVersionId !== report.activeVersionId && (
                                            <p className="text-sm text-content-secondary">
                                                ยืนยันปรับโควต้าได้เฉพาะฉบับที่เผยแพร่อยู่
                                                กรุณาเผยแพร่และตรวจใหม่ก่อนยืนยัน
                                            </p>
                                        )}
                                    <details>
                                        <summary className="cursor-pointer text-sm font-medium">
                                            ประวัติการปรับ ({row.adjustments.length}) และฉบับอ้างอิง
                                        </summary>
                                        <p className="mt-3 break-all text-xs text-content-secondary">
                                            ฉบับที่คำนวณคำขอ:{" "}
                                            {row.calculationCalendarVersionId ??
                                                "ข้อมูลเดิม / ช่วงเตรียมปฏิทิน"}{" "}
                                            · ฉบับที่อนุมัติ:{" "}
                                            {row.approvalCalendarVersionId ??
                                                "ข้อมูลเดิม / ช่วงเตรียมปฏิทิน"}
                                        </p>
                                        <ul className="mt-3 space-y-3">
                                            {row.adjustments.map((adjustment) => (
                                                <li key={adjustment.id} className="text-sm">
                                                    <p>
                                                        ฉบับ {adjustment.calendarVersion}:{" "}
                                                        {adjustment.previousHalfDays / 2} →{" "}
                                                        {adjustment.resultingHalfDays / 2} วัน ·{" "}
                                                        {adjustment.administratorName} (User{" "}
                                                        {adjustment.administratorId})
                                                    </p>
                                                    <p>
                                                        {new Date(
                                                            adjustment.createdAt,
                                                        ).toLocaleString("th-TH", {
                                                            timeZone: "Asia/Bangkok",
                                                        })}{" "}
                                                        · {adjustment.reason}
                                                    </p>
                                                    {adjustment.overQuotaJustification && (
                                                        <p>
                                                            เหตุผลพิเศษ:{" "}
                                                            {adjustment.overQuotaJustification}
                                                        </p>
                                                    )}
                                                </li>
                                            ))}
                                        </ul>
                                    </details>
                                </article>
                            ))}
                    </div>
                    {report.nextCursor && (
                        <Button variant="outline" disabled={busy} onClick={() => void load(true)}>
                            โหลดคำขอถัดไป
                        </Button>
                    )}
                </>
            )}
        </section>
    );
}

function ReconcileRequestForm({
    row,
    report,
    onApplied,
}: {
    row: CalendarImpactRow;
    report: CalendarImpactReport;
    onApplied: () => Promise<void>;
}): ReactElement {
    const [reason, setReason] = useState("");
    const [special, setSpecial] = useState("");
    const [confirmed, setConfirmed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const inFlight = useRef(false);

    async function submit(): Promise<void> {
        if (inFlight.current || !confirmed || reason.trim().length < 5) return;
        inFlight.current = true;
        setBusy(true);
        setError("");
        try {
            await confirmCalendarReconciliation({
                year: report.year,
                leaveRequestId: row.id,
                calendarVersionId: report.proposedVersionId,
                expectedChargeHalfDays: row.chargedHalfDays,
                reason,
                ...(special.trim() ? { overQuotaJustification: special } : {}),
                confirmed: true,
            });
            await onApplied();
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : "ปรับโควต้าไม่สำเร็จ กรุณาตรวจผลกระทบใหม่",
            );
        } finally {
            inFlight.current = false;
            setBusy(false);
        }
    }

    return (
        <details className="rounded-lg bg-surface-subtle p-4">
            <summary className="cursor-pointer text-sm font-medium">
                ตรวจและยืนยันปรับโควต้าคำขอนี้
            </summary>
            <form
                className="mt-4 space-y-4"
                onSubmit={(event) => {
                    event.preventDefault();
                    void submit();
                }}
            >
                <div className="space-y-2">
                    <label htmlFor={`reconcile-reason-${row.id}`} className="text-sm">
                        เหตุผลการปรับโควต้า (อย่างน้อย 5 ตัวอักษร)
                    </label>
                    <Textarea
                        id={`reconcile-reason-${row.id}`}
                        disabled={busy}
                        maxLength={1000}
                        required
                        value={reason}
                        onChange={(event) => setReason(event.target.value)}
                    />
                </div>
                {row.differenceHalfDays > 0 && (
                    <div className="space-y-2">
                        <label htmlFor={`reconcile-special-${row.id}`} className="text-sm">
                            เหตุผลพิเศษกรณีเพิ่มการใช้เกินสิทธิ์ในปีนี้หรือปีถัดไป
                        </label>
                        <Textarea
                            id={`reconcile-special-${row.id}`}
                            disabled={busy}
                            maxLength={1000}
                            value={special}
                            onChange={(event) => setSpecial(event.target.value)}
                        />
                        <p className="text-xs text-content-secondary">
                            ระบบจะตรวจยอดปีปัจจุบันและยอดยกไปปีถัดไปก่อนบันทึก
                        </p>
                    </div>
                )}
                <label className="flex items-start gap-3 text-sm">
                    <input
                        type="checkbox"
                        className="mt-1 size-5"
                        disabled={busy}
                        checked={confirmed}
                        onChange={(event) => setConfirmed(event.target.checked)}
                    />
                    ยืนยันปรับจาก {row.chargedHalfDays / 2} เป็น {row.proposedChargeHalfDays / 2}{" "}
                    วัน โดยคงรายละเอียดคำขอเดิม
                </label>
                {error && (
                    <p role="alert" className="text-sm text-destructive">
                        {error}
                    </p>
                )}
                <Button
                    type="submit"
                    disabled={
                        busy ||
                        !confirmed ||
                        reason.trim().length < 5 ||
                        (special.trim().length > 0 && special.trim().length < 5)
                    }
                >
                    {busy ? "กำลังบันทึก…" : "ยืนยันปรับโควต้าเฉพาะคำขอนี้"}
                </Button>
            </form>
        </details>
    );
}
