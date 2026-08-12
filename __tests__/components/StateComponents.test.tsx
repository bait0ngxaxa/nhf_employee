import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
    EmptyState,
    ErrorState,
    LoadingState,
    OfflineState,
    PermissionState,
} from "@/components/ui/state";

describe("shared state components", () => {
    it("exposes loading feedback for screen readers", () => {
        render(<LoadingState label="กำลังโหลดรายการข้อมูล" />);

        expect(
            screen.getByRole("status", {
                name: "กำลังโหลดรายการข้อมูล",
            }),
        ).toHaveAttribute("aria-busy", "true");
    });

    it("renders a clear error action and invokes it", () => {
        const onRetry = vi.fn();

        render(
            <ErrorState
                title="โหลดรายการข้อมูลไม่สำเร็จ"
                action={{ label: "ลองใหม่", onClick: onRetry }}
            />,
        );

        expect(screen.getByRole("alert")).toHaveTextContent(
            "โหลดรายการข้อมูลไม่สำเร็จ",
        );
        fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));

        expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it("provides consistent empty, permission, and offline messages", () => {
        render(
            <>
                <EmptyState title="ไม่พบรายการข้อมูล" />
                <PermissionState title="กรุณาเข้าสู่ระบบ" />
                <OfflineState title="ไม่มีการเชื่อมต่อ" />
            </>,
        );

        expect(screen.getByRole("heading", { name: "ไม่พบรายการข้อมูล" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "กรุณาเข้าสู่ระบบ" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "ไม่มีการเชื่อมต่อ" })).toBeInTheDocument();
    });
});
