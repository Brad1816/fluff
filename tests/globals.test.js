// The game's scripts share one global scope: two files declaring the same
// top-level name means the later one silently replaces the earlier one.
const fs = require("fs");
const path = require("path");
const { check } = require("./helpers");

module.exports = [
  {
    name: "globals: no two game scripts declare the same top-level function, class, let or const",
    run: async () => {
      const root = path.join(__dirname, "..");
      const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
      const files = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]).filter((f) => !/^https?:/.test(f));
      const seen = new Map();
      const dupes = [];
      for (const f of files) {
        const p = path.join(root, f);
        if (!fs.existsSync(p)) continue;
        const src = fs.readFileSync(p, "utf8");
        for (const m of src.matchAll(/^(?:async\s+)?(?:function\*?|class|let|const|var)\s+([A-Za-z_$][\w$]*)/gm)) {
          const name = m[1];
          if (seen.has(name) && seen.get(name) !== f) dupes.push(`${name} (${seen.get(name)} and ${f})`);
          else seen.set(name, f);
        }
      }
      check(dupes.length === 0, `declared twice: ${dupes.join(", ")}`);
    },
  },
];
