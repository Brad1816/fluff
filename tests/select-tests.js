// ---------------------------------------------------------------------------
// Picks the test files that could be affected by what changed, so you don't
// have to run all of them after every change (run-tests.js --changed).
//
//   node run-tests.js --changed          what you've changed since the last commit
//   node run-tests.js --changed HEAD~3   ...or since any git ref
//   node run-tests.js --changed --why    just list what would run, and why
//   node select-tests.js HEAD~1..HEAD    what one past commit would have run
//
// How it decides:
//   1. From `git diff` it finds the functions, classes, constants and Horse
//      methods whose code changed (new files count as all-changed).
//   2. It adds whatever calls those, up to CALLER_DEPTH levels out (a change
//      to recordStory also picks tests that use giveAffection, which calls
//      it) - but not through names used everywhere (HUB_LIMIT callers).
//      Comments don't count, and neither do built-ins like Math or fill.
//   3. A test file runs if it mentions any of those names, if it's named
//      after a changed file (Shelter.js -> shelter.test.js), or if the test
//      file itself changed.
//   4. ALWAYS (smoke, screens, savefields) run every time: they load the
//      whole game, check every system and screen is registered, and that
//      saving keeps everything.
//   5. Everything runs if the test machinery or index.html changed
//      (FULL_RUN_FILES).
// It's a good guess, not a proof: the game runs all its systems during every
// test, so run the whole suite now and then too (before a check-in).
// ---------------------------------------------------------------------------
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const GAME_DIR = path.resolve(__dirname, "..");
const TESTS_DIR = __dirname;
const ALWAYS = ["smoke", "screens", "savefields"];
const FULL_RUN_FILES = ["index.html", "tests/run-tests.js", "tests/helpers.js", "tests/select-tests.js", "tests/package.json"];
const CALLER_DEPTH = 2;
// Names used all over (getDialogue, SPAWN_ACTIONS, isSmarty...): a change
// there counts for tests that use them directly, but doesn't spread to all
// their callers - that would be every test
const HUB_LIMIT = 20;
// Method names too common to mean anything on their own
const GENERIC = new Set([
  "update", "draw", "init", "reset", "render", "serialize", "deserialize", "constructor", "evaluate", "execute",
  "close", "open", "click", "get", "set", "has", "add", "remove", "step", "hitTest", "onDrop", "setPosition",
  "getBottomY", "drawOffScreen", "updatePosition", "toString", "run", "name", "load", "save", "start", "stop",
  "value", "label", "matches", "text", "apply", "call", "push", "find", "filter", "map", "then", "catch",
]);
const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "function", "return", "else", "with", "do"]);

