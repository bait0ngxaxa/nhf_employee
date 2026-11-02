"use client";

import { useEffect, type ReactElement } from "react";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

const THEME_COLORS = {
    light: "#ffffff",
    dark: "#18181b",
} as const;
const DASHBOARD_LIGHT_THEME_COLOR = "#f2f5f9";

export function ThemeColorSync(): ReactElement | null {
    const { resolvedTheme } = useTheme();
    const pathname = usePathname();
    const isDashboardPath =
        pathname === "/dashboard" || pathname.startsWith("/dashboard/");

    useEffect(() => {
        if (resolvedTheme !== "light" && resolvedTheme !== "dark") {
            return;
        }

        const themeColor =
            resolvedTheme === "light" && isDashboardPath
                ? DASHBOARD_LIGHT_THEME_COLOR
                : THEME_COLORS[resolvedTheme];
        document
            .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
            .forEach((element) => element.setAttribute("content", themeColor));
    }, [isDashboardPath, resolvedTheme]);

    return null;
}
