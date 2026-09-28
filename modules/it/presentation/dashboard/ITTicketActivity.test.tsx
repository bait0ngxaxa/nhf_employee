import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ITTicketActivity } from "../ITTicketActivity";
import { ITTicketConversation } from "./ITTicketConversation";

const ticketId = 19;
const ticketCreatedAt = "2026-09-01T01:00:00.000Z";
const created = {
    type: "CREATED",
    id: 1,
    occurredAt: "2026-09-01T01:00:00.000Z",
    actorDisplayName: "ผู้แจ้งทดสอบ",
};

function response(items: readonly unknown[], options: {
    readonly cursor?: string | null;
    readonly hasMore?: boolean;
} = {}): Response {
    return new Response(JSON.stringify({
        success: true,
        items,
        olderCursor: options.cursor ?? null,
        hasMore: options.hasMore ?? false,
    }), { status: 200, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("IT Ticket Activity", () => {
    it("loads and paginates Activity independently from the comment conversation", async () => {
        const fetchMock = vi.fn<typeof fetch>(async (input) => {
            const url = new URL(String(input), "http://localhost");
            if (url.pathname.endsWith("/conversation")) {
                return url.searchParams.get("cursor") === "comment-cursor"
                    ? response([{
                        id: "cmolder",
                        createdAt: "2026-08-31T12:00:00.000Z",
                        authorDisplayName: "ผู้แจ้ง",
                        authorSide: "REQUESTER",
                        body: "ข้อความเก่า",
                        attachments: [],
                    }])
                    : response([{
                        id: "cmnewer",
                        createdAt: "2026-09-01T02:00:00.000Z",
                        authorDisplayName: "เจ้าหน้าที่",
                        authorSide: "OPERATOR",
                        body: "ข้อความใหม่",
                        attachments: [],
                    }], { cursor: "comment-cursor", hasMore: true });
            }
            return url.searchParams.get("cursor") === "activity-cursor"
                ? response([{
                    type: "STATUS_CHANGED",
                    id: 7,
                    occurredAt: "2026-08-31T11:00:00.000Z",
                    actorDisplayName: "ผู้แจ้งทดสอบ",
                    fromStatus: "OPEN",
                    toStatus: "IN_PROGRESS",
                }])
                : response([created], { cursor: "activity-cursor", hasMore: true });
        });
        vi.stubGlobal("fetch", fetchMock);

        render(
            <>
                <ITTicketConversation
                    ticketId={ticketId}
                    status="OPEN"
                    canComment
                    operator={false}
                />
                <ITTicketActivity
                    ticketId={ticketId}
                    ticketCreatedAt={ticketCreatedAt}
                    audience="REQUESTER"
                />
            </>,
        );

        const conversation = await screen.findByRole("list", { name: "ข้อความในการสนทนา" });
        const activity = await screen.findByRole("list", {
            name: "ประวัติการดำเนินการ Ticket #" + ticketId,
        });
        expect(within(conversation).getByText("ข้อความใหม่")).toBeInTheDocument();
        expect(within(conversation).queryByText("รับเรื่องแล้ว")).not.toBeInTheDocument();
        expect(within(activity).getByText("รับเรื่องแล้ว")).toBeInTheDocument();
        expect(within(activity).getByText("ผู้ดำเนินการ: ผู้แจ้งทดสอบ")).toBeInTheDocument();
        expect(activity.className).toContain("border-l");
        expect(within(activity).queryByText("ข้อความใหม่")).not.toBeInTheDocument();
        expect(activity.querySelector("article")).toBeNull();
        expect(activity.querySelector("img")).toBeNull();

        fireEvent.click(screen.getByRole("button", { name: "ดูประวัติก่อนหน้า" }));
        expect(await within(activity).findByText("เริ่มดำเนินการ")).toBeInTheDocument();
        expect(within(activity).getByText("31 ส.ค. 2569 · 18:00")).toBeInTheDocument();
        expect(within(conversation).queryByText("ข้อความเก่า")).not.toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "ดูข้อความก่อนหน้า" }));
        expect(await within(conversation).findByText("ข้อความเก่า")).toBeInTheDocument();
        expect(within(activity).queryByText("ข้อความเก่า")).not.toBeInTheDocument();
        expect(fetchMock.mock.calls.some(([input]) =>
            String(input).includes("cursor=activity-cursor"),
        )).toBe(true);
        expect(fetchMock.mock.calls.some(([input]) =>
            String(input).includes("cursor=comment-cursor"),
        )).toBe(true);
    });

    it("keeps activity loading failures isolated from conversation", async () => {
        const fetchMock = vi.fn<typeof fetch>(async (input) =>
            String(input).includes("/activity")
                ? new Response("unavailable", { status: 503 })
                : response([]),
        );
        vi.stubGlobal("fetch", fetchMock);

        render(
            <>
                <ITTicketConversation
                    ticketId={ticketId}
                    status="OPEN"
                    canComment
                    operator={false}
                />
                <ITTicketActivity ticketId={ticketId} ticketCreatedAt={ticketCreatedAt} audience="REQUESTER" />
            </>,
        );

        expect(await screen.findByLabelText("ตอบกลับ")).toBeInTheDocument();
        expect(await screen.findByRole("alert")).toHaveTextContent("ระบบขัดข้องชั่วคราว");
        fireEvent.click(screen.getByRole("button", { name: "ลองอีกครั้ง" }));
        await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
        expect(screen.getByLabelText("ตอบกลับ")).toBeInTheDocument();
    });

    it("keeps LIFF activity compact and omits requester-hidden assignment and category details", async () => {
        render(
            <ITTicketActivity
                ticketId={ticketId}
                ticketCreatedAt={ticketCreatedAt}
                audience="REQUESTER"
                surface="LIFF"
                collapsible
                pageLoader={async () => ({
                    items: [
                        {
                            type: "ASSIGNED",
                            id: 5,
                            occurredAt: "2026-09-01T01:00:00.000Z",
                            actorDisplayName: "เจ้าหน้าที่",
                            fromAssigneeDisplayName: null,
                            toAssigneeDisplayName: "ชื่อผู้รับผิดชอบภายใน",
                        },
                        {
                            type: "CATEGORY_CHANGED",
                            id: 6,
                            occurredAt: "2026-09-01T01:01:00.000Z",
                            actorDisplayName: "เจ้าหน้าที่",
                            fromCategoryName: null,
                            toCategoryName: "หมวดหมู่ภายใน",
                        },
                    ],
                    olderCursor: null,
                    hasMore: false,
                })}
            />,
        );

        const summary = screen.getByText("ประวัติการดำเนินการ");
        fireEvent.click(summary);
        const activity = await screen.findByRole("list", {
            name: "ประวัติการดำเนินการ Ticket #" + ticketId,
        });
        expect(within(activity).getByText("อัปเดตการรับเรื่อง")).toBeInTheDocument();
        expect(within(activity).getByText("ปรับข้อมูลการจัดหมวดหมู่")).toBeInTheDocument();
        expect(within(activity).getAllByText("ผู้ดำเนินการ: เจ้าหน้าที่ IT")).toHaveLength(2);
        expect(within(activity).queryByText(/ชื่อผู้รับผิดชอบภายใน|หมวดหมู่ภายใน/)).not.toBeInTheDocument();
        expect(activity.querySelector("article")).toBeNull();
        expect(activity.querySelector("img")).toBeNull();
    });
});
