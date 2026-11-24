// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import {
    Boxes, CalendarRange, ClipboardCheck, FileText, Headset, KeyRound,
    Mail, Megaphone, Upload, UserPlus, Users,
} from "lucide-react";
import { describe, expect, it } from "vitest";
import { BrandAsset } from "@/components/brand/BrandAsset";
import { VISUAL_ASSETS } from "@/lib/ui/visual-assets";

const svgSources = import.meta.glob<string>("/public/assets/{modules,menus}/*.svg", {
    eager: true,
    import: "default",
    query: "?url",
});

describe("BrandAsset", () => {
    it("ships a distinct pair of local SVGs and the correct fallback for all eleven identities", () => {
        const moduleFallbacks = { leave: CalendarRange, stock: Boxes, routine: ClipboardCheck, "it-ticket": Headset };
        const menuFallbacks = {
            "employee-management": Users,
            "add-employee": UserPlus,
            "import-employee": Upload,
            "email-request": Mail,
            announcements: Megaphone,
            "authorization-administration": KeyRound,
            "audit-logs": FileText,
        };
        const fallbacks = { ...moduleFallbacks, ...menuFallbacks };
        expect(Object.keys(VISUAL_ASSETS).sort()).toEqual(Object.keys(fallbacks).sort());
        const sources = new Set<string>();

        for (const [folder, definitions] of [["modules", moduleFallbacks], ["menus", menuFallbacks]] as const) {
            for (const id of Object.keys(definitions) as (keyof typeof VISUAL_ASSETS)[]) {
                const { src, compactSrc, fallback } = VISUAL_ASSETS[id];
                expect(fallback).toBe(fallbacks[id]);
                for (const [suffix, source] of [["", src], ["-compact", compactSrc]]) {
                    const filename = `${id}${suffix}.svg`;
                    const svg = readFileSync(join(process.cwd(), "public", "assets", folder, filename), "utf8");
                    expect(source).toBe(svgSources[`/public/assets/${folder}/${filename}`]);
                    expect(svg).toContain('viewBox="0 0 128 128"');
                    expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(15 * 1024);
                    expect(svg).not.toMatch(/<(?:image|script|text|filter|foreignObject)\b|\bhref=/i);
                    expect(sources.has(source)).toBe(false);
                    sources.add(source);
                }
            }
        }
    });

    it("renders the primary artwork with intrinsic dimensions and decorative semantics", () => {
        const { container } = render(<BrandAsset asset="leave" />);
        const image = container.querySelector("img");
        if (!image) throw new Error("Missing primary image");
        expect(image.src).toBe(new URL(VISUAL_ASSETS.leave.src, document.baseURI).href);
        expect(image).toHaveAttribute("width", "64");
        expect(image).toHaveAttribute("height", "64");
        expect(image).toHaveAttribute("alt", "");
        expect(screen.queryByRole("img")).toBeNull();

        fireEvent.error(image);
        expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
        expect(container.querySelector("svg")).toHaveClass("size-[min(80%,max(50%,1.25rem))]");
        expect(screen.queryByRole("img")).toBeNull();
    });

    it("preserves the informative name and box on failure and retries a changed source", () => {
        const { rerender } = render(<BrandAsset asset="audit-logs" variant="compact" size="sm" alt="Audit logs" />);
        const image = screen.getByRole<HTMLImageElement>("img", { name: "Audit logs" });
        const box = image.parentElement;
        expect(image.src).toBe(new URL(VISUAL_ASSETS["audit-logs"].compactSrc, document.baseURI).href);
        expect(image).toHaveAttribute("width", "24");

        fireEvent.error(image);
        const fallback = screen.getByRole("img", { name: "Audit logs" });
        expect(fallback.tagName).toBe("svg");
        expect(fallback).toHaveClass("size-4/5");
        expect(fallback.parentElement).toBe(box);

        rerender(<BrandAsset asset="audit-logs" size="sm" alt="Audit logs" />);
        expect(screen.getByRole<HTMLImageElement>("img", { name: "Audit logs" }).src).toBe(
            new URL(VISUAL_ASSETS["audit-logs"].src, document.baseURI).href,
        );
    });

    it("keeps responsive size overrides on the same slot when primary artwork fails", () => {
        const { container } = render(<BrandAsset asset="routine" size="lg" className="size-8 sm:size-12 grayscale" />);
        const image = container.querySelector("img");
        if (!image) throw new Error("Missing responsive artwork");
        const slot = image.parentElement;
        expect(slot).toHaveClass("size-8", "sm:size-12", "grayscale");
        expect(image).toHaveClass("size-full");

        fireEvent.error(image);
        const fallback = container.querySelector("svg");
        expect(fallback?.parentElement).toBe(slot);
        expect(fallback).toHaveClass("size-[min(80%,max(50%,1.25rem))]");
        expect(fallback).toHaveAttribute("aria-hidden", "true");
    });
});
