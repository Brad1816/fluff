// ---------------------------------------------------------------------------
// Night events in Fluffy Park: things that happen to the herds after dark.
//
// Every night (around 21:00) the park plans 0-2 events at random times before
// dawn (NIGHT_EVENT_CHANCE, SECOND_EVENT_CHANCE). When one comes due it picks
// a herd in the park (or a loose group of wild fluffies if there are no
// herds) and one of NIGHT_EVENTS, weighted by season and weather. Some are
// bad for the herd, some good:
//
//   bad:  fox (a real fox comes in and goes for the weakest - see below),
//         tummy bug, freezing night (autumn/winter), stampede, quarrel
//   good: bumper crop, newcomers join, snuggled together, lost pet (a tame,
//         good-quality fluffy wanders in - worth catching)
//
// What happened goes on the morning report ("Last night in the park",
// DayReport.js) and, if you're in the park, a message at the time.
//
// The fox (NightPredator) is really there: it creeps in from the hedge
// towards the weakest member (foals first). Fluffies it gets near wake up
// screaming and run; brave ones, the leader and the victim's mum go for it,
// and some herd-mates stand their ground. Each one makes it likelier the fox
// is driven off (see _resolve); a grown victim may also wriggle free. If
// not, it kills its target and runs. Tested over 40 visits: about half end
// in a death. Click the fox to scare it away yourself (fluffies nearby trust
// you a little more for it). Foxes aren't saved: loading a game clears them.
//
// Nothing happens while parkLife.enabled is off (the tests turn it off).
// Cheat: "night fox" (or any event id) runs one now.
// Saved: nightEvents (which night was planned, and when events are due).
// ---------------------------------------------------------------------------

const NIGHT_EVENT_CHANCE = 0.75; // chance of at least one event a night
const SECOND_EVENT_CHANCE = 0.3; // and of a second one
const NIGHT_REPORT_MAX = 5;

const FOX_STALK_SPEED = 110;
const FOX_FLEE_SPEED = 240;
const FOX_SCARE_RANGE = 260; // fluffies this close wake up and react
const FOX_GIVE_UP = 70; // seconds before a fox that can't reach anyone leaves

function freshNightEvents() {
  return { night: null, planned: [] };
}

let nightEvents = freshNightEvents();
let nightPredators = []; // not saved
const nightTicker = new Ticker(1);

function _nightIndex() {
  // Changes at noon, so one night (evening to dawn) has one index
  const t = (typeof timePlayed === "number" ? timePlayed : 0) + (START_HOUR - 12) * HOUR_LENGTH;
  return Math.floor(t / DAY_LENGTH);
}

// ---- Who an event happens to ----

function _inParkFree(f) {
  return f && f.isAlive && f.scene === PARK_SCENE && !f.isDragging && !f.currentCage && !f.placedOn;
}

function _groupLabel(g) {
  return g.herd ? `the ${getHerdName(g.herd)}` : "a group of wild fluffies";
}

// { herd, members, label } or null
function _pickNightGroup(herdId = null) {
  const herds = typeof _herdList === "function" ? _herdList() : [];
  const options = herds
    .filter((h) => herdId === null || h.id === herdId)
    .map((h) => ({ herd: h, members: getHerdMembers(h).filter(_inParkFree) }))
    .filter((g) => g.members.length >= 2);
  if (options.length) {
    const g = options[Math.floor(Math.random() * options.length)];
    g.label = _groupLabel(g);
    return g;
  }
  if (herdId !== null) return null;
  // No herds: whoever is sleeping near a random wild fluffy
  const wild = fluffies.filter((f) => _inParkFree(f) && !f.adopted);
  if (!wild.length) return null;
  const a = wild[Math.floor(Math.random() * wild.length)];
  const members = wild.filter((f) => Math.hypot(f.x - a.x, f.y - a.y) < 350);
  return { herd: null, members, label: "a group of wild fluffies" };
}

