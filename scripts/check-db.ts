import { createClient } from '@libsql/client';
import dotenv from 'dotenv';

dotenv.config();

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}

const client = createClient({
  url,
  authToken,
});

async function main() {
  console.log('Querying remote Turso database tables...');
  const res = await client.execute("SELECT name FROM sqlite_schema WHERE type='table';");
  console.log('Tables in database:');
  for (const row of res.rows) {
    console.log(` - ${row.name}`);
  }
}

main()
  .catch((error) => {
    console.error('Error querying database:', error.message || error);
    process.exitCode = 1;
  })
  .finally(() => {
    client.close();
  });
