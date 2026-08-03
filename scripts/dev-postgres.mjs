// Local-only helper: spins up a real Postgres via the embedded-postgres
// package (no Docker/Homebrew needed) for smoke testing. NOT used in
// production — Railway provides managed Postgres there.
import EmbeddedPostgres from "embedded-postgres";

const pg = new EmbeddedPostgres({
  databaseDir: ".dev-postgres-data",
  user: "user",
  password: "password",
  port: 5433,
  persistent: false,
});

await pg.initialise();
await pg.start();
await pg.createDatabase("pablo_rojo_setter");

console.log("DATABASE_URL=postgres://user:password@localhost:5433/pablo_rojo_setter");

process.on("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});
