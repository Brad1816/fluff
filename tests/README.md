# Automated tests

These open the real game in a hidden Chrome window, start a new game, and
check that things still work: buying, selling, picking up and saving every
item; fences, gates and pen-aware fluffies; and that the game runs without
errors. Run them after every change. If something breaks, they tell you what.

## First time only

1. Install **Node.js** (the "LTS" version) from https://nodejs.org
2. Open a terminal in this `tests` folder. In VS Code: right-click the
   `tests` folder → **Open in Integrated Terminal**.
3. Run:
   ```
   npm run setup
   ```
   This downloads Playwright and a copy of Chrome for testing (a few minutes).

## Every time

In a terminal in the `tests` folder:
```
npm test
```
It takes about 2-3 minutes and ends with e.g. `222 passed, 0 failed`.
A failure says which test failed and why, e.g.
`Grinder: sold for $50, expected $1250`.

To run only some tests, add part of their name:
```
npm test -- fence
```

To run only the tests that what you've changed could affect (usually well
under a minute):
```
npm run test:changed
```
It compares with the last commit (or `node run-tests.js --changed HEAD~2`
for an older one), works out which functions you changed and what calls
them, and runs the test files that use any of them, plus `smoke`, `screens`
and `savefields` every time. It prints why each test file was picked. Add
`--why` to see the list without running anything. Changing the test
machinery (`run-tests.js`, `helpers.js`, `select-tests.js`) or anything in
`index.html` other than adding a script runs everything. It's a good guess,
not a proof, so run the full `npm test` now and then too.

**Reusing the game between tests.** Loading the game is most of a test's
time, so each worker keeps its page and starts a new game in it, after
putting back anything the last test changed that a new game doesn't reset
(game functions a test swapped out, class methods, `Math.random`, the
game's top-level settings). If a test fails in a reused page it's run again
in a freshly loaded one; if it passes there it counts, but it's listed at
the end under "Only passed in a freshly loaded page" - something an earlier
test left behind, worth fixing. A test can always get a fresh page with
`fresh: true`, and `TEST_REUSE=0 npm test` turns reuse off. On a computer
with more cores, `TEST_WORKERS=6 npm test` (or 8) may be faster still.

## The files

| File | What it checks |
|---|---|
| `smoke.test.js` | The game starts, runs for a while without errors, saves and loads, family chat lines |
| `items.test.js` | Every shop item: can be bought at the store, sells for half price, can be picked up, survives save/load (uses `ItemRegistry.js`, so new items are tested automatically) |
| `fences.test.js` | Pens hold fluffies in and out, gates work, pen-aware fluffies, pen sadness, buying/turning/selling fence pieces |
| `store.test.js` | Fluff Mart: every item is on a shelf once, walking there, buying, carrying things home with WASD, tools to the toolbox, not enough money, purchases land on the floor, the old menu is debug-only |
| `familytree.test.js` | The family record book (dead/sold/gone fluffies are remembered, foster mums, saving), the tree screen (open, click around, Back, Close) and reading carrier genes |
| `genelab.test.js` | Gene Lab: predictions follow the inheritance rules (wings, carriers, born-alive odds), right-click to open, pick parents, pregnancy scan, related-pair warnings |
| `orders.test.js` | Customer orders: requirements per reputation level, rewards grow with level, accept/deliver (wrong fluffies refused), 3-order limit, deadlines and reputation loss, new orders over time, saving, bounty board and computer open the screen |
| `traits.test.js` | Personality traits: genes added to old fluffies, labels, foals inherit each gene from a parent, effects on fear/play/hunger/fighting back (and average fluffies unchanged), greedy fluffies really get hungrier, shown in the inspection panel, Gene Lab and orders |
| `memory.test.js` | Memory and trust: hurting scares the victim and witnesses (not cars; brave less than timid), fear fades (gentle faster), brushing and feeding build trust, scared fluffies really back away from the hand, loving ones really come to it, pick-up reactions, saving, panel rows, orders |
| `bonds.test.js` | Bonds and grudges: time together turns into friendship, attacks make grudges and witnesses side with their buddy (and sometimes defend), grudges block friendship, keep fluffies apart and fade, a fluffy really walks to its buddy, saving |
| `herds.test.js` | Herds: families form a named herd with a grown-up leader, foals and friends join, members who hate the leader leave, new leaders, tiny herds break up, herd bonus and rivalry, members catch up with the leader, saving |
| `park.test.js` | Fluffy Park: in from the river, dragging / wheel / keys / map move the view, out again; clicking the right fluffy after scrolling and dropping it in the right place; carrying one out takes you both; fluffies and fences use the whole park; other areas unchanged |
| `inspect.test.js` | The magnifying glass panel shows litter training, poopie colours, personality and age (set `INSPECT_SHOTS=folder` to save screenshots) |
| `run-tests.js` | Runs everything (starts a small web server and the hidden browser) |
| `helpers.js` | Shared bits: `check`, `checkEqual`, `buildPen` |

## Writing a new test

Add an entry to one of the `*.test.js` files (or a new file ending in
`.test.js`):
```js
{
  name: "what it checks, in plain words",
  run: async (page) => {
    const result = await page.evaluate(() => {
      // This runs inside the game, so you can use anything from the game:
      // fluffies, objects, money, new Horse(...), __fastForward(60) ...
      return money;
    });
    check(result > 0, "money should be positive");
  },
},
```
Handy helpers inside the game page: `__fastForward(seconds)`,
`__seedRandom(n)` (same random numbers every run), `__clearScene()`.
