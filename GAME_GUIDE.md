# Fluffy Industries: how the code works

A map of the game's source code, written so that adding or changing things is
easier. It covers what each file does, how one frame of the game runs, how
fluffies "think", and step-by-step recipes for common changes.

Plain JavaScript, no framework, no build step. Open `index.html` in a browser
and it runs. About 55,000 lines across ~120 files.

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
| `UI.js` | The main screen drawing (`drawUI`), which windows are open (`isAnyScreenOpen`, `openInspectionModal`), the top-left buttons and the big **`mousedown` handler** (near the end). The rest of the on-screen parts are split into the `UI*.js` files below. |
| `UIMessages.js` | Messages on screen (`addUIMessage`), debug messages, door knocks, TV captions. |
| `UIToolbox.js` | Toolbox and toolbar, shop item pictures, **buying anything from `SPAWN_ACTIONS`** (`buyShopAction`), the debug item menu (`isItemMenuAvailable`). |
| `UISelling.js` | Selling: the buyer at the door (sell request card) and shift + click selling (`sellModeClick`). |
| `UIDebug.js` | Debug mode: debug actions on fluffies, the watcher panel and the debug menu. |
| `UIInspection.js` | The magnifying glass panel (`getFluffyInspectionInfo`, `drawInspectionModal`) and renaming. |
| `UIDayCare.js` | The day care window. |
| `UIChatLog.js` | The chat log panel. |
| `UIScenes.js` | **Scene portals/map** (`getScenePortals`: arrows and doors between areas) and drawing each area's background, road, fences and doors. |
| `menu.js` | Title screen, pause menu, save/load list, "Headcanon" new-game settings. **Starting a new game** happens in `handleWorldSettingsClick` (it resets everything in `SAVED_GAME_STATE`). |
| `Store.js` | **Fluff Mart**: the Shopping Street scene (down from the garden), the store's aisle scenes, which items go in which aisle (`STORE_AISLES`), drawing the shelves and price tags, and buying by clicking a shelf. See section 9. |
| `FamilyTree.js` | **Family record book** (`fluffyRecords`: every fluffy you've owned, even after it dies or is sold, with its genes and parents) and the **family tree screen** with its genetics panel. See section 9. |
| `GeneLab.js` | The **Gene Lab** machine (a shop item) and its screen that predicts what two fluffies' foals could be like. See section 9. |
| `Orders.js` | **Customer orders**: making orders (`ORDER_REQUIREMENTS`), accepting, delivering, deadlines and reputation (`customerOrders`, saved). |
| `OrderBoard.js` | Where orders are seen: the **bounty board** on Shopping Street, the **Computer** item (FluffList website), the orders screen (tabs: Orders / Breeding stock) with its deliver picker, and the "orders due" reminder. |
| `Traits.js` | **Personality traits** (brave/timid, social/loner, greedy/picky eater, playful/lazy, grumpy/gentle): which genes, the labels, and how they change behaviour. See section 9. |
| `Memory.js` | **Memory and trust**: how each fluffy feels about you (`playerTrust`, `playerFear`, `playerMemories`), what changes them, and the "back away from / come to your hand" desires. See section 9. |
| `Bonds.js` | **Bonds and grudges between fluffies**: each fluffy's opinion of the others (`opinions`, `opinionWhy`), `getLiking`, becoming friends by spending time together, defending buddies, avoiding grudges. See section 9. |
| `Herds.js` | **Herds**: forming, joining, leaving, leaders, rival herds, following the leader, herd markers (H key). See section 9. |
| `Territory.js` | **Herd territory in the park**: herds claim meadows, chase intruders off, and take meadows from smaller herds. See section 9 (Territory). |
| `SpatialGrid.js` | Quick "who's near here?" lookups (`fluffiesNear`, `forEachNearbyPair`), used by bonds, herds and territory. |
| `WorldTime.js` | **Day and night, seasons, weather**: the clock, darkness, rain/snow/storms and what they do to fluffies and plants. See section 9 (Day, night and weather). |
| `Separation.js` | **Taken from herd/family**: fluffies carried away from their herd, family or friends grieve, may be traumatised, and are overjoyed when brought back. See section 9 (Separation). |
| `Names.js` | **Names**: fluffies are "Fluffy" until a human names them. Screens tell unnamed ones apart by looks ("Fluffy (pink unicorn mare)"), and a pop-up offers to name fluffies that become yours (one pop-up per litter). See section 9 (Names). |
| `Wellbeing.js` | **Temperament**: happiness, trust, fear and trauma change a fluffy's price and how customers react. See section 9 (Temperament). |
| `DayReport.js` | **Morning report**: every 6:00 AM a card sums up the day before. See section 9 (Morning report). |
| `Goals.js` | **Breeder goals**: optional milestones with cash rewards (Goals button next to the speed buttons, or G). See section 9 (Goals). |
| `NightEvents.js` | **Night in the park**: most nights a herd has something happen to it (a fox, a tummy bug, a bumper crop, newcomers...). See section 9 (Night events). |
| `AlicornAcceptance.js` | **Getting used to alicorns**: scared fluffies slowly accept alicorns they spend time near. See section 9 (Alicorn acceptance). |
| `StockMarket.js` | **Breeding stock market**: buy pedigree fluffies from other breeders (the "Breeding stock" tab of the orders screen). See section 9 (Breeding stock market). |
| `Aging.js` | **Growing old**: life stages in game days, greying manes, slower/cheaper elderly fluffies, dying of old age. See section 9 (Growing old). |
| `Abandoned.js` | **Abandoned pets**: fluffies dumped by an owner at any age, named, sad until they get over it. See section 9 (Abandoned pets). |
| `BreedingRecords.js` | **Breeding records** screen (Records button or L): every litter you've bred and what each parent earned. See section 9 (Breeding records). |
| `Illness.js` | **Fluffy flu**: a catching illness that spreads to fluffies nearby (not through cages or fences). See section 9 (Fluffy flu and the vet). |
| `ShoppingBag.js` | **Getting shopping home**: small things go in the shopping bag (tan buttons in the toolbox), big things are delivered to the living room. See section 9 (Shopping bag and deliveries). |
| `ManePatterns.js` | **Fancy manes**: streaked, tipped and rainbow manes (tail to match), their genes, inheritance, drawing (`paintManePattern`) and value. See section 9 (Fancy manes). |
| `Warmth.js` | **Cold and heating**: how cold each place is (season, night, snow, rain), fluffy warmth (`f.warmth`), huddling / beds / scarves, freezing damage, the Heater item and its bill. See section 9 (Cold and heating). |
| `Buyers.js` | **Buyers at the door**: buyer types with tastes and budgets, which fluffy they ask about, offers that count condition, asking for more (agree / final offer / walk off). See section 9 (Buyers at the door). |
| `Commissions.js` | **Commissions and regular customers**: breed-to-order commissions (gold cards, deposit, days to deliver, "Bred by you"), customer loyalty (Returning / Regular / Loyal pay more), favourite types, letters from past customers. See section 9 (Commissions and regular customers). |
| `Pregnancy.js` | **Pregnancy and foal care**: litter size runs in families, care during pregnancy sets litter size, stillbirths and foal strength, birth health cost, the vet's scan and midwife, foal growth speed. See section 9 (Pregnancy and foal care). |
| `Shows.js` | **Fluffy shows**: a themed show every 3 days (the "Shows" tab of the orders screen, or the Show Hall on Shopping Street), grooming with the brush, prizes, ribbons, champions, watching it in the ring. See section 9 (Fluffy shows). |
| `Vet.js` | **FluffVet Clinic** on Shopping Street: check-ups, treatment, flu and toxoplasmosis jabs, midwife. See section 9 (Fluffy flu and the vet). |
| `Affection.js` | **Affection**: hearts (trust as affection), kind acts and their daily limits, neglect, heart pop-ups. See section 9 (Affection). |
| `Tricks.js` | **Tricks and training**: right-click trick menu (screen layer 6), rewards, learning speed, Fetch, showing off. See section 9 (Tricks and training). |
| `Diet.js` | **Food and diet**: kibble brands, tastes and favourite food, diet score, weight. See section 9 (Food and diet). |
| `Play.js` | **Play and boredom**: boredom, favourite toy, playing ball with you, mischief. See section 9 (Play and boredom). |
| `Bath.js` | **Dirt and bath time**: fluffies get grubby (mess, accidents, rain, time), look it, sponge baths with likes/dislikes. See section 9 (Dirt and bath time). |
| `Lessons.js` | **Lessons**: talking a fluffy out of colour prejudice, alicorn fear, messy habits or being a Smarty; a second row in the right-click trick menu. See section 9 (Lessons). |
| `Upbringing.js` | **Upbringing**: foals drift towards the colour views and alicorn feelings of the grown-ups raising them (mum most). See section 9 (Upbringing). |
| `Fears.js` | **Fears**: thunder, the dark and the Fluff-Bot; frights, comforting, the Night Light item. See section 9 (Fears). |
| `Roomba.js` | **The Fluff-Bot** robot vacuum (Fluff Mart, $250, delivered): cleans mess in its room, docks, startles fluffies. See section 9 (The Fluff-Bot). |
| `FluffySounds.js` | **Fluffy voices**: happy/angry/sad/scree/death/mating/pooping/newborn clips, foal versions, cooldowns. See section 9 (Fluffy sounds). |
| `Screens.js` | **The list of pop-up screens** (`registerScreen`): drawing, clicks, Esc and closing all come from it. |
| `Systems.js` | **The list of systems** updated every step (`registerSystem`, `updateSystems`) and `Ticker` for "every N seconds". |
| `UIPanels.js` | Shared drawing for pop-up screens: panel, title, rounded boxes, buttons, `fitText`. |
| `Help.js` | **How it works**: in-game help pages ("?" button after Goals, or F1). Edit `HELP_TOPICS` to change the text. |
| `Corpses.js` | **Rotting**: corpses darken, get flies, fade and disappear with game time. See section 9 (Corpses). |
| `GameSpeed.js` | **Fast forward**: the game clock and 1x/2x/4x/8x buttons next to "Chat Log" (F cycles). See section 9 (Fast forward). |
| `ParkLife.js` | **Life in the park**: meadows, berry bushes and wild fluffies wandering in. See section 9 (Life in the park). |
| `Park.js` | **Fluffy Park**: the big area bigger than the screen (Day Care Alley → right arrow), its camera, scrolling controls, map, scenery, and the screen-vs-world mouse switching. See section 9. |
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
| `Horse.js` | `Horse` | Main class: all the fluffy's stats, the constructor, `update(dt)` (the order of the per-frame steps), state changes (`initBehavior`), `notifyViolence`, and `addHorseMethods` (at the very end). The rest of its methods live in the files below; they are still ordinary `horse.method()` calls. |
| `HorseUpdate.js` | (methods) | The **steps of `update(dt)`**, one named method each: `_updateSmoke`, `_updateMovementAndMums`, `_updateFlailing`, `_updatePregnancy`, `_updateToiletNeeds`, `_updateEarFlop`, `_updateCannibalism`, `_updateGrowingUp`, `_updateEating`, `_updateCastrationBand`, `_updateAilments`, `_updateHungerAndHealth`, `_updateDoorTapping`, `_updateAdoptionRoom`, `_updateSmartyChase`, `_updateStacking`, `_updateTears`, `_updateDreams`, `_updateWings`, `_updatePupils`, `_updateBlinking`, `_updateStateEffects`, `_updateColoristMum`, `_updateMovementSound`. `_updateAilments` and `_updateHungerAndHealth` return `true` when the fluffy died, and `update` stops there. |
| `HorseFamily.js` | (methods) | Family life: feeding from and adopting mums, missing relatives and reunions (`updateRelationships`), milk preferences. |
| `HorseTalk.js` | (methods) | What fluffies say: babbling, family chatter, first words, speaking (`speak`: speech bubbles and the chat log). |
| `HorseMating.js` | (methods) | Mating, pregnancy and giving birth. |
| `HorseToilet.js` | (methods) | Pooping, peeing, bleeding, being sick, litterboxes, eating waste off the floor. |
| `HorseSocial.js` | (methods) | Fluffies with each other: attacks, friendships and hugs. |
| `HorseHitTest.js` | (methods) | Clicking on fluffies: hit tests and body-position maths (`hitTestAsSeen` uses where it was last *drawn*, so running fluffies can still be clicked). |
| `HorseSave.js` | (methods) | Saving a fluffy (`serialize`). Loading is `Horse.deserialize` in `Horse.js`. |
| `HorseBrain.js` | `horse.brain` | **Decision making.** A list of `Desire`s (Eat, Sleep, Wander, fears...). See section 4. |
| `HorsePositioning.js` | `horse.positioning` | **Finding things and picking where to walk**: `scoutForHunger` (find food), `scoutForSleep`, `scoutForLitterbox`, `findSpecialFriend`, fear targets, `_pickNewTarget` (random wandering), body size (`getExtentsForCage`). |
| `HorseActionHandler.js` | `horse.actionHandler` | **Walking** toward the target each frame, and what happens on **arrival** (`checkArrivals`: kick the ball, eat, hug...). Also executes several desires. |
| `HorsePhysics.js` | `horse.physics` | Being carried by the mouse, lying on tables, drowning in the river. |
| `HorseAnatomy.js` | `horse.anatomy` | Amputation, death, gibs, eating corpses, pregnancy start, births. |
| `HorseGenetics.js` | `horse.genetics` | Genes → colours, mane/tail type, wings/horn; breeding (`combineGenes`); **price** (`calculatePrice`). |
| `HorseRenderer.js` | `horse.renderer` | Drawing the fluffy from body-part images, tinted to its colours; face expressions; speech bubbles; dreams; portraits. |

#### Adding things: the lists to use
Several things are now one line to add, in the file of the feature itself:
- **A pop-up screen**: `registerScreen({ name, layer, isOpen, close, draw,
  click })` at the end of its file (`Screens.js`). Drawing, "is a screen
  open?", clicks (top screen first), Esc and closing on new game/load all
  come from the list. Layers: 5 magnifying glass, 6 trick menu, 10 family tree, 11 Gene
  Lab, 12 orders, 13 day care, 20 goals, 21 help, 22 records, 23 vet, 29
  show results, 30 morning report, 31 naming pop-up.
- **Something that updates every step**: `registerSystem(name, update,
  order)` at the end of its file (`Systems.js`); script.js
  `updateSimulation` calls `updateSystems(dt)`. For "every N seconds" use a
  `Ticker`: `const myTicker = new Ticker(5);` then in the update
  `const step = myTicker.step(dt); if (!step) return;` (`step` is the
  seconds since last time). Orders so far: 10 family records, 20 bonds,
  30 herds, 40 territory, 50 weather/clock (`worldTime`), 60 separation,
  70 naming, 80 settling in, 90 goals, 100 morning report, 110 night
  events, 120 alicorn acceptance, 125 pregnancy care, 130 ageing, 135
  affection, 136 tricks, 137 diet, 138 play, 139 bath, 140 abandoned pets, 145
  warmth, 150 flu, 160 corpses, 170 customer orders, 180 stock market,
  190 shows. The "systems" test (tests/screens.test.js) checks every one of
  these is registered, in order.
- **Something saved with each fluffy**: add `{ name, fallback, clone }` to
  `SAVED_HORSE_FIELDS` in HorseSave.js; saving and loading both read it.
  (The game's original fields are still listed by hand in `serialize` and
  `Horse.deserialize`.)
- **Something saved with the game**: add an entry to `SAVED_GAME_STATE` in
  Persistence.js (as before).
- **Drawing a screen**: UIPanels.js has `drawScreenPanel(c, L, { theme })`
  (dimmed background and panel; themes "pink" and "green"),
  `drawPanelTitle`, `fillRoundRect`, `drawPanelButton(b, label, { enabled,
  on })` and `fitText(c, text, maxW)`.

#### Speed notes
- Fluffies in areas you aren't looking at skip looks-only work each step
  (blinking, eyes, wings, dreams, tears, body layout) and update their face
  twice a second (Horse.update; `updateExpression`, called from
  HorseUpdate `_updateStateEffects`).
  Anything that needs an unseen fluffy's size calls `getExtentsForCage`,
  which works out its layout then.
- Who's being chased by a smarty is worked out once per step
  (HorseRenderer `_chasedFluffies`), not once per fluffy.
- render() reuses one offscreen buffer, room floors are drawn once per area
  and window size (UIScenes `_backgroundFor`), and drawUI runs once per
  frame, on the screen.
- Measured with ~67 fluffies (20 at home, a full park): a game step went
  from about 5ms to 3.9ms at home (7.1 to 5.4 in the park); drawing from 19
  to 15ms at home, 12 to 6.4 in the park.

#### How the Horse method files work
Each of the `Horse*.js` method files calls `addHorseMethods({ ... })` with
plain methods, which adds them to every fluffy (`Horse.prototype`). They are
loaded in `index.html` right after `Horse.js`. To add a method, put it in
the file that fits (or a new one, added to `index.html` after `Horse.js`).
`addHorseMethods` stops with an error if two files define the same method
name, so a clash shows up straight away instead of one silently replacing
the other.

**Beware of name clashes between files in general.** Every file shares one
global scope, so two files each with a top-level `function _say()` means
the later one wins everywhere (this happened once: Separation.js broke herd
dialogue). Give file-private helpers a prefix (`_sepSay`). To check:
`grep -ho "^function [A-Za-z_0-9]*" *.js | sort | uniq -d` should print
nothing.

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
 ├─ backyard fence, effects, UI (drawUI in UI.js; parts in UI*.js)
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
   (`name`, `desc`, `cost`, `isItem: "my_thing"`), and put `"my_thing"` in
   one of the aisles' `items` lists in `STORE_AISLES` (`Store.js`). If you
   forget, it shows up in an extra "Odds & Ends" aisle at the end.
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
- `icon: "image_key"` or `drawIcon(ctx, btnSize)`: its picture on the store shelf
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

### Show something new in the magnifying glass panel
In `UIInspection.js`, `getFluffyInspectionInfo(f)` builds two lists, `about` and `care`; the
panel then sorts rows into its tabs by label (`INSPECTION_TABS`). Push another row:
```js
care.push({ label: "Fleas", value: f.hasFleas ? "Yes" : "No", tone: f.hasFleas ? "bad" : "good" });
```
`tone` colours the value: `"good"` green, `"ok"` yellow, `"bad"` red,
anything else white. The drawing and wrapping are automatic. To put it on a
particular tab, add its label to a column's `rows` in `INSPECTION_TABS`
(otherwise it shows on Overview).

Things that belong to one game but shouldn't be saved (open windows, the
current sell offer...) go in `resetTemporaryGameState()` in the same file.

