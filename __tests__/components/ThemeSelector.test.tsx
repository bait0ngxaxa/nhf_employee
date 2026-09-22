import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    ThemeSelector,
    ThemeSelectorFallback,
} from "@/components/theme/ThemeSelector";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const themeMock = vi.hoisted(() => ({
    theme: "light",
    setTheme: vi.fn(),
}));

vi.mock("next-themes", () => ({
    useTheme: () => themeMock,
}));

function renderThemeSelector(selector: ReactElement = <ThemeSelector />): void {
    render(
        <DropdownMenu defaultOpen>
            <DropdownMenuTrigger>เปิดเมนูธีม</DropdownMenuTrigger>
            <DropdownMenuContent>
                {selector}
            </DropdownMenuContent>
        </DropdownMenu>,
    );
}

describe("ThemeSelector", () => {
    beforeEach(() => {
        themeMock.theme = "light";
        themeMock.setTheme.mockReset();
    });

    it("keeps the hydration-safe fallback unselected and unable to mutate the theme", () => {
        renderThemeSelector(<ThemeSelectorFallback />);

        const options = screen.getAllByRole("menuitemradio");
        expect(options).toHaveLength(3);
        options.forEach((option) => expect(option).toHaveAttribute("aria-disabled", "true"));
        expect(options.every((option) => option.getAttribute("data-state") !== "checked"))
            .toBe(true);

        fireEvent.click(options[0]);

        expect(themeMock.setTheme).not.toHaveBeenCalled();
    });

    it("shows every supported preference and marks the current theme", async () => {
        renderThemeSelector();

        await waitFor(() => {
            expect(screen.getByRole("menuitemradio", {
                name: "ใช้ธีมตามระบบ",
            })).not.toHaveAttribute("aria-disabled", "true");
        });

        const systemOption = screen.getByRole("menuitemradio", {
            name: "ใช้ธีมตามระบบ",
        });
        const lightOption = screen.getByRole("menuitemradio", {
            name: "ใช้ธีมสว่าง",
        });
        const darkOption = screen.getByRole("menuitemradio", {
            name: "ใช้ธีมมืด",
        });

        expect(systemOption).not.toHaveAttribute("aria-disabled", "true");
        expect(lightOption).toHaveAttribute("data-state", "checked");
        expect(darkOption).toHaveAttribute("data-state", "unchecked");
    });

    it.each([
        ["ใช้ธีมตามระบบ", "system", "light"],
        ["ใช้ธีมสว่าง", "light", "dark"],
        ["ใช้ธีมมืด", "dark", "light"],
    ])("updates next-themes when the user chooses %s", async (label, value, initialTheme) => {
        themeMock.theme = initialTheme;
        renderThemeSelector();

        await waitFor(() => {
            expect(screen.getByRole("menuitemradio", { name: label }))
                .not.toHaveAttribute("aria-disabled", "true");
        });
        fireEvent.click(screen.getByRole("menuitemradio", { name: label }));

        expect(themeMock.setTheme).toHaveBeenCalledWith(value);
    });

    it("does not create a checked state for an invalid theme value", async () => {
        themeMock.theme = "sepia";
        renderThemeSelector();

        await waitFor(() => {
            expect(screen.getByRole("menuitemradio", {
                name: "ใช้ธีมสว่าง",
            })).not.toHaveAttribute("aria-disabled", "true");
        });

        expect(screen.getAllByRole("menuitemradio").every(
            (option) => option.getAttribute("data-state") !== "checked",
        )).toBe(true);

        fireEvent.click(screen.getByRole("menuitemradio", {
            name: "ใช้ธีมมืด",
        }));
        expect(themeMock.setTheme).toHaveBeenCalledWith("dark");
    });
});
