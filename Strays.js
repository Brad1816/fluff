// ---------------------------------------------------------------------------
// Putting a fluffy out, and strays in the backyard.
//
// Putting out (abandoning) one of yours:
//   - Carry it outside and set it down (the garden, the river, the alley,
//     the road or Shelter Alley: PUT_OUT_SCENES) and you're asked first
//     ("Put Daisy out?"). Say no and it's still in your hand.
//   - Or right-click it at home: "Put out" (same question), and it's put
//     out of the front door.
//   It isn't yours any more: a stray in the garden, missing you (it counts
//   as abandoned, Abandoned.js), trusting you less, and the ones that loved
//   it at home are sad (the room grieves a little, as for a sale). Like a
//   runaway it's a former pet (Runaways.js): carry it back in and it's yours
//   again.
//
// Strays in the backyard (a broken fence lets them in, script.js): they
// aren't yours. You're asked each time a group gets in (as soon as you're
// home): keep them (yours from now on), shoo them out (off to the river),
// or leave them be (carry one indoors to keep it, or they wander off).
// ---------------------------------------------------------------------------

const PUT_OUT_SCENES = ["OUTDOORS", "RIVER", "ALLEY", "ALLEY_ROAD", "ALLEY_DAY_CARE"];
const PUT_OUT_TRUST_LOSS = 0.25;
const STRAY_SHOO_SCENE = "RIVER";

let strayVisits = []; // [{ ids: [...] }] waiting for you to decide
let strayQuestionsEnabled = true; // (the tests switch the question off, like naming pop-ups)
const strayTicker = new Ticker(1);

function _stShort(f) {
  return (typeof fluffyNames !== "undefined" && fluffyNames[f.id]) || "this fluffy";
}
function _stHe(f) {
  return f.gender === "male" ? { he: "he", him: "him", his: "his", He: "He" } : { he: "she", him: "her", his: "her", He: "She" };
}

// ---- Putting out ----

// Would setting this one down here put it out? (script.js attemptDrop)
function wouldPutOut(f) {
  return !!(f && f.isAlive && f.adopted && PUT_OUT_SCENES.includes(f.scene));
}

// Its foals at home that it leaves behind
function _stFoalsLeft(f) {
  if (typeof relationships === "undefined" || !relationships[f.id]) return 0;
  let n = 0;
  for (const [id, rel] of Object.entries(relationships[f.id])) {
    if (rel !== "baby_child") continue;
    const k = fluffies.find((x) => String(x.id) === id);
    if (k && k.isAlive && k.adopted && k.scene !== f.scene) n++;
  }
  return n;
}

// Ask first. how: "drop" (it's in your hand, outside) or "menu" (at home,
// right-click: it goes out of the front door)
function askPutOut(f, how = "drop") {
  if (!f || !f.adopted) return false;
  const p = _stHe(f);
  const n = _stShort(f);
  const lines = [`${n === "this fluffy" ? "It" : n} won't be yours any more: ${p.he}'ll be a stray, out there on ${p.his} own.`];
  const foals = _stFoalsLeft(f);
  if (foals) lines.push(`${p.He === "He" ? "His" : "Her"} ${foals === 1 ? "foal stays" : `${foals} foals stay`} at home without ${p.him}.`);
  if ((f.playerTrust || 0) >= 0.5) lines.push(`${p.He} trusts you. ${p.He}'ll miss you.`);
  openChoice({
    title: `Put ${n === "this fluffy" ? "it" : n} out?`,
    lines,
    buttons: [
      {
        label: `Put ${p.him} out`,
        kind: "danger",
        run: () => {
          if (how === "drop" && f.isDragging) f.onDrop();
          putOutFluffy(f, how === "menu");
        },
      },
      { label: `Keep ${p.him}`, cancel: true, run: () => {} },
    ],
  });
  return true;
}

// It's not yours any more. outOfTheDoor: move it out to the garden first.
function putOutFluffy(f, outOfTheDoor = false) {
  if (!f || !f.isAlive || !f.adopted) return false;
  const n = _stShort(f) === "this fluffy" ? "It" : _stShort(f);
  const home = outOfTheDoor ? f.scene : "INDOORS";
  if (outOfTheDoor) {
    f.isDragging = false;
    f.scene = "OUTDOORS";
    f.x = width / 2 + (Math.random() - 0.5) * 200;
    f.y = (typeof sceneTop === "function" ? sceneTop("OUTDOORS") : height * 0.15) + 110 + Math.random() * 60;
    if (typeof f.initBehavior === "function") f.initBehavior("IDLE");
  }
  f.currentCage = null;
  f.placedOn = null;
  if (typeof _goWild === "function") _goWild(f, "put out");
  else f.adopted = false;
  // Abandoned: it misses you (Abandoned.js), and trusts you less
  if (!Array.isArray(f.personalities)) f.personalities = [];
  if (!f.personalities.includes("abandoned")) f.personalities.push("abandoned");
  f._abandonedSetUp = true;
  f.missingOwner = Math.max(0.3, Math.min(1, (f.playerTrust || 0) + 0.2));
  const sad = (f.playerTrust || 0) >= 0.5;
  f.playerTrust = Math.max(0, (f.playerTrust || 0) - PUT_OUT_TRUST_LOSS);
  f.changeHappiness(-0.15);
  // Those who loved it at home miss it (Climate.js: like a sale)
  if (typeof noteClimateStory === "function") noteClimateStory("sold", [f.id], { s: home });
  if (typeof recordStory === "function") recordStory("turning", f, { x: `You put ${n} out of the house.` });
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `You put ${n} out.` });
  if (typeof noteWishEvent === "function") noteWishEvent(null, "left", { who: f, reason: "put out" });
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["RUNAWAY", sad ? "PUT_OUT_SAD" : "PUT_OUT"], f), true);
  if (typeof addUIMessage === "function") addUIMessage(`You put ${n} out. ${_stHe(f).He}'s a stray now (carry ${_stHe(f).him} back in to keep ${_stHe(f).him}).`);
  return true;
}

