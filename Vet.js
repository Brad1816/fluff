// ---------------------------------------------------------------------------
// The vet: FluffVet clinic on Shopping Street (click it). The vet makes
// house calls, so everything happens straight away from the clinic screen.
//
// For each of your fluffies (sick ones listed first):
//   Check-up (VET_CHECK_PRICE)  finds flu that isn't showing yet (Illness.js),
//        and for older fluffies says roughly how long they have left
//        (Aging.js: most live to 5-7 years)
//   Treat (vetTreatmentPrice)   cures Fluffy flu, poisoning, toxoplasmosis,
//        the runs and incontinence, stops bleeding and heals to full health
//   Jabs                        flu jab (VET_JAB_PRICE): can't catch Fluffy
//        flu; toxo jab (VET_TOXO_JAB_PRICE): toxoplasmosis can't take hold
//        (the parasite dies off - HorseUpdate). One button gives whichever
//        it hasn't had (vetJabPrice). Not while pregnant.
// plus "Check everyone" and "Jab everyone" buttons. Free in debug mode.
// Remembered with the fluffy: vetCheckedAt (game time), vetNote (what was
// wrong), vetLife (how long it has, for older ones).
// ---------------------------------------------------------------------------

const VET_CHECK_PRICE = 20;
const VET_JAB_PRICE = 40;
const VET_TOXO_JAB_PRICE = 60;
const VET_MIDWIFE_PRICE = 60; // Pregnancy.js
const VET_ROWS = 8;
const VET_W = 1000;

let vetOpen = false;
let vetPage = 0;
// Breeding advice (Kinship.js): on, and who it's for
let vetAdviceOn = false;
let vetAdvicePick = null;

// ---- The clinic on Shopping Street ----

function getVetClinicRect() {
  return { x: width - 430, y: height * 0.15 + 95, w: 270, h: 170 };
}

function _isOverVetClinic(px, py) {
  if (currentScene !== "SHOP_STREET") return false;
  const b = getVetClinicRect();
  return px >= b.x && px <= b.x + b.w && py >= b.y - 34 && py <= b.y + b.h;
}

function drawVetClinic(c) {
  if (currentScene !== "SHOP_STREET") return;
  const b = getVetClinicRect();
  c.save();
  // Shadow
  c.fillStyle = "rgba(0,0,0,0.25)";
  c.beginPath();
  c.ellipse(b.x + b.w / 2, b.y + b.h + 4, b.w / 2 + 10, 9, 0, 0, Math.PI * 2);
  c.fill();
  // Building front
  c.fillStyle = "#f4f7f6";
  c.fillRect(b.x, b.y, b.w, b.h);
  c.strokeStyle = "#9fb3ad";
  c.lineWidth = 3;
  c.strokeRect(b.x, b.y, b.w, b.h);
  // Roof / sign
  c.fillStyle = "#2f8f6b";
  c.fillRect(b.x - 10, b.y - 34, b.w + 20, 34);
  c.fillStyle = "white";
  c.font = "bold 17px Arial";
  c.textAlign = "center";
  c.fillText("FLUFFVET CLINIC", b.x + b.w / 2, b.y - 11);
  // Green cross
  const cx = b.x + 54;
  const cy = b.y + 62;
  c.fillStyle = "#35b27f";
  c.fillRect(cx - 9, cy - 28, 18, 56);
  c.fillRect(cx - 28, cy - 9, 56, 18);
  // Door
  c.fillStyle = "#7fc8e8";
  c.fillRect(b.x + b.w - 110, b.y + 40, 80, b.h - 40);
  c.strokeStyle = "#5a7d88";
  c.strokeRect(b.x + b.w - 110, b.y + 40, 80, b.h - 40);
  c.fillStyle = "#5a7d88";
  c.beginPath();
  c.arc(b.x + b.w - 44, b.y + 110, 4, 0, Math.PI * 2);
  c.fill();
  // Sign in the window
  c.fillStyle = "#2f5d50";
  c.font = "bold 12px Arial";
  c.textAlign = "center";
  c.fillText("House calls", b.x + 60, b.y + 118);
  c.fillText("Check-ups · Flu jabs", b.x + 76, b.y + 136);
  c.fillText("Treatment", b.x + 60, b.y + 154);
  // Hover hint
  if (_isOverVetClinic(mouse.x, mouse.y) && !isGlobalDragging) {
    c.fillStyle = "rgba(0,0,0,0.7)";
    c.fillRect(b.x + b.w / 2 - 80, b.y + b.h + 12, 160, 24);
    c.fillStyle = "white";
    c.font = "13px Arial";
    c.fillText("Click to see the vet", b.x + b.w / 2, b.y + b.h + 29);
  }
  c.restore();
}

