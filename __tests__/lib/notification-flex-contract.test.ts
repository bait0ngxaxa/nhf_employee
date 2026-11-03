import { afterEach, describe, expect, it, vi } from "vitest";

import { buildITTicketLineFlexMessage } from "@/modules/it/infrastructure/notifications/line-flex";
import { generateEmailRequestFlexMessage } from "@/modules/it/infrastructure/notifications/email-request-flex";
import {
    generateLeaveActionFlexMessage,
    generateLeaveCancelledAfterApprovalFlexMessage,
    generateLeaveCancelledFlexMessage,
    generateLeaveCancellationRequestedFlexMessage,
    generateLeaveNotTakenConfirmedFlexMessage,
    generateLeaveNotTakenRequestedFlexMessage,
    generateLeaveResultFlexMessage,
} from "@/modules/leave/infrastructure/notifications/line-flex";
import { generateRoutineContractExpiryFlexMessage } from "@/modules/routine/application/notifications/routine-contract-expiry-flex";
import { generateRoutineReminderFlexMessage } from "@/modules/routine/application/notifications/routine-reminder-flex";
import { generateStockRequestFlexMessage } from "@/modules/stock/infrastructure/notifications/line-messages/stock";
import { generateStockRequestResultFlexMessage } from "@/modules/stock/infrastructure/notifications/line-messages/stock-request-result";
import { generateStockLowFlexMessage } from "@/modules/stock/infrastructure/notifications/line-messages/stock-low";
import { parseITTicketNotificationPayload } from "@/modules/it/domain/ticket-notification";
import {
    buildNotificationFlex,
    notificationFlexDetail,
    notificationFlexStatus,
} from "@/lib/line/notification-flex";
import { NOTIFICATION_COLORS, NOTIFICATION_STATUS_COLORS } from "@/shared/notifications/presentation";
import type { LineFlexComponent, LineFlexMessage } from "@/types/api";

const MAX_ACTION_LABEL_CHARACTERS = 40;
const MAX_ACTION_URI_CHARACTERS = 1_000;
const MAX_BUBBLE_JSON_BYTES = 30 * 1024;
const MAX_APPLICATION_ALT_TEXT_CHARACTERS = 400;
const MAX_PROVIDER_ALT_TEXT_CHARACTERS = 1_500;

type SupportedFlexComponentType = Exclude<LineFlexComponent["type"], "spacer">;

const FLEX_COMPONENT_PROPERTIES = {
    box: ["type", "layout", "contents", "spacing", "margin", "backgroundColor", "paddingAll", "flex"],
    button: ["type", "style", "height", "action", "color"],
    separator: ["type", "margin"],
    text: ["type", "text", "weight", "color", "size", "wrap", "flex", "margin"],
} satisfies Record<SupportedFlexComponentType, readonly string[]>;

const FLEX_COMPONENT_TYPES = Object.keys(FLEX_COMPONENT_PROPERTIES);
const FLEX_SIZES = new Set(["xxs", "xs", "sm", "md", "lg", "xl", "xxl", "3xl", "4xl", "5xl"]);
const FLEX_SPACING = new Set(["none", "xs", "sm", "md", "lg", "xl", "xxl"]);
const FLEX_ACTION_SCHEMES = new Set(["http:", "https:", "line:", "tel:"]);

type ContractFixtureOptions = {
    readonly actionLabel?: string;
    readonly actionUri?: string;
    readonly actionType?: string;
    readonly bodyText?: string;
    readonly bodyLayout?: string;
    readonly bodyIncludeButton?: boolean;
    readonly extraBodyComponentType?: string;
    readonly omitBodyWrap?: boolean;
    readonly unsupportedTextProperty?: boolean;
    readonly altText?: string;
};

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

