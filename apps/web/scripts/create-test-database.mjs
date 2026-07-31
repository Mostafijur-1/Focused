import pg from "pg";

const adminUrl = process.env.ADMIN_DATABASE_URL;
const databaseName = process.env.TEST_DATABASE_NAME;

if (!adminUrl || !databaseName) {
  throw new Error("ADMIN_DATABASE_URL and TEST_DATABASE_NAME are required.");
}
if (!/^[a-z][a-z0-9_]{0,62}$/.test(databaseName)) {
  throw new Error("TEST_DATABASE_NAME must be a safe PostgreSQL identifier.");
}

const client = new pg.Client({ connectionString: adminUrl });
await client.connect();
try {
  const exists = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [databaseName],
  );
  if (exists.rowCount === 0) {
    await client.query(`CREATE DATABASE "${databaseName}"`);
  }
} finally {
  await client.end();
}
