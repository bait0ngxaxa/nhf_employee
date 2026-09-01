import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { LineAddFriendCard } from "@/components/dashboard/line/LineAddFriendCard";

describe("LineAddFriendCard", () => {
    it("renders the Thai onboarding copy and the selected QR asset", () => {
        render(<LineAddFriendCard />);

        expect(
            screen.getByRole("heading", {
                name: "เพิ่ม NHF เป็นเพื่อนใน LINE",
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                "รับการแจ้งเตือนและเข้าใช้งานบริการ NHF ผ่าน LINE ได้สะดวกยิ่งขึ้น",
            ),
        ).toBeInTheDocument();

        const qrImages = screen.getAllByAltText(
            "QR Code สำหรับเพิ่ม NHF เป็นเพื่อนใน LINE",
        );
        expect(qrImages.length).toBeGreaterThan(0);
        expect(qrImages[0]).toHaveAttribute("src", expect.stringContaining("950gaxzt"));
        expect(
            screen.getAllByText("สแกน QR Code เพื่อเพิ่มเพื่อน").length,
        ).toBeGreaterThan(0);
    });

    it("does not render a direct action without a verified URL", () => {
        render(<LineAddFriendCard />);

        expect(
            screen.queryByRole("link", { name: /เพิ่มเพื่อนใน LINE/ }),
        ).not.toBeInTheDocument();
        expect(screen.getByText("ดู QR Code")).toBeInTheDocument();
    });

    it("renders the direct action only when a URL is supplied", () => {
        render(
            <LineAddFriendCard addFriendUrl="https://example.test/line-add-friend" />,
        );

        const link = screen.getByRole("link", {
            name: "เพิ่มเพื่อนใน LINE (เปิดในแท็บใหม่)",
        });
        expect(link).toHaveAttribute(
            "href",
            "https://example.test/line-add-friend",
        );
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });
});
