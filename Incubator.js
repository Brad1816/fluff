// ---------------------------------------------------------------------------
// The incubator (Pharmacy & Lab, $350): a warm glass box for a frail foal
// born early (Premature.js). Drop up to INCUBATOR_MAX foals still on milk
// into it; anything bigger, or a third foal, is put down beside it, and a
// foal that grows too big for it climbs out (Premature.js).
// Inside: kept warm, tube-fed (it never goes hungry), and it gets over its
// frailty twice as fast. Its mum comes to the glass now and then (or carry
// her there): left too long without her, she may not know it after
// (Premature.js). It runs off the mains - no power (in debt, the
// power's cut: Pressure.js) and it's just a box. No modes, and a foal
// doesn't mind being in it.
// The picture is drawn here (makeIncubatorImage).
// ---------------------------------------------------------------------------

const INCUBATOR_MAX = 2;
const INCUBATOR_MAX_GROWTH = 0.36; // foals still on milk

function makeIncubatorImage() {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas");
  cv.width = 150;
  cv.height = 110;
  const c = cv.getContext("2d");
  const round = (x, y, w, h, r) => {
    c.beginPath();
    if (c.roundRect) c.roundRect(x, y, w, h, r);
    else c.rect(x, y, w, h);
  };
  // Base
  round(4, 80, 142, 26, 8);
  c.fillStyle = "#e9edf1";
  c.fill();
  c.strokeStyle = "#5b6670";
  c.lineWidth = 2.5;
  c.stroke();
  // Little control panel
  round(14, 86, 34, 14, 3);
  c.fillStyle = "#24343c";
  c.fill();
  c.fillStyle = "#7dffb0";
  c.font = "bold 9px monospace";
  c.fillText("37.0", 17, 97);
  c.fillStyle = "#f2b33d";
  c.beginPath();
  c.arc(126, 93, 4, 0, Math.PI * 2);
  c.fill();
  // A little mattress
  round(18, 77, 114, 5, 2);
  c.fillStyle = "#cfe3f4";
  c.fill();
  // Glass dome
  c.beginPath();
  c.moveTo(10, 82);
  c.lineTo(10, 30);
  c.quadraticCurveTo(10, 8, 40, 8);
  c.lineTo(110, 8);
  c.quadraticCurveTo(140, 8, 140, 30);
  c.lineTo(140, 82);
  c.closePath();
  c.fillStyle = "rgba(190, 230, 245, 0.28)";
  c.fill();
  c.strokeStyle = "rgba(90, 130, 150, 0.9)";
  c.lineWidth = 2.5;
  c.stroke();
  // Warm lamp glow at the top
  const g = c.createRadialGradient(75, 14, 2, 75, 30, 60);
  g.addColorStop(0, "rgba(255, 190, 90, 0.55)");
  g.addColorStop(1, "rgba(255, 190, 90, 0)");
  c.fillStyle = g;
  c.fillRect(12, 10, 126, 70);
  round(60, 4, 30, 8, 3);
  c.fillStyle = "#f5a742";
  c.fill();
  // Shine on the glass
  c.strokeStyle = "rgba(255, 255, 255, 0.55)";
  c.lineWidth = 3;
  c.beginPath();
  c.moveTo(22, 70);
  c.quadraticCurveTo(20, 24, 44, 16);
  c.stroke();
  // Hand ports
  c.strokeStyle = "rgba(90, 130, 150, 0.8)";
  c.lineWidth = 2;
  for (const x of [38, 112]) {
    c.beginPath();
    c.arc(x, 56, 9, 0, Math.PI * 2);
    c.stroke();
  }
  return cv;
}

function incubatorImage() {
  if (typeof images !== "undefined" && !images.incubator) {
    const img = makeIncubatorImage();
    if (img) images.incubator = img;
  }
  return typeof images !== "undefined" ? images.incubator : null;
}

class Incubator extends Cage {
  getImage() {
    return incubatorImage();
  }

  causesUnhappiness() {
    return false;
  }

  getSellValue() {
    return 175;
  }

  cycleTag() {
    // (no modes)
  }

  // Foals lie on the mattress, above the base (Horse.js cage containment)
  floorOffset() {
    return 32 * this.scale;
  }

  // Only foals still on milk, and only INCUBATOR_MAX of them
  accepts(item) {
    if (!(item instanceof Horse) || !(item.growth < INCUBATOR_MAX_GROWTH)) return false;
    const inside = fluffies.filter((f) => f !== item && f.currentCage === this);
    return inside.length < INCUBATOR_MAX;
  }

  // Warm and running (no power, no warmth)
  isRunning() {
    return !(typeof powerCut === "function" && powerCut());
  }
}

// ---- Mum comes to see her foal (Premature.js: or she may forget it) ----
const INCUBATOR_MUM_CHANCE = 0.35; // a game hour, once it's been a while (more for a gentle mum)
const INCUBATOR_MUM_STAY = 12; // game seconds by the glass
const incubatorVisitTicker = new Ticker(3);

function _mumBusy(m) {
  return m.currentStateKey === "SLEEPING" || m.isDragging || m.currentCage || m.placedOn || m.isFallingFromThrow || m._fostering || m._perch || m._bolt || m.trickNow || m.timeOut || (typeof m.isInLabor === "function" && m.isInLabor());
}

function updateIncubatorVisits(dt) {
  if (typeof fluffies === "undefined") return;
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  // On her way, or by the glass
  for (const m of fluffies) {
    const v = m._incVisit;
    if (!v) continue;
    const inc = typeof objects !== "undefined" ? objects.find((o) => o.id === v.id) : null;
    if (!inc || !m.isAlive || inc.scene !== m.scene || _mumBusy(m) || now - v.at > 60) {
      m._incVisit = null;
      continue;
    }
    const tx = inc.x + (m.x < inc.x ? -95 : 95);
    const ty = inc.y + 30;
    if (Math.hypot(m.x - tx, m.y - ty) > 40 && !v.arrived) {
      if (!m.isMovingOrRunning()) m.initBehavior("MOVING");
      m.setTargetPosition(tx, ty);
      continue;
    }
    if (!v.arrived) {
      v.arrived = now;
      m.initBehavior("IDLE");
      m.facingRight = inc.x > m.x;
    }
    if (now - v.arrived > INCUBATOR_MUM_STAY) m._incVisit = null;
  }
  const step = incubatorVisitTicker.step(dt);
  if (!step) return;
  for (const f of fluffies) {
    if (!f.isAlive || !(f.currentCage instanceof Incubator) || (f.incubatorAlone || 0) < 2 * HOUR_LENGTH) continue;
    const mum = typeof incubatorMum === "function" ? incubatorMum(f) : null;
    if (!mum || mum._incVisit || mum.scene !== f.scene || _mumBusy(mum) || mum.happiness <= WAN_DIE_THRESHOLD) continue;
    const gentle = typeof traitValue === "function" && traitValue(mum, "temper") <= -0.25;
    const perHour = INCUBATOR_MUM_CHANCE * (gentle ? 1.7 : 1);
    if (Math.random() < 1 - Math.pow(1 - perHour, step / HOUR_LENGTH)) mum._incVisit = { id: f.currentCage.id, at: now };
  }
}
if (typeof registerSystem === "function") registerSystem("incubatorVisits", updateIncubatorVisits, 65);

// Make the picture as soon as the page is up, for the shop shelf
if (typeof window !== "undefined" && window.addEventListener) window.addEventListener("load", () => incubatorImage());
