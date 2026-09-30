// ---------------------------------------------------------------------------
// Dreams and nightmares (design doc Phase 2): sleeping fluffies replay a
// chapter of their story in a thought bubble.
//
// HorseUpdate._updateDreams asks chooseDream(f) every few seconds while one
// of your fluffies sleeps. About DREAM_STORY_SHARE of its dreams come from
// its story (the rest are the old simple ones: sketties, a ball, the sun):
//   good  its mum or dad, a friend, you (if it trusts you), play, treats,
//         toys, brushing, tricks, the park, a wish come true
//   bad   harm from you, frights, being picked on, losing family, being
//         taken away
// Weighted by how much of each is in its story. A fright it was comforted
// through often comes back as "we got through it" instead (the share it was
// comforted for).
// Good dreams heal a little (DREAM_HEAL: happiness, its worst fear, grief,
// missing an old owner), at most DREAM_HEAL_PER_DAY a day.
// Bad dreams cost a little happiness (at most BAD_DREAMS_PER_DAY a day),
// and NIGHTMARE_WAKE of them wake it
// frightened (a fright, Fears.js: cuddle it) - never more than
// NIGHTMARES_PER_DAY a day, and not again within NIGHTMARE_REST.
// The bubble shows a picture (if there is one) and a few words in its own
// fluffy-speak; nightmares have a dark bubble.
// ---------------------------------------------------------------------------

const DREAM_STORY_SHARE = 0.6;
const DREAM_HEAL = 0.02;
const DREAM_HEAL_PER_DAY = 0.1;
const NIGHTMARE_WAKE = 0.3;
const NIGHTMARES_PER_DAY = 2;
const NIGHTMARE_REST = 2 * HOUR_LENGTH;
const BAD_DREAMS_PER_DAY = 0.05; // happiness

function _dNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}
function _dDay() {
  return Math.floor(_dNow() / DAY_LENGTH);
}
function _dName(id) {
  const n = typeof fluffyNames !== "undefined" ? fluffyNames[id] : null;
  return n ? n.replace(/[lr]/g, "w").replace(/[LR]/g, "W") : null;
}

// What its story gives it to dream about: [{ good, weight, icon, text, fright? }]
function dreamMaterial(f) {
  const out = [];
  const add = (good, weight, icon, text, extra = {}) => weight > 0 && out.push({ good, weight, icon, text, ...extra });
  const tally = {};
  let harms = 0;
  let losses = 0;
  let taken = 0;
  let granted = 0;
  const story = typeof storyOf === "function" ? storyOf(f) : [];
  for (const e of story) {
    if (e.k === "tally") for (const [k, v] of Object.entries(e.c)) tally[k] = (tally[k] || 0) + v;
    else if (e.k === "harmed" && e.w[0] === f.id) harms += e.n || 1;
    else if (e.k === "scarred" && e.w[0] === f.id) taken++;
    else if (e.k === "wish_granted" && e.w[0] === f.id) granted++;
  }
  // Family and friends
  const rels = typeof relationships !== "undefined" ? relationships[f.id] || {} : {};
  for (const [id, r] of Object.entries(rels)) {
    const n = _dName(+id);
    const other = typeof fluffies !== "undefined" ? fluffies.find((x) => x.id === +id) : null;
    const gone = !other || !other.isAlive;
    if (r === "mother" || r === "dead_mother") {
      if (gone) losses++;
      add(true, 3, null, `Mummah${n ? " " + n : ""}...`);
    } else if (r === "father") add(true, 2, null, `Daddeh${n ? " " + n : ""}...`);
    else if (r === "special_friend" || r === "friend") add(true, 2, null, `${n ? n + "-" : ""}fwen...`);
  }
  // You
  const you = typeof keeperNameFor === "function" ? keeperNameFor(f) : null;
  if ((f.playerTrust || 0) >= 0.5 && you && you !== "munstah") add(true, 2, "man", `${you.charAt(0).toUpperCase() + you.slice(1)}...`);
  if (tally.brushed) add(true, Math.min(4, tally.brushed / 3), "man", "Bwushies...");
  if (tally.played) add(true, Math.min(4, tally.played / 2), "ball", "Pway baww...");
  if (tally.treat) add(true, Math.min(3, tally.treat / 2), "sketties", "Sketties...");
  if (tally.toy) add(true, Math.min(3, tally.toy / 2), "block", "Toysies...");
  if (typeof knownTricks === "function" && knownTricks(f).length) add(true, 1, "man", "Twicks...");
  if (f.seenPark) add(true, 1, "sun", "Big gwassy pwace...");
  if (granted) add(true, 2, "sun", "Wish come twue...");
  // The bad
  const frights = tally.fright || 0;
  const comforted = tally.comforted || 0;
  if (harms) add(false, Math.min(8, harms * 2), null, "Nu owwies! Nu huwt!", { harm: true });
  if (frights) add(false, Math.min(5, frights), null, "Scawy... scawy...", { fright: true, comfortShare: Math.min(0.8, comforted / (frights + 1)) });
  if (tally.attacked) add(false, Math.min(4, tally.attacked), null, "Nu hit! Pwease nu hit!");
  if (losses) add(false, 3 * losses, null, "Whewe mummah...?");
  if (taken) add(false, 3 * taken, null, "Whewe famiwy...?");
  return out;
}

