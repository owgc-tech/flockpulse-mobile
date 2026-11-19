/**
 * FP-213 (mobile) — neutral wording: standalone check
 *
 * No test runner exists in this repo, so this is a plain script (run with
 * `npx tsx scripts/test-fp213-wording.ts`). It parses every .ts/.tsx file under
 * app/ and src/ with the TypeScript compiler and inspects only user-visible
 * text: string literals, template-literal text and JSX text. Comments, import /
 * export specifiers, type-level literals and testID values are never visible to
 * a user, so they are skipped.
 *
 * FAIL  : a user-visible string still contains Formation / Talk / Talks
 *         (whole word, any case for strings that contain whitespace; capitalised
 *         form only for single-token strings, so ids/paths/enum values such as
 *         "talk" or "/api/talks" do not count).
 * REPORT: user-visible strings containing church-specific words. Never fails.
 */
// Same pattern as the other scripts: no Node type definitions in this repo.
declare const require: (id: string) => any;
declare const process: { cwd(): string; exit(code: number): never };
const fs = require("fs");
const path = require("path");
const ts = require("typescript");
type Node = any;
type SourceFile = any;

const ROOT = process.cwd();
const DIRS = ["app", "src"];

// Explicit allowlist: { file, text, reason }. Empty unless a hit is deliberate.
const ALLOWLIST: { file: string; text: string; reason: string }[] = [];

const BANNED_ANY_CASE = /\b(formation|talks?)\b/i;
const BANNED_CAPITALISED = /\b(Formation|Talks?)\b/;
const REPORT_WORDS = [
  "Pastoral", "Prayer", "Church", "Bible", "Scripture", "Worship", "Ministry",
  "Fellowship", "Parish", "Congregation", "Sermon", "Pastor", "Faith", "God",
  "Spirit", "Shepherd", "Retreat", "Gospel", "Holy", "Devotion", "Praise",
];
const REPORT_RE = new RegExp("\\b(" + REPORT_WORDS.join("|") + ")\\b", "i");

function walk(dir: string, out: string[]) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true }) as any[]) {
    if (e.name === "node_modules") continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.d\.ts$/.test(e.name)) out.push(p);
  }
}

type Hit = { file: string; line: number; text: string };

function isInvisibleContext(node: Node): boolean {
  const parent = node.parent;
  if (!parent) return false;
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
  if (ts.isExternalModuleReference(parent)) return true;
  if (ts.isLiteralTypeNode(parent) || ts.isImportTypeNode(parent)) return true;
  if (ts.isCallExpression(parent) && parent.expression.kind === ts.SyntaxKind.ImportKeyword) return true;
  if (ts.isCallExpression(parent) && ts.isIdentifier(parent.expression) && parent.expression.text === "require") return true;
  if (ts.isJsxAttribute(parent.parent ?? parent) || ts.isJsxAttribute(parent)) {
    const attr = ts.isJsxAttribute(parent) ? parent : (parent.parent as any);
    if (attr.name.getText() === "testID" || attr.name.getText() === "key") return true;
  }
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true; // object key
  return false;
}

const bannedHits: Hit[] = [];
const reportHits: Hit[] = [];
let scanned = 0;

function consider(file: string, sf: SourceFile, node: Node, text: string) {
  const t = text.trim();
  if (!t) return;
  const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
  const hasSpace = /\s/.test(t);
  const looksLikePath = t.startsWith("/") || t.includes("/api/");
  const banned =
    !looksLikePath && (hasSpace ? BANNED_ANY_CASE.test(t) : BANNED_CAPITALISED.test(t));
  if (banned) bannedHits.push({ file, line, text: t });
  if (!looksLikePath && REPORT_RE.test(t)) reportHits.push({ file, line, text: t });
}

for (const d of DIRS) {
  const files: string[] = [];
  const full = path.join(ROOT, d);
  if (fs.existsSync(full)) walk(full, files);
  for (const f of files) {
    const rel = path.relative(ROOT, f).split(path.sep).join("/");
    const sf = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true,
      f.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    scanned++;
    const visit = (node: Node) => {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        if (!isInvisibleContext(node)) consider(rel, sf, node, node.text);
      } else if (ts.isTemplateExpression(node)) {
        if (!isInvisibleContext(node)) {
          consider(rel, sf, node, node.head.text + " " + node.templateSpans.map((s: any) => s.literal.text).join(" "));
        }
      } else if (ts.isJsxText(node)) {
        consider(rel, sf, node, node.text);
      }
      ts.forEachChild(node, visit);
    };
    visit(sf);
  }
}

console.log(`Scanned ${scanned} files under ${DIRS.join(", ")}\n`);

let failures = 0;
const allowed: (Hit & { reason: string })[] = [];
for (const h of bannedHits) {
  const a = ALLOWLIST.find((x) => x.file === h.file && x.text === h.text);
  if (a) allowed.push({ ...h, reason: a.reason });
  else {
    failures++;
    console.log(`  FAIL  ${h.file}:${h.line}  "${h.text}"`);
  }
}
if (failures === 0) console.log("  PASS  no user-visible Formation / Talk / Talks strings remain");
console.log(`\nAllowlist (${ALLOWLIST.length} entries, ${allowed.length} matched):`);
for (const a of ALLOWLIST) console.log(`  - ${a.file}: "${a.text}" — ${a.reason}`);
for (const a of allowed) console.log(`  allowed ${a.file}:${a.line} "${a.text}" (${a.reason})`);

console.log(`\nReport-only (church-specific words in user-visible strings, ${reportHits.length} found):`);
for (const h of reportHits) console.log(`  ${h.file}:${h.line}  "${h.text}"`);

if (failures > 0) {
  console.log(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log("\nall checks passed");