function validateFlexMessage(value: unknown): string[] {
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

function createContractFixture(options: ContractFixtureOptions = {}): unknown {
    const text: Record<string, unknown> = {
        type: "text",
        text: options.bodyText ?? "รายละเอียด",
    };
    if (!options.omitBodyWrap) text.wrap = true;
    if (options.unsupportedTextProperty) text.fontFamily = "Noto Sans Thai";

    const button = {
        type: "button",
        style: "primary",
        height: "sm",
        action: {
            type: options.actionType ?? "uri",
            label: options.actionLabel ?? "เปิดรายละเอียด",
            uri: options.actionUri ?? "https://app.example.com/details",
        },
    };
    const bodyContents: unknown[] = [text];
    if (options.bodyIncludeButton) bodyContents.push(button);
    if (options.extraBodyComponentType) {
        bodyContents.push({ type: options.extraBodyComponentType, size: "sm" });
    }

    return {
        type: "flex",
        altText: options.altText ?? "NHFapp: รายละเอียด",
        contents: {
            type: "bubble",
            header: {
                type: "box",
                layout: "vertical",
                contents: [{ type: "text", text: "NHFapp", wrap: true }],
            },
            body: {
                type: "box",
                layout: options.bodyLayout ?? "vertical",
                contents: bodyContents,
            },
            footer: {
                type: "box",
                layout: "vertical",
                contents: [button],
            },
        },
    };
}

function createProductionMessages(): Array<{ readonly name: string; readonly message: LineFlexMessage }> {
    vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");
    vi.stubEnv("PUBLIC_APPROVE_URL", "https://app.example.com");

    const employee = { employeeId: 10, userId: 1, email: "employee@example.com", name: "สมชาย ใจดี" };
    const approver = { employeeId: 20, userId: 2, email: "manager@example.com", name: "ผู้จัดการ ใจดี" };
    const leaveDetails = {
        leaveId: "leave-1",
        leaveType: "VACATION" as const,
        startDate: "2026-11-10T00:00:00.000Z",
        endDate: "2026-11-11T00:00:00.000Z",
        period: "FULL_DAY" as const,
        durationDays: 2,
    };
    const leaveAction = {
        ...leaveDetails,
        employee,
        approver,
        reason: "พักผ่อน",
        emergencyReason: null,
        specialReason: null,
        overQuotaDays: 0,
    };
    const leaveResult = {
        ...leaveDetails,
        employee,
        approverName: approver.name,
        status: "APPROVED" as const,
        reason: null,
    };
    const leaveCancelledAfterApproval = {
        ...leaveDetails,
        employee,
        decisionActorName: approver.name,
        decisionActorRole: "USER",
        recoveryOverride: false,
    };
    const stockItems = [{ name: "กระดาษถ่ายเอกสาร", quantity: 2, unit: "รีม" }];
    const stockResultBase = {
        schemaVersion: 1 as const,
        requestId: 123,
        projectCode: "PRJ-2569",
        recipient: { userId: 3, name: "ผู้ขอวัสดุ", email: "private@example.com" },
        items: stockItems,
        cancelReason: "วัสดุไม่พร้อมจ่าย",
        actedAt: "2026-11-03T03:00:00.000Z",
        retryKey: "stock:request:123:line",
    };
    const itMessage = (event: "CREATED" | "WAITING_REQUESTER" | "RESOLVED") => buildITTicketLineFlexMessage(
        parseITTicketNotificationPayload({
            version: 1,
            event,
            ticketId: 123,
            recipientUserId: 1,
            audience: event === "CREATED" ? "OPERATOR_QUEUE" : "REQUESTER",
            source: { kind: "EVENT", id: event === "CREATED" ? 451 : event === "WAITING_REQUESTER" ? 452 : 453 },
        }),
    );

    return [
        { name: "IT created", message: itMessage("CREATED") },
        { name: "IT waiting", message: itMessage("WAITING_REQUESTER") },
        { name: "IT resolved", message: itMessage("RESOLVED") },
        { name: "Email request LINE", message: generateEmailRequestFlexMessage(77, "https://app.example.com/dashboard/it/email-requests/77") },
        { name: "Leave approval requested", message: generateLeaveActionFlexMessage(leaveAction, "https://liff.line.me/nhfapp-liff-id/leave?requestId=leave-1&action=approve") },
        { name: "Leave approved", message: generateLeaveResultFlexMessage(leaveResult, "https://liff.line.me/nhfapp-liff-id/leave/history") },
        { name: "Leave rejected", message: generateLeaveResultFlexMessage({ ...leaveResult, status: "REJECTED", reason: "ติดภารกิจ" }, "https://liff.line.me/nhfapp-liff-id/leave/history") },
        { name: "Leave cancelled", message: generateLeaveCancelledFlexMessage({ ...leaveDetails, employee, approver }, "https://liff.line.me/nhfapp-liff-id/leave/history") },
        { name: "Leave cancellation requested", message: generateLeaveCancellationRequestedFlexMessage({ ...leaveDetails, employee, approver, note: "มีเหตุจำเป็น" }, "https://liff.line.me/nhfapp-liff-id/leave/review") },
        { name: "Leave cancelled after approval", message: generateLeaveCancelledAfterApprovalFlexMessage(leaveCancelledAfterApproval, "https://liff.line.me/nhfapp-liff-id/leave/history") },
        { name: "Leave not taken requested", message: generateLeaveNotTakenRequestedFlexMessage({ ...leaveDetails, employee, approver, note: "ไม่ได้ใช้วันลา" }, "https://liff.line.me/nhfapp-liff-id/leave/review") },
        { name: "Leave not taken confirmed", message: generateLeaveNotTakenConfirmedFlexMessage(leaveCancelledAfterApproval, "https://liff.line.me/nhfapp-liff-id/leave/history") },
        { name: "Routine due reminder", message: generateRoutineReminderFlexMessage({
            taskTitle: "ตรวจสอบระบบสำรองข้อมูลประจำเดือน",
            unitName: "ฝ่ายเทคโนโลยีสารสนเทศ",
            categoryName: "ระบบสารสนเทศ",
            dueDateLabel: "10 พฤศจิกายน 2569",
            timingLabel: "ครบกำหนดใน 2 วัน",
            actionUrl: "https://liff.line.me/nhfapp-liff-id/routine?taskId=71&occurrenceId=91",
        }) },
        { name: "Routine contract expiry", message: generateRoutineContractExpiryFlexMessage({
            taskTitle: "ดูแลระบบเครือข่ายสำนักงาน",
            unitName: "ฝ่ายเทคโนโลยีสารสนเทศ",
            categoryName: "สัญญาบริการ",
            contractEndDateLabel: "30 พฤศจิกายน 2569",
            actionUrl: "https://liff.line.me/nhfapp-liff-id/routine?taskId=71",
        }) },
        { name: "Stock new request", message: generateStockRequestFlexMessage({
            requestId: 123,
            requesterName: "ผู้ขอวัสดุ",
            projectCode: "PRJ-2569",
            requestedAt: "2026-11-03T03:00:00.000Z",
            note: "ใช้สำหรับงานประจำเดือน",
            itemCount: stockItems.length,
            totalQuantity: 2,
            items: stockItems,
        }, "https://app.example.com") },
        { name: "Stock issued", message: generateStockRequestResultFlexMessage({ ...stockResultBase, status: "ISSUED" }, "https://liff.line.me/nhfapp-liff-id/stock?requestId=123") },
        { name: "Stock cancelled", message: generateStockRequestResultFlexMessage({ ...stockResultBase, status: "CANCELLED" }, "https://liff.line.me/nhfapp-liff-id/stock?requestId=123") },
        { name: "Stock low", message: generateStockLowFlexMessage({
            alertedAt: "2026-11-03T03:00:00.000Z",
            itemCount: 1,
            items: [{ itemId: 44, name: "กระดาษถ่ายเอกสาร", sku: "PAPER-A4", quantity: 2, minStock: 3, unit: "รีม" }],
        }, "https://app.example.com") },
    ];
}

describe("LINE Flex provider and application contract", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("validates actual IT, Leave, Routine and Stock notification renderers", () => {
        const messages = createProductionMessages();

        expect(messages).toHaveLength(18);
        for (const { name, message } of messages) {
            expect(validateFlexMessage(message), name).toEqual([]);
        }
    });

    it("keeps realistic long Thai details readable within the provider payload limits", () => {
        const longTaskTitle = "งานตามกำหนดตรวจสอบระบบสำรองข้อมูล".repeat(35);
        const longOrganization = "หน่วยงานสาธารณสุขประจำจังหวัด".repeat(24);
        const longActionUri = `https://app.example.com/routine/${"task-".repeat(60)}?view=details&source=line`;
        const message = buildNotificationFlex({
            module: "Routine",
            categoryLabel: "งานตามกำหนด",
            title: longTaskTitle,
            altText: longTaskTitle,
            contents: [
                notificationFlexDetail("หน่วยงาน", longOrganization),
                notificationFlexStatus("สถานะ: รอดำเนินการ", "warning"),
            ],
            actionLabel: "ตรวจสอบรายละเอียด",
            actionUrl: longActionUri,
            status: "warning",
        });
        const title = message.contents.body?.contents[0];
        const details = message.contents.body?.contents[1];
        const button = message.contents.footer?.contents[0];

        expect(validateFlexMessage(message)).toEqual([]);
        expect(message.altText).toHaveLength(MAX_APPLICATION_ALT_TEXT_CHARACTERS);
        expect(message.contents.header?.backgroundColor).toBe(NOTIFICATION_COLORS.brandPrimary);
        expect(title).toMatchObject({ text: longTaskTitle, color: NOTIFICATION_STATUS_COLORS.warning, wrap: true });
        expect(details).toMatchObject({ type: "box", layout: "vertical" });
        expect(JSON.stringify(details)).toContain(longOrganization);
        expect(button).toMatchObject({
            type: "button",
            color: NOTIFICATION_COLORS.brandAction,
            action: { type: "uri", label: "ตรวจสอบรายละเอียด", uri: longActionUri },
        });
    });

    it("accepts the maximum LINE button label and URI lengths", () => {
        const uriPrefix = "https://app.example.com/";
        const message = createContractFixture({
            actionLabel: "a".repeat(MAX_ACTION_LABEL_CHARACTERS),
            actionUri: `${uriPrefix}${"x".repeat(MAX_ACTION_URI_CHARACTERS - uriPrefix.length)}`,
        });

        expect(validateFlexMessage(message)).toEqual([]);
    });

    it.each([
        "http://app.example.com/details",
        "https://app.example.com/details",
        "line://app/123",
        "tel:+6621234567",
    ])("accepts the LINE-supported URI scheme in %s", (actionUri) => {
        expect(validateFlexMessage(createContractFixture({ actionUri }))).toEqual([]);
    });

    it.each([
        ["overlong button label", createContractFixture({ actionLabel: "a".repeat(41) }), "action.label exceeds 40"],
        ["overlong button URL", createContractFixture({ actionUri: `https://app.example.com/${"x".repeat(1_000)}` }), "action.uri exceeds 1000"],
        ["unsupported action scheme", createContractFixture({ actionUri: "javascript:alert(1)" }), "action.uri uses an unsupported scheme"],
        ["unsupported button action type", createContractFixture({ actionType: "postback" }), "action.type must be uri"],
        ["discontinued spacer component", createContractFixture({ extraBodyComponentType: "spacer" }), "not a supported Flex component"],
        ["unsupported component property", createContractFixture({ unsupportedTextProperty: true }), "unsupported property fontFamily"],
        ["unsupported component nesting", createContractFixture({ bodyLayout: "baseline", bodyIncludeButton: true }), "type button is unsupported in baseline layout"],
        ["long text without wrapping", createContractFixture({ bodyText: "รายละเอียดงานภาษาไทยที่ต้องอ่านได้ครบถ้วนแม้หน้าจอจะแคบ", omitBodyWrap: true }), "wrap must be true for long notification text"],
        ["overlong application alt text", createContractFixture({ altText: "ก".repeat(401) }), "400-character application convention"],
        ["overlong LINE alt text", createContractFixture({ altText: "ก".repeat(1_501) }), "1500-character LINE limit"],
        ["oversized UTF-8 bubble JSON", createContractFixture({ bodyText: "ก".repeat(12_000) }), "bubble JSON exceeds"],
    ])("rejects %s", (_name, message, expectedError) => {
        expect(validateFlexMessage(message).join("\n")).toContain(expectedError);
    });

    it("measures Bubble JSON in UTF-8 bytes rather than JavaScript string units", () => {
        const message = createContractFixture({ bodyText: "ก".repeat(12_000) });
        if (!isRecord(message) || !isRecord(message.contents)) throw new Error("Fixture is invalid");
        const bubbleJson = JSON.stringify(message.contents);

        expect(bubbleJson.length).toBeLessThan(MAX_BUBBLE_JSON_BYTES);
        expect(new TextEncoder().encode(bubbleJson).byteLength).toBeGreaterThan(MAX_BUBBLE_JSON_BYTES);
        expect(validateFlexMessage(message).join("\n")).toContain("bubble JSON exceeds");
    });

    it("rejects missing required text and button action fields", () => {
        const missingText = createContractFixture();
        const missingAction = createContractFixture();
        if (!isRecord(missingText) || !isRecord(missingText.contents)
            || !isRecord(missingText.contents.body) || !Array.isArray(missingText.contents.body.contents)
            || !isRecord(missingText.contents.body.contents[0])) {
            throw new Error("Text fixture is invalid");
        }
        delete missingText.contents.body.contents[0].text;
        if (!isRecord(missingAction) || !isRecord(missingAction.contents)
            || !isRecord(missingAction.contents.footer) || !Array.isArray(missingAction.contents.footer.contents)
            || !isRecord(missingAction.contents.footer.contents[0])) {
            throw new Error("Button fixture is invalid");
        }
        delete missingAction.contents.footer.contents[0].action;

        expect(validateFlexMessage(missingText).join("\n")).toContain(".text is required");
        expect(validateFlexMessage(missingAction).join("\n")).toContain(".action is required");
    });
});
