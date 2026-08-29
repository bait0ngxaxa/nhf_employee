import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ThemeSelector } from "@/components/theme/ThemeSelector";
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

function renderThemeSelector(): void {
    render(
        <DropdownMenu defaultOpen>
            <DropdownMenuTrigger>เปิดเมนูธีม</DropdownMenuTrigger>
            <DropdownMenuContent>
                <ThemeSelector />
            </DropdownMenuContent>
        </DropdownMenu>,
    );
}

describe("ThemeSelector", () => {
    beforeEach(() => {
        themeMock.theme = "light";
        themeMock.setTheme.mockReset();
    });

    it("shows every supported preference and marks the current theme", async () => {
        renderThemeSelector();

        const systemOption = await screen.findByRole("menuitemradio", {
            name: "ใช้ธีมตามระบบ",
        });
        const lightOption = screen.getByRole("menuitemradio", {
            name: "ใช้ธีมสว่าง",
        });
        const darkOption = screen.getByRole("menuitemradio", {
            name: "ใช้ธีมมืด",
        });

        expect(systemOption).toBeEnabled();
        expect(lightOption).toHaveAttribute("data-state", "checked");
        expect(darkOption).toHaveAttribute("data-state", "unchecked");
    });

    it.each([
        ["ใช้ธีมตามระบบ", "system"],
        ["ใช้ธีมมืด", "dark"],
    ])("updates next-themes when the user chooses %s", async (label, value) => {
        renderThemeSelector();

        const option = await screen.findByRole("menuitemradio", {
            name: label,
        });
        await waitFor(() => expect(option).toBeEnabled());
        fireEvent.click(option);

        expect(themeMock.setTheme).toHaveBeenCalledWith(value);
    });
});