// Mouse down (UI.js), like the bounty board
function vetClinicClick() {
  if (isGlobalDragging || !_isOverVetClinic(mouse.x, mouse.y)) return false;
  openVet();
  return true;
}

// ---- Services ----

// kind: "check", "treat", "midwife" (the vet plan helps with those,
// Economy.js) or "jab"
function _vetPay(amount, kind = "treat") {
  const full = amount;
  if (kind !== "jab" && typeof vetPlanPrice === "function") amount = vetPlanPrice(amount, kind);
  if (typeof showDebugMenu !== "undefined" && showDebugMenu) return true;
  if (amount <= 0) {
    if (typeof noteVetClaim === "function") noteVetClaim(full, 0);
    return true;
  }
  if (money < amount) {
    // Pay later? (a second click: on credit, Pressure.js)
    if (typeof vetOnCredit === "function") return vetOnCredit(amount);
    if (typeof addUIMessage === "function") addUIMessage(`The vet needs $${amount}.`);
    return false;
  }
  money -= amount;
  if (typeof noteVetClaim === "function") noteVetClaim(full, amount);
  return true;
}

// What you'd pay (on the plan or not)
function vetPrice(amount, kind = "treat") {
  return kind !== "jab" && typeof vetPlanPrice === "function" ? vetPlanPrice(amount, kind) : amount;
}

function _vetName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "Fluffy";
}

// What the vet can treat right now (known or obvious)
function vetProblems(f) {
  const out = [];
  if (typeof fluKnown === "function" && fluKnown(f)) out.push(["Fluffy flu", 60]);
  if (f.isPoisoned) out.push(["poisoned", 80]);
  if (f.isToxoplasmosis) out.push(["toxoplasmosis", 100]);
  if (f.isDiarrhea || f.isIncontinent) out.push([f.isDiarrhea ? "the runs" : "incontinent", 15]);
  if (f.bleedingTimer > 0) out.push(["bleeding", 30]);
  if ((f.health ?? 100) < 90) out.push([`hurt (${Math.round(f.health)}/100)`, 20]);
  return out;
}

function vetTreatmentPrice(f) {
  const p = vetProblems(f);
  return p.length ? 30 + p.reduce((s, [, cost]) => s + cost, 0) : 0;
}

// How long an older fluffy has, roughly
function vetLifeNote(f) {
  if (typeof ageDays !== "function" || f.growth < 1) return "";
  const d = ageDays(f);
  if (d < SENIOR_DAYS) return "young and healthy for years yet";
  const left = (OLD_AGE_RISK_DAYS + MAX_AGE_DAYS) / 2 - d;
  if (left <= 2) return "very old - could go any day now";
  return `getting on - about ${fluffyAgeText(left)} left`;
}

