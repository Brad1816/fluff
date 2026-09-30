// ---------------------------------------------------------------------------
// Test runner for Fluffy Industries.
//
// It starts a tiny web server for the game folder, opens the game in a
// hidden Chrome window (using Playwright), starts a new game, and runs every
// check in the *.test.js files in this folder. Each test gets a fresh game.
//
//   First time only:   npm run setup
//   Every time:        npm test
//   Only some tests:   npm test -- fence      (runs tests whose name has "fence")
//   Only what changed: npm run test:changed   (node run-tests.js --changed)
//                      tests that could be affected by what you've changed
//                      since the last commit (select-tests.js explains how);
//                      --changed HEAD~2 compares with an older commit, and
//                      --why lists the choice without running anything
//
// Tests run TEST_WORKERS at a time (default 4; set TEST_WORKERS=1 to run
// one by one). Each worker has its own browser context, so saves and
// settings (the browser's IndexedDB) don't clash between tests running side
// by side. Results print as tests finish.
// ---------------------------------------------------------------------------
const http = require("http");
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const GAME_DIR = path.resolve(__dirname, "..");
const TYPES = {
  ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
  ".png": "image/png", ".PNG": "image/png", ".wav": "audio/wav",
  ".ogg": "audio/ogg", ".json": "application/json",
};

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent(req.url.split("?")[0]);
    const file = path.join(GAME_DIR, urlPath === "/" ? "index.html" : urlPath);
    if (!file.startsWith(GAME_DIR)) {
      res.writeHead(403);
      return res.end();
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(404);
        return res.end();
      }
      // Cacheable for the length of a run, so each test's page loads the
      // images from the browser's cache instead of the server again
      res.writeHead(200, {
        "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
        "Cache-Control": "max-age=3600",
      });
      res.end(data);
    });
  });
  return new Promise((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve(server)),
  );
}

// Helpers every test can use inside page.evaluate(...), and the switches
// that keep tests predictable (run again after each in-page new game)
async function installHelpers(page) {
  await page.evaluate(() => {
    // Same "random" numbers every run, so tests don't randomly fail
    window.__seedRandom = (seed = 12345) => {
      let s = seed;
      Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
    };
    // Run the game forward quickly (seconds of game time)
    window.__fastForward = (seconds) => {
      for (let i = 0; i < seconds * 60; i++) updateSimulation(1 / 60);
    };
    // Empty a scene of items and all fluffies (not the whole world's grass)
    // No wild fluffies wandering into the park during other tests
    // (tests/park.test.js switches it back on)
    if (typeof parkLife !== "undefined") parkLife.enabled = false;
    // Clear weather for the whole test, so rain/snow don't change results
    // (tests/worldtime.test.js sets its own weather)
    if (typeof weatherState !== "undefined") weatherState.until = 1e9;
    // No naming pop-ups for the fluffies tests make (tests/names.test.js
    // and help.test.js turn them on)
    if (typeof namingPopupsEnabled !== "undefined") namingPopupsEnabled = false;
    window.__clearScene = (scene = "INDOORS") => {
      for (let i = objects.length - 1; i >= 0; i--) {
        if (objects[i].scene === scene) objects.splice(i, 1);
      }
      fluffies.length = 0;
      if (typeof shoppingBag !== "undefined") shoppingBag.length = 0;
      isGlobalDragging = false;
    };
  });
}

// Open the game and start a new game. Returns once we're playing.
async function openGame(context, port) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`http://127.0.0.1:${port}/index.html`);
  await page.waitForFunction(() => typeof gameState !== "undefined" && gameState === "TITLE");
  await page.waitForTimeout(500);
  await page.mouse.click(640, 510); // "New game"
  await page.waitForFunction(() => showWorldSettingsPrompt === true);
  await page.mouse.click(553, 594); // "Start Game"
  await page.waitForFunction(() => gameState === "PLAYING", null, { timeout: 15000 });
  await page.waitForTimeout(200);
  await installHelpers(page);
  return { page, errors };
}

