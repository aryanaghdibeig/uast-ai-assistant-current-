const fs = require("fs");
const t = fs.readFileSync(".env.local", "utf8");
const m = t.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m);
let host = "unset";
if (m) {
  try {
    host = new URL(m[1].trim().replace(/^["']|["']$/g, "")).host;
  } catch {
    host = "invalid";
  }
}
console.log("app_url_host", host);
console.log("migration_tool_target_api", "127.0.0.1:54321");
console.log("migration_tool_target_db", "127.0.0.1:54322");
console.log("migration_tool_project_id", "uast-ai-assistant");
console.log(
  "app_matches_local_api",
  host === "127.0.0.1:54321" || host === "localhost:54321"
);