---

## 7. Automated tests

The `tests/` folder has automated checks that play the real game in a hidden
browser: every shop item (buy, sell for half price, pick up, save/load),
fences/gates/pens, and a basic "the game runs" check. See `tests/README.md`.
In a terminal in `tests/`: `npm run setup` once, then `npm test` after any
change. `zip_project.sh` runs them before packaging, too.

`tests/run-tests.js` switches a few things off so tests are predictable:
wild fluffies arriving in the park (`parkLife.enabled`), weather (clear
skies) and naming pop-ups (`namingPopupsEnabled`). A test that needs one of
them turns it back on itself (e.g. `names.test.js` sets
`namingPopupsEnabled = true`). `__seedRandom(n)` makes random choices
repeatable, `__fastForward(seconds)` runs the game quickly, and
`__clearScene()` empties an area.

**Running 4 at a time.** Tests run `TEST_WORKERS` at once (default 4; set
`TEST_WORKERS=1` in the terminal to run them one by one, e.g. to read the
output in order). Each worker has its own browser context, so saves don't
clash. Game files are cached during a run. At the end it lists any failed
tests and how long it took. A test must not depend on another test having
run first.

**Forcing a system to run now**: systems use a `Ticker` (Systems.js), so a
test does `illnessTicker.fireNext(); updateIllness(0);` for exactly one
tick.

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
  hugging and attacking also need the two to be reachable (eating: `_updateEating` in `HorseUpdate.js`).
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

### Magnifying glass panel (`UIInspection.js`)
Dropping the magnifying glass on a fluffy opens a tabbed report.
- **Header** (every tab): portrait, name, type and age, sale price, and red
  chips for anything that needs attention now (hunger, health, cold,
  conditions...). Nature-type rows (litter training, colour views, grudges)
  stay red inside their tab but don't make a chip. "✓ Doing fine" if none.
- **Tabs** (`INSPECTION_TABS`): Overview (Wellbeing / Care), Family &
  friends, Looks & nature, Mind (You and it / Worries). A red dot on a tab
  means something in it is bad. The chosen tab (`inspectionTab`) stays
  selected when you inspect the next fluffy.
- `getInspectionTabs(f)` sorts the rows from `getFluffyInspectionInfo` into
  tabs by label; a new row whose label isn't in `INSPECTION_TABS` lands on
  Overview until you add it to a tab.

The rows themselves:
**About**: name, gender, type, age (foal % grown or adult), sexuality,
personality (Smarty in red), parents, special friend, number of friends.
**Health & care** (values colour-coded): happiness, hunger, health, sleep,
**litter training** (`pottyTraining` 0-1, which is also the chance it
looks for a litterbox), **coat** (colour name plus "poopie colours" /
"a bit drab" / "nice colours", from `calculateColorismPerception()`, which
measures distance from `POOPIE_ANCHORS`), **colour views** (`coloristDegree`,
how mean it is to poopie fluffies; hidden when colorism is off in world
settings), spayed/pregnant, missing parts, conditions (poisoned,
toxoplasmosis, diarrhea, blindfolded, castration band, vaccinated...), and
what it would sell for. Dead fluffies show cause of death instead of needs.

### Fluff Mart, the store (`Store.js`)
Things are bought at a store instead of from a menu.
- **Getting there**: garden (outside the front door) → down arrow →
  **Shopping Street** (`SHOP_STREET`) → store door → the aisles. The
  "Back to Garden" arrow is at the bottom middle of the street (S key).
