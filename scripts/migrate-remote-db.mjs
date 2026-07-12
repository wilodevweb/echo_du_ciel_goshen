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
  console.log('Migrating remote database schema on Turso...');

  // 1. Parent table: Rename lastName to name, drop firstName
  try {
    console.log('Renaming Parent.lastName to Parent.name...');
    await client.execute("ALTER TABLE Parent RENAME COLUMN lastName TO name;");
    console.log('Parent.lastName renamed successfully.');
  } catch (error) {
    console.log('Parent.lastName rename skipped or failed (might already be renamed):', error.message);
  }

  try {
    console.log('Dropping Parent.firstName...');
    await client.execute("ALTER TABLE Parent DROP COLUMN firstName;");
    console.log('Parent.firstName dropped successfully.');
  } catch (error) {
    console.log('Parent.firstName drop skipped or failed (might already be dropped):', error.message);
  }

  // 2. Child table: Rename parentLastName to parentName, drop parentFirstName
  try {
    console.log('Renaming Child.parentLastName to Child.parentName...');
    await client.execute("ALTER TABLE Child RENAME COLUMN parentLastName TO parentName;");
    console.log('Child.parentLastName renamed successfully.');
  } catch (error) {
    console.log('Child.parentLastName rename skipped or failed (might already be renamed):', error.message);
  }

  try {
    console.log('Dropping Child.parentFirstName...');
    await client.execute("ALTER TABLE Child DROP COLUMN parentFirstName;");
    console.log('Child.parentFirstName dropped successfully.');
  } catch (error) {
    console.log('Child.parentFirstName drop skipped or failed (might already be dropped):', error.message);
  }

  console.log('Migration completed successfully.');
}

main()
  .catch((error) => {
    console.error('Migration failed:', error.message || error);
    process.exitCode = 1;
  })
  .finally(() => {
    client.close();
  });
