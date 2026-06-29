import { prisma } from '../src/lib/prisma';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
  console.log('Testing DB write on MediaResource...');
  try {
    const res = await prisma.mediaResource.create({
      data: {
        title: 'Test direct write',
        type: 'pdf',
        url: '/uploads/test.pdf',
        thumbnail: 'bg-rose-100',
        aspectRatio: 'square',
      }
    });
    console.log('WRITE SUCCESS:', res);
    // clean up
    await prisma.mediaResource.delete({
      where: { id: res.id }
    });
    console.log('CLEANUP SUCCESS');
  } catch (err: unknown) {
    console.error('WRITE FAILED:', err instanceof Error ? err.stack : err);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
