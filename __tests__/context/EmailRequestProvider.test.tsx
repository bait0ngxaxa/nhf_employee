import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { EmailRequestProvider } from "@/components/dashboard/context/email-request/EmailRequestProvider";
import { useEmailRequestContext } from "@/components/dashboard/context/email-request/EmailRequestContext";
import useSWR from "swr";

// Mock useSWR
vi.mock("swr");

// Mock fetch
global.fetch = vi.fn();

const TestComponent = () => {
    const {
        formData,
        handleInputChange,
        handleSubmit,
        emailRequests,
        isFormLoading,
        formError,
        showSuccessModal,
        closeSuccessModal,
    } = useEmailRequestContext();

    return (
        <div>
            <div data-testid="loading-state">
                {isFormLoading ? "Loading" : "Idle"}
            </div>
            <div data-testid="error-state">{formError}</div>
            <div data-testid="success-modal">
                {showSuccessModal ? "Modal Open" : "Modal Closed"}
            </div>
            <input
                data-testid="input-thaiName"
                name="thaiName"
                value={formData.thaiName}
                onChange={handleInputChange}
            />
            <button data-testid="submit-btn" onClick={handleSubmit}>
                Submit
            </button>
            <button data-testid="close-modal-btn" onClick={closeSuccessModal}>
                Close Modal
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

    beforeEach(() => {
        vi.clearAllMocks();
        (useSWR as any).mockReturnValue({
            data: {
                success: true,
                emailRequests: [],
                pagination: { page: 1, limit: 10, total: 0, totalPages: 0 },
            },
            mutate: mockMutate,
            isLoading: false,
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

    it("should handle successful submission", async () => {
        (global.fetch as any).mockResolvedValueOnce({
            json: async () => ({ success: true }),
        });

        render(
            <EmailRequestProvider>
                <TestComponent />
            </EmailRequestProvider>,
        );

        const submitBtn = screen.getByTestId("submit-btn");
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/email-request",
                expect.objectContaining({
                    method: "POST",
                    body: expect.stringContaining(""),
                }),
            );
        });

        await waitFor(() => {
            expect(screen.getByTestId("success-modal").textContent).toBe(
                "Modal Open",
            );
        });

        expect(mockMutate).toHaveBeenCalled();
    });

    it("should handle submission failure", async () => {
        (global.fetch as any).mockResolvedValueOnce({
            json: async () => ({ success: false, error: "API Error" }),
        });

        render(
            <EmailRequestProvider>
                <TestComponent />
            </EmailRequestProvider>,
        );

        const submitBtn = screen.getByTestId("submit-btn");
        fireEvent.click(submitBtn);

        await waitFor(() => {
            expect(screen.getByTestId("error-state").textContent).toBe(
                "API Error",
            );
        });
    });

    it("should display data from SWR", () => {
        (useSWR as any).mockReturnValue({
            data: {
                success: true,
                emailRequests: [
                    { id: "1", thaiName: "Test User 1" },
                    { id: "2", thaiName: "Test User 2" },
                ],
                pagination: { page: 1, limit: 10, total: 2, totalPages: 1 },
            },
            mutate: mockMutate,
            isLoading: false,
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
