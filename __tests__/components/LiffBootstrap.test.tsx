import { render, screen, waitFor } from "@testing-library/react";
import type { ReactElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
    class MockLiffApiError extends Error {
        readonly status: number | undefined;

        constructor(message: string, status?: number) {
            super(message);
            this.name = "LiffApiError";
            this.status = status;
        }
    }

    return {
        liff: {
            init: vi.fn(),
            isLoggedIn: vi.fn(),
            login: vi.fn(),
            getIDToken: vi.fn(),
        },
        usePathname: vi.fn(),
        establishLiffSession: vi.fn(),
        linkLiffAccount: vi.fn(),
        registerLiffSessionRecovery: vi.fn(),
        MockLiffApiError,
    };
});

vi.mock("@line/liff", () => ({ default: mocks.liff }));

vi.mock("next/navigation", () => ({
    usePathname: mocks.usePathname,
}));

vi.mock("@/lib/client/liff", () => ({
    establishLiffSession: mocks.establishLiffSession,
    linkLiffAccount: mocks.linkLiffAccount,
    registerLiffSessionRecovery: mocks.registerLiffSessionRecovery,
    LiffApiError: mocks.MockLiffApiError,
}));

import {
    buildLiffNhfLoginUrl,
    LiffBootstrap,
    useLiffWorkforce,
} from "@/components/liff/LiffBootstrap";

const WORKFORCE = {
    userId: 10,
    employeeId: 20,
    name: "พนักงาน ทดสอบ",
};

function WorkforceProbe(): ReactElement {
    const workforce = useLiffWorkforce();
    return <div>พร้อมใช้งานสำหรับ {workforce.name}</div>;
}