// Right-click at home (Tricks.js rightClickActions)
function putOutActions(f) {
  if (!f || !f.isAlive || !f.adopted || typeof getSceneConfig !== "function" || !getSceneConfig(f.scene).insidePlayerQuarters) return [];
  return [{ key: "putout", name: "Put out", sub: "abandon it", harsh: true, run: (x) => askPutOut(x, "menu") }];
}

// ---- Strays in the backyard ----

// script.js spawnFeralGroup: these just got into the backyard. They're
// not yours (a fluffy made in the backyard would be, Horse constructor).
function noteBackyardStrays(list) {
  const ids = [];
  for (const f of list) {
    if (!f || f.scene !== "BACKYARD") continue;
    f.adopted = false;
    f.playerTrust = typeof TRUST_START_FERAL === "number" ? TRUST_START_FERAL : 0.35;
    ids.push(f.id);
  }
  if (ids.length) strayVisits.push({ ids });
  return ids.length;
}

function _strayList(v) {
  return v.ids.map((id) => fluffies.find((f) => f.id === id)).filter((f) => f && f.isAlive && !f.adopted && f.scene === "BACKYARD");
}

// "A stray mare and her 2 foals", "Mudpie", "3 strays"
function describeStrays(list) {
  if (!list.length) return "";
  const grown = list.filter((f) => f.growth >= 1);
  const foals = list.length - grown.length;
  const named = (f) => (typeof fluffyNames !== "undefined" && fluffyNames[f.id]) || null;
  const one = (f) => named(f) || `a stray ${f.growth < 1 ? (f.gender === "male" ? "colt" : "filly") : f.gender === "male" ? "stallion" : "mare"}`;
  if (list.length === 1) return one(list[0]);
  if (grown.length === 1 && foals) return `${one(grown[0])} and ${grown[0].gender === "male" ? "his" : "her"} ${foals === 1 ? "foal" : `${foals} foals`}`;
  return `${list.length} strays`;
}

function askAboutStrays(v) {
  const list = _strayList(v);
  if (!list.length) return false;
  const what = describeStrays(list);
  const What = what.charAt(0).toUpperCase() + what.slice(1);
  openChoice({
    title: "Strays in the backyard",
    lines: [`${What} got in through the broken fence.`, `Keep ${list.length === 1 ? "it" : "them"} as yours, or shoo ${list.length === 1 ? "it" : "them"} back out?`],
    buttons: [
      { label: `Keep ${list.length === 1 ? "it" : "them"}`, kind: "ok", run: () => keepStrays(v) },
      { label: `Shoo ${list.length === 1 ? "it" : "them"} out`, run: () => shooStrays(v) },
      { label: "Leave for now", cancel: true, run: () => addUIMessage && addUIMessage("They're not yours. Carry one indoors to keep it.") },
    ],
  });
  return true;
}

function keepStrays(v) {
  const list = _strayList(v);
  for (const f of list) {
    f.adopted = true;
    f.arrivedFrom = "the backyard";
    if (typeof recordFluffy === "function") recordFluffy(f);
  }
  if (list.length && typeof addUIMessage === "function") addUIMessage(`${describeStrays(list).replace(/^a /, "The ")} ${list.length === 1 ? "is" : "are"} yours now.`);
  return list.length;
}

function shooStrays(v) {
  const list = _strayList(v);
  for (const f of list) {
    f.scene = STRAY_SHOO_SCENE;
    f.x = width * 0.4 + Math.random() * width * 0.45;
    f.y = height * 0.45 + Math.random() * height * 0.35;
    f.currentCage = null;
    if (typeof f.initBehavior === "function") f.initBehavior("IDLE");
  }
  if (list.length && typeof addUIMessage === "function") addUIMessage(`You shooed ${list.length === 1 ? "it" : "them"} out through the fence. Off to the river.`);
  return list.length;
}

// Ask when you're home and nothing else is up
function updateStrays(dt) {
  if (!strayTicker.step(dt) || !strayVisits.length || !strayQuestionsEnabled) return;
  strayVisits = strayVisits.filter((v) => _strayList(v).length);
  if (!strayVisits.length) return;
  if (typeof getSceneConfig !== "function" || !getSceneConfig(currentScene).insidePlayerQuarters) return;
  if (typeof anyScreenOpen === "function" && anyScreenOpen()) return;
  if (typeof gameState !== "undefined" && gameState !== "PLAYING") return;
  askAboutStrays(strayVisits.shift());
}

registerSystem("strays", updateStrays, 125);
