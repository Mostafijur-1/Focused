import { createHash, randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL;
const email = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
const confirmation = process.env.ADMIN_BOOTSTRAP_CONFIRM;
if (!databaseUrl || !email) {
  throw new Error("DATABASE_URL and ADMIN_BOOTSTRAP_EMAIL are required.");
}
if (confirmation !== `grant-platform-administrator:${email}`) {
  throw new Error(
    "ADMIN_BOOTSTRAP_CONFIRM does not match the exact required confirmation.",
  );
}

const client = new pg.Client({ connectionString: databaseUrl });
await client.connect();
try {
  await client.query("BEGIN ISOLATION LEVEL SERIALIZABLE");
  const existing = await client.query(
    `SELECT COUNT(*)::int AS count
     FROM "user_roles" assignment
     JOIN "roles" role ON role."id" = assignment."roleId"
     JOIN "users" member ON member."id" = assignment."userId"
     WHERE role."key" = 'platform-administrator'
       AND member."status" = 'ACTIVE'
       AND (assignment."expiresAt" IS NULL OR assignment."expiresAt" > CURRENT_TIMESTAMP)`,
  );
  if ((existing.rows[0]?.count ?? 0) > 0) {
    throw new Error(
      "A Platform Administrator already exists; use the dual-control role workflow.",
    );
  }
  const target = await client.query(
    `SELECT "id" FROM "users"
     WHERE "email" = $1 AND "status" = 'ACTIVE' AND "emailVerifiedAt" IS NOT NULL
     FOR UPDATE`,
    [email],
  );
  const userId = target.rows[0]?.id;
  if (!userId)
    throw new Error("The bootstrap account must be active and email-verified.");
  const role = await client.query(
    `SELECT "id" FROM "roles" WHERE "key" = 'platform-administrator'`,
  );
  const roleId = role.rows[0]?.id;
  if (!roleId)
    throw new Error("Apply the Admin migration before bootstrapping.");

  await client.query(
    `INSERT INTO "user_roles" ("userId", "roleId", "grantedAt")
     VALUES ($1, $2, CURRENT_TIMESTAMP)
     ON CONFLICT ("userId", "roleId") DO NOTHING`,
    [userId, roleId],
  );
  await client.query(
    `UPDATE "users" SET "permissionVersion" = "permissionVersion" + 1,
       "version" = "version" + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = $1`,
    [userId],
  );

  await client.query(
    `INSERT INTO "audit_chain_heads" ("chainKey", "lastSequence", "updatedAt")
     VALUES ('admin', 0, CURRENT_TIMESTAMP) ON CONFLICT ("chainKey") DO NOTHING`,
  );
  const headResult = await client.query(
    `SELECT "lastSequence", "lastHash" FROM "audit_chain_heads"
     WHERE "chainKey" = 'admin' FOR UPDATE`,
  );
  const head = headResult.rows[0];
  const id = randomUUID();
  const sequence = BigInt(head.lastSequence) + 1n;
  const occurredAt = new Date();
  const event = {
    action: "admin.platform_administrator.bootstrapped",
    actorUserId: userId,
    actorType: "USER",
    chainKey: "admin",
    correlationId: `bootstrap-${id}`,
    id,
    metadata: {
      mechanism: "offline_bootstrap",
      roleKey: "platform-administrator",
    },
    occurredAt: occurredAt.toISOString(),
    outcome: "ALLOWED",
    previousHash: head.lastHash,
    reasonCode: "INITIAL_BOOTSTRAP",
    schemaVersion: 1,
    sequence: sequence.toString(),
    targetId: userId,
    targetType: "User",
  };
  const eventHash = createHash("sha256")
    .update(canonicalJson(event))
    .digest("hex");
  await client.query(
    `INSERT INTO "audit_events" (
       "id", "actorUserId", "actorType", "action", "targetType", "targetId",
       "reasonCode", "correlationId", "metadata", "outcome", "chainKey",
       "sequence", "previousHash", "eventHash", "schemaVersion", "occurredAt"
     ) VALUES ($1,$2,'USER',$3,'User',$2,'INITIAL_BOOTSTRAP',$4,$5::jsonb,
       'ALLOWED','admin',$6,$7,$8,1,$9)`,
    [
      id,
      userId,
      event.action,
      event.correlationId,
      JSON.stringify(event.metadata),
      sequence.toString(),
      head.lastHash,
      eventHash,
      occurredAt,
    ],
  );
  await client.query(
    `UPDATE "audit_chain_heads" SET "lastSequence" = $1, "lastHash" = $2,
       "updatedAt" = CURRENT_TIMESTAMP WHERE "chainKey" = 'admin'`,
    [sequence.toString(), eventHash],
  );
  await client.query("COMMIT");
  process.stdout.write(
    `${JSON.stringify({ status: "bootstrapped", userId, role: "platform-administrator" })}\n`,
  );
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}
