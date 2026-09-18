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
        expect(within(dialog).getByText("audit.read").closest("details")).not.toHaveAttribute("open");

        fireEvent.click(within(dialog).getByRole("button", { name: "นำสิทธิ์ออก" }));

        await vi.waitFor(() => expect(onRemove).toHaveBeenCalledWith(grant));
    });
});
