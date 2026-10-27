"use client";

import Image from "next/image";
import { useEffect, useState, type ReactElement } from "react";
import qrCodeImage from "@/assets/qr/950gaxzt.png";
import { LINE_OA_ID, LINE_OA_ADD_FRIEND_URL } from "@/lib/line/official-account";
import { buildLiffUrl } from "@/lib/line/liff-links";
import { APP_ROUTES } from "@/lib/ssot/routes";
import { cn } from "@/lib/ui/utils";

interface LineAddFriendCardProps {
    tone?: "brand" | "light";
    className?: string;
}

// LINE glyph from Bootstrap Icons (MIT): https://icons.getbootstrap.com/icons/line/
function LineLogoIcon({ className }: { className: string }): ReactElement {
    return (
        <svg
            className={className}
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden="true"
        >
            <path d="M8 0c4.411 0 8 2.912 8 6.492 0 1.433-.555 2.723-1.715 3.994-1.678 1.932-5.431 4.285-6.285 4.645-.83.35-.734-.197-.696-.413l.003-.018.114-.685c.027-.204.055-.521-.026-.723-.09-.223-.444-.339-.704-.395C2.846 12.39 0 9.701 0 6.492 0 2.912 3.59 0 8 0M5.022 7.686H3.497V4.918a.156.156 0 0 0-.155-.156H2.78a.156.156 0 0 0-.156.156v3.486c0 .041.017.08.044.107v.001l.002.002.002.002a.15.15 0 0 0 .108.043h2.242c.086 0 .155-.07.155-.156v-.56a.156.156 0 0 0-.155-.157m.791-2.924a.156.156 0 0 0-.156.156v3.486c0 .086.07.155.156.155h.562c.086 0 .155-.07.155-.155V4.918a.156.156 0 0 0-.155-.156zm3.863 0a.156.156 0 0 0-.156.156v2.07L7.923 4.832l-.013-.015v-.001l-.01-.01-.003-.003-.011-.009h-.001L7.88 4.79l-.003-.002-.005-.003-.008-.005h-.002l-.003-.002-.01-.004-.004-.002-.01-.003h-.002l-.003-.001-.009-.002h-.006l-.003-.001h-.004l-.002-.001h-.574a.156.156 0 0 0-.156.155v3.486c0 .086.07.155.156.155h.56c.087 0 .157-.07.157-.155v-2.07l1.6 2.16a.2.2 0 0 0 .039.038l.001.001.01.006.004.002.008.004.007.003.005.002.01.003h.003a.2.2 0 0 0 .04.006h.56c.087 0 .157-.07.157-.155V4.918a.156.156 0 0 0-.156-.156zm3.815.717v-.56a.156.156 0 0 0-.155-.157h-2.242a.16.16 0 0 0-.108.044h-.001l-.001.002-.002.003a.16.16 0 0 0-.044.107v3.486c0 .041.017.08.044.107l.002.003.002.002a.16.16 0 0 0 .108.043h2.242c.086 0 .155-.07.155-.156v-.56a.156.156 0 0 0-.155-.157H11.81v-.589h1.525c.086 0 .155-.07.155-.156v-.56a.156.156 0 0 0-.155-.157H11.81v-.589h1.525c.086 0 .155-.07.155-.156Z" />
        </svg>
    );
}


