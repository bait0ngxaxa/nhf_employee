import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { EmailRequestSectionSkeleton } from "@/components/dashboard/feedback/EmailRequestSectionSkeleton";

describe("EmailRequestSectionSkeleton", () => {
    it("renders an accessible loading state for the email request page", () => {
        render(<EmailRequestSectionSkeleton />);

        expect(
            screen.getByRole("status", {
                name: "กำลังโหลดหน้าส่งคำร้องพนักงานใหม่",
            }),
        ).toBeInTheDocument();
    });
});
