"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Megaphone, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import styles from "./AnnouncementTicker.module.css";

export function AnnouncementTicker({ content }: { content: string | null }): React.ReactElement | null {
    const [paused, setPaused] = useState(false);
    if (!content) return null;

    return (
        <section aria-label="ประกาศ" data-paused={paused} className={`${styles.ticker} min-w-0 rounded-xl border border-status-info-border bg-status-info-surface-strong p-4 text-status-info-strong`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-3 font-semibold"><span className="flex size-9 items-center justify-center rounded-md bg-status-info-solid text-content-on-brand"><Megaphone className="size-5" aria-hidden="true" /></span>ประกาศ</h2>
                <Button variant="ghost" className="text-status-info-strong hover:bg-status-info-border-subtle hover:text-status-info-emphasis focus-visible:ring-status-info-strong" aria-pressed={paused} onClick={() => setPaused(!paused)}>
                    {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                    {paused ? "เลื่อนข้อความต่อ" : "หยุดและอ่านข้อความ"}
                </Button>
            </div>
            <div role="group" aria-label="ข้อความประกาศ" tabIndex={0} className={`${styles.viewport} rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-status-info-strong focus-visible:ring-offset-2`}>
                <div className={styles.track} style={{ "--announcement-duration": `${Math.max(24, content.length * 0.25)}s` } as CSSProperties}>
                    <p className={styles.item} dir="auto">{content}</p>
                    <p className={`${styles.item} ${styles.copy}`} dir="auto" aria-hidden="true">{content}</p>
                </div>
            </div>
        </section>
    );
}