export function LineAddFriendCard({ className }: LineAddFriendCardProps = {}): ReactElement {
    const [copyResult, setCopyResult] = useState<"success" | "error" | null>(null);
    const [status, setStatus] = useState<"loading" | "linked" | "unlinked" | "unavailable" | "error">("loading");
    const [retry, setRetry] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        async function loadStatus(): Promise<void> {
            try {
                const response = await fetch("/api/line/account-status", { cache: "no-store", signal: controller.signal });
                if (!response.ok) throw new Error("Status unavailable");
                const data: unknown = await response.json();
                if (typeof data !== "object" || data === null || !("status" in data)) throw new Error("Invalid status");
                const value = data.status;
                if (value !== "linked" && value !== "unlinked" && value !== "unavailable") throw new Error("Invalid status");
                if (!controller.signal.aborted) setStatus(value);
            } catch {
                if (!controller.signal.aborted) setStatus("error");
            }
        }
        void loadStatus();
        return () => controller.abort();
    }, [retry]);
    let liffUrl: string | null = null;
    try {
        liffUrl = buildLiffUrl(APP_ROUTES.line.root);
    } catch {
        // The rest of the dashboard remains available without LIFF configuration.
    }

    async function copyId(): Promise<void> {
        try {
            await navigator.clipboard.writeText(LINE_OA_ID);
            setCopyResult("success");
        } catch {
            setCopyResult("error");
        }
    }

    return (
        <section aria-labelledby="line-add-friend-heading" className={cn("min-w-0 rounded-2xl border border-brand-border bg-surface-raised p-4 sm:p-5", className)}>
            <div className="flex min-w-0 items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-status-success-solid text-content-on-brand">
                    <LineLogoIcon className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                    <h2 id="line-add-friend-heading" className="text-lg font-bold leading-7 text-content-heading">ใช้ NHFapp บนมือถือ ผ่าน LINE ได้ง่ายขึ้น</h2>
                    {status !== "linked" ? <><p className="mt-1 text-sm leading-6 text-content-secondary">ไม่ต้องคอยเปิดเว็บไซต์ เพียงเข้า LINE ก็สามารถเข้าถึงบริการของ NHFapp ที่คุณมีสิทธิ์ใช้งานได้</p>
                    <ul className="mt-3 grid gap-1 text-sm leading-6 text-content-secondary sm:grid-cols-2">
                        <li>• เบิกวัสดุและติดตามคำขอ</li>
                        <li>• ดูข้อมูลและจัดการวันลา</li>
                        <li>• ติดตามงาน Routine</li>
                        <li>• แจ้งปัญหา IT และติดตาม Ticket</li>
                    </ul>
                    <p className="mt-2 text-xs leading-5 text-content-muted">บริการที่ใช้งานได้ขึ้นอยู่กับสิทธิ์ของบัญชีคุณ</p></> : <p className="mt-1 text-xs leading-5 text-content-muted">บริการที่ใช้งานได้ขึ้นอยู่กับสิทธิ์ของบัญชีคุณ</p>}
                    {status === "loading" ? <p className="mt-3 text-sm text-content-secondary" role="status">กำลังตรวจสอบสถานะการเชื่อมบัญชี…</p> : null}
                    {status === "error" ? <div className="mt-3 text-sm text-content-secondary"><p>ไม่สามารถตรวจสอบสถานะได้ กรุณาลองใหม่</p><button type="button" onClick={() => { setStatus("loading"); setRetry((value) => value + 1); }} className="min-h-11 font-semibold underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid">ลองใหม่</button></div> : null}
                    {status === "unavailable" ? <p className="mt-3 text-sm text-content-secondary">บัญชีนี้ยังไม่พร้อมใช้บริการผ่าน LINE</p> : null}
                    {status === "linked" ? <p className="mt-3 text-sm font-semibold text-content-primary">บัญชี NHFapp เชื่อมกับ LINE แล้ว</p> : null}
                    {status === "unlinked" ? <p className="mt-3 text-sm leading-6 text-content-secondary">เพิ่มเพื่อน แล้วเชื่อมบัญชี NHFapp เพียงครั้งเดียวเพื่อใช้บริการ</p> : null}
                    {status === "unlinked" ? <div className="mt-3 flex flex-col gap-2 md:hidden">
                        <a href={LINE_OA_ADD_FRIEND_URL} className="inline-flex min-h-11 items-center justify-center rounded-md bg-status-success-solid-strong px-4 text-sm font-bold text-content-on-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success-focus focus-visible:ring-offset-2">เพิ่มเพื่อนใน LINE</a>
                        {liffUrl ? <a href={liffUrl} className="inline-flex min-h-11 items-center justify-center rounded-md border border-border-subtle px-4 text-sm font-semibold text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid focus-visible:ring-offset-2">เชื่อมบัญชี NHFapp</a> : <p className="text-sm text-content-secondary">บริการเชื่อมบัญชียังไม่พร้อมใช้งาน</p>}
                    </div> : null}
                    {status === "linked" && liffUrl ? <a href={liffUrl} className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-status-success-solid-strong px-4 text-sm font-bold text-content-on-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success-focus focus-visible:ring-offset-2 md:hidden">เปิดบริการ NHFapp ใน LINE</a> : null}
                    {status === "linked" && !liffUrl ? <p className="mt-3 text-sm text-content-secondary">บริการ LINE ยังไม่พร้อมใช้งาน</p> : null}
                </div>
            </div>
            <div className="mt-4 hidden items-center gap-4 border-t border-border-subtle pt-4 md:flex">
                <Image src={qrCodeImage} width={128} height={128} unoptimized alt="QR Code สำหรับเพิ่ม NHF เป็นเพื่อนใน LINE" className="size-32 shrink-0 rounded-md bg-white" />
                <div className="min-w-0 text-sm leading-6 text-content-secondary">
                    <p className="font-bold text-content-primary">สแกน QR Code ด้วย LINE บนมือถือ</p>
                    <p className="mt-1">LINE OA ID: {LINE_OA_ID}</p>
                    <button type="button" onClick={() => void copyId()} className="mt-1 min-h-11 rounded-md border border-border-subtle px-3 font-semibold text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-solid focus-visible:ring-offset-2">คัดลอก ID</button>
                    <p role="status" aria-live="polite" className="text-xs">{copyResult === "success" ? "คัดลอก ID แล้ว" : copyResult === "error" ? "คัดลอกไม่สำเร็จ กรุณาคัดลอก ID ด้วยตนเอง" : ""}</p>
                    <p className="mt-1 text-xs">ใช้ LINE บนคอมพิวเตอร์? ไปที่เพิ่มเพื่อน → ค้นหาด้วย ID → วาง {LINE_OA_ID}</p>
                </div>
            </div>
        </section>
    );
}
