"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ANNOUNCEMENT_MAX_LENGTH, announcementContentSchema, type AnnouncementState } from "../domain/contracts";
import { loadManagedAnnouncement, saveAnnouncement } from "./api";

export function AnnouncementManager({ initialState }: { initialState: AnnouncementState }): React.ReactElement {
    const router = useRouter();
    const [state, setState] = useState(initialState);
    const [content, setContent] = useState(initialState.content);
    const [busy, setBusy] = useState(false);
    const inFlight = useRef(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [reloadPending, setReloadPending] = useState(false);
    const valid = announcementContentSchema.safeParse(content).success;

    async function run(action: "save" | "publish" | "unpublish" | "reload"): Promise<void> {
        if (inFlight.current) return;
        inFlight.current = true;
        setBusy(true); setError(""); setNotice("");
        try {
            const next = action === "reload" ? await loadManagedAnnouncement() : await saveAnnouncement(
                action === "unpublish" ? { action, version: state.version } : { action, content, version: state.version },
            );
            setState(next); setContent(next.content); setReloadPending(false);
            setNotice(action === "publish" ? "เผยแพร่ประกาศแล้ว" : action === "unpublish" ? "ยกเลิกการเผยแพร่แล้ว" : action === "reload" ? "โหลดข้อมูลล่าสุดแล้ว" : "บันทึกฉบับร่างแล้ว ประกาศยังไม่แสดงบนหน้าหลัก");
            router.refresh();
        } catch (cause) {
            setError(cause instanceof Error ? cause.message : "ไม่สามารถบันทึกได้ กรุณาลองใหม่");
        } finally {
            inFlight.current = false; setBusy(false);
        }
    }

    return (
        <section aria-labelledby="announcement-heading" className="mx-auto max-w-3xl space-y-6 rounded-xl border border-border-subtle bg-surface-raised p-4 sm:p-6">
            <div className="space-y-2">
                <h1 id="announcement-heading" className="text-2xl font-bold text-content-heading">จัดการประกาศ</h1>
                <p className="text-sm leading-6 text-content-muted">ประกาศเดียวสำหรับพนักงานทุกคนบนหน้าหลัก รองรับข้อความภาษาไทยและอังกฤษ</p>
                <p className="text-sm font-semibold text-content-body">สถานะ: {state.published ? "เผยแพร่แล้ว" : "ยังไม่เผยแพร่"}</p>
                {state.version > 0 && <p className="text-sm text-content-muted">แก้ไขล่าสุด {new Date(state.updatedAt).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>}
            </div>
            <div className="space-y-2">
                <label htmlFor="announcement-content" className="text-sm font-semibold text-content-heading">ข้อความประกาศ</label>
                <Textarea id="announcement-content" rows={6} maxLength={ANNOUNCEMENT_MAX_LENGTH} value={content} disabled={busy}
                    aria-describedby="announcement-help announcement-count" onChange={(event) => setContent(event.target.value)} />
                <div className="flex flex-wrap justify-between gap-2 text-sm text-content-muted">
                    <p id="announcement-help">ข้อความล้วนเท่านั้น การบันทึกฉบับร่างจะซ่อนประกาศที่เผยแพร่อยู่</p>
                    <p id="announcement-count">{content.length}/{ANNOUNCEMENT_MAX_LENGTH} ตัวอักษร</p>
                </div>
            </div>
            <div className="space-y-2">
                <h2 className="font-semibold text-content-heading">ตัวอย่างข้อความ</h2>
                <p className="min-w-0 whitespace-pre-wrap rounded-md bg-surface-subtle p-4 leading-7 text-content-body [overflow-wrap:anywhere]">{content.trim() || "ยังไม่มีข้อความประกาศ"}</p>
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            <p role="status" className="text-sm text-content-body">{busy ? "กำลังดำเนินการ…" : notice}</p>
            <div className="flex flex-wrap gap-3">
                <Button disabled={busy || !valid} onClick={() => void run("publish")}>บันทึกและเผยแพร่</Button>
                <Button variant="outline" disabled={busy || !valid} onClick={() => void run("save")}>บันทึกฉบับร่าง</Button>
                <Button variant="outline" disabled={busy || !state.published} onClick={() => void run("unpublish")}>ยกเลิกเผยแพร่</Button>
                <Button variant="ghost" disabled={busy} onClick={() => setReloadPending(true)}>โหลดข้อมูลล่าสุด</Button>
            </div>
            {reloadPending && <div className="space-y-3 text-sm text-content-body">
                <p>การโหลดใหม่จะแทนที่ข้อความที่ยังไม่ได้บันทึก กรุณาคัดลอกข้อความที่ต้องการเก็บไว้ก่อน</p>
                <div className="flex gap-3"><Button variant="outline" disabled={busy} onClick={() => void run("reload")}>ยืนยันโหลดใหม่</Button><Button variant="ghost" disabled={busy} onClick={() => setReloadPending(false)}>ย้อนกลับ</Button></div>
            </div>}
        </section>
    );
}
