// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BrandAsset } from "@/components/brand/BrandAsset";
import { VISUAL_ASSETS } from "@/lib/ui/visual-assets";

describe("BrandAsset", () => {
    it("ships a distinct pair of local SVGs and a fallback for each core identity", () => {
        expect(Object.keys(VISUAL_ASSETS).sort()).toEqual(["it-ticket", "leave", "routine", "stock"]);
        const sources = new Set<string>();

        for (const [id, { src, compactSrc, fallback }] of Object.entries(VISUAL_ASSETS)) {
            expect(fallback).toBeDefined();
            for (const suffix of ["", "-compact"]) {
                const source = suffix ? compactSrc : src;
                const svg = readFileSync(join(process.cwd(), "public", "assets", "modules", `${id}${suffix}.svg`), "utf8");
                expect(svg).toContain('viewBox="0 0 128 128"');
                expect(Buffer.byteLength(svg)).toBeLessThanOrEqual(15 * 1024);
                expect(source).not.toBe("");
                expect(sources.has(source)).toBe(false);
                sources.add(source);
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
        expect(screen.queryByRole("img")).toBeNull();
    });

    it("preserves the informative name and box on failure and retries a changed source", () => {
        const { rerender } = render(<BrandAsset asset="routine" variant="compact" size="sm" alt="Routine" />);
        const image = screen.getByRole<HTMLImageElement>("img", { name: "Routine" });
        const box = image.parentElement;
        expect(image.src).toBe(new URL(VISUAL_ASSETS.routine.compactSrc, document.baseURI).href);
        expect(image).toHaveAttribute("width", "24");

        fireEvent.error(image);
        const fallback = screen.getByRole("img", { name: "Routine" });
        expect(fallback.tagName).toBe("svg");
        expect(fallback.parentElement).toBe(box);

        rerender(<BrandAsset asset="routine" size="sm" alt="Routine" />);
        expect(screen.getByRole<HTMLImageElement>("img", { name: "Routine" }).src).toBe(
            new URL(VISUAL_ASSETS.routine.src, document.baseURI).href,
        );
    });
});
