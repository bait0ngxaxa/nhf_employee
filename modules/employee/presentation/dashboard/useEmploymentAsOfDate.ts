"use client";

import { useEffect, useState } from "react";
import { getThailandDateOnly } from "../../domain/tenure";

/** One timer per table, with no polling; hidden tabs catch up on return. */
export function useEmploymentAsOfDate(): string {
    const [day, setDay] = useState(() => getThailandDateOnly(new Date()));

    useEffect(() => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const refresh = (): void => {
            clearTimeout(timer);
            if (document.visibilityState === "hidden") return;

            const now = new Date();
            const today = getThailandDateOnly(now);
            setDay(today);
            // Thailand is UTC+07:00 year-round. Schedule the next calendar day.
            const nextMidnight = Date.parse(`${today}T00:00:00+07:00`) + 86_400_000;
            timer = setTimeout(refresh, Math.max(1, nextMidnight - now.getTime()));
        };

        refresh();
        document.addEventListener("visibilitychange", refresh);
        window.addEventListener("focus", refresh);
        window.addEventListener("pageshow", refresh);
        return (): void => {
            clearTimeout(timer);
            document.removeEventListener("visibilitychange", refresh);
            window.removeEventListener("focus", refresh);
            window.removeEventListener("pageshow", refresh);
        };
    }, []);

    return day;
}
