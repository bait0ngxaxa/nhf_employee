import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LineAddFriendCard } from "@/components/dashboard/line/LineAddFriendCard";
import { buildLiffUrl } from "@/lib/line/liff-links";
import { APP_ROUTES } from "@/lib/ssot/routes";

vi.mock("@/lib/line/liff-links", () => ({ buildLiffUrl: vi.fn(() => "https://liff.line.me/test") }));
function respond(status: string): void {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status }) }));
}
beforeEach(() => { vi.resetAllMocks(); vi.mocked(buildLiffUrl).mockReturnValue("https://liff.line.me/test"); });
afterEach(() => { vi.unstubAllGlobals(); });

describe("LineAddFriendCard", () => {
    it("shows benefits, QR, ID and the mobile onboarding actions for an unlinked account", async () => {
        respond("unlinked");
        render(<LineAddFriendCard />);
        expect(screen.getByRole("heading", { name: "NHFapp ผ่าน LINE" })).toBeInTheDocument();
        expect(screen.queryByAltText("QR Code สำหรับเพิ่ม NHF เป็นเพื่อนใน LINE")).not.toBeInTheDocument();
        expect(screen.queryByRole("link", { name: "เปิด NHFapp ใน LINE" })).not.toBeInTheDocument();
        expect(screen.queryByText(/เพิ่มเพื่อน LINE Official Account/)).not.toBeInTheDocument();
        const trigger = screen.getByRole("button", { name: "ดูวิธีเริ่มใช้งาน" });
        fireEvent.click(trigger);
        expect(screen.getByRole("dialog", { name: "เริ่มใช้งาน NHFapp ผ่าน LINE" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "เริ่มใช้งาน NHFapp ผ่าน LINE" })).toHaveFocus();
        for (const step of ["1. เพิ่มเพื่อน LINE Official Account", "2. เชื่อมบัญชี NHFapp", "3. เริ่มใช้บริการ"]) expect(screen.getByText(step)).toBeInTheDocument();
        for (const text of ["เบิกวัสดุและติดตามคำขอ", "ดูข้อมูลและจัดการวันลา", "ติดตามงาน Routine", "แจ้งปัญหา IT และติดตาม Ticket"]) expect(screen.getByText(new RegExp(text))).toBeInTheDocument();
        expect(screen.getByText("บริการที่ใช้งานได้ขึ้นอยู่กับสิทธิ์ของบัญชีคุณ")).toBeInTheDocument();
        expect(screen.getByAltText("QR Code สำหรับเพิ่ม NHF เป็นเพื่อนใน LINE")).toHaveAttribute("src", expect.stringContaining("950gaxzt"));
        expect(screen.getByText("LINE OA ID: @950gaxzt")).toBeInTheDocument();
        const add = await screen.findByRole("link", { name: "เพิ่มเพื่อนใน LINE" });
        expect(add).toHaveAttribute("href", "https://line.me/R/ti/p/%40950gaxzt");
        expect(add.parentElement).toHaveClass("[@media(min-width:768px)_and_(pointer:fine)]:hidden");
        expect(screen.getByRole("link", { name: "เชื่อมบัญชี NHFapp" })).toHaveAttribute("href", "https://liff.line.me/test");
        expect(buildLiffUrl).toHaveBeenCalledWith(APP_ROUTES.line.root);
        expect(fetch).toHaveBeenCalledTimes(1);
        fireEvent.click(screen.getByRole("button", { name: "ปิด" }));
        await waitFor(() => expect(trigger).toHaveFocus());
        fireEvent.click(trigger);
        expect(fetch).toHaveBeenCalledTimes(1);
    });
    it("copies the exact ID and reports success or failure", async () => {
        respond("unlinked");
        const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error());
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
        render(<LineAddFriendCard />);
        fireEvent.click(screen.getByRole("button", { name: "ดูวิธีเริ่มใช้งาน" }));
        fireEvent.click(screen.getByRole("button", { name: "คัดลอก ID" }));
        await screen.findByText("คัดลอก ID แล้ว");
        expect(writeText).toHaveBeenCalledWith("@950gaxzt");
        fireEvent.click(screen.getByRole("button", { name: "คัดลอก ID" }));
        await screen.findByText("คัดลอกไม่สำเร็จ กรุณาคัดลอก ID ด้วยตนเอง");
    });
    it("shows linked status without claiming friendship and limits LIFF action to mobile", async () => {
        respond("linked"); render(<LineAddFriendCard />);
        const directLink = await screen.findByRole("link", { name: "เปิด NHFapp ใน LINE" });
        expect(directLink).toHaveAttribute("href", "https://liff.line.me/test");
        expect(directLink).toHaveClass("[@media(min-width:768px)_and_(pointer:fine)]:hidden");
        fireEvent.click(screen.getByRole("button", { name: "ดูวิธีเริ่มใช้งาน" }));
        await screen.findByText("บัญชี NHFapp เชื่อมกับ LINE แล้ว");
        const link = screen.getByRole("link", { name: "เปิดบริการ NHFapp ใน LINE" });
        expect(link.parentElement).toHaveClass("[@media(min-width:768px)_and_(pointer:fine)]:hidden");
        expect(screen.getByRole("link", { name: "เพิ่มเพื่อนใน LINE" })).toBeInTheDocument();
        expect(screen.queryByText(/เป็นเพื่อนแล้ว/)).not.toBeInTheDocument();
    });
    it("keeps unknown status neutral and allows retry after a failure", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error()).mockResolvedValueOnce({ ok: true, json: async () => ({ status: "unlinked" }) }));
        render(<LineAddFriendCard />);
        fireEvent.click(screen.getByRole("button", { name: "ดูวิธีเริ่มใช้งาน" }));
        expect(screen.getByText("กำลังตรวจสอบสถานะการเชื่อมบัญชี…")).toBeInTheDocument();
        expect(screen.queryByText(/ยังไม่เชื่อมบัญชี/)).not.toBeInTheDocument();
        await screen.findByRole("button", { name: "ลองใหม่" });
        expect(screen.getByRole("link", { name: "เพิ่มเพื่อนใน LINE" })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "ลองใหม่" }));
        await screen.findByRole("link", { name: "เชื่อมบัญชี NHFapp" });
    });
    it.each([403, 404])("keeps OA access when status returns %i", async (code) => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: code }));
        render(<LineAddFriendCard />);
        fireEvent.click(screen.getByRole("button", { name: "ดูวิธีเริ่มใช้งาน" }));
        await screen.findByText("บัญชีนี้ยังไม่พร้อมใช้บริการผ่าน LINE");
        expect(screen.getByRole("link", { name: "เพิ่มเพื่อนใน LINE" })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /เชื่อมบัญชี NHFapp|เปิดบริการ NHFapp/ })).not.toBeInTheDocument();
    });
    it.each(["linked", "unlinked"])("handles missing LIFF configuration for %s", async (status) => {
        vi.mocked(buildLiffUrl).mockImplementation(() => { throw new Error(); });
        respond(status); render(<LineAddFriendCard />);
        fireEvent.click(screen.getByRole("button", { name: "ดูวิธีเริ่มใช้งาน" }));
        await screen.findByText(status === "linked" ? "บัญชี NHFapp เชื่อมกับ LINE แล้ว" : "เพิ่มเพื่อน แล้วเชื่อมบัญชี NHFapp เพียงครั้งเดียวเพื่อใช้บริการ");
        expect(screen.getByRole("link", { name: "เพิ่มเพื่อนใน LINE" })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /เชื่อมบัญชี NHFapp|เปิดบริการ NHFapp/ })).not.toBeInTheDocument();
        expect(screen.getByText(/ยังไม่พร้อมใช้งาน/)).toBeInTheDocument();
    });
});
