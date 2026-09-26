import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    search: "",
    push: vi.fn(),
    replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
    useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
    usePathname: () => "/dashboard/it",
    useSearchParams: () => new URLSearchParams(mocks.search),
}));
vi.mock("./ITTicketSelfService", () => ({
    ITTicketSelfService: () => <div>เนื้อหา Ticket ของฉัน</div>,
}));
vi.mock("./ITTicketOperatorQueue", () => ({
    ITTicketOperatorQueue: () => <div>เนื้อหาคิวงาน IT</div>,
}));
vi.mock("./ITAnalyticsDashboard", () => ({
    ITAnalyticsDashboard: () => <div>เนื้อหารายงาน</div>,
}));

const originalMatchMedia = window.matchMedia;
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

import { IT_DASHBOARD_TABS } from "@/lib/ssot/routes";
import type { ITPresentationCapabilities } from "../../contracts";
import { ITWorkspace } from "./ITWorkspace";

const none: ITPresentationCapabilities = {
    canReadOwnTickets: false,
    canReadAllTickets: false,
    canCreateOwnTickets: false,
    canCommentOwnTickets: false,
    canCommentAllTickets: false,
    canManageTickets: false,
    canReadAnalytics: false,
};

beforeEach(() => {
    mocks.search = "";
    mocks.push.mockReset();
    mocks.replace.mockReset();
    Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: () => ({
            matches: false,
            media: "",
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(() => false),
        } satisfies MediaQueryList),
    });
    Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
        configurable: true,
        value: vi.fn(),
    });
});

afterEach(() => {
    if (originalMatchMedia) {
        Object.defineProperty(window, "matchMedia", { configurable: true, value: originalMatchMedia });
    } else {
        Reflect.deleteProperty(window, "matchMedia");
    }
    if (originalScrollIntoView) {
        Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
            configurable: true,
            value: originalScrollIntoView,
        });
    } else {
        Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView");
    }
});

describe("IT unified workspace presentation", () => {
    it("renders the requester tab and safely replaces an inaccessible requested tab", async () => {
        mocks.search = "itTab=queue";
        render(<ITWorkspace capabilities={{ ...none, canReadOwnTickets: true }} />);

        expect(screen.getByRole("tab", { name: "Ticket ของฉัน" })).toHaveAttribute(
            "data-state",
            "active",
        );
        expect(screen.queryByRole("tab", { name: "คิวงาน IT" })).not.toBeInTheDocument();
        expect(screen.queryByRole("tab", { name: "รายงาน" })).not.toBeInTheDocument();
        expect(await screen.findByText("เนื้อหา Ticket ของฉัน")).toBeInTheDocument();
        await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(
            "/dashboard/it?itTab=my-tickets",
            { scroll: false },
        ));
    });

    it("keeps an operator-only actor in the queue surface", async () => {
        mocks.search = "itTab=analytics";
        render(<ITWorkspace capabilities={{ ...none, canReadAllTickets: true }} />);

        expect(screen.getByRole("tab", { name: "คิวงาน IT" })).toHaveAttribute(
            "data-state",
            "active",
        );
        expect(screen.queryByRole("tab", { name: "Ticket ของฉัน" })).not.toBeInTheDocument();
        expect(screen.queryByRole("tab", { name: "รายงาน" })).not.toBeInTheDocument();
        expect(await screen.findByText("เนื้อหาคิวงาน IT")).toBeInTheDocument();
        await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(
            "/dashboard/it?itTab=queue",
            { scroll: false },
        ));
    });

    it("shows all entitled tabs and pushes canonical URL state when switching", () => {
        mocks.search = `itTab=${IT_DASHBOARD_TABS.myTickets}`;
        render(<ITWorkspace capabilities={{
            ...none,
            canCreateOwnTickets: true,
            canReadAllTickets: true,
            canReadAnalytics: true,
        }} />);

        expect(screen.getByRole("tab", { name: "Ticket ของฉัน" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "คิวงาน IT" })).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: "รายงาน" })).toBeInTheDocument();
        fireEvent.mouseDown(screen.getByRole("tab", { name: "คิวงาน IT" }), {
            button: 0,
            ctrlKey: false,
        });
        expect(mocks.push).toHaveBeenCalledWith(
            "/dashboard/it?itTab=queue",
            { scroll: false },
        );
    });
});
