// Diagnostic only - never fails the build.
// Runs before "next build" (npm prebuild) and prints the exact invalid CSS
// selector that Tailwind generates, so it shows up in the Vercel build log.
import { execSync } from "node:child_process";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const out = join(mkdtempSync(join(tmpdir(), "css-check-")), "out.css");

try {
  execSync(`npx -y @tailwindcss/cli@4.3.3 -i src/app/globals.css -o "${out}" -m`, { stdio: "inherit" });
  const code = readFileSync(out);
  let transform;
  try {
    ({ transform } = require("lightningcss"));
  } catch {
    console.log("[css-check] lightningcss not found - skipping validation");
    process.exit(0);
  }
  try {
    transform({ filename: "out.css", code, minify: true });
    console.log("[css-check] CSS OK - no invalid selector");
  } catch (e) {
    const text = code.toString();
    const line = text.split("\n")[(e.loc?.line ?? 1) - 1] ?? "";
    const col = e.loc?.column ?? 0;
    console.log("[css-check] INVALID CSS:", e.message);
    console.log("[css-check] CONTEXT >>>", line.slice(Math.max(0, col - 400), col + 80), "<<<");
  }
} catch (e) {
  console.log("[css-check] could not run:", e.message);
}
process.exit(0);