function vetCheckUp(f) {
  if (!f || !f.isAlive || !_vetPay(VET_CHECK_PRICE, "check")) return false;
  f.vetCheckedAt = typeof timePlayed === "number" ? timePlayed : 0;
  const found = [];
  if (typeof hasFlu === "function" && hasFlu(f)) {
    f.illness.known = true;
    found.push(fluShowing(f) ? "Fluffy flu" : "Fluffy flu (caught early, no symptoms yet)");
  }
  for (const [name] of vetProblems(f)) if (name !== "Fluffy flu") found.push(name);
  // A pregnant mare gets a scan: how many, and is it risky? (Pregnancy.js)
  if (f.isPregnant && f.pregnancyTimer > 0) {
    const n = f.babiesToBirth || 0;
    f.pregScan = { count: n, at: f.vetCheckedAt };
    const [care] = typeof describeCare === "function" ? describeCare(pregnancyCareScore(f)) : ["?"];
    let scan = `expecting ${n} foal${n === 1 ? "" : "s"} (care so far: ${care.toLowerCase()})`;
    if (typeof isRiskyLitter === "function" && isRiskyLitter(f) && !f.midwife) scan += " - a risky birth for her, book a midwife";
    found.push(scan);
  }
  f.vetLife = vetLifeNote(f);
  f.vetNote = found.length ? found.join(", ") : "nothing wrong";
  const said = [f.vetNote, f.vetLife].filter(Boolean).join("; ");
  if (typeof addUIMessage === "function") addUIMessage(`Vet: ${_vetName(f)} - ${said}.`);
  return true;
}

function vetTreat(f) {
  if (!f || !f.isAlive) return false;
  const price = vetTreatmentPrice(f);
  if (!price || !_vetPay(price)) return false;
  if (typeof cureFlu === "function") cureFlu(f);
  f.isPoisoned = false;
  f.isToxoplasmosis = false;
  f.isDiarrhea = false;
  f.isIncontinent = false;
  f.bleedingTimer = 0;
  f.health = 100;
  f.vetCheckedAt = typeof timePlayed === "number" ? timePlayed : 0;
  f.vetNote = "treated - all better";
  if (typeof giveAffection === "function") giveAffection(f, "vet");
  const paid = vetPrice(price);
  if (typeof addUIMessage === "function") addUIMessage(`Vet: ${_vetName(f)} is all better ($${paid}${paid < price ? ", on the plan" : ""}).`);
  return true;
}

// A midwife for a pregnant mare's birth: each birth costs her half the
// health, and she won't die of it (Pregnancy.js)
function canBookMidwife(f) {
  return !!(f && f.isAlive && f.isPregnant && !f.midwife);
}

function vetMidwife(f) {
  if (!canBookMidwife(f) || !_vetPay(VET_MIDWIFE_PRICE, "midwife")) return false;
  f.midwife = true;
  if (typeof addUIMessage === "function") addUIMessage(`Vet: a midwife will be there when ${_vetName(f)} gives birth.`);
  return true;
}

function _toxoOn() {
  return typeof worldSettings === "undefined" || worldSettings.toxoplasmosis !== false;
}

// What the jab button would cost: flu and/or toxo, whichever it hasn't had
function vetJabPrice(f) {
  if (!f) return 0;
  return (f.fluVaccinated ? 0 : VET_JAB_PRICE) + (f.isToxoVaccinated || !_toxoOn() ? 0 : VET_TOXO_JAB_PRICE);
}

// Missing a jab, and not pregnant
function vetCanJab(f) {
  return !!(f && f.isAlive && vetJabPrice(f) > 0 && !(f.isPregnant && f.gender === "female"));
}

function vetJab(f) {
  if (!vetCanJab(f)) return false;
  const price = vetJabPrice(f);
  if (!_vetPay(price, "jab")) return false;
  const got = [];
  if (!f.fluVaccinated) got.push("flu");
  if (!f.isToxoVaccinated && _toxoOn()) got.push("toxoplasmosis");
  f.fluVaccinated = true;
  if (_toxoOn()) f.isToxoVaccinated = true;
  if (typeof addUIMessage === "function") addUIMessage(`Vet: ${_vetName(f)} had its ${got.join(" and ")} jab${got.length > 1 ? "s" : ""} ($${price}).`);
  return true;
}

