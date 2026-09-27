import { describe, expect, it } from "vitest";

import { IT_TICKET_CATEGORY_SEEDS } from "@/shared/it-ticket-category-seeds";

describe("IT Ticket category seed definitions", () => {
    it("defines the unique canonical active POC/UAT categories", () => {
        const expected = [
            { key: "HARDWARE", name: "อุปกรณ์คอมพิวเตอร์", isActive: true },
            { key: "SOFTWARE", name: "โปรแกรม / ระบบงาน", isActive: true },
            { key: "NETWORK", name: "เครือข่าย / อินเทอร์เน็ต", isActive: true },
            { key: "ACCOUNT_ACCESS", name: "บัญชีผู้ใช้ / สิทธิ์การเข้าถึง", isActive: true },
            { key: "EMAIL", name: "อีเมล / Microsoft 365", isActive: true },
            { key: "PRINTER_PERIPHERAL", name: "เครื่องพิมพ์ / อุปกรณ์ต่อพ่วง", isActive: true },
            { key: "OTHER", name: "อื่น ๆ", isActive: true },
        ];
        const keys = IT_TICKET_CATEGORY_SEEDS.map(({ key }) => key);
        const names = IT_TICKET_CATEGORY_SEEDS.map(({ name }) => name);

        expect(new Set(keys).size).toBe(keys.length);
        expect(new Set(names).size).toBe(names.length);
        expect(IT_TICKET_CATEGORY_SEEDS).toEqual(expected);
    });
});
