// ---------------------------------------------------------------------------
// Fancy manes: most fluffies have a plain one-colour mane, but a few have a
// patterned one (the tail matches):
//   streaked  locks of a second colour through the mane
//   tipped    the ends dyed a second colour
//   rainbow   bands of every colour (very rare)
//
// Genes (after the personality trait genes, from MANE_GENE_START):
//   +0..+3  fancy mane: shows with all 4 (like spots), so about 1 in 16
//           random fluffies have one; two fancy parents always pass it on
//   +4      style: 0 streaked, 1 tipped, 2 rainbow...
//   +5..+6  ...but rainbow needs both of these too (else it's streaked):
//           about 1 in 200 random fluffies
//   +7..+9  the second colour (R, G, B 0-255)
//   +10     where the streaks fall (seed)
// Older fluffies have none of these genes: plain manes (ensureManeGenes).
//
// Used by: HorseGenetics (making, inheriting, reading genes; price via
// calculateColorMultiplier), HorseRenderer (drawing, paintManePattern),
// the magnifying glass, family tree gene table, Gene Lab and the stock
// market's Prism Stables.
// ---------------------------------------------------------------------------

const MANE_GENE_START = 128; // right after the trait genes (Traits.js TRAIT_GENE_TOTAL)
const MANE_GENE_COUNT = 11;
const MANE_GENE_TOTAL = MANE_GENE_START + MANE_GENE_COUNT;
const MANE_PRICE = { streaked: 1.3, tipped: 1.3, rainbow: 2.0 };

// ---- Genes ----

// Random fancy-mane genes for a new random fluffy
function randomManeGenes(genes) {
  if (!Array.isArray(genes)) return genes;
  while (genes.length < MANE_GENE_START) genes.push(Math.random() < 0.5 ? 0 : 1);
  const s = MANE_GENE_START;
  for (let i = 0; i < 4; i++) genes[s + i] = Math.random() < 0.5 ? 0 : 1;
  genes[s + 4] = Math.floor(Math.random() * 3);
  genes[s + 5] = Math.random() < 0.5 ? 0 : 1;
  genes[s + 6] = Math.random() < 0.5 ? 0 : 1;
  for (let i = 7; i <= 9; i++) genes[s + i] = Math.floor(Math.random() * 256);
  genes[s + 10] = Math.floor(Math.random() * 256);
  return genes;
}

// Older fluffies (no mane genes yet): a plain mane, but everything else
// filled in so their foals can mix it
function ensureManeGenes(genes) {
  if (!Array.isArray(genes) || genes.length < MANE_GENE_START || genes.length >= MANE_GENE_TOTAL) return genes;
  const s = MANE_GENE_START;
  while (genes.length < MANE_GENE_TOTAL) {
    const i = genes.length - s;
    genes.push(i < 4 || i === 5 || i === 6 ? 0 : i === 4 ? Math.floor(Math.random() * 3) : Math.floor(Math.random() * 256));
  }
  return genes;
}

// HorseGenetics.combineGenes: each mane gene from mum or dad
function inheritManeGenes(baby, mumGenes, dadGenes) {
  const mum = ensureManeGenes(Array.isArray(mumGenes) ? mumGenes.slice() : []);
  const dad = ensureManeGenes(Array.isArray(dadGenes) ? dadGenes.slice() : []);
  while (baby.length < MANE_GENE_START) baby.push(Math.random() < 0.5 ? 0 : 1);
  for (let i = MANE_GENE_START; i < MANE_GENE_TOTAL; i++) {
    const a = mum[i];
    const b = dad[i];
    let g = Math.random() < 0.5 ? a : b;
    if (g === undefined) g = a !== undefined ? a : b;
    if (g === undefined) g = 0;
    baby[i] = g;
  }
  return baby;
}

// null (plain) or { kind, color, seed }
function manePatternOfGenes(genes) {
  if (!Array.isArray(genes) || genes.length < MANE_GENE_TOTAL) return null;
  const s = MANE_GENE_START;
  if (genes[s] + genes[s + 1] + genes[s + 2] + genes[s + 3] < 4) return null;
  const style = genes[s + 4];
  let kind = "streaked";
  if (style === 1) kind = "tipped";
  else if (style === 2 && genes[s + 5] && genes[s + 6]) kind = "rainbow";
  return { kind, color: `rgb(${genes[s + 7]}, ${genes[s + 8]}, ${genes[s + 9]})`, seed: genes[s + 10] || 0 };
}

// How many of the 4 fancy-mane genes (0..4), for the family tree / Gene Lab
function maneFancyGeneCount(genes) {
  if (!Array.isArray(genes) || genes.length < MANE_GENE_TOTAL) return 0;
  const s = MANE_GENE_START;
  return (genes[s] ? 1 : 0) + (genes[s + 1] ? 1 : 0) + (genes[s + 2] ? 1 : 0) + (genes[s + 3] ? 1 : 0);
}