// Your living fluffies, sick ones first
function vetPatients() {
  return fluffies
    .filter((f) => f.adopted && f.isAlive)
    .sort((a, b) => (vetTreatmentPrice(b) > 0) - (vetTreatmentPrice(a) > 0) || _vetName(a).localeCompare(_vetName(b)));
}

// Condition text for the list: [text, tone]
function vetCondition(f) {
  const p = vetProblems(f);
  if (p.length) return [p.map(([n]) => n).join(", "), "bad"];
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  if (f.vetCheckedAt !== undefined && now - f.vetCheckedAt < DAY_LENGTH) return [`Checked: ${f.vetNote || "fine"}`, "good"];
  return ["Looks well (not checked today)", ""];
}

// ---- The screen ----

function openVet() {
  vetOpen = true;
  vetPage = 0;
  vetAdviceOn = false;
  vetAdvicePick = null;
}
function closeVet() {
  vetOpen = false;
}
function isVetOpen() {
  return vetOpen;
}

function getVetLayout() {
  const w = Math.min(VET_W, width - 30);
  const h = Math.min(640, height - 30);
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  const list = vetPatients();
  // As many rows as fit above the bottom buttons (VET_ROWS at most)
  const perPage = Math.max(2, Math.min(VET_ROWS, Math.floor((h - 140 - 56) / 54)));
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  vetPage = Math.max(0, Math.min(pages - 1, vetPage));
  const rows = list.slice(vetPage * perPage, (vetPage + 1) * perPage).map((f, i) => {
    const ry = y + 140 + i * 54;
    const bx = x + w - 20;
    return {
      f,
      x: x + 20,
      y: ry,
      w: w - 40,
      h: 48,
      jab: { x: bx - 96, y: ry + 9, w: 88, h: 30 },
      treat: { x: bx - 96 - 106, y: ry + 9, w: 100, h: 30 },
      check: { x: bx - 96 - 106 - 106, y: ry + 9, w: 100, h: 30 },
    };
  });
  // Along the bottom, between the page arrows and Close: breeding advice,
  // the vet plan (Economy.js), and everyone at once. Narrower when the
  // window is small, so they never run into Close.
  const close = { x: x + w - 150, y: y + h - 46, w: 130, h: 32 };
  const left = x + 196;
  const want = [160, 180, 130, 150];
  const gap = 6;
  const room = close.x - 10 - left - gap * (want.length - 1);
  const k = Math.min(1, room / want.reduce((a2, b2) => a2 + b2, 0));
  let bxs = left;
  const bottom = want.map((ww) => {
    const r = { x: bxs, y: y + h - 46, w: Math.max(60, Math.floor(ww * k)), h: 32 };
    bxs += r.w + gap;
    return r;
  });
  return {
    x,
    y,
    w,
    h,
    rows,
    pages,
    list,
    advice: bottom[0],
    plan: bottom[1],
    checkAll: bottom[2],
    jabAll: bottom[3],
    prev: { x: x + 24, y: y + h - 46, w: 50, h: 32 },
    next: { x: x + 80, y: y + h - 46, w: 50, h: 32 },
    close,
  };
}

function _vetButton(c, b, label, enabled) {
  drawPanelButton(b, label, { enabled, fontSize: 13, ctx: c }); // UIPanels.js
}

