import { describe, expect, it } from "vitest";

import { normalizeITNotificationEmail } from "./email-recipient";

describe("IT notification email recipient normalization", () => {
    it("trims and lowercases a valid account email", () => {
        expect(normalizeITNotificationEmail(" Person@Example.COM "))
            .toBe("person@example.com");
    });

    it.each([
        null,
        undefined,
        "",
        "invalid",
        "person\r\n@example.com",
        "operator@temp.local",
    ])(
        "rejects unavailable or unsafe account email %s",
        (email) => {
            expect(normalizeITNotificationEmail(email)).toBeNull();
        },
    );
});
