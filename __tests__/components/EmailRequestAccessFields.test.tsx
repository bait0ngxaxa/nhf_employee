import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmailRequestAccessFields } from "@/components/email/EmailRequestAccessFields";
import type { SharedDriveOption } from "@/constants/email-request";

describe("EmailRequestAccessFields", () => {
    it("renders controlled document system and shared drive fields", () => {
        const onChange = vi.fn();
        const selectedDrives = new Set<SharedDriveOption>(["it"]);

        render(
            <EmailRequestAccessFields
                needsDocumentSystem={false}
                selectedDrives={selectedDrives}
                onChange={onChange}
            />,
        );

        expect(
            screen.getByRole("switch", {
                name: "ต้องการใช้ระบบสารบรรณ",
            }),
        ).not.toBeChecked();
        expect(screen.getByRole("checkbox", { name: "it" })).toBeChecked();
        expect(
            screen.getByText("เลือกได้หลายรายการ, เลือกแล้ว 1 จาก 17 รายการ"),
        ).toBeInTheDocument();

        fireEvent.click(
            screen.getByRole("switch", {
                name: "ต้องการใช้ระบบสารบรรณ",
            }),
        );
        fireEvent.click(screen.getByRole("checkbox", { name: "account" }));

        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it("disables all controls while the request is submitting", () => {
        const selectedDrives = new Set<SharedDriveOption>(["it"]);

        render(
            <EmailRequestAccessFields
                needsDocumentSystem
                selectedDrives={selectedDrives}
                disabled
                onChange={vi.fn()}
            />,
        );

        expect(
            screen.getByRole("switch", {
                name: "ต้องการใช้ระบบสารบรรณ",
            }),
        ).toBeDisabled();
        expect(screen.getByRole("checkbox", { name: "it" })).toBeDisabled();
    });
});
