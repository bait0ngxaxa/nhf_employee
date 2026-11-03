import type { LineFlexComponent } from "@/types/api";

export const MAX_ACTION_LABEL_CHARACTERS = 40;
export const MAX_APPLICATION_ACTION_LABEL_UTF16_CODE_UNITS = 40;
export const MAX_ACTION_URI_CHARACTERS = 10_000;
export const MAX_BUBBLE_JSON_BYTES = 30 * 1024;
export const MAX_APPLICATION_ALT_TEXT_CHARACTERS = 400;
export const MAX_PROVIDER_ALT_TEXT_CHARACTERS = 1_500;

type SupportedFlexComponentType = Exclude<LineFlexComponent["type"], "spacer">;
type ContractErrors = {
    readonly provider: string[];
    readonly application: string[];
};

const FLEX_COMPONENT_PROPERTIES = {
    box: ["type", "layout", "contents", "spacing", "margin", "backgroundColor", "paddingAll", "flex"],
    button: ["type", "style", "height", "action", "color", "scaling"],
    separator: ["type", "margin"],
    text: ["type", "text", "weight", "color", "size", "wrap", "flex", "margin", "scaling"],
} satisfies Record<SupportedFlexComponentType, readonly string[]>;

const FLEX_ACTION_PROPERTIES = {
    uri: ["type", "label", "uri", "altUri"],
    postback: ["type", "label", "data", "displayText", "text", "inputOption", "fillInText"],
    message: ["type", "label", "text"],
    datetimepicker: ["type", "label", "data", "mode", "initial", "max", "min"],
    clipboard: ["type", "label", "clipboardText"],
} as const satisfies Record<string, readonly string[]>;

type SupportedFlexActionType = keyof typeof FLEX_ACTION_PROPERTIES;

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

function isFlexActionType(value: string): value is SupportedFlexActionType {
    return Object.hasOwn(FLEX_ACTION_PROPERTIES, value);
}

function graphemeCount(value: string): number {
    return Array.from(new Intl.Segmenter("th", { granularity: "grapheme" }).segment(value)).length;
}

