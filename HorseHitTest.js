// ---------------------------------------------------------------------------
// Clicking on fluffies: hit tests and body-position maths.
// (Part of the Horse class, split out of Horse.js: addHorseMethods adds
// these to every fluffy. Loaded right after Horse.js.)
// ---------------------------------------------------------------------------

addHorseMethods({
  // Like hitTest, but for clicks: tests against where the fluffy was drawn
  // on screen last frame. A running fluffy (especially on fast forward, when
  // the game runs several steps per frame) has already moved on from the
  // spot the player clicked; this lines the click up with what they saw.
  hitTestAsSeen(px, py) {
    if (this.hiddenBy !== null && this.hiddenBy !== undefined) return false; // (hidden by its mum: Snitch.js)
    if (
      !this.isDragging &&
      this._seenFrame !== undefined &&
      typeof renderFrameCount !== "undefined" &&
      renderFrameCount - this._seenFrame <= 1
    ) {
      const dx = this.x - this._seenX;
      const dy = this.y - this._seenY;
      if ((dx || dy) && Math.abs(dx) < 400 && Math.abs(dy) < 400) {
        const hit = this.hitTest(px + dx, py + dy);
        if (hit) return hit;
      }
    }
    const direct = this.hitTest(px, py);
    if (direct) return direct;
    // A little leeway for a moving fluffy
    if (this.isMovingOrRunning && this.isMovingOrRunning()) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const hit = this.hitTest(px + Math.cos(a) * 10, py + Math.sin(a) * 10);
        if (hit) return hit;
      }
    }
    return false;
  },

  hitTest(px, py, multiplier = this.isBeingTased && this.isBeingTased() ? CATTLE_PROD_HITBOX_MULTIPLIER : 1.0) {
    if (!this.layout) this.updateLayout();
    if (!this.layout) return false;

    // Transform px, py into local space
    // Order must be inverse of Draw: Draw = Translate * Scale * Rotate
    // Local = Rotate^-1 * Scale^-1 * Translate^-1 * World

    const dx = px - this.x,
      dy = py - this.y; // Translate^-1

    const s = this.facingRight ? this.scale : -this.scale;
    let lx = dx / s;
    let ly = dy / this.scale; // Scale^-1

    if (this.layout.globalRotation !== 0) {
      const cos = Math.cos(-this.layout.globalRotation),
        sin = Math.sin(-this.layout.globalRotation);
      const rx = lx * cos - ly * sin;
      const ry = lx * sin + ly * cos;
      lx = rx;
      ly = ry; // Rotate^-1
    }

    ly -= this.layout.bodyY;

    // Helper: check if point is in rotated rect
    const checkRect = (pointX, pointY, rect) => {
      const rdx = pointX - rect.x,
        rdy = pointY - rect.y;
      const cos = Math.cos(-rect.angle),
        sin = Math.sin(-rect.angle);
      const rx = rdx * cos - rdy * sin,
        ry = rdx * sin + rdy * cos;
      // Torso/Head pivot logic differs slightly in draw
      // Torso is drawn at -w/2, -h/2
      // Head pivot is at 0.25w, 0.85h
      let bx = -rect.w / 2,
        by = -rect.h / 2;
      if (rect === this.layout.head) {
        bx = -rect.w * 0.25;
        by = -rect.h * 0.85;
      }
      if (rect === this.layout.tail) {
        bx = -rect.w * 0.8;
        by = -rect.h * 0.1;
      }
      if (this.layout.legs.includes(rect)) {
        bx = -rect.w / 2;
        by = 0;
      }

      let buffer = 0;
      if (this.placedOn) buffer = 15;

      const diffW = rect.w * (multiplier - 1) * 0.5;
      const diffH = rect.h * (multiplier - 1) * 0.5;

      return (
        rx >= bx - buffer - diffW &&
        rx <= bx + rect.w + buffer + diffW &&
        ry >= by - buffer - diffH &&
        ry <= by + rect.h + buffer + diffH
      );
    };

    // 2. Torso (accounting for stretch)
    const torso = this.layout.torso;
    const tdx = lx - torso.x,
      tdy = ly - torso.y;
    const tcos = Math.cos(-torso.angle),
      tsin = Math.sin(-torso.angle);
    const trx = tdx * tcos - tdy * tsin,
      try_ = tdx * tsin + tdy * tcos;

    let tBuffer = 0;
    if (this.placedOn) tBuffer = 15;

    const tDiffW = torso.w * (multiplier - 1) * 0.5;
    const tDiffH = (torso.h + this.layout.stretch) * (multiplier - 1) * 0.5;

    // 1. Legs (Check front-to-back based on facingRight)
    const legOrder = this.facingRight ? [0, 1, 2, 3] : [2, 3, 0, 1];
    for (const i of legOrder) {
      if (this.limbs.legs[i] && checkRect(lx, ly, this.layout.legs[i])) {
        return `leg_${i}`;
      }
    }

    if (
      trx >= -torso.w / 2 - tBuffer - tDiffW &&
      trx <= torso.w / 2 + tBuffer + tDiffW &&
      try_ >= -torso.h / 2 - tBuffer - tDiffH &&
      try_ <= torso.h / 2 + this.layout.stretch + tBuffer + tDiffH
    ) {
      // Check Lumps
      if (this.gender === "male" && this.limbs.lumps) {
        const img = images.special_lumps;
        if (img) {
          const lx = -torso.w * 0.3;
          const ly = torso.h * 0.4 + this.layout.stretch * 0.8;
          const lDiffW = img.width * (multiplier - 1) * 0.5;
          const lDiffH = img.height * (multiplier - 1) * 0.5;
          if (
            trx >= lx - lDiffW &&
            trx <= lx + img.width + lDiffW &&
            try_ >= ly - lDiffH &&
            try_ <= ly + img.height + lDiffH
          ) {
            return "lumps";
          }
        }
      }

      // Check Wings (in torso-local space)
      if (this.layout.wing) {
        const wing = this.layout.wing;
        const wDiffW = wing.w * (multiplier - 1) * 0.5;
        const wDiffH = wing.h * (multiplier - 1) * 0.5;
        if (
          trx >= wing.x - wDiffW &&
          trx <= wing.x + wing.w + wDiffW &&
          try_ >= wing.y - wDiffH &&
          try_ <= wing.y + wing.h + wDiffH
        ) {
          const nearWingStr = this.facingRight ? "rightWing" : "leftWing";
          if (this.limbs[nearWingStr]) return nearWingStr;
        }
      }

      return "torso";
    }

    // 3. Head
    if (checkRect(lx, ly, this.layout.head)) {
      const head = this.layout.head;
      const hdx = lx - head.x,
        hdy = ly - head.y;
      const hcos = Math.cos(-head.angle),
        hsin = Math.sin(-head.angle);
      const hrx = hdx * hcos - hdy * hsin,
        hry = hdx * hsin + hdy * hcos;

      // Check Near Eye
      const nearEyeStr = this.facingRight ? "rightEye" : "leftEye";
      const eyeX = head.w * 0.45,
        eyeY = head.h * -0.325;
      if (Math.abs(hrx - eyeX) < 15 * multiplier && Math.abs(hry - eyeY) < 15 * multiplier) return nearEyeStr;

      // Check Near Ear
      const nearEarStr = this.facingRight ? "rightEar" : "leftEar";
      const earX = -head.w * 0.25 + 10,
        earY = -head.h * 0.85 + 10;
      if (Math.abs(hrx - earX) < 20 * multiplier && Math.abs(hry - earY) < 20 * multiplier) return nearEarStr;

      // Check Horn (in head-pivot-local space, relative to head pivot = hrx/hry origin)
      if (this.layout.horn && this.limbs.horn) {
        const horn = this.layout.horn;
        const hornDiffW = horn.w * (multiplier - 1) * 0.5;
        const hornDiffH = horn.h * (multiplier - 1) * 0.5;
        if (
          hrx >= horn.localX - hornDiffW &&
          hrx <= horn.localX + horn.w + hornDiffW &&
          hry >= horn.localY - hornDiffH &&
          hry <= horn.localY + horn.h + hornDiffH
        ) {
          return "horn";
        }
      }

      return "head";
    }
    // 4. Tail
    if (this.limbs.tail && checkRect(lx, ly, this.layout.tail)) return "tail";

    return null;
  },

  getTorsoOffsetFromPoint(px, py) {
    if (!this.layout) this.updateLayout();
    const dx = px - this.x;
    const dy = py - this.y;
    const s = this.facingRight ? this.scale : -this.scale;
    let lx = dx / s;
    let ly = dy / this.scale;

    const rot = (this.layout && this.layout.globalRotation) || 0;
    if (rot !== 0) {
      const cos = Math.cos(-rot);
      const sin = Math.sin(-rot);
      const rx = lx * cos - ly * sin;
      const ry = lx * sin + ly * cos;
      lx = rx;
      ly = ry;
    }

    const hasBodyY =
      !(typeof ImmobilizationBoard !== "undefined" && this.placedOn instanceof ImmobilizationBoard) &&
      !(typeof LitterpalBox !== "undefined" && this.placedOn instanceof LitterpalBox);
    const bodyY = hasBodyY && this.layout && typeof this.layout.bodyY === "number" ? this.layout.bodyY : 0;
    ly -= bodyY;

    const torso = (this.layout && this.layout.torso) || { x: 0, y: 0, angle: 0 };
    const tdx = lx - (torso.x || 0);
    const tdy = ly - (torso.y || 0);
    const torsoAngle = torso.angle || 0;
    if (torsoAngle !== 0) {
      const tcos = Math.cos(-torsoAngle);
      const tsin = Math.sin(-torsoAngle);
      return {
        x: tdx * tcos - tdy * tsin,
        y: tdx * tsin + tdy * tcos,
      };
    }
    return { x: tdx, y: tdy };
  },

  getWorldPositionFromTorsoOffset(ox, oy) {
    if (!this.layout) this.updateLayout();
    const torso = (this.layout && this.layout.torso) || { x: 0, y: 0, angle: 0 };
    const torsoAngle = torso.angle || 0;
    let tdx = ox;
    let tdy = oy;
    if (torsoAngle !== 0) {
      const tcos = Math.cos(torsoAngle);
      const tsin = Math.sin(torsoAngle);
      tdx = ox * tcos - oy * tsin;
      tdy = ox * tsin + oy * tcos;
    }

    let lx = (torso.x || 0) + tdx;
    let ly = (torso.y || 0) + tdy;

    const hasBodyY =
      !(typeof ImmobilizationBoard !== "undefined" && this.placedOn instanceof ImmobilizationBoard) &&
      !(typeof LitterpalBox !== "undefined" && this.placedOn instanceof LitterpalBox);
    const bodyY = hasBodyY && this.layout && typeof this.layout.bodyY === "number" ? this.layout.bodyY : 0;
    ly -= bodyY;

    const rot = (this.layout && this.layout.globalRotation) || 0;
    if (rot !== 0) {
      const cos = Math.cos(rot);
      const sin = Math.sin(rot);
      const rx = lx * cos - ly * sin;
      const ry = lx * sin + ly * cos;
      lx = rx;
      ly = ry;
    }

    const s = this.facingRight ? this.scale : -this.scale;
    return {
      x: this.x + lx * s,
      y: this.y + ly * this.scale,
    };
  },
});