// HorseGenetics.calculateColorMultiplier: a fancy mane is worth more
function manePatternPriceMultiplier(f) {
  const p = f && f.manePattern;
  return p ? MANE_PRICE[p.kind] || 1 : 1;
}

function _maneColourName(rgb) {
  try {
    return HorseGenetics.prototype.getColorName.call({ horse: { colors: { body: rgb } } });
  } catch (e) {
    return "";
  }
}

// Magnifying glass: null or "Streaked (pink streaks)"
function describeManePattern(f) {
  const p = f && f.manePattern;
  if (!p) return null;
  const name = _maneColourName(p.color);
  if (p.kind === "rainbow") return "Rainbow (very rare)";
  if (p.kind === "tipped") return `Tipped${name ? ` (${name} tips)` : ""}`;
  return `Streaked${name ? ` (${name} streaks)` : ""}`;
}

// ---- Drawing ----

// Where an image's hair actually is (the pictures have empty space)
const _maneBoxCache = new Map();
function _maneBox(img) {
  const key = img.src || img;
  if (_maneBoxCache.has(key)) return _maneBoxCache.get(key);
  let box = { x: 0, y: 0, w: img.width, h: img.height };
  try {
    const c = document.createElement("canvas");
    c.width = img.width;
    c.height = img.height;
    const cx = c.getContext("2d");
    cx.drawImage(img, 0, 0);
    const data = cx.getImageData(0, 0, c.width, c.height).data;
    let x0 = c.width;
    let y0 = c.height;
    let x1 = 0;
    let y1 = 0;
    for (let y = 0; y < c.height; y++)
      for (let x = 0; x < c.width; x++)
        if (data[(y * c.width + x) * 4 + 3] > 20) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
    if (x1 > x0 && y1 > y0) box = { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  } catch (e) {
    // (tainted canvas etc.: use the whole picture)
  }
  _maneBoxCache.set(key, box);
  return box;
}

// Paint the pattern onto an already tinted mane/tail (HorseRenderer).
// secondColor: the pattern colour (greyed with age by the caller)
function paintManePattern(tinted, img, pattern, secondColor) {
  if (!tinted || !img || !pattern || !img.width) return tinted;
  const w = img.width;
  const h = img.height;
  // The second colour, shaded like the mane
  const alt = document.createElement("canvas");
  alt.width = w;
  alt.height = h;
  const a = alt.getContext("2d");
  a.drawImage(img, 0, 0);
  a.globalCompositeOperation = "multiply";
  const box = _maneBox(img);
  const rand = makeSeededRandom((pattern.seed || 0) + 7);
  if (pattern.kind === "rainbow") {
    const start = rand() * 360;
    const g = a.createLinearGradient(box.x + box.w, box.y, box.x, box.y + box.h);
    for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, `hsl(${Math.round(start + i * 52) % 360}, 85%, 62%)`);
    a.fillStyle = g;
  } else a.fillStyle = secondColor || pattern.color;
  a.fillRect(0, 0, w, h);
  a.globalCompositeOperation = "destination-in";
  a.drawImage(img, 0, 0);

  // Where it shows
  const mask = document.createElement("canvas");
  mask.width = w;
  mask.height = h;
  const m = mask.getContext("2d");
  if (pattern.kind === "rainbow") {
    m.fillStyle = "rgba(0,0,0,0.85)";
    m.fillRect(0, 0, w, h);
  } else if (pattern.kind === "tipped") {
    const g = m.createLinearGradient(0, box.y + box.h * 0.45, 0, box.y + box.h * 0.72);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,1)");
    m.fillStyle = g;
    m.fillRect(0, 0, w, h);
  } else {
    // Streaks: slanted locks
    m.fillStyle = "#000";
    const n = 3 + Math.floor(rand() * 3);
    for (let i = 0; i < n; i++) {
      const x0 = box.x + box.w * ((i + 0.2 + rand() * 0.6) / n);
      const sw = box.w * (0.05 + rand() * 0.05);
      const lean = box.h * (0.25 + rand() * 0.2);
      m.beginPath();
      m.moveTo(x0, box.y - 2);
      m.lineTo(x0 + sw, box.y - 2);
      m.lineTo(x0 + sw - lean, box.y + box.h + 2);
      m.lineTo(x0 - lean, box.y + box.h + 2);
      m.closePath();
      m.fill();
    }
  }
  a.globalCompositeOperation = "destination-in";
  a.drawImage(mask, 0, 0);
  const t = tinted.getContext ? tinted.getContext("2d") : null;
  if (!t) return tinted;
  t.save();
  t.globalCompositeOperation = "source-atop";
  t.drawImage(alt, 0, 0);
  t.restore();
  return tinted;
}
