import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogScrollArea,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetScrollArea,
    SheetTitle,
} from "@/components/ui/sheet";

describe("modal scroll architecture", () => {
    it("uses an explicit area shell by default for DialogContent", () => {
        render(
            <Dialog open>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>รายละเอียด</DialogTitle>
                        <DialogDescription>ข้อมูลรายละเอียด</DialogDescription>
                    </DialogHeader>
                    <DialogScrollArea>
                        <p>เนื้อหาที่ยาว</p>
                    </DialogScrollArea>
                    <DialogFooter data-testid="dialog-actions">
                        <button type="button">บันทึก</button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>,
        );

        const dialog = screen.getByRole("dialog");
        const scrollArea = dialog.querySelector('[data-slot="dialog-scroll-area"]');
        const footer = screen.getByTestId("dialog-actions");
        const closeButton = dialog.querySelector('[data-slot="dialog-close"]');

        expect(dialog).toHaveAttribute("data-scroll-owner", "area");
        expect(scrollArea).toBeInTheDocument();
        expect(footer).toBeInTheDocument();
        expect(scrollArea).not.toContainElement(footer);
        expect(closeButton).toHaveClass("z-30");
    });

    it("keeps Sheet headers, one scroll area, and footers as separate siblings", () => {
        render(
            <Sheet open>
                <SheetContent side="bottom">
                    <SheetHeader>
                        <SheetTitle>แบบฟอร์ม</SheetTitle>
                        <SheetDescription>กรอกข้อมูล</SheetDescription>
                    </SheetHeader>
                    <SheetScrollArea>
                        <p>เนื้อหาที่ยาว</p>
                    </SheetScrollArea>
                    <SheetFooter data-testid="sheet-actions">
                        <button type="button">ยืนยัน</button>
                    </SheetFooter>
                </SheetContent>
            </Sheet>,
        );

        const sheet = screen.getByRole("dialog");
        const scrollArea = sheet.querySelector('[data-slot="sheet-scroll-area"]');
        const footer = screen.getByTestId("sheet-actions");
        const closeButton = sheet.querySelector('[data-slot="sheet-close"]');

        expect(sheet).toHaveAttribute("data-scroll-owner", "area");
        expect(sheet.querySelectorAll('[data-slot="sheet-scroll-area"]')).toHaveLength(1);
        expect(scrollArea).toBeInTheDocument();
        expect(footer).toBeInTheDocument();
        expect(scrollArea).not.toContainElement(footer);
        expect(closeButton).toHaveClass("z-30");
    });

    it("retains whole-content scrolling only when a caller opts in", () => {
        render(
            <Dialog open>
                <DialogContent scrollMode="content">
                    <DialogTitle>ข้อมูล</DialogTitle>
                </DialogContent>
            </Dialog>,
        );

        expect(screen.getByRole("dialog")).toHaveAttribute(
            "data-scroll-owner",
            "content",
        );
    });
});
