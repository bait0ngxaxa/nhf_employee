"use client";

import { useId, useRef, useState, type ReactElement } from "react";
import { apiPut } from "@/lib/client/api-client";
import { API_ROUTES } from "@/lib/ssot/routes";
import { LIFF_API_REQUEST_OPTIONS } from "@/modules/line/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { leaveSpecialReasonAmendmentSchema } from "../schemas/leave";
import type { HolidayReferenceChannel } from "./holiday-reference-client";

export function PendingSpecialReasonEditor({ leaveId, specialReason, channel, onSuccess }: {
    leaveId: string;
    specialReason: string | null;
    channel: HolidayReferenceChannel;
    onSuccess: () => void | Promise<void>;
}): ReactElement {
    const id = useId();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(specialReason ?? "");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const submitting = useRef(false);
    if (!editing) return <div className="space-y-2"><Button type="button" variant="outline" className="min-h-11" onClick={() => { setValue(specialReason ?? ""); setError(null); setEditing(true); }}>
        {specialReason ? "แก้ไขเหตุผลกรณีลาเกินสิทธิ์" : "เพิ่มเหตุผลกรณีลาเกินสิทธิ์"}
    </Button>{error ? <p role="alert" className="text-sm text-status-danger-strong">{error}</p> : null}</div>;

    return <form className="w-full min-w-0 space-y-3" onSubmit={async (event) => {
        event.preventDefault();
        if (submitting.current) return;
        const parsed = leaveSpecialReasonAmendmentSchema.safeParse({ leaveId, specialReason: value, expectedSpecialReason: specialReason });
        if (!parsed.success) { setError("กรุณาระบุเหตุผลพิเศษ 5–1000 ตัวอักษร"); return; }
        submitting.current = true;
        setBusy(true);
        setError(null);
        try {
            const route = channel === "liff" ? API_ROUTES.line.leaveSpecialReason : API_ROUTES.leave.specialReason;
            const response = await apiPut<unknown>(route, parsed.data, channel === "liff" ? LIFF_API_REQUEST_OPTIONS : {});
            if (!response.success) throw new Error(response.errorThai || response.error || "บันทึกไม่สำเร็จ กรุณาลองใหม่");
            setEditing(false);
            try { await onSuccess(); } catch { setError("บันทึกแล้ว แต่รีเฟรชรายการไม่สำเร็จ กรุณาโหลดหน้าใหม่"); }
        } catch (failure) {
            setError(failure instanceof Error ? failure.message : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
        } finally { submitting.current = false; setBusy(false); }
    }}>
        <Label htmlFor={id}>เหตุผลกรณีลาเกินสิทธิ์</Label>
        <p id={`${id}-help`} className="text-sm leading-6 text-content-secondary">คำขอที่รออนุมัติยังไม่หักสิทธิ์ หากสิทธิ์คงเหลือเปลี่ยนไป ผู้อนุมัติอาจต้องใช้เหตุผลนี้ประกอบการพิจารณา การบันทึกเหตุผลยังไม่ใช่การอนุมัติ</p>
        <Textarea id={id} autoFocus value={value} onChange={(event) => setValue(event.target.value)} minLength={5} maxLength={1000} disabled={busy} aria-describedby={`${id}-help`} aria-invalid={!!error} rows={4} />
        {error ? <p role="alert" className="text-sm text-status-danger-strong">{error}</p> : null}
        <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={busy} className="min-h-11">{busy ? "กำลังบันทึก..." : "บันทึกเหตุผลพิเศษ"}</Button>
            <Button type="button" variant="outline" disabled={busy} className="min-h-11" onClick={() => setEditing(false)}>ยกเลิกการแก้ไข</Button>
        </div>
    </form>;
}
