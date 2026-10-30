import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AnnouncementTicker } from "./AnnouncementTicker";
import { AnnouncementManager } from "./AnnouncementManager";
import type { AnnouncementState } from "../domain/contracts";

const mocks = vi.hoisted(() => ({ save: vi.fn(), load: vi.fn(), refresh: vi.fn() }));
vi.mock("./api", () => ({ saveAnnouncement: mocks.save, loadManagedAnnouncement: mocks.load }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
// jsdom checks React behavior; the browser smoke script verifies the real CSS.
vi.mock("./AnnouncementTicker.module.css", () => ({ default: {
    ticker: "ticker", viewport: "viewport", track: "track", item: "item", copy: "copy",
} }));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

const initial: AnnouncementState = { content: "ประกาศ", published: false, version: 0, authorId: null,
    updatedById: null, createdAt: "2026-10-30T00:00:00Z", updatedAt: "2026-10-30T00:00:00Z" };

describe("Announcement presentation", () => {
    it("renders nothing without a published announcement", () => {
        const { container } = render(<AnnouncementTicker content={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("renders text safely and hides only the seamless copy from assistive technology", () => {
        const content = '<img src=x onerror="alert(1)">ข่าว';
        const { container } = render(<AnnouncementTicker content={content} />);
        expect(container.querySelector("img")).toBeNull(); expect(container.querySelector("script")).toBeNull();
        const paragraphs = screen.getAllByText(content);
        expect(paragraphs).toHaveLength(2);
        expect(paragraphs[0]).not.toHaveAttribute("aria-hidden");
        expect(paragraphs[1]).toHaveAttribute("aria-hidden", "true");
        expect(container.querySelector("marquee")).toBeNull();
        expect(container.querySelector("[aria-live]")).toBeNull();
    });

    it("provides a keyboard-operable pause/read-full-text control", () => {
        render(<AnnouncementTicker content={"ประกาศยาว".repeat(50)} />);
        const pause = screen.getByRole("button", { name: "หยุดและอ่านข้อความ" });
        pause.focus(); expect(pause).toHaveFocus(); fireEvent.click(pause);
        expect(screen.getByRole("region", { name: "ประกาศ" })).toHaveAttribute("data-paused", "true");
        expect(screen.getByRole("button", { name: "เลื่อนข้อความต่อ" })).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(screen.getByRole("button", { name: "เลื่อนข้อความต่อ" }));
        expect(screen.getByRole("region")).toHaveAttribute("data-paused", "false");
    });

    it("previews plain text and publishes the server version", async () => {
        mocks.save.mockResolvedValue({ ...initial, content: "ข่าวใหม่", published: true, version: 1 });
        const { container } = render(<AnnouncementManager initialState={initial} />);
        fireEvent.change(screen.getByLabelText("ข้อความประกาศ"), { target: { value: "<b>ข่าว</b>" } });
        expect(container.querySelector("b")).toBeNull();
        fireEvent.change(screen.getByLabelText("ข้อความประกาศ"), { target: { value: "ข่าวใหม่" } });
        fireEvent.click(screen.getByRole("button", { name: "บันทึกและเผยแพร่" }));
        await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ action: "publish", content: "ข่าวใหม่", version: 0 }));
        expect(await screen.findByText("เผยแพร่ประกาศแล้ว")).toBeVisible();
    });

    it("retains unsaved text after a conflict and confirms before reloading", async () => {
        mocks.save.mockRejectedValue(new Error("ประกาศถูกแก้ไขแล้ว"));
        mocks.load.mockResolvedValue({ ...initial, content: "ข้อมูลล่าสุด", version: 1 });
        render(<AnnouncementManager initialState={initial} />);
        fireEvent.change(screen.getByLabelText("ข้อความประกาศ"), { target: { value: "ฉบับของฉัน" } });
        fireEvent.click(screen.getByRole("button", { name: "บันทึกและเผยแพร่" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("ประกาศถูกแก้ไขแล้ว");
        expect(screen.getByLabelText("ข้อความประกาศ")).toHaveValue("ฉบับของฉัน");
        fireEvent.click(screen.getByRole("button", { name: "โหลดข้อมูลล่าสุด" }));
        expect(mocks.load).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "ยืนยันโหลดใหม่" }));
        await waitFor(() => expect(screen.getByLabelText("ข้อความประกาศ")).toHaveValue("ข้อมูลล่าสุด"));
    });

    it("disables saving empty content and unpublishing an inactive announcement", () => {
        render(<AnnouncementManager initialState={{ ...initial, content: "" }} />);
        expect(screen.getByRole("button", { name: "บันทึกและเผยแพร่" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "บันทึกฉบับร่าง" })).toBeDisabled();
        expect(screen.getByRole("button", { name: "ยกเลิกเผยแพร่" })).toBeDisabled();
    });
});
