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
    tone?: "brand" | "light";
    className?: string;
}

interface QrCodeFigureProps {
    tone?: "brand" | "light";
    className?: string;
    imageClassName?: string;
    captionClassName?: string;
}

function QrCodeFigure({
    tone = "brand",
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
            <div
                className={cn(
                    "shrink-0 rounded-xl border p-1.5",
                    tone === "light"
                        ? "border-border-subtle bg-surface-raised"
                        : "border-content-on-brand/25 bg-white",
                )}
            >
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
                    "max-w-full text-center text-xs font-semibold leading-5 [overflow-wrap:anywhere]",
                    tone === "light"
                        ? "text-content-secondary"
                        : "text-dashboard-hero-muted",
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
    tone = "brand",
    className,
}: LineAddFriendCardProps = {}): ReactElement {
    const normalizedAddFriendUrl = addFriendUrl?.trim() || undefined;
    const isLightTone = tone === "light";

    return (
        <section
            aria-labelledby="line-add-friend-heading"
            className={cn(
                "w-full overflow-hidden rounded-2xl border @container",
                isLightTone
                    ? "border-brand-border bg-brand-surface"
                    : "border-content-on-brand/20 bg-content-on-brand/10",
                className,
            )}
        >
            <div className="grid min-w-0 items-center gap-3 p-3 sm:gap-4 sm:p-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex min-w-0 flex-1 items-start gap-3 sm:gap-4">
                    <div
                        className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-xl text-content-on-brand shadow-sm sm:size-10",
                            isLightTone
                                ? "bg-status-success-solid"
                                : "bg-status-success-solid-strong",
                        )}
                        aria-hidden="true"
                    >
                        <MessageCircle className="size-5" strokeWidth={2.5} />
                    </div>

                    <div className="min-w-0 flex-1">
                        <h2
                            id="line-add-friend-heading"
                            className={cn(
                                "text-base font-bold leading-6 tracking-tight [overflow-wrap:anywhere] sm:text-lg",
                                isLightTone
                                    ? "text-content-heading"
                                    : "text-content-on-brand",
                            )}
                        >
                            เพิ่ม NHF ใน LINE
                        </h2>
                        <p
                            className={cn(
                                "mt-1 line-clamp-2 max-w-[28ch] text-xs font-medium leading-5 [overflow-wrap:anywhere] sm:text-sm",
                                isLightTone
                                    ? "text-content-secondary"
                                    : "text-dashboard-hero-muted",
                            )}
                        >
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
                        tone={tone}
                        className="@sm:flex-row @sm:items-center"
                        captionClassName="max-w-[12ch]"
                    />
                </div>

                <details className="group md:hidden">
                    <summary
                        className={cn(
                            "flex min-h-10 list-none items-center justify-between gap-3 rounded-xl border px-3 py-2 text-xs font-bold transition-[background-color,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:text-sm [&::-webkit-details-marker]:hidden",
                            isLightTone
                                ? "border-border-subtle bg-surface-raised text-content-primary hover:border-brand-border hover:bg-brand-surface-strong focus-visible:ring-brand-solid"
                                : "border-content-on-brand/20 bg-content-on-brand/10 text-content-on-brand hover:border-content-on-brand/30 hover:bg-content-on-brand/15 focus-visible:ring-dashboard-focus",
                        )}
                    >
                        <span className="flex min-w-0 items-center gap-2">
                            <QrCode className="size-3.5 shrink-0" aria-hidden="true" />
                            <span className="[overflow-wrap:anywhere]">ดู QR Code</span>
                        </span>
                        <ChevronDown
                            className="size-3.5 shrink-0 transition-transform duration-200 group-open:rotate-180"
                            aria-hidden="true"
                        />
                    </summary>
                    <div
                        className={cn(
                            "mt-3 border-t pt-3",
                            isLightTone
                                ? "border-border-subtle"
                                : "border-content-on-brand/15",
                        )}
                    >
                        <QrCodeFigure
                            tone={tone}
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
