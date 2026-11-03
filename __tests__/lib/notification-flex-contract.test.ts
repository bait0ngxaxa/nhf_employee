import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
    buildNotificationFlex,
    notificationFlexDetail,
    notificationFlexStatus,
} from "@/lib/line/notification-flex";
import {
    MAX_ACTION_LABEL_CHARACTERS,
    MAX_ACTION_URI_CHARACTERS,
    MAX_APPLICATION_ALT_TEXT_CHARACTERS,
    MAX_BUBBLE_JSON_BYTES,
    MAX_PROVIDER_ALT_TEXT_CHARACTERS,
    validateNotificationFlexMessage,
} from "@/__tests__/lib/notification-flex-contract";

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

function createContractFixture(options: ContractFixtureOptions = {}): unknown {
    const text: Record<string, unknown> = {
        type: "text",
        text: options.bodyText ?? "รายละเอียด",
        scaling: true,
    };
    if (!options.omitBodyWrap) text.wrap = true;
    if (options.unsupportedTextProperty) text.fontFamily = "Noto Sans Thai";

    const button = {
        type: "button",
        style: "primary",
        height: "sm",
        scaling: true,
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
                contents: [{ type: "text", text: "NHFapp", wrap: true, scaling: true }],
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

describe("LINE Flex provider and application contract", () => {
    it("scales shared identity, title, detail, status and action text", () => {
        const message = buildNotificationFlex({
            module: "Stock",
            categoryLabel: "คำขอเบิกวัสดุ",
            title: "คำขอเบิกวัสดุถูกจ่ายแล้ว",
            contents: [
                notificationFlexDetail("จำนวนรายการ", "3 รายการ"),
                notificationFlexStatus("สถานะ: จ่ายแล้ว", "success"),
            ],
            actionLabel: "เปิดรายละเอียด",
            actionUrl: "https://liff.line.me/nhfapp-liff-id/stock?requestId=123",
            status: "success",
        });
        const body = message.contents.body?.contents;
        const details = body?.[1];

        expect(message.contents.header?.contents[0]).toMatchObject({ type: "text", scaling: true });
        expect(body?.[0]).toMatchObject({ type: "text", scaling: true, wrap: true });
        expect(details).toMatchObject({
            type: "box",
            contents: [
                { type: "text", scaling: true, wrap: true },
                { type: "text", scaling: true, wrap: true },
            ],
        });
        expect(body?.[2]).toMatchObject({ type: "text", text: "สถานะ: จ่ายแล้ว", scaling: true, wrap: true });
        expect(message.contents.footer?.contents[0]).toMatchObject({ type: "button", scaling: true });
        expect(validateNotificationFlexMessage(message)).toEqual([]);
    });

    it.each([
        "notification-line-flex-sample.json",
        "notification-line-flex-routine-sample.json",
    ])("validates documented LINE Flex fixture %s", (fileName) => {
        const samplePath = resolve(process.cwd(), "docs/integrations/examples", fileName);
        const sample: unknown = JSON.parse(readFileSync(samplePath, "utf8"));

        expect(validateNotificationFlexMessage(sample), fileName).toEqual([]);
    });

    it("keeps the application altText cap below the provider limit", () => {
        const message = buildNotificationFlex({
            module: "Routine",
            categoryLabel: "งานตามกำหนด",
            title: "งานใกล้ถึงกำหนด",
            altText: "ก".repeat(500),
            contents: [notificationFlexDetail("รายละเอียด", "ค่า")],
            actionLabel: "เปิดงาน",
            actionUrl: "https://liff.line.me/nhfapp-liff-id/routine?taskId=71",
        });

        expect(message.altText).toHaveLength(MAX_APPLICATION_ALT_TEXT_CHARACTERS);
        expect(message.altText.length).toBeLessThan(MAX_PROVIDER_ALT_TEXT_CHARACTERS);
        expect(validateNotificationFlexMessage(message)).toEqual([]);
    });

    it("uses compact details by default and stacks long content when requested", () => {
        const compact = notificationFlexDetail("วันครบกำหนด", "10 พ.ย. 2569");
        const stacked = notificationFlexDetail(
            "รายละเอียดงาน",
            "ตรวจสอบระบบสำรองข้อมูลและอุปกรณ์ประจำเดือนของหน่วยงาน",
            "stacked",
        );

        expect(compact).toMatchObject({
            type: "box",
            layout: "horizontal",
            contents: [
                { type: "text", text: "วันครบกำหนด:", wrap: true, scaling: true, flex: 1 },
                { type: "text", text: "10 พ.ย. 2569", wrap: true, scaling: true, flex: 2 },
            ],
        });
        expect(stacked).toMatchObject({
            type: "box",
            layout: "vertical",
            contents: [
                { type: "text", text: "รายละเอียดงาน:", wrap: true, scaling: true },
                { type: "text", text: "ตรวจสอบระบบสำรองข้อมูลและอุปกรณ์ประจำเดือนของหน่วยงาน", wrap: true, scaling: true },
            ],
        });
    });

    it("accepts the maximum LINE button label and URI lengths", () => {
        const uriPrefix = "https://app.example.com/";
        const message = createContractFixture({
            actionLabel: "a".repeat(MAX_ACTION_LABEL_CHARACTERS),
            actionUri: `${uriPrefix}${"x".repeat(MAX_ACTION_URI_CHARACTERS - uriPrefix.length)}`,
        });

        expect(validateNotificationFlexMessage(message)).toEqual([]);
    });

    it.each([
        "http://app.example.com/details",
        "https://app.example.com/details",
        "line://app/123",
        "tel:+6621234567",
    ])("accepts the LINE-supported URI scheme in %s", (actionUri) => {
        expect(validateNotificationFlexMessage(createContractFixture({ actionUri }))).toEqual([]);
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
        expect(validateNotificationFlexMessage(message).join("\n")).toContain(expectedError);
    });

    it("measures Bubble JSON in UTF-8 bytes rather than JavaScript string units", () => {
        const message = createContractFixture({ bodyText: "ก".repeat(12_000) });
        if (!isRecord(message) || !isRecord(message.contents)) throw new Error("Fixture is invalid");
        const bubbleJson = JSON.stringify(message.contents);

        expect(bubbleJson.length).toBeLessThan(MAX_BUBBLE_JSON_BYTES);
        expect(new TextEncoder().encode(bubbleJson).byteLength).toBeGreaterThan(MAX_BUBBLE_JSON_BYTES);
        expect(validateNotificationFlexMessage(message).join("\n")).toContain("bubble JSON exceeds");
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

        expect(validateNotificationFlexMessage(missingText).join("\n")).toContain(".text is required");
        expect(validateNotificationFlexMessage(missingAction).join("\n")).toContain(".action is required");
    });
});
