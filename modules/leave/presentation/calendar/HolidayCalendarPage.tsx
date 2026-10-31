"use client";

import { useEffect, useRef, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    calendarYearSchema,
    type ManagedHolidayCalendar,
    type PublishedHolidayCalendar,
} from "../../domain/holiday-calendar";
import { getCurrentLeaveYear } from "../../domain/quota-year";
import { loadHolidayCalendar, saveHolidayCalendar } from "./api";
import { HolidayDraftEditor, HolidayRows } from "./HolidayDraftEditor";
import { CalendarImpactReview } from "./CalendarImpactReview";

export function HolidayCalendarPage({
    isAdmin,
    calendarEnforced = false,
}: {
    isAdmin: boolean;
    calendarEnforced?: boolean;
}): ReactElement {
    const [year, setYear] = useState(getCurrentLeaveYear);
    const [yearInput, setYearInput] = useState(String(year));
    const [reloadKey, setReloadKey] = useState(0);
    const [state, setState] = useState<ManagedHolidayCalendar | PublishedHolidayCalendar | null>(
        null,
    );
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [notice, setNotice] = useState("");
    const inFlight = useRef(false);

    useEffect(() => {
        let current = true;
        const request = isAdmin
            ? loadHolidayCalendar(year, true)
            : loadHolidayCalendar(year, false);
        void request
            .then((next) => {
                if (current) setState(next);
            })
            .catch((cause: unknown) => {
                if (current)
                    setError(cause instanceof Error ? cause.message : "โหลดข้อมูลไม่สำเร็จ");
            });
        return () => {
            current = false;
        };
    }, [year, isAdmin, reloadKey]);

    const managed = state && "versions" in state ? state : null;
    const draft = managed?.versions.find((version) => !version.publishedAt);
    const published = managed?.versions.find(
        (version) => version.number === managed.activeVersionNumber,
    );
    const defaultRevision = published?.defaultDatasetRevision ?? (state && "version" in state ? state.defaultDatasetRevision : undefined);
    const effectiveSource = defaultRevision
        ? (published?.days[0]?.source ?? (state && "source" in state ? state.source : undefined))
        : null;

    async function createDraft(): Promise<void> {
        if (inFlight.current || !managed) return;
        inFlight.current = true;
        setBusy(true);
        setError("");
        try {
            setState(
                await saveHolidayCalendar({
                    action: "create",
                    year,
                    expectedActiveVersion: managed.activeVersionNumber,
                }),
            );
            setNotice("สร้างฉบับร่างแล้ว ยังไม่ส่งผลต่อการคำนวณวันลา");
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "สร้างฉบับร่างไม่สำเร็จ");
        } finally {
            inFlight.current = false;
            setBusy(false);
        }
    }

    return (
        <section
            className="mx-auto max-w-5xl space-y-6 text-content-body"
            aria-labelledby="holiday-heading"
        >
            <header className="space-y-2">
                <h1 id="holiday-heading" className="text-2xl font-bold text-content-heading">
                    ปฏิทินวันหยุดองค์กร
                </h1>
                <p className="max-w-prose text-sm leading-6 text-content-secondary">
                    ใช้ร่วมกันทั้งองค์กร วันเสาร์–อาทิตย์เป็นวันหยุดประจำสัปดาห์
                    รายการด้านล่างคือวันหยุดที่กำหนดเพิ่มเติม
                </p>
            </header>
            {!calendarEnforced && (
                <p
                    role="status"
                    className="rounded-lg bg-status-warning-surface p-4 text-sm text-status-warning-heading"
                >
                    อยู่ระหว่างเตรียมปฏิทิน ระบบยังคิดวันลาตามวันจันทร์–ศุกร์
                    ผู้ดูแลระบบต้องเปิดใช้การคำนวณวันหยุด ค่าเริ่มต้นของปีที่มีข้อมูลพร้อมใช้โดยไม่ต้องเผยแพร่เอง
                </p>
            )}
            <form
                className="flex flex-wrap items-end gap-3"
                onSubmit={(event) => {
                    event.preventDefault();
                    const parsed = calendarYearSchema.safeParse(yearInput);
                    if (!parsed.success) {
                        setError("กรุณาระบุปี ค.ศ. ระหว่าง 1900–9999");
                        return;
                    }
                    setState(null);
                    setError("");
                    if (parsed.data !== year) setYear(parsed.data);
                    else setReloadKey((value) => value + 1);
                    setNotice("");
                }}
            >
                <div className="space-y-2">
                    <label htmlFor="holiday-year" className="text-sm font-medium">
                        ปี ค.ศ.
                    </label>
                    <Input
                        id="holiday-year"
                        type="number"
                        min={1900}
                        max={9999}
                        value={yearInput}
                        disabled={busy}
                        onChange={(event) => setYearInput(event.target.value)}
                    />
                </div>
                <Button type="submit" variant="outline" disabled={busy}>
                    แสดงปีที่เลือก
                </Button>
                <p className="py-2 text-sm text-content-secondary">
                    พ.ศ. {year + 543} / ค.ศ. {year}
                </p>
            </form>
            {error && (
                <p role="alert" className="text-destructive">
                    {error}
                </p>
            )}
            <p role="status" className="text-sm">
                {busy ? "กำลังดำเนินการ…" : notice}
            </p>
            {!state && !error && <p role="status">กำลังโหลดปฏิทิน…</p>}
            {state && (
                <section
                    className="space-y-4 rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-6"
                    aria-labelledby="published-heading"
                >
                    <h2
                        id="published-heading"
                        className="text-lg font-semibold text-content-heading"
                    >
                        {defaultRevision ? "ใช้ปฏิทินค่าเริ่มต้น · ฉบับ " : "ปฏิทิน NHF · ฉบับ "}
                        {managed
                            ? (managed.activeVersionNumber ?? "—")
                            : "version" in state
                              ? (state.version ?? "—")
                              : "—"}
                    </h2>
                    {defaultRevision && (
                        <div className="space-y-2 text-sm text-content-secondary">
                            <p>อ้างอิงวันหยุดทั่วไปของสถาบันการเงินจากธนาคารแห่งประเทศไทย · {defaultRevision}</p>
                            <p>ใช้เป็นค่าเริ่มต้นของ NHF ไม่รวมวันหยุดเฉพาะพื้นที่หรือสถาบัน ADMIN ปรับแต่งได้</p>
                            {effectiveSource && <a className="break-words underline underline-offset-4" href={effectiveSource} target="_blank" rel="noopener noreferrer">ดูประกาศต้นทาง ธปท.</a>}
                        </div>
                    )}
                    {managed ? (
                        published ? (
                            <HolidayRows days={published.days} />
                        ) : (
                            <p>ยังไม่มีปฏิทินที่เผยแพร่สำหรับปีนี้ กรุณาติดต่อผู้ดูแลระบบ</p>
                        )
                    ) : (
                        "version" in state &&
                        (state.version === null ? (
                            <p>ยังไม่มีปฏิทินที่เผยแพร่สำหรับปีนี้ กรุณาติดต่อผู้ดูแลระบบ</p>
                        ) : (
                            <HolidayRows days={state.days} />
                        ))
                    )}
                    {isAdmin && !draft && (
                        <Button disabled={busy} onClick={() => void createDraft()}>
                            {published ? "ปรับแต่งวันหยุด" : "สร้างปฏิทินฉบับร่าง"}
                        </Button>
                    )}
                </section>
            )}
            {managed && draft && (
                <HolidayDraftEditor
                    key={`${year}:${draft.id}:${draft.revision}`}
                    calendar={managed}
                    draft={draft}
                    onSaved={(next, message) => {
                        setState(next);
                        setNotice(message);
                    }}
                />
            )}
            {managed && managed.versions.length > 0 && managed.hasLeaveRequests !== false && (
                <CalendarImpactReview
                    key={`${year}:${managed.activeVersionNumber}:${draft?.revision ?? "published"}`}
                    calendar={managed}
                />
            )}
            {managed && managed.versions.some((version) => version.publishedAt && !version.defaultDatasetRevision) && (
                <details className="space-y-3">
                    <summary
                        id="calendar-history"
                        className="text-lg font-semibold text-content-heading"
                    >
                        ประวัติการเผยแพร่
                    </summary>
                    {managed.versions
                        .filter((version) => version.publishedAt)
                        .map((version) => (
                            <details
                                key={version.id}
                                className="rounded-lg border border-border-subtle bg-surface-raised p-4"
                            >
                                <summary className="cursor-pointer font-medium">
                                    ฉบับ {version.number} ·{" "}
                                    {version.number === managed.activeVersionNumber
                                        ? "เผยแพร่อยู่"
                                        : "ฉบับก่อนหน้า"}{" "}
                                    ·{" "}
                                    {version.publishedAt &&
                                        new Date(version.publishedAt).toLocaleString("th-TH", {
                                            timeZone: "Asia/Bangkok",
                                        })}
                                </summary>
                                <p className="my-3 whitespace-pre-wrap text-sm">
                                    {version.publicationNote}
                                </p>
                                <HolidayRows days={version.days} showReferences />
                            </details>
                        ))}
                </details>
            )}
        </section>
    );
}
