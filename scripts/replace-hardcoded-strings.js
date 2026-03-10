#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const DRY_RUN = process.argv.includes("--dry-run");
const ONLY_DIR = (() => {
  const i = process.argv.indexOf("--dir");
  return i >= 0 ? process.argv[i + 1] : null;
})();

// ---- CONFIG ----
const LOCALES_PATH = path.join(__dirname, "..", "locales", "en.json");
const APP_DIR = ONLY_DIR
  ? path.resolve(ONLY_DIR)
  : path.join(__dirname, "..", "app");

const IGNORE_DIRS = new Set(["node_modules", ".git", ".expo", "dist", "build"]);
const FILE_EXTS = new Set([".ts", ".tsx"]);

// If a phrase exists under multiple keys, prefer these namespaces (in order)
const PREFERRED_PREFIXES = ["common.", "tabs.", "home.", "profile.", "search.", "listing.", "settings."];

// ---- HELPERS ----
function flatten(obj, prefix = "", out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      flatten(v, fullKey, out);
    } else if (typeof v === "string") {
      out.push({ key: fullKey, text: v });
    }
  }
  return out;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!IGNORE_DIRS.has(e.name)) walk(full, files);
    } else {
      const ext = path.extname(e.name);
      if (FILE_EXTS.has(ext)) files.push(full);
    }
  }
  return files;
}

function ensureUseTranslation(content) {
  const hasImport = content.includes("useTranslation") && content.includes("react-i18next");
  if (!hasImport) {
    content = `import { useTranslation } from 'react-i18next';\n${content}`;
  }

  // Try to inject into common component forms:
  // export default function X(...) { ... }
  // function X(...) { ... }
  // const X = (...) => { ... }
  const hasHook = /const\s*{\s*t\s*}\s*=\s*useTranslation\(\)\s*;/.test(content);
  if (hasHook) return content;

  // Insert after first component function opening brace
  const patterns = [
    /(export\s+default\s+function\s+\w+\s*\([^)]*\)\s*{)/,
    /(function\s+\w+\s*\([^)]*\)\s*{)/,
    /(const\s+\w+\s*=\s*\([^)]*\)\s*=>\s*{)/,
  ];

  for (const re of patterns) {
    const m = content.match(re);
    if (m) {
      return content.replace(m[0], `${m[0]}\n  const { t } = useTranslation();`);
    }
  }

  // If we can’t confidently inject, leave it (you can add manually).
  return content;
}

function buildTextIndex(flat) {
  // text -> [keys...]
  const map = new Map();
  for (const { key, text } of flat) {
    if (!map.has(text)) map.set(text, []);
    map.get(text).push(key);
  }

  // resolve duplicates with preferred prefixes, otherwise mark ambiguous
  const resolved = new Map();     // text -> key
  const ambiguous = new Map();    // text -> keys

  for (const [text, keys] of map.entries()) {
    if (keys.length === 1) {
      resolved.set(text, keys[0]);
      continue;
    }

    // try preferred prefixes
    let chosen = null;
    for (const pref of PREFERRED_PREFIXES) {
      const k = keys.find((x) => x.startsWith(pref));
      if (k) { chosen = k; break; }
    }

    if (chosen) resolved.set(text, chosen);
    else ambiguous.set(text, keys);
  }

  return { resolved, ambiguous };
}

