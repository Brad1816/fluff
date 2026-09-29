// ---------------------------------------------------------------------------
// Breeding stock market: buy pedigree fluffies from other breeders.
//
// Where: the "Breeding stock" tab of the orders screen (the Bounty Board on
// Shopping Street, or FluffList on the Computer - OrderBoard.js).
//
// Every morning (a new report day, DayReport.js) the market restocks with a
// few listings from STOCK_BREEDERS. Each breeder has a line they breed for
// (spots, stripes, white coats, wings, horns, pastel colours, or cheap
// hardy earthies). A listing is a real fluffy's genes with a real pedigree: four
// grandparents (made for the breeder's line), two parents bred from them and
// the fluffy bred from its parents - so it can carry genes it doesn't show
// (hidden wings, a spotted grandma...). The card shows its looks and its
// parents' and grandparents' looks, so you can guess what it carries; after
// buying, the family tree's genetics panel and the Gene Lab show the rest.
//
// Your reputation (Orders.js getOrderLevel) decides what's on offer:
//   level 1   earthies only, 3 listings
//   level 2   unicorns and pegasi too, 4 listings
//   level 3   5 listings
//   level 4   6 listings, and sometimes (STOCK_ALICORN_CHANCE) an alicorn
//   level 5   better quality all round
// Prices are STOCK_MARKUP x what the fluffy would fetch from a buyer (plus a
// pedigree fee), so buying to sell on never pays; you buy to breed.
//
// Bought fluffies arrive indoors with the name their breeder gave them
// (you can rename them), raised well (happy, trusting, partly litter
// trained). Their parents and grandparents go in the family record book as
// "With its breeder".
// Saved: stockMarket (listings and when they were stocked).
// ---------------------------------------------------------------------------

const STOCK_MARKUP = 2.2;
const STOCK_PEDIGREE_FEE = 150;
const STOCK_ALICORN_CHANCE = 0.12; // per morning, from level 4
const STOCK_ARRIVE_SCENE = "INDOORS";

const STOCK_BREEDERS = [
  { name: "Rosewood Fluffies", line: "pastel", about: "pretty pastel coats" },
  { name: "Meadowbrook Stud", line: "spots", about: "spotted coats" },
  { name: "Stripes & Co.", line: "stripes", about: "striped coats" },
  { name: "Snowdrop Stud", line: "white", about: "pale and white coats" },
  { name: "Starfall Kennels", line: "wings", about: "pegasi", minLevel: 2 },
  { name: "Silverhorn Farm", line: "horn", about: "unicorns", minLevel: 2 },
  { name: "Old Barn Breeders", line: "hardy", about: "hardy, cheap earthies" },
  { name: "Prism Stables", line: "mane", about: "fancy manes: streaked, tipped, even rainbow", minLevel: 3 }, // ManePatterns.js
];
const STOCK_ALICORN_BREEDER = { name: "Celestial Stud", line: "alicorn", about: "alicorns (very rare)" };

const STOCK_NAMES = [
  "Clover", "Daisy", "Button", "Biscuit", "Honey", "Pebble", "Maple", "Willow", "Juniper", "Poppy",
  "Bramble", "Toffee", "Sprout", "Peaches", "Marigold", "Thistle", "Nutmeg", "Bluebell", "Hazel", "Cocoa",
  "Pippin", "Saffron", "Tansy", "Fennel", "Sorrel", "Buttercup", "Primrose", "Barley", "Wren", "Sable",
];

function freshStockMarket() {
  return { day: null, listings: [], nextId: 1, bought: 0 };
}

let stockMarket = freshStockMarket();
const stockTicker = new Ticker(1);
let _stockPortraits = {};

// ---- Genes ----

function _stockGenetics(genes = null) {
  return new HorseGenetics({ genes });
}

function _stockRandomGenes(q) {
  return _stockGenetics().generateRandomGenes(q, q);
}

function _setBits(genes, from, count, on) {
  const bits = Array.from({ length: count }, (_, i) => (i < on ? 1 : 0)).sort(() => Math.random() - 0.5);
  for (let i = 0; i < count; i++) genes[from + i] = bits[i];
}

