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
  // Helpers every test can use inside page.evaluate(...)
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
  return { page, errors };
}

function loadTests(filter) {
  const tests = [];
  for (const file of fs.readdirSync(__dirname).sort()) {
    if (!file.endsWith(".test.js")) continue;
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
  const filter = process.argv[2];
  const tests = loadTests(filter);
  const server = await startServer();
  const port = server.address().port;
  const browser = await chromium.launch();
  let passed = 0;
  const failures = [];
  const workers = Math.max(1, Math.min(tests.length, parseInt(process.env.TEST_WORKERS || "4", 10) || 1));
  const startedAll = Date.now();

  console.log(`Running ${tests.length} tests (${workers} at a time)...\n`);
  let next = 0;
  const worker = async () => {
    // Its own browser context: separate saves (IndexedDB) from other workers
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    while (next < tests.length) {
      const t = tests[next++];
      const started = Date.now();
      let page = null;
      try {
        const opened = await openGame(context, port);
        page = opened.page;
        await t.run(page);
        if (opened.errors.length) throw new Error("Game errors: " + opened.errors.slice(0, 3).join(" | "));
        passed++;
        console.log(`  PASS  ${t.fullName}  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
      } catch (e) {
        failures.push(t.fullName);
        console.log(`  FAIL  ${t.fullName}\n        ${e.message}`);
      }
      if (page) await page.close();
    }
    await context.close();
  };
  await Promise.all(Array.from({ length: workers }, worker));

  await browser.close();
  server.close();
  if (failures.length) console.log(`\nFailed:\n${failures.map((f) => "  " + f).join("\n")}`);
  console.log(`\nTook ${Math.round((Date.now() - startedAll) / 1000)}s`);
  console.log(`\n${passed} passed, ${failures.length} failed`);
  process.exit(failures.length ? 1 : 0);
})();