describe("LiffBootstrap", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.stubEnv("NEXT_PUBLIC_LINE_LIFF_ID", "nhfapp-liff-id");
        window.history.replaceState(null, "", "/liff/routine");
        mocks.usePathname.mockReturnValue("/liff/routine");
        mocks.liff.init.mockResolvedValue(undefined);
        mocks.liff.isLoggedIn.mockReturnValue(true);
        mocks.liff.login.mockReturnValue(undefined);
        mocks.liff.getIDToken.mockReturnValue("line-id-token");
        mocks.establishLiffSession.mockResolvedValue({
            linked: true,
            workforce: WORKFORCE,
        });
        mocks.linkLiffAccount.mockResolvedValue({
            linked: true,
            workforce: WORKFORCE,
        });
        mocks.registerLiffSessionRecovery.mockReturnValue(vi.fn());
    });

    afterEach(() => {
        vi.unstubAllEnvs();
    });

    it("initializes LIFF and exposes the authenticated workforce identity", async () => {
        render(
            <LiffBootstrap>
                <WorkforceProbe />
            </LiffBootstrap>,
        );

        expect(
            await screen.findByText("พร้อมใช้งานสำหรับ พนักงาน ทดสอบ"),
        ).toBeInTheDocument();
        expect(mocks.liff.init).toHaveBeenCalledWith({
            liffId: "nhfapp-liff-id",
        });
        expect(mocks.liff.getIDToken).toHaveBeenCalled();
        expect(mocks.establishLiffSession).toHaveBeenCalledWith("line-id-token");
    });

    it("keeps one authenticated bootstrap across persistent LIFF module navigation", async () => {
        window.history.replaceState(null, "", "/liff");
        mocks.usePathname.mockReturnValue("/liff");

        const { rerender } = render(
            <LiffBootstrap>
                <div>Home</div>
            </LiffBootstrap>,
        );

        expect(await screen.findByText("Home")).toBeInTheDocument();

        for (const [pathname, label] of [
            ["/liff/stock", "Stock"],
            ["/liff/leave", "Leave"],
            ["/liff/routine", "Routine"],
        ] as const) {
            window.history.replaceState(null, "", pathname);
            mocks.usePathname.mockReturnValue(pathname);
            rerender(
                <LiffBootstrap>
                    <div>{label}</div>
                </LiffBootstrap>,
            );
            expect(screen.getByText(label)).toBeInTheDocument();
        }

        expect(mocks.liff.init).toHaveBeenCalledTimes(1);
        expect(mocks.establishLiffSession).toHaveBeenCalledTimes(1);
    });

    it("does not bind session establishment to a route that changes while bootstrapping", async () => {
        window.history.replaceState(null, "", "/liff");
        mocks.usePathname.mockReturnValue("/liff");

        let resolveSession: (() => void) | undefined;
        const sessionReady = new Promise<void>((resolve) => {
            resolveSession = resolve;
        });
        mocks.establishLiffSession.mockImplementationOnce(async () => {
            await sessionReady;
            return { linked: true, workforce: WORKFORCE };
        });

        const { rerender } = render(
            <LiffBootstrap>
                <div>Home</div>
            </LiffBootstrap>,
        );

        await waitFor(() => {
            expect(mocks.establishLiffSession).toHaveBeenCalledTimes(1);
        });

        window.history.replaceState(null, "", "/liff/stock");
        mocks.usePathname.mockReturnValue("/liff/stock");
        rerender(
            <LiffBootstrap>
                <div>Stock</div>
            </LiffBootstrap>,
        );

        if (!resolveSession) {
            throw new Error("Expected the LIFF session promise to be pending");
        }
        resolveSession();

        expect(await screen.findByText("Stock")).toBeInTheDocument();
        expect(mocks.liff.init).toHaveBeenCalledTimes(1);
        expect(mocks.establishLiffSession).toHaveBeenCalledTimes(1);
    });

    it("starts LINE Login with the current LIFF path as the redirect URI", async () => {
        window.history.replaceState(
            null,
            "",
            "/liff/routine?taskId=71&occurrenceId=91&liff.state=provider-secret",
        );
        mocks.liff.isLoggedIn.mockReturnValue(false);

        render(<LiffBootstrap><div>Routine</div></LiffBootstrap>);

        expect(
            await screen.findByText("กำลังยืนยันตัวตนกับ LINE..."),
        ).toBeInTheDocument();
        expect(mocks.liff.login).toHaveBeenCalledWith({
            redirectUri:
                "http://localhost:3000/liff/routine?taskId=71&occurrenceId=91&lineLogin=1",
        });
        expect(mocks.liff.getIDToken).not.toHaveBeenCalled();
    });

    it("re-establishes the shared session through the registered recovery handler", async () => {
        let recover: (() => Promise<boolean>) | undefined;
        mocks.registerLiffSessionRecovery.mockImplementationOnce(
            (handler: () => Promise<boolean>) => {
                recover = handler;
                return vi.fn();
            },
        );

        render(<LiffBootstrap><WorkforceProbe /></LiffBootstrap>);
        expect(
            await screen.findByText("พร้อมใช้งานสำหรับ พนักงาน ทดสอบ"),
        ).toBeInTheDocument();

        if (!recover) throw new Error("Expected a LIFF recovery handler");
        mocks.establishLiffSession.mockResolvedValueOnce({
            linked: true,
            workforce: { ...WORKFORCE, name: "พนักงานหลังต่ออายุ" },
        });

        await expect(recover()).resolves.toBe(true);
        expect(
            await screen.findByText("พร้อมใช้งานสำหรับ พนักงานหลังต่ออายุ"),
        ).toBeInTheDocument();
        expect(mocks.establishLiffSession).toHaveBeenCalledTimes(2);
    });

    it("stops an incomplete LINE Login without creating a redirect loop", async () => {
        window.history.replaceState(null, "", "/liff/routine?lineLogin=1");
        mocks.liff.isLoggedIn.mockReturnValue(false);

        render(<LiffBootstrap><div>Routine</div></LiffBootstrap>);

        expect(
            await screen.findByRole("heading", {
                name: "เปิดบริการ NHFapp ผ่าน LINE ไม่สำเร็จ",
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText("การเข้าสู่ระบบ LINE ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"),
        ).toBeInTheDocument();
        expect(mocks.liff.login).not.toHaveBeenCalled();
    });

    it("shows the global one-time account-link purpose for an unlinked user", async () => {
        window.history.replaceState(
            null,
            "",
            "/liff/routine?taskId=71&occurrenceId=91",
        );
        mocks.establishLiffSession.mockResolvedValueOnce({ linked: false });

        render(<LiffBootstrap><div>Routine</div></LiffBootstrap>);

        expect(
            await screen.findByRole("heading", {
                name: "เชื่อมบัญชี LINE กับ NHFapp",
            }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(
                /เพียงครั้งเดียว\s+เพื่อใช้บริการของ NHF ผ่าน LINE/,
            ),
        ).toBeInTheDocument();

        const link = screen.getByRole("link", { name: "เชื่อมบัญชี NHFapp" });
        const loginUrl = new URL(link.getAttribute("href") ?? "", window.location.origin);
        expect(loginUrl.pathname).toBe("/login");
        expect(loginUrl.searchParams.get("returnTo")).toBe(
            "/liff/routine?taskId=71&occurrenceId=91&link=1&loginReturn=1",
        );
    });

    it("restores link intent after NHF login and establishes the shared session", async () => {
        window.history.replaceState(
            null,
            "",
            "/liff/routine?taskId=71&occurrenceId=91&link=1&loginReturn=1",
        );

        render(
            <LiffBootstrap>
                <WorkforceProbe />
            </LiffBootstrap>,
        );

        expect(
            await screen.findByText("พร้อมใช้งานสำหรับ พนักงาน ทดสอบ"),
        ).toBeInTheDocument();
        expect(mocks.linkLiffAccount).toHaveBeenCalledWith("line-id-token");
        expect(mocks.establishLiffSession).not.toHaveBeenCalled();
        expect(window.location.search).toBe("?taskId=71&occurrenceId=91");
    });

    it("offers NHFapp Login again when the login return has no NHF session", async () => {
        window.history.replaceState(
            null,
            "",
            "/liff/routine?link=1&loginReturn=1",
        );
        mocks.linkLiffAccount.mockRejectedValueOnce(
            new mocks.MockLiffApiError("หมดอายุ", 401),
        );

        render(<LiffBootstrap><div>Routine</div></LiffBootstrap>);

        expect(
            await screen.findByText(
                "ยังไม่พบการเข้าสู่ระบบ NHFapp กรุณาเข้าสู่ระบบอีกครั้ง",
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "เข้าสู่ระบบ NHFapp" }),
        ).toBeInTheDocument();
    });

    it("shows a safe retryable error when LIFF initialization fails", async () => {
        mocks.liff.init.mockRejectedValueOnce(new Error("provider details"));

        render(<LiffBootstrap><div>Routine</div></LiffBootstrap>);

        expect(
            await screen.findByText(
                "ไม่สามารถเปิดบริการ NHFapp ผ่าน LINE ได้ กรุณาลองใหม่อีกครั้ง",
            ),
        ).toBeInTheDocument();
        expect(screen.queryByText("provider details")).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "ลองใหม่" })).toBeInTheDocument();
    });

    it("normalizes an unsafe account-link return to the global LIFF root", () => {
        const loginUrl = new URL(
            buildLiffNhfLoginUrl(
                new URL("https://attacker.example/redirect?liff.state=secret"),
            ),
            "https://nhf.example",
        );

        expect(loginUrl.pathname).toBe("/login");
        expect(loginUrl.searchParams.get("returnTo")).toBe(
            "/liff?link=1&loginReturn=1",
        );
        expect(loginUrl.toString()).not.toContain("attacker.example");
        expect(loginUrl.toString()).not.toContain("secret");
    });
});
