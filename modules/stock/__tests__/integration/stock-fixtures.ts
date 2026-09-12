import { Role, StockRequestStatus } from "@prisma/client";
import type {
    PrismaClient,
    StockCategory,
    StockItem,
    StockItemVariant,
    StockRequest,
    User,
} from "@prisma/client";

import {
    buildStockAuthorizationContext,
    type StockAuthorizedCommandActor,
} from "@/modules/stock";

export type StockFixture = {
    requester: User;
    issuer: User;
    requesterActor: StockAuthorizedCommandActor;
    issuerActor: StockAuthorizedCommandActor;
    category: StockCategory;
    item: StockItem;
    variant: StockItemVariant;
    request: StockRequest;
    quantity: number;
    minStock: number;
    requestedQuantity: number;
};

export async function cleanIntegrationDatabase(
    client: PrismaClient,
): Promise<void> {
    await client.notificationOutbox.deleteMany();
    await client.notification.deleteMany();
    await client.auditLog.deleteMany();
    await client.stockRequestItem.deleteMany();
    await client.stockRequest.deleteMany();
    await client.stockTransaction.deleteMany();
    await client.stockVariantAttributeValue.deleteMany();
    await client.stockAttributeValue.deleteMany();
    await client.stockAttribute.deleteMany();
    await client.stockItemVariant.deleteMany();
    await client.stockItem.deleteMany();
    await client.stockCategory.deleteMany();
    await client.employee.deleteMany();
    await client.department.deleteMany();
    await client.user.deleteMany();
}

function toActor(user: {
    id: number;
    email: string;
    name: string;
    role: Role;
}, employeeId: number): StockAuthorizedCommandActor {
    return {
        id: user.id,
        email: user.email,
        name: user.name,
        ipAddress: "127.0.0.1",
        userAgent: "mysql-integration-test",
        authorization: buildStockAuthorizationContext(
            user,
            employeeId,
            "DASHBOARD",
        ),
    };
}

export async function createStockFixture(
    client: PrismaClient,
    options: {
        quantity?: number;
        minStock?: number;
        requestedQuantity?: number;
        suffix?: string;
    } = {},
): Promise<StockFixture> {
    const suffix = options.suffix ?? "หลัก";
    const quantity = options.quantity ?? 10;
    const minStock = options.minStock ?? 2;
    const requestedQuantity = options.requestedQuantity ?? 3;
    const department = await client.department.create({
        data: {
            name: `แผนกทดสอบ ${suffix}`,
            code: `STOCK-TEST-${suffix}`,
        },
    });
    const requester = await client.user.create({
        data: {
            email: `requester-${suffix}@integration.test`,
            name: `ผู้ขอ ${suffix}`,
            password: "integration-test-only",
            role: Role.USER,
        },
    });
    const issuer = await client.user.create({
        data: {
            email: `issuer-${suffix}@integration.test`,
            name: `ผู้จ่าย ${suffix}`,
            password: "integration-test-only",
            role: Role.ADMIN,
        },
    });
    const requesterEmployee = await client.employee.create({
        data: {
            firstName: `ผู้ขอ ${suffix}`,
            lastName: "ทดสอบ",
            email: `requester-employee-${suffix}@integration.test`,
            position: "ผู้ใช้งานทดสอบ",
            departmentId: department.id,
            user: { connect: { id: requester.id } },
        },
    });
    const issuerEmployee = await client.employee.create({
        data: {
            firstName: `ผู้จ่าย ${suffix}`,
            lastName: "ทดสอบ",
            email: `issuer-employee-${suffix}@integration.test`,
            position: "ผู้ดูแลทดสอบ",
            departmentId: department.id,
            user: { connect: { id: issuer.id } },
        },
    });
    const category = await client.stockCategory.create({
        data: { name: `หมวดทดสอบ ${suffix}` },
    });
    const item = await client.stockItem.create({
        data: {
            name: `วัสดุทดสอบ ${suffix}`,
            sku: `ITEM-${suffix}`,
            unit: "ชิ้น",
            quantity,
            minStock,
            categoryId: category.id,
        },
    });
    const variant = await client.stockItemVariant.create({
        data: {
            stockItemId: item.id,
            sku: `VARIANT-${suffix}`,
            unit: "ชิ้น",
            quantity,
            minStock,
        },
    });
    const request = await client.stockRequest.create({
        data: {
            requestedBy: requester.id,
            idempotencyKey: `integration-${suffix}`,
            requestHash: "0".repeat(64),
            projectCode: `PROJECT-${suffix}`,
            status: StockRequestStatus.PENDING_ISSUE,
            items: {
                create: {
                    itemId: item.id,
                    variantId: variant.id,
                    quantity: requestedQuantity,
                },
            },
        },
    });

    return {
        requester,
        issuer,
        requesterActor: toActor(requester, requesterEmployee.id),
        issuerActor: toActor(issuer, issuerEmployee.id),
        category,
        item,
        variant,
        request,
        quantity,
        minStock,
        requestedQuantity,
    };
}
