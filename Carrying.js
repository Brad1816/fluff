// ---------------------------------------------------------------------------
// Mums carry their newborns on their backs.
//
// A newborn can't get about by itself until it can crawl, about a week and
// a half after it's born (FOAL_CRAWL_AT growth: GROW_UP_TIME is about two
// months). Till then it rides on its mum's back (updateRiding, from
// Horse.update): she comes and gets it when it's left behind (HorseFamily
// tooFarFromBaby: a newborn not on her back is a foal that needs her), it
// climbs on when she's beside it, and it goes where she goes. Up to
// RIDE_MAX of a litter fit on her back; the rest wriggle along after her.
// Off her back (picked up, an orphan, or she's asleep, hurt or penned
// apart) a newborn can only wriggle (FOAL_WRIGGLE_SPEED). It crawls from
// FOAL_CRAWL_AT and walks at WALKY_THRESHOLD, as before.
// Not saved: it climbs back on as soon as it can after a load.
// ---------------------------------------------------------------------------

const FOAL_CRAWL_AT = 0.17; // growth (about 1.5 weeks old)
const FOAL_WRIGGLE_SPEED = 22; // px a second, a newborn off its mum's back
const RIDE_REACH = 70; // px: close enough to climb on
const RIDE_MAX = 4; // on one mum's back at once

function cantCrawlYet(f) {
  return !!(f && f.isAlive && f.growth < FOAL_CRAWL_AT && !(f.isSensitive && f.isSensitive()));
}

// Its mum, if she can carry it right now
function rideMumFor(f) {
  if (f.motherId === null || f.motherId === undefined || typeof fluffies === "undefined") return null;
  const mum = f._riding && f._riding.id === f.motherId ? f._riding : fluffies.find((m) => m.id === f.motherId);
  if (!mum || !mum.isAlive || mum.scene !== f.scene || mum.growth < 1) return null;
  if (typeof relationships === "undefined" || !relationships[mum.id] || relationships[mum.id][f.id] !== "baby_child") return null;
  if (mum.isDragging || f.isDragging || mum.placedOn || f.placedOn || mum.currentCage !== f.currentCage) return null;
  if (mum.currentStateKey === "SLEEPING" || mum.isCrawling || !mum.isAlive) return null;
  return mum;
}

// Who's on her back, in order
function ridersOf(mum) {
  return fluffies.filter((f) => f._riding === mum && f.isAlive).sort((a, b) => a.id - b.id);
}

function _dismount(f) {
  const mum = f._riding;
  f._riding = null;
  if (mum && !f.isDragging) {
    // Down beside her (on the ground, not in the air)
    f.y = mum.y + 6;
    f.x = mum.x + (mum.facingRight ? -1 : 1) * 30;
  }
}

// Horse.update, after it's moved: on (or off) its mum's back
function updateRiding(f) {
  if (!cantCrawlYet(f)) {
    if (f._riding) _dismount(f);
    return;
  }
  const mum = rideMumFor(f);
  if (!mum) {
    if (f._riding) _dismount(f);
    return;
  }
  if (f._riding !== mum) {
    if (Math.hypot(mum.x - f.x, mum.y - f.y) > RIDE_REACH) return;
    if (ridersOf(mum).length >= RIDE_MAX) return;
    f._riding = mum;
  }
  // Sit it on her back
  const riders = ridersOf(mum);
  const i = Math.max(0, riders.indexOf(f));
  const lay = mum.layout;
  const tW = lay && lay.torso ? lay.torso.w : 60;
  const tH = lay && lay.torso ? lay.torso.h : 40;
  const bodyY = lay ? lay.bodyY || 0 : 0;
  const s = mum.scale || 1;
  const dir = mum.facingRight ? 1 : -1;
  const backTop = mum.y + s * (bodyY - tH / 2) + 6;
  const spread = (i - (riders.length - 1) / 2) * tW * 0.22 * s;
  f.facingRight = mum.facingRight;
  f.x = mum.x - dir * tW * 0.08 * s + spread;
  // Its feet on her back
  const feet = f.layout ? Math.max(0, f.getBottomYStanding() - f.y) : 10;
  f.y = backTop - feet;
  f.vx = 0;
  f.vy = 0;
  if (typeof f.setTargetPosition === "function" && (f.currentStateKey === "MOVING" || f.currentStateKey === "RUNNING")) f.initBehavior("IDLE");
  f.targetX = f.x;
  f.targetY = f.y;
}

// Draw order: just in front of her (Horse.getBottomY)
function riderBottomY(f) {
  const mum = f._riding;
  if (!mum || !mum.isAlive) return null;
  return mum.getBottomY() + 0.5 + (f.id % 10) * 0.01;
}