// ---- Reusing a page between tests ----
// Loading the game is most of a test's time (about 4 of 5 seconds), so each
// worker keeps its page and starts a new game in it instead (TEST_REUSE=0
// turns this off). Before each test it puts back what the last test may
// have changed that a new game doesn't reset: Math.random, every game
// function (tests swap some out), every class's methods, and the plain
// values (numbers, text, true/false) of the game's top-level `let`s. A test
// that fails in a reused page is run again in a freshly loaded one; if it
// passes there it counts, and is listed at the end as leaking state. A test
// can ask for a fresh page with `fresh: true`. Pages are replaced every
// REUSE_LIMIT tests.
const REUSE = process.env.TEST_REUSE !== "0";
const REUSE_LIMIT = 25;

// The game's top-level `let`/`var` names and classes (from its source)
function gameGlobals() {
  const lets = new Set();
  const classes = new Set();
  for (const file of fs.readdirSync(GAME_DIR)) {
    if (!file.endsWith(".js")) continue;
    const src = fs.readFileSync(path.join(GAME_DIR, file), "utf8");
    for (const m of src.matchAll(/^(?:let|var)\s+([A-Za-z_$][\w$]*)/gm)) lets.add(m[1]);
    for (const m of src.matchAll(/^class\s+([A-Za-z_$][\w$]*)/gm)) classes.add(m[1]);
  }
  return { lets: [...lets], classes: [...classes] };
}
const GAME_GLOBALS = gameGlobals();

// Right after a fresh load: remember how things are
async function snapshotPage(page) {
  await page.evaluate(({ lets, classes }) => {
    const g = (0, eval); // global scope, where the game's lets live
    const snap = { random: Math.random, fns: new Map(), protos: new Map(), prims: new Map() };
    for (const k of Object.getOwnPropertyNames(window)) {
      let v;
      try {
        v = window[k];
      } catch (e) {
        continue;
      }
      if (typeof v === "function") snap.fns.set(k, v);
    }
    const protoOf = (C) => {
      if (typeof C !== "function" || !C.prototype || snap.protos.has(C)) return;
      const d = {};
      for (const k of Object.getOwnPropertyNames(C.prototype)) d[k] = Object.getOwnPropertyDescriptor(C.prototype, k);
      snap.protos.set(C, d);
    };
    for (const name of classes) {
      try {
        protoOf(g(name));
      } catch (e) {}
    }
    for (const v of snap.fns.values()) if (/^\s*class\b/.test(Function.prototype.toString.call(v))) protoOf(v);
    for (const name of lets) {
      try {
        const v = g(name);
        if (v === null || ["number", "string", "boolean", "undefined"].includes(typeof v)) snap.prims.set(name, v);
      } catch (e) {}
    }
    window.__testSnapshot = snap;
  }, GAME_GLOBALS);
}

// Before a reused test: put things back and start a new game in the page
async function resetPage(opened) {
  const { page, errors } = opened;
  await page.evaluate(() => {
    const snap = window.__testSnapshot;
    Math.random = snap.random;
    for (const [k, v] of snap.fns) if (window[k] !== v) window[k] = v;
    for (const [C, d] of snap.protos) {
      for (const k of Object.getOwnPropertyNames(C.prototype)) if (!(k in d)) delete C.prototype[k];
      for (const [k, desc] of Object.entries(d)) {
        const now = Object.getOwnPropertyDescriptor(C.prototype, k);
        if (!now || now.value !== desc.value || now.get !== desc.get || now.set !== desc.set)
          Object.defineProperty(C.prototype, k, desc);
      }
    }
    // Switches the helpers turn off, back on for the new game, as on a
    // fresh load (installHelpers turns them off again after)
    if (typeof parkLife !== "undefined") parkLife.enabled = true;
    if (typeof namingPopupsEnabled !== "undefined") namingPopupsEnabled = true;
    // Back to the title screen, nothing open
    if (typeof resetScreens === "function") resetScreens();
    showSaveList = false;
    showWorldSettingsPrompt = false;
    isGlobalDragging = false;
    transitionPhase = "OFF";
    gameState = "TITLE";
  });
  await page.mouse.click(640, 510); // "New game"
  await page.waitForFunction(() => showWorldSettingsPrompt === true, null, { timeout: 5000 });
  await page.mouse.click(553, 594); // "Start Game"
  await page.waitForFunction(() => gameState === "PLAYING", null, { timeout: 15000 });
  await page.evaluate(() => {
    // The rest of the fresh-game values (flags, speed, scene...)
    const g = (0, eval);
    window.__restoreValue = undefined;
    for (const [name, v] of window.__testSnapshot.prims) {
      if (["gameState", "transitionPhase", "transitionTimer", "preTransitionState"].includes(name)) continue;
      try {
        if (g(name) !== v) {
          window.__restoreValue = v;
          g(`${name} = window.__restoreValue`);
        }
      } catch (e) {}
    }
  });
  await installHelpers(page);
  errors.length = 0;
}