function drawVet(c) {
  if (!vetOpen) return;
  if (typeof ctx !== "undefined" && c !== ctx) return; // screen pass only
  const L = getVetLayout();
  c.save();
  // Dimmed background and the panel (UIPanels.js)
  drawScreenPanel(c, L, { theme: "green" });

  c.textAlign = "left";
  c.fillStyle = "#9ff0c8";
  c.font = "bold 24px Arial";
  c.fillText("FluffVet Clinic", L.x + 24, L.y + 40);
  c.font = "13px Arial";
  c.fillStyle = "rgba(255,255,255,0.7)";
  c.fillText(
    `House calls. Check-up $${VET_CHECK_PRICE} · flu jab $${VET_JAB_PRICE} · toxo jab $${VET_TOXO_JAB_PRICE} · treatment priced by what's wrong.`,
    L.x + 24,
    L.y + 64,
  );
  if (vetAdviceOn) {
    const pick = vetAdvicePick !== null ? L.list.find((f) => f.id === vetAdvicePick) : null;
    c.fillStyle = "#f7d774";
    if (!pick) c.fillText("Breeding advice: pick a grown fluffy to see who it should (and shouldn't) have foals with.", L.x + 24, L.y + 84);
    else {
      const best = typeof bestMatches === "function" ? _vetBestMatches(pick) : [];
      const names = best.map((b) => `${_vetName(b.f)} (${Math.round(b.advice.alive * 100)}% born alive)`);
      c.fillText(fitText(c, `Best matches for ${_vetName(pick)}: ${names.length ? names.join(", ") : "nobody here yet"}.`, L.w - 48), L.x + 24, L.y + 84);
    }
  } else c.fillText("Flu spreads to fluffies nearby: pen new arrivals for a day or two. Toxoplasmosis comes from eating poop: keep floors clean.", L.x + 24, L.y + 84);
  _vetButton(c, L.advice, vetAdviceOn ? "Back to patients" : "Breeding advice", true);
  _vetButton(c, L.checkAll, "Check everyone", L.list.length > 0);
  if (typeof onVetPlan === "function") _vetButton(c, L.plan, onVetPlan() ? `On the plan ($${planPremium()}/day)` : `Join plan ($${planPremium()}/day)`, true);
  const jabCost = L.list.filter((f) => vetCanJab(f)).reduce((s, f) => s + vetJabPrice(f), 0);
  _vetButton(c, L.jabAll, `Jab everyone ($${jabCost})`, jabCost > 0);

  c.font = "bold 12px Arial";
  c.fillStyle = "rgba(255,255,255,0.55)";
  c.fillText("Fluffy", L.x + 40, L.y + 128);
  c.fillText("Age", L.x + 250, L.y + 128);
  c.fillText("Health", L.x + 370, L.y + 128);
  c.fillText(vetAdviceOn ? "As a match" : "Condition", L.x + 470, L.y + 128);

  if (!L.rows.length) {
    c.textAlign = "center";
    c.font = "15px Arial";
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.fillText("You don't have any fluffies.", L.x + L.w / 2, L.y + 220);
  }
  for (const r of L.rows) {
    const f = r.f;
    c.fillStyle = "rgba(255,255,255,0.06)";
    fillRoundRect(c, r.x, r.y, r.w, r.h, 8);
    c.textAlign = "left";
    c.font = "bold 14px Arial";
    c.fillStyle = "white";
    const name = _vetName(f);
    c.fillText(fitText(c, name, 200), r.x + 20, r.y + 29);
    c.font = "13px Arial";
    const stage = typeof lifeStage === "function" ? lifeStage(f) : "";
    const age = typeof ageDays === "function" ? fluffyAgeShort(ageDays(f)) : "";
    c.fillStyle = stage === "elderly" ? "#ff8a80" : stage === "senior" ? "#f7d774" : "rgba(255,255,255,0.85)";
    c.fillText(`${stage.charAt(0).toUpperCase() + stage.slice(1)}, ${age}`, r.x + 230, r.y + 29);
    // Health bar
    const hp = Math.max(0, Math.min(100, f.health ?? 100));
    c.fillStyle = "rgba(255,255,255,0.15)";
    c.fillRect(r.x + 350, r.y + 19, 80, 10);
    c.fillStyle = hp > 70 ? "#6fd08c" : hp > 35 ? "#f7d774" : "#ff6b6b";
    c.fillRect(r.x + 350, r.y + 19, 80 * (hp / 100), 10);
    // Breeding advice instead of the patient's condition
    if (vetAdviceOn) {
      _drawVetAdviceRow(c, r);
      continue;
    }
    const [cond, tone] = vetCondition(f);
    c.fillStyle = tone === "bad" ? "#ff8a80" : tone === "good" ? "#9fe0a8" : "rgba(255,255,255,0.7)";
    const pregnant = f.isPregnant && f.gender === "female";
    const condW = r.check.x - (r.x + 450) - 10;
    c.fillText(fitText(c, cond, condW), r.x + 450, r.y + 22);
    c.fillStyle = "rgba(255,255,255,0.5)";
    c.font = "12px Arial";
    // Second line: flu jab, and what the vet said about its age
    const now = typeof timePlayed === "number" ? timePlayed : 0;
    const life = f.vetLife && f.vetCheckedAt !== undefined && now - f.vetCheckedAt < DAY_LENGTH ? ` · ${f.vetLife}` : "";
    const toxo = _toxoOn() ? ` · toxo ${f.isToxoVaccinated ? "✓" : "✗"}` : "";
    let line2 = `Jabs: flu ${f.fluVaccinated ? "✓" : "✗"}${toxo}${life}`;
    if (pregnant && typeof describePregnancy === "function") {
      line2 = `Pregnant: ${describePregnancy(f)[0]}${f.midwife ? " · midwife booked" : ""}`;
      c.fillStyle = "#f7c6e0";
    }
    c.fillText(fitText(c, line2, condW), r.x + 450, r.y + 40);
    const price = vetTreatmentPrice(f);
    const checkPrice = vetPrice(VET_CHECK_PRICE, "check");
    _vetButton(c, r.check, checkPrice ? `Check-up $${checkPrice}` : "Check-up (plan)", true);
    _vetButton(c, r.treat, price ? `Treat $${vetPrice(price)}` : "Treat", price > 0);
    // No jabs while pregnant: that button books a midwife instead
    if (pregnant) _vetButton(c, r.jab, f.midwife ? "Midwife ✓" : `Midwife $${vetPrice(VET_MIDWIFE_PRICE, "midwife")}`, !f.midwife);
    else _vetButton(c, r.jab, vetJabPrice(f) ? `Jab $${vetJabPrice(f)}` : "Jabbed", vetJabPrice(f) > 0);
  }
  if (typeof drawGlassButton === "function") {
    if (L.pages > 1) {
      drawGlassButton(L.prev.x, L.prev.y, L.prev.w, L.prev.h, "▲", { fontSize: 14, borderRadius: 8 });
      drawGlassButton(L.next.x, L.next.y, L.next.w, L.next.h, "▼", { fontSize: 14, borderRadius: 8 });
      c.textAlign = "left";
      c.font = "13px Arial";
      c.fillStyle = "rgba(255,255,255,0.7)";
      c.fillText(`${vetPage + 1} / ${L.pages}`, L.next.x + L.next.w + 12, L.next.y + 21);
    }
    drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 15, borderRadius: 10 });
  }
  c.restore();
}

