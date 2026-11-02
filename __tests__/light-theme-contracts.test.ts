import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
    new URL("../app/globals.css", import.meta.url),
    "utf8",
);

function getRuleBody(selector: string): string {
    const ruleStart = stylesheet.indexOf(`${selector} {`);
    expect(ruleStart).toBeGreaterThanOrEqual(0);

    const bodyStart = stylesheet.indexOf("{", ruleStart) + 1;
    const bodyEnd = stylesheet.indexOf("}", bodyStart);
    return stylesheet.slice(bodyStart, bodyEnd);
}

function getHexToken(ruleBody: string, token: string): string {
    const value = ruleBody.match(
        new RegExp(`--${token}:\\s*(#[\\da-f]{6});`, "i"),
    )?.[1];
    expect(value).toBeDefined();
    return value ?? "";
}

function relativeLuminance(hexColor: string): number {
    const channels = hexColor
        .slice(1)
        .match(/.{2}/g)
        ?.map((channel) => parseInt(channel, 16) / 255);

    if (!channels || channels.length !== 3) {
        throw new Error(`Expected a six-digit hex color, received ${hexColor}`);
    }

    const [red, green, blue] = channels.map((channel) =>
        channel <= 0.04045
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4,
    );

    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
}

function contrastRatio(foreground: string, background: string): number {
    const foregroundLuminance = relativeLuminance(foreground);
    const backgroundLuminance = relativeLuminance(background);
    const lighter = Math.max(foregroundLuminance, backgroundLuminance);
    const darker = Math.min(foregroundLuminance, backgroundLuminance);

    return (lighter + 0.05) / (darker + 0.05);
}

describe("light theme style contracts", () => {
    const lightTokens = getRuleBody(":root");
    const darkTokens = getRuleBody(".dark");

    it("keeps the global input border token unchanged and scopes the stronger border to Dashboard", () => {
        expect(lightTokens).toContain("--input: oklch(0.92 0.004 286.32);");
        expect(darkTokens).toContain("--input: rgb(255 255 255 / 16%);");
        expect(stylesheet).toMatch(
            /:root:not\(\.dark\) body\[data-dashboard-input-scope\]\s*\{\s*--input:\s*#8291a5;/,
        );
    });

    it("keeps refined light text combinations at WCAG AA contrast", () => {
        const employeeSubtitleContrast = contrastRatio(
            getHexToken(lightTokens, "content-neutral-secondary"),
            getHexToken(lightTokens, "dashboard-canvas"),
        );
        const mutedSurfaceTextContrast = contrastRatio(
            getHexToken(lightTokens, "content-secondary"),
            getHexToken(lightTokens, "surface-muted"),
        );

        expect(employeeSubtitleContrast).toBeGreaterThanOrEqual(4.5);
        expect(mutedSurfaceTextContrast).toBeGreaterThanOrEqual(4.5);
    });
});