function loadTests(filter, files = null) {
  const tests = [];
  for (const file of fs.readdirSync(__dirname).sort()) {
    if (!file.endsWith(".test.js")) continue;
    if (files && !files.includes(file.replace(".test.js", ""))) continue;
    for (const t of require(path.join(__dirname, file))) {
      const fullName = `${file.replace(".test.js", "")}: ${t.name}`;
      if (!filter || fullName.toLowerCase().includes(filter.toLowerCase())) {
        tests.push({ ...t, fullName });
      }
    }
  }
  return tests;
}

(async () => {
  const args = process.argv.slice(2);
  let files = null;
  let filter = null;
  const ci = args.indexOf("--changed");
  if (ci >= 0) {
    const ref = args[ci + 1] && !args[ci + 1].startsWith("--") ? args[ci + 1] : "HEAD";
    const pick = require("./select-tests.js").selectTests(ref);
    if (pick.all) console.log(`Changed since ${ref}: ${pick.why} - running everything.`);
    else {
      files = pick.tests;
      console.log(`Changed since ${ref}: ${pick.files.join(", ") || "(nothing)"}`);
      for (const t of pick.tests) console.log(`  ${t}: ${pick.reasons.get(t)[0]}`);
      console.log(`${pick.tests.length} of ${pick.total} test files.\n`);
    }
    if (args.includes("--why")) process.exit(0);
  } else {
    filter = args.find((a) => !a.startsWith("--")) || null;
  }
  const tests = loadTests(filter, files);
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch();
  let passed = 0;
  const failures = [];
  const leaky = []; // passed only in a freshly loaded page
  const workers = Math.max(1, Math.min(tests.length, parseInt(process.env.TEST_WORKERS || "4", 10) || 1));
  const startedAll = Date.now();

  console.log(`Running ${tests.length} tests (${workers} at a time${REUSE ? ", reusing pages" : ""})...\n`);
  let next = 0;
  const worker = async () => {
    // Its own browser context: separate saves (IndexedDB) from other workers
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    let opened = null; // the page this worker is reusing
    let uses = 0;
    const fresh = async () => {
      if (opened) await opened.page.close().catch(() => {});
      opened = await openGame(context, port);
      uses = 0;
      if (REUSE) await snapshotPage(opened.page);
    };
    const attempt = async (t) => {
      await t.run(opened.page);
      if (opened.errors.length) throw new Error("Game errors: " + opened.errors.slice(0, 3).join(" | "));
    };
    while (next < tests.length) {
      const t = tests[next++];
      const started = Date.now();
      let reused = false;
      try {
        if (!REUSE || !opened || t.fresh || uses >= REUSE_LIMIT) await fresh();
        else {
          try {
            await resetPage(opened);
            reused = true;
          } catch (e) {
            await fresh();
          }
        }
        uses++;
        try {
          await attempt(t);
        } catch (e) {
          if (!reused) throw e;
          // Maybe something left over from an earlier test: try it fresh
          await fresh();
          uses++;
          await attempt(t);
          leaky.push(`${t.fullName} (in a reused page: ${e.message.split("\n")[0].slice(0, 120)})`);
        }
        passed++;
        console.log(`  PASS  ${t.fullName}  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
      } catch (e) {
        failures.push(t.fullName);
        console.log(`  FAIL  ${t.fullName}\n        ${e.message}`);
        // Don't reuse a page a failed test was in
        if (opened) await opened.page.close().catch(() => {});
        opened = null;
      }
    }
    if (opened) await opened.page.close().catch(() => {});
    await context.close();
  };
  await Promise.all(Array.from({ length: workers }, worker));

  await browser.close();
  server.close();
  if (leaky.length) console.log(`\nOnly passed in a freshly loaded page (something earlier left state behind):\n${leaky.map((f) => "  " + f).join("\n")}`);
  if (failures.length) console.log(`\nFailed:\n${failures.map((f) => "  " + f).join("\n")}`);
  console.log(`\nTook ${Math.round((Date.now() - startedAll) / 1000)}s`);
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
})();
