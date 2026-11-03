import type { LineFlexComponent } from "@/types/api";

export const MAX_ACTION_LABEL_CHARACTERS = 40;
export const MAX_ACTION_URI_CHARACTERS = 1_000;
export const MAX_BUBBLE_JSON_BYTES = 30 * 1024;
export const MAX_APPLICATION_ALT_TEXT_CHARACTERS = 400;
export const MAX_PROVIDER_ALT_TEXT_CHARACTERS = 1_500;

type SupportedFlexComponentType = Exclude<LineFlexComponent["type"], "spacer">;

const FLEX_COMPONENT_PROPERTIES = {
    box: ["type", "layout", "contents", "spacing", "margin", "backgroundColor", "paddingAll", "flex"],
    button: ["type", "style", "height", "action", "color", "scaling"],
    separator: ["type", "margin"],
    text: ["type", "text", "weight", "color", "size", "wrap", "flex", "margin", "scaling"],
} satisfies Record<SupportedFlexComponentType, readonly string[]>;

const FLEX_COMPONENT_TYPES = Object.keys(FLEX_COMPONENT_PROPERTIES);
const FLEX_SIZES = new Set(["xxs", "xs", "sm", "md", "lg", "xl", "xxl", "3xl", "4xl", "5xl"]);
const FLEX_SPACING = new Set(["none", "xs", "sm", "md", "lg", "xl", "xxl"]);
const FLEX_ACTION_SCHEMES = new Set(["http:", "https:", "line:", "tel:"]);


function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFlexComponentType(value: string): value is SupportedFlexComponentType {
    return FLEX_COMPONENT_TYPES.includes(value);
}

function graphemeCount(value: string): number {
    return Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(value)).length;
}

function validateAllowedProperties(
    value: Record<string, unknown>,
    allowed: readonly string[],
    path: string,
    errors: string[],
): void {
    for (const property of Object.keys(value)) {
        if (!allowed.includes(property)) {
            errors.push(`${path} has unsupported property ${property}`);
        }
    }
}

function validateFlexComponent(
    value: unknown,
    path: string,
    parentLayout: string | undefined,
    errors: string[],
): void {
    if (!isRecord(value) || typeof value.type !== "string" || !isFlexComponentType(value.type)) {
        errors.push(`${path} is not a supported Flex component`);
        return;
    }

    const componentType = value.type;
    validateAllowedProperties(value, FLEX_COMPONENT_PROPERTIES[componentType], path, errors);

    if (parentLayout === "baseline" && componentType !== "text") {
        errors.push(`${path} type ${componentType} is unsupported in baseline layout`);
    }

    if (componentType === "box") {
        const layout = value.layout;
        if (typeof layout !== "string" || !["vertical", "horizontal", "baseline"].includes(layout)) {
            errors.push(`${path}.layout is invalid`);
        }
        if (!Array.isArray(value.contents)) {
            errors.push(`${path}.contents is required`);
            return;
        }
        if (value.contents.length === 0) {
            errors.push(`${path}.contents must not be empty`);
        }
        const childLayout = typeof layout === "string" ? layout : undefined;
        for (const [index, child] of value.contents.entries()) {
            validateFlexComponent(child, `${path}.contents[${index}]`, childLayout, errors);
        }
        if (value.spacing !== undefined && (typeof value.spacing !== "string" || !FLEX_SPACING.has(String(value.spacing)))) {
            errors.push(`${path}.spacing is invalid`);
        }
        if (value.margin !== undefined && (typeof value.margin !== "string" || !FLEX_SPACING.has(String(value.margin)))) {
            errors.push(`${path}.margin is invalid`);
        }
        if (value.backgroundColor !== undefined
            && (typeof value.backgroundColor !== "string" || !/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(value.backgroundColor))) {
            errors.push(`${path}.backgroundColor is invalid`);
        }
        if (value.paddingAll !== undefined
            && (typeof value.paddingAll !== "string" || !/^\d+(?:\.\d+)?px$/.test(value.paddingAll))) {
            errors.push(`${path}.paddingAll is invalid`);
        }
        if (value.flex !== undefined && (typeof value.flex !== "number" || !Number.isFinite(value.flex) || value.flex < 0)) {
            errors.push(`${path}.flex is invalid`);
        }
        return;
    }

    if (componentType === "text") {
        if (typeof value.text !== "string") {
            errors.push(`${path}.text is required`);
        } else if (graphemeCount(value.text) > 30 && value.wrap !== true) {
            errors.push(`${path}.wrap must be true for long notification text`);
        }
        if (value.wrap !== undefined && typeof value.wrap !== "boolean") {
            errors.push(`${path}.wrap is invalid`);
        }
        if (value.scaling !== true) errors.push(`${path}.scaling must be true for notification text`);
        if (value.size !== undefined && (typeof value.size !== "string" || !FLEX_SIZES.has(String(value.size)))) {
            errors.push(`${path}.size is invalid`);
        }
        if (value.weight !== undefined && value.weight !== "regular" && value.weight !== "bold") {
            errors.push(`${path}.weight is invalid`);
        }
        if (value.color !== undefined
            && (typeof value.color !== "string" || !/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(value.color))) {
            errors.push(`${path}.color is invalid`);
        }
        if (value.flex !== undefined && (typeof value.flex !== "number" || !Number.isFinite(value.flex) || value.flex < 0)) {
            errors.push(`${path}.flex is invalid`);
        }
        if (value.margin !== undefined && (typeof value.margin !== "string" || !FLEX_SPACING.has(String(value.margin)))) {
            errors.push(`${path}.margin is invalid`);
        }
        return;
    }

    if (componentType === "button") {
        if (value.scaling !== true) errors.push(`${path}.scaling must be true for notification buttons`);
        if (value.style !== undefined && !["link", "primary", "secondary"].includes(String(value.style))) {
            errors.push(`${path}.style is invalid`);
        }
        if (value.height !== undefined && value.height !== "sm" && value.height !== "md") {
            errors.push(`${path}.height is invalid`);
        }
        if (value.color !== undefined
            && (typeof value.color !== "string" || !/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(value.color))) {
            errors.push(`${path}.color is invalid`);
        }
        if (!isRecord(value.action)) {
            errors.push(`${path}.action is required`);
            return;
        }
        validateAllowedProperties(value.action, ["type", "label", "uri"], `${path}.action`, errors);
        if (value.action.type !== "uri") errors.push(`${path}.action.type must be uri`);
        if (typeof value.action.label !== "string" || value.action.label.length === 0) {
            errors.push(`${path}.action.label is required`);
        } else if (graphemeCount(value.action.label) > MAX_ACTION_LABEL_CHARACTERS) {
            errors.push(`${path}.action.label exceeds ${MAX_ACTION_LABEL_CHARACTERS} characters`);
        }
        if (typeof value.action.uri !== "string" || value.action.uri.length === 0) {
            errors.push(`${path}.action.uri is required`);
        } else {
            if (Array.from(value.action.uri).length > MAX_ACTION_URI_CHARACTERS) {
                errors.push(`${path}.action.uri exceeds ${MAX_ACTION_URI_CHARACTERS} characters`);
            }
            try {
                const parsedUri = new URL(value.action.uri);
                if (!FLEX_ACTION_SCHEMES.has(parsedUri.protocol.toLowerCase())) {
                    errors.push(`${path}.action.uri uses an unsupported scheme`);
                }
            } catch {
                errors.push(`${path}.action.uri is invalid`);
            }
        }
        return;
    }

    if (componentType === "separator" && value.margin !== undefined
        && (typeof value.margin !== "string" || !FLEX_SPACING.has(String(value.margin)))) {
        errors.push(`${path}.margin is invalid`);
    }
}

