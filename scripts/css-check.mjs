// CSS guard - runs automatically before "next build" (npm prebuild).
//
// Tailwind v4 turns every class-like string it finds in src/ into CSS. A string
// such as "[&>]:p-1" produces an invalid selector (".x > {" - a dangling
// combinator), and Turbopack then fails the whole build with
// "Invalid dangling combinator in selector".
//
// This script compiles the CSS exactly like the build does (unminified), and if
// it finds such a selector it adds `@source not inline("<class>")` to
// src/app/globals.css (only inside the build machine, nothing is committed) so
// Tailwind ignores that one string. It prints which file contains the string so
// it can be fixed at the source. It never fails the build by itself.
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const CSS_FILE = "src/app/globals.css";
const MAX_ROUNDS = 25;
const require = createRequire(import.meta.url);

function loadLightning() {
  try {
    return require("lightningcss");
  } catch {}
  try {
    const nodeReq = createRequire(require.resolve("@tailwindcss/node"));
    return nodeReq("lightningcss");
  } catch {}
  return null;
}

function unescapeCss(s) {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    if (s[i] !== "\\") {
      out += s[i];
      continue;
    }
    const hex = /^[0-9a-fA-F]{1,6}/.exec(s.slice(i + 1));
    if (hex) {
      out += String.fromCodePoint(parseInt(hex[0], 16));
      i += hex[0].length;
      if (s[i + 1] === " ") i++;
    } else {
      out += s[i + 1] ?? "";
      i++;
    }
  }
  return out;
}

function candidateAt(css, line, column) {
  const lines = css.split("\n");
  let offset = 0;
  for (let i = 0; i < line - 1 && i < lines.length; i++) offset += lines[i].length + 1;
  offset += Math.max(0, column - 1);
  let start = offset;
  while (start > 0 && !"{};".includes(css[start - 1])) start--;
  let end = offset;
  while (end < css.length && css[end] !== "{") end++;
  const selector = css.slice(start, end).trim();
  const m = /\.((?:\\[0-9a-fA-F]{1,6} ?|\\.|[A-Za-z0-9_-])+)/.exec(selector);
  return { selector, candidate: m ? unescapeCss(m[1]) : null };
}

function findInSrc(needle, dir = "src", hits = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules") continue;
      findInSrc(needle, p, hits);
    } else if (st.size < 3_000_000) {
      const text = readFileSync(p, "utf8");
      const idx = text.indexOf(needle);
      if (idx !== -1) hits.push(`${p}:${text.slice(0, idx).split("\n").length}`);
    }
    if (hits.length >= 5) break;
  }
  return hits;
}

function main() {
  const lightning = loadLightning();
  if (!lightning) {
    console.log("[css-guard] lightningcss not found - skipping");
    return;
  }
  const out = join(mkdtempSync(join(tmpdir(), "css-guard-")), "out.css");
  const excluded = [];

  for (let round = 0; round < MAX_ROUNDS; round++) {
    execSync(`npx -y @tailwindcss/cli@4.3.3 -i ${CSS_FILE} -o "${out}"`, { stdio: "ignore" });
    const css = readFileSync(out, "utf8");
    try {
      lightning.transform({ filename: "out.css", code: Buffer.from(css), minify: false });
      console.log(excluded.length ? `[css-guard] fixed - CSS valid after excluding ${excluded.length} class(es)` : "[css-guard] CSS OK");
      return;
    } catch (e) {
      const { selector, candidate } = candidateAt(css, e.loc?.line ?? 1, e.loc?.column ?? 1);
      console.log(`[css-guard] invalid CSS: ${e.message} | selector: ${selector.slice(0, 200)}`);
      if (!candidate || excluded.includes(candidate)) {
        console.log("[css-guard] could not isolate the class - leaving the build as is");
        return;
      }
      const where = findInSrc(candidate);
      console.log(`[css-guard] excluding class "${candidate}" (found in: ${where.join(", ") || "unknown"})`);
      excluded.push(candidate);
      const raw = readFileSync(CSS_FILE);
      const hasBom = raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
      const text = raw.toString("utf8").replace(/^\uFEFF/, "");
      const directive = `@source not inline(${JSON.stringify(candidate)});`;
      const lines = text.split(/(\r?\n)/);
      // after the first two @import lines (tailwindcss + tokens)
      let inserted = false;
      let importsSeen = 0;
      for (let i = 0; i < lines.length; i += 2) {
        if (/^@import\b/.test(lines[i])) importsSeen++;
        if (importsSeen > 0 && !/^@import\b/.test(lines[i]) && !inserted) {
          lines.splice(i, 0, directive, "\n");
          inserted = true;
          break;
        }
      }
      const next = inserted ? lines.join("") : `${text}\n${directive}\n`;
      writeFileSync(CSS_FILE, (hasBom ? "\uFEFF" : "") + next);
    }
  }
  console.log("[css-guard] too many invalid classes - giving up");
}

try {
  main();
} catch (e) {
  console.log("[css-guard] error:", e?.message ?? e);
}
process.exit(0);