function processFile(filePath, sortedTexts, textToKey) {
  let content = fs.readFileSync(filePath, "utf8");
  let modified = false;
  let replacements = 0;

  // Skip if it looks like a non-React file (optional)
  // if (!content.includes("export") && !content.includes("function") && !content.includes("=>")) return { modified:false, replacements:0 };

  for (const text of sortedTexts) {
    const key = textToKey.get(text);
    if (!key) continue;

    // avoid replacing inside existing t('...') calls
    // (very basic guard; keeps script from re-wrapping)
    if (content.includes(`t('${key}')`) || content.includes(`t("${key}")`)) {
      continue;
    }

    const escaped = escapeRegExp(text);

    // 1) <Text>Exact</Text>  (also matches <Text style=...>Exact</Text>)
    // ensure we only replace direct string children, not {"Exact"}
    const reTextNode = new RegExp(`<Text([^>]*)>\\s*${escaped}\\s*<\\/Text>`, "g");
    if (reTextNode.test(content)) {
      content = content.replace(reTextNode, `<Text$1>{t('${key}')}</Text>`);
      modified = true; replacements++;
    }

    // 2) placeholder="Exact"
    const rePlaceholder = new RegExp(`placeholder=([\"'])${escaped}\\1`, "g");
    if (rePlaceholder.test(content)) {
      content = content.replace(rePlaceholder, `placeholder={t('${key}')}`);
      modified = true; replacements++;
    }

    // 3) title/label/accessibilityLabel="Exact"
    const reProps = new RegExp(`(title|label|accessibilityLabel)=([\"'])${escaped}\\2`, "g");
    if (reProps.test(content)) {
      content = content.replace(reProps, `$1={t('${key}')}`);
      modified = true; replacements++;
    }

    // 4) Alert.alert("Title", "Message")
    // Replace title
    const reAlertTitle = new RegExp(`Alert\\.alert\\(\\s*([\"'])${escaped}\\1`, "g");
    if (reAlertTitle.test(content)) {
      content = content.replace(reAlertTitle, `Alert.alert(t('${key}')`);
      modified = true; replacements++;
    }

    // Replace message (second argument) if present as a literal string
    // This is tricky; we do a lighter approach:
    // Alert.alert("X", "Y") => Alert.alert(t('...'), t('...'))
    // We’ll handle message separately by exact string match:
    const reAlertMsg = new RegExp(`Alert\\.alert\\(([^\\)]*?),\\s*([\"'])${escaped}\\2`, "g");
    if (reAlertMsg.test(content)) {
      content = content.replace(reAlertMsg, (m, firstArg) => `Alert.alert(${firstArg}, t('${key}')`);
      modified = true; replacements++;
    }
  }

  if (modified) {
    const updated = ensureUseTranslation(content);

    if (!DRY_RUN) {
      fs.writeFileSync(filePath, updated, "utf8");
    }

    return { modified: true, replacements };
  }

  return { modified: false, replacements: 0 };
}

// ---- MAIN ----
function main() {
  if (!fs.existsSync(LOCALES_PATH)) {
    console.error(`❌ Could not find ${LOCALES_PATH}`);
    process.exit(1);
  }

  const enJson = readJson(LOCALES_PATH);
  const flat = flatten(enJson);

  const { resolved, ambiguous } = buildTextIndex(flat);

  if (ambiguous.size > 0) {
    console.log(`⚠️  Found ${ambiguous.size} ambiguous English phrases (duplicates).`);
    console.log(`    These will be skipped unless they match preferred prefixes.\n`);
  }

  // We only replace resolved phrases
  const texts = Array.from(resolved.keys())
    .filter((t) => t && t.trim().length > 0);

  // Longest first prevents partial replacement collisions
  const sortedTexts = texts.sort((a, b) => b.length - a.length);

  console.log(`📚 Loaded ${flat.length} strings from en.json`);
  console.log(`✅ Replaceable unique strings: ${sortedTexts.length}`);
  console.log(`🧪 Mode: ${DRY_RUN ? "DRY RUN (no files written)" : "WRITE"}`);
  console.log(`🔍 Scanning: ${APP_DIR}\n`);

  const files = walk(APP_DIR);
  let modifiedFiles = 0;
  let totalReplacements = 0;

  for (const f of files) {
    const { modified, replacements } = processFile(f, sortedTexts, resolved);
    if (modified) {
      modifiedFiles++;
      totalReplacements += replacements;
      console.log(`✅ ${path.relative(process.cwd(), f)}: ${replacements} replacements`);
    }
  }

  console.log(`\n${"=".repeat(60)}`);
  console.log(`🎉 Done`);
  console.log(`Files scanned: ${files.length}`);
  console.log(`Files modified: ${modifiedFiles}`);
  console.log(`Total replacements: ${totalReplacements}`);
  console.log(`${"=".repeat(60)}\n`);

  if (ambiguous.size > 0) {
    console.log("Ambiguous phrases (not auto-replaced):");
    let shown = 0;
    for (const [text, keys] of ambiguous.entries()) {
      // show only a few so output isn’t massive
      if (shown >= 20) break;
      console.log(`- "${text}"  ->  ${keys.join(", ")}`);
      shown++;
    }
    if (ambiguous.size > 20) console.log(`... and ${ambiguous.size - 20} more`);
    console.log("\nTip: If you want these replaced, pick one canonical key (usually common.*) and remove the duplicates.");
  }
}

main();