// Called by HorseUpdate._updateDreams. undefined: the old random dreams.
function chooseDream(f) {
  if (!f || !f.adopted || Math.random() > DREAM_STORY_SHARE) return undefined;
  const list = dreamMaterial(f);
  if (!list.length) return undefined;
  let r = Math.random() * list.reduce((a, d) => a + d.weight, 0);
  let pick = list[list.length - 1];
  for (const d of list) {
    r -= d.weight;
    if (r <= 0) {
      pick = d;
      break;
    }
  }
  // A fright it was comforted through: "we got through it"
  if (!pick.good && pick.fright && Math.random() < pick.comfortShare) {
    pick = { good: true, icon: "man", text: "...safe nao... nu scawed..." };
  }
  const dream = { story: true, good: pick.good, icon: pick.icon, text: pick.text };
  if (dream.good) goodDream(f);
  else badDream(f);
  return f.currentStateKey === "SLEEPING" ? dream : null;
}

function _dBudget(f) {
  const day = _dDay();
  if (!f._dreamDay || f._dreamDay.day !== day) f._dreamDay = { day, heal: 0, nightmares: 0 };
  return f._dreamDay;
}

function goodDream(f) {
  const b = _dBudget(f);
  if (b.heal >= DREAM_HEAL_PER_DAY) return;
  b.heal += DREAM_HEAL;
  f.changeHappiness(DREAM_HEAL);
  // Its worst fear eases a little
  if (typeof fearsOf === "function" && typeof changeFear === "function") {
    const fears = fearsOf(f);
    const worst = Object.keys(fears).sort((a, b) => fears[b] - fears[a])[0];
    if (worst && fears[worst] > 0) changeFear(f, worst, -DREAM_HEAL);
  }
  if (f.separation && typeof f.separation.grief === "number") f.separation.grief = Math.max(0, f.separation.grief - DREAM_HEAL);
  if (typeof f.missingOwner === "number") f.missingOwner = Math.max(0, f.missingOwner - DREAM_HEAL / 2);
  if (typeof recordStory === "function") recordStory("dream", f);
}

function badDream(f) {
  const b = _dBudget(f);
  // (misery doesn't stack up: bad dreams cost at most BAD_DREAMS_PER_DAY a day)
  if ((b.hurt || 0) < BAD_DREAMS_PER_DAY) {
    b.hurt = (b.hurt || 0) + 0.01;
    f.changeHappiness(-0.01);
  }
  const now = _dNow();
  if (b.nightmares >= NIGHTMARES_PER_DAY) return;
  if (f._lastNightmareAt !== undefined && now - f._lastNightmareAt < NIGHTMARE_REST) return;
  if (Math.random() > NIGHTMARE_WAKE) return;
  b.nightmares++;
  f._lastNightmareAt = now;
  wakeFromNightmare(f);
}

// It wakes up frightened: cuddle it (Fears.js onComfortedByYou)
function wakeFromNightmare(f) {
  const now = _dNow();
  f.currentDream = null;
  if (typeof f.initBehavior === "function") f.initBehavior("IDLE");
  f.fright = { key: "nightmare", until: now + 12, start: now };
  f.expressionOverride = "CRYING_SHOCKED";
  f.expressionOverrideTimer = 2.5;
  f.changeHappiness(-0.03);
  if (typeof recordStory === "function") recordStory("nightmare", f);
  if (!f.tooYoungToSpeak() && typeof getDialogue === "function") f.speak(getDialogue(["FRIGHT", "NIGHTMARE"], f), true);
  if (typeof fluffySound === "function") fluffySound(f, "sad");
}

// HorseRenderer.drawDream: a story dream's bubble (not mirrored)
function drawStoryDream(ctx, f) {
  const d = f.currentDream;
  if (!d || typeof d !== "object") return;
  const bx = f.x + (f.facingRight ? -18 : 18);
  const by = f.y - 120 * f.scale;
  ctx.save();
  ctx.fillStyle = d.good ? "white" : "#3b3346";
  ctx.strokeStyle = d.good ? "#ccc" : "#1c1824";
  ctx.lineWidth = 2;
  // Cloud: a few puffs
  for (const [dx, dy, r] of [[0, 0, 36], [-26, 6, 24], [26, 6, 24], [-12, -18, 22], [14, -18, 22]]) {
    ctx.beginPath();
    ctx.arc(bx + dx, by + dy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(bx + _dTail(f, -22), by + 38, 7, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(bx + _dTail(f, -28), by + 48, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  // Its picture
  const img = d.icon && typeof images !== "undefined" ? images[`dream_${d.icon}`] : null;
  if (img && img.complete && img.width > 0) {
    const s = 0.34 * (f.dreamStretch ? f.dreamStretch.x : 1);
    ctx.save();
    ctx.translate(bx, by - 6);
    ctx.rotate(f.dreamAngle || 0);
    ctx.scale(s, s);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    ctx.restore();
  } else if (!d.good) {
    ctx.fillStyle = "#d9cff0";
    ctx.font = "bold 22px Arial";
    ctx.textAlign = "center";
    ctx.fillText("!!", bx, by + 2);
  } else {
    ctx.fillStyle = "#ff8fbf";
    ctx.font = "22px Arial";
    ctx.textAlign = "center";
    ctx.fillText("♥", bx, by + 2);
  }
  // Its words
  ctx.font = "italic 12px Arial";
  ctx.textAlign = "center";
  ctx.fillStyle = d.good ? "#403a4a" : "#efe6ff";
  ctx.fillText(typeof fitText === "function" ? fitText(ctx, d.text, 86) : d.text, bx, by + 24);
  ctx.restore();
}
// (the little bubbles lead back to its head)
function _dTail(f, v) {
  return f.facingRight ? -v : v;
}
