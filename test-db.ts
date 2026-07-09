import { PrismaClient } from '@prisma/client'
import { createClient } from '@libsql/client'
import { PrismaLibSQL } from '@prisma/adapter-libsql'

const client = createClient({ url: process.env.TURSO_DATABASE_URL!, authToken: process.env.TURSO_AUTH_TOKEN })
const adapter = new PrismaLibSQL(client)
const prisma = new PrismaClient({ adapter })

async function main() {
  const children = await prisma.child.findMany({ orderBy: { createdAt: 'desc' }, take: 10 })
  console.log("Total children in Turso:", await prisma.child.count())
  console.log("Last 5 children:", children.slice(0, 5).map(c => c.firstName + ' ' + c.lastName))
}
main().catch(console.error).finally(() => prisma.$disconnect())
