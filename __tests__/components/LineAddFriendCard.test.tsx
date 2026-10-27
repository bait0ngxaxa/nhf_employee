import { fireEvent, render, screen } from "@testing-library/react";
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
        expect(screen.getByRole("heading", { name: "ใช้ NHFapp บนมือถือ ผ่าน LINE ได้ง่ายขึ้น" })).toBeInTheDocument();
        expect(screen.getByText("ไม่ต้องคอยเปิดเว็บไซต์ เพียงเข้า LINE ก็สามารถเข้าถึงบริการของ NHFapp ที่คุณมีสิทธิ์ใช้งานได้")).toBeInTheDocument();
        for (const text of ["เบิกวัสดุและติดตามคำขอ", "ดูข้อมูลและจัดการวันลา", "ติดตามงาน Routine", "แจ้งปัญหา IT และติดตาม Ticket"]) expect(screen.getByText(new RegExp(text))).toBeInTheDocument();
        expect(screen.getByText("บริการที่ใช้งานได้ขึ้นอยู่กับสิทธิ์ของบัญชีคุณ")).toBeInTheDocument();
        expect(screen.getByAltText("QR Code สำหรับเพิ่ม NHF เป็นเพื่อนใน LINE")).toHaveAttribute("src", expect.stringContaining("950gaxzt"));
        expect(screen.getByText("LINE OA ID: @950gaxzt")).toBeInTheDocument();
        const add = await screen.findByRole("link", { name: "เพิ่มเพื่อนใน LINE" });
        expect(add).toHaveAttribute("href", "https://line.me/R/ti/p/%40950gaxzt");
        expect(add.parentElement).toHaveClass("[@media(min-width:768px)_and_(pointer:fine)]:hidden");
        expect(screen.getByRole("link", { name: "เชื่อมบัญชี NHFapp" })).toHaveAttribute("href", "https://liff.line.me/test");
        expect(buildLiffUrl).toHaveBeenCalledWith(APP_ROUTES.line.root);
    });
    it("copies the exact ID and reports success or failure", async () => {
        respond("unlinked");
        const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error());
        Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
        render(<LineAddFriendCard />);
        fireEvent.click(screen.getByRole("button", { name: "คัดลอก ID" }));
        await screen.findByText("คัดลอก ID แล้ว");
        expect(writeText).toHaveBeenCalledWith("@950gaxzt");
        fireEvent.click(screen.getByRole("button", { name: "คัดลอก ID" }));
        await screen.findByText("คัดลอกไม่สำเร็จ กรุณาคัดลอก ID ด้วยตนเอง");
    });
    it("shows linked status without claiming friendship and limits LIFF action to mobile", async () => {
        respond("linked"); render(<LineAddFriendCard />);
        await screen.findByText("บัญชี NHFapp เชื่อมกับ LINE แล้ว");
        const link = screen.getByRole("link", { name: "เปิดบริการ NHFapp ใน LINE" });
        expect(link.parentElement).toHaveClass("[@media(min-width:768px)_and_(pointer:fine)]:hidden");
        expect(screen.getByRole("link", { name: "เพิ่มเพื่อนใน LINE" })).toBeInTheDocument();
        expect(screen.queryByText(/เป็นเพื่อนแล้ว/)).not.toBeInTheDocument();
    });
    it("keeps unknown status neutral and allows retry after a failure", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(new Error()).mockResolvedValueOnce({ ok: true, json: async () => ({ status: "unlinked" }) }));
        render(<LineAddFriendCard />);
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
        await screen.findByText("บัญชีนี้ยังไม่พร้อมใช้บริการผ่าน LINE");
        expect(screen.getByRole("link", { name: "เพิ่มเพื่อนใน LINE" })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /เชื่อมบัญชี NHFapp|เปิดบริการ NHFapp/ })).not.toBeInTheDocument();
    });
    it.each(["linked", "unlinked"])("handles missing LIFF configuration for %s", async (status) => {
        vi.mocked(buildLiffUrl).mockImplementation(() => { throw new Error(); });
        respond(status); render(<LineAddFriendCard />);
        await screen.findByText(status === "linked" ? "บัญชี NHFapp เชื่อมกับ LINE แล้ว" : "เพิ่มเพื่อน แล้วเชื่อมบัญชี NHFapp เพียงครั้งเดียวเพื่อใช้บริการ");
        expect(screen.getByRole("link", { name: "เพิ่มเพื่อนใน LINE" })).toBeInTheDocument();
        expect(screen.queryByRole("link", { name: /เชื่อมบัญชี NHFapp|เปิดบริการ NHFapp/ })).not.toBeInTheDocument();
        expect(screen.getByText(/ยังไม่พร้อมใช้งาน/)).toBeInTheDocument();
    });
});
