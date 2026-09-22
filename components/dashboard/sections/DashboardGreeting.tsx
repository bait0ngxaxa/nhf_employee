"use client";

import type { ReactElement } from "react";

const DASHBOARD_TIME_ZONE = "Asia/Bangkok";
const BANGKOK_HOUR_FORMATTER = new Intl.DateTimeFormat("en-GB", {
    timeZone: DASHBOARD_TIME_ZONE,
    hour: "2-digit",
    hourCycle: "h23",
});

export const DEFAULT_GREETING = "สวัสดี";

export function getGreetingForHour(hour: number): string {
    if (hour >= 5 && hour < 12) return "อรุณสวัสดิ์";
    if (hour >= 12 && hour < 17) return "สวัสดียามบ่าย";
    if (hour >= 17 && hour < 22) return "สวัสดีตอนเย็น";
    return "ราตรีสวัสดิ์";
}

export function getBangkokHour(now: Date): number {
    return Number(BANGKOK_HOUR_FORMATTER.format(now));
}

export function getCurrentGreeting(now: Date = new Date()): string {
    return getGreetingForHour(getBangkokHour(now));
}

export function DashboardGreetingFallback(): ReactElement {
    return <>{DEFAULT_GREETING}</>;
}

export default function DashboardGreeting(): ReactElement {
    return <>{getCurrentGreeting()}</>;
}
