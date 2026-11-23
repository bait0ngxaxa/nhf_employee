const DAY = 86_400_000;
export const NOW = new Date("2026-11-07T03:00:00.000Z");
const at = (time) => new Date(time);

export async function seedITResolutionFixture(db, size) {
    const department = await db.department.upsert({
        where: { code: "it-resolution-profile" }, update: {},
        create: { code: "it-resolution-profile", name: "Synthetic Department" },
    });
    const email = "it-resolution-profile@fixture.test";
    const employee = await db.employee.findUnique({ where: { email } })
        ?? await db.employee.create({
            data: { firstName: "Synthetic", lastName: "Analyst", email, position: "Test", departmentId: department.id },
        });
    const user = await db.user.upsert({
        where: { email }, update: {},
        create: { email, password: "not-a-login", name: "Synthetic Analyst", role: "USER", employeeId: employee.id },
    });
    if (!await db.userCapabilityGrant.findFirst({ where: { userId: user.id, capabilityKey: "it.analytics.read", scope: "ALL" } })) {
        await db.userCapabilityGrant.create({ data: { userId: user.id, capabilityKey: "it.analytics.read", scope: "ALL" } });
    }
    const categories = [];
    for (let i = 0; i < 12; i++) {
        categories.push(await db.iTTicketCategory.upsert({
            where: { key: `RESOLUTION_PROFILE_${i}` }, update: {},
            create: { key: `RESOLUTION_PROFILE_${i}`, name: `Synthetic category ${i}`, isActive: i !== 11 },
        }));
    }
    await db.iTTicketEvent.deleteMany({ where: { actorUserId: user.id } });
    await db.iTTicket.deleteMany({ where: { requesterUserId: user.id } });
    if (await db.iTTicket.count() !== 0 || await db.iTTicketEvent.count() !== 0) {
        throw new Error("Unexpected IT data in disposable benchmark database");
    }
    for (let offset = 0; offset < size; offset += 500) {
        const data = Array.from({ length: Math.min(500, size - offset) }, (_, row) => {
            const i = offset + row;
            const createdAt = at(+NOW - ((i * 37) % 730) * DAY - (i % 24) * 3_600_000);
            const active = i % 100 < 5;
            const category = i % 997 === 0 ? 10 : i % 13 === 0 ? null : i % 29 === 0 ? 11
                : Math.floor(i / 3) % 2 === 0 ? 0 : 1 + Math.floor(i / 7) % 9;
            return {
                type: ["INCIDENT", "SERVICE_REQUEST", "SUGGESTION"][i % 3],
                status: active ? ["OPEN", "IN_PROGRESS", "WAITING_REQUESTER"][i % 3]
                    : ["RESOLVED", "CLOSED", "CANCELLED"][i % 3],
                priority: ["P0", "P1", "P2", "P3"][Math.floor(i / 3) % 4],
                title: "Synthetic benchmark", description: "Synthetic fixture only", requesterUserId: user.id,
                assignedToUserId: i % 7 === 0 ? user.id : null,
                categoryId: category === null ? null : categories[category].id,
                triagedAt: i % 5 === 0 ? null : createdAt,
                firstRespondedAt: i % 4 === 0 ? null : at(+createdAt + (i % 180) * 60_000),
                requesterDepartmentNameSnapshot: `Synthetic department ${i % 8}`,
                createdAt, updatedAt: createdAt,
            };
        });
        await db.iTTicket.createMany({ data });
    }
    const tickets = await db.iTTicket.findMany({
        select: { id: true, createdAt: true, categoryId: true }, orderBy: { id: "asc" },
    });
    for (let offset = 0; offset < size; offset += 500) {
        const data = tickets.slice(offset, offset + 500).flatMap((ticket, row) => {
            const i = offset + row;
            const base = { ticketId: ticket.id, actorUserId: user.id, occurredAt: ticket.createdAt };
            const events = [{ ...base, kind: "CREATED", toStatus: "OPEN" }];
            if (i % 7 === 0) events.push({ ...base, kind: "ASSIGNED", toAssigneeUserId: user.id });
            if (i % 5 === 0) events.push({ ...base, kind: "PRIORITY_TRIAGED", toPriority: "P1" });
            if (i % 17 === 0) events.push({ ...base, kind: "UNASSIGNED", fromAssigneeUserId: user.id });
            if (i % 19 === 0) events.push({ ...base, kind: "PRIORITY_CHANGED", fromPriority: "P1", toPriority: "P2" });
            if (i % 11 === 0 && ticket.categoryId !== null) {
                events.push({ ...base, kind: "CATEGORY_CHANGED", toCategoryId: ticket.categoryId });
            }
            if (i % 4 !== 0) events.push({ ...base, kind: "STATUS_CHANGED", fromStatus: "OPEN", toStatus: "IN_PROGRESS" });
            if (i % 3 === 2 || i % 100 < 5) return events;
            const denseStart = +NOW - 107 * DAY;
            const resolutionTime = i % 9 === 0 && +ticket.createdAt <= denseStart
                ? denseStart + (i % 144) * 60_000 : +ticket.createdAt + (i % 14) * DAY + 1_800_000;
            if (resolutionTime > +NOW || (resolutionTime > +NOW - 7 * DAY && i % 5 !== 0)) return events;
            const resolved = { ...base, kind: "STATUS_CHANGED", fromStatus: "IN_PROGRESS", toStatus: "RESOLVED" };
            events.push({ ...resolved, occurredAt: at(resolutionTime) });
            if (i % 7 === 0) {
                events.push({ ...resolved, fromStatus: "RESOLVED", toStatus: "IN_PROGRESS", occurredAt: at(resolutionTime + 1000) });
                events.push({ ...resolved, occurredAt: at(resolutionTime + DAY) });
            }
            return events;
        });
        await db.iTTicketEvent.createMany({ data });
    }
    return { employee, user, categories, tickets };
}

export function scenariosFor(categories) {
    return [
        ["all-sparse-7D", { period: "7D" }, NOW],
        ["all-30D", { period: "30D" }, NOW],
        ["all-90D", { period: "90D" }, NOW],
        ["type-30D", { period: "30D", type: "INCIDENT" }, NOW],
        ["broad-30D", { period: "30D", category: String(categories[0].id) }, NOW],
        ["category-30D", { period: "30D", category: String(categories[1].id) }, NOW],
        ["combined-30D", { period: "30D", type: "INCIDENT", category: String(categories[1].id) }, NOW],
        ["rare-30D", { period: "30D", type: "INCIDENT", category: String(categories[10].id) }, NOW],
        ["rare-category-90D", { period: "90D", category: String(categories[10].id) }, NOW],
        ["inactive-90D", { period: "90D", category: String(categories[11].id) }, NOW],
        ["uncategorized-30D", { period: "30D", category: "uncategorized" }, NOW],
        ["empty-30D", { period: "30D" }, at(+NOW + 365 * DAY)],
        ["all-dense-7D", { period: "7D" }, at(+NOW - 104 * DAY)],
    ];
}
