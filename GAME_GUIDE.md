# Fluffy Industries: how the code works

A map of the game's source code, written so that adding or changing things is
easier. It covers what each file does, how one frame of the game runs, how
fluffies "think", and step-by-step recipes for common changes.

Plain JavaScript, no framework, no build step. Open `index.html` in a browser
and it runs. About 36,000 lines across ~60 files.

---

## 1. The big picture

- Everything is drawn onto **one `<canvas>`** (the `index.html` page has
  nothing else on it).
- All the `.js` files are loaded by `<script>` tags in `index.html`, **in
  order**. They all share one global space: a variable or function made at
  the top level of any file can be used from any other file, *as long as the
  file that uses it runs after the file that made it*. (So `globals.js`,
  which loads first, can't use a `const` defined in a later file at load
  time. It *can* use it inside a function that runs later.)
- The game world is a set of **scenes** (rooms/areas). Every fluffy and every
  item has a `scene` property saying which one it's in. **All scenes are
  simulated all the time**, but only `currentScene` is drawn.
- The two master lists are:
  - `fluffies` = every fluffy (instances of the `Horse` class)
  - `objects` = every item in the world (bowls, beds, cages, grass, fences...)

  Also `gibs` (loose body parts), `puddles`, `poofs` (visual effects), `cars`.
- Coordinates: `x` grows to the right, `y` grows **downwards**. The top 15% of
  the screen is the back wall (`height * 0.15`); the floor is below it.
  Things lower on the screen are "closer" and are drawn in front.
- The game's width/height is the browser window size **when the page loads**
  (`globals.js`: `width = window.innerWidth`). Resizing the window just
  scales the canvas.
- Game-wide values that are saved (money, timers, rooms bought...) are
  listed once in `SAVED_GAME_STATE` in `Persistence.js`, which drives
  saving, loading and starting a new game.

---

## 2. What each file does

### Core / engine
| File | What it's for |
|---|---|
| `index.html` | Loads every script, in order. **New files must be added here.** |
| `globals.js` | Shared setup and settings: scene definitions (`SCENES`), mouse/keyboard state, the master lists, money, lots of tuning constants (happiness bonuses/penalties, thresholds), **the shop list `SPAWN_ACTIONS`**, accessories (`ACCESSORY_DB`), the tool/toolbox system, `WorldSettings` (the "Headcanon" options), helper functions (`clamp`, `lerp`, `isPointInRect`, `changeScene`, `handleDropping`, `setRelationship`). |
| `script.js` | The **main loop** (`animate` → `updateSimulation` → `render`), feral spawning (`spawnFeralGroup`, `updateFerals`), sell offers, day care ageing, cars, **what happens when you click while holding something** (`attemptDrop`: using the stick/knife/brush etc. on a fluffy), keyboard shortcuts, startup. |
| `UI.js` | Everything drawn on top of the world and most clicking: the shop buttons, tooltips, toolbox/toolbar, sell (shift-click), inspection window, day care window, chat log, debug menu, **scene portals/map** (`getScenePortals`), background drawing, backyard fence, and the big **`mousedown` handler** (near the end). |
| `menu.js` | Title screen, pause menu, save/load list, "Headcanon" new-game settings. **Starting a new game** happens in `handleWorldSettingsClick` (it resets everything in `SAVED_GAME_STATE`). |
| `ItemRegistry.js` | **One description per item and tool**: its click area, sell price, right-click action, shop icon, whether it fits in cages, how the shop creates it, how saves re-create it, and for tools their names, pictures and toolbar slot. See section 6. |
| `Persistence.js` | Saving and loading (`saveGame`, `loadGame`, `loadObject`). Saves live in the **browser's IndexedDB**, not in files. They belong to that browser and that address, so saves made from `file://` won't show when the game is served another way. `saveFormatVersion` + migrations handle old saves. |
| `state_config.js` | Fluffy animation poses (`ANIMATION_STATES`) and the behaviour state rules (`BEHAVIOR_RULES`: how long each state lasts and what comes next). |
| `dialogue.js` | Every line fluffies can say (`DIALOGUE`), plus `getDialogue()` and baby-talk/muffle filters. |
| `Cheats.js` | Cheat codes: press **Space** in-game to type one. `debug` toggles the debug menu, `money 50000` adds money, etc. |
| `image_loader.js` | List of every image (`imageSources`) → loaded into `images.<key>`. The game waits for **all** of them before starting. |
| `sound_loader.js` | Sounds (`soundSources`) and `playSound(name)`. |
| `vfx.js` | `Poof` puff effects. `Puddle.js`: poop/pee/blood puddles. `Gib.js`: loose body parts. `ErrorHandler.js`: shows errors. |

