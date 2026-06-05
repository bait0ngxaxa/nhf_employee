import type { ConfirmAction, ParsedUserAgent } from "./types";

export function formatDateTime(value: string | null): string {
    if (!value) {
        return "ไม่ทราบเวลา";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "ไม่ทราบเวลา";
    }

    return new Intl.DateTimeFormat("th-TH", {
        dateStyle: "medium",
        timeStyle: "short",
    }).format(date);
}

export function formatRelativeTime(value: string | null): string {
    if (!value) {
        return "ไม่ทราบ";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "ไม่ทราบ";
    }

    const diffMs = Date.now() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) {
        return "เมื่อสักครู่";
    }

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
        return `${diffMin} นาทีที่แล้ว`;
    }

    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) {
        return `${diffHr} ชั่วโมงที่แล้ว`;
    }

    const diffDay = Math.floor(diffHr / 24);
    if (diffDay < 30) {
        return `${diffDay} วันที่แล้ว`;
    }

    return formatDateTime(value);
}

function parseBrowserName(userAgent: string): string {
    const browserMatchers: Array<{ pattern: RegExp; name: string }> = [
        { pattern: /SamsungBrowser\/[\d.]+/, name: "Samsung Internet" },
        { pattern: /Brave\/[\d.]+/, name: "Brave" },
        { pattern: /Edg(?:e|A|iOS)?\/[\d.]+/, name: "Microsoft Edge" },
        { pattern: /(?:OPR|Opera)\/[\d.]+/, name: "Opera" },
        { pattern: /(?:Firefox|FxiOS)\/[\d.]+/, name: "Mozilla Firefox" },
        { pattern: /(?:Chrome|CriOS|CriA)\/[\d.]+/, name: "Google Chrome" },
        { pattern: /Chromium\/[\d.]+/, name: "Chromium" },
        { pattern: /Version\/[\d.]+.*Safari/, name: "Safari" },
    ];

    const match = browserMatchers.find((matcher) => matcher.pattern.test(userAgent));

    return match?.name ?? "ไม่ทราบเบราว์เซอร์";
}

export function parseUserAgent(userAgent: string | null): ParsedUserAgent {
    const fallback: ParsedUserAgent = {
        browser: "ไม่ทราบเบราว์เซอร์",
        os: "ไม่ทราบ OS",
        deviceType: "desktop",
    };
    if (!userAgent) {
        return fallback;
    }

    let deviceType: ParsedUserAgent["deviceType"] = "desktop";
    const ua = userAgent;
    const lcUa = ua.toLowerCase();
    if (lcUa.includes("iphone") || (lcUa.includes("android") && lcUa.includes("mobile"))) {
        deviceType = "mobile";
    } else if (lcUa.includes("ipad") || lcUa.includes("tablet") || (lcUa.includes("android") && !lcUa.includes("mobile"))) {
        deviceType = "tablet";
    }

    const browser = parseBrowserName(ua);

    let os = "ไม่ทราบ OS";
    if (ua.includes("Windows NT 10.0")) {
        os = "Windows 10/11";
    } else if (ua.includes("Windows NT 6.3")) {
        os = "Windows 8.1";
    } else if (ua.includes("Windows NT 6.1")) {
        os = "Windows 7";
    } else if (ua.includes("Windows")) {
        os = "Windows";
    } else if (ua.includes("Mac OS X")) {
        const macMatch = ua.match(/Mac OS X ([\d._]+)/);
        os = macMatch ? `macOS ${macMatch[1].replace(/_/g, ".")}` : "macOS";
    } else if (ua.includes("Android")) {
        const androidMatch = ua.match(/Android ([\d.]+)/);
        os = androidMatch ? `Android ${androidMatch[1]}` : "Android";
    } else if (ua.includes("iPhone OS") || ua.includes("iPad")) {
        const iosMatch = ua.match(/(?:iPhone OS|CPU OS) ([\d_]+)/);
        os = iosMatch ? `iOS ${iosMatch[1].replace(/_/g, ".")}` : "iOS";
    } else if (ua.includes("Linux")) {
        os = "Linux";
    } else if (ua.includes("CrOS")) {
        os = "ChromeOS";
    }

    return { browser, os, deviceType };
}

export function getDeviceTypeLabel(deviceType: ParsedUserAgent["deviceType"]): string {
    const labels: Record<ParsedUserAgent["deviceType"], string> = {
        mobile: "มือถือ",
        tablet: "แท็บเล็ต",
        desktop: "คอมพิวเตอร์",
    };

    return labels[deviceType];
}

export function getConfirmTexts(confirmAction: ConfirmAction | null): {
    title: string;
    description: string;
} {
    const title =
        confirmAction?.type === "revoke-session"
            ? "ยืนยันยกเลิกเซสชันนี้?"
            : confirmAction?.type === "signout-current"
              ? "ยืนยันออกจากระบบอุปกรณ์นี้?"
              : "ยืนยันออกจากระบบอุปกรณ์อื่น?";

    const description =
        confirmAction?.type === "revoke-session"
            ? "อุปกรณ์นี้จะต้องเข้าสู่ระบบใหม่อีกครั้ง"
            : confirmAction?.type === "signout-current"
              ? "เซสชันปัจจุบันของคุณจะสิ้นสุดทันที"
              : "ระบบจะออกจากระบบทุกอุปกรณ์อื่นที่ยังใช้งานอยู่";

    return { title, description };
}
