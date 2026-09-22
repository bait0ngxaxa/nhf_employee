import { act, renderHook } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useIsMobile } from "@/hooks/use-mobile";

type ControlledMediaQueryList = MediaQueryList & {
    addEventListenerMock: ReturnType<typeof vi.fn>;
    dispatchChange: (matches: boolean) => void;
    listeners: Set<EventListenerOrEventListenerObject>;
};

function installMatchMedia(initialMatches: boolean): {
    matchMedia: ReturnType<typeof vi.fn>;
    mediaQueryList: ControlledMediaQueryList;
} {
    const listeners = new Set<EventListenerOrEventListenerObject>();
    let currentMatches = initialMatches;
    const addEventListenerMock = vi.fn(
        (
            _type: string,
            listener: EventListenerOrEventListenerObject,
        ): void => {
            listeners.add(listener);
        },
    );
    const mediaQueryList = {
        get matches(): boolean {
            return currentMatches;
        },
        media: "(max-width: 767px)",
        onchange: null,
        addEventListener: addEventListenerMock,
        removeEventListener: vi.fn(
            (
                _type: string,
                listener: EventListenerOrEventListenerObject,
            ): void => {
                listeners.delete(listener);
            },
        ),
        dispatchChange: (matches: boolean): void => {
            currentMatches = matches;
            const event = new Event("change");
            for (const listener of listeners) {
                if (typeof listener === "function") {
                    listener(event);
                } else {
                    listener.handleEvent(event);
                }
            }
        },
        addEventListenerMock,
        listeners,
    } as unknown as ControlledMediaQueryList;
    const matchMedia = vi.fn(() => mediaQueryList);
    vi.stubGlobal("matchMedia", matchMedia);

    return { matchMedia, mediaQueryList };
}

function MobileProbe(): React.JSX.Element {
    return <output>{String(useIsMobile())}</output>;
}

describe("useIsMobile", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("uses a deterministic false server snapshot without reading browser APIs", () => {
        const matchMedia = vi.fn(() => {
            throw new Error("matchMedia must not be read during SSR");
        });
        vi.stubGlobal("matchMedia", matchMedia);

        expect(renderToString(<MobileProbe />)).toContain(">false<");
        expect(matchMedia).not.toHaveBeenCalled();
    });

    it("treats 767px as mobile and 768px as desktop through one media query source", () => {
        const mobile = installMatchMedia(true);
        const mobileHook = renderHook(() => useIsMobile());

        expect(mobileHook.result.current).toBe(true);
        expect(mobile.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");

        mobileHook.unmount();
        const desktop = installMatchMedia(false);
        const desktopHook = renderHook(() => useIsMobile());

        expect(desktopHook.result.current).toBe(false);
        expect(desktop.matchMedia).toHaveBeenCalledWith("(max-width: 767px)");
        desktopHook.unmount();
    });

    it("updates the snapshot when matchMedia emits a change", () => {
        const { mediaQueryList } = installMatchMedia(false);
        const { result } = renderHook(() => useIsMobile());

        expect(result.current).toBe(false);
        act(() => mediaQueryList.dispatchChange(true));
        expect(result.current).toBe(true);
    });

    it("installs one listener, removes the same listener, and does not accumulate listeners", () => {
        const { mediaQueryList } = installMatchMedia(false);
        const { rerender, unmount } = renderHook(() => useIsMobile());

        expect(mediaQueryList.addEventListenerMock).toHaveBeenCalledTimes(1);
        const listener = mediaQueryList.addEventListenerMock.mock.calls[0]?.[1];
        expect(listener).toBeDefined();
        expect(mediaQueryList.listeners.size).toBe(1);

        rerender();
        rerender();
        expect(mediaQueryList.addEventListenerMock).toHaveBeenCalledTimes(1);
        expect(mediaQueryList.listeners.size).toBe(1);

        unmount();
        expect(mediaQueryList.removeEventListener).toHaveBeenCalledWith(
            "change",
            listener,
        );
        expect(mediaQueryList.listeners.size).toBe(0);
    });

    it("keeps the server markup as the initial hydration snapshot before revealing the client value", async () => {
        const { mediaQueryList } = installMatchMedia(true);
        const container = document.createElement("div");
        container.innerHTML = renderToString(<MobileProbe />);
        document.body.appendChild(container);

        expect(container.textContent).toBe("false");
        const root = hydrateRoot(container, <MobileProbe />);
        await act(async () => {
            await Promise.resolve();
        });

        expect(container.textContent).toBe("true");
        expect(mediaQueryList.addEventListenerMock).toHaveBeenCalledTimes(1);
        root.unmount();
        container.remove();
    });
});