### The fluffy (`Horse`) and its helper parts
The `Horse` class is split across several files. Each fluffy owns one of each
helper, reachable as `horse.brain`, `horse.positioning`, and so on.

| File | Part | What it does |
|---|---|---|
| `Horse.js` | `Horse` | Main class: all the fluffy's stats, `update(dt)` (runs every frame, ~1,500 lines), state changes (`initBehavior`), relationships and missing-family logic (`updateRelationships`), mating, pregnancy, excretion, speaking (`speak`), saving (`serialize`/`deserialize`). |
| `HorseBrain.js` | `horse.brain` | **Decision making.** A list of `Desire`s (Eat, Sleep, Wander, fears...). See section 4. |
| `HorsePositioning.js` | `horse.positioning` | **Finding things and picking where to walk**: `scoutForHunger` (find food), `scoutForSleep`, `scoutForLitterbox`, `findSpecialFriend`, fear targets, `_pickNewTarget` (random wandering), body size (`getExtentsForCage`). |
| `HorseActionHandler.js` | `horse.actionHandler` | **Walking** toward the target each frame, and what happens on **arrival** (`checkArrivals`: kick the ball, eat, hug...). Also executes several desires. |
| `HorsePhysics.js` | `horse.physics` | Being carried by the mouse, lying on tables, drowning in the river. |
| `HorseAnatomy.js` | `horse.anatomy` | Amputation, death, gibs, eating corpses, pregnancy start, births. |
| `HorseGenetics.js` | `horse.genetics` | Genes → colours, mane/tail type, wings/horn; breeding (`combineGenes`); **price** (`calculatePrice`). |
| `HorseRenderer.js` | `horse.renderer` | Drawing the fluffy from body-part images, tinted to its colours; face expressions; speech bubbles; dreams; portraits. |

### Items (one class per file)
Each item class follows the same pattern (see section 6):
`Ball`, `Bed` (also cardboard boxes), `Block`, `Bowl` (bowls, troughs, feeders),
`Brush`, `Cage`, `Car`, `CattleProd`, `DayCareDesk`, `FluffTV`, `FluffyTable`
(base for tables), `OperatingTable`, `ImmobilizationBoard` (the "Rack"),
`LitterpalBox`, `Litterbox`, `FoalInACan`, `FoalVendor`, `FoodBag`,
`GoldenStatue`, `Grass`, `Grinder`, `IVBag`, `IVStand`, `Knife` (knife and
scalpel), `MagnifyingGlass`, `SorryStick`, `Sponge`, `SprayBottle`,
`Sprinkler`, `SutureKit`, `Syringe`, `Thumbtack`, `TrashBag`,
`AccessoryItem` (hats etc. lying in the world), and `Fence` (our pen fences).

### Other folders
- `assets/`: images; `assets/sounds/`: sounds; `assets/dream/`: dream-style art.
- `thin_client/`: a separate launcher that **downloads the official game from
  GitLab** and runs that. It does *not* use your local files.
- `zip_project.sh`: packages the game (runs the tests in `tests/` first).
- `tests/`: automated checks (see section 7).

---

## 3. One frame of the game

`animate()` in `script.js` runs every screen refresh:

```
animate(timestamp)
 ├─ pauses entirely if the browser window isn't focused
 ├─ splits the elapsed time into fixed 0.016s steps (max 2s catch-up)
 │   └─ for each step, if PLAYING: updateSimulation(dt)
 └─ render()

updateSimulation(dt)                      (script.js)
 ├─ puddles, day care, backyard fence breaking, grass regrowth
 ├─ spawn cardboard boxes in alleys, cars on the road
 ├─ objects[i].update(dt)   for every item (removes destroyed ones)
 ├─ updateFerals(dt)        spawn/despawn wild fluffies in outdoor scenes
 ├─ updateMoneyAndRequests  sell offers, UI message timers, effects
 ├─ prepareFenceCollisions()               (Fence.js)
 ├─ fluffies[i].update(dt)  for every fluffy (removes destroyed ones)
 │    └─ resolveFenceCollision(f)          (Fence.js) stops walking through fences
 └─ updateGibs(dt)

render()                                  (script.js)
 ├─ background, puddles, door
 ├─ every object + fluffy + gib + car in the current scene,
 │  sorted by getBottomY()  → lower on screen = drawn later = in front
 ├─ backyard fence, effects, UI (drawUI in UI.js)
 └─ speech bubbles, dreams, names on top of everything
```

