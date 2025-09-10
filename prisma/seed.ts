import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // สร้างแผนกพื้นฐาน
  const departments = await Promise.all([
    prisma.department.upsert({
      where: { code: 'ADMIN' },
      update: {},
      create: {
        name: 'บริหาร',
        code: 'ADMIN',
        description: 'แผนกบริหารจัดการ'
      }
    }),
    prisma.department.upsert({
      where: { code: 'ACADEMIC' },
      update: {},
      create: {
        name: 'วิชาการ',
        code: 'ACADEMIC',
        description: 'แผนกวิชาการ'
      }
    })
  ])

  console.log('สร้างแผนกสำเร็จ:', departments)

  // สร้างพนักงานตัวอย่าง
  const employee1 = await prisma.employee.upsert({
    where: { email: 'somchai@company.com' },
    update: {},
    create: {
      firstName: 'สมชาย',
      lastName: 'ใจดี',
      email: 'somchai@company.com',
      phone: '081-234-5678',
      position: 'ผู้จัดการ',
      affiliation: 'โรงเรียน ABC',
      departmentId: departments[0].id, // บริหาร
    }
  })

  const employee2 = await prisma.employee.upsert({
    where: { email: 'somsai@company.com' },
    update: {},
    create: {
      firstName: 'สมใส',
      lastName: 'รักงาน',
      email: 'somsai@company.com',
      phone: '082-345-6789',
      position: 'อาจารย์',
      affiliation: 'มหาวิทยาลัย XYZ',
      departmentId: departments[1].id, // วิชาการ
    }
  })

  console.log('สร้างพนักงานตัวอย่างสำเร็จ:', { employee1, employee2 })
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })