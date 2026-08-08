import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, it, expect, vi } from "vitest";
import { LIVE_SEARCH_DEBOUNCE_MS } from "@/constants/ui";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

describe("useDebouncedValue", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("should return initial value immediately", () => {
        const { result } = renderHook(() => useDebouncedValue("test", 500));
        expect(result.current).toBe("test");
    });

    it("should debounce value updates using the live search default", () => {
        vi.useFakeTimers();
        const { result, rerender } = renderHook(
            ({ value }) => useDebouncedValue(value),
            { initialProps: { value: "initial" } },
        );

        rerender({ value: "updated" });

        expect(result.current).toBe("initial");

        act(() => {
            vi.advanceTimersByTime(LIVE_SEARCH_DEBOUNCE_MS - 1);
        });
        expect(result.current).toBe("initial");

        act(() => {
            vi.advanceTimersByTime(1);
        });
        expect(result.current).toBe("updated");
    });
});