function _groupCentre(g) {
  let x = 0;
  let y = 0;
  for (const f of g.members) {
    x += f.x;
    y += f.y;
  }
  return { x: x / g.members.length, y: y / g.members.length };
}

function _groupMeadow(g) {
  if (g.herd && typeof herdTerritory === "function") {
    const idx = herdTerritory(g.herd);
    if (idx !== null) return idx;
  }
  const c = _groupCentre(g);
  let best = 0;
  let bestD = Infinity;
  PARK_MEADOWS.forEach((m, i) => {
    const d = Math.hypot(m.x - c.x, m.y - c.y);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

function _adults(g) {
  return g.members.filter((f) => f.growth >= 1);
}

function _nightSay(f, keys, target = null) {
  if (f && f.isAlive && !f.tooYoungToSpeak() && f.currentStateKey !== "SLEEPING") f.speak(getDialogue(keys, f, target));
}

function _plural(n, one, many = one + "s") {
  return `${n} ${n === 1 ? one : many}`;
}

function _hurt(f, amount, cause) {
  if (!f) return;
  f.health = Math.max(0, (f.health ?? 100) - amount);
  if (f.health <= 0 && f.isAlive) f.anatomy.die(null, cause);
}

// ---- The events ----

function _seasonW(table) {
  const s = typeof getSeason === "function" ? getSeason() : "Spring";
  return table[s] ?? 1;
}

const NIGHT_EVENTS = [
  // ---- Bad ----
  {
    id: "fox",
    good: false,
    weight: () => _seasonW({ Spring: 2, Summer: 2, Autumn: 3, Winter: 4 }),
    run(g) {
      const victim = _pickFoxTarget(g.members);
      if (!victim) return null;
      spawnNightPredator(victim, g);
      return ""; // reported when it's over (NightPredator._finish)
    },
  },
  {
    id: "sickness",
    good: false,
    weight: () =>
      _seasonW({ Spring: 1.5, Summer: 1, Autumn: 2, Winter: 2.5 }) +
      (typeof rainAmount === "function" && rainAmount() > 0.3 ? 1 : 0),
    run(g) {
      const pool = g.members.slice().sort(() => Math.random() - 0.5);
      const ill = pool.slice(0, Math.min(pool.length, 2 + Math.floor(Math.random() * 3)));
      for (const f of ill) {
        f.health = Math.max(3, (f.health ?? 100) - (20 + Math.random() * 20));
        f.changeHappiness(-0.06);
        f.isDiarrhea = true;
        f.expressionOverride = "MISERABLE";
        f.expressionOverrideTimer = 6;
        // It's Fluffy flu, and it spreads (Illness.js)
        if (typeof catchFlu === "function") catchFlu(f, FLU_HIDDEN);
        _nightSay(f, ["NIGHT", "SICK"]);
      }
      return `Fluffy flu went round ${g.label}: ${_plural(ill.length, "fluffy is", "fluffies are")} poorly.`;
    },
  },
  {
    id: "cold",
    good: false,
    weight: () => {
      // Cold is simulated all the time now (Warmth.js): no one-off cold nights
      if (typeof updateWarmth === "function") return 0;
      const snowing = typeof snowAmount === "function" && snowAmount() > 0.3;
      return _seasonW({ Spring: 0, Summer: 0, Autumn: 1, Winter: 3 }) + (snowing ? 2 : 0);
    },
    run(g) {
      let suffered = 0;
      let froze = 0;
      for (const f of g.members) {
        if (typeof parkShelterNear === "function" && parkShelterNear(f.x, f.y)) continue;
        suffered++;
        f.hunger = Math.max(0, f.hunger - 0.15);
        f.changeHappiness(-0.05);
        _hurt(f, f.growth < 0.5 ? 25 + Math.random() * 20 : 8, "Froze to death");
        if (!f.isAlive) froze++;
        else _nightSay(f, ["NIGHT", "COLD"]);
      }
      if (!suffered) return `A freezing night, but ${g.label} sheltered under the trees.`;
      return froze
        ? `A freezing night: ${_plural(froze, "fluffy")} from ${g.label} froze to death.`
        : `A freezing night: ${g.label} got cold and hungry out in the open.`;
    },
  },
  {
    id: "stampede",
    good: false,
    weight: () => 1.5 + (typeof isStorming === "function" && isStorming() ? 2 : 0),
    run(g) {
      const idx = _groupMeadow(g);
      const m = PARK_MEADOWS[idx];
      let trampled = 0;
      for (const t of _meadowTufts(m)) {
        if (t.growth > 0.2) trampled++;
        t.growth = Math.min(t.growth, 0.1);
      }
      for (const f of g.members) {
        if (f.growth < 0.3) continue;
        const p = {
          x: Math.max(80, Math.min(PARK_W - 80, f.x + (Math.random() - 0.5) * 900)),
          y: Math.max(PARK_TOP + 80, Math.min(PARK_H - 80, f.y + (Math.random() - 0.5) * 600)),
        };
        f.isScared = true;
        f.scaredTimer = 4;
        f.initBehavior("MOVING");
        f.setTargetPosition(p.x, p.y);
        f.currentStateKey = "RUNNING";
        f.changeHappiness(-0.03);
        _nightSay(f, ["NIGHT", "STAMPEDE"]);
      }
      const why = typeof isStorming === "function" && isStorming() ? "Thunder" : "Something in the dark";
      return `${why} spooked ${g.label}: they stampeded${trampled ? ` and trampled ${meadowName(idx)}` : ""}.`;
    },
  },
  {
    id: "quarrel",
    good: false,
    weight: (g) => (_adults(g).length >= 3 ? 1.5 : 0),
    run(g) {
      const adults = _adults(g).sort(() => Math.random() - 0.5);
      if (adults.length < 2) return null;
      const leader = g.herd ? fluffyById(g.herd.leaderId) : null;
      let a = adults[0];
      let b = adults[1];
      if (leader && adults.includes(leader) && Math.random() < 0.4) {
        a = adults.find((f) => f !== leader);
        b = leader;
      }
      changeOpinion(a, b, -0.5, "fought in the night");
      changeOpinion(b, a, -0.5, "fought in the night");
      for (const f of [a, b]) {
        _hurt(f, 8, "Killed in a fight");
        f.changeHappiness(-0.05);
      }
      _nightSay(a, ["NIGHT", "QUARREL"], b);
      if (g.herd && b === leader && Math.random() < 0.5) {
        g.herd.leaderId = a.id;
        if (typeof _herdChanged === "function") _herdChanged();
        return `${fluffyDisplayName(a)} fought ${fluffyDisplayName(b)} for the lead of ${g.label}, and won.`;
      }
      return `${fluffyDisplayName(a)} and ${fluffyDisplayName(b)} of ${g.label} fell out in the night.`;
    },
  },
  // ---- Good ----
  {
    id: "bumper",
    good: true,
    weight: () => _seasonW({ Spring: 2.5, Summer: 2, Autumn: 3, Winter: 0.3 }),
    run(g) {
      const idx = _groupMeadow(g);
      const m = PARK_MEADOWS[idx];
      const tufts = _meadowTufts(m);
      for (const t of tufts) t.growth = Math.max(t.growth, 2);
      for (let i = tufts.length; i < MEADOW_MAX_TUFTS + 3; i++) {
        const p = _randomPointInMeadow(m);
        objects.push(new Grass(p.x, p.y, PARK_SCENE, 2));
      }
      for (const o of objects) {
        if (o instanceof BerryBush && o.scene === PARK_SCENE && Math.hypot(o.x - m.x, o.y - m.y) < m.rx + 350)
          o.growth = BERRY_MAX;
      }
      return `${meadowName(idx)} had a bumper crop overnight: plenty for ${g.label}.`;
    },
  },
  {
    id: "newcomers",
    good: true,
    weight: () =>
      typeof countParkWild === "function" && countParkWild() >= PARK_WILD_MAX
        ? 0
        : _seasonW({ Spring: 2.5, Summer: 2, Autumn: 1.5, Winter: 0.5 }),
    run(g) {
      const c = _groupCentre(g);
      const group = spawnParkGroup(Math.random() < 0.5 ? "friends" : "single_mom", c);
      if (g.herd) {
        for (const f of group) if (!g.herd.memberIds.includes(f.id)) g.herd.memberIds.push(f.id);
        if (typeof _herdChanged === "function") _herdChanged();
      }
      for (const f of group)
        for (const o of g.members) {
          changeOpinion(f, o, 0.5, "took us in");
          changeOpinion(o, f, 0.4, "joined us");
        }
      _nightSay(group[0], ["NIGHT", "NEWCOMER"]);
      if (typeof noteDayEvent === "function") noteDayEvent("wildArrived", { count: group.length });
      return `${_plural(group.length, "newcomer")} found ${g.label} in the night and ${group.length === 1 ? "was" : "were"} taken in.`;
    },
  },
  {
    id: "snuggle",
    good: true,
    weight: () => _seasonW({ Spring: 2.5, Summer: 2, Autumn: 2.5, Winter: 3 }),
    run(g) {
      for (const f of g.members) {
        f.changeHappiness(0.08);
        f.health = Math.min(100, (f.health ?? 100) + 15);
        for (const o of g.members) if (o !== f) changeOpinion(f, o, 0.08, "snuggled together");
      }
      return `${g.label} slept snuggled together: happier, healthier and closer.`;
    },
  },
  {
    id: "lost_pet",
    good: true,
    weight: () => 0.6,
    run(g) {
      const c = _groupCentre(g);
      const pet = _makeWild(1, c, { bq: 0.7 + Math.random() * 0.3, mq: 0.7 + Math.random() * 0.3 });
      pet.personalities = pet.personalities.filter((p) => p !== "true_feral");
      pet.playerTrust = 0.65 + Math.random() * 0.15;
      pet.playerFear = 0.02;
      pet.lostPet = true;
      if (typeof giveOwnerName === "function") giveOwnerName(pet); // its owner's name (Names.js)
      _nightSay(pet, ["NIGHT", "LOST_PET"]);
      if (typeof noteDayEvent === "function") noteDayEvent("wildArrived", { count: 1 });
      return `A lost pet (a ${describeFluffyLooks(pet)}) wandered into the park near ${g.label}. It isn't afraid of people.`;
    },
  },
];

function _eventById(id) {
  return NIGHT_EVENTS.find((e) => e.id === id) || null;
}

// Something happened: morning report + a message if you're watching
function _recordNight(good, text) {
  if (!text) return;
  text = text.charAt(0).toUpperCase() + text.slice(1);
  if (typeof dayStats !== "undefined" && dayStats) {
    if (!Array.isArray(dayStats.nightEvents)) dayStats.nightEvents = [];
    dayStats.nightEvents.push({ good, text });
    if (dayStats.nightEvents.length > NIGHT_REPORT_MAX) dayStats.nightEvents.shift();
  }
  if (currentScene === PARK_SCENE && typeof addUIMessage === "function") addUIMessage(text);
}

// Run one event now. id: event id or null (random by weight).
// herdId: that herd, or null (random). Returns the event's text ("" = the
// fox, reported later) or null if nothing could happen.
function runNightEvent(id = null, herdId = null, used = []) {
  const g = _pickNightGroup(herdId);
  if (!g) return null;
  let ev = id ? _eventById(id) : null;
  if (!ev) {
    const choices = NIGHT_EVENTS.filter((e) => !used.includes(e.id))
      .map((e) => ({ e, w: Math.max(0, e.weight(g)) }))
      .filter((c) => c.w > 0);
    const total = choices.reduce((s, c) => s + c.w, 0);
    if (!total) return null;
    let r = Math.random() * total;
    for (const c of choices) {
      r -= c.w;
      if (r <= 0) {
        ev = c.e;
        break;
      }
    }
    ev = ev || choices[choices.length - 1].e;
  }
  const text = ev.run(g);
  if (text === null) return null;
  used.push(ev.id);
  if (text) _recordNight(ev.good, text);
  return text;
}

// ---- The fox ----

function _pickFoxTarget(members) {
  const pool = members.filter(_inParkFree);
  if (!pool.length) return null;
  const weakness = (f) =>
    (1 - Math.min(1, f.growth)) * 2 + (1 - (f.health ?? 100) / 100) + (f.tooYoungToWalk() ? 1 : 0) + Math.random() * 0.6;
  return pool.sort((a, b) => weakness(b) - weakness(a))[0];
}

function _brave(f) {
  const tv = typeof traitValue === "function" ? traitValue(f, "bravery") : 0;
  return f.growth >= 1 && (tv > 0.3 || (herdOf(f) && herdOf(f).leaderId === f.id));
}

class NightPredator {
  constructor(victim, group) {
    const edge = _parkEdgeSpot();
    this.x = edge.x;
    this.y = edge.y;
    this.scene = PARK_SCENE;
    this.victimId = victim.id;
    this.herdId = group.herd ? group.herd.id : null;
    this.label = group.label;
    this.state = "stalk"; // stalk -> attack -> flee
    this.timer = 0;
    this.age = 0;
    this.facingRight = victim.x > this.x;
    this.step = 0;
    this.done = false;
    this.alerted = new Set();
    this.roles = new Map(); // id -> "hero" | "helper"
  }

  victim() {
    return fluffyById(this.victimId) || null;
  }

  update(dt) {
    this.age += dt;
    if (this.state === "flee") {
      this._moveTo(this.fleeX, this.fleeY, FOX_FLEE_SPEED, dt);
      if (Math.hypot(this.fleeX - this.x, this.fleeY - this.y) < 20) this.done = true;
      return;
    }
    const v = this.victim();
    if (!v || !_inParkFree(v) || this.age > FOX_GIVE_UP) {
      // Lost its chance: slink off
      this._flee();
      this._finish(true, `A fox prowled around ${this.label} but left empty-handed.`);
      return;
    }
    this._alarm();
    if (this.state === "stalk") {
      this._moveTo(v.x, v.y + 10, FOX_STALK_SPEED, dt);
      if (Math.hypot(v.x - this.x, v.y + 10 - this.y) < 34) {
        this.state = "attack";
        this.timer = 1.2;
        v.isScared = true;
        v.scaredTimer = 3;
        v.initBehavior("IDLE");
        v.expressionOverride = "CRYING_SHOCKED";
        v.expressionOverrideTimer = 3;
        v.speech.nextTime = 0;
        _nightSay(v, ["PREDATOR", "CAUGHT"]);
      }
    } else if (this.state === "attack") {
      // Hold the victim in place while it struggles
      this.x += (v.x - this.x) * Math.min(1, dt * 8);
      this.timer -= dt;
      if (this.timer <= 0) this._resolve(v);
    }
  }

  _moveTo(tx, ty, speed, dt) {
    const dx = tx - this.x;
    const dy = ty - this.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return;
    const s = Math.min(d, speed * dt);
    this.x += (dx / d) * s;
    this.y += (dy / d) * s;
    this.facingRight = dx > 0;
    this.step += s * 0.08;
  }

  // Fluffies nearby wake up. The brave, the leader and the victim's mum
  // go for the fox ("hero"); some of its herd-mates and family stand their
  // ground ("helper"); everyone else runs.
  _alarm() {
    const v = this.victim();
    const vHerd = v ? herdOf(v) : null;
    for (const f of fluffies) {
      if (!f.isAlive || f.scene !== PARK_SCENE || this.alerted.has(f.id)) continue;
      if (f.isDragging || f.currentCage || f.id === this.victimId) continue;
      if (Math.hypot(f.x - this.x, f.y - this.y) > FOX_SCARE_RANGE) continue;
      this.alerted.add(f.id);
      f.speech.nextTime = 0;
      if (f.tooYoungToWalk() || f.growth < 1) {
        if (f.tooYoungToWalk()) {
          f.expressionOverride = "CRYING_SHOCKED";
          f.expressionOverrideTimer = 4;
        } else f.actionHandler.executeRunawayFear(this, ["PREDATOR", "FLEE"]);
        continue;
      }
      const mum = v && v.motherId === f.id;
      const kin = v && ((vHerd && herdOf(f) === vHerd) || (relationships[f.id] && relationships[f.id][v.id]));
      if (_brave(f) || mum) this.roles.set(f.id, "hero");
      else if (kin && Math.random() < 0.5) this.roles.set(f.id, "helper");
      if (this.roles.has(f.id)) {
        f.isScared = false;
        f.initBehavior("MOVING");
        f.setTargetPosition(v ? v.x : this.x, v ? v.y : this.y);
        f.currentStateKey = "RUNNING";
        _nightSay(f, ["PREDATOR", "DEFEND"]);
      } else {
        f.actionHandler.executeRunawayFear(this, ["PREDATOR", "FLEE"]);
      }
    }
  }

  _resolve(v) {
    // Those who stood up to it and are close enough: heroes count fully,
    // helpers a bit
    const close = (f) => f && f.isAlive && !f.isDragging && f.scene === PARK_SCENE && Math.hypot(f.x - v.x, f.y - v.y) < 350;
    const heroes = [];
    const helpers = [];
    for (const [id, role] of this.roles) {
      const f = fluffyById(id);
      if (!close(f)) continue;
      (role === "hero" ? heroes : helpers).push(f);
    }
    // (and a whole herd screaming puts it off a bit too)
    const driveOff = Math.min(0.75, 0.25 * heroes.length + 0.12 * helpers.length + 0.02 * this.alerted.size);
    // Grown fluffies can sometimes wriggle free
    const escape = v.growth >= 1 ? 0.35 : v.growth >= 0.5 ? 0.25 : 0;
    const roll = Math.random();
    if (roll < driveOff) {
      const pool = heroes.length ? heroes : helpers;
      // (nobody stood up to it: the herd's screaming alone put it off)
      const hero = pool.length ? pool[Math.floor(Math.random() * pool.length)] : null;
      if (hero) {
        _hurt(hero, 15, "Killed by a fox");
        _nightSay(hero, ["PREDATOR", "CHASED_OFF"]);
      }
      v.changeHappiness(-0.05);
      this._flee();
      this._finish(true, hero ? `A fox went for ${fluffyDisplayName(v)}, but ${fluffyDisplayName(hero)} of ${this.label} drove it off.` : `A fox went for ${fluffyDisplayName(v)}, but the screaming from ${this.label} put it off.`);
      return;
    }
    if (roll < driveOff + (1 - driveOff) * escape) {
      _hurt(v, 20, "Killed by a fox");
      v.changeHappiness(-0.08);
      if (v.isAlive) {
        v.actionHandler.executeRunawayFear(this, ["PREDATOR", "FLEE"]);
        this._flee();
        this._finish(true, `A fox caught ${fluffyDisplayName(v)} of ${this.label}, but it wriggled free and got away.`);
        return;
      }
    }
    v.anatomy.die(null, "Killed by a fox");
    if (typeof addPointToPuddle === "function") addPointToPuddle(PARK_SCENE, v.x, v.y + 30, "#8a0303", 0.08, 0.05);
    for (const f of fluffies) {
      if (!f.isAlive || f.scene !== PARK_SCENE || Math.hypot(f.x - v.x, f.y - v.y) > 400) continue;
      f.changeHappiness(this.herdId !== null && herdOf(f) && herdOf(f).id === this.herdId ? -0.1 : -0.04);
      f.setShock(2);
    }
    this._flee();
    this._finish(false, `A fox came in the night and killed ${fluffyDisplayName(v)} of ${this.label}.`);
  }

  _flee() {
    if (this.state === "flee") return;
    this.state = "flee";
    const p = _parkEdgeSpot();
    // Out through the nearest hedge
    const sides = [
      { x: this.x, y: PARK_TOP + 20 },
      { x: this.x, y: PARK_H - 20 },
      { x: 20, y: this.y },
      { x: PARK_W - 20, y: this.y },
    ];
    sides.sort((a, b) => Math.hypot(a.x - this.x, a.y - this.y) - Math.hypot(b.x - this.x, b.y - this.y));
    this.fleeX = sides[0].x || p.x;
    this.fleeY = sides[0].y || p.y;
  }

  _finish(good, text) {
    if (this.reported) return;
    this.reported = true;
    _recordNight(good, text);
  }

  // Click on the fox: it runs
  scareOff() {
    if (this.state === "flee") return false;
    const v = this.victim();
    this._flee();
    for (const f of fluffies) {
      if (!f.isAlive || f.scene !== PARK_SCENE || Math.hypot(f.x - this.x, f.y - this.y) > 350) continue;
      if (typeof f.playerTrust === "number") f.playerTrust = Math.min(1, f.playerTrust + 0.05);
    }
    this._finish(true, `You chased off a fox before it could hurt ${v ? fluffyDisplayName(v) : "anyone"}.`);
    return true;
  }

  hitTest(x, y) {
    return Math.abs(x - this.x) < 50 && y > this.y - 45 && y < this.y + 20;
  }

  draw(c) {
    const dir = this.facingRight ? 1 : -1;
    const legSwing = this.state === "attack" ? 0 : Math.sin(this.step) * 7;
    c.save();
    c.translate(this.x, this.y);
    c.scale(dir, 1);
    // Shadow
    c.fillStyle = "rgba(0,0,0,0.25)";
    c.beginPath();
    c.ellipse(0, 14, 40, 8, 0, 0, Math.PI * 2);
    c.fill();
    // Tail
    c.fillStyle = "#a9471a";
    c.beginPath();
    c.ellipse(-44, -18, 26, 10, -0.35 + Math.sin(this.age * 6) * 0.1, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#f3eee6";
    c.beginPath();
    c.ellipse(-64, -10, 8, 6, -0.35, 0, Math.PI * 2);
    c.fill();
    // Legs
    c.strokeStyle = "#3a2216";
    c.lineWidth = 5;
    c.lineCap = "round";
    for (const [lx, sw] of [[-18, legSwing], [-8, -legSwing], [14, -legSwing], [24, legSwing]]) {
      c.beginPath();
      c.moveTo(lx, -8);
      c.lineTo(lx + sw, 12);
      c.stroke();
    }
    // Body
    c.fillStyle = "#b8521c";
    c.beginPath();
    c.ellipse(0, -16, 32, 14, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#e8dccb";
    c.beginPath();
    c.ellipse(8, -8, 16, 6, 0, 0, Math.PI * 2);
    c.fill();
    // Head
    c.fillStyle = "#b8521c";
    c.beginPath();
    c.moveTo(24, -30);
    c.lineTo(58, -18);
    c.lineTo(28, -12);
    c.closePath();
    c.fill();
    c.beginPath();
    c.arc(30, -24, 11, 0, Math.PI * 2);
    c.fill();
    // Ears
    c.beginPath();
    c.moveTo(24, -30);
    c.lineTo(26, -46);
    c.lineTo(33, -32);
    c.moveTo(31, -32);
    c.lineTo(37, -45);
    c.lineTo(40, -29);
    c.fill();
    // Nose
    c.fillStyle = "#1a1a1a";
    c.beginPath();
    c.arc(57, -18, 2.5, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }

  // Eyes shine in the dark (drawn over the night sky)
  drawEyes(c) {
    const dir = this.facingRight ? 1 : -1;
    const ex = this.x + dir * 36;
    const ey = this.y - 26;
    const glow = 0.6 + 0.4 * (typeof nightAmount === "function" ? nightAmount() : 1);
    c.save();
    c.fillStyle = `rgba(255, 236, 120, ${glow})`;
    c.shadowColor = "rgba(255, 230, 100, 0.9)";
    c.shadowBlur = 8;
    c.beginPath();
    c.arc(ex, ey, 2.6, 0, Math.PI * 2);
    c.arc(ex + dir * 7, ey + 1, 2.3, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}

function spawnNightPredator(victim, group) {
  const p = new NightPredator(victim, group);
  nightPredators.push(p);
  return p;
}

// ---- Every step (script.js updateSimulation) ----

function updateNightEvents(dt) {
  for (const p of nightPredators) p.update(dt);
  if (nightPredators.some((p) => p.done)) nightPredators = nightPredators.filter((p) => !p.done);

  if (!nightEvents || typeof nightEvents !== "object") nightEvents = freshNightEvents();
  if (!Array.isArray(nightEvents.planned)) nightEvents.planned = [];
  if (nightEvents.night === undefined) nightEvents.night = null;

  if (!nightTicker.step(dt)) return; // every 1s (Systems.js)
  if (typeof parkLife === "undefined" || !parkLife.enabled) return;

  const now = timePlayed;
  const hour = gameHour();
  const index = _nightIndex();
  // Plan tonight's events once it's dark
  if (nightEvents.night !== index && (hour >= 21 || hour < 3)) {
    nightEvents.night = index;
    nightEvents.planned = [];
    const hoursLeft = hour >= 12 ? 28.5 - hour : 4.5 - hour;
    let n = Math.random() < NIGHT_EVENT_CHANCE ? 1 : 0;
    if (n && Math.random() < SECOND_EVENT_CHANCE) n++;
    for (let i = 0; i < n && hoursLeft > 0.6; i++)
      nightEvents.planned.push({ at: now + (0.3 + Math.random() * (hoursLeft - 0.3)) * HOUR_LENGTH });
    nightEvents.planned.sort((a, b) => a.at - b.at);
    nightEvents.used = [];
  }
  while (nightEvents.planned.length && nightEvents.planned[0].at <= now) {
    nightEvents.planned.shift();
    if (!Array.isArray(nightEvents.used)) nightEvents.used = [];
    runNightEvent(null, null, nightEvents.used);
  }
}

// ---- Drawing and clicking ----

// World pass, in the park (script.js render)
function drawNightPredators(c) {
  for (const p of nightPredators) if (p.scene === currentScene) p.draw(c);
}

// After the night sky is drawn: glowing eyes (screen pass with the camera)
function drawNightPredatorEyes(c, cam) {
  if (!nightPredators.length || currentScene !== PARK_SCENE) return;
  c.save();
  c.translate(-Math.round(cam.x), -Math.round(cam.y));
  for (const p of nightPredators) p.drawEyes(c);
  c.restore();
}

// Mouse down in world positions (UI.js): click a fox to scare it off
function handleNightPredatorClick() {
  if (currentScene !== PARK_SCENE) return false;
  for (const p of nightPredators) {
    if (p.state !== "flee" && p.hitTest(mouse.x, mouse.y)) return p.scareOff();
  }
  return false;
}

function resetNightPredators() {
  nightPredators = [];
}

// Runs every simulation step (Systems.js)
registerSystem("nightEvents", updateNightEvents, 110);
