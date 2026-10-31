"use client";

import { useRef, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    holidayDaySchema,
    validateHolidayDays,
    type HolidayDayInput,
    type HolidayVersionView,
    type ManagedHolidayCalendar,
    type PublishedHolidayCalendar,
} from "../../domain/holiday-calendar";
import { saveHolidayCalendar } from "./api";
import { parseHolidayDateList } from "./import";
import { CalendarImpactReview } from "./CalendarImpactReview";

type DisplayDay = PublishedHolidayCalendar["days"][number] &
    Partial<Pick<HolidayDayInput, "source" | "note">>;

export function formatHolidayDate(date: string): string {
    return new Date(`${date}T00:00:00+07:00`).toLocaleDateString("th-TH", {
        dateStyle: "long",
        timeZone: "Asia/Bangkok",
    });
}

export function HolidayRows({
    days,
    showReferences = false,
}: {
    days: readonly DisplayDay[];
    showReferences?: boolean;
}): ReactElement {
    if (days.length === 0)
        return (
            <p className="text-sm text-content-secondary">
                ยืนยันว่าไม่มีวันหยุดองค์กรเพิ่มเติมในฉบับนี้ (ยังคงหยุดเสาร์–อาทิตย์)
            </p>
        );
    return (
        <ul className="divide-y divide-border-subtle">
            {days.map((day) => (
                <li key={day.date} className="space-y-1 py-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-medium">{formatHolidayDate(day.date)}</span>
                        <span className="text-sm text-content-secondary">
                            {day.category === "OFFICIAL" ? "อ้างอิงประกาศทางการ" : "วันหยุดองค์กร"}
                        </span>
                    </div>
                    <p>{day.name}</p>
                    {showReferences && (
                        <>
                            <p className="break-words text-sm text-content-secondary">
                                แหล่งอ้างอิง: {day.source}
                            </p>
                            {day.note && (
                                <p className="whitespace-pre-wrap text-sm">หมายเหตุ: {day.note}</p>
                            )}
                        </>
                    )}
                </li>
            ))}
        </ul>
    );
}

