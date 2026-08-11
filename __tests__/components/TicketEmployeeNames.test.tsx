import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CommentItem } from "@/components/ticket/CommentItem";
import { TicketCard } from "@/components/ticket/TicketCard";
import type { Ticket } from "@/types/tickets";

const ticket: Ticket = {
    id: 1,
    title: "เครื่องพิมพ์ขัดข้อง",
    description: "ไม่สามารถพิมพ์เอกสารได้",
    category: "PRINTER",
    priority: "MEDIUM",
    status: "OPEN",
    createdAt: "2026-08-11T01:00:00.000Z",
    updatedAt: "2026-08-11T01:00:00.000Z",
    reportedById: 10,
    assignedToId: 20,
    reportedBy: {
        id: 10,
        name: "ชื่อผู้ใช้เดิม",
        email: "reporter@example.com",
        employee: {
            firstName: "สมชาย",
            lastName: "ใจดี",
            nickname: "ชาย",
        },
    },
    assignedTo: {
        id: 20,
        name: "ชื่อผู้ดูแลเดิม",
        email: "assignee@example.com",
        employee: {
            firstName: "สมหญิง",
            lastName: "ช่วยงาน",
            nickname: "หญิง",
        },
    },
    _count: { comments: 0 },
};

describe("ticket employee identities", () => {
    it("shows canonical reporter and assignee names", () => {
        render(<TicketCard ticket={ticket} />);

        expect(screen.getByText("สมชาย ใจดี (ชาย)")).toBeInTheDocument();
        expect(screen.getByText("สมหญิง ช่วยงาน (หญิง)")).toBeInTheDocument();
    });

    it("shows the canonical comment author name", () => {
        render(
            <CommentItem
                id={1}
                content="รับทราบ"
                createdAt="2026-08-11T02:00:00.000Z"
                author={{
                    id: 30,
                    name: "ชื่อผู้แสดงความคิดเห็นเดิม",
                    email: "author@example.com",
                    role: "USER",
                    employee: {
                        firstName: "วิชัย",
                        lastName: "พร้อมดี",
                        nickname: "ชัย",
                    },
                }}
            />,
        );

        expect(screen.getByText("วิชัย พร้อมดี (ชัย)")).toBeInTheDocument();
    });
});
