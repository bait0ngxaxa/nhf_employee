import { describe, expect, it } from "vitest";

import { getUserDisplayName } from "./display";

describe("getUserDisplayName", () => {
    it("prefers Employee identity over User name and email", () => {
        expect(getUserDisplayName({
            name: "ชื่อเดิม",
            email: "employee@example.com",
            employee: {
                firstName: "สมชาย",
                lastName: "ใจดี",
                nickname: "ชาย",
            },
        })).toBe("สมชาย ใจดี (ชาย)");
    });

    it("falls back from User name to email", () => {
        expect(getUserDisplayName({
            name: " ผู้ดูแลระบบ ",
            email: "admin@example.com",
            employee: null,
        })).toBe("ผู้ดูแลระบบ");
        expect(getUserDisplayName({
            name: " ",
            email: " admin@example.com ",
            employee: null,
        })).toBe("admin@example.com");
    });

    it("uses the supplied fallback when all display values are blank", () => {
        expect(getUserDisplayName({
            name: " ",
            email: " ",
            employee: {
                firstName: " ",
                lastName: " ",
                nickname: " ",
            },
        })).toBe("ไม่ระบุชื่อ");
        expect(getUserDisplayName({ employee: null }, "ผู้รับการแจ้งเตือน")).toBe(
            "ผู้รับการแจ้งเตือน",
        );
    });
});