// What the genes show: "earthy" | "unicorn" | "pegasus" | "alicorn"
function stockTypeOfGenes(genes) {
  const wings = genes.slice(53, 58).reduce((s, g) => s + g, 0) >= 4;
  const horn = genes.slice(58, 63).reduce((s, g) => s + g, 0) >= 4;
  return wings && horn ? "alicorn" : wings ? "pegasus" : horn ? "unicorn" : "earthy";
}

// ["spotted", "striped"] that the genes show (two-tone is left out: most
// fluffies have it, so it tells you nothing)
function stockVisibleFeatures(genes) {
  const d = typeof describeGenes === "function" ? describeGenes(genes) : null;
  if (!d) return [];
  const out = [];
  if (d.spots >= 4) out.push("spotted");
  if (d.stripes >= 4) out.push("striped");
  if (d.manePattern) out.push(d.manePattern.kind === "rainbow" ? "rainbow mane" : `${d.manePattern.kind} mane`);
  return out;
}

// A grandparent made for a breeder's line. strong = shows it; otherwise
// it carries it.
function _lineGrandparent(line, strong, quality) {
  const g = _stockRandomGenes(line === "pastel" ? Math.max(quality, 0.9) : line === "hardy" ? quality * 0.6 : quality);
  const carry = strong ? 4 : 2 + Math.floor(Math.random() * 2);
  if (line === "spots") _setBits(g, 79, 4, carry);
  // Fancy manes (ManePatterns.js): a style, sometimes rainbow
  if (line === "mane" && typeof MANE_GENE_START === "number") {
    _setBits(g, MANE_GENE_START, 4, strong ? 4 : 3); // a specialist: carriers carry a lot
    g[MANE_GENE_START + 4] = Math.floor(Math.random() * 3);
    const rainbow = Math.random() < 0.35;
    g[MANE_GENE_START + 5] = rainbow ? 1 : g[MANE_GENE_START + 5];
    g[MANE_GENE_START + 6] = rainbow ? 1 : g[MANE_GENE_START + 6];
  }
  if (line === "stripes") _setBits(g, 87, 4, carry);
  if (line === "white") {
    // Body colour genes nearly all on (white is all 24 on)
    for (const start of [0, 8, 16]) _setBits(g, start, 8, strong ? 8 : 6 + Math.floor(Math.random() * 2));
  }
  if (line === "wings" || line === "alicorn") _setBits(g, 53, 5, strong ? 5 : 3);
  if (line === "horn" || line === "alicorn") _setBits(g, 58, 5, strong ? 5 : 3);
  if (line === "hardy") {
    _setBits(g, 53, 5, Math.floor(Math.random() * 4));
    _setBits(g, 58, 5, Math.floor(Math.random() * 4));
  }
  return g;
}

function _breed(mumGenes, dadGenes) {
  return _stockGenetics(mumGenes).combineGenes(dadGenes);
}

function _allowedTypes(level) {
  const t = ["earthy"];
  if (level >= 2) t.push("unicorn", "pegasus");
  return t;
}

function _sensitive(genes) {
  // Two or more matching "sensitive baby" gene pairs make one likely: skip
  return [65, 67, 69].filter((i) => genes[i] === genes[i + 1]).length >= 3;
}

