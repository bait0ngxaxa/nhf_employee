"use client";

import type { ReactElement } from "react";
import { useTheme } from "next-themes";
import { Toaster } from "sonner";

export function ThemeToaster(): ReactElement {
    const { resolvedTheme } = useTheme();
    const toasterTheme = resolvedTheme === "dark" ? "dark" : "light";

    return (
        <Toaster
            theme={toasterTheme}
            position="top-right"
            richColors
            closeButton
            duration={4000}
            toastOptions={{
                style: {
                    fontFamily:
                        "var(--font-google-sans), ui-sans-serif, system-ui, sans-serif",
                },
            }}
        />
    );
}