function git(cmd) {
  return execSync(`git ${cmd}`, { cwd: GAME_DIR, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

// base is a git ref (compare with what's on disk now, new files too) or a
// range "A..B" (compare two commits - for trying this out on old commits)
const _isRange = (base) => base.includes("..");
const _diffArgs = (base) => (_isRange(base) ? base.split("..").join(" ") : base);

// Changed files (relative, forward slashes), including new untracked ones
function changedFiles(base) {
  const tracked = git(`diff --name-only ${_diffArgs(base)}`).split("\n").filter(Boolean);
  const untracked = _isRange(base) ? [] : git("ls-files --others --exclude-standard").split("\n").filter(Boolean);
  return [...new Set([...tracked, ...untracked])];
}

function newFiles(base) {
  if (_isRange(base)) return new Set(git(`diff --name-only --diff-filter=A ${_diffArgs(base)}`).split("\n").filter(Boolean));
  return new Set([
    ...git(`diff --name-only --diff-filter=A ${base}`).split("\n").filter(Boolean),
    ...git("ls-files --others --exclude-standard").split("\n").filter(Boolean),
  ]);
}

// A file's text: on disk, or at the end of a range
function readSource(base, file) {
  if (_isRange(base)) {
    try {
      return git(`show ${base.split("..")[1]}:${file}`);
    } catch (e) {
      return null;
    }
  }
  const full = path.join(GAME_DIR, file);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : null;
}

// index.html: new <script> tags are just new files; anything else runs all
function indexHtmlNeedsFullRun(base) {
  const out = git(`diff -U0 ${_diffArgs(base)} -- index.html`);
  const changed = out.split("\n").filter((l) => /^[+-]/.test(l) && !/^(\+\+\+|---)/.test(l));
  return changed.some((l) => !/^[+-]\s*<script src="[^"]+"><\/script>\s*$/.test(l));
}

// Line numbers (1-based, in the current file) that changed; null = all
function changedLines(base, file, isNew) {
  if (isNew) return null;
  const out = git(`diff -U0 ${_diffArgs(base)} -- "${file}"`);
  const lines = new Set();
  for (const m of out.matchAll(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/gm)) {
    const start = +m[1];
    const count = m[2] === undefined ? 1 : +m[2];
    // (a pure deletion still touches the code around it)
    if (count === 0) lines.add(Math.max(1, start));
    for (let i = 0; i < count; i++) lines.add(start + i);
  }
  return lines;
}

// Top-level declarations and 2-space-indented methods, with their line spans
function declsOf(src) {
  const lines = src.split("\n");
  const top = [];
  const methods = [];
  lines.forEach((line, i) => {
    let m =
      line.match(/^(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)/) ||
      line.match(/^class\s+([A-Za-z_$][\w$]*)/) ||
      line.match(/^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/);
    if (m) return top.push({ name: m[1], start: i + 1 });
    m = line.match(/^ {2}(?:async\s+|static\s+|get\s+|set\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/);
    if (m && !KEYWORDS.has(m[1])) methods.push({ name: m[1], start: i + 1, method: true });
  });
  const span = (list, total) =>
    list.forEach((d, i) => (d.end = (i + 1 < list.length ? list[i + 1].start : total + 1) - 1));
  span(top, lines.length);
  span(methods, lines.length);
  // A method ends where the next top-level declaration starts, too
  for (const m of methods) {
    const nextTop = top.find((t) => t.start > m.start);
    if (nextTop && nextTop.start - 1 < m.end) m.end = nextTop.start - 1;
  }
  return { top, methods, lines };
}

const tokensOf = (text) => new Set(text.match(/[A-Za-z_$][\w$]*/g) || []);

// Comments out (same number of lines), so words in comments don't count
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, (m, pre) => pre);
}

// Methods inside a top-level declaration (a class, addHorseMethods(...))
const methodsIn = (d, methods) => methods.filter((m) => m.start > d.start && m.start <= d.end);

// Every declaration in the game: name -> set of names its body uses
function callGraph() {
  const bodies = new Map(); // name -> Set(tokens)
  for (const file of fs.readdirSync(GAME_DIR)) {
    if (!file.endsWith(".js")) continue;
    const src = fs.readFileSync(path.join(GAME_DIR, file), "utf8");
    const { top, methods } = declsOf(src);
    const lines = stripComments(src).split("\n");
    for (const d of [...top, ...methods]) {
      if (d.method && GENERIC.has(d.name)) continue;
      // (a class's own lines, not its methods': those are their own nodes)
      const inner = d.method ? [] : methodsIn(d, methods);
      const body = lines
        .slice(d.start - 1, d.end)
        .filter((_, i) => !inner.some((m) => d.start + i >= m.start && d.start + i <= m.end))
        .join("\n");
      const set = bodies.get(d.name) || new Set();
      for (const t of tokensOf(body)) if (t !== d.name) set.add(t);
      bodies.set(d.name, set);
    }
  }
  return bodies;
}

// Built-in and everyday names that are never "game code"
const GENERIC_CALLS = new Set([
  "fill", "stroke", "clear", "sort", "slice", "splice", "includes", "keys", "values", "entries", "join", "split",
  "replace", "test", "match", "max", "min", "floor", "round", "abs", "random", "parse", "stringify", "log", "error",
  "now", "reverse", "indexOf", "some", "every", "reduce", "forEach", "concat", "trim", "pop", "shift", "size",
  "delete", "clamp", "lerp", "arc", "rect", "save", "restore", "translate", "scale", "rotate", "moveTo", "lineTo",
]);
for (const n of GENERIC_CALLS) GENERIC.add(n);

function selectTests(base = "HEAD") {
  const reasons = new Map(); // test file base -> [why]
  const note = (t, why) => {
    if (!reasons.has(t)) reasons.set(t, []);
    if (reasons.get(t).length < 4) reasons.get(t).push(why);
  };
  const testFiles = fs.readdirSync(TESTS_DIR).filter((f) => f.endsWith(".test.js")).map((f) => f.replace(".test.js", ""));
  const files = changedFiles(base);
  const untracked = newFiles(base);

  const full = files.filter((f) => FULL_RUN_FILES.includes(f) && (f !== "index.html" || indexHtmlNeedsFullRun(base)));
  if (full.length) return { all: true, why: `changed ${full.join(", ")}`, files, tests: testFiles, reasons };

  const graph = callGraph();
  const gameNames = new Set(graph.keys());

  // 1. What changed
  const changed = new Map(); // name -> file
  for (const f of files) {
    if (f.startsWith("tests/")) {
      const t = path.basename(f).replace(".test.js", "");
      if (testFiles.includes(t)) note(t, "the test file changed");
      continue;
    }
    if (!f.endsWith(".js") || f.includes("/")) continue;
    const src = readSource(base, f);
    if (src === null) continue;
    const { top, methods } = declsOf(src);
    const lines = stripComments(src).split("\n");
    const touched = changedLines(base, f, untracked.has(f));
    // (only lines with code on them - a comment-only edit changes nothing)
    const code = (l) => !!(lines[l - 1] || "").trim();
    const inMethod = (l) => methods.some((m) => l >= m.start && l <= m.end);
    const hit = (d) => {
      if (touched === null) return true;
      for (let l = d.start; l <= d.end; l++) {
        if (!touched.has(l) || !code(l)) continue;
        // A change inside a method is that method's, not its whole class's
        if (!d.method && inMethod(l)) continue;
        return true;
      }
      return false;
    };
    for (const d of [...methods, ...top]) {
      if (d.method && GENERIC.has(d.name)) continue;
      if (hit(d)) changed.set(d.name, f);
    }
    // Changed lines outside any declaration (registerSystem(...) and the
    // like): the game names they use
    if (touched !== null) {
      const covered = (l) => top.some((d) => l >= d.start && l <= d.end);
      for (const l of touched) {
        if (covered(l) || !code(l)) continue;
        for (const t of tokensOf(lines[l - 1])) if (gameNames.has(t) && !GENERIC.has(t)) changed.set(t, f);
      }
    }
    // A test file named after the source file
    const stem = f.replace(/\.js$/, "").toLowerCase();
    for (const t of testFiles) if (t === stem || stem.startsWith(t) || t.startsWith(stem)) note(t, `named after ${f}`);
  }

  // 2. Callers of what changed, CALLER_DEPTH levels out
  const callers = new Map(); // name -> Set(names that use it)
  for (const [name, uses] of graph) {
    for (const u of uses) {
      if (!callers.has(u)) callers.set(u, new Set());
      callers.get(u).add(name);
    }
  }
  const via = new Map([...changed.keys()].map((n) => [n, n]));
  let frontier = [...changed.keys()];
  for (let depth = 0; depth < CALLER_DEPTH; depth++) {
    const next = [];
    for (const n of frontier) {
      const cs = callers.get(n) || new Set();
      if (cs.size > HUB_LIMIT) continue;
      for (const c of cs) {
        if (via.has(c) || GENERIC.has(c)) continue;
        via.set(c, `${c} (uses ${via.get(n) === n ? n : via.get(n)})`);
        next.push(c);
      }
    }
    frontier = next;
  }

  // 3. Tests that mention any of them
  for (const t of testFiles) {
    const toks = tokensOf(stripComments(fs.readFileSync(path.join(TESTS_DIR, `${t}.test.js`), "utf8")));
    for (const [name, why] of via) {
      if (toks.has(name)) note(t, `uses ${why === name ? name : why}`);
    }
  }
  for (const t of ALWAYS) if (testFiles.includes(t)) note(t, "always runs");
  const tests = testFiles.filter((t) => reasons.has(t));
  return { all: false, files, changed: [...changed.keys()], tests, reasons, total: testFiles.length };
}

module.exports = { selectTests };

// node select-tests.js [ref]: print the choice
if (require.main === module) {
  const r = selectTests(process.argv[2] || "HEAD");
  console.log(`Changed files: ${r.files.join(", ") || "(none)"}`);
  if (r.all) console.log(`Running everything: ${r.why}`);
  else for (const t of r.tests) console.log(`  ${t}: ${r.reasons.get(t).join("; ")}`);
  if (!r.all) console.log(`\n${r.tests.length} of ${r.total} test files`);
}
