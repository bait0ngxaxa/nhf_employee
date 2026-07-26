import { prisma } from "@/lib/db/prisma";
import { repairLegacyStockItemVariants } from "@/lib/services/stock";

type CommandArgs = {
    apply: boolean;
    actorId: number | undefined;
    itemIds: number[];
};

function parsePositiveInteger(value: string, option: string): number {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error(`${option} ต้องเป็นจำนวนเต็มบวก`);
    }
    return parsed;
}

function parseArgs(argv: string[]): CommandArgs {
    const args: CommandArgs = { apply: false, actorId: undefined, itemIds: [] };

    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === "--apply") {
            args.apply = true;
            continue;
        }
        if (argument === "--dry-run") {
            args.apply = false;
            continue;
        }
        if (argument === "--actor-id") {
            const value = argv[index + 1];
            if (!value) throw new Error("กรุณาระบุค่า --actor-id");
            args.actorId = parsePositiveInteger(value, "--actor-id");
            index += 1;
            continue;
        }
        if (argument === "--item-id") {
            const value = argv[index + 1];
            if (!value) throw new Error("กรุณาระบุค่า --item-id");
            args.itemIds.push(parsePositiveInteger(value, "--item-id"));
            index += 1;
            continue;
        }
        if (argument === "--help") {
            // eslint-disable-next-line no-console
            console.log(
                "ใช้: npx tsx scripts/repair-legacy-stock-variants.ts --actor-id <adminId> [--item-id <id> ...] [--apply]",
            );
            process.exit(0);
        }
        throw new Error(`ไม่รู้จักพารามิเตอร์ ${argument}`);
    }

    if (args.actorId === undefined) {
        throw new Error("ต้องระบุ --actor-id ของผู้ดูแลระบบที่สั่งซ่อม");
    }

    return args;
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2));
    const actorUser = await prisma.user.findUnique({
        where: { id: args.actorId },
        select: { id: true, email: true, name: true, role: true, isActive: true, deletedAt: true },
    });

    if (
        !actorUser
        || actorUser.role !== "ADMIN"
        || !actorUser.isActive
        || actorUser.deletedAt !== null
    ) {
        throw new Error("ผู้สั่งซ่อมต้องเป็นผู้ดูแลระบบที่ยังใช้งานอยู่");
    }

    const result = await repairLegacyStockItemVariants(
        {
            id: actorUser.id,
            email: actorUser.email,
            name: actorUser.name,
            authority: "ADMIN",
            requestId: "maintenance-legacy-stock-variants",
            correlationId: "maintenance-legacy-stock-variants",
        },
        args.itemIds.length > 0 ? args.itemIds : undefined,
        { dryRun: !args.apply },
    );

    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
}

main()
    .catch((error: unknown) => {
        console.error(error instanceof Error ? error.message : "ซ่อมข้อมูลไม่สำเร็จ");
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
