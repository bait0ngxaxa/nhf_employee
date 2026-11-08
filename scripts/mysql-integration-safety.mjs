import { createConnection } from "mysql2/promise";

export function validateDisposableTarget(env) {
    const raw = env.TEST_DATABASE_URL;
    if (!raw || env.DATABASE_URL !== raw || env.NODE_ENV !== "test") {
        throw new Error("Integration requires matching explicit test URLs and NODE_ENV=test");
    }
    let url;
    try { url = new URL(raw); } catch { throw new Error("Invalid disposable database URL"); }
    if (url.protocol !== "mysql:" || url.hostname !== "127.0.0.1"
        || !url.port || url.pathname !== "/employee_nhf_integration"
        || url.username !== "integration_user" || !/^[a-f0-9]{48}$/.test(url.password)
        || url.search || url.hash
        || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(env.NHF_INTEGRATION_SERVER_UUID ?? "")) {
        throw new Error("Refusing an unverified disposable MySQL target");
    }
    return url;
}

export async function assertDisposableMysql(env = process.env, connect = createConnection) {
    const url = validateDisposableTarget(env);
    const connection = await connect({
        host: url.hostname, port: Number(url.port), user: url.username,
        password: url.password, database: url.pathname.slice(1), connectTimeout: 10_000,
    });
    try {
        const [rows] = await connection.query("SELECT DATABASE() AS db, CURRENT_USER() AS account, @@server_uuid AS uuid");
        if (rows.length !== 1 || rows[0].db !== "employee_nhf_integration"
            || rows[0].account !== "integration_user@%"
            || rows[0].uuid !== env.NHF_INTEGRATION_SERVER_UUID) {
            throw new Error("Disposable MySQL server/database/account identity mismatch");
        }
    } finally {
        await connection.end();
    }
}

// Vitest global setup runs before importing integration test files.
export default async function setup() {
    await assertDisposableMysql();
}
