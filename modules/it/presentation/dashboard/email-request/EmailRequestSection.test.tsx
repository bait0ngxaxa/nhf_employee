import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("./EmailRequestProvider", () => ({
    EmailRequestProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("./EmailRequestForm", () => ({
    EmailRequestForm: () => <div data-testid="email-request-form" />,
}));
vi.mock("./EmailRequestHistory", () => ({
    EmailRequestHistory: () => <div data-testid="email-request-history" />,
}));

import { EmailRequestSection } from "./EmailRequestSection";

describe("EmailRequestSection capability projection", () => {
    it.each([
        {
            label: "create-only",
            capabilities: { canReadRequests: false, canCreateRequests: true },
            form: true,
            history: false,
        },
        {
            label: "read-only",
            capabilities: { canReadRequests: true, canCreateRequests: false },
            form: false,
            history: true,
        },
        {
            label: "read and create",
            capabilities: { canReadRequests: true, canCreateRequests: true },
            form: true,
            history: true,
        },
    ])("renders the legitimate $label surfaces only", ({ capabilities, form, history }) => {
        render(<EmailRequestSection capabilities={capabilities} />);

        if (form) {
            expect(screen.getByTestId("email-request-form")).toBeInTheDocument();
        } else {
            expect(screen.queryByTestId("email-request-form")).not.toBeInTheDocument();
        }
        if (!history) {
            expect(screen.queryByTestId("email-request-history")).not.toBeInTheDocument();
        }
        if (history) {
            expect(screen.getByTestId("email-request-history")).toBeInTheDocument();
        }
    });
});
