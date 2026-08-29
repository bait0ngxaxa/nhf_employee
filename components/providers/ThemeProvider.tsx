"use client";

import type { ComponentProps, ReactElement } from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

type ThemeProviderProps = ComponentProps<typeof NextThemesProvider>;

export function ThemeProvider({
    children,
    ...props
}: ThemeProviderProps): ReactElement {
    return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
