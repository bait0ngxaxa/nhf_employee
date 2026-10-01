"use client";

import type { ReactElement } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetScrollArea } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { formatThaiDateTime } from "@/lib/helpers/date-helpers";
import type { EmailRequest } from "../../../domain/email-request/contracts";
import { ACCESS_DECISION_LABELS } from "../../../domain/email-request/access-requirements";
import { EmailRequestAccessFields } from "./EmailRequestAccessFields";
import { useEmailRequestAccessEditor } from "./useEmailRequestAccessEditor";

export function EmailRequestDetail({ request: initial, onClose, onSaved }: {
    request: EmailRequest; onClose: () => void; onSaved: () => void;
}): ReactElement {
    const { request, values, editing, saving, error, conflict, setEditing, handleChange, save } = useEmailRequestAccessEditor(initial, onSaved);
    const groups = [
        { title: "ข้อมูลพนักงาน", fields: [["ชื่อไทย", request.thaiName], ["ชื่อเล่น", request.nickname || "—"], ["ชื่ออังกฤษ", request.englishName], ["เบอร์โทร", request.phone]] },
        { title: "ข้อมูลการทำงาน", fields: [["ตำแหน่ง", request.position], ["สังกัด", request.department]] },
        { title: "ข้อมูลคำร้อง", fields: [["อีเมลตอบกลับ", request.replyEmail]] },
        { title: "สิทธิ์การใช้งาน", fields: [["ระบบสารบรรณ", ACCESS_DECISION_LABELS[request.documentSystemDecision]],
            ["Shared Drive", request.sharedDriveDecision === "REQUIRED" ? `ต้องใช้: ${request.sharedDriveAccess.join(", ")}` : ACCESS_DECISION_LABELS[request.sharedDriveDecision]]] },
        { title: "ข้อมูลการส่ง", fields: [["ผู้ส่ง", request.user?.name ?? "—"], ["วันที่ส่ง", formatThaiDateTime(request.createdAt)]] },
    ];
    return (
        <Sheet open onOpenChange={(open) => { if (!open && !saving) onClose(); }}>
            <SheetContent className="w-full sm:max-w-xl" closeButtonLabel="ปิดรายละเอียด"
                onInteractOutside={(event) => { if (saving) event.preventDefault(); }} onEscapeKeyDown={(event) => { if (saving) event.preventDefault(); }}>
                <SheetHeader className="pr-16">
                    <SheetTitle>คำร้องพนักงานใหม่ #{request.id}</SheetTitle>
                    <SheetDescription>ข้อมูลพนักงานและสิทธิ์การใช้งานที่แจ้งทีม IT</SheetDescription>
                </SheetHeader>
                <SheetScrollArea className="space-y-6 px-4 pb-6 [overflow-wrap:anywhere]">
                    {groups.map((group) => (
                        <section key={group.title} className="space-y-3">
                            <h2 className="border-b border-border-subtle pb-2 font-semibold text-content-heading">{group.title}</h2>
                            <dl className="space-y-3 text-sm">
                                {group.fields.map(([label, value]) => (
                                    <div key={label} className="grid min-w-0 gap-1 sm:grid-cols-3 sm:gap-3">
                                        <dt className="text-content-secondary">{label}</dt>
                                        <dd className="min-w-0 sm:col-span-2">{label === "อีเมลตอบกลับ"
                                            ? <a href={`mailto:${value}`} className="text-primary underline underline-offset-4">{value}</a> : value}</dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    ))}
                    {request.canUpdateAccessRequirements && !editing && (
                        <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => setEditing(true)}>แก้ไขสิทธิ์การใช้งาน</Button>
                    )}
                    {editing && (
                        <form onSubmit={(event) => { event.preventDefault(); void save(); }} className="space-y-4" aria-busy={saving}>
                            <h2 className="font-semibold">แก้ไขสิทธิ์การใช้งาน</h2>
                            <EmailRequestAccessFields {...values} selectedDrives={new Set(values.sharedDriveAccess)} disabled={saving || conflict} onChange={handleChange} />
                            <p className="text-sm text-content-secondary">เมื่อสิทธิ์เปลี่ยน ระบบจะแจ้งทีม IT ให้ตรวจสอบการเพิ่มหรือถอนสิทธิ์</p>
                            {error && <p role="alert" className="text-sm text-status-error-foreground">{error}</p>}
                            {conflict && <Button type="button" variant="outline" className="min-h-11 w-full" onClick={() => { onSaved(); onClose(); }}>โหลดรายการล่าสุด แล้วเปิดคำร้องอีกครั้ง</Button>}
                            <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                                <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={() => setEditing(false)}>ยกเลิก</Button>
                                <Button type="submit" className="min-h-11" disabled={saving || conflict}>{saving ? "กำลังบันทึก..." : "บันทึกและแจ้งทีม IT"}</Button>
                            </div>
                        </form>
                    )}
                </SheetScrollArea>
            </SheetContent>
        </Sheet>
    );
}
