// ---------------------------------------------------------------------------
// Family and breeding (new features, #7).
//
// How related two fluffies are (relatedness): the share of genes they have
// in common by descent, from the family records (FamilyTree.js), counting
// back KIN_GENERATIONS generations: parent and foal or full siblings 50%,
// half-siblings, grandparents, aunts and uncles 25%, cousins 12.5%...
//
// Fluffies don't breed with close family (KIN_CLOSE and up: parents,
// foals, brothers and sisters, half-siblings, grandparents, aunts and
// uncles) - unless:
//   - you make them (the spray bottle, thumbtack or stick), or
//   - something's wrong with the one doing it (notRightInTheHead): a
//     Smarty, a Broken fluffy, one that's killed another fluffy, one with
//     toxoplasmosis in its brain, or one on an aphrodisiac. Two consenting
//     fluffies both have to be like that; forcing it, only the one forcing.
// They won't become special friends with close family either.
// Cousins can still pair up, but the vet warns you.
//
// The vet's breeding advice (Vet.js) and the Gene Lab use pairAdvice: how
// related, the chance each foal is born alive (the same gene check as
// triggerPregnancy), whether they'd mate on their own, and a verdict.
// ---------------------------------------------------------------------------

const KIN_GENERATIONS = 6;
const KIN_CLOSE = 0.25;
const KIN_NOTE = 0.1; // cousins and closer: worth a mention

// ---- Relatedness ----

function _kinParents(id) {
  const rec = typeof getFamilyRecord === "function" ? getFamilyRecord(id) : null;
  let m = rec ? rec.motherId : null;
  let d = rec ? rec.fatherId : null;
  // A fluffy that's here knows its own parents even without a record
  if ((m === null || m === undefined || d === null || d === undefined) && typeof fluffies !== "undefined") {
    const f = fluffies.find((x) => x.id === id);
    if (f) {
      if (m === null || m === undefined) m = f.motherId;
      if (d === null || d === undefined) d = f.fatherId;
    }
  }
  const ok = (x) => x !== null && x !== undefined && x !== id;
  return [ok(m) ? m : null, ok(d) ? d : null];
}

// Kinship coefficient (the chance a gene picked from each is the same by
// descent); relatedness is twice this. The later-born one (bigger id) is
// the one traced back, so ancestors are never traced through descendants.
function _kinship(a, b, depth, memo) {
  if (a === null || b === null || depth <= 0) return 0;
  const key = a < b ? `${a}:${b}:${depth}` : `${b}:${a}:${depth}`;
  if (memo.has(key)) return memo.get(key);
  let v;
  if (a === b) {
    const [m, d] = _kinParents(a);
    v = 0.5 * (1 + _kinship(m, d, depth - 1, memo));
  } else {
    const [young, old] = a > b ? [a, b] : [b, a];
    const [m, d] = _kinParents(young);
    v = 0.5 * (_kinship(m, old, depth - 1, memo) + _kinship(d, old, depth - 1, memo));
  }
  memo.set(key, v);
  return v;
}

function relatedness(a, b) {
  const ia = a && typeof a === "object" ? a.id : a;
  const ib = b && typeof b === "object" ? b.id : b;
  if (ia === null || ia === undefined || ib === null || ib === undefined || ia === ib) return ia === ib && ia !== undefined ? 1 : 0;
  return Math.min(1, 2 * _kinship(ia, ib, KIN_GENERATIONS * 2, new Map()));
}

function isCloseKin(a, b) {
  return relatedness(a, b) >= KIN_CLOSE - 1e-9;
}

// In words: "half-siblings (25% related)"
function describeKinship(a, b) {
  const r = relatedness(a, b);
  if (r < 0.05) return null;
  const rel = typeof describeFamilyRelation === "function" ? describeFamilyRelation(a.id ?? a, b.id ?? b) : null;
  const pct = Math.round(r * 1000) / 10;
  return `${rel || "family"} (${pct}% related)`;
}

// ---- Something wrong with it ----

// Why it doesn't care that they're family, or null
function notRightInTheHead(f) {
  if (!f) return null;
  if (typeof f.isSmarty === "function" && f.isSmarty()) return "a Smarty";
  if (typeof f.isUnderAphrodisiac === "function" && f.isUnderAphrodisiac()) return "drugged";
  if (typeof titleOf === "function" && titleOf(f) === "Broken") return "Broken";
  if ((f.hasKilled || 0) > 0) return "a killer";
  if (f.isToxoplasmosis) return "toxoplasmosis has got to its brain";
  return null;
}

// HorseMating.mateWith: would it stop because they're family?
function kinBlocksMating(initiator, receiver, maleForced = false, femaleForced = false) {
  if (!initiator || !receiver || maleForced) return false; // you made them
  if (!isCloseKin(initiator, receiver)) return false;
  if (femaleForced) return !notRightInTheHead(initiator);
  return !(notRightInTheHead(initiator) && notRightInTheHead(receiver));
}

// Special friendships (HorseActionHandler): not with close family
function kinBlocksRomance(a, b) {
  return isCloseKin(a, b) && !(notRightInTheHead(a) && notRightInTheHead(b));
}

// ---- Advice ----

function _kinViability(mom, dad) {
  if (typeof geneLabViability === "function" && mom.genes && dad.genes) return geneLabViability(mom.genes, dad.genes);
  return 1;
}

// { r, relation, alive, willMate, why, verdict, tone, score }
function pairAdvice(a, b) {
  const mom = a.gender === "female" ? a : b;
  const dad = mom === a ? b : a;
  const r = relatedness(a, b);
  const relation = r >= 0.05 ? describeKinship(a, b) : null;
  const alive = _kinViability(mom, dad);
  let willMate = true;
  let why = "";
  if (kinBlocksMating(dad, mom) && kinBlocksMating(mom, dad)) {
    willMate = false;
    why = "family: they won't";
  } else if (typeof isSexuallyAttractedTo === "function" && (!isSexuallyAttractedTo(dad, mom) || !isSexuallyAttractedTo(mom, dad))) {
    willMate = false;
    why = "not interested in each other";
  }
  let verdict;
  let tone;
  if (r >= KIN_CLOSE) {
    verdict = "Too closely related";
    tone = "bad";
  } else if (alive < 0.6) {
    verdict = "Poor: many foals won't survive";
    tone = "bad";
  } else if (r >= KIN_NOTE || alive < 0.85) {
    verdict = r >= KIN_NOTE ? "Fair: they're cousins" : "Fair";
    tone = "ok";
  } else {
    verdict = "Good match";
    tone = "good";
  }
  const score = alive - 2 * r - (willMate ? 0 : 0.3);
  return { r, relation, alive, willMate, why, verdict, tone, score };
}

// The best partners for a fluffy among yours: [{ f, advice }]
function bestMatches(f, n = 3) {
  if (!f || typeof fluffies === "undefined") return [];
  const other = f.gender === "female" ? "male" : "female";
  return fluffies
    .filter((o) => o !== f && o.isAlive && o.adopted && o.gender === other && o.growth >= 1)
    .map((o) => ({ f: o, advice: pairAdvice(f, o) }))
    .filter((x) => x.advice.r < KIN_CLOSE)
    .sort((x, y) => y.advice.score - x.advice.score)
    .slice(0, n);
}