export function HolidayDraftEditor({
    calendar,
    draft,
    onSaved,
}: {
    calendar: ManagedHolidayCalendar;
    draft: HolidayVersionView;
    onSaved: (state: ManagedHolidayCalendar, notice: string) => void;
}): ReactElement {
    const [days, setDays] = useState(draft.days);
    const [entry, setEntry] = useState<HolidayDayInput>({
        date: "",
        name: "",
        category: "OFFICIAL",
        source: "",
        note: "",
    });
    const [editing, setEditing] = useState<string | null>(null);
    const [bulk, setBulk] = useState("");
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);
    const [preview, setPreview] = useState(false);
    const [impactReviewed, setImpactReviewed] = useState(false);
    const [verified, setVerified] = useState(false);
    const [confirmEmpty, setConfirmEmpty] = useState(false);
    const [note, setNote] = useState("");
    const inFlight = useRef(false);
    const dirty = JSON.stringify(days) !== JSON.stringify(draft.days);
    const active = calendar.versions.find(
        (version) => version.number === calendar.activeVersionNumber,
    );
    const added = days.filter((day) => !active?.days.some((old) => old.date === day.date));
    const removed = (active?.days ?? []).filter(
        (day) => !days.some((next) => next.date === day.date),
    );

    function addEntry(): void {
        try {
            const parsed = holidayDaySchema.safeParse(entry);
            if (!parsed.success) throw new Error("กรุณาตรวจวันที่ ชื่อ และแหล่งอ้างอิงให้ครบ");
            const next = [...days.filter((day) => day.date !== editing), parsed.data].sort((a, b) =>
                a.date.localeCompare(b.date),
            );
            validateHolidayDays(calendar.year, next);
            setDays(next);
            setEditing(null);
            setEntry({ date: "", name: "", category: "OFFICIAL", source: "", note: "" });
            setError("");
            setPreview(false);
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "ข้อมูลไม่ถูกต้อง");
        }
    }

    async function persist(publish: boolean): Promise<void> {
        if (inFlight.current) return;
        inFlight.current = true;
        setBusy(true);
        setError("");
        try {
            if (
                publish &&
                (!verified ||
                    !preview ||
                    !impactReviewed ||
                    dirty ||
                    (days.length === 0 && !confirmEmpty))
            )
                throw new Error("กรุณาบันทึก ตรวจสอบรายการและผลกระทบ และยืนยันข้อมูลก่อนเผยแพร่");
            const next = await saveHolidayCalendar(
                publish
                    ? {
                          action: "publish",
                          year: calendar.year,
                          versionId: draft.id,
                          revision: draft.revision,
                          expectedActiveVersion: calendar.activeVersionNumber,
                          verified: true,
                          confirmEmpty,
                          note,
                      }
                    : {
                          action: "save",
                          year: calendar.year,
                          versionId: draft.id,
                          revision: draft.revision,
                          days,
                      },
            );
            onSaved(
                next,
                publish
                    ? "เผยแพร่ปฏิทินแล้ว โควต้าของคำขอเดิมยังไม่เปลี่ยน ต้องตรวจผลกระทบและยืนยันแยกต่างหาก"
                    : "บันทึกฉบับร่างแล้ว กรุณาตรวจสอบก่อนเผยแพร่",
            );
        } catch (cause) {
            setError(
                cause instanceof Error ? cause.message : "บันทึกไม่สำเร็จ กรุณาโหลดข้อมูลใหม่",
            );
        } finally {
            inFlight.current = false;
            setBusy(false);
        }
    }

    return (
        <section
            className="space-y-5 rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-6"
            aria-labelledby="draft-heading"
        >
            <div className="space-y-2">
                <h2 id="draft-heading" className="text-lg font-semibold text-content-heading">
                    ฉบับร่าง {draft.number} · ยังไม่เผยแพร่
                </h2>
                <p className="text-sm text-content-secondary">
                    วันหยุดอ้างอิงจะมีผลเมื่อองค์กรตรวจสอบและเผยแพร่เท่านั้น
                    การบันทึกไม่เปลี่ยนฉบับที่ใช้งานอยู่
                </p>
            </div>
            <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2">
                <legend className="mb-3 font-medium">
                    {editing ? "แก้ไขรายการในฉบับร่าง" : "เพิ่มวันหยุด"}
                </legend>
                <div className="space-y-2">
                    <label htmlFor="holiday-date">วันที่ (ค.ศ.)</label>
                    <Input
                        id="holiday-date"
                        type="date"
                        min={`${calendar.year}-01-01`}
                        max={`${calendar.year}-12-31`}
                        value={entry.date}
                        onChange={(event) => setEntry({ ...entry, date: event.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="holiday-name">ชื่อวันหยุด</label>
                    <Input
                        id="holiday-name"
                        maxLength={200}
                        value={entry.name}
                        onChange={(event) => setEntry({ ...entry, name: event.target.value })}
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor="holiday-category">ประเภท</label>
                    <select
                        id="holiday-category"
                        className="h-11 w-full rounded-md border border-input bg-background px-3"
                        value={entry.category}
                        onChange={(event) =>
                            setEntry({
                                ...entry,
                                category:
                                    event.target.value === "OFFICIAL" ? "OFFICIAL" : "ORGANIZATION",
                            })
                        }
                    >
                        <option value="OFFICIAL">อ้างอิงประกาศทางการ</option>
                        <option value="ORGANIZATION">วันหยุดองค์กร</option>
                    </select>
                </div>
                <div className="space-y-2">
                    <label htmlFor="holiday-source">แหล่งอ้างอิง / เลขที่ประกาศ / URL</label>
                    <Input
                        id="holiday-source"
                        maxLength={1000}
                        value={entry.source}
                        onChange={(event) => setEntry({ ...entry, source: event.target.value })}
                    />
                </div>
                <div className="space-y-2 sm:col-span-2">
                    <label htmlFor="holiday-note">หมายเหตุ (ถ้ามี)</label>
                    <Textarea
                        id="holiday-note"
                        maxLength={1000}
                        value={entry.note ?? ""}
                        onChange={(event) => setEntry({ ...entry, note: event.target.value })}
                    />
                </div>
                <Button type="button" variant="outline" onClick={addEntry}>
                    {editing ? "ใช้การแก้ไขรายการ" : "เพิ่มลงฉบับร่าง"}
                </Button>
            </fieldset>
            <details className="space-y-3">
                <summary className="cursor-pointer font-medium">
                    นำเข้ารายการจากข้อความ (TSV)
                </summary>
                <p id="holiday-bulk-help" className="py-3 text-sm leading-6 text-content-secondary">
                    หนึ่งบรรทัดต่อวัน คั่นด้วย Tab: วันที่ YYYY-MM-DD, ชื่อ, OFFICIAL หรือ
                    ORGANIZATION, แหล่งอ้างอิง, หมายเหตุ (ไม่บังคับ) นำเข้าแล้วต้องตรวจและเผยแพร่เอง
                </p>
                <Textarea
                    aria-label="รายการวันหยุดสำหรับนำเข้า"
                    aria-describedby="holiday-bulk-help"
                    rows={6}
                    maxLength={900000}
                    value={bulk}
                    disabled={busy}
                    onChange={(event) => setBulk(event.target.value)}
                />
                <Button
                    className="mt-3"
                    variant="outline"
                    disabled={busy || !bulk.trim()}
                    onClick={() => {
                        try {
                            const next = [
                                ...days,
                                ...parseHolidayDateList(bulk, calendar.year),
                            ].sort((a, b) => a.date.localeCompare(b.date));
                            validateHolidayDays(calendar.year, next);
                            setDays(next);
                            setBulk("");
                            setPreview(false);
                            setError("");
                        } catch (cause) {
                            setError(cause instanceof Error ? cause.message : "นำเข้าไม่สำเร็จ");
                        }
                    }}
                >
                    ตรวจและเพิ่มรายการนำเข้า
                </Button>
            </details>
            <div className="space-y-3">
                <h3 className="font-medium">รายการฉบับร่าง ({days.length} วัน)</h3>
                {days.length === 0 && <p className="text-sm">ยังไม่มีรายการวันหยุด</p>}
                <ul className="divide-y divide-border-subtle">
                    {days.map((day) => (
                        <li
                            key={day.date}
                            className="flex flex-wrap items-start justify-between gap-3 py-3"
                        >
                            <div className="min-w-0 flex-1 space-y-1">
                                <p className="font-medium">
                                    {formatHolidayDate(day.date)} · {day.name}
                                </p>
                                <p className="break-words text-sm text-content-secondary">
                                    {day.category} · {day.source}
                                </p>
                                {day.note && (
                                    <p className="whitespace-pre-wrap text-sm">{day.note}</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    disabled={busy}
                                    aria-label={`แก้ไข ${day.name}`}
                                    onClick={() => {
                                        setEditing(day.date);
                                        setEntry(day);
                                    }}
                                >
                                    แก้ไข
                                </Button>
                                <Button
                                    variant="outline"
                                    disabled={busy}
                                    aria-label={`ลบ ${day.name}`}
                                    onClick={() => {
                                        setDays(days.filter((item) => item.date !== day.date));
                                        setPreview(false);
                                    }}
                                >
                                    ลบ
                                </Button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
            {error && (
                <p role="alert" className="text-destructive">
                    {error}
                </p>
            )}
            <div className="flex flex-wrap gap-3">
                <Button disabled={busy || !dirty} onClick={() => void persist(false)}>
                    บันทึกฉบับร่าง
                </Button>
                <Button variant="outline" disabled={busy} onClick={() => setPreview(true)}>
                    ตรวจรายการก่อนเผยแพร่
                </Button>
            </div>
            {dirty && (
                <p role="status" className="text-sm">
                    มีการเปลี่ยนแปลงที่ยังไม่ได้บันทึก
                </p>
            )}
            {preview && (
                <div className="space-y-4 border-t border-border-subtle pt-5">
                    <h3 className="font-semibold">
                        ตรวจฉบับร่างเทียบกับฉบับเผยแพร่ {calendar.activeVersionNumber ?? "ยังไม่มี"}
                    </h3>
                    <p className="text-sm">
                        เพิ่ม {added.length} วัน · ลบ {removed.length} วัน
                    </p>
                    {removed.length > 0 && (
                        <div>
                            <h4 className="font-medium">วันหยุดที่จะนำออก</h4>
                            <HolidayRows days={removed} />
                        </div>
                    )}
                    <HolidayRows days={days} showReferences />
                    {!dirty && (
                        <CalendarImpactReview
                            calendar={calendar}
                            autoLoad
                            onReviewed={setImpactReviewed}
                        />
                    )}
                    <label className="flex items-start gap-3 text-sm">
                        <input
                            type="checkbox"
                            className="mt-1 size-5"
                            checked={verified}
                            disabled={busy}
                            onChange={(event) => setVerified(event.target.checked)}
                        />
                        ตรวจสอบวันที่ แหล่งอ้างอิง และยืนยันว่าทุกรายการเป็นวันหยุดขององค์กรแล้ว
                    </label>
                    {days.length === 0 && (
                        <label className="flex items-start gap-3 text-sm">
                            <input
                                type="checkbox"
                                className="mt-1 size-5"
                                checked={confirmEmpty}
                                disabled={busy}
                                onChange={(event) => setConfirmEmpty(event.target.checked)}
                            />
                            ยืนยันว่าปีนี้ไม่มีวันหยุดองค์กรเพิ่มเติม
                        </label>
                    )}
                    <div className="space-y-2">
                        <label htmlFor="calendar-publication-note">เหตุผล / บันทึกการเผยแพร่</label>
                        <Textarea
                            id="calendar-publication-note"
                            maxLength={1000}
                            value={note}
                            disabled={busy}
                            onChange={(event) => setNote(event.target.value)}
                        />
                    </div>
                    <p className="text-sm text-content-secondary">
                        การเผยแพร่ไม่แก้ไขคำขอเดิมและไม่ปรับโควต้าอัตโนมัติ
                    </p>
                    <Button
                        disabled={
                            busy ||
                            dirty ||
                            !impactReviewed ||
                            !verified ||
                            !note.trim() ||
                            (days.length === 0 && !confirmEmpty)
                        }
                        onClick={() => void persist(true)}
                    >
                        ยืนยันเผยแพร่ฉบับ {draft.number}
                    </Button>
                </div>
            )}
        </section>
    );
}