`dt` is seconds since the last step, so rates are written as
"amount per second × dt". Examples:
- Hunger drops by `dt/450` per step for adults, faster for foals (full → empty in ~7.5 minutes).
- Foals grow from 0 to adult (`growth` 0 → 1) in **1680 seconds (28 minutes)**.
- Pregnancy lasts `pregnancyDuration = 300` seconds.
- `debugHungerMultiplier`, `debugGrowthMultiplier` etc. in `globals.js` speed these up for testing.

---

## 4. How a fluffy decides what to do

### The brain: desires
`HorseBrain.think()` runs **every frame** for every living fluffy:

1. Every `Desire` gives a score from 0 to 100 (`evaluate(horse)`).
2. They're sorted by score. Ties are broken by the order in `tiebreakerList`.
3. The top one's `execute(horse)` is tried. If it returns `false` (e.g.
   "Eat" but there's no food), the next is tried.
4. The desire already running gets a 20% bonus so fluffies don't flip-flop.

Desires are registered in the `Horse` constructor (`this.brain.addDesire(...)`)
and defined in `HorseBrain.js`: fears (grinder, alicorn, cars, sprinkler,
corpses, blood, smarties), Eat, UseLitterbox, CareForBabies, FeedHungryFoal,
Sleep, mating and special friends, play (ball, blocks, TV), friendship
proposals, babbling, SmartyCombat, ComplainAboutPuddle, Wander, Sit, LieDown.

Most `execute`s do roughly this:
```js
horse.initBehavior("MOVING");              // start walking...
horse.setTargetPosition(food.x, food.y);   // ...to here
return true;
```
Many desires rate-limit themselves with timers. Always use `gameTimeMs()`
(from globals.js) for these, never `performance.now()` or `Date.now()`:
`gameTimeMs()` follows the game clock, so it pauses with the game, would
speed up with a fast-forward button, and makes the tests repeatable.

### States (what the body is doing)
`horse.currentStateKey` is one of: `IDLE`, `MOVING`, `RUNNING`, `EATING`,
`SITTING`, `LYING`, `SLEEPING`, `VOMITING`, `FOCUSING` (TV), `BENDING` /
`BENDING_2` (mating), `HUGGING`, `ATTEMPTING_EXCRETION`, `FLUFFY_JAB` /
`FLUFFY_STOMPIE` / `FLUFFY_BITE` / `FLUFFY_KNOCKED_DOWN` (fighting),
`DROWNING`.

- `horse.initBehavior(state)` switches state. Calling it with `"MOVING"` also
  picks a random target first (`positioning.pickNewTarget`), which the desire
  usually overwrites right after, and turns into `"RUNNING"` if the target is
  far and the fluffy can run.
- Non-moving states count down `stateTimer`, then `BEHAVIOR_RULES[state].getNextState`
  decides what's next (usually `IDLE`).
- `MOVING`/`RUNNING`: `HorseActionHandler.checkArrivals` walks toward
  `targetX/targetY` at `horse.speed`, and when within 10px runs arrival logic
  (kick ball, pick up block, then back to `IDLE`).

