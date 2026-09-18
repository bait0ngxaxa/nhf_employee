import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { CapabilityRegistry } from "./CapabilityRegistry";
import type { AuthorizationAdministrationOverviewData } from "../types";

const capabilities = [
    {
        key: "employee.read",
        registered: true,
        domain: "employee",
        description: "อ่านข้อมูลพนักงาน",
        supportedScopes: ["ALL"],
        supportedChannels: ["DASHBOARD"],
        runtimeAuthorizationMode: "CENTRAL_WITH_DEFAULT_POLICY",
        administrativeStatus: "GRANTABLE",
        administrativelyGrantable: true,
    },
    {
        key: "stock.request.process",
        registered: true,
        domain: "stock",
        description: "ดำเนินการคำขอเบิก",
        supportedScopes: ["ALL"],
        supportedChannels: ["DASHBOARD"],
        runtimeAuthorizationMode: "CENTRAL_ONLY",
        administrativeStatus: "GRANTABLE",
        administrativelyGrantable: true,
    },
    {
        key: "email.request.read",
        registered: true,
        domain: "email",
        description: "อ่านคำขออีเมล",
        supportedScopes: ["OWN", "ALL"],
        supportedChannels: ["DASHBOARD"],
        runtimeAuthorizationMode: "DEFERRED",
        administrativeStatus: "DEFERRED",
        administrativelyGrantable: false,
        nonGrantableReason: "ยังไม่เปิดให้จัดการ",
    },
] satisfies AuthorizationAdministrationOverviewData["capabilities"];

describe("CapabilityRegistry advanced system view", () => {
    it("keeps business presentation visible while retaining technical evidence", () => {
        render(<CapabilityRegistry capabilities={capabilities} />);

        expect(screen.getByRole("heading", { name: "ข้อมูลสิทธิ์ของระบบ" })).toBeInTheDocument();
        expect(screen.getByText("ดูข้อมูลพนักงาน")).toBeInTheDocument();
        expect(screen.getByText("บุคลากร")).toBeInTheDocument();
        expect(screen.getAllByText("เว็บระบบ").length).toBeGreaterThan(0);
        expect(screen.getByText("employee.read").closest("details")).not.toHaveAttribute("open");
        expect(screen.getAllByText("DEFERRED").length).toBeGreaterThan(0);

        fireEvent.change(screen.getByLabelText("ค้นหาข้อมูลสิทธิ์"), { target: { value: "เบิก" } });

        expect(screen.getByText("ดำเนินการคำขอเบิก")).toBeInTheDocument();
        expect(screen.queryByText("ดูข้อมูลพนักงาน")).not.toBeInTheDocument();
    });
});