- **Aisles**: each is its own scene, `STORE_FOOD`, `STORE_HOME`,
  `STORE_CARE`, `STORE_PHARMACY` (Pharmacy & Lab), `STORE_HARDWARE`, `STORE_FASHION`
  (+ `STORE_MISC` "Odds & Ends" if anything isn't listed), with left/right
  arrows between them and a down arrow back out to the street. Which items
  are in which aisle is the `STORE_AISLES` list at the top of `Store.js`,
  by the shop entry's `isItem`.
- **Shelves**: `getStoreShelfLayout(aisle)` works out where each item sits
  (3 shelves, as many columns as needed). `drawStoreAisle` draws the floor,
  sign, shelves, pictures and price tags (green = affordable, red = too
  expensive, "Owned" for tools you have). `drawStoreOverlay` draws the
  hover highlight and description.
- **Buying**: `storeShelfClick` (called from the `mousedown` handler) calls
  `buyFromStore` (ShoppingBag.js): tools go straight into the toolbox
  (`buyShopAction` in `UIToolbox.js`, the same code the debug item menu
  uses), small things into the shopping bag, big things are delivered to
  the living room. See "Shopping bag and deliveries" in section 9.
- **Carrying things**: anything can still be picked up and walked with WASD
  (S out of the store, S back to the garden, W in the front door). Clicking
  an arrow while holding something *throws it through* to the next area
  instead of walking with it (that's the game's normal behaviour).
- **The old item menu** in the top left only appears with the debug menu
  on (`isItemMenuAvailable()` in `UIToolbox.js`), where spawning is free.
- The store scenes aren't "player quarters", so you can't sell things there.

### Family tree and genetics (`FamilyTree.js`)
Open it with the **Family tree** button in the magnifying glass panel.
- **The record book** (`fluffyRecords`, saved in `SAVED_GAME_STATE`): the
  game itself forgets a fluffy once it leaves the `fluffies` list, so
  `syncFamilyRecords()` (about once a second, from `updateSimulation`)
  writes down every fluffy you own (`adopted`) plus their parents: name,
  gender, type, a copy of its genes, birth mother and father, foster mother
  (if another mare adopted it: the game overwrites `motherId` then), when
  it was born and its status: alive, dead (with cause), sold, at day care,
  taken (by dogs) or gone. `noteFluffyLeft(f, "sold")` is called where
  fluffies are sold (`UISelling.js`, `UI.js`) and taken by dogs (`script.js`).
- **The tree**: grandparents, parents, the fluffy (gold border), brothers
  and sisters beside it (half-siblings labelled), and foals below. Blue
  border = male, pink = female; dimmed = no longer alive. Click a card to
  move the tree onto that fluffy; Back goes back. "Unknown" = parent never
  known; "Not recorded" = known id but it was never in the book.
- **Portraits** of fluffies that are gone are drawn from their saved genes
  with a stand-in `Horse` that's thrown away (it puts `nextFluffyId` back
  and removes its relationships entry, so the game isn't affected).
- **Genetics panel** (right side, shows whoever the mouse is over):
  coat/mane/eye colours, coat quality, size, and the inheritable traits as
  dots: **wings** and **horn** show with 4 of 5 genes, **spots** and
  **stripes** with 4 of 4, **gradient** with 2 of 4. One short = "carrier"
  (two carriers can have a foal that shows it; each foal takes every gene
  from one parent or the other at random, see `combineGenes`). With the
  sensitive-baby world setting on it also shows that risk (matching pairs
  in genes 65-70). `describeGenes(genes)` does the decoding.

### Gene Lab (`GeneLab.js`)
A $3000 machine in the store's Pharmacy & Lab aisle. Place it anywhere and
**right-click** it (its `onRightClick` in `ItemRegistry.js` calls
`openGeneLab()`).
- **Screen**: pick a mother and a father from your living fluffies (the
  dot is coat quality). If the mother is pregnant, the father list starts
  with "This pregnancy" and it's picked automatically; the litter panel
  then shows a **scan**: how many foals are coming and how many won't
  survive (her `foalViability`).
- **Predictions** (`computeLitterPrediction`): runs the game's own
  `HorseGenetics.combineGenes` 400 times, with a seeded random number
  generator swapped in for `Math.random` just for the loop (so it's
  repeatable and the game's own randomness isn't touched), then counts
  foal type, patterns, hidden wing/horn carriers, coat quality, size and
  sensitive-baby chance. **Born alive** is worked out exactly
  (`geneLabViability`) with the same rule as `triggerPregnancy`: for each
  of the 3 gene pairs 65/66, 67/68, 69/70 one gene is picked from each
  parent, and a match in any pair means the foal isn't viable.
- **Example foals**: 7 pretend foals, picked so their types match the odds
  (`geneLabExampleFoals`), drawn with `makeStandInFluffy` from
  `FamilyTree.js`.
- **Related pairs** get a warning from `describeFamilyRelation` (parent,
  siblings, half-siblings, grandparent, aunt/uncle, cousins) using the
  family record book.

### Customer orders (`Orders.js`, `OrderBoard.js`)
- **Where**: the **bounty board** on Shopping Street (left-click it) and
  **FluffList** on the **Computer** ($1500, Home & Play aisle; right-click
  it). Both open the same screen: "Wanted" (posted orders) on the left,
  "Your orders" (accepted, max `ORDER_MAX_ACTIVE` = 3) on the right.
- **An order** is a customer, a note, 1-4 requirements and a reward. It
  leaves the board after `ORDER_BOARD_LIFETIME` (15 game min) if nobody
  takes it. Once accepted it's due in 10 + 5 x (number of requirements)
  game minutes. A reminder in the bottom right shows the next deadline
  (red under 3 minutes, plus a message at 3 minutes).
- **Delivering**: "Deliver" opens a list of your fluffies with a tick or
  cross for every requirement; only a fluffy with all ticks can be sent.
  The courier takes it (like selling it: the family record says "sold")
  and you're paid the reward.
- **Reputation**: +1 per requirement for each filled order, -3 for a missed
  deadline, -2 for giving up. Levels (`ORDER_REP_LEVELS`): Backyard (0),
  Known (5), Trusted (15), Renowned (30), Master breeder (55). Higher levels
  mean more orders on the board (3 + level/2), more requirements, bigger
  rewards (+30% per level), and unlock harder requirements: patterns and
  exact coat colours (level 2), alicorns and size (3), hidden carrier genes
  (4, which is where the Gene Lab helps).
- **Adding a requirement**: add an entry to `ORDER_REQUIREMENTS` with
  `minLevel`, `weight` (how often it's picked), `make` (its details and
  `value`, which adds to the reward), `label` and `matches(req, fluffy)`.
  The orders test checks new kinds automatically for labels and levels.

### Personality traits (`Traits.js`)
- **Genes**: five traits, 5 genes each (0 or 1), stored after the older
  genes at 103-127 (`TRAIT_GENE_START`). `generateRandomGenes` adds them
  for new fluffies, `processGenes` adds random ones to older fluffies
  (`ensureTraitGenes`), and `combineGenes` passes them on like any other
  gene (a parent from before traits: the other parent's gene is used).
- **Labels**: gene sum 0-1 = low label, 2-3 = none ("Easygoing"), 4-5 =
  high label. `traitValue(horse, key)` gives -1..+1, 0 for average, and
  every effect scales with it, so an average fluffy behaves as before.
  | Trait | Low / high | What it does |
  |---|---|---|
  | `bravery` | Timid / Brave | fear of grinder, cars, sprinkler, alicorns, smarties, corpses and blood (x1.5 .. x0.5) |
  | `social` | Loner / Social | babbling, making friends and special friends; how much pens split from friends hurt (x0.5 .. x1.5) |
  | `appetite` | Picky eater / Greedy | hunger drains x0.75 .. x1.25; how keen it is to eat |
  | `energy` | Lazy / Playful | ball, blocks, TV, wandering vs sitting and lying down |
  | `temper` | Gentle / Grumpy | complaining about puddles, smarty fights; gentle fluffies often don't hit back (a very gentle one only 1 time in 5) |
- **Where the effects are hooked in**: `HorseBrain.think` (desire scores,
  table `TRAIT_DESIRE_EFFECTS`), `Horse.update` (hunger, counterattacks),
  `Fence.js` (pen sadness), `Horse` babbling (15% chance of a trait line,
  `DIALOGUE.TRAIT` in `dialogue.js`).
- **Shown in**: the magnifying glass panel ("Traits"), the family tree's
  genetics panel (dots per trait), the Gene Lab (chance of each label per
  foal), and customer orders from reputation level 2 ("Personality: Brave").
- These are separate from the game's older `personalities` (smarty and the
  backstories like mill escapee), which aren't inherited.

### Memory and trust (`Memory.js`)
Each fluffy remembers how you (the hand / mouse cursor) treat it. Saved
with the fluffy: `playerTrust` (0-1, starts 0.5 at home, 0.35 for ferals),
`playerFear` (0-1) and `playerMemories` (last 5 things, newest first).
- **Fear goes up** when you hurt it (`notePlayerViolence`, called at the
  start of `notifyViolence` in `Horse.js`): stick/spray 0.12, tack/needle
  0.2, cattle prod 0.25, knife 0.3 (+0.2 if something's cut off), grinder
  0.5; half for potty training. Fluffies that see or hear it get 0.03
  (0.08 if it's their family or special friend; double if it died). Cars
  don't count. Brave fluffies get less, timid more. Hurting also costs
  trust (60% of the fear added).
- **Fear fades** by 0.03 per game minute, starting a minute after the last
  hurt; gentle fluffies forgive 1.5x faster, grumpy ones 0.5x.
- **Trust goes up** from brushing (+0.05, also calms fear a little), eating
  at home, being happy with you around, and being picked up when it
  already loves you. Social fluffies warm up faster.
- **Behaviour** (desire scores: flee 62-90, come to you 47): `FleePlayerDesire`: scared (fear 0.45+) fluffies back away
  when your hand comes within 170px. `SeekPlayerDesire`: fluffies that
  love you (trust 0.75+, fear under 0.2) trot over to your hand now and
  then (at most every 45s). `onFluffyPickedUp` (from the mousedown code):
  scared ones cry and may wet themselves, loving ones say "Upsies!".
  Lines are in `DIALOGUE.TRUST`.
- **Shown in** the magnifying glass panel ("Affection", "Remembers")
  and used by the "Friendly with people" customer order requirement.

### Bonds and grudges between fluffies (`Bonds.js`)
Each fluffy has `opinions[otherId]` (-1..1) and `opinionWhy[otherId]` (a
short reason for strong feelings), saved with it. `getLiking(a, b)` adds a
bonus for family, friends and special friends (`RELATIONSHIP_LIKING`) and
is the number to use whenever one fluffy "decides" how it feels about
another.
- **Goes up**: about +0.07 per minute spent calmly within 130px of each
  other (`updateSocialBonds`, once a second; social fluffies faster,
  loners slower; sleeping side by side counts), chatting +0.03, hugging
  +0.08, becoming friends +0.2. When both like each other enough (0.5 and
  0.2+) and aren't related, they **become friends by themselves**.
- **Goes down**: being attacked -0.35 (reason "attacked it"); hitting back
  -0.1; seeing someone hurt a fluffy you like -0.15 ("hurt its buddy");
  bystanders think a bit less of bullies (-0.04).
- **Fades** toward neutral at 0.01 per game minute.
- **Buddies** (0.5+): `SeekBuddyDesire` walks over to hang out now and then
  (score 46, every 25-45s); a brave buddy within reach jumps into a fight
  to defend them half the time (uses the game's `counterattack`).
- **Grudges** (-0.3 and below): `AvoidGrudgeDesire` walks away (unless
  very grumpy); being near a grudge makes it unhappy and grumble; friendship
  offers are refused; a grumpy, not-timid fluffy with a deep grudge (-0.6)
  may start a scuffle (`performAttack(..., "GRUDGE")`).
- **Shown in** the magnifying glass panel: "Buddies" and "Grudges".
- **Herds**: see `Herds.js` below. `getLiking` adds +0.2 for herd-mates
  and -0.1 for members of rival herds, and members of different herds
  don't bond by standing near each other.

### Herds (`Herds.js`)
Saved as `herdState` (`{ list, nextId }`); a herd is `{ id, name, leaderId,
memberIds, colorIndex, formedAt }`. `updateHerds` runs every 3 seconds:
- **Forming**: fluffies not in a herd, in the same scene, connected by
  mutual liking of 0.45+ (`HERD_BOND`), 3 or more of them (`HERD_MIN_SIZE`),
  become a herd with a name from `HERD_NAMES` ("Clover herd"). Family
  counts as bonded from the start (`RELATIONSHIP_LIKING` in `Bonds.js`),
  so families herd up straight away.
- **Leader**: best `herdLeadershipScore`: grown up, brave, healthy, liked
  by the others; smarties push themselves forward (+0.5). A lost leader is
  replaced.
- **Joining**: foals join mum's herd; others join a herd where they're
  bonded with 2+ members, unless they dislike its leader.
- **Leaving**: members whose average liking of herd-mates drops below 0.05
  or who dislike the leader (liking -0.3, or a personal grudge of -0.5 even
  if family). Herds under 2 members break up.
- **Rivals**: members of different herds within 150px slowly dislike each
  other (-0.0006/s, "rival herd"; about 8 minutes of contact to reach
  dislike) and sometimes say so (`DIALOGUE.HERD.STRANGER`).
- **Moving together**: `FollowHerdDesire` (score 47) sends members back
  toward the leader when they're over 220px away.
- **Seeing it**: H toggles coloured markers under each fluffy (★ = leader);
  the magnifying glass has a "Herd" row. Messages appear when a herd with
  your fluffies forms or gets a new leader.
- **For the future park**: `herdOf`, `sameHerd`, `getHerdMembers`,
  `getHerdLeader`, `getHerdCentre(h, scene)`. With 40 fluffies bonds and
  herds add about 8% to the game's work; a much bigger park would want a
  spatial grid for the "who's near whom" checks.

### Fluffy Park and the camera (`Park.js`)
The park (`PARK`, from the Day Care Alley's right arrow) is 3 screens wide and 2.4
screens tall (`PARK_W`, `PARK_H`). You look around by dragging the grass,
the mouse wheel / trackpad, WASD or the arrow keys (in the park WASD looks
around instead of travelling), clicking or dragging on the map in the
corner, or carrying something to the screen edge. The exit arrow on the
left goes back to Day Care Alley; clicking it while carrying something takes
you *and* it (anywhere else that would throw it through on its own).
- **The camera** (`camera.x/y`) only matters in the park. Everything there
  has world positions; `render()` in `script.js` draws the world through
  the camera, skips things far off screen, then draws buttons and windows
  on top in screen positions.
- **The mouse** keeps its screen position in `mouse.sx/sy`. In the park,
  `mouse.x/y` is switched between world (`mouseToWorld()`) and screen
  (`mouseToScreen()`): world for the game logic (animate, before
  `updateSimulation`), for drawing the world, and in the mousedown handler
  for dropping, picking up and right-clicking; screen for buttons, menus,
  windows and arrows. Outside the park these do nothing, so the rest of the
  game (and the tests that set `mouse.x` by hand) is untouched.
  `screenMouse()` gives the screen position in any mode.
- **Area size**: `sceneW(scene)`, `sceneH(scene)`, `sceneTop(scene)` (where
  the floor starts; the park has no back wall). Used wherever fluffies pick
  somewhere to go (`_pickNewTarget`, `getRunawayTarget`, wandering, walking
  away, coming to your hand, buddies, herds), by fences and the pen map, and
  when things are dropped through arrows into or out of the park.
- **Scenery**: trees, rocks and flowers are placed the same every time
  (`PARK_SCENERY`, seeded) and only drawn when on screen; a hedge marks the
  edges. Trees, rocks and flowers are just pictures; the food is below.
- Also fixed along the way: the mouse-wheel listener in `globals.js` is now
  `passive: false`, so its `preventDefault` works instead of logging an
  error on every scroll.

### Life in the park (`ParkLife.js`)
- **Meadows** (`PARK_MEADOWS`, 7, seeded): patches of long grass. Grass
  grows back inside them by itself (a new tuft every `MEADOW_SEED_EVERY`
  seconds, up to `MEADOW_MAX_TUFTS` per meadow). Park grass doesn't spread
  on its own (`Grass.update` skips the park). Outside meadows there's
  nothing to eat. Pee and other puddles soak into the lawn anywhere in the
  park (`Puddle.js`).
- **Berry bushes** (`BerryBush`, 12, `PARK_BUSH_SPOTS`): a kind of `Grass`,
  so fluffies find and eat berries with the same code. Up to `BERRY_MAX`
  berries, one grows back every `BERRY_REGROW` seconds, and the bush never
  goes away. Fluffies like berries more than grass.
- **Choosing food in the park**: `scoutForHunger` normally picks the food
  that fluffy likes best (Diet.js `foodPriorityFor`), then the nearest. In the park that would send everyone
  across the whole map, so there it scores `distance - priority x 150px`:
  berries are worth a short extra walk, not a trek.
- **Wild fluffies**: the park keeps about `PARK_WILD_TARGET` (16) wild ones.
  When there are fewer, `spawnParkGroup()` brings a group in at the edge
  (off screen if you're watching) every minute or two: families (mum, maybe
  dad, 1-4 foals old enough to walk, with proper mum/dad links), single
  mums, a few friends, or a loner. Families like each other, so they form
  herds by themselves. They breed too; if the park goes over
  `PARK_WILD_MAX` (30), a wild grown-up (loners first) wanders off now and
  then (faster when it's way over), never one you can see on screen. The dog clean-up in
  `updateFerals` leaves living park fluffies alone.
- **Setup**: `setupParkLife(true)` on a new game (bushes, meadow grass and 3
  groups); `setupParkLife(false)` after loading adds bushes/grass to older
  saves. The map shows meadows (light green) and bushes (purple when they
  have berries).
- **Tests** turn wild spawning off (`parkLife.enabled = false` in
  `tests/run-tests.js`) so new fluffies don't surprise other tests; the
  park tests turn it on. In a 10-minute run the park held 16-30 fluffies in
  several herds with no one going hungry.

### Territory (`Territory.js`)
- **Land**: each meadow plus a strip around it (`territoryZone(idx)`), so
  nearby bushes belong to it. Meadows have names (`MEADOW_NAMES`) shown on
  a tag above them in the park, with the owning herd's colour; held meadows
  are ringed in that colour on the park and the map. The magnifying glass
  herd line says "home: Clover Patch".
- **Claiming** (`updateTerritories`, every 2s): a herd with 2+ grown-ups in
  the park and no land claims the nearest free meadow. If none are free it
  picks a smaller herd's meadow to challenge (`h.challenge`). A herd with
  land whose members are hungry (average hunger under `HUNGRY_HERD`) eyes a
  smaller herd's meadow with more food.
- **Taking over**: another herd with more grown-ups inside than the owners
  for `TAKEOVER_TIME` (20s) takes the meadow. The losers dislike the winners
  ("took its meadow"). News appears if you're in the park.
- **Defending**: owners near an intruder chase it (`DefendTerritoryDesire`,
  one chaser for a lone fluffy, two for a challenger). When they catch up
  they shout it off; it runs out (`LeaveTerritoryDesire`) and keeps away for
  `KEEP_OUT_TIME`. Sometimes there's a scuffle (`performAttack` with intent
  "TERRITORY"), much more likely against challengers. Timid fluffies don't
  chase; brave + grumpy ones don't run; a herd that's contesting a meadow
  holds its ground. Owners won't make friends with fluffies on their land
  (`unwelcomeOnLand`, checked by `refusesFriendshipFrom`).
- **Food**: `territoryFoodBias` makes own-land food feel 150px closer and
  other herds' food 450px further (150 when starving).
- **Leaders** walk the herd home, or to the meadow they're after
  (`HomeTerritoryDesire`, 46.5; members follow the leader as usual).
- **Big herds split** (`Herds.js _maybeSplit`): over `HERD_MAX_SIZE` (12),
  the best would-be leader leaves with the members who like it more than
  the old leader (plus their foals). They can't rejoin for 10 minutes, and
  they need land of their own - which is where most fights come from.
- **Food is scarcer** now: meadows hold up to 5 tufts and grow one every
  18s; berries grow back every 90s.
- **Saved** on each herd in `herdState`: `territory`, `challenge`,
  `contest`.
- **Speed**: `SpatialGrid.js` finds nearby fluffies without checking every
  pair; bonds, herds and territory use it. Fluffies in other areas think 10
  times a second instead of every frame (`Horse.js`), and desires that
  want nothing aren't sorted (`HorseBrain.js`). A full park (~40 fluffies)
  went from about 4.8ms to 2.5ms of work per step.

### Sleeping together (`Bonds.js sleepBuddyScore`)
Tired fluffies used to walk to the nearest sleeping fluffy anywhere in the
area, so in the big park every herd piled up in one heap. Now
`scoutForSleep` (HorsePositioning.js) asks `sleepBuddyScore`: never next to
someone it dislikes or a member of another herd; herd-mates first, then
family and buddies; indoors any other fluffy is still fine, but in the park
a stranger's pile only if it's within 250px and neither is in a herd. If
nobody suits, it lies down where it is - except in the park, where it
first walks back to its herd's leader, or away from a rival right next to
it (`sleepSpotAwayFromRivals`, up to 3 moves).

**Rival herds keep apart** (`keepsApart(a, b)` in Herds.js: different
herds, or either dislikes the other). Such pairs don't hug
(`attemptHugging`), chat and hug as friends (`executeBabbleToFriends`),
go and visit as buddies (`SeekBuddyDesire`), make friends
(`refusesFriendshipFrom`) or share a sleeping spot. Old friends and family
who end up in rival herds (after a split) count as rivals too. In a seeded
20-minute park run, fluffies falling asleep next to a rival went from 350
times to 5.

### Fast forward (`GameSpeed.js`)
- The clock next to "Chat Log" shows game time (`timePlayed`). The 1x / 2x
  / 4x / 8x buttons (or F) set `gameSpeed`.
- `animate()` in script.js runs the normal steps, then `runFastForward`
  runs extra `updateSimulation` steps for the extra speed. The camera,
  menus and area fades stay at normal speed.
- It spends at most `FAST_FORWARD_BUDGET_MS` (25ms) per frame on the extra
  steps so the screen doesn't freeze. If that's not enough (slow computer,
  crowded park) the clock shows the real speed, e.g. "(really 2.9x)".
- Everything should use the game clock (`timePlayed` / `gameTimeMs()`), not
  `Date.now()`, so it speeds up too. (Only a couple of wiggle animations in
  HorseRenderer.js use real time.)
- New game and loading go back to 1x.

### Corpses (`Corpses.js`)
- A dead fluffy's `deathTimer` (game seconds since death, now saved) drives
  it: from `ROT_START` (4 min) to `ROT_FULL` (10 min) it darkens and goes
  brown-green (a canvas filter in `Horse.draw`) and flies gather; then it
  fades until `ROT_GONE` (13 min), when `updateCorpses` removes it with a
  puff. Fast forward speeds this up like everything else.
- A corpse you're holding or that's on a table/board isn't removed until
  it's put down.

### Day, night and weather (`WorldTime.js`)
- **Time** comes from the game clock (`timePlayed`), so it's saved and
  follows fast forward. A day is `DAY_LENGTH` (1200 game seconds = 20
  minutes at 1x, 50 seconds an hour); a new game starts at 8:00 AM on day 1.
  `gameHour()`, `getDayNumber()`, `getSeason()`, `nightAmount()` (0 day ..
  1 night, fading 18:00-21:00 and 5:00-7:00), `isNightTime()` (21:00-6:00).
  The clock next to Chat Log shows "Day 3 · 7:40 PM" with the season and
  weather underneath.
- **Seasons**: 4 days each - Spring, Summer, Autumn, Winter.
- **Weather** (`weatherState`, saved): clear, cloudy, rain, storm or snow,
  rolled from `WEATHER_CHANCES` for the season every 2-6 game hours, fading
  over `WEATHER_FADE` seconds. Snow settles on the ground (`snowCover`) and
  melts afterwards. `setWeather(type, hours)` forces it (handy for testing).
- **Drawing**: `drawSkyAndWeather` (screen, before the UI) darkens outdoor
  areas at night, adds sunrise/sunset glow, clouds, rain streaks, snowflakes
  and lightning flashes; indoors only gets a little dimmer at night.
  `drawWeatherGround` whitens the ground under snow.
- **Fluffies**: they tire faster and rest slower at night
  (`sleepRateMultipliers`, HorseUpdate.js), and the Sleep desire starts at 0.35
  tiredness at night (HorseBrain.js) - so most of a herd is asleep at night
  and few in the day. Rain and snow slowly upset fluffies outside (not
  under a tree); thunder startles them; snow makes outdoor fluffies hungry
  faster (`weatherHungerMultiplier`). In the park they run for the nearest
  tree without a rival herd under it when it rains (`ShelterDesire`) and
  stay there. They comment on rain, thunder, snow, sunny days and the dark
  (dialogue `WEATHER`).
- **Plants** (`growthMultiplier`): grass grows 1.5x in spring, 0.15x in
  winter, and 1.5x more in the rain; berries 1.8x in autumn and not at all in
  winter - winter is when herds fight hardest over food.
- **Park at night**: herd leaders head home to their meadow (Territory.js)
  and no new wild groups arrive (ParkLife.js).
- **Tests** keep the weather clear (`weatherState.until = 1e9` in
  tests/run-tests.js); tests/worldtime.test.js sets its own weather.

### Separation (`Separation.js`)
- Catching a wild fluffy is just carrying it out of the park, but it has
  consequences. When you carry any fluffy out of an area
  (`handleDropping` in globals.js calls `onFluffyTakenAway(f, fromScene)`),
  it looks at who it leaves behind: mum/foals/special friend (strongest),
  dad and brothers/sisters, herd-mates and buddies (`attachmentTo`). Foals
  taken from mum feel it most; grown-ups cope a bit better.
- Straight away it cries out; family who see it are upset, a bit more
  afraid of you, and remember "Saw you take its family away".
- While apart, grief grows toward the bond over `GRIEF_BUILD` (2 game
  minutes) - a quick trip through a doorway barely matters. Grief lowers
  happiness and it talks about missing them. Past `TRAUMA_AT` it's
  traumatised once: more fear, less trust, and the memory "Taken from its
  herd and family" (or "Taken from its mum").
- Bring it within `REUNITE_DIST` of one of them and it's overjoyed and the
  grief goes. Otherwise it starts getting over it after `GRIEF_HOLD` (10
  min), over `GRIEF_FADE` (30 min), and then leaves the herd it was taken
  from.
- The magnifying glass shows "Misses: Daisy, Clover (terribly)" while it
  grieves. Saved on the fluffy as `separation`.
- **Too young to remember**: foals under `REMEMBER_GROWTH` (0.35 grown)
  still cry and miss mum, but get over it 5x faster and keep no memory,
  trauma or fear of you from it (the same goes for tiny foals who see a
  family member taken).
- **How it was taken** (`howTaken`, decided at the moment you carry it
  off) can leave a permanent scar (`f.traumas`, saved; `addTrauma`,
  `PERMANENT_TRAUMA`):
  - `family_killed` - you killed its mum/dad/foal/sibling/special friend in
    the last `RECENT_VIOLENCE` (3 min): severity 0.8, blames you
  - `violent` - you hurt it or its family in the last 3 minutes: 0.5,
    blames you (Memory.js now marks `hurtByPlayerAt` / `killedByPlayer`;
    potty training doesn't count)
  - `orphaned` - its mum (and dad, if known) had died, not by your hand:
    0.35, doesn't blame you
  - `peaceful` - grown-ups only grieve for a while (no scar); a foal old
    enough to remember, taken from its living mum and grieving deeply, gets
    `torn_from_mum`: 0.3, blames you
- **Living with it**: permanent traumas lower happiness a little for good,
  hold its fear of you at or above half the blame (and trust below a
  ceiling) forever, and give it nightmares while asleep. The magnifying
  glass shows them in a "Trauma" row.

### Park location
The park is now reached from the Day Care Alley's right arrow (it used to be
the River's left arrow, which meant fluffies carried out of the park landed
in the river). Its exit is the left arrow back to the alley, and you arrive
on the park's left side.

### Park bug fixes
- **Items in the park**: dragged items used to be kept inside one screen
  (`width`/`height`), so tables, cages, grinders, IV stands etc. couldn't be
  moved far into the park. Item `update()`s now use `sceneTop/sceneW/sceneH`
  (Park.js) for the area they're in (same as before everywhere else), and so
  do thrown/bouncing things and gibs.
- **Clicking moving fluffies**: the game can run several steps between two
  frames (always on fast forward, and whenever the game is busy), so a
  running fluffy had already moved on from where you saw it and clicked.
  The render records where each fluffy is drawn (`_seenX/_seenY`,
  `renderFrameCount`), and `Horse.hitTestAsSeen(x, y)` tests the click
  against that. A moving fluffy also gets 10px of leeway. Used for tools
  (knife, stick, tack...), picking up and the magnifying glass.

### Temperament (`Wellbeing.js`)
- `temperamentScore(f)` = 35% happiness + 35% trust in you + 30% not
  being afraid of you, minus half its permanent trauma.
  `temperamentMultiplier(f)` turns it into 0.4x-1.3x; an ordinary fluffy
  is about 1x. Labels: Delightful pet, Good-natured, Ordinary, Nervous,
  Damaged.
- `HorseGenetics.calculatePrice` multiplies by it, so selling, the sell
  cage and buyers at the door all pay for temperament. The magnifying
  glass "Sells for" line shows e.g. "$240 (Good-natured +12%)".
- Orders: delivering a fluffy at 1.15x or more gets a tip; under 0.85x the
  customer pays less, and under 0.7x you only get half the reputation
  (`orderTemperamentReaction`). New requirement (reputation level 2+):
  "Raised gently (no lasting trauma)" (`isUntroubled`).

### Morning report (`DayReport.js`)
- A report day runs 6:00 AM to 6:00 AM. `dayStats` (saved) collects the
  money at the start, your fluffies born / arriving / dying (compared once
  a second), sales and orders (`noteDayEvent` from UI.js and Orders.js),
  news (herds forming and splitting, meadows changing hands - Herds.js,
  Territory.js), fluffies scarred for life (Separation.js), wild arrivals,
  births and deaths in the park, and the weather.
- At 6:00 `updateDayReport` turns it into `dayReportShown` - a card with
  all of that - and fast forward drops to 1x. "Start the day", Esc or Enter
  closes it. It counts as an open screen.

### Names (`Names.js`)
- Fluffies are just "Fluffy" until a human names them; they call
  themselves and each other "fwuffy" as before (`Horse.getName`).
- **On the game's screens** an unnamed fluffy is described by its looks:
  `fluffyDisplayName(f)` -> "Fluffy (pink unicorn mare)" (colour from
  `getColorName`, type, and mare/stallion, filly/colt or foal).
  `fluffyDisplayNameById(id)` also works for fluffies that are gone (from
  the family records). Used by the magnifying glass, family tree, herds,
  buddies/grudges, morning report, gene lab, orders, chat log, name tags
  (N), bed labels and causes of death.
- **Naming pop-up**: `updateNamingPopups` (once a second) notices fluffies
  that have just become yours (born to one of yours, bought, brought home
  - anything that turns `adopted` on) without a name. A single fluffy gets
  its own pop-up; newborns are grouped by mum and shown as one litter
  pop-up once she's finished giving birth. Type in the boxes (click a box,
  or Tab / Enter / arrow keys to move), "Save names" (or Enter on the last
  box), or "Leave as Fluffy" (Esc). Blank boxes stay Fluffy. The pop-up
  takes the keyboard while open (a capture-phase listener), so typing
  doesn't trigger game keys or the Space cheat box; fast forward drops to
  1x. Fluffies already yours when a game is started or loaded don't pop
  up (`resetNamingPopups`).
- Day care no longer stores "Fluffy" as a name for unnamed fluffies.
- `cleanUpAutoNames` removes the automatic names from one earlier build
  (only when every fluffy in a save is named and nearly all names are
  from that build's lists).

### Goals (`Goals.js`)
- 21 optional breeder goals (`GOALS`), from "Have a litter born at home"
  ($100) to "Become a Master breeder" ($5,000). `updateGoals` checks them
  every 2 seconds; each pays its reward once, announces itself and goes in
  the morning report news.
- Whole-game counts (fluffies sold, best sale, litters born at home, wild
  fluffies brought home) are in `goalsState.stats`, fed by `noteGoalEvent`
  (DayReport.js `noteDayEvent("sold")`, Names.js for litters and fluffies
  arriving home - `f.fromPark` is set when a wild fluffy is carried out of
  the park, Separation.js). Saved as `goalsState`.
- The list opens with the "Goals x/21" button after the speed buttons, or
  G; Esc or Close shuts it.
- To add a goal: an entry in `GOALS` with `id`, `text`, `reward`,
  `check(stats)` and optionally `progress(stats)` ("3/10").

### Balance notes (September 2026 pass)
Measured with the test harness (300 sampled fluffies, 200 orders per
level, and a 3-day home breeding run with 1 stallion and 3 mares):
- Fluffy full price (buyers at the door pay this; selling yourself pays
  half): home-bred adults median ~$115 (10% under $25, 10% over $550),
  newborns ~$30, wild adults ~$75. Alicorns are x30 (kept: they're the
  jackpot).
- Orders: median reward L1 $350, L2 $700, L3 $1,290, L4 $1,980, L5 $2,860.
- Food: a $25 kibble bag fills a bowl 5 times (25 meals, $1 a meal); the
  breeding group ate about $35 of kibble a game day.
- Buyers at the door: about 7 a game day, median offer ~$80.
- Change made: wild fluffies start wary (trust 0.2-0.3, fear 0.1-0.2), so
  fresh from the park they're about 0.8x price ("Nervous") until good care
  settles them in. Without this, the park was free money.
- Change made: potty training used to add a flat $1,000 (ten times a
  typical fluffy). Now a fully trained fluffy is worth +50% plus $50
  (`HorseGenetics.calculatePrice`), e.g. $167 -> $301.
- Change made: alicorns are extremely rare. Random genes gave about 1 in
  30 fluffies both wings and a horn; now when that happens, 97% of the time
  one of them is knocked down to a hidden 3-of-5 (`ALICORN_RANDOM_KEEP`,
  HorseGenetics.js), leaving about 1 in 800 random fluffies an alicorn
  (wild park fluffies, strays, shop foals of "any" type). The fixed
  alicorn chances were cut too: abandoned babies 20% -> 1%, mill escapees
  10% -> 1%, the foal vendor's can 5% -> 0.5%. Breeding alicorns from
  carriers is unchanged.

### Help and settling in
- **Help** (`Help.js`): the "?" button after the Goals button, or F1,
  opens "How it works" with its topics on the left (16 of them, from
  Getting started to Keys). Text lives in `HELP_TOPICS`:
  "" is a gap, "# " a small heading, "- " a bullet. Keep it up to date
  when adding features.
- **Settling in** (Wellbeing.js): a wild fluffy that becomes yours
  (`f.fromPark`) starts settling in (`startSettlingIn`, called from
  Names.js when it's first seen at home). The magnifying glass shows
  "Settling in: 40%" - progress from its starting temperament to
  Ordinary (`SETTLED_AT` 0.95). When it gets there you get "X has settled
  in with you." (`updateSettling`). Saved as `settling` / `settleStart`.

### Night events (`NightEvents.js`)
Most nights something happens to one of the park's herds, and the morning
report lists it under "Last night in the park" (green = good, red = bad).
- **When**: around 21:00 each night `updateNightEvents` plans 0-2 events
  (`NIGHT_EVENT_CHANCE` 75%, `SECOND_EVENT_CHANCE` 30%) at random times
  before 4:30. When one is due it picks a herd with 2+ members in the park
  (or a loose group of wild fluffies) and an event from `NIGHT_EVENTS`,
  weighted by season and weather, never the same one twice a night. Off
  when `parkLife.enabled` is off (the tests).
- **Bad**: `fox` (below), `sickness` (2-4 lose health and get the runs),
  `cold` (switched off: cold is now simulated all the time by Warmth.js),
  `stampede` (they scatter
  and trample their meadow; more likely in storms), `quarrel` (two adults
  fall out; sometimes the leader is toppled).
- **Good**: `bumper` (their meadow and nearby bushes fill up), `newcomers`
  (a small group joins the herd), `snuggle` (happier, healthier, like each
  other more), `lost_pet` (rare: a good-quality fluffy that trusts people
  wanders in - worth catching; `f.lostPet`).
- **The fox** (`NightPredator`) is a real animal drawn in the park (eyes
  glow in the dark). It creeps from the hedge to the weakest member (foals
  first). Fluffies within `FOX_SCARE_RANGE` wake: the brave, the leader and
  the victim's mum are "heroes" and rush in, half of its herd-mates/family
  are "helpers", the rest run. When it pounces, the chance it's driven off
  is 25% per hero + 12% per helper + 2% per fluffy screaming (max 75%);
  otherwise a grown victim may wriggle free (35%, older foals 25%), or it's
  killed ("Killed by a fox") and everyone nearby is upset. Click the fox to
  scare it away (nearby fluffies trust you a bit more). Foxes aren't saved.
- **Hooks**: `updateNightEvents` in script.js `updateSimulation`; the fox
  is drawn in `render` (`drawNightPredators`, and `drawNightPredatorEyes`
  after the night sky); clicking it is checked in the `mousedown` handler
  (UI.js) before sell mode; `nightEvents` is in `SAVED_GAME_STATE`;
  dialogue lines are `PREDATOR` and `NIGHT` in dialogue.js; the morning
  report shows `dayStats.nightEvents`.
- **Try it**: cheat `night` runs a random event now, `night fox` (or any
  id above) that one.

### Family tree: foals of mares that spawned with them
The record book (`FamilyTree.js`) used to write down only your fluffies
and their parents, so a mare that turned up with foals (park families,
single mums outside) showed no foals in her tree unless the foals were
yours too. Now `shouldRecordFluffy` also takes living foals of anyone in
the book, and opening a tree calls `recordLivingFamily`, which records the
fluffy's living parents, foals, brothers and sisters straight away.

### Alicorn acceptance (`AlicornAcceptance.js`)
Before, a fluffy scared of alicorns stayed scared unless it had an alicorn
mum, watched the "munstah" TV channel, or was reformed by the torture
channel. Now each fluffy has `alicornComfort` (0-1, saved with it) that
grows while it's awake and can see an alicorn within `ALICORN_SEE_RANGE`
(450px). At 1 it gets `alicornTolerance` (accepts them for good) and you
get a message. **It's meant to be rare and hard** (September 2026: the
user asked for it slower than the first version).
- **Speed** (`alicornAcceptanceRate`): `ALICORN_ACCEPT_TIME` (12,000s =
  10 game days of actually seeing one; far longer in practice, since
  scared ones run out of sight). x2 tiny foals, x1.5 older foals, x2 a mum
  with her own alicorn foal, x0.7-1.3 by bravery, x1.25 / x1.5 with one /
  two friends, family or herd-mates nearby who accept alicorns, x1.2 if
  the alicorn is caged, x0.1 smarties, x0.5 when hungry or miserable.
- **Forgetting**: out of sight of any alicorn it loses it all again over
  `ALICORN_FORGET_TIME` (6,000s = 5 game days).
- **Introductions**: holding a fluffy within 200px of an alicorn adds
  1/`ALICORN_INTRO_TIME` (1,800s) per second if it trusts you a lot
  (`playerTrust` >= `ALICORN_INTRO_TRUST`, 0.7).
- **TV**: the munstah channel no longer cures on the spot: +0.05 for the
  ones that watch calmly, +0.02 for the ones that run.
- **Setbacks** (`noteAlicornAttack`, called from `wasAttackedBy`): an
  alicorn attacking a fluffy costs it 0.5, and 0.2 for those watching.
- **Less fear on the way**: `findScaryAlicorn` uses `alicornFearRange`
  (300px when afraid, down to 180px).
- **Mums**: when a mare accepts alicorns, her `estranged_child` alicorn
  foals become her `baby_child`/`child` again (so she feeds them).
- The magnifying glass shows "Alicorns: Afraid / Getting used to them
  (40%) / Accepts them" (only with alicorn intolerance on).
- Notes for tests: only stallions can be smarties (the `personalities`
  setter drops "smarty" from mares); tick with `_alicornTick = 0;
  updateAlicornAcceptance(0)` for exactly one second.

### Breeding stock market (`StockMarket.js`)
Buy pedigree fluffies from other breeders: the **Breeding stock** tab of
the orders screen (Bounty Board on Shopping Street, or FluffList on the
Computer; `ordersTab` in OrderBoard.js switches between Orders and Breeding
stock).
- **Restocking**: `updateStockMarket` restocks once per report day (each
  6:00 AM, `reportDayIndex`), with `2 + level` listings (max 6) by your
  reputation level (`getOrderLevel`). Level 1 earthies only; level 2 adds
  unicorns and pegasi (and the Starfall / Silverhorn breeders); level 4 has
  a `STOCK_ALICORN_CHANCE` (12%) each morning of a Celestial Stud alicorn;
  level 5 raises quality. Bought listings are gone until the next morning.
- **Breeders and lines** (`STOCK_BREEDERS`): pastel (high colour
  quality), spots, stripes, white (pale body colour genes), wings, horn,
  hardy (cheap earthies). Two-tone isn't a line or a listed feature: most
  fluffies have it.
- **Pedigree** (`makeStockListing`): four grandparents made for the line
  (two show it, two carry it: `_lineGrandparent`), two parents bred from
  them and the fluffy bred from its parents with the real `combineGenes`,
  so it can carry things it doesn't show. Rerolled if its type isn't
  allowed at your level or it would likely be a sensitive baby. The card
  lists the fluffy's coat, its parents' looks and a count of what its
  grandparents show.
- **Price** (`stockListingPrice`): `STOCK_MARKUP` (2.2) x what it would
  sell for (`calculatePrice`, raised by a breeder: happy, trust 0.6, some
  litter training) + `STOCK_PEDIGREE_FEE` ($150), rounded to $10. So it
  never pays to buy and sell on. At level 1 they're about $600-900.
- **Buying** (`buyStockListing`): pays (free in debug mode), puts the
  fluffy indoors, adopted, named by its breeder (`fluffyNames`, and
  `stockMarket.named` so the "Give a fluffy a name" goal only counts names
  you give). Its parents and grandparents go into `fluffyRecords` with
  status `"breeder"` ("With its breeder") and the fluffy's record gets
  `motherId`/`fatherId` pointing at them and `boughtFrom` (shown in the
  family tree instead of a birth time). The fluffy itself has no
  `motherId`, so it doesn't miss a mum who isn't in the game.
- **Saved**: `stockMarket` (`day`, `listings`, `nextId`, `bought`,
  `named`) in `SAVED_GAME_STATE`.

### Names from a previous owner (`Names.js`)
Runaways (personality `"runaway"`) and lost pets (`f.lostPet`, the night
event) had a human owner, so they arrive with a name from `OWNER_NAMES`
(female / male / either; none overlap the old automatic-name lists, so
`cleanUpAutoNames` never touches them). `giveOwnerName(f)` is called where
they're made: `spawnFeral` in script.js, `_makeWild` in ParkLife.js and the
`lost_pet` night event; `nameFormerPets()` runs after loading a game for
runaways from older saves. `previousOwnerNames` (saved) records which names
came from an owner, so a name you clear isn't given back.
`namedBy(f)` says who named a fluffy: "you", "its old owner", "its
breeder" (StockMarket.js) or null. The magnifying glass shows "Named by"
unless it's you, and the "Give one of your fluffies a name" goal only
counts names you gave.

### Growing old (`Aging.js`)
Age is `f.age` (game seconds since birth, saved); `ageDays(f)` divides by
`DAY_LENGTH` (1,200s).
- **Stages** (`lifeStage`): foal (growing, about 1.4 days: `GROW_UP_TIME`
  1,680s), adult, senior from `SENIOR_DAYS` (16), elderly from
  `ELDERLY_DAYS` (24). The magnifying glass shows "Adult, 5 days old" etc.
- **Greying**: `greyAmount` goes 0 -> 1 from 16 to 28 days; `maneColorFor`
  blends the mane/tail colour 80% of that toward silver. HorseRenderer
  uses it when it makes its tinted images, and `updateAging` clears the
  cached tints when the grey level moves a step (of 5).
- **Elderly**: speed x0.75 (`Horse.updateSpeed`), mares can't get pregnant
  (`tooOldToBreed`, checked in `HorseMating.triggerPregnancy`), price x0.5
  (senior x0.8) in `calculatePrice`.
- **Old age**: from `OLD_AGE_RISK_DAYS` (28) the chance of dying within a
  day is `((days - 28) / 12)^2`; at `MAX_AGE_DAYS` (40) it always happens.
  Most live to about 35. Cause of death "Old age"; you get "X died
  peacefully of old age."
- **Starting ages**: `setSpawnAge(f, minDays, maxDays)` gives fluffies that
  turn up grown a believable age (default 1.9-13 days): called in
  `spawnFeral` (script.js), `_makeWild` (ParkLife.js) and for bought stock
  (2-10 days). Foals get `growth x GROW_UP_TIME`. Fluffies from before this
  just carry on from the age they had.

### Abandoned pets (`Abandoned.js`)
Personality `"abandoned"` (shown as "Abandoned"): dumped by an owner when
older. They turn up outside (one of the backstories in
`spawnFeralGroup`'s personality pool, not for single mums) and in the park
(7% of arrivals, `_wildPersonality`).
- `setupAbandoned(f)`: 55% grown up (3-15 days), 45% senior or elderly
  (16-31 days); `makeYoungAbandoned(f)` makes a lone one half grown (30% of
  lone ones). Named by their old owner (Names.js `isFormerPet`), trust
  0.45, fear 0.05, `missingOwner` 0.7-1 (saved).
- **Missing the owner** (`updateAbandoned`, every second): happiness is
  pulled so it settles at 0.6 - 0.3 x missingOwner instead of 0.6 (so ~0.3
  at first: sad, and a lower temperament price). They sometimes say
  `ABANDONED.MISS` lines. `missingOwner` fades over `ABANDON_GRIEF_DAYS` (5
  game days): x(1 + trust) once yours, x0.5 in the wild, x0.6 if elderly.
  At 0: +0.1 happiness, an `ABANDONED.OVER_IT` line and (if yours) "X has
  got over its old owner." The magnifying glass shows "Old owner: Misses
  its old owner (70%)".

### Breeding records (`BreedingRecords.js`)
Open with the **Records** button (between Goals and ?) or **L**.
- **Litters** tab: newest first. A litter is the foals of one mum born
  within `LITTER_WINDOW` (300s) of each other. Each shows the day, mum x
  dad, and up to 5 foals with a coat-colour dot, a star for rare ones
  (unicorn, pegasus, alicorn, spots, stripes) and what became of them
  (`describeFoalOutcome`: alive and age, sold and price, died and cause...).
- **Parents** tab: every mare and stallion with foals in the records, best
  earners first: status/age, litters, foals, sold, money earned, best sale,
  rare foals, and for living mares the days left before they're elderly
  (Aging.js `ELDERLY_DAYS`) and can't breed.
- Clicking a row opens the family tree (mum's, for a litter).
- **Data** (FamilyTree.js record book): `rec.bred` is set when a record is
  made for a newborn of one of your mares (for older saves `_guessBred`
  guesses: known mum, not bought, not a breeder's); `rec.soldFor` comes
  from `noteFluffyLeft(f, "sold", price)` at every sale (buyer at the door,
  shift-click/sell cage, customer orders); `rec.age` is updated each sync.
  `computeBreedingRecords()` works it all out (cached for 0.5s while open).

### Fluffy flu and the vet (`Illness.js`, `Vet.js`)
**Fluffy flu** (`f.illness = { type: "flu", t, known }`, saved):
- 0 to `FLU_HIDDEN` (300s): no symptoms but catching (half as much). Only
  a vet check-up finds it (`known`).
- Then sick until `FLU_LENGTH` (1,800s): sneezes (`ILLNESS.FLU` lines and a
  puff), looks miserable, loses `FLU_HEALTH_PER_DAY` (45) health a day, x2
  for foals under half grown and the elderly, and doesn't heal naturally
  meanwhile (HorseUpdate health regen checks `fluShowing`). Dies at 0
  health ("Fluffy flu"). Afterwards immune for `FLU_IMMUNE_DAYS` (10).
- **Spreading** (`updateIllness`, every 5s): to fluffies within
  `FLU_RANGE` (160px) in the same area with `FLU_SPREAD_CHANCE` (2%, 1%
  before symptoms) each tick - never between different cages or across
  fences (`canFluffiesReachEachOther`), and never to jabbed or immune ones.
- **Sources**: `FLU_WILD_CHANCE` (8%) of park arrivals, `FLU_STRAY_CHANCE`
  (10%) of strays outside (`maybeCarryFlu`), and the night event (now
  "Fluffy flu went round..."). Bought stock never has it.
- You're told when one of yours shows it, and it's on the morning report.
  The magnifying glass lists "Fluffy flu" (once known) and "flu jab".

**The vet**: the FluffVet Clinic on Shopping Street (`drawVetClinic`,
click it: `vetClinicClick`). House calls, so treatments happen at once.
- Check-up $`VET_CHECK_PRICE` (20): finds hidden flu, lists problems, and
  for seniors/elderly says roughly how long they have (`vetLifeNote`, based
  on most living to 35 days). Stored as `vetCheckedAt`, `vetNote`,
  `vetLife`.
- Treat (`vetTreatmentPrice`: $30 + flu 60, poison 80, toxoplasmosis 100,
  runs/incontinence 15, bleeding 30, hurt 20): cures all of those and heals
  to 100. Only offered when something's wrong.
- Flu jab $`VET_JAB_PRICE` (40): `fluVaccinated`, for good.
- "Check everyone" and "Jab everyone" buttons; sick fluffies are listed
  first. Free in debug mode.

### Fluffy shows (`Shows.js`)
A show every `SHOW_EVERY_DAYS` (3) days at `SHOW_HOUR` (2 PM), on the
"Shows" tab of the orders screen (third tab, OrderBoard.js routes it to
`drawShowsPage` / `handleShowsClick`). The first show is today if it's
before 10 AM, otherwise tomorrow.
- **Themes** (`SHOW_THEMES`, each `eligible(f)` and `score(parts)`): Best
  Coat, Spots & Stripes, Best Unicorn, Best Pegasus, Friendliest Fluffy,
  Best Foal, Golden Oldies, Best Behaved, and from reputation level 3 a 1 in
  4 chance of the Supreme Championship (`hard`: tougher rivals, 3x prizes).
  The same theme never runs twice in a row.
- **Judging** (`showParts`, each 0-100): coat (`showCoatScore`: 22 x
  ln(colour price multiplier) - 5, so a plain coat ~50, a rare one 80+),
  temper (`temperamentScore`), pattern (spots/stripes that show), trust,
  happiness, health, litter training, type (earthy 30, unicorn/pegasus 70,
  alicorn 100). `showConditionPenalty`: missing parts -25, flu -20,
  diarrhoea -10, poor health. `showScore(f, theme)` is what the tab shows;
  on the day the judges' mood adds -4..+4.
- **Rivals** (`_showRivals`): 5-7 entries named after the stock market's
  breeders, scores around 38 + 7 x reputation level (+12 when hard).
- **Money**: prizes `showPrizes` = (150 + 75 x level) for 1st, half for
  2nd, a quarter for 3rd; entry fee 15% of first prize. Withdrawing before
  the show refunds it. A fluffy that's gone by show time just loses the fee.
- **Placing top 3**: prize, reputation +3/+2/+1, a ribbon on the fluffy
  (`f.ribbons`, saved in `SAVED_HORSE_FIELDS`), `noteGoalEvent("showPlace")`
  (goals "Win a fluffy show" $300 and "Raise a champion" $1,000). Ribbons
  raise the price (`ribbonPriceMultiplier`, in `calculatePrice`: +15% a
  win, +7% a 2nd, +3% a 3rd, at most +60%). 3 wins = Champion
  (`isChampion`); the magnifying glass shows a "Ribbons" row.
- **Results: the ring** (screen layer 29, `drawShowResults`): after a show
  you entered it plays out in real time: the parade round the ring
  (`RING_PARADE` 5s), the line-up, the judges' scores from last place to
  first (`RING_REVEAL` 0.6s each), then the top three walk to the podium
  and get rosettes (blue 1st, red 2nd, yellow 3rd; confetti if you placed).
  The button says "Skip" until the end, then closes it. Rivals look like
  their breeder's line (`_showRivalLooks`, using the stock market's
  `_lineGrandparent`; unicorns for Best Unicorn and so on), and each
  placing keeps `genes`, `growth`, `gender` and its parade `order`, so
  "Watch again" on the Shows tab can replay the last show. Also on the
  morning report's news either way. `showState` (SAVED_GAME_STATE) holds
  the next show, your entry, the last result and a short history.
- **Grooming**: brushing a fluffy (script.js brush code ->
  `onFluffyGroomed`) sets `f.groomedAt` (saved). Within a game day of it,
  `showScore` adds `SHOW_GROOM_BONUS` (5) and the judges say "beautifully
  groomed". Brushing your entry tells you it's groomed (once).
- **The Show Hall** on Shopping Street (`getShowHallRect`, bottom right,
  below the vet; `drawShowHall` from Store.js `drawStoreScenery`): a poster
  with the next show and your entry. Click it (`showHallClick`, UI.js
  mousedown) for the orders screen on the Shows tab.

### Shopping Street: the way back is at the bottom
"Back to Garden" on Shopping Street is now an `arrow_down` at the bottom
middle (Store.js `getStorePortals`), so S walks you back to the garden and
W goes into Fluff Mart. Things carried back through it land near the
bottom of the garden (the portal's `arriveAt: "bottom"`, handled in
globals.js with the other arrows), by the garden's Shopping Street arrow.

### Bug fix: weather and customer orders stopped updating
When the update calls became registered systems, `updateWorldTime` and
`updateCustomerOrders` were left off the list, so the weather stopped
changing and orders stopped expiring or being posted. Both are registered
again (WorldTime.js, Orders.js), and the "systems" test (tests/screens.test.js) checks
the whole list.

### Shopping bag and deliveries (`ShoppingBag.js`)
Buying at Fluff Mart no longer leaves things on the store floor to carry
home. `buyFromStore(action, sx, sy)` (from `storeShelfClick`) sorts each
purchase with `shopDeliveryKind(action)`:
- **"tool"**: into the toolbox, as before.
- **"bag"**: the item types in `SHOPPING_BAG_TYPES` (food bags, bowls,
  baby feeders, balls, blocks, litterboxes, accessories). An entry
  `{ name, data: null }` goes on `shoppingBag` (saved in
  SAVED_GAME_STATE).
- **"deliver"**: everything else (cages, troughs, mega feeders, beds,
  fences and gates, the TV, Computer, Gene Lab, IV stand, sprinkler,
  grinder, table, rack, LPal, statue). `deliverShopAction` makes it with
  `currentScene` briefly set to `DELIVERY_SCENE` ("INDOORS", the living
  room), so it belongs there, and puts it on the clearest spot of floor
  (`_deliverySpot`, away from other items, above the toolbar). Fences
  aren't left stuck to the mouse.
- **"carry"**: anything that isn't an item (a fluffy) is still made on
  the store floor.

**The bag in the toolbox** (UIToolbox.js): the toolbox grid is now
`_toolboxGridEntries()` = the tools, then `getShoppingBagEntries()` (one tan
button per kind with a count, the shop picture from `drawShopActionIcon`),
paged by `_toolboxPageSlots` (used by drawing and clicking alike).
Clicking a bag button calls `takeFromShoppingBag(name)`: the item is made
at the mouse, stuck to it (`isDragging`), and put down with a click like
anything carried. Number keys don't assign bag buttons to the toolbar.

**Packing things away**: while carrying something that fits in the bag
(`carriedPackableItem`), the toolbox gets a dashed outline and "Click here
to put it in your shopping bag". Clicking it (`packIntoShoppingBag`) saves
the item as it is (`serialize()`, so a part-eaten bag of kibble stays part
eaten) and removes it from the world; taking it out again uses
`loadObject`. The last one packed comes out first.

### Pregnancy and foal care (`Pregnancy.js`)
Before, litter size was a flat 1-7 roll and nothing the player did during
a pregnancy mattered. Now:
- **Litter size runs in families** (`plannedLitterSize`, called from
  HorseAnatomy `triggerPregnancy`): every foal records the size of the
  litter it was born in (`f.litterBorn`). The expected litter is half
  `LITTER_BASE` (4) and half the average of mum's and dad's `litterBorn`
  (whichever are known), minus 1 for seniors, plus a bell-curve spread
  (`LITTER_SPREAD` 1.3), kept to 1-7. Seven foals is now rare (about 4%).
- **Care while pregnant** (`updatePregnancyCare`, system order 125, every
  2 s): `pregnancyConditionNow` = 30% fed, 25% happy, 25% health, 10%
  rested, 10% not scared of you; averaged into `f.pregCare {sum, n}`.
  `pregnancyCareScore` (0.7 if nothing seen yet), `describeCare`: Great
  (0.8+), Good (0.65+), Fair (0.5+), Poor.
- **Labour** (`onLabourStarts`, from HorseUpdate `_updatePregnancy` when
  the timer runs out): under `CARE_OK` (0.65) she loses about
  (0.65 - care) x 4 foals before birth (always keeps one); under
  `CARE_RISKY` (0.5) each foal has a (0.5 - care) x 0.6 extra chance of
  being stillborn. Genetic stillbirths (genes 65-70) still apply.
  Stores `litterSize`, `litterCareAt`, `litterLost`.
- **Birth cost** (`birthHealthCost` / `applyBirthHealthCost`, replacing
  the flat 20/40): 20 x (1.25 - 0.5 x care) per foal (15 with perfect
  care, 25 with none), x2 for a stillbirth, halved with a midwife; with a
  midwife her health can't go below 10.
- **Foals** (`onFoalBorn`, from HorseAnatomy `spawnBaby`): `litterBorn`,
  and `birthVigor` = 0.7 + 0.5 x care (0.7-1.2). Weak foals (under 0.85)
  start below full health. `foalGrowthRate` (used in HorseUpdate
  `_updateGrowingUp`): vigor (0.8-1.15) x food (hunger 0.6+ x1.05,
  0.3+ x1, 0.1+ x0.75, less x0.5) x diet (Diet.js `dietGrowthMultiplier`).
  `pregnancyConditionNow` is also x diet.
- **When she's done** (`onLitterFinished`): a message with how many,
  stillbirths and a word on her care; clears `midwife`, `pregScan`,
  `pregCare`.
- **The vet** (Vet.js): a check-up on a pregnant mare scans her
  (`f.pregScan`: how many; "risky" from `isRiskyLitter` when the births
  would take her health to 10 or less). Pregnant mares can't be jabbed:
  their Jab button is "Midwife $60" (`VET_MIDWIFE_PRICE`, `vetMidwife`);
  their second line shows the due time, care and scan.
- **Magnifying glass**: "Pregnant: Due in N min · care: Good · expecting 5";
  "Born: one of 5, strong" (or "weak (hard pregnancy)") for foals.
- Also fixed: when a fluffy is litter-trained with the stick, it was
  only *smarties* who learned by watching (Horse.js `notifyViolence`); now
  it's everyone but smarties, like the brush.

### Commissions and regular customers (`Commissions.js`)
Ordinary orders last 15-35 game minutes, too short to breed for, so they
can only be filled from fluffies you already have. Commissions close that
gap, and customers now remember you.
- **Commissions** (`makeCommission`, posted by `updateCommissions`, which
  Orders.js `updateCustomerOrders` calls): there is always one on the
  Bounty Board (the first as soon as the game starts). Each
  stays up `COMMISSION_EVERY` (1) game day, then a new one replaces it
  (`customerOrders.nextCommissionAt = { board, web }`; accepting one doesn't
  stop the next). Requirements: 1-3 things you breed for (the first is
  always coat, pattern or type; the type is a unicorn or pegasus - never a
  plain earthy - or, from game day `COMMISSION_ALICORN_DAY` (4), an
  alicorn `COMMISSION_ALICORN_CHANCE` (20%) of the time, whatever your
  reputation: `_commissionType`), plus `bredHere` ("Bred by you"). Reward: the usual
  formula x `COMMISSION_MULT` (2.5). `timeAllowed`: `COMMISSION_DAYS` (4)
  game days, +1 if it must be fully grown. They count towards your 3
  active orders.
- **FluffList exclusives** (`makeCommission(level, rnd, { exclusive: true })`,
  `source: "web"`): a second daily commission only on the Computer
  (OrderBoard.js `ordersList` hides it on the Bounty Board): one reputation
  level higher, one more requirement (at most 3), `EXCLUSIVE_MULT` (3.5)
  and `EXCLUSIVE_EXTRA_DAYS` (+1). Purple border, "EXCLUSIVE". The message
  about a new one only shows if you own a Computer.
- **Deposit**: `COMMISSION_DEPOSIT` (20%) paid when you accept
  (`order.depositPaid`); delivery pays the rest. Giving up or missing one
  takes the deposit back (`noteOrderFailed`) and costs
  `COMMISSION_REP_MISSED` (5) reputation. A warning a day before it's due.
- **"Bred by you"**: `f.bredHere`, false for every new fluffy (Horse
  constructor), set true in Pregnancy.js `onFoalBorn` when the mother is
  yours; saved. Old saves (`null`): `isBredByYou` falls back to "has a
  mother, is yours, not from the park, not a lost pet".
- **Customers** (`customerOrders.clients[name] = { filled, missed,
  loyalty, pref }`): delivery gives +1 loyalty (+2 if they tipped for a
  delightful fluffy); missing or giving up gives -2; a complaint letter -1.
  `pickOrderCustomer`: `CLIENT_RETURN_CHANCE` (45%) of orders come from a
  pleased customer (weighted by loyalty); customers at -2 or below don't
  order. `CLIENT_TIERS`: Returning (1+) +5%; Regular (3+) +15% money and
  time; Loyal (6+) +25% of both (`applyClientBonus`, in
  `makeCustomerOrder` and `makeCommission`). `customerPref(name)`: a
  favourite type from the name; half their orders ask for it
  (`customerTypeRequirement`).
- **Letters** (`customerOrders.letters`): after a delivery, a letter half
  to a whole day later - always if they were delighted (tip 10% of the
  reward) or upset (loyalty -1), half the time otherwise. Shown as a
  message and on the morning report.
- **The board** (OrderBoard.js `_drawOrderCard`): commissions have a gold
  border and "COMMISSION"; regulars show "★ Regular +15%" before the note;
  commission times are in game days and hours (`formatDaysLeft`); the
  footer shows the deposit, or "Breed one: pair up in the Gene Lab".
- Help: "Orders & customers" topic (help tabs are now 31px apart for 16
  topics).

### Buyers at the door (`Buyers.js`)
Before, a random fluffy got a fixed take-it-or-leave-it offer of its
`calculatePrice()`. Now:
- **Who knocks** (`pickBuyerKind`, weighted by reputation level):
  `BUYER_KINDS` - family (friendly, happy, foals; budget 1.0), kid (foals;
  0.6), bargain hunter (anything; 0.8, patient), farmer (grown earthies,
  healthy; 0.9), collector (coat via `showCoatScore`, patterns, not earthy;
  1.35, impatient, weight grows with level), show breeder (ribbons and
  coat; 1.3; from level 3). Each has `like(f)` 0..1, `patience` and
  `generous` (how far above their offer they'd go).
- **Which fluffy** (`makeSellRequest`, called from script.js
  `updateMoneyAndRequests` with the same candidates as before - the sell
  cage first): weighted by 0.05 + like^2 (choosy: a fluffy they like
  twice as much is asked about about three times as often).
- **The offer** (`buyerOffer`): price x `buyerConditionFactor` (health
  under 70, missing parts -25% each, flu showing x0.5, the runs x0.85) x
  budget x (1 + 6% per reputation level above 1) x (0.85 + 0.3 x like).
  `maxPay` = offer x (1 + generous x (0.4 + 0.6 x like) + up to 10%).
- **Ask more** (`askBuyerForMore`): asks `ASK_MORE_STEP` (20%) more. Within
  `maxPay` they agree (and give you at least 12 s more); past it they lose
  a point of patience and either walk off (out of patience, or a 25% chance
  anyway) or offer `maxPay` as a final offer (the button greys out).
- **The card** (UISelling.js `drawSellRequest`, `sellRequestLayout`,
  `sellRequestClick`): who's at the door and what they want, the fluffy,
  how keen they are, the price, the buyer's last reply, and Sell / Ask $X /
  No thanks. `SELL_CARD_W` x `SELL_CARD_H` (330 x 190). The two old copies
  of the Accept/Reject click code in UI.js (one checking the wrong place)
  are now one `sellRequestClick()` call.

### Fancy manes (`ManePatterns.js`)
Most fluffies keep a plain one-colour mane; a few now have a fancy one,
with the tail to match.
- **Genes** (after the trait genes, `MANE_GENE_START` = 128, 11 genes, so
  a full gene list is now 139 long, `MANE_GENE_TOTAL`): +0..+3 fancy (all 4
  needed, like spots: about 1 in 16 random fluffies), +4 style (0
  streaked, 1 tipped, 2 rainbow - but rainbow also needs +5 and +6, else
  it's streaked: about 1 in 230), +7..+9 the second colour, +10 the
  streak seed. `randomManeGenes` (HorseGenetics `generateRandomGenes`),
  `inheritManeGenes` (end of `combineGenes`: each gene from mum or dad),
  `ensureManeGenes` (HorseGenetics `processGenes`: older 128-gene fluffies
  get a plain mane, the rest filled in). `processGenes` sets
  `f.manePattern` = null or `{ kind, color, seed }` (`manePatternOfGenes`).
- **Drawing** (`paintManePattern(tinted, img, pattern, secondColor)`, called
  from HorseRenderer `ensureTintedImages` for the mane and the tail): the
  picture is tinted in the second colour (multiply, so the outline and
  shading stay) and drawn over the mane through a mask: slanted locks
  (streaked), the bottom of the hair fading in (tipped, using the
  picture's real hair box `_maneBox`), or a rainbow gradient over it all.
  The second colour greys with age like the mane (`agedColor`).
- **Value**: `manePatternPriceMultiplier` in `calculateColorMultiplier`:
  streaked or tipped x1.3, rainbow x2 - so it's in the price, the judges'
  coat score and what collectors like.
- **Shown**: magnifying glass "Mane: Streaked (pink streaks)" /
  "Tipped (bwue tips)" / "Rainbow (very rare)"; family tree "Fancy mane"
  gene row (4 dots) and the kind on the Mane line (`describeGenes`
  `maneFancy`, `manePattern`, `maneColor2`); Gene Lab "Fancy mane" bar;
  stock cards ("rainbow mane", "streaked mane").
- **Prism Stables**: a stock-market breeder (line "mane", from level 3)
  whose grandparents show or strongly carry fancy manes, rainbow 35% of the
  time.
- **Gradients made rare too**: the gradient (mane and tail fading into a
  second colour, genes 95-98) now shows only with all 4 genes, like spots
  and stripes (`hasGradient = gradientCount === 4`; Gene Lab and family
  tree match). Before, 2 of 4 was enough and about two thirds of all
  fluffies had one. Now about 6% do, and roughly three in four fluffies are
  plain (no spots, stripes, gradient or fancy mane). Existing fluffies with
  2-3 gradient genes lose it but carry it.

### Getting around the house with keys (`UIScenes.js` houseNav)
The side arrows (other rooms) and the bottom arrow (backyard) in the house
took floor space, so in the house rooms (`playerQuartersAndNotBackyard`:
the living room and the bought rooms INDOORSL1..., INDOORSR1...) those
portals are now `keyOnly`: not drawn (`drawPortals`), not clickable (UI.js
portal click), not a drop target (globals.js item drop-through). The front
door stays (it's on the wall). Other areas keep their arrows.
- **Keys** (script.js keydown): WASD and now the arrow keys too (not in the
  park, where they look around). Anything you're carrying comes along, as
  before.
- **Wall hints** (`houseNavChips`, `drawHouseNav`, called after
  `drawPortals`): the room's name and a chip per way out, right-aligned on
  the wall above the floor: "◀ A  Room L1", "S ▼ Backyard", "Buy a room
  $50,000  D ▶" (gold if you can afford it, red if not). Clicking a chip
  goes there (`houseNavClick`, UI.js mousedown).
- **Buying rooms**: a key towards a room you haven't bought
  (`houseKeyTowardsLocked`) first says the price ("Press D again to buy
  new quarters for $50,000"); pressing again within 4 s buys it
  (`buyRoomPortal`, also used by clicking the chip, which buys at once).

### Messages moved to the top middle (`UIMessages.js drawUIMessages`)
Game messages (`addUIMessage`) used to be plain white text in the top left,
on top of the money, clock and buttons. Now they stack in the top middle,
just below the top bar / wall (`uiMessageLayout`: `height * 0.15 + 10`),
each on a dark rounded card, wrapped at `UI_MESSAGE_WIDTH` (620px); only the
newest `UI_MESSAGE_MAX` (5) show at once. They still fade out after 5 s.

### Cold and heating (`Warmth.js`)
- **How cold a place is** (`placeColdness(scene)`, 0..1): outdoors by
  season (Spring 0.15, Summer 0, Autumn 0.3, Winter 0.7) + 0.2 x night
  (0.1 in summer) + 0.2 x snow + 0.1 x rain; house rooms Autumn 0.1 /
  Winter 0.35 (+0.1 x night); other indoor places half that; shops 0.
  `coldAt(f)`: 0 in a house room with a working heater; outdoors a heater
  cuts it within `HEATER_RADIUS` (240px); a park tree takes 0.15 off.
- **Warmth** (`f.warmth`, saved, `updateWarmth`, system order 145, every
  second): moves 1% of the way per second towards
  `1 - coldAt x warmthExposure`. Exposure: foals under half grown x1.5
  (older foals x1.2), elderly x1.3 (senior x1.1), scarf x0.7, wingjacket
  x0.75, asleep by a bed x0.6, huddled (others within 60 x 45 px) x0.75 for
  one, x0.55 for two or more.
- **Effects**: under `CHILLY_BELOW` (0.6) happiness drains a little, they
  say WEATHER.COLD lines, and `coldHungerMultiplier` (up to x1.6, folded
  into WorldTime `weatherHungerMultiplier`) makes them hungrier; under
  `FREEZING_BELOW` (0.3) they lose up to 0.25 health a second (x2 for
  foals under half grown) and can die ("Froze to death", with a message
  if it's yours). Balance: a lone foal out on a snowy winter night freezes
  by morning; a lone adult gets through hurt; a huddled herd is fine; a
  whole snowy winter day in the park leaves most wild fluffies cold and
  hungry but alive. The old one-off "cold night" park event is switched
  off (NightEvents.js) now that cold is simulated.
- **Shown**: a snowflake by cold fluffies (`drawColdMarker`, bigger and
  shivering when freezing), a "Warmth" row in the magnifying glass
  (`describeWarmth`), and "Cool / Cold / Freezing / Heated" after the
  weather in the top bar (`describeTemperature`, via `describeWeather`).
- **The Heater** (class `Heater`, drawn in code - a little radiator that
  glows and shimmers while heating): Fluff Mart, Home & Play, $400,
  delivered (ShoppingBag.js). Warms its whole room in the house, or
  `HEATER_RADIUS` around it elsewhere. A thermostat: it only runs (and
  costs `HEATER_COST_PER_DAY`, $30 a day, taken as it runs) while its place
  is cold. Right-click switches it off/on (`on`, saved). Yesterday's bill
  goes on the morning news (`heatingState`, SAVED_GAME_STATE).

### Affection (`Affection.js`)
Hearts for how much each fluffy you own loves you. Affection **is** the old
trust score (`f.playerTrust`, Memory.js), so shows, buyers, prices and
"friendly with people" orders all follow it.
- **Hearts**: `affectionHearts(f)` 0-5 in halves; `affectionHeartText(f)`
  draws them. Levels (`affectionLevel`): adores 0.95+, loves 0.75+, likes
  0.55+, unsure 0.3+, dislikes below.
- **Nice things** go through `giveAffection(f, type)`, amounts in
  `AFFECTION_ACTS`: brushed 0.05, fed 0.02 (anyone awake in the room when
  you fill a bowl, `FoodBag.attemptFill`), treat 0.04 (sketties), gift 0.06
  (an accessory, `AccessoryItem`), toy 0.02 (a ball/block dropped within
  220px), patched 0.06 (suture kit on a bleed), vet 0.05 (`vetTreat`),
  named 0.05 (first name only), held_happy 0.01. Each type counts in full
  `perDay` times a day, then at `AFFECTION_WEAK` (1/5); some have a
  `cooldown` in seconds. Scared fluffies (fear 0.45+) get half.
- **Bad things**: hurting it (Memory.js fear also costs trust); horrid
  accessories (`AFFECTION_HORRID`: blindfold, mouthgag, castration band)
  -0.05. Neglect (`updateAffection`, system order 135, every 2 s), per game
  hour: starving (hunger < 0.15) -0.02, freezing (warmth < 0.3) -0.02, in
  a cage for over 6 hours -0.005, no kindness for 2 days -0.03 a day
  (never below 0.6). Each is remembered once a day ("You let it go hungry").
- **Effects**: loves you → brushing gives 1.5x happiness, fear fades 1.5x
  faster, a little happier with you in the room, says `TRUST.LOVE` lines
  now and then. Dislikes you → brushing gives half and it may grumble
  (`TRUST.GRUMBLE`), squirms when picked up (`TRUST.UPSIES_GRUMPY`).
- **Feedback**: `onAffectionChanged(f, before)` (called from Memory.js
  whenever trust changes) pops a pink heart (or a cracked grey one) over the
  fluffy for changes of 0.015+, drawn in `drawVFX`, and posts a message
  when an owned fluffy starts or stops loving you.
- **Saved**: `lastKindnessAt`, `affectionToday` (today's counts).
- **Shown**: hearts under the price in the magnifying glass header; the
  "Affection" row on the Mind tab (was "Feels about you").

### Tricks and training (`Tricks.js`)
- **Training**: right-click one of your fluffies (`trickRightClick`, called
  from UI.js after item right-clicks) opens a row of chips over it
  (`trickUI`, screen "tricks", layer 6). Tricks (`TRICKS`): come, sit, down
  (lie down), bow, dance, wave, fetch (Play.js section). Picking one calls `tryTrick(f, key)`:
  - refuses (`trickRefusal`): too young to walk, asleep, a Smarty, scared of
    you (fear 0.45+), or out of tries (`TRICK_TRIES_PER_DAY` = 10, counted in
    `f.trickTries`). A fluffy that dislikes you refuses 40% of the time.
  - gets it right with `trickChance`: 0.12 + 0.83 x skill, x affection
    (0.6 dislikes .. 1.15 adores), x0.7 if hungry or miserable. Then the
    reward chips show for `TRICK_REWARD_WINDOW` (5 game seconds):
    "Good fluffy!" (`TRICK_LEARN.praise` 0.07, plus a little affection) or
    "Treat $2" (0.12, affection "treat"). Missed: 0.01.
  - gets it wrong: 0.01 learnt, does a different pose, looks confused.
  - Everything learnt is x `trickLearnRate`: affection (0.6 dislikes ..
    1.4 adores), energy trait (+/-25%), foals x1.3, elderly x0.6.
- **Skill**: `f.tricks[key]` 0..1 (saved, with `trickTries`). Known at
  `TRICK_KNOWN` 0.7 (a message when it gets there). `knownTricks(f)`.
- **Doing it**: `startTrick` sets `f.trickNow`; `TrickDesire` (score 70)
  holds the pose: SITTING, LYING, BENDING_2 (bow), FLUFFY_STOMPIE turning
  round (dance), FLUFFY_JAB repeated (wave). Come: walks to the clicked spot,
  then sits there for 3 seconds.
- **Watching**: foals that can walk, in the room and awake, within 500px,
  learn `TRICK_WATCH` (0.03) of a trick they see done, up to 0.5.
- **Showing off**: `updateTricks` (system order 136): a fluffy that loves
  you, idle and happy, does a known trick on its own every 4-10 minutes.
- **Worth**: `trickPriceMultiplier` +5% a known trick (HorseGenetics);
  `showScore` +`TRICK_SHOW_BONUS` (2) per known trick, up to 3, in every
  show but the new **Trick Show** theme (0.7 x `trickShowScore` - its best 3
  tricks - + manners and happiness); family and kid buyers like 2+ tricks
  (Buyers.js `_tricksLevel`); order requirement `tricks` ("Knows 2 tricks",
  level 2+); goal `tricks_3`.
- **Shown**: "Tricks" row on the Mind tab (`describeTricks`).

### Food and diet (`Diet.js`)
- **Foods** (`FOODS`): each has `nutrition` (0..1), `fill` (how full a meal
  makes it), `taste` (-1..1 for the average fluffy) and `spread` (how much
  fluffies differ). Kibble brands (all drawn with the kibble pictures, tinted
  with a canvas `filter`; shop order in `SPAWN_ACTIONS`):
  | Food | Bag | Nutrition | Fill | Taste | Notes |
  |---|---|---|---|---|---|
  | `premium_kibble` Fluffy Feast Premium | $80 | 1.0 | 1.0 | 0.6 ±0.25 | |
  | `kibble` Kibble | $25 | 0.7 | 1.0 | 0.05 ±0.7 | some like, some don't |
  | `value_kibble` Value Kibble | $10 | 0.4 | 0.9 | -0.2 ±0.3 | |
  | `scrap_kibble` Scrapz | $3 | 0.1 | 0.7 | -0.6 ±0.25 | 15% diarrhea, -2 health a meal |
  Scrapz is made from ground-up fluffies: the grinder turns out Scrapz bags
  (Grinder.js), its bowls use the old brown-mush pictures, and eating it
  uses `EAT.SCRAPZ`. Soylent Brown is gone; old saves' Soylent bags and
  bowls load as Scrapz. Also sketties ($120 a bag, 0.35 nutrition,
  fattening), formula, grass (0.5) and berries (0.6) - grass and berries taste the same
  to everyone so the park works as before.
- **Tastes**: `tasteFor(f, type)`; each fluffy's own liking is made the first
  time (`f.tastes`, saved). Appetite trait: picky makes dislikes stronger,
  greedy likes everything more. `favouriteFood(f)` (everyday foods, not
  sketties). `foodPriorityFor` (2 + 2 x taste) replaces the fixed bowl
  priority in `HorsePositioning.scoutForHunger`. `refusesFood`: taste below
  -0.45 and hunger over 0.25 - skipped, and it grumbles (`EAT.REFUSE`).
- **Eating** (HorseUpdate): hunger = `foodFill`; happiness `mealHappiness`
  (0.04 + 0.08 x taste, +0.05 for its favourite); lines `EAT.YUMMY/YUCKY/
  FAVOURITE`; then `onFluffyAte` updates the diet, weight, harm and sickness
  and `f.recentMeals`.
- **Diet** `f.diet` (saved, starts 0.6) moves 12% towards each meal's
  nutrition. Shows `dietShowBonus` ((diet-0.6) x 20); price
  `dietPriceMultiplier` (x0.85..1.1); `dietGrowthMultiplier` for foal growth
  and pregnancy condition; `updateDiet` (system order 137): 0.8+ heals 1 an
  hour, under 0.25 loses 1.5 an hour. Affection: filling a bowl only counts
  if it likes the food, x1.5 if it loves it.
- **Weight** `f.weight` (saved): sketties +0.08, training treats +0.015,
  burns 0.006 an hour (x2 moving). Chubby 0.45 (x0.85 speed, -4 at shows),
  fat 0.75 (x0.7, -10, x0.9 price, -0.5 health an hour). Rounder, wider belly
  (`weightBelly`, HorseRenderer). `updateSpeed` is called when the level
  changes.
- **Shown**: Diet and Weight (Overview > Care), Favourite food (Looks &
  nature > Nature).

### Play and boredom (`Play.js`)
- **Boredom** `f.boredom` 0..1 (saved), fluffies you own that can walk.
  `updatePlay` (system order 138, every 2 s): +`BOREDOM_PER_HOUR` (0.06)
  while awake, x(1 + 0.4 x energy trait), foals x1.3, elderly x0.6, x0.7 with
  a friend (`relationships`) in the room; -0.2 an hour in the park; nothing
  while asleep. Levels: bored 0.4, very bored 0.7.
- **Relief** `onFluffyPlayed(f, kind)`: `PLAY_RELIEF` ball 0.1 (kicking,
  HorseActionHandler), block 0.1 (picking up / knocking down), tv 0.008 a
  second (while `f.tvFocus`), trick 0.05, fetch 0.15, you 0.35. Its
  `favouriteToy` (ball / block / tv, from `f.toyLikes` + energy trait) x1.5.
  Ball games and fetch burn weight (-0.01, playing with you -0.02).
- **Playing with you**: `ChaseHeldBallDesire` (score 55-75): a ball you're
  holding within 450px draws fluffies that are a bit bored, playful or
  young; reaching it (`playedWithYou`) = relief "you", +0.06 happiness,
  affection "played" (0.03, 3 a day in full). Once a minute each.
- **Effects**: `playDesireBonus` changes PlayWithBall / PlayWithBlocks
  (normally 30) to 15 + 55 x boredom for your fluffies. Bored caps happiness
  at 0.88, very bored at 0.7. Bored: grumbles (`PLAY.BORED`). Very bored: -0.1
  happiness an hour and `boredMischief` about twice a game day (8-15 min) - empties a food
  bowl in reach (60%) or jabs a fluffy nearby (-0.05 happiness), with a
  message. Shows `boredomShowBonus`: +2 if under 0.3, -4 if very bored.
- **Fetch** (Tricks.js `TRICKS`, `needsBall`): refuses with "noball" if
  there's no free ball in the room (`fetchableBall`). `_doFetch`: runs to
  the ball, carries it (`ball.carriedBy`, positioned by the fluffy each
  frame; other fluffies leave it alone), brings it back to where it was
  asked, drops it and sits.
- **Shown**: Boredom (Overview > Wellbeing), Favourite toy (Looks & nature).

### Balance pass (affection, tricks, diet, play)
Checked by simulating six spayed mares for 4-5 game days in different homes
(a bot refills the bowls, sponges up mess hourly; one "attentive" home also
brushes, plays ball and trains twice a day). What changed:
- **Food `fill` must stay above 0.6** (EatDesire's "hungry" line). Scrapz at
  0.55 made fluffies that tolerate it eat nonstop and poison themselves.
  Now Value 0.9 (at 0.8 they ate so often it cost more than plain kibble), Scrapz 0.7; Scrapz harm 4 -> 2, sick 25% -> 15%.
- **Weight burned off too fast** (0.025/h): sketties-only fluffies never got
  chubby. Now burn 0.006/h and sketties +0.08: chubby in about 1.5 days,
  fat in about 2.5 on sketties alone.
- **Boredom** rose too fast and mischief was constant (dozens a day). Now
  0.06/h, mischief about twice a day, and boredom caps happiness (bored 0.88,
  very bored 0.7) - it barely dented happiness before. Toys: kicking the ball
  used to wipe boredom out; now 0.1 a kick and content fluffies play less,
  so one ball keeps a room of fluffies "Fine" but playing with you still
  counts.
- **Trust** reached 1.0 in a day from nothing: Memory.js "happy time with you
  around" was 0.0005/s (0.6 a day), now 0.00005/s. Eating at home only builds
  trust if it likes the food. Fed well, fluffies now come to love you in
  2-3 days; attentive care gets there in about 1.
- `handleBouncingPhysics` lets a ball settle with bigger time steps too
  (the real game uses 0.016 s steps, so this only mattered for fast sims).
- Not changed, but worth knowing: **toxoplasmosis** (from eating poop off the
  floor, HorseToilet.js) was the main killer in every home that didn't keep
  the floor spotless, as it was before these features.

### Toxoplasmosis jab (`Vet.js`)
- The vet already cured toxoplasmosis (Treat, $100 of the price). Now the
  row's Jab button gives whichever jabs a fluffy hasn't had: flu
  (`VET_JAB_PRICE` $40) and toxo (`VET_TOXO_JAB_PRICE` $60) - `vetJabPrice`,
  `vetCanJab`, `vetJab` (sets `isToxoVaccinated`, which HorseUpdate already
  used: a jabbed fluffy's infection clears at once). "Jab everyone" adds up
  the real cost. No toxo jab when toxoplasmosis is off in world settings.
  Not while pregnant (that button books the midwife).
- The Tvx IV bag (DIY vaccine) went from $5000 to $250.
- Simulated 3 x 4 days of 6 fluffies on kibble with a tidy bot: 4 toxo
  deaths without jabs, none with.

### Mess fades, rain washes it away (`Puddle.js fadeMess`)
- Called at the end of `updatePuddles` every frame. Puddles are recognised
  by colour (`MESS_COLORS`: poop `#5c4033`, pee `#f1c40f`, sick `#4b5320`,
  blood `#8a0303`); water and tears are left to their own evaporation.
- `MESS_FADE` (size lost per game day): poop 0.6 (a normal poop is gone in
  about a day indoors), pee 1.5, sick 0.9, blood 0 (indoors it needs the
  sponge). Outside (`getSceneConfig(scene).isOutdoor`: garden, backyard,
  park...) twice as fast.
- Rain or storm outside adds `RAIN_WASH` (0.02 a second) x `rainAmount()`:
  a full downpour clears poop, pee, sick and blood in about 30 seconds.
- In a simulated home nobody cleaned, the mess now levels off (about 1.5 poop
  and pee puddles' worth) instead of piling up; toxoplasmosis still happens
  there, so jabs and cleaning still matter.

### Fluffy sounds (`FluffySounds.js`)
- `fluffySound(f, kind)` plays a voice clip for a fluffy in the room you're
  looking at: `FLUFFY_SOUNDS` maps each kind to an adult and a foal clip
  (foals: under full size and too young to talk, or under half grown).
  Pitch is randomised a little (deeper for big adults). `SOUND_COOLDOWN`
  (seconds per fluffy: happy 20, angry 10, sad 15, scree 3, enf 10,
  shitting 6, peep 6) and `SOUND_ROOM_GAP` (0.5 s between two of the same
  kind in the room) keep it from getting noisy. Uses game time, so nothing
  repeats while paused.
- Hooks: faces (`onFluffyExpression`, called every step from HorseUpdate -
  a new or re-set `expressionOverride` plays `EXPRESSION_SOUNDS`:
  GOOD_UPSIES happy, ANGRY_PUFFED angry, MISERABLE/BAD_UPSIES sad,
  CRYING_SHOCKED scree), dying (HorseAnatomy `die`), mating (HorseMating),
  pooping (HorseToilet `excrete` and diarrhea `excretePoop`), a newborn
  (`spawnBaby`: peep). Mute and the volume slider apply as for all sounds.
- Measured in a room of 6 (4 adults, 2 foals) with a ball: roughly one
  voice clip every 10-15 seconds, plus the foals' usual chirps.

### Dirt and bath time (`Bath.js`)
- **Dirt** `f.dirt` 0..1 (saved), fluffies you own. `updateBath` (system
  order 139, every second) adds: `DIRT_PER_DAY` (0.08) always; standing in
  bodily waste (`_inMess`, Puddle.js `isBodilyWaste`) `DIRT_FROM_MESS`
  0.004 a second, twice lying/asleep; bleeding 0.01 a second; outside 0.01
  an hour, plus `DIRT_MUD_PER_HOUR` 0.12 x rain. From HorseToilet: going on
  the floor `DIRT_FROM_ACCIDENT` 0.006 (pee a third), the runs 0.02 a
  second, eating mess 0.02 a second (`addDirt`).
- Levels (`dirtLevel`): grubby 0.25, dirty 0.5, filthy 0.8. Simulated homes
  (6 untrained fluffies): cleaned hourly - dirty after a day, filthy after
  about 2.5; never cleaned - filthy within a day. Litter training helps.
- **Effects**: `beginDirtLook` (Horse.draw) adds a sepia/darker canvas
  filter from 0.2 up; `drawDirtEffects` draws smell lines and flies when
  filthy. Shows `dirtShowPenalty` (-15 x dirt); price `dirtPriceMultiplier`
  (x1..0.8). Filthy: -0.05 happiness an hour, grumbles (`BATH.FILTHY`) or
  a neighbour says it smells (`BATH.SMELLY`).
- **Baths**: the sponge (Sponge.js `attemptClean`) checks for a fluffy under
  it first (`spongeFluffy` -> `scrubFluffy`): -`BATH_SCRUB` (0.08) a rub,
  4 rubs a second, bubbles. The first rub of a bath (`BATH_SESSION` 12 s)
  decides the reaction from `f.bathLike` (-1..1, saved; random, +gentle,
  +playful, +brave): likes it -> happy, affection "bathed" (0.03, 2 a day
  in full); hates it -> CRYING_SHOCKED, unhappier, a little fear. Each bath
  adds `BATH_GET_USED` (0.08), so haters come round. `BATH.CLEAN` when it's
  spotless.
- **Shown**: Cleanliness (Overview > Wellbeing), Bath time (Looks & nature).

### The Fluff-Bot (`Roomba.js`)
- A world item (class `Roomba`, registry sellType `roomba`, Home & Play
  aisle, `ROOMBA_PRICE` $250, delivered home). Drawn in code
  (`drawRoombaShape`), no image. Light: green cleaning, blue docked, red off.
- `update(dt)` (runs in every room, seen or not): drives at `ROOMBA_SPEED`
  (70 px/s) to the nearest puddle point of any kind in its scene
  (`_nearestMess`), cleaning everything within about 30px at `ROOMBA_CLEAN`
  (0.35 size a second). No mess left: drives back to its dock
  (`homeX/homeY`, set by `setPosition` and every time you drop it) and waits.
- Right-click: on/off. Saved: `on`, `homeX`, `homeY`.
- Bumping into a fluffy in the room you're looking at (once per fluffy per
  `ROOMBA_BUMP_EVERY` 6 s) pauses it and calls `reactToRoomba`: brave +
  playful fluffies (and half of foals) think it's fun (`ROOMBA.FUN`), the
  rest get a fright (`ROOMBA.SCARED`) and scoot out of the way.
- It only does floors: fluffies still need baths (Bath.js).

### Bug and balance pass 2 (long simulations)
Simulated a breeding household (5 adults, a caring bot: food, litterbox,
baths when dirty, brushing, play, vet, jabs, selling when over 14) for 14
game days, and the park for 10 days through winter, checking every game hour
that no fluffy stat went NaN or out of range. Also compared the park on the
version from before affection/tricks/diet/play/baths: the new version has
fewer deaths (starving, stillbirths, fights, toxoplasmosis), a few more cold
deaths. Fixed:
- **Fluffy sounds / heart pops went silent after a new game or load** (their
  timers are on the game clock, which jumps back): reset in
  `resetTemporaryGameState`, and a "last played" time in the future is ignored.
- **The sponge** only baths your own fluffies that are dirty and not on a
  table or box, so the floor or litterbox under a clean fluffy still gets
  cleaned; clean fluffies can't be "bathed" over and over for affection.
- **Fetch**: a ball dropped mid-fetch (fluffy picked up) falls to the floor it
  was picked up from instead of hanging in the air. Come and Fetch now open
  the reward buttons when the fluffy gets back (`trickUI` phase "waiting",
  which doesn't block the game), not as it sets off. Showing off never picks
  Fetch.
- **Fluff-Bot**: skips mess it can't reach (edges, corners) and sprinkler
  water, and gives up on a spot for a minute if it's parked on it without
  cleaning, so it always docks in the end; never kept by a cage; scared
  fluffies only scoot to a spot they can reach, and not if caged, too young or
  can't walk.
- **Walking forever**: any fluffy that gets no closer to where it's walking
  for `MOVE_GIVE_UP` (20) seconds stops and thinks again
  (`HorseUpdate._giveUpIfStuck`).
- Tests: the trick menu test clicks its chips directly (it was flaky on a busy
  machine).
Seen and left as designed: in a breeding home most losses are stillbirths
from inbreeding (Gene Lab shows the odds) and colour-prejudiced mares
attacking "poopie" foals (world setting: colorism). A Smarty stallion forcing
pregnant mares causes miscarriages. The park is a hard place for foals.


### Lessons (`Lessons.js`)
Colour prejudice and being a Smarty can be trained out. Right-click one of
your fluffies: under the tricks (Tricks.js `getTrickMenuLayout`) there's a
second row of lesson chips, only the ones that apply (`lessonsFor`):
| Lesson | Shows when | Each lesson that sinks in |
|---|---|---|
| Colours | World Colorism on and `coloristDegree` > 0.01 | `coloristDegree` -0.08 (`LESSON_COLOURS`) |
| Alicorns | World Alicorn Intolerance on, comfort < 1, not an alicorn | `addAlicornComfort` +0.07 |
| Litter | `pottyTraining` < 1 | +0.07 |
| Be good | `isSmarty()` | `smartyReform` +0.1; at 1 `reformSmarty` |
- `giveLesson(f, key)` returns "learnt", "done" (cured), "didn't", or why it
  didn't happen ("asleep", "scared", "tired"). `LESSON_TRIES_PER_DAY` (3) a day
  for all lessons together (`f.lessonTries`, saved).
- `lessonChance`: by affection (adores 0.85 .. dislikes 0.25), foals x1.2,
  elderly x0.75, hungry or miserable x0.7. Be good is x0.2
  (`LESSON_SMARTY_CHANCE`), and a failed one loses 0.02 progress 1 time in 4
  (`LESSON_SMARTY_SLIP`). So a Smarty that loves you takes about a month of
  daily lessons and one that doesn't like you hardly gets anywhere.
- `reformSmarty(f)` takes "smarty" out of its personalities and sets
  `smartyReformed` (saved, with `smartyReform`); it then learns tricks. The
  Fluff TV torture channel's reform uses it too. That code used to set
  `personalities` to a string, which wiped every personality; it now keeps
  the list, and clamps litter training and colour views to 0..1.
- Magnifying glass: Mind tab "Lessons" row (`describeLessons`) shows Be good
  progress, or "Was a Smarty - reformed".
- The passive route: Fluff TV's Play Time channel lines marked
  `reducesColorism` lower `coloristDegree` 0.05 for each watcher.
- Tests: `tests/lessons.test.js`.

### Upbringing (`Upbringing.js`)
Foals learn their views from whoever raises them, so training a mare (Lessons)
pays off in every foal she raises. System "upbringing" (order 132), 1-second
ticker, foals only (`growth < 1`):
- `upbringingInfluences(f)`: every grown fluffy in the same scene within
  `UPBRINGING_RANGE` (600px). Weights (`UPBRINGING_WEIGHTS`): mum (`motherId`,
  so an adoptive mare counts) 1, dad (`fatherId`) 0.5, anyone else 0.15.
- `applyUpbringing(f, seconds)`: moves the foal towards the weighted average
  of their views by `UPBRINGING_RATE` (0.001) a second x min(1, total weight).
  A whole foalhood (~1680 s) with mum gets it about 80% of the way to her.
  - colour views (`coloristDegree`) when World Colorism is on
  - alicorn comfort when World Alicorn Intolerance is on; past 0.75 towards a
    grown-up who fully accepts alicorns it snaps to `acceptAlicorns`.
- Nobody around (another room, or on its own): nothing changes.
- Lessons on a foal still work, but a prejudiced mum pulls it back.
- Magnifying glass: Looks & nature "Growing up" row (`describeUpbringing`),
  e.g. "Learning from Mum (Daisy): mean to poopie fluffies". Not a header
  warning.
- No new saved fields (the views it changes were already saved).
- Tests: `tests/upbringing.test.js`.

### Fears (`Fears.js`)
Some fluffies are scared of things; you comfort them. System "fears" (order 141).
- `f.fears = { thunder, dark, bot }` (0..1, saved), made by `fearsOf` the first
  time: each fear has a 4-65% chance (`0.25 - 0.3 x bravery`), timid fluffies
  much more. Under `FEAR_MIN` (0.15) it doesn't count (`realFears`).
- **Frights** (`startFright(f, key)`, `f.fright = { key, until }`, not saved):
  | Trigger | Where |
  |---|---|
  | Thunder clap | `onThunder` from WorldTime.js; indoors needs fear >= `FEAR_INDOOR_THUNDER` (0.35); wakes it |
  | The dark | `updateFears`: night > 0.7, no Night Light on in the room; `DARK_FRIGHT_CHANCE` x fear a second (x0.3 asleep); asleep ones also sleep restlessly |
  | Fluff-Bot | bumped (`onRoombaBump` from `reactToRoomba`, returns "frightened"), or it drives within `BOT_NEAR` |
  Length `FRIGHT_TIME[key] x (0.5 + fear)`. After a fright, the same thing can't
  start another for `FRIGHT_REST` seconds (dark 200, Fluff-Bot 300; thunder
  just extends the fright). A long simulation had ~4 bot frights a day for each
  fluffy scared of it in a busy house before this.
- **While frightened**: `FrightDesire` (score 75) runs to mum (foals) or a
  friend/family member in the room (`frightComforter`), otherwise cowers
  (LYING). It trembles (`beginFrightShake`, Horse.draw) and cries.
- **Ending it**: picking it up or brushing it (`onComfortedByYou`, called from
  Memory.js `onFluffyPickedUp`/`onFluffyBrushed`): fright over, happiness +0.03,
  fear -`FEAR_COMFORT` (0.06). A comforter within 90px halves the time left.
  Ending alone with nobody near: fear +`FEAR_WORSEN` (0.02), yours only.
- **Night Light** (`NightLight`, $30, Home & Play, goes in the shopping bag):
  glows at night; `hasNightLight(scene)`; right-click to switch off.
- Lessons: "Brave" (Lessons.js) takes `LESSON_BRAVE` (0.06) off every fear.
  Upbringing.js copies fears from the grown-ups raising a foal.
- Magnifying glass: "Fears" (Looks & nature, `describeFears`) and "Frightened"
  (Wellbeing and the header, `describeFright`).
- Tests: `tests/fears.test.js`. The Fluff-Bot reaction test clears fears so it
  still checks the old timid/brave reactions.
