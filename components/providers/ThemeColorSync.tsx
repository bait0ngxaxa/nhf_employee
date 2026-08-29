"use client";

import { useEffect, type ReactElement } from "react";
import { useTheme } from "next-themes";

const THEME_COLORS = {
    light: "#ffffff",
    dark: "#18181b",
} as const;

export function ThemeColorSync(): ReactElement | null {
    const { resolvedTheme } = useTheme();

    useEffect(() => {
        if (resolvedTheme !== "light" && resolvedTheme !== "dark") {
            return;
        }

        const themeColor = THEME_COLORS[resolvedTheme];
        document
            .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
            .forEach((element) => element.setAttribute("content", themeColor));
    }, [resolvedTheme]);

    return null;
}