// One listing (or null if nothing fitting came out)
function makeStockListing(level = 1, breeder = null, taken = []) {
  const choices = STOCK_BREEDERS.filter((b) => (b.minLevel || 1) <= level);
  breeder = breeder || choices[Math.floor(Math.random() * choices.length)];
  const allowed = breeder.line === "alicorn" ? ["alicorn"] : _allowedTypes(level);
  const quality = level >= 5 ? 0.85 : 0.65 + level * 0.04;
  for (let tries = 0; tries < 40; tries++) {
    // Grandparents: two show the line, two carry it
    const gp = [0, 1, 2, 3].map((i) => _lineGrandparent(breeder.line, i % 2 === 0, quality + Math.random() * 0.1));
    const mumGenes = _breed(gp[0], gp[1]);
    const dadGenes = _breed(gp[2], gp[3]);
    const genes = _breed(mumGenes, dadGenes);
    if (breeder.line === "alicorn") {
      _setBits(genes, 53, 5, 5);
      _setBits(genes, 58, 5, 5);
    }
    const type = stockTypeOfGenes(genes);
    if (!allowed.includes(type) || _sensitive(genes)) continue;
    // Parents and grandparents can be any type (a pegasus dad can have an
    // earthy foal); at low levels they just don't sell those
    // (no two listings with the same name, and none named like one of yours)
    const used = new Set([...taken, ...Object.values(typeof fluffyNames !== "undefined" ? fluffyNames : {})]);
    const fresh = STOCK_NAMES.filter((n) => !used.has(n));
    const names = (fresh.length ? fresh : STOCK_NAMES).slice().sort(() => Math.random() - 0.5);
    while (names.length < 7) names.push(...STOCK_NAMES);
    const person = (g, gender, i) => ({ name: `${breeder.name.split(" ")[0]} ${names[i]}`, gender, genes: g, type: stockTypeOfGenes(g) });
    const gender = Math.random() < 0.5 ? "female" : "male";
    const growth = Math.random() < 0.8 ? 1 : 0.6 + Math.random() * 0.3;
    const listing = {
      id: stockMarket.nextId++,
      breeder: breeder.name,
      line: breeder.line,
      about: breeder.about,
      name: names[6],
      gender,
      growth,
      genes,
      type,
      pottyTraining: +(0.2 + Math.random() * 0.6).toFixed(2),
      mum: person(mumGenes, "female", 0),
      dad: person(dadGenes, "male", 1),
      grand: [person(gp[0], "female", 2), person(gp[1], "male", 3), person(gp[2], "female", 4), person(gp[3], "male", 5)],
    };
    listing.price = stockListingPrice(listing);
    return listing;
  }
  return null;
}

// A fluffy for looking at (portraits, prices) - not in the game
function stockDisplayFluffy(listing) {
  const h = new Horse(listing.growth, null, STOCK_ARRIVE_SCENE, "earthy", listing.genes.slice(), null, null, listing.gender);
  if (typeof relationships !== "undefined") delete relationships[h.id];
  _raisedByBreeder(h, listing);
  return h;
}

function _raisedByBreeder(h, listing) {
  h.happiness = 0.8;
  h.hunger = 1;
  h.playerTrust = 0.6;
  h.playerFear = 0;
  h.pottyTraining = listing.pottyTraining || 0;
  h.sensitiveBaby = false;
}

function stockListingPrice(listing) {
  const h = stockDisplayFluffy(listing);
  return Math.round((h.calculatePrice() * STOCK_MARKUP + STOCK_PEDIGREE_FEE) / 10) * 10;
}

// ---- Restocking ----

function restockMarket(level = typeof getOrderLevel === "function" ? getOrderLevel() : 1) {
  const count = Math.min(6, 2 + level);
  const list = [];
  if (level >= 4 && Math.random() < STOCK_ALICORN_CHANCE) {
    const a = makeStockListing(level, STOCK_ALICORN_BREEDER, list.map((x) => x.name));
    if (a) list.push(a);
  }
  for (let i = 0; list.length < count && i < count * 3; i++) {
    const l = makeStockListing(level, null, list.map((x) => x.name));
    if (l) list.push(l);
  }
  stockMarket.listings = list;
  _stockPortraits = {};
}

// script.js updateSimulation: restock each morning (works once a second)
function updateStockMarket(dt) {
  if (!stockMarket || typeof stockMarket !== "object") stockMarket = freshStockMarket();
  for (const [k, v] of Object.entries(freshStockMarket())) if (stockMarket[k] === undefined) stockMarket[k] = v;
  if (!Array.isArray(stockMarket.listings)) stockMarket.listings = [];
  if (!stockTicker.step(dt)) return; // every 1s (Systems.js)
  const day = typeof reportDayIndex === "function" ? reportDayIndex() : 0;
  if (stockMarket.day !== day) {
    stockMarket.day = day;
    restockMarket();
  }
}

// ---- Buying ----

function _ancestorRecord(p, motherId = null, fatherId = null) {
  const id = nextFluffyId++;
  fluffyRecords[id] = {
    id,
    name: p.name,
    gender: p.gender,
    type: p.type,
    genes: p.genes.slice(),
    growth: 1,
    motherId,
    fatherId,
    fosterMotherId: null,
    bornAt: null,
    status: "breeder",
    causeOfDeath: null,
    pottyTraining: 0,
    personalities: [],
  };
  return id;
}

