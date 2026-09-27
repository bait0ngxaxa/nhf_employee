import Image from "next/image";
import { ChevronDown, ExternalLink, QrCode } from "lucide-react";
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
                        <LineLogoIcon className="size-5" />
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
                            รับการแจ้งเตือนและเข้าใช้บริการของ NHF ผ่าน LINE ได้เลย
                        </p>

                        {normalizedAddFriendUrl ? (
                            <a
                                href={normalizedAddFriendUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label="เพิ่มเพื่อนใน LINE (เปิดในแท็บใหม่)"
                                className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-status-success-solid-strong px-3 py-2 text-xs font-bold text-content-on-brand shadow-sm transition-[background-color,box-shadow,transform] duration-200 hover:bg-status-success-solid-hover hover:shadow-md active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-success-focus focus-visible:ring-offset-2 sm:w-fit sm:text-sm"
                            >
                                <LineLogoIcon className="size-3.5" />
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
