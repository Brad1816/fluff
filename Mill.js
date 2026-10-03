// ---------------------------------------------------------------------------
// Mill-style production (plan batch 4): a buzzer for births, newborns
// straight to the incubator, and milking nursing mares.
//
// BIRTH BUZZER (the pause menu, "Birth buzzer"): when one of your mares goes
// into labour you hear a buzz and get a message saying where.
// NEWBORNS TO THE INCUBATOR (the pause menu): each living foal born to one of
// your mares goes straight into an incubator of yours with room (any room;
// INCUBATOR_MAX each), away from its mum - tube-fed, warm. (She may not know
// it after a long while, Premature.js.)
// MILKING: right-click a nursing mare of yours with milk (or the Actions
// button): "Milk her" takes a feed of her milk and sells the bottle to the
// mill (MILK_PRICE) - one less feed for her foals. At most once every
// MILK_REST each; she doesn't like it.
// Saved: millSettings = { buzzer, toIncubator }; f._milkedAt isn't.
// ---------------------------------------------------------------------------

const MILK_PRICE = 8;
const MILK_REST = HOUR_LENGTH;

function freshMillSettings() {
  return { buzzer: false, toIncubator: false };
}
let millSettings = freshMillSettings();
if (typeof SAVED_GAME_STATE !== "undefined") {
  SAVED_GAME_STATE.push({
    name: "millSettings",
    get: () => millSettings,
    set: (v) => (millSettings = v && typeof v === "object" ? v : freshMillSettings()),
    fresh: () => freshMillSettings(),
  });
}
if (typeof PAUSE_TOGGLES !== "undefined") {
  PAUSE_TOGGLES.push(
    { label: () => `Birth buzzer: ${millSettings.buzzer ? "on" : "off"}`, run: () => (millSettings.buzzer = !millSettings.buzzer) },
    { label: () => `Newborns to incubator: ${millSettings.toIncubator ? "on" : "off"}`, run: () => (millSettings.toIncubator = !millSettings.toIncubator) },
  );
}

// HorseMating._startActiveLabor
function onLabourStarted(mare) {
  if (!millSettings.buzzer || !mare || !mare.adopted) return false;
  if (typeof playSound === "function") playSound("taser", 0.35, 1.8);
  const where = typeof houseRoomName === "function" && houseRoomName(mare.scene) ? houseRoomName(mare.scene) : mare.scene === "BACKYARD" ? "the backyard" : "another room";
  if (typeof addUIMessage === "function") addUIMessage(`BZZT! ${fluffyDisplayName(mare)} is giving birth (${where}).`);
  return true;
}

// HorseAnatomy.spawnBaby, a living foal of one of your mares
function millCollectNewborn(baby, mare) {
  if (!millSettings.toIncubator || !baby || !baby.isAlive || !mare || !mare.adopted) return false;
  if (typeof Incubator === "undefined" || typeof objects === "undefined") return false;
  const inc = objects.find((o) => o instanceof Incubator && (!o.accepts || o.accepts(baby)) && (typeof playerQuartersAndNotBackyard !== "function" || playerQuartersAndNotBackyard(o.scene) || o.scene === mare.scene));
  if (!inc) return false;
  baby.scene = inc.scene;
  const b = inc.bounds || { left: inc.x - 40, right: inc.x + 40, top: inc.y - 30, bottom: inc.y + 10 };
  baby.x = (b.left + b.right) / 2 + (Math.random() - 0.5) * 20;
  baby.y = (b.top + b.bottom) / 2;
  baby.currentCage = inc;
  baby._riding = null;
  return true;
}

function canMilk(m) {
  if (!m || !m.isAlive || !m.adopted || m.gender !== "female" || m.growth < 1) return false;
  if (!(m.lactatingTimer > 0) || !(m.milkCharges > 0) || m.currentStateKey === "SLEEPING") return false;
  return !(typeof m._milkedAt === "number" && timePlayed >= m._milkedAt && timePlayed - m._milkedAt < MILK_REST);
}

function milkMare(m) {
  if (!canMilk(m)) return false;
  m.milkCharges--;
  m._milkedAt = timePlayed;
  if (!(typeof showDebugMenu !== "undefined" && showDebugMenu)) money += MILK_PRICE;
  m.changeHappiness(-0.03, "Milked");
  if (typeof noteDayEvent === "function") noteDayEvent("sold", { money: MILK_PRICE });
  if (!m.tooYoungToSpeak() && typeof getDialogue === "function") m.speak(getDialogue(["MILKED"], m), true);
  if (typeof addUIMessage === "function") addUIMessage(`A bottle of ${fluffyDisplayName(m)}'s milk sold to the mill: +$${MILK_PRICE}.`);
  return true;
}

function millActions(f) {
  return canMilk(f) ? [{ key: "milk", name: "Milk her", sub: `+$${MILK_PRICE} a bottle`, harsh: true, run: (x) => milkMare(x) }] : [];
}