// ---- Breeding advice (Kinship.js) ----

// The picked fluffy's best matches, worked out twice a second at most
let _vetBestCache = null;
function _vetBestMatches(pick) {
  const now = typeof performance !== "undefined" ? performance.now() : Date.now();
  if (!_vetBestCache || _vetBestCache.id !== pick.id || now - _vetBestCache.at > 500) _vetBestCache = { id: pick.id, at: now, list: bestMatches(pick, 3) };
  return _vetBestCache.list;
}

// A row in advice mode: how it goes with the picked fluffy
function _drawVetAdviceRow(c, r) {
  const f = r.f;
  const pick = vetAdvicePick !== null ? fluffies.find((x) => x.id === vetAdvicePick && x.isAlive) : null;
  const w = r.jab.x + r.jab.w - (r.x + 450);
  const grown = f.growth >= 1;
  c.textAlign = "left";
  if (pick === f) {
    c.strokeStyle = "#f7d774";
    c.lineWidth = 2;
    c.beginPath();
    if (c.roundRect) c.roundRect(r.x, r.y, r.w, r.h, 8);
    else c.rect(r.x, r.y, r.w, r.h);
    c.stroke();
    c.font = "bold 13px Arial";
    c.fillStyle = "#f7d774";
    c.fillText("Advice for this one", r.x + 450, r.y + 22);
  } else if (!pick || !grown || f.gender === pick.gender) {
    c.font = "13px Arial";
    c.fillStyle = "rgba(255,255,255,0.45)";
    c.fillText(!grown ? "Too young to breed" : pick ? "-" : "", r.x + 450, r.y + 22);
  } else {
    const a = pairAdvice(pick, f);
    const best = _vetBestMatches(pick).some((b) => b.f === f);
    c.font = "bold 13px Arial";
    c.fillStyle = a.tone === "bad" ? "#ff8a80" : a.tone === "good" ? "#9fe0a8" : "#f7d774";
    c.fillText(fitText(c, `${best ? "\u2605 " : ""}${a.verdict}`, w - 110), r.x + 450, r.y + 22);
    c.font = "12px Arial";
    c.fillStyle = "rgba(255,255,255,0.7)";
    const parts = [a.relation ? a.relation.charAt(0).toUpperCase() + a.relation.slice(1) : "Not related", `${Math.round(a.alive * 100)}% of foals born alive`];
    if (!a.willMate) parts.push(a.why);
    // Foals mum would turn on (Kinship.js foalRejectRisk)
    if (a.risk && a.risk.total >= 0.05) {
      const why = [a.risk.colour >= 0.05 ? "coat" : null, a.risk.alicorn >= 0.05 ? "alicorn" : null].filter(Boolean).join(", ");
      parts.push(`~${Math.round(a.risk.total * 100)}% rejected by mum (${why})`);
    }
    c.fillText(fitText(c, parts.join(" \u00B7 "), w - 110), r.x + 450, r.y + 40);
  }
  if (grown) _vetButton(c, r.jab, pick === f ? "Picked" : "Pick", true);
}

