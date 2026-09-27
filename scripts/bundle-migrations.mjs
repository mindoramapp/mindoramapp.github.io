// Concatenates supabase/migrations/*.sql (in order) into one file that can be pasted into the
// Supabase SQL Editor when the Supabase CLI is not available. The output is generated, not versioned.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "..", "supabase", "migrations");
const out = join(import.meta.dirname, "..", "supabase", "setup.generated.sql");

const files = readdirSync(dir)
  .filter((file) => file.endsWith(".sql"))
  .sort();
const sql = files
  .map((file) => `-- ═══ ${file} ═══\n\n${readFileSync(join(dir, file), "utf8").trim()}\n`)
  .join("\n");

writeFileSync(out, `-- Gerado por scripts/bundle-migrations.mjs — não edite.\n\n${sql}`);
console.log(`${files.length} migrações → ${out}`);
