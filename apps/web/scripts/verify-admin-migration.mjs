import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  const migration = await count(
    client,
    `SELECT COUNT(*)::int AS count FROM "_prisma_migrations"
     WHERE "migration_name" = '20260802010000_admin_foundation' AND "finished_at" IS NOT NULL`,
  );
  const roles = await count(
    client,
    `SELECT COUNT(*)::int AS count FROM "roles" WHERE "key" = ANY($1::text[])`,
    [
      [
        "support-administrator",
        "platform-administrator",
        "content-curator",
        "auditor",
      ],
    ],
  );
  const permissions = await count(
    client,
    `SELECT COUNT(*)::int AS count FROM "permissions" WHERE "key" LIKE 'admin:%'`,
  );
  const grants = await count(
    client,
    `SELECT COUNT(*)::int AS count
     FROM "role_permissions" grant_record
     JOIN "roles" role ON role."id" = grant_record."roleId"
     JOIN "permissions" permission ON permission."id" = grant_record."permissionId"
     WHERE role."key" = ANY($1::text[]) AND permission."key" LIKE 'admin:%'`,
    [
      [
        "support-administrator",
        "platform-administrator",
        "content-curator",
        "auditor",
      ],
    ],
  );
  const tables = await count(
    client,
    `SELECT COUNT(*)::int AS count FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
    [
      [
        "admin_cases",
        "operational_mfa_credentials",
        "admin_step_up_grants",
        "admin_approval_requests",
        "audit_chain_heads",
      ],
    ],
  );
  const trigger = await count(
    client,
    `SELECT COUNT(*)::int AS count FROM pg_trigger
     WHERE tgname = 'audit_events_append_only' AND NOT tgisinternal`,
  );
  const chain = await count(
    client,
    `SELECT COUNT(*)::int AS count FROM "audit_chain_heads" WHERE "chainKey" = 'admin'`,
  );
  const expected = {
    migration: 1,
    roles: 4,
    permissions: 17,
    grants: 43,
    tables: 5,
    trigger: 1,
    chain: 1,
  };
  const actual = {
    migration,
    roles,
    permissions,
    grants,
    tables,
    trigger,
    chain,
  };
  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      throw new Error(
        `Admin migration verification failed: ${key}=${actual[key]}, expected ${value}.`,
      );
    }
  }
  process.stdout.write(
    `${JSON.stringify({ status: "verified", ...actual })}\n`,
  );
} finally {
  await client.end();
}

async function count(client, text, values = []) {
  const result = await client.query(text, values);
  return result.rows[0]?.count ?? 0;
}
