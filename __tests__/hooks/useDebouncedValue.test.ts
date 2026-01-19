import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

describe("useDebouncedValue", () => {
    it("should return initial value immediately", () => {
        const { result } = renderHook(() => useDebouncedValue("test", 500));
        expect(result.current).toBe("test");
    });

    it("should debounce value updates", () => {
        vi.useFakeTimers();
        const { result, rerender } = renderHook(
            ({ value, delay }) => useDebouncedValue(value, delay),
            {
                initialProps: { value: "initial", delay: 500 },
            },
        );

        // Update value
        rerender({ value: "updated", delay: 500 });

        // Should still be initial
        expect(result.current).toBe("initial");

        // Fast forward 200ms
        act(() => {
            vi.advanceTimersByTime(200);
        });
        expect(result.current).toBe("initial");

        // Fast forward rest
        act(() => {
            vi.advanceTimersByTime(300);
        });
        expect(result.current).toBe("updated");

        vi.useRealTimers();
    });
});
