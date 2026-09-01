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
    className?: string;
}

interface QrCodeFigureProps {
    className?: string;
    imageClassName?: string;
    captionClassName?: string;
}

function QrCodeFigure({
    className,
    imageClassName,
    captionClassName,
}: QrCodeFigureProps): ReactElement {
    return (
        <figure
            className={cn(
                "flex min-w-0 flex-col items-center gap-2",
                className,
            )}
        >
            <div className="shrink-0 rounded-xl border border-content-on-brand/25 bg-white p-1.5">
                <Image
                    src={qrCodeImage}
                    width={360}
                    height={360}
                    sizes="(min-width: 768px) 112px, (min-width: 640px) 160px, 144px"
                    unoptimized
                    alt="QR Code สำหรับเพิ่ม NHF เป็นเพื่อนใน LINE"
                    className={cn("block h-auto w-28", imageClassName)}
                />
            </div>
            <figcaption
                className={cn(
                    "max-w-full text-center text-xs font-semibold leading-5 text-dashboard-hero-muted [overflow-wrap:anywhere]",
                    captionClassName,
                )}
            >
                สแกนเพื่อเพิ่มเพื่อน
            </figcaption>
        </figure>
    );
}

export function LineAddFriendCard({
    addFriendUrl,
    className,
}: LineAddFriendCardProps = {}): ReactElement {
    const normalizedAddFriendUrl = addFriendUrl?.trim() || undefined;

    return (
        <section
            aria-labelledby="line-add-friend-heading"
            className={cn(
                "w-full overflow-hidden rounded-2xl border border-content-on-brand/20 bg-content-on-brand/10 @container",
                className,
            )}
        >
            <div className="grid min-w-0 items-center gap-3 p-3 sm:gap-4 sm:p-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                    <div
                        className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-status-success-solid-strong text-content-on-brand shadow-sm sm:size-10"
                        aria-hidden="true"
                    >
                        <MessageCircle className="size-5" strokeWidth={2.5} />
                    </div>

                    <div className="min-w-0 flex-1">
                        <h2
                            id="line-add-friend-heading"
                            className="text-base font-bold leading-6 tracking-tight text-content-on-brand [overflow-wrap:anywhere] sm:text-lg"
                        >
                            เพิ่ม NHF ใน LINE
                        </h2>
                        <p className="mt-1 line-clamp-2 max-w-[28ch] text-xs font-medium leading-5 text-dashboard-hero-muted [overflow-wrap:anywhere] sm:text-sm">
                            รับการแจ้งเตือนจาก NHF ได้สะดวกขึ้น
                        </p>

                        {normalizedAddFriendUrl ? (
                            <a
                                href={normalizedAddFriendUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="เพิ่มเพื่อนใน LINE (เปิดในแท็บใหม่)"
                                className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-status-success-solid-strong px-3 py-2 text-xs font-bold text-content-on-brand shadow-sm transition-[background-color,box-shadow,transform] duration-200 hover:bg-status-success-solid-hover hover:shadow-md active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success-focus focus-visible:ring-offset-2 sm:w-fit sm:text-sm"
                            >
                                <MessageCircle className="size-3.5" aria-hidden="true" />
                                เพิ่มเพื่อนใน LINE
                                <ExternalLink className="size-3.5" aria-hidden="true" />
                            </a>
                        ) : null}
                    </div>
                </div>

                <div className="hidden shrink-0 md:flex md:justify-end">
                    <QrCodeFigure
                        className="@sm:flex-row @sm:items-center"
                        captionClassName="max-w-[12ch]"
                    />
                </div>

                <details className="group md:hidden">
                    <summary className="flex min-h-10 list-none items-center justify-between gap-3 rounded-xl border border-content-on-brand/20 bg-content-on-brand/10 px-3 py-2 text-xs font-bold text-content-on-brand transition-[background-color,border-color] duration-200 hover:border-content-on-brand/30 hover:bg-content-on-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-focus focus-visible:ring-offset-2 sm:text-sm [&::-webkit-details-marker]:hidden">
                        <span className="flex min-w-0 items-center gap-2">
                            <QrCode className="size-3.5 shrink-0" aria-hidden="true" />
                            <span className="[overflow-wrap:anywhere]">ดู QR Code</span>
                        </span>
                        <ChevronDown
                            className="size-3.5 shrink-0 transition-transform duration-200 group-open:rotate-180"
                            aria-hidden="true"
                        />
                    </summary>
                    <div className="mt-3 border-t border-content-on-brand/15 pt-3">
                        <QrCodeFigure
                            className="flex-col gap-2"
                            imageClassName="w-36 sm:w-40"
                            captionClassName="text-center"
                        />
                    </div>
                </details>
            </div>
        </section>
    );
}