// Returns the new fluffy, or null (can't afford / gone)
function buyStockListing(listingId) {
  const idx = stockMarket.listings.findIndex((l) => l.id === listingId);
  if (idx < 0) return null;
  const l = stockMarket.listings[idx];
  const free = typeof showDebugMenu !== "undefined" && showDebugMenu;
  if (!free && money < l.price) {
    if (typeof addUIMessage === "function") addUIMessage(`You need $${l.price.toLocaleString()} for ${l.name}.`);
    return null;
  }
  if (!free) money -= l.price;
  stockMarket.listings.splice(idx, 1);
  stockMarket.bought = (stockMarket.bought || 0) + 1;

  const f = new Horse(l.growth, null, STOCK_ARRIVE_SCENE, "earthy", l.genes.slice(), null, null, l.gender);
  _raisedByBreeder(f, l);
  if (typeof setSpawnAge === "function") setSpawnAge(f, 2, 10); // young stock (Aging.js)
  f.adopted = true;
  f.x = sceneW(STOCK_ARRIVE_SCENE) * (0.35 + Math.random() * 0.3);
  f.y = height * 0.7;
  fluffies.push(f);
  fluffyNames[f.id] = l.name; // named by its breeder
  // (remember it, so the "name a fluffy" goal waits for a name you give)
  if (!stockMarket.named || typeof stockMarket.named !== "object") stockMarket.named = {};
  stockMarket.named[f.id] = l.name;
  if (typeof poofs !== "undefined" && typeof Poof !== "undefined") poofs.push(new Poof(f.x, f.y, f.scene));

  // Pedigree in the family record book
  if (typeof recordFluffy === "function") {
    const g = l.grand.map((p) => _ancestorRecord(p));
    const mumId = _ancestorRecord(l.mum, g[0], g[1]);
    const dadId = _ancestorRecord(l.dad, g[2], g[3]);
    const rec = recordFluffy(f);
    rec.motherId = mumId;
    rec.fatherId = dadId;
    rec.boughtFrom = l.breeder;
    rec.bornAt = null; // born at the breeder's
  }
  const text = `${l.name} arrived from ${l.breeder} ($${l.price.toLocaleString()}).`;
  if (typeof addUIMessage === "function") addUIMessage(text);
  if (typeof noteDayEvent === "function") noteDayEvent("news", { text: `You bought ${l.name} from ${l.breeder}.` });
  _stockPortraits = {};
  return f;
}

// ---- The market page (drawn inside the orders screen, OrderBoard.js) ----

function _stockPortrait(l, size) {
  const key = l.id + ":" + size;
  if (_stockPortraits[key] === undefined) {
    _stockPortraits[key] = typeof drawFluffyPortraitCanvas === "function" ? drawFluffyPortraitCanvas(stockDisplayFluffy(l), size) : null;
  }
  return _stockPortraits[key];
}

function _isWhite(genes) {
  return typeof describeRecordCoat === "function" && describeRecordCoat({ genes }).name === "wite";
}

function _looksOf(p) {
  const rec = { genes: p.genes, type: p.type, gender: p.gender, growth: p.growth ?? 1 };
  const base = typeof describeRecordLooks === "function" ? describeRecordLooks(rec) : p.type;
  const extra = stockVisibleFeatures(p.genes);
  return extra.length ? `${base}, ${extra.join(", ")}` : base;
}

// "2 spotted, 1 pegasus" for the grandparents
function _grandSummary(grand) {
  const counts = {};
  for (const p of grand) {
    for (const f of stockVisibleFeatures(p.genes)) counts[f] = (counts[f] || 0) + 1;
    if (_isWhite(p.genes)) counts.white = (counts.white || 0) + 1;
    if (p.type !== "earthy") counts[p.type] = (counts[p.type] || 0) + 1;
  }
  const parts = Object.entries(counts).map(([k, n]) => `${n} ${k}`);
  return parts.length ? parts.join(", ") : "all plain earthies";
}

function stockMarketLayout() {
  return stockMarket.listings.slice(0, 6).map((l, i) => {
    const x = 20 + (i % 3) * 380;
    const y = 112 + Math.floor(i / 3) * 272;
    return { l, x, y, w: 365, h: 260, buy: { x: x + 365 - 104, y: y + 260 - 42, w: 92, h: 32, label: "Buy" } };
  });
}

