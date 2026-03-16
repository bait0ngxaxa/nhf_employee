import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    // eslint-disable-next-line no-console
    console.log("🌱 เริ่มต้น seed ข้อมูลพื้นฐาน...");

    // สร้างแผนกพื้นฐาน (ใช้ upsert เพื่อไม่สร้างซ้ำ)
    const departments = await Promise.all([
        prisma.department.upsert({
            where: { code: "ADMIN" },
            update: {},
            create: {
                name: "บริหาร",
                code: "ADMIN",
                description: "แผนกบริหารจัดการ",
            },
        }),
        prisma.department.upsert({
            where: { code: "ACADEMIC" },
            update: {},
            create: {
                name: "วิชาการ",
                code: "ACADEMIC",
                description: "แผนกวิชาการ",
            },
        }),
    ]);

    // eslint-disable-next-line no-console
    console.log(
        "✅ สร้างแผนกสำเร็จ:",
        departments.map((d) => d.name).join(", "),
    );

    // สร้างพนักงานผู้ดูแลระบบ (Admin) เพื่อให้ User คนแรก สมัครแล้วได้สิทธิ์ Admin ทันที
    const adminDept = departments.find((d) => d.code === "ADMIN");
    if (adminDept) {
        const adminEmployee = await prisma.employee.upsert({
            where: { email: "admin@thainhf.org" },
            update: {},
            create: {
                firstName: "System",
                lastName: "Administrator",
                email: "admin@thainhf.org",
                position: "IT Manager",
                departmentId: adminDept.id,
                status: "ACTIVE",
            },
        });
        // eslint-disable-next-line no-console
        console.log(`✅ สร้างพนักงานตั้งต้นสำเร็จ: ${adminEmployee.email} (กรุณาใช้ email นี้สมัครสมาชิก หรือเปลี่ยนในฐานข้อมูลก่อนสมัคร)`);
    }

    // eslint-disable-next-line no-console
    console.log("🎉 Seed เสร็จสิ้น!");
}

main()
    .then(async () => {
        await prisma.$disconnect();
    })
    .catch(async (e) => {
        console.error("❌ Seed ล้มเหลว:", e);
        await prisma.$disconnect();
        process.exit(1);
    });