### Key fluffy stats
| Property | Meaning |
|---|---|
| `x`, `y` | Middle of the body (hooves are ~40px lower) |
| `scene` | Which scene it's in |
| `growth` | 0 = newborn … 1 = adult. `tooYoungToWalk()`, `tooYoungToSpeak()` depend on it |
| `scale` | Drawing size (from growth + genes). Adults ≈ 0.44–0.54 |
| `hunger` | 1 = full, 0 = starving |
| `happiness` | 1 = very happy, ≤ 0 = "wan die" (gives up). Change with `changeHappiness(amount)` |
| `health` | 0–100 |
| `isAlive`, `isDestroyed` | Dead body vs. removed from the game |
| `gender`, `type` (`earthy`/`unicorn`/`pegasus`/`alicorn`), `genes` | Identity |
| `adopted` | Belongs to the player (born/bought inside) vs. feral |
| `personalities` | e.g. `["smarty"]`, `["mill_baby"]` |
| `currentCage`, `placedOn`, `claimedBed` | What it's in / on |
| `limbs` | Which body parts are still attached |
| `expressionOverride` + `expressionOverrideTimer` | Force a face, e.g. `"MISERABLE"`, `"CRYING_SHOCKED"`, `"HAPPY"` |
| `speech` | Current speech bubble. `speech.nextTime` is the cooldown before talking again |

### Relationships
- Stored globally: `relationships[idA][idB] = "friend"` (use `setRelationship`).
- Values: `friend`, `special_friend`, `forgotten_special_friend`, `mother`,
  `father`, `child`, `baby_child`, `estranged_child`, `rejected_baby`,
  `brother`, `sister`, `dead_mother`, `dead_baby_child`.
- `Horse.updateRelationships` tracks family and special friends (**not**
  plain friends). If one isn't in the **same scene** they count as `"lost"`:
  the fluffy becomes frantic, says `LOST` lines, loses happiness, and after
  180s forgets. When they're seen again, `handleReunion` plays `REUNION`
  lines. This is the natural place to hook "separated by a pen" sadness.
- Cages already block access: finders like `scoutForHunger` and
  `findSpecialFriend` skip things where `horse.currentCage !== thing.currentCage`.
  That's the pattern to copy for "can't reach it, it's in another pen".

### Talking
```js
horse.speak(getDialogue(["LOST", "BABY"], horse, targetFluffy));
```
`getDialogue` looks up `DIALOGUE.LOST.BABY` in `dialogue.js` (falling back to
`DEFAULT` entries) and picks a random line. In lines, `<SPEAKER>` / `<TARGET>`
become names (upper-case versions become shouted names). Fluffy-speak turns
l/r into w. Check `!horse.tooYoungToSpeak()` for words, or use chirps for foals.

---

## 5. Clicking and dragging

The main click handler is `canvas.addEventListener("mousedown", ...)` in
`UI.js`. It checks, **in this order**, and stops at the first thing that
handles the click:

1. Title / pause menus, inspection and day care windows, sell offer buttons
2. Toolbox / toolbar
3. **Shift+click = sell** (`sellModeClick`)
4. **Holding something? drop / use it** (`attemptDrop` in `script.js`:
   using a stick, knife or brush on a fluffy happens here)
5. **Shop buttons** (`actionButtonsClick`: buying happens here)
6. Debug menu
7. **Right-click** actions (cage tags, TV channel, sprinkler, fence turning...)
8. **Pick something up**: fluffies first, then objects (via `hitTest` or
   image-size checks), then gibs, then backyard fence repair

"Picking up" means setting `obj.isDragging = true` and `isGlobalDragging = true`;
the object's `update()` then follows the mouse. The next click calls
`obj.onDrop()`, usually `handleDropping(obj)` in `globals.js`, which also
handles dropping into cages and dropping onto door/arrow portals to move scenes.

**Two kinds of purchases:**
- **World items** (bowl, bed, cage, fence...) go into `objects`.
- **Tools** (sponge, brush, stick, knife, syringe...) go into your `toolbox`
  and are equipped with the number keys. Each tool is described in
  `ItemRegistry.js` (see "Add a new tool" in section 6).

Keyboard: Esc pause · WASD change scene · N names · B bed names · 0–9 tools ·
R turn held fence · **Space cheat code**.

---

## 6. Recipes

### Add a new world item to the shop
Items are described in **`ItemRegistry.js`**. Use `GoldenStatue.js` (simplest)
or `Fence.js` as a template:

1. **New file** `MyThing.js` with a class that has: `id = nextObjectId++`,
   `scene`, `x`, `y`, `isDragging`, `dragOffset`, and methods `update(dt)`,
   `onDrop()`, `getBottomY()`, `draw(ctx)`/`drawOffScreen(ctx)`,
   `serialize()` (must include `classType: "MyThing"`) and `deserialize(data)`.
   Give it a `hitTest(x, y)` too, or describe its click area in the registry.
