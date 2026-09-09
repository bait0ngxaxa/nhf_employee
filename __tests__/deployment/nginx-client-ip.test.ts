import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const nginxConfigPath = resolve(
    process.cwd(),
    "deployment",
    "nginx",
    "employee_nhf.cloudflare-origin.conf",
);

describe("Nginx trusted client-IP contract", () => {
    it("canonicalizes the application-facing Cloudflare client IP header", () => {
        const config = readFileSync(nginxConfigPath, "utf8");
        const realIpDirective = config.indexOf(
            "real_ip_header CF-Connecting-IP;",
        );
        const proxyHeaderDirective = config.indexOf(
            "proxy_set_header CF-Connecting-IP $remote_addr;",
        );

        expect(config).toContain(
            "include /etc/nginx/snippets/cloudflare-real-ip.conf;",
        );
        expect(config).toContain("real_ip_recursive on;");
        expect(realIpDirective).toBeGreaterThanOrEqual(0);
        expect(proxyHeaderDirective).toBeGreaterThan(realIpDirective);
        expect(config).not.toContain(
            "proxy_set_header CF-Connecting-IP $http_cf_connecting_ip;",
        );
    });

    it("keeps the Next.js upstream on loopback", () => {
        const config = readFileSync(nginxConfigPath, "utf8");

        expect(config).toContain("server 127.0.0.1:3000;");
    });
});
