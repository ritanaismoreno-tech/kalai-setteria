import EmbeddedPostgres from "embedded-postgres";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", ".pgdata");
const PORT = 5433;
const DB_NAME = "setter_ia";
const USER = "postgres";
const PASSWORD = "postgres";

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: USER,
  password: PASSWORD,
  port: PORT,
  persistent: true,
});

async function main() {
  const alreadyInitialised = fs.existsSync(path.join(DATA_DIR, "PG_VERSION"));
  if (!alreadyInitialised) {
    await pg.initialise();
  }
  await pg.start();

  try {
    await pg.createDatabase(DB_NAME);
  } catch {
    // Ya existe de una corrida anterior, seguimos.
  }

  const url = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB_NAME}`;
  console.log(`\nPostgres local corriendo.`);
  console.log(`DATABASE_URL=${url}\n`);
  console.log("Ctrl+C para detenerlo.");
}

async function shutdown() {
  try {
    await pg.stop();
  } finally {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