function drawStockMarketPage(c, theme, m) {
  const headColor = ordersScreenMode === "board" ? "#fbe7b5" : theme.cardText;
  const level = typeof getOrderLevel === "function" ? getOrderLevel() : 1;
  _osText(c, `Breeding stock (${stockMarket.listings.length})`, 20, 100, headColor, "bold 17px Arial");
  const unlock =
    level < 2
      ? "Reach Known breeder for unicorns and pegasi"
      : level < 4
        ? "Reach Renowned breeder for more stock (and the odd alicorn)"
        : "New stock every morning";
  _osText(c, `Pedigree fluffies from other breeders · ${unlock}`, OS_W - 20, 100, headColor, "13px Arial", "right");
  if (!stockMarket.listings.length)
    _osText(c, "Sold out. The breeders bring new stock every morning.", 20, 140, headColor, "14px Arial");

  for (const card of stockMarketLayout()) {
    const l = card.l;
    c.fillStyle = "rgba(0,0,0,0.25)";
    _osRR(c, card.x + 3, card.y + 4, card.w, card.h, 8);
    c.fill();
    c.fillStyle = theme.card;
    _osRR(c, card.x, card.y, card.w, card.h, 8);
    c.fill();
    const p = _stockPortrait(l, 120);
    if (p) c.drawImage(p, card.x + 8, card.y + 8);
    const tx = card.x + 138;
    const age = l.growth >= 1 ? "adult" : "young";
    _osText(c, l.name, tx, card.y + 30, theme.cardText, "bold 18px Arial");
    _osText(c, `${l.gender === "male" ? "♂ stallion" : "♀ mare"} · ${l.type} · ${age}`, tx, card.y + 50, theme.cardText, "13px Arial");
    const coat = typeof describeRecordCoat === "function" ? describeRecordCoat({ genes: l.genes }).name : "";
    const colour = (typeof COLOUR_WORDS !== "undefined" && COLOUR_WORDS[coat]) || coat;
    _osText(c, [`${colour} coat`, ...stockVisibleFeatures(l.genes)].join(", "), tx, card.y + 68, theme.sub, "13px Arial");
    _osText(c, `Bred by ${l.breeder}`, tx, card.y + 90, theme.sub, "italic 12px Arial");
    _osText(c, `(known for ${l.about})`, tx, card.y + 106, theme.sub, "italic 12px Arial");
    _osText(c, `Litter trained ${Math.round((l.pottyTraining || 0) * 100)}%`, tx, card.y + 124, theme.sub, "12px Arial");

    let y = card.y + 150;
    _osText(c, "Pedigree", card.x + 14, y, theme.cardText, "bold 13px Arial");
    y += 18;
    c.save();
    c.beginPath();
    c.rect(card.x + 10, card.y, card.w - 20, card.h);
    c.clip();
    _osText(c, `Mum: ${_looksOf(l.mum)}`, card.x + 14, y, theme.cardText, "12px Arial");
    y += 16;
    _osText(c, `Dad: ${_looksOf(l.dad)}`, card.x + 14, y, theme.cardText, "12px Arial");
    y += 16;
    _osText(c, `Grandparents: ${_grandSummary(l.grand)}`, card.x + 14, y, theme.cardText, "12px Arial");
    c.restore();

    const afford = (typeof showDebugMenu !== "undefined" && showDebugMenu) || money >= l.price;
    _osText(c, `$${l.price.toLocaleString()}`, card.x + 14, card.y + card.h - 18, afford ? "#1e8a3a" : "#c0392b", "bold 22px Arial");
    _osButton(c, card.buy, m, theme, !afford);
  }
  _osText(
    c,
    `Bought ${stockMarket.bought || 0} · Prices are about ${STOCK_MARKUP}x what a buyer would pay: you buy stock to breed from, not to sell on.`,
    OS_W / 2,
    OS_H - 14,
    headColor,
    "12px Arial",
    "center",
  );
}

// Click on the market page (orders screen positions). True if used.
function handleStockMarketClick(m) {
  for (const card of stockMarketLayout()) {
    if (_osIn(m, card.buy)) {
      buyStockListing(card.l.id);
      return true;
    }
  }
  return false;
}

// Runs every simulation step (Systems.js)
registerSystem("stockMarket", updateStockMarket, 180);
