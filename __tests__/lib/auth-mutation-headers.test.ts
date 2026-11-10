import { afterEach, describe, expect, it, vi } from "vitest";

import {
    applyAuthMutationHeaders,
    isAuthMutationMethod,
    withAuthMutationHeaders,
} from "@/lib/auth/mutation-headers";
import { apiRequest } from "@/lib/client/api-client";
import { fetchLiffWithSessionRecovery, registerLiffSessionRecovery } from "@/modules/line/client";

const MUTATING_METHODS = ["POST", "PUT", "PATCH", "DELETE", "post", "delete"] as const;
const READ_METHODS = ["GET", "HEAD", "get", undefined] as const;

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

function lastRequestHeaders(fetchMock: ReturnType<typeof vi.spyOn>): Headers {
    const init = fetchMock.mock.calls.at(-1)?.[1] as RequestInit | undefined;
    return new Headers(init?.headers);
}

describe("shared trusted-mutation header helper", () => {
    it.each(MUTATING_METHODS)("treats %s as a mutation", (method) => {
        expect(isAuthMutationMethod(method)).toBe(true);
        const init = withAuthMutationHeaders({
            method,
            headers: { "Content-Type": "application/json", "Idempotency-Key": "key-1" },
            body: "{}",
        });
        const headers = new Headers(init.headers);
        expect(headers.get("X-Requested-With")).toBe("XMLHttpRequest");
        expect(headers.get("Content-Type")).toBe("application/json");
        expect(headers.get("Idempotency-Key")).toBe("key-1");
        expect(init.body).toBe("{}");
        expect(init.method).toBe(method);
    });

    it.each(READ_METHODS)("leaves %s reads untouched", (method) => {
        expect(isAuthMutationMethod(method)).toBe(false);
        const init: RequestInit = { method, headers: { Accept: "application/json" } };
        expect(withAuthMutationHeaders(init)).toBe(init);
        expect(applyAuthMutationHeaders(new Headers(), method).has("X-Requested-With")).toBe(false);
    });

    it("does not override a header the caller set explicitly", () => {
        const headers = applyAuthMutationHeaders(
            new Headers({ "X-Requested-With": "custom" }),
            "POST",
        );
        expect(headers.get("X-Requested-With")).toBe("custom");
    });

    it("keeps Headers instances and multipart bodies intact", () => {
        const formData = new FormData();
        formData.append("body", "hello");
        const init = withAuthMutationHeaders({
            method: "POST",
            headers: new Headers({ "Idempotency-Key": "key-2" }),
            body: formData,
        });
        const headers = new Headers(init.headers);
        expect(init.body).toBe(formData);
        expect(headers.get("Idempotency-Key")).toBe("key-2");
        expect(headers.get("Content-Type")).toBeNull();
        expect(headers.get("X-Requested-With")).toBe("XMLHttpRequest");
    });
});

describe("shared browser transports send the trusted-mutation header", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it.each(["POST", "PUT", "PATCH", "DELETE"])("api-client adds it for %s", async (method) => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: true }));
        await apiRequest("/api/example", { method, data: { value: 1 } });
        expect(lastRequestHeaders(fetchMock).get("X-Requested-With")).toBe("XMLHttpRequest");
    });

    it.each(["GET", "HEAD"])("api-client omits it for %s", async (method) => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ ok: true }));
        await apiRequest("/api/example", { method });
        expect(lastRequestHeaders(fetchMock).has("X-Requested-With")).toBe(false);
    });

    it.each(["POST", "PUT", "PATCH", "DELETE"])(
        "LIFF fetch adds it for %s and still never replays the mutation",
        async (method) => {
            const recover = vi.fn().mockResolvedValue(true);
            const unregister = registerLiffSessionRecovery(recover, vi.fn());
            const fetchMock = vi
                .spyOn(globalThis, "fetch")
                .mockResolvedValue(jsonResponse({ error: "Unauthorized" }, 401));

            const response = await fetchLiffWithSessionRecovery("/api/line/example", {
                method,
                headers: { "Idempotency-Key": "key-3" },
                body: "{}",
            });

            expect(response.status).toBe(401);
            expect(recover).toHaveBeenCalledOnce();
            expect(fetchMock).toHaveBeenCalledOnce();
            const headers = lastRequestHeaders(fetchMock);
            expect(headers.get("X-Requested-With")).toBe("XMLHttpRequest");
            expect(headers.get("Idempotency-Key")).toBe("key-3");
            unregister();
        },
    );

    it("LIFF fetch omits it for GET and replays the read with the same init", async () => {
        const recover = vi.fn().mockResolvedValue(true);
        const unregister = registerLiffSessionRecovery(recover, vi.fn());
        const init: RequestInit = { cache: "no-store", credentials: "include" };
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(jsonResponse({ error: "Unauthorized" }, 401))
            .mockResolvedValueOnce(jsonResponse({ ok: true }));

        const response = await fetchLiffWithSessionRecovery("/api/line/example", init);

        expect(response.status).toBe(200);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(fetchMock.mock.calls[0]?.[1]).toBe(init);
        expect(fetchMock.mock.calls[1]?.[1]).toBe(init);
        unregister();
    });
});