2. **`index.html`**: add `<script src="MyThing.js"></script>` **before** `ItemRegistry.js`.
3. **Images**: put PNGs in `assets/` and add them to `imageSources` in `image_loader.js`.
4. **Shop**: add an entry to `SPAWN_ACTIONS` in `globals.js`
   (`name`, `desc`, `cost`, `isItem: "my_thing"`).
5. **Registry**: in `ItemRegistry.js` add one entry to `ITEM_TYPES`, e.g.
   ```js
   {
     sellType: "my_thing",                  // same as isItem in the shop
     is: (o) => o instanceof MyThing,
     hitTest: imageHit("my_thing"),         // or leave out to use o.hitTest
     sellable: true,                        // sells for half its shop price
     create: (a, sx, sy) => atSpot(new MyThing(currentScene), sx, sy),
   },
   ```
   and one line to `SAVED_CLASSES`: `MyThing: (d) => new MyThing(d.scene),`

That's all: buying, the sell tooltip, shift-click selling, picking up and
saving/loading all read from the registry. Optional extras, also in the
registry entry (all explained at the top of `ItemRegistry.js`):
- `onRightClick(obj)`: what right-clicking it does (e.g. `(tv) => tv.nextChannel()`)
- `icon: "image_key"` or `drawIcon(ctx, btnSize)`: its shop button picture
- `inCage: "never"`: stop it being dropped into cages
- `canPickUp`, `onSell`, `usedUp`, `afterCreate`, `shopItem`, `poofAtMouse`

### Add a new tool (goes in the toolbox)
Same as an item, but in its `ItemRegistry.js` entry also add a `tool`
section (copy the Brush one and change it):
```js
tool: {
  className: "MyTool",                        // as in serialize()
  create: (scene) => new MyTool(scene),
  key: "my_tool",                             // what kind of tool it is
  toolbarKey: "2",                            // default number key (optional)
  name: "Tool",                               // short name on the toolbar
  fullName: "My Tool",                        // tooltip title (optional)
  desc: "What it does, for the tooltip.",
  image: () => images.my_tool,
},
```
Optional: `multi: true` (can own several), `punishment: true` (counts as
discipline), `placeableInWorld: true` (can be put down, like thumbtacks).
What the tool *does* when you click a fluffy with it is in `attemptDrop`
in `script.js`.

### Add a new fluffy behaviour (desire)
1. In `HorseBrain.js`: `class MyDesire extends Desire { constructor(){ super("MyDesire"); } evaluate(horse){ return score; } execute(horse){ ...; return true; } }`
2. Register it in the `Horse` constructor: `this.brain.addDesire(new MyDesire());`
3. Add `"MyDesire"` to `tiebreakerList` at the priority you want.
4. Typical scores: fears 90–100, eating 25–100, social 40–80, wander 45, sit/lie low.

### Add dialogue
Add a key to the `DIALOGUE` object in `dialogue.js`, e.g.
`PENNED: { DEFAULT: ["..."], BABY: ["..."] }`, then
`horse.speak(getDialogue(["PENNED", "BABY"], horse, other))`.

### Add a cheat code
In `Cheats.js` `handleCheatCode`, add `else if (first === "mycode") { ... }`.

### Add something that must be saved
For a game-wide value (a new timer, counter, unlock...): declare it as
usual (e.g. `let myTimer = 30;` in `globals.js`), then add one line to
`SAVED_GAME_STATE` in `Persistence.js`:
```js
{ name: "myTimer", get: () => myTimer, set: (v) => (myTimer = v), fresh: () => 30 },
```
That's all: it's now saved, loaded (older saves without it get the `fresh`
value), and reset when a new game starts. A test checks every field in
the list survives saving and loading.

Things that belong to one game but shouldn't be saved (open windows, the
current sell offer...) go in `resetTemporaryGameState()` in the same file.

---

## 7. Automated tests

The `tests/` folder has automated checks that play the real game in a hidden
browser: every shop item (buy, sell for half price, pick up, save/load),
fences/gates/pens, and a basic "the game runs" check. See `tests/README.md`.
In a terminal in `tests/`: `npm run setup` once, then `npm test` after any
change. `zip_project.sh` runs them before packaging, too.

