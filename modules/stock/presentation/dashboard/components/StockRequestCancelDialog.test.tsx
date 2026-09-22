import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { StockRequest } from "../context/types";
import { StockRequestCancelDialog } from "./StockRequestCancelDialog";

const REQUEST: StockRequest = {
    id: 41,
    requestedBy: 7,
    projectCode: "NHF-2569",
    status: "PENDING_ISSUE",
    note: null,
    issuedById: null,
    issuedAt: null,
    cancelReason: null,
    cancelledById: null,
    cancelledAt: null,
    createdAt: "2026-08-30T03:00:00.000Z",
    requester: {
        id: 7,
        name: "ผู้เบิก ทดสอบ",
        email: "requester@example.com",
        employee: {
            firstName: "ผู้เบิก",
            lastName: "ทดสอบ",
            nickname: null,
        },
    },
    issuer: null,
    canceller: null,
    items: [],
};

describe("StockRequestCancelDialog", () => {
    it("preserves an active reason but resets it across cancellation sessions", () => {
        const onClose = vi.fn();
        const onConfirm = vi.fn().mockResolvedValue(undefined);
        const { rerender } = render(
            <StockRequestCancelDialog
                request={REQUEST}
                loading={false}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );

        fireEvent.change(screen.getByLabelText("เหตุผล (ถ้ามี)"), {
            target: { value: "เหตุผลเดิม" },
        });
        rerender(
            <StockRequestCancelDialog
                request={{ ...REQUEST }}
                loading
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );
        expect(screen.getByLabelText("เหตุผล (ถ้ามี)"))
            .toHaveValue("เหตุผลเดิม");
        expect(screen.getByRole("button", { name: "กำลังดำเนินการ…" }))
            .toBeDisabled();

        rerender(
            <StockRequestCancelDialog
                request={REQUEST}
                loading={false}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: "ปิด" }));
        expect(onClose).toHaveBeenCalledTimes(1);

        rerender(
            <StockRequestCancelDialog
                request={null}
                loading={false}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );
        expect(screen.queryByLabelText("เหตุผล (ถ้ามี)"))
            .not.toBeInTheDocument();
        rerender(
            <StockRequestCancelDialog
                request={REQUEST}
                loading={false}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );
        expect(screen.getByLabelText("เหตุผล (ถ้ามี)"))
            .toHaveValue("");

        fireEvent.change(screen.getByLabelText("เหตุผล (ถ้ามี)"), {
            target: { value: "เหตุผลคำขอแรก" },
        });
        const otherRequest = { ...REQUEST, id: 42 };
        rerender(
            <StockRequestCancelDialog
                request={otherRequest}
                loading={false}
                onClose={onClose}
                onConfirm={onConfirm}
            />,
        );
        expect(screen.getByLabelText("เหตุผล (ถ้ามี)"))
            .toHaveValue("");

        fireEvent.change(screen.getByLabelText("เหตุผล (ถ้ามี)"), {
            target: { value: "  เหตุผลคำขอที่สอง  " },
        });
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันการยกเลิก" }));
        expect(onConfirm).toHaveBeenCalledWith(42, "เหตุผลคำขอที่สอง");
    });
});
