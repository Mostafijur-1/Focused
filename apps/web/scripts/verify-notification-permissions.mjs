import pg from "pg";

const permissionKeys = [
  "notifications:read:own",
  "notifications:write:own",
  "notifications:push:own",
  "reminders:read:own",
  "reminders:write:own",
];

const connectionString = process.env.DIRECT_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL is required for permission verification.");
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  const result = await client.query(
    `SELECT permission.key,
            (role_permission."roleId" IS NOT NULL) AS granted
       FROM "permissions" permission
       CROSS JOIN "roles" role
       LEFT JOIN "role_permissions" role_permission
         ON role_permission."roleId" = role.id
        AND role_permission."permissionId" = permission.id
      WHERE role.key = 'member'
        AND permission.key = ANY($1::text[])
      ORDER BY permission.key`,
    [permissionKeys],
  );
  const granted = new Set(
    result.rows.filter((row) => row.granted).map((row) => row.key),
  );
  const missing = permissionKeys.filter((key) => !granted.has(key));
  process.stdout.write(
    `${JSON.stringify({
      verified: [...granted].sort(),
      missing,
      allGranted: missing.length === 0,
    })}\n`,
  );
  if (missing.length > 0) process.exitCode = 1;
} finally {
  await client.end();
}