## 8. Gotchas worth knowing

- **Item registry.** Selling, the sell tooltip, picking up, buying,
  loading, right-click actions, shop icons and "can it go in a cage?" all go
  through `ItemRegistry.js`, and so does everything about tools (the
  `tool` section of their entries).
- **Sell prices**: every item sells for **half its shop price** (worked out
  from `SPAWN_ACTIONS`, so changing a shop price changes the sell price too).
  Partly used items are worth less (`usedUp` in `ItemRegistry.js`). Opened
  food bags sell for $0. An item can have its own `sellValue` to override this.
- **Load order matters** (see section 1). `typeof X !== "undefined"` checks are
  used throughout so files don't crash if something isn't loaded yet.
- **The game pauses when the window loses focus**, and many keys/clicks are
  ignored then.
- **Some things move fluffies directly** (`horse.x = ...`) instead of walking:
  sleeping snaps them into beds, mating lines them up, the day care moves
  them. Anything that must hold for *all* movement (like fences) has to check
  after the fact, which is why the fence check runs after every fluffy update.
- **The debug menu** (cheat `debug`) makes shop items free and has buttons to
  make fluffies hungry, breed, sleep and so on. It's handy for testing changes.
- **Big numbers of fluffies** make everything slower, since every fluffy
  thinks every frame.
- If you run the game headless (automated browser), sounds are skipped
  (`navigator.webdriver`).

---

## 9. Our additions so far

### Fences and gates (`Fence.js`)
- **Fence** ($40) and **Gate** ($100) are the same class, `Fence`, with
  `isGate` / `isOpen`. Pieces are 80px, snap to a 40px grid, and are either
  `"h"` (left-right) or `"v"` (up-down). Right-click turns a fence piece and
  opens/closes a placed gate. R turns whatever piece you're holding.
- **Collision**: after each fluffy updates, `resolveFenceCollision` undoes
  any move that went through a blocking piece (closed fences and gates).
  Carrying fluffies by hand ignores fences.
- **Pen map**: `getPenMap(scene)` cuts the floor into 10px squares, marks the
  ones covered by fences, and numbers each connected patch ("region"). It's
  rebuilt only when that scene's fences change. The biggest region is
  "outside". Helpers built on it:
  - `canFluffyReach(horse, x, y)`: can it walk there (maybe via a gate)?
  - `fenceCanReachThing(horse, thing)`: same, for an item or another fluffy
  - `isFluffyPenned(horse)`: is it in a smaller, enclosed area?
  - `nearestReachablePoint(horse, x, y)`: closest spot it can get to
  - `getFenceSteerPoint(horse)`: used while walking to go round fences
    (via a path through the map) and to give up on unreachable targets
- **Pen-aware AI**: every "is it in my cage?" check in `HorsePositioning.js`
  now also asks `fenceCanReachThing`, so fluffies ignore food, beds, toys,
  litterboxes, TV and mates on the other side of a fence. Eating, mating,
  hugging and attacking also need the two to be reachable (`Horse.js`).
  Wandering (`WanderDesire` in `HorseBrain.js` and `_pickNewTarget`) only
  picks reachable spots. Walking (`HorseActionHandler.checkArrivals`) steers
  round fences.
- **Pen feelings**: `updatePenFeelings` (called from `script.js`) checks
  about once a second whether a fence separates a fluffy from its baby,
  mother, special friend, father, sibling or friend. If so, every 10–20s it
  loses a little happiness (more if it's the one penned in; never below the
  "miserable" level), looks sad, says a `PENNED` line from `dialogue.js`,
  and walks to the fence nearest them. When they're together again it
  gets a happy `PENNED.REUNITED` moment. Tuning numbers:
  `HAPPINESS_PENALTY_PEN_SEPARATED`, `HAPPINESS_BONUS_PEN_REUNITED`.
- Touch points: `index.html`, `globals.js` (shop entries), `ItemRegistry.js`
  (buying, selling, picking up, right-click, icons, loading), `script.js` (collision + feelings hooks,
  R key), `Persistence.js` (loading), `HorsePositioning.js`,
  `HorseActionHandler.js`, `HorseBrain.js`, `Horse.js`, `dialogue.js`.
- Originals of every changed file are in `_backup_before_fence/`.
