import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailRequestProvider } from "@/components/dashboard/context/email-request/EmailRequestProvider";
import { useEmailRequestContext } from "@/components/dashboard/context/email-request/EmailRequestContext";
import useSWR from "swr";
import { toast } from "sonner";

import { apiPost } from "@/lib/api-client";
import type { ApiResponse } from "@/lib/api-client";

// Mock useSWR
vi.mock("swr");

// Mock api-client
vi.mock("@/lib/api-client", () => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

const TestComponent = () => {
    const {
        formData,
        handleInputChange,
        handleSubmit,
        emailRequests,
        isFormLoading,
        formError,
    } = useEmailRequestContext();

    return (
        <div>
            <div data-testid="loading-state">
                {isFormLoading ? "Loading" : "Idle"}
            </div>
            <div data-testid="error-state">{formError}</div>
            <input
                data-testid="input-thaiName"
                name="thaiName"
                value={formData.thaiName}
                onChange={handleInputChange}
            />
            <input
                data-testid="input-englishName"
                name="englishName"
                value={formData.englishName}
                onChange={handleInputChange}
            />
            <input
                data-testid="input-phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
            />
            <input
                data-testid="input-nickname"
                name="nickname"
                value={formData.nickname}
                onChange={handleInputChange}
            />
            <input
                data-testid="input-position"
                name="position"
                value={formData.position}
                onChange={handleInputChange}
            />
            <input
                data-testid="input-department"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
            />
            <input
                data-testid="input-replyEmail"
                name="replyEmail"
                value={formData.replyEmail}
                onChange={handleInputChange}
            />
            <button data-testid="submit-btn" onClick={handleSubmit}>
                Submit
            </button>
            <ul data-testid="request-list">
                {emailRequests.map((req) => (
                    <li key={req.id}>{req.thaiName}</li>
                ))}
            </ul>
        </div>
    );
};

describe("EmailRequestProvider", () => {
    const mockMutate = vi.fn();
    const mockUseSWR = vi.mocked(useSWR);

    function createSuccessResponse<T>(data: T): ApiResponse<T> {
        return {
            success: true,
            data,
            status: 200,
            requestId: "test-request-id",
        };
    }

    function createErrorResponse(message: string, status = 400): ApiResponse<never> {
        return {
            success: false,
            error: message,
            errorThai: message,
            code: "VALIDATION_ERROR",
            status,
            requestId: "test-request-id",
        };
    }

    function fillValidForm(): void {
        fireEvent.change(screen.getByTestId("input-thaiName"), {
            target: { value: "สมชาย ใจดี" },
        });
        fireEvent.change(screen.getByTestId("input-englishName"), {
            target: { value: "Somchai Jaidee" },
        });
        fireEvent.change(screen.getByTestId("input-phone"), {
            target: { value: "081-234-5678" },
        });
        fireEvent.change(screen.getByTestId("input-nickname"), {
            target: { value: "ชาย" },
        });
        fireEvent.change(screen.getByTestId("input-position"), {
            target: { value: "เจ้าหน้าที่บัญชี" },
        });
        fireEvent.change(screen.getByTestId("input-department"), {
            target: { value: "มสช." },
        });
        fireEvent.change(screen.getByTestId("input-replyEmail"), {
            target: { value: "reply@example.com" },
        });
    }

    beforeEach(() => {
        vi.clearAllMocks();
        mockUseSWR.mockReturnValue({
            data: {
                success: true,
                emailRequests: [],
                pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
            },
            mutate: mockMutate,
            isLoading: false,
            isValidating: false,
            error: null,
        });
    });

    it("should render children and provide initial state", () => {
        render(
            <EmailRequestProvider>
                <TestComponent />
            </EmailRequestProvider>,
        );

        expect(screen.getByTestId("loading-state").textContent).toBe("Idle");
        expect(screen.getByTestId("request-list").children.length).toBe(0);
    });

    it("should update form data on input change", () => {
        render(
            <EmailRequestProvider>
                <TestComponent />
            </EmailRequestProvider>,
        );

        const input = screen.getByTestId("input-thaiName");
        fireEvent.change(input, { target: { value: "New Name" } });

        expect(input).toHaveValue("New Name");
    });

    it("should handle successful submission and show toast", async () => {
        vi.mocked(apiPost).mockResolvedValueOnce(
            createSuccessResponse({ success: true }),
        );

        render(
            <EmailRequestProvider>
                <TestComponent />
            </EmailRequestProvider>,
        );

        fillValidForm();
        const submitBtn = screen.getByTestId("submit-btn");
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(apiPost).toHaveBeenCalledWith(
                "/api/email-request",
                expect.objectContaining({
                    thaiName: "สมชาย ใจดี",
                    phone: "081-2345678",
                }),
            );
        });

        // Check that toast.success was called
        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith(
                "ส่งคำขออีเมลสำเร็จ",
                expect.objectContaining({
                    description: "คำขออีเมลของคุณถูกส่งไปยังทีมไอทีแล้ว",
                }),
            );
        });

        expect(mockMutate).toHaveBeenCalled();
    });

    it("should handle submission failure", async () => {
        vi.mocked(apiPost).mockResolvedValueOnce(createErrorResponse("API Error"));

        render(
            <EmailRequestProvider>
                <TestComponent />
            </EmailRequestProvider>,
        );

        fillValidForm();
        const submitBtn = screen.getByTestId("submit-btn");
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByTestId("error-state").textContent).toBe(
                "API Error",
            );
        });
    });

    it("should display data from SWR", () => {
        mockUseSWR.mockReturnValue({
            data: {
                success: true,
                emailRequests: [
                    { id: 1, thaiName: "Test User 1" },
                    { id: 2, thaiName: "Test User 2" },
                ],
                pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
            },
            mutate: mockMutate,
            isLoading: false,
            isValidating: false,
            error: null,
        });

        render(
            <EmailRequestProvider>
                <TestComponent />
            </EmailRequestProvider>,
        );

        const list = screen.getByTestId("request-list");
        expect(list.children.length).toBe(2);
        expect(list.textContent).toContain("Test User 1");
    });
});