function isAscii(value: string): boolean {
    return /^[\x00-\x7F]*$/.test(value);
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

function validateStringLimit(
    value: unknown,
    maxLength: number,
    path: string,
    errors: string[],
): void {
    if (typeof value === "string" && value.length > maxLength) {
        errors.push(`${path} exceeds ${maxLength} characters`);
    }
}

function validateActionUri(value: unknown, path: string, errors: string[]): void {
    if (typeof value !== "string" || value.length === 0) {
        errors.push(`${path} is required`);
        return;
    }

    if (value.length > MAX_ACTION_URI_CHARACTERS) {
        errors.push(`${path} exceeds ${MAX_ACTION_URI_CHARACTERS} characters`);
    }

    try {
        const parsedUri = new URL(value);
        if (!FLEX_ACTION_SCHEMES.has(parsedUri.protocol.toLowerCase())) {
            errors.push(`${path} uses an unsupported scheme`);
        }
    } catch {
        errors.push(`${path} is invalid`);
    }
}

function validateFlexAction(value: unknown, path: string, errors: ContractErrors): void {
    if (!isRecord(value)) {
        errors.provider.push(`${path} is required`);
        return;
    }

    if (typeof value.type !== "string" || !isFlexActionType(value.type)) {
        errors.provider.push(`${path}.type is not a supported Flex button action`);
        return;
    }

    const actionType = value.type;
    validateAllowedProperties(value, FLEX_ACTION_PROPERTIES[actionType], path, errors.provider);

    if (typeof value.label !== "string" || value.label.length === 0) {
        errors.provider.push(`${path}.label is required`);
    } else if (isAscii(value.label) && value.label.length > MAX_ACTION_LABEL_CHARACTERS) {
        // LINE documents a 40-character limit but doesn't define Unicode counting.
        // ASCII can be checked exactly here; Unicode boundary cases use the provider probe.
        errors.provider.push(`${path}.label exceeds ${MAX_ACTION_LABEL_CHARACTERS} ASCII characters`);
    }

    if (actionType === "uri") {
        validateActionUri(value.uri, `${path}.uri`, errors.provider);
        if (value.altUri !== undefined) {
            if (!isRecord(value.altUri)) {
                errors.provider.push(`${path}.altUri must be an object`);
            } else {
                validateAllowedProperties(value.altUri, ["desktop"], `${path}.altUri`, errors.provider);
                if (value.altUri.desktop !== undefined) {
                    validateActionUri(value.altUri.desktop, `${path}.altUri.desktop`, errors.provider);
                }
            }
        }
    } else if (actionType === "postback") {
        if (typeof value.data !== "string" || value.data.length === 0) {
            errors.provider.push(`${path}.data is required`);
        } else {
            validateStringLimit(value.data, 300, `${path}.data`, errors.provider);
        }
        if (value.displayText !== undefined && value.text !== undefined) {
            errors.provider.push(`${path}.displayText and ${path}.text cannot both be specified`);
        }
        validateStringLimit(value.displayText, 300, `${path}.displayText`, errors.provider);
        validateStringLimit(value.text, 300, `${path}.text`, errors.provider);
        validateStringLimit(value.fillInText, 300, `${path}.fillInText`, errors.provider);
        if (value.inputOption !== undefined
            && !["closeRichMenu", "openRichMenu", "openKeyboard", "openVoice"].includes(String(value.inputOption))) {
            errors.provider.push(`${path}.inputOption is invalid`);
        }
        if (value.fillInText !== undefined && value.inputOption !== "openKeyboard") {
            errors.provider.push(`${path}.fillInText requires inputOption openKeyboard`);
        }
    } else if (actionType === "message") {
        if (typeof value.text !== "string" || value.text.length === 0) {
            errors.provider.push(`${path}.text is required`);
        } else {
            validateStringLimit(value.text, 300, `${path}.text`, errors.provider);
        }
    } else if (actionType === "datetimepicker") {
        if (typeof value.data !== "string" || value.data.length === 0) {
            errors.provider.push(`${path}.data is required`);
        } else {
            validateStringLimit(value.data, 300, `${path}.data`, errors.provider);
        }
        if (!["date", "time", "datetime"].includes(String(value.mode))) {
            errors.provider.push(`${path}.mode is invalid`);
        }
        for (const property of ["initial", "max", "min"] as const) {
            if (value[property] !== undefined && typeof value[property] !== "string") {
                errors.provider.push(`${path}.${property} must be a string`);
            }
        }
    } else if (actionType === "clipboard") {
        if (typeof value.clipboardText !== "string" || value.clipboardText.length === 0) {
            errors.provider.push(`${path}.clipboardText is required`);
        } else {
            validateStringLimit(value.clipboardText, 1_000, `${path}.clipboardText`, errors.provider);
        }
    }
}

function validateFlexComponent(
    value: unknown,
    path: string,
    parentLayout: string | undefined,
    errors: ContractErrors,
): void {
    if (!isRecord(value) || typeof value.type !== "string" || !isFlexComponentType(value.type)) {
        errors.provider.push(`${path} is not in the NHFapp-supported Flex component subset`);
        return;
    }

    const componentType = value.type;
    validateAllowedProperties(value, FLEX_COMPONENT_PROPERTIES[componentType], path, errors.provider);

    if (parentLayout === "baseline" && componentType !== "text") {
        errors.provider.push(`${path} type ${componentType} is unsupported in baseline layout`);
    }

    if (componentType === "box") {
        const layout = value.layout;
        if (typeof layout !== "string" || !["vertical", "horizontal", "baseline"].includes(layout)) {
            errors.provider.push(`${path}.layout is invalid`);
        }
        if (!Array.isArray(value.contents)) {
            errors.provider.push(`${path}.contents is required`);
            return;
        }
        // LINE permits empty Box contents. NHFapp doesn't reject them at either layer.
        const childLayout = typeof layout === "string" ? layout : undefined;
        for (const [index, child] of value.contents.entries()) {
            validateFlexComponent(child, `${path}.contents[${index}]`, childLayout, errors);
        }
        if (value.spacing !== undefined && (typeof value.spacing !== "string" || !FLEX_SPACING.has(String(value.spacing)))) {
            errors.provider.push(`${path}.spacing is invalid`);
        }
        if (value.margin !== undefined && (typeof value.margin !== "string" || !FLEX_SPACING.has(String(value.margin)))) {
            errors.provider.push(`${path}.margin is invalid`);
        }
        if (value.backgroundColor !== undefined
            && (typeof value.backgroundColor !== "string" || !/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(value.backgroundColor))) {
            errors.provider.push(`${path}.backgroundColor is invalid`);
        }
        if (value.paddingAll !== undefined
            && (typeof value.paddingAll !== "string" || !/^\d+(?:\.\d+)?px$/.test(value.paddingAll))) {
            errors.provider.push(`${path}.paddingAll is invalid`);
        }
        if (value.flex !== undefined && (typeof value.flex !== "number" || !Number.isFinite(value.flex) || value.flex < 0)) {
            errors.provider.push(`${path}.flex is invalid`);
        }
        return;
    }

    if (componentType === "text") {
        if (typeof value.text !== "string") {
            errors.provider.push(`${path}.text is required`);
        } else if (graphemeCount(value.text) > 30 && value.wrap !== true) {
            errors.application.push(`${path}.wrap must be true for long notification text`);
        }
        if (value.wrap !== undefined && typeof value.wrap !== "boolean") {
            errors.provider.push(`${path}.wrap is invalid`);
        }
        if (value.scaling !== undefined && typeof value.scaling !== "boolean") {
            errors.provider.push(`${path}.scaling is invalid`);
        }
        if (value.scaling !== true) errors.application.push(`${path}.scaling must be true for notification text`);
        if (value.size !== undefined && (typeof value.size !== "string" || !FLEX_SIZES.has(String(value.size)))) {
            errors.provider.push(`${path}.size is invalid`);
        }
        if (value.weight !== undefined && value.weight !== "regular" && value.weight !== "bold") {
            errors.provider.push(`${path}.weight is invalid`);
        }
        if (value.color !== undefined
            && (typeof value.color !== "string" || !/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(value.color))) {
            errors.provider.push(`${path}.color is invalid`);
        }
        if (value.flex !== undefined && (typeof value.flex !== "number" || !Number.isFinite(value.flex) || value.flex < 0)) {
            errors.provider.push(`${path}.flex is invalid`);
        }
        if (value.margin !== undefined && (typeof value.margin !== "string" || !FLEX_SPACING.has(String(value.margin)))) {
            errors.provider.push(`${path}.margin is invalid`);
        }
        return;
    }

    if (componentType === "button") {
        if (value.scaling !== undefined && typeof value.scaling !== "boolean") {
            errors.provider.push(`${path}.scaling is invalid`);
        }
        if (value.scaling !== true) errors.application.push(`${path}.scaling must be true for notification buttons`);
        if (value.style !== undefined && !["link", "primary", "secondary"].includes(String(value.style))) {
            errors.provider.push(`${path}.style is invalid`);
        }
        if (value.height !== undefined && value.height !== "sm" && value.height !== "md") {
            errors.provider.push(`${path}.height is invalid`);
        }
        if (value.color !== undefined
            && (typeof value.color !== "string" || !/^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$/.test(value.color))) {
            errors.provider.push(`${path}.color is invalid`);
        }
        validateFlexAction(value.action, `${path}.action`, errors);
        if (isRecord(value.action)) {
            if (value.action.type !== "uri") {
                errors.application.push(`${path}.action.type must be uri for NHFapp notification actions`);
            } else if (typeof value.action.label === "string"
                && value.action.label.length > MAX_APPLICATION_ACTION_LABEL_UTF16_CODE_UNITS) {
                errors.application.push(
                    `${path}.action.label exceeds ${MAX_APPLICATION_ACTION_LABEL_UTF16_CODE_UNITS} UTF-16 code units (NHFapp safety limit)`,
                );
            }
        }
        return;
    }

    if (componentType === "separator" && value.margin !== undefined
        && (typeof value.margin !== "string" || !FLEX_SPACING.has(String(value.margin)))) {
        errors.provider.push(`${path}.margin is invalid`);
    }
}

function validateFlexMessage(value: unknown): ContractErrors {
    const errors: ContractErrors = { provider: [], application: [] };
    if (!isRecord(value)) {
        errors.provider.push("message must be an object");
        return errors;
    }

    validateAllowedProperties(value, ["type", "altText", "contents"], "message", errors.provider);
    if (value.type !== "flex") errors.provider.push("message.type must be flex");
    if (typeof value.altText !== "string" || value.altText.length === 0) {
        errors.provider.push("message.altText is required");
    } else {
        if (value.altText.length > MAX_PROVIDER_ALT_TEXT_CHARACTERS) {
            errors.provider.push(`message.altText exceeds the ${MAX_PROVIDER_ALT_TEXT_CHARACTERS}-character LINE limit`);
        }
        if (value.altText.length > MAX_APPLICATION_ALT_TEXT_CHARACTERS) {
            errors.application.push(
                `message.altText exceeds the ${MAX_APPLICATION_ALT_TEXT_CHARACTERS}-character NHFapp convention`,
            );
        }
    }
    if (!isRecord(value.contents)) {
        errors.provider.push("message.contents is required");
        return errors;
    }

    validateAllowedProperties(value.contents, ["type", "header", "body", "footer"], "message.contents", errors.provider);
    if (value.contents.type !== "bubble") errors.provider.push("message.contents.type must be bubble");
    if (value.contents.body === undefined) {
        errors.application.push("message.contents.body is required by the NHFapp notification contract");
    }

    for (const blockName of ["header", "body", "footer"] as const) {
        const block = value.contents[blockName];
        if (block === undefined) continue;
        if (!isRecord(block) || block.type !== "box") {
            errors.provider.push(`message.contents.${blockName} must be a Flex box`);
            continue;
        }
        validateFlexComponent(block, `message.contents.${blockName}`, undefined, errors);
    }

    try {
        const bubbleJson = JSON.stringify(value.contents);
        if (typeof bubbleJson !== "string") {
            errors.provider.push("message.contents is not serializable as JSON");
        } else if (new TextEncoder().encode(bubbleJson).byteLength > MAX_BUBBLE_JSON_BYTES) {
            errors.provider.push(`bubble JSON exceeds ${MAX_BUBBLE_JSON_BYTES} UTF-8 bytes`);
        }
    } catch {
        errors.provider.push("message.contents is not serializable as JSON");
    }

    return errors;
}

export function validateLineFlexProviderContract(value: unknown): string[] {
    return validateFlexMessage(value).provider;
}

export function validateNotificationFlexApplicationContract(value: unknown): string[] {
    return validateFlexMessage(value).application;
}

export function validateNotificationFlexMessage(value: unknown): string[] {
    const errors = validateFlexMessage(value);
    return [...new Set([...errors.provider, ...errors.application])];
}
