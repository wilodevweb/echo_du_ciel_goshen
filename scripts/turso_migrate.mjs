import { createClient } from "@libsql/client";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (!url || !authToken) {
  console.error("Missing DATABASE_URL or DATABASE_AUTH_TOKEN in environment.");
  process.exit(1);
}

const client = createClient({
  url,
  authToken,
});

async function main() {
  console.log("Starting Turso migration for Event and Task tables...");

  try {
    console.log("Creating Event table...");
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "Event" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "title" TEXT NOT NULL,
          "date" TEXT NOT NULL,
          "description" TEXT,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL
      );
    `);

    console.log("Creating Task table...");
    await client.execute(`
      CREATE TABLE IF NOT EXISTS "Task" (
          "id" TEXT NOT NULL PRIMARY KEY,
          "eventId" TEXT NOT NULL,
          "childId" TEXT NOT NULL,
          "title" TEXT NOT NULL,
          "type" TEXT,
          "done" BOOLEAN NOT NULL DEFAULT 0,
          "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" DATETIME NOT NULL,
          CONSTRAINT "Task_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "Task_childId_fkey" FOREIGN KEY ("childId") REFERENCES "Child" ("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);

    console.log("Creating unique index on Task...");
    await client.execute(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Task_eventId_childId_title_key" ON "Task"("eventId", "childId", "title");
    `);

    console.log("Migration completed successfully!");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
}

main();
