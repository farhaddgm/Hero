import { createPostgresMigrationRunner } from "./postgresql-schema.mjs";
import { createPostgresOperationalStore } from "./postgresql-operational-store.mjs";
import { createPostgresCommandAudit } from "./postgresql-command-audit.mjs";
import { createPostgresDomainRegistrySnapshotStore } from "./domain-registry-snapshot-store.mjs";
import { createPostgresOwnerSessionStore } from "./owner-session-store.mjs";
import { createPostgresBenchmarkStore } from "./postgresql-benchmark-store.mjs";
import { createPostgresReadModelAccessAuditStore } from "./postgresql-read-model-access-audit.mjs";
import { createPostgresPricingCatalogStore } from "./postgresql-pricing-catalog.mjs";
import { createPostgresNotionSyncStore } from "./postgresql-notion-sync-store.mjs";
import { createPostgresProjectIdentityStore } from "./postgresql-project-identity-store.mjs";
import { createPostgresProjectWorkspaceStore } from "./postgresql-project-workspace-store.mjs";
import { createPostgresCollaborationStore } from "./postgresql-collaboration-store.mjs";
import { createPostgresCommandCenterStore } from "./postgresql-command-center-store.mjs";
import { createPostgresProductRuntimeReservationStore } from "./postgresql-product-runtime-reservation-store.mjs";

export class PostgresRuntimeError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "PostgresRuntimeError";
    this.code = code;
  }
}

function assertQueryTarget(target) {
  if (!target || typeof target.query !== "function") {
    throw new PostgresRuntimeError("POSTGRES_CLIENT_INVALID", "A PostgreSQL client or pool is required.");
  }
}

export async function createPostgresRuntime({ connectionString = process.env.HERO_POSTGRES_URL, pool: injectedPool, client: injectedClient } = {}) {
  if (!injectedPool && !injectedClient && (typeof connectionString !== "string" || connectionString.trim() === "")) {
    throw new PostgresRuntimeError("POSTGRES_NOT_CONFIGURED", "HERO_POSTGRES_URL is not configured.");
  }

  let pool = injectedPool ?? null;
  let client = injectedClient ?? null;
  let ownsPool = false;
  let ownsClient = false;

  try {
    if (!pool && !client) {
      const pg = await import("pg");
      const Pool = pg.default?.Pool ?? pg.Pool;
      if (typeof Pool !== "function") throw new Error("The pg driver did not expose Pool.");
      pool = new Pool({ connectionString, max: 5, connectionTimeoutMillis: 5000 });
      pool.on("error", () => {});
      ownsPool = true;
    }

    assertQueryTarget(pool ?? client);
    let migrationClient = client;
    let releaseMigrationClient = null;
    if (!migrationClient && pool) {
      migrationClient = await pool.connect();
      releaseMigrationClient = () => migrationClient.release();
    }
    try {
      const migration = await createPostgresMigrationRunner({ client: migrationClient }).migrate();
      const target = pool ?? client;
      const store = pool ? createPostgresOperationalStore({ pool }) : createPostgresOperationalStore({ client });
      return Object.freeze({
        configured: true,
        migration,
        store,
        audit: createPostgresCommandAudit({ store }),
        registrySnapshots: createPostgresDomainRegistrySnapshotStore({ pool, client }),
        ownerSessions: createPostgresOwnerSessionStore({ pool, client }),
        benchmarkStore: createPostgresBenchmarkStore({ pool, client }),
        accessAudit: createPostgresReadModelAccessAuditStore({ pool, client }),
        pricingCatalogStore: createPostgresPricingCatalogStore({ pool, client }),
        notionSyncMappings: createPostgresNotionSyncStore({ pool, client }),
        projectIdentity: createPostgresProjectIdentityStore({ pool, client }),
        projectWorkspace: createPostgresProjectWorkspaceStore({ pool, client }),
        collaboration: createPostgresCollaborationStore({ pool, client }),
        commandCenter: createPostgresCommandCenterStore({ pool, client }),
        productRuntimeReservations: createPostgresProductRuntimeReservationStore({ pool, client }),
        async ping() {
          await target.query("SELECT 1");
          return Object.freeze({ status: "ok", persistence: "postgresql" });
        },
        async close() {
          if (ownsPool) await pool.end();
          else if (ownsClient && typeof client.end === "function") await client.end();
        }
      });
    } finally {
      if (releaseMigrationClient) releaseMigrationClient();
    }
  } catch (error) {
    if (ownsPool && pool) await pool.end().catch(() => {});
    if (error instanceof PostgresRuntimeError) throw error;
    throw new PostgresRuntimeError("POSTGRES_CONNECTION_FAILED", "PostgreSQL runtime could not initialize.");
  }
}
