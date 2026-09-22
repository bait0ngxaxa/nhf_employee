"use client";

import type { ReactElement } from "react";
import { useTheme } from "next-themes";

import {
    isThemePreference,
    ThemeSelectorView,
} from "./ThemeSelectorView";

export default function ThemeSelectorClient(): ReactElement {
    const { theme, setTheme } = useTheme();
    const themeCandidate = theme ?? "";
    const selectedTheme = isThemePreference(themeCandidate)
        ? themeCandidate
        : "";

    return (
        <ThemeSelectorView
            selectedTheme={selectedTheme}
            disabled={false}
            onValueChange={(value) => {
                if (isThemePreference(value)) {
                    setTheme(value);
                }
            }}
        />
    );
}
