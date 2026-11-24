import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { SectionHeader } from "@/components/ui/section-header";
import { VISUAL_ASSETS } from "@/lib/ui/visual-assets";

describe("SectionHeader", () => {
    it("retains the focusable page heading and subtitle without artwork or actions", () => {
        const { container } = render(<SectionHeader title="ข้อมูลพนักงาน" subtitle="ดูข้อมูลพนักงานในองค์กร" />);
        const heading = screen.getByRole("heading", { level: 1, name: "ข้อมูลพนักงาน" });
        expect(heading).toHaveAttribute("data-page-heading");
        expect(heading).toHaveAttribute("tabindex", "-1");
        heading.focus();
        expect(heading).toHaveFocus();
        expect(screen.getByText("ดูข้อมูลพนักงานในองค์กร")).toBeVisible();
        expect(container.querySelector("img")).toBeNull();
    });

    it("keeps the heading, subtitle and action available after decorative artwork fails", () => {
        const onExport = vi.fn();
        const { container } = render(
            <SectionHeader
                title="NHF Routine"
                subtitle="รวมรายการ Routine ตามกำหนดเวลา"
                asset="routine"
                extra={<button onClick={onExport}>ส่งออก Excel</button>}
            />,
        );
        const heading = screen.getByRole("heading", { level: 1, name: "NHF Routine" });
        const image = container.querySelector("img");
        if (!image) throw new Error("Missing branded heading artwork");
        expect(image).toHaveAttribute("alt", "");
        expect(image.src).toBe(new URL(VISUAL_ASSETS.routine.src, document.baseURI).href);
        const slot = image.parentElement;
        heading.focus();

        fireEvent.error(image);

        expect(slot?.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
        expect(heading).toHaveFocus();
        expect(screen.getByRole("heading", { level: 1, name: "NHF Routine" })).toBe(heading);
        expect(screen.getByText("รวมรายการ Routine ตามกำหนดเวลา")).toBeVisible();
        fireEvent.click(screen.getByRole("button", { name: "ส่งออก Excel" }));
        expect(onExport).toHaveBeenCalledOnce();
    });
});
