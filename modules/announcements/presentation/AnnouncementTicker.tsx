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
        <section aria-label="ประกาศองค์กร" data-paused={paused} className={`${styles.ticker} min-w-0 rounded-xl border border-border-subtle bg-surface-raised p-4 text-content-body`}>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 font-semibold text-brand-strong"><Megaphone className="size-5" aria-hidden="true" />ประกาศองค์กร</h2>
                <Button variant="ghost" aria-pressed={paused} onClick={() => setPaused(!paused)}>
                    {paused ? <Play aria-hidden="true" /> : <Pause aria-hidden="true" />}
                    {paused ? "เลื่อนข้อความต่อ" : "หยุดและอ่านข้อความ"}
                </Button>
            </div>
            <div className={styles.viewport}>
                <div className={styles.track} style={{ "--announcement-duration": `${Math.max(24, content.length * 0.25)}s` } as CSSProperties}>
                    <p className={styles.item} dir="auto">{content}</p>
                    <p className={`${styles.item} ${styles.copy}`} dir="auto" aria-hidden="true">{content}</p>
                </div>
            </div>
        </section>
    );
}
