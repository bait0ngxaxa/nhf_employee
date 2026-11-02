import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const themeState = vi.hoisted(() => ({
    pathname: "/dashboard",
    resolvedTheme: "light" as "light" | "dark",
}));

vi.mock("next/navigation", () => ({
    usePathname: () => themeState.pathname,
}));

vi.mock("next-themes", () => ({
    useTheme: () => ({ resolvedTheme: themeState.resolvedTheme }),
}));

import { ThemeColorSync } from "@/components/providers/ThemeColorSync";

describe("ThemeColorSync", () => {
    beforeEach(() => {
        themeState.pathname = "/dashboard";
        themeState.resolvedTheme = "light";
        document.head.innerHTML = [
            '<meta name="theme-color" media="(prefers-color-scheme: light)" content="#f8fafc">',
            '<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#18181b">',
        ].join("");
    });

    it("uses the dashboard canvas for light Dashboard routes", async () => {
        render(<ThemeColorSync />);

        await waitFor(() => {
            expect(getThemeColors()).toEqual(["#f2f5f9", "#f2f5f9"]);
        });
    });

    it("preserves the existing light browser color on Authentication and LIFF routes", async () => {
        const { rerender } = render(<ThemeColorSync />);

        for (const pathname of [
            "/login",
            "/liff/routine",
            "/liff/stock",
            "/liff/leave",
            "/liff/it",
        ]) {
            themeState.pathname = pathname;
            rerender(<ThemeColorSync />);

            await waitFor(() => {
                expect(getThemeColors()).toEqual(["#ffffff", "#ffffff"]);
            });
        }
    });

    it("preserves the existing dark browser color on Dashboard routes", async () => {
        themeState.resolvedTheme = "dark";
        render(<ThemeColorSync />);

        await waitFor(() => {
            expect(getThemeColors()).toEqual(["#18181b", "#18181b"]);
        });
    });
});

function getThemeColors(): string[] {
    return Array.from(
        document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]'),
        (meta) => meta.content,
    );
}
