import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { EmailRequestAccessFields } from "./EmailRequestAccessFields";
import type { SharedDriveOption } from "../../../domain/email-request/constants";

describe("EmailRequestAccessFields", () => {
    it("renders controlled document system and shared drive fields", () => {
        const onChange = vi.fn();
        const selectedDrives = new Set<SharedDriveOption>(["it"]);

        render(
            <EmailRequestAccessFields
                documentSystemDecision="UNDECIDED"
                sharedDriveDecision="REQUIRED"
                selectedDrives={selectedDrives}
                onChange={onChange}
            />,
        );

        const document = within(screen.getByRole("group", { name: "ระบบสารบรรณ" }));
        expect(document.getByRole("radio", { name: /ยังไม่ทราบ/ })).toBeChecked();
        expect(document.getByRole("radio", { name: "ไม่ต้องใช้" })).not.toBeChecked();
        expect(document.getByRole("radio", { name: "ต้องใช้" })).not.toBeChecked();
        expect(screen.getByRole("checkbox", { name: "it" })).toBeChecked();
        expect(
            screen.getByText("เลือกอย่างน้อยหนึ่งรายการ (เลือกได้หลายรายการ)"),
        ).toBeInTheDocument();

        fireEvent.click(
            document.getByRole("radio", { name: "ต้องใช้" }),
        );
        fireEvent.click(screen.getByRole("checkbox", { name: "account" }));

        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it("disables all controls while the request is submitting", () => {
        const selectedDrives = new Set<SharedDriveOption>(["it"]);

        render(
            <EmailRequestAccessFields
                documentSystemDecision="REQUIRED"
                sharedDriveDecision="REQUIRED"
                selectedDrives={selectedDrives}
                disabled
                onChange={vi.fn()}
            />,
        );

        expect(
            within(screen.getByRole("group", { name: "ระบบสารบรรณ" })).getByRole("radio", { name: "ต้องใช้" }),
        ).toBeDisabled();
        expect(screen.getByRole("checkbox", { name: "it" })).toBeDisabled();
    });

    it.each(["UNDECIDED", "NOT_REQUIRED"] as const)("hides drive selection for %s", (sharedDriveDecision) => {
        render(<EmailRequestAccessFields documentSystemDecision="UNDECIDED" sharedDriveDecision={sharedDriveDecision} selectedDrives={new Set()} onChange={vi.fn()} />);
        expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
        expect(within(screen.getByRole("group", { name: "Shared Drive" })).getByRole("radio", { name: sharedDriveDecision === "UNDECIDED" ? /ยังไม่ทราบ/ : "ไม่ต้องใช้" })).toBeChecked();
    });

    it("keeps independent accessible field identities when creation and the detail editor coexist", () => {
        const { container } = render(<>
            <form><EmailRequestAccessFields sharedDriveFieldId="sharedDriveAccess" documentSystemDecision="REQUIRED" sharedDriveDecision="REQUIRED" selectedDrives={new Set()} onChange={vi.fn()} /></form>
            <form><EmailRequestAccessFields documentSystemDecision="REQUIRED" sharedDriveDecision="REQUIRED" selectedDrives={new Set()} onChange={vi.fn()} /></form>
        </>);
        const ids = Array.from(container.querySelectorAll("[id]"), (element) => element.id);
        expect(new Set(ids).size).toBe(ids.length);
    });
});
