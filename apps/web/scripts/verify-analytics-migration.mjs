// Read-only post-deployment verification. It never prints the connection string.
import pg from "pg";

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL is required to verify the Analytics migration.");
}

const permissionKeys = [
  "analytics:read:own",
  "analytics:write:own",
  "reports:read:own",
  "reports:write:own",
  "exports:read:own",
  "exports:write:own",
  "gamification:read:own",
  "gamification:write:own",
];
const metricKeys = [
  "focus_seconds",
  "focus_sessions_completed",
  "interruptions_self_reported",
  "habit_completion",
  "goal_check_ins",
  "weekly_plans_finalized",
];

const connectionUrl = new URL(connectionString);
connectionUrl.searchParams.delete("sslmode");
const client = new pg.Client({
  connectionString: connectionUrl.toString(),
  ssl: { rejectUnauthorized: true },
});

await client.connect();
try {
  const result = await client.query(
    `SELECT
      (SELECT COUNT(*)::int
       FROM "_prisma_migrations"
       WHERE migration_name = $1
         AND finished_at IS NOT NULL
         AND rolled_back_at IS NULL) AS migration,
      (SELECT COUNT(*)::int
       FROM permissions
       WHERE key = ANY($2::text[])) AS permissions,
      (SELECT COUNT(*)::int
       FROM role_permissions mapping
       JOIN roles role ON role.id = mapping."roleId"
       JOIN permissions permission ON permission.id = mapping."permissionId"
       WHERE role.key = 'member'
         AND permission.key = ANY($2::text[])) AS grants,
      (SELECT COUNT(*)::int
       FROM metric_definitions
       WHERE version = 1
         AND key = ANY($3::text[])) AS metrics,
      (SELECT COUNT(*)::int
       FROM level_definitions
       WHERE level BETWEEN 1 AND 5) AS levels,
      (SELECT COUNT(*)::int
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($4::text[])) AS tables,
      (SELECT COUNT(*)::int
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND (
           (table_name = 'export_jobs' AND column_name = ANY($5::text[]))
           OR (table_name = 'report_jobs' AND column_name = 'clientCommandId')
         )) AS columns`,
    [
      "20260801235900_analytics",
      permissionKeys,
      metricKeys,
      ["analytics_projection_cursors", "analytics_preferences"],
      [
        "clientCommandId",
        "format",
        "fileName",
        "contentType",
        "artifactEncrypted",
        "encryptionKeyId",
      ],
    ],
  );
  const actual = result.rows[0];
  const expected = {
    migration: 1,
    permissions: permissionKeys.length,
    grants: permissionKeys.length,
    metrics: metricKeys.length,
    levels: 5,
    tables: 2,
    columns: 7,
  };

  for (const [key, value] of Object.entries(expected)) {
    if (actual[key] !== value) {
      throw new Error(
        `Analytics migration verification failed for ${key}: expected ${value}, received ${actual[key]}.`,
      );
    }
  }

  console.log(JSON.stringify({ status: "verified", ...actual }));
} finally {
  await client.end();
}
