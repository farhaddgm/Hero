import { createPostgresRuntime } from "../packages/adapters/src/postgresql-runtime.mjs";

const connectionString = process.env.HERO_POSTGRES_URL;
if (typeof connectionString !== "string" || connectionString.trim() === "") {
  console.error("POSTGRES CHECK BLOCKED — HERO_POSTGRES_URL is not configured.");
  process.exitCode = 1;
} else {
  try {
    const runtime = await createPostgresRuntime({ connectionString });
    const ping = await runtime.ping();
    console.log(
      "POSTGRES CHECK PASS — persistence=" +
      ping.persistence +
      ", migration=" +
      runtime.migration.schemaVersion
    );
    await runtime.close();
  } catch (error) {
    console.error("POSTGRES CHECK FAIL — " + error.code);
    process.exitCode = 1;
  }
}
