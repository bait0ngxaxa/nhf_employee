import mysql from "mysql2/promise";

function getTestDatabaseUrl(): string {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
        throw new Error("ไม่พบ DATABASE_URL สำหรับจัดการ integration trigger");
    }
    return databaseUrl;
}

export async function dropRollbackTrigger(): Promise<void> {
    const connection = await mysql.createConnection(getTestDatabaseUrl());
    try {
        await connection.query(
            "DROP TRIGGER IF EXISTS integration_fail_stock_issued",
        );
    } finally {
        await connection.end();
    }
}

export async function createRollbackTrigger(): Promise<void> {
    const connection = await mysql.createConnection(getTestDatabaseUrl());
    try {
        await connection.query(`
            CREATE TRIGGER integration_fail_stock_issued
            BEFORE INSERT ON notifications
            FOR EACH ROW
            SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'forced integration rollback'
        `);
    } finally {
        await connection.end();
    }
}