// Mouse down (screen positions); swallows clicks while open
function handleVetClick() {
  if (!vetOpen) return false;
  const L = getVetLayout();
  const hit = (b) => isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h);
  if (hit(L.close) || !hit(L)) {
    closeVet();
    return true;
  }
  if (typeof onVetPlan === "function" && hit(L.plan)) {
    if (onVetPlan()) leaveVetPlan();
    else joinVetPlan();
    return true;
  }
  if (hit(L.advice)) {
    vetAdviceOn = !vetAdviceOn;
    vetAdvicePick = null;
    return true;
  }
  if (hit(L.checkAll)) {
    for (const f of L.list) if (!vetCheckUp(f)) break;
    return true;
  }
  if (hit(L.jabAll)) {
    for (const f of L.list) if (vetCanJab(f) && !vetJab(f)) break;
    return true;
  }
  if (L.pages > 1 && hit(L.prev)) {
    vetPage = Math.max(0, vetPage - 1);
    return true;
  }
  if (L.pages > 1 && hit(L.next)) {
    vetPage = Math.min(L.pages - 1, vetPage + 1);
    return true;
  }
  for (const r of L.rows) {
    if (vetAdviceOn) {
      if (hit(r.jab) && r.f.growth >= 1) {
        vetAdvicePick = vetAdvicePick === r.f.id ? null : r.f.id;
        return true;
      }
      continue;
    }
    if (hit(r.check)) vetCheckUp(r.f);
    else if (hit(r.treat)) vetTreat(r.f);
    else if (hit(r.jab)) {
      if (r.f.isPregnant && r.f.gender === "female") vetMidwife(r.f);
      else vetJab(r.f);
    }
    else continue;
    return true;
  }
  return true;
}

// Pop-up screen list (Screens.js)
registerScreen({
  name: "vet",
  layer: 23,
  isOpen: () => vetOpen,
  close: () => closeVet(),
  draw: (c) => drawVet(c),
  click: () => handleVetClick(),
});
