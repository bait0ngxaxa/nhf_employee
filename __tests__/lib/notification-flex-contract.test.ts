import { describe, expect, it } from "vitest";

import {
    buildNotificationFlex,
    notificationFlexDetail,
    notificationFlexStatus,
} from "@/lib/line/notification-flex";
import { NOTIFICATION_COLORS, NOTIFICATION_STATUS_COLORS } from "@/shared/notifications/presentation";
import type { LineFlexComponent, LineFlexMessage } from "@/types/api";

const FLEX_COMPONENT_PROPERTIES = {
    box: ["type", "layout", "contents", "spacing", "margin", "backgroundColor", "paddingAll", "flex"],
    button: ["type", "style", "height", "action", "color"],
    separator: ["type", "margin"],
    spacer: ["type", "size"],
    text: ["type", "text", "weight", "color", "size", "wrap", "flex", "margin"],
} satisfies Record<LineFlexComponent["type"], readonly string[]>;

function expectAllowedProperties(value: object, allowed: readonly string[]): void {
    expect(Object.keys(value).every((key) => allowed.includes(key))).toBe(true);
}

function expectValidComponent(component: LineFlexComponent): void {
    expectAllowedProperties(component, FLEX_COMPONENT_PROPERTIES[component.type]);

    if (component.type === "box") {
        const allowedChildren = component.layout === "baseline"
            ? ["text"]
            : ["box", "button", "separator", "text"];

        for (const child of component.contents) {
            expect(allowedChildren).toContain(child.type);
            expectValidComponent(child);
        }
    }

    if (component.type === "button") {
        expectAllowedProperties(component.action, ["type", "label", "uri"]);
        expect(component.action.type).toBe("uri");
    }
}

function expectValidFlexMessage(message: LineFlexMessage): void {
    expectAllowedProperties(message, ["type", "altText", "contents"]);
    expect(message.type).toBe("flex");
    expectAllowedProperties(message.contents, ["type", "header", "body", "footer"]);
    expect(message.contents.type).toBe("bubble");

    for (const block of [message.contents.header, message.contents.body, message.contents.footer]) {
        if (block) expectValidComponent(block);
    }
}

describe("shared LINE Flex presentation contract", () => {
    it("keeps long Thai content readable and emits only supported typed components", () => {
        const longTaskTitle = "งานตามกำหนด".repeat(50);
        const longOrganization = "หน่วยงานสาธารณสุข".repeat(30);
        const longActionLabel = "ตรวจสอบรายละเอียด".repeat(8);
        const longActionUrl = `https://app.example.com/routine/${"task-".repeat(60)}?view=details&source=line`;
        const message = buildNotificationFlex({
            module: "Routine",
            categoryLabel: "งานตามกำหนด",
            title: longTaskTitle,
            altText: longTaskTitle,
            contents: [
                notificationFlexDetail("หน่วยงาน", longOrganization),
                notificationFlexStatus("สถานะ: รอดำเนินการ", "warning"),
            ],
            actionLabel: longActionLabel,
            actionUrl: longActionUrl,
            status: "warning",
        });
        const serialized: unknown = JSON.parse(JSON.stringify(message));
        const title = message.contents.body?.contents[0];
        const details = message.contents.body?.contents[1];
        const button = message.contents.footer?.contents[0];

        expectValidFlexMessage(message);
        expect(serialized).toEqual(message);
        expect(message.altText).toHaveLength(400);
        expect(message.contents.header?.backgroundColor).toBe(NOTIFICATION_COLORS.brandPrimary);
        expect(title).toMatchObject({ text: longTaskTitle, color: NOTIFICATION_STATUS_COLORS.warning, wrap: true });
        expect(details).toMatchObject({ type: "box", layout: "vertical" });
        expect(JSON.stringify(details)).toContain(longOrganization);
        expect(button).toMatchObject({
            type: "button",
            color: NOTIFICATION_COLORS.brandAction,
            action: { type: "uri", label: longActionLabel, uri: longActionUrl },
        });
        expect(JSON.stringify(message)).not.toContain("fontFamily");
        expect(JSON.stringify(message)).not.toContain("backgroundGradient");
    });
});
