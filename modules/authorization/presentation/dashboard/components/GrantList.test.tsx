import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { GrantList } from "./GrantList";
import type { AuthorizationAdministrationGrantProjectionData } from "../types";

const grant = {
    capabilityKey: "audit.read",
    scope: "ALL",
    capability: {
        key: "audit.read",
        registered: true,
        domain: "audit",
        description: "ดูบันทึกการใช้งานระบบ",
        supportedScopes: ["ALL"],
        supportedChannels: ["DASHBOARD"],
        runtimeAuthorizationMode: "CENTRAL_ONLY",
        administrativeStatus: "GRANTABLE",
        administrativelyGrantable: true,
    },
    validation: { status: "VALID" },
} satisfies AuthorizationAdministrationGrantProjectionData;

const invalidGrant = {
    capabilityKey: "legacy.permission",
    scope: "LEGACY",
    capability: null,
    validation: {
        status: "INVALID",
        code: "UNKNOWN_PERSISTED_CAPABILITY",
        reason: "raw resolver details must stay out of the administration UI",
    },
} satisfies AuthorizationAdministrationGrantProjectionData;

describe("GrantList", () => {
    it("uses business removal copy and preserves the exact grant payload", async () => {
        const onRemove = vi.fn(async () => undefined);
        render(
            <GrantList
                title="สิทธิ์เฉพาะบุคคล"
                description="สิทธิ์เพิ่มเติมเฉพาะผู้ใช้"
                source="USER"
                grants={[grant]}
                busy={false}
                onAdd={vi.fn()}
                onRemove={onRemove}
            />,
        );

        expect(screen.getByText("ดูบันทึกการใช้งานระบบ")).toBeInTheDocument();
        expect(screen.getByText("ทั้งหมด")).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: /นำสิทธิ์ ดูบันทึกการใช้งานระบบ ออกจากรายการ/ }));
        const dialog = await screen.findByRole("alertdialog");
        expect(within(dialog).getByText(/สิทธิ์พื้นฐานของระบบหรือสิทธิ์จากแหล่งอื่นอาจยังคงอยู่/)).toBeInTheDocument();
        expect(within(dialog).queryByText("audit.read")).not.toBeInTheDocument();

        fireEvent.click(within(dialog).getByRole("button", { name: "นำสิทธิ์ออก" }));

        await vi.waitFor(() => expect(onRemove).toHaveBeenCalledWith(grant));
    });

    it("keeps invalid grant diagnostics human-readable", () => {
        render(
            <GrantList
                title="สิทธิ์ของทีม"
                description="สิทธิ์เพิ่มเติมของทีม"
                source="TEAM"
                grants={[invalidGrant]}
                busy={false}
                onAdd={vi.fn()}
                onRemove={vi.fn(async () => undefined)}
            />,
        );

        expect(screen.getByText("ข้อมูลสิทธิ์นี้ต้องตรวจสอบก่อนจึงจะนำไปใช้งานได้")).toBeInTheDocument();
        expect(screen.queryByText(invalidGrant.validation.reason)).not.toBeInTheDocument();
        expect(screen.queryByText("UNKNOWN_PERSISTED_CAPABILITY")).not.toBeInTheDocument();
    });
});
