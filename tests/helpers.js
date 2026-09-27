// Small helpers shared by the test files.

// Stop the test with a message if something isn't right
function check(condition, message) {
  if (!condition) throw new Error(message);
}

// Stop the test if two values aren't the same
function checkEqual(actual, expected, what) {
  if (actual !== expected) {
    throw new Error(`${what}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

// Build a closed pen (in the INDOORS room) inside the page. Returns nothing;
// call inside page.evaluate via: await page.evaluate(buildPen, options)
// Pen spans x 560..880 and ground y 360..680. The right wall's third piece
// can be a gate.
function buildPen({ withGate = false, gateOpen = false } = {}) {
  const mk = (o, x, y, gate) => {
    const f = new Fence("INDOORS", o, gate);
    f.x = x;
    f.y = y;
    objects.push(f);
    return f;
  };
  for (const x of [560, 640, 720, 800]) {
    mk("h", x, 360);
    mk("h", x, 680);
  }
  for (const y of [360, 440, 520, 600]) mk("v", 560, y);
  mk("v", 880, 360);
  mk("v", 880, 440);
  const g = mk("v", 880, 520, withGate);
  g.isOpen = withGate && gateOpen;
  mk("v", 880, 600);
}

module.exports = { check, checkEqual, buildPen };
