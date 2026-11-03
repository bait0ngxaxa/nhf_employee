import { loadEnvConfig } from "@next/env";

import type { LineFlexMessage } from "@/types/api";
import {
    assessLineValidationResponse,
    type LineValidationExpectation,
} from "./line-flex-validation-response";

const VALIDATION_ENDPOINT = "https://api.line.me/v2/bot/message/validate/push";
const ACTION_URI_PREFIX = "https://example.com/";

type BoundaryProbe = {
    readonly name: string;
    readonly message: LineFlexMessage;
    readonly expectation: LineValidationExpectation;
};

function createMessage(label: string, uri = "https://example.com/details", includeBody = true): LineFlexMessage {
    return {
        type: "flex",
        altText: "NHFapp validation fixture",
        contents: {
            type: "bubble",
            header: { type: "box", layout: "vertical", contents: [] },
            ...(includeBody
                ? { body: { type: "box", layout: "vertical", contents: [{ type: "text", text: "Boundary fixture", wrap: true }] } }
                : {}),
            footer: {
                type: "box",
                layout: "vertical",
                contents: [{ type: "button", action: { type: "uri", label, uri } }],
            },
        },
    };
}

function createProbes(): readonly BoundaryProbe[] {
    const uri10000 = `${ACTION_URI_PREFIX}${"x".repeat(10_000 - ACTION_URI_PREFIX.length)}`;
    const uri10001 = `${ACTION_URI_PREFIX}${"x".repeat(10_001 - ACTION_URI_PREFIX.length)}`;

    return [
        { name: "ASCII label: 40 characters", message: createMessage("a".repeat(40)), expectation: { kind: "accept" } },
        {
            name: "ASCII label: 41 characters",
            message: createMessage("a".repeat(41)),
            expectation: { kind: "reject", boundary: { property: "action.label", maxCharacters: 40 } },
        },
        {
            name: "Thai base + tone mark: 40 graphemes / 80 code points / 80 UTF-16 units",
            message: createMessage("ก้".repeat(40)),
            expectation: { kind: "observe", boundary: { property: "action.label", maxCharacters: 40 } },
        },
        {
            name: "Thai base + tone mark: 41 graphemes / 82 code points / 82 UTF-16 units",
            message: createMessage("ก้".repeat(41)),
            expectation: { kind: "observe", boundary: { property: "action.label", maxCharacters: 40 } },
        },
        {
            name: "Emoji: 40 graphemes / 40 code points / 80 UTF-16 units",
            message: createMessage("😀".repeat(40)),
            expectation: { kind: "observe", boundary: { property: "action.label", maxCharacters: 40 } },
        },
        {
            name: "Emoji: 41 graphemes / 41 code points / 82 UTF-16 units",
            message: createMessage("😀".repeat(41)),
            expectation: { kind: "observe", boundary: { property: "action.label", maxCharacters: 40 } },
        },
        { name: "URI: 10,000 characters", message: createMessage("เปิด", uri10000), expectation: { kind: "accept" } },
        {
            name: "URI: 10,001 characters",
            message: createMessage("เปิด", uri10001),
            expectation: { kind: "reject", boundary: { property: "action.uri", maxCharacters: 10_000 } },
        },
        {
            name: "Bubble without body and with an empty Box contents array",
            message: createMessage("เปิดรายละเอียด", undefined, false),
            expectation: { kind: "accept" },
        },
    ];
}

async function validateProbe(probe: BoundaryProbe, token: string): Promise<boolean> {
    const response = await fetch(VALIDATION_ENDPOINT, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: [probe.message] }),
    });
    const result = assessLineValidationResponse(response.status, await response.text(), probe.expectation);
    process.stdout.write(`${probe.name}: ${result.summary}\n`);
    return result.passed;
}

async function main(): Promise<void> {
    loadEnvConfig(process.cwd());
    const token = process.env.LINE_APP_CHANNEL_ACCESS_TOKEN;
    if (!token) {
        throw new Error("Set LINE_APP_CHANNEL_ACCESS_TOKEN in the environment or a local .env file.");
    }

    let failures = 0;
    for (const probe of createProbes()) {
        if (!await validateProbe(probe, token)) failures += 1;
    }

    if (failures > 0) {
        throw new Error(`${failures} LINE provider boundary expectation(s) did not match.`);
    }
}

void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "LINE Flex boundary validation failed.");
    process.exitCode = 1;
});
