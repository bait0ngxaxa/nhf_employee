"use client";

import dynamic from "next/dynamic";
import type { ReactElement } from "react";

import { ThemeSelectorView } from "./ThemeSelectorView";

const ClientThemeSelector = dynamic(
    () => import("./ThemeSelectorClient"),
    {
        loading: () => <ThemeSelectorFallback />,
        ssr: false,
    },
);

export function ThemeSelectorFallback(): ReactElement {
    return (
        <ThemeSelectorView
            selectedTheme=""
            disabled
        />
    );
}

export function ThemeSelector(): ReactElement {
    return <ClientThemeSelector />;
}