export function validateNotificationFlexMessage(value: unknown): string[] {
    const errors: string[] = [];
    if (!isRecord(value)) return ["message must be an object"];

    validateAllowedProperties(value, ["type", "altText", "contents"], "message", errors);
    if (value.type !== "flex") errors.push("message.type must be flex");
    if (typeof value.altText !== "string" || value.altText.length === 0) {
        errors.push("message.altText is required");
    } else {
        if (value.altText.length > MAX_APPLICATION_ALT_TEXT_CHARACTERS) {
            errors.push(`message.altText exceeds the ${MAX_APPLICATION_ALT_TEXT_CHARACTERS}-character application convention`);
        }
        if (value.altText.length > MAX_PROVIDER_ALT_TEXT_CHARACTERS) {
            errors.push(`message.altText exceeds the ${MAX_PROVIDER_ALT_TEXT_CHARACTERS}-character LINE limit`);
        }
    }
    if (!isRecord(value.contents)) {
        errors.push("message.contents is required");
        return errors;
    }

    validateAllowedProperties(value.contents, ["type", "header", "body", "footer"], "message.contents", errors);
    if (value.contents.type !== "bubble") errors.push("message.contents.type must be bubble");
    if (!isRecord(value.contents.body)) errors.push("message.contents.body is required");

    for (const blockName of ["header", "body", "footer"] as const) {
        const block = value.contents[blockName];
        if (block === undefined) continue;
        if (!isRecord(block) || block.type !== "box") {
            errors.push(`message.contents.${blockName} must be a Flex box`);
            continue;
        }
        validateFlexComponent(block, `message.contents.${blockName}`, undefined, errors);
    }

    try {
        const bubbleJson = JSON.stringify(value.contents);
        if (typeof bubbleJson !== "string") {
            errors.push("message.contents is not serializable as JSON");
        } else if (new TextEncoder().encode(bubbleJson).byteLength > MAX_BUBBLE_JSON_BYTES) {
            errors.push(`bubble JSON exceeds ${MAX_BUBBLE_JSON_BYTES} UTF-8 bytes`);
        }
    } catch {
        errors.push("message.contents is not serializable as JSON");
    }

    return errors;
}
