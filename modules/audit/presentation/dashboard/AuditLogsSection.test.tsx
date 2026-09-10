import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SWRConfig } from "swr";

import { AuditLogsSection } from "./AuditLogsSection";
import type { AuditLogsResponse } from "./types";

const emptyAuditLogsResponse: AuditLogsResponse = {
    auditLogs: [],
    pagination: {
        page: 1,
        limit: 15,
        total: 0,
        pages: 0,
    },
};

describe("AuditLogsSection", () => {
    it("preserves the Dashboard presentation and initial browser request", async () => {
        const fetcher = vi.fn(
            async (_url: string): Promise<AuditLogsResponse> =>
                emptyAuditLogsResponse,
        );

        render(
            <SWRConfig value={{ fetcher, provider: () => new Map() }}>
                <AuditLogsSection />
            </SWRConfig>,
        );

        await waitFor(() => {
            expect(fetcher).toHaveBeenCalledWith(
                "/api/audit-logs?page=1&limit=15",
            );
        });

        expect(
            screen.getByRole("heading", { name: "บันทึกการใช้งาน" }),
        ).toBeInTheDocument();
        expect(screen.getByText("ประวัติการดำเนินการในระบบ")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "รีเฟรช" })).toBeInTheDocument();
        expect(screen.getByLabelText("ค้นหาในบันทึกการใช้งาน")).toBeInTheDocument();
        expect(screen.getAllByText("ไม่พบข้อมูล")).toHaveLength(2);
    });
});
