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
It takes about 2 minutes and ends with e.g. `13 passed, 0 failed`.
A failure says which test failed and why, e.g.
`Grinder: sold for $50, expected $1250`.

To run only some tests, add part of their name:
```
npm test -- fence
```

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
