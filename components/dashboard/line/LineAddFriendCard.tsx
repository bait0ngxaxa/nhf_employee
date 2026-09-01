import Image from "next/image";
import { ChevronDown, ExternalLink, MessageCircle, QrCode } from "lucide-react";
import type { ReactElement } from "react";

import qrCodeImage from "@/assets/qr/950gaxzt.png";
import { cn } from "@/lib/ui/utils";

interface LineAddFriendCardProps {
    /**
     * Pass this only when the value comes from a verified NHF LINE Add Friend
     * configuration. The dashboard intentionally has no fallback URL.
     */
    addFriendUrl?: string | null;
}

interface QrCodeFigureProps {
    className?: string;
}

function QrCodeFigure({ className }: QrCodeFigureProps): ReactElement {
    return (
        <figure className={cn("flex flex-col items-center gap-2", className)}>
            <div className="rounded-xl border border-border-subtle bg-white p-2 shadow-sm">
                <Image
                    src={qrCodeImage}
                    width={360}
                    height={360}
                    sizes="(min-width: 768px) 160px, 144px"
                    unoptimized
                    alt="QR Code สำหรับเพิ่ม NHF เป็นเพื่อนใน LINE"
                    className="block h-auto w-36 sm:w-40"
                />
            </div>
            <figcaption className="text-center text-xs font-semibold leading-5 text-content-secondary">
                สแกน QR Code เพื่อเพิ่มเพื่อน
            </figcaption>
        </figure>
    );
}

export function LineAddFriendCard({
    addFriendUrl,
}: LineAddFriendCardProps = {}): ReactElement {
    const normalizedAddFriendUrl = addFriendUrl?.trim() || undefined;

    return (
        <section
            aria-labelledby="line-add-friend-heading"
            className="overflow-hidden rounded-2xl border border-status-success-border bg-surface-raised shadow-sm sm:rounded-3xl"
        >
            <div className="flex min-w-0 flex-col gap-5 p-4 sm:p-5 md:flex-row md:items-center md:gap-6 md:p-6">
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                    <div
                        className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-status-success-solid-strong text-content-on-brand shadow-sm sm:size-12"
                        aria-hidden="true"
                    >
                        <MessageCircle className="size-6" strokeWidth={2.5} />
                    </div>

                    <div className="min-w-0 flex-1">
                        <h2
                            id="line-add-friend-heading"
                            className="text-xl font-bold leading-7 tracking-tight text-content-heading [overflow-wrap:anywhere] sm:text-2xl"
                        >
                            เพิ่ม NHF เป็นเพื่อนใน LINE
                        </h2>
                        <p className="mt-2 max-w-[58ch] text-sm font-medium leading-6 text-content-body [overflow-wrap:anywhere]">
                            รับการแจ้งเตือนและเข้าใช้งานบริการ NHF ผ่าน LINE ได้สะดวกยิ่งขึ้น
                        </p>

                        {normalizedAddFriendUrl ? (
                            <a
                                href={normalizedAddFriendUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="เพิ่มเพื่อนใน LINE (เปิดในแท็บใหม่)"
                                className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-status-success-solid-strong px-4 py-2.5 text-sm font-bold text-content-on-brand shadow-sm transition-[background-color,box-shadow,transform] duration-200 hover:bg-status-success-solid-hover hover:shadow-md active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success-focus focus-visible:ring-offset-2 sm:w-fit"
                            >
                                <MessageCircle className="size-4" aria-hidden="true" />
                                เพิ่มเพื่อนใน LINE
                                <ExternalLink className="size-4" aria-hidden="true" />
                            </a>
                        ) : null}
                    </div>
                </div>

                <div className="hidden shrink-0 md:flex md:w-48 md:justify-center">
                    <QrCodeFigure />
                </div>

                <details className="group md:hidden">
                    <summary className="flex min-h-11 list-none items-center justify-between gap-3 rounded-xl border border-status-success-border bg-status-success-surface px-4 py-2.5 text-sm font-bold text-status-success-strong transition-[background-color,border-color] duration-200 hover:border-status-success-border-strong hover:bg-status-success-surface-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success-focus focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
                        <span className="flex min-w-0 items-center gap-2">
                            <QrCode className="size-4 shrink-0" aria-hidden="true" />
                            <span className="[overflow-wrap:anywhere]">ดู QR Code</span>
                        </span>
                        <ChevronDown
                            className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
                            aria-hidden="true"
                        />
                    </summary>
                    <div className="mt-4 border-t border-border-subtle pt-4">
                        <QrCodeFigure />
                    </div>
                </details>
            </div>
        </section>
    );
}
