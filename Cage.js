class Cage {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.scale = 1.0;
    this.bounds = { left: 0, right: 0, top: 0, bottom: 0 };
    this.x = width / 2;
    this.y = height / 2;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.tag = "none"; // "none", "breeding", "sell", "eject", "cull"

    // Cull animation state
    this.cullPhase = null; // null, "extending", "sealed", "retracting"
    this.cullTimer = 0;
    this.cullSmokeTimer = 0;
    this.cullSpeechTimer = 0;
    this.cullSilenced = false;
    this.cullKilled = false;
    this.glassProgress = 0; // 0 = retracted, 1 = fully extended
    this.wasDragging = false;
    this.pressPos = { x: 0, y: 0 };
  }

  getImage() {
    return images.cage;
  }

  // A plain cage is drawn a bit wider than its picture (CAGE_WIDEN: room
  // to turn round); enclosures and incubators keep their shape
  widen() {
    return this.constructor === Cage ? CAGE_WIDEN : 1;
  }

  // Whether being kept inside passively lowers happiness
  causesUnhappiness() {
    return true;
  }

  getSellValue() {
    return 75;
  }

  // Can this go in? (Incubator.js: only small foals, a couple at a time)
  accepts(item) {
    return true;
  }

  cycleTag() {
    const tags = ["none", "breeding", "sell", "eject", "cull"];
    const idx = tags.indexOf(this.tag);
    this.tag = tags[(idx + 1) % tags.length];
  }

  // True while anything inside this cage is locked in (can't be moved in or out)
  isCulling() {
    return this.cullPhase !== null;
  }

  // True while fluffies inside are suffocating (silent, crawling)
  suffocatesOccupants() {
    return (
      this.cullPhase === "sealed" && this.cullTimer >= CAGE_CULL_PANIC_TIME
    );
  }

  // True while fluffies inside may only say their cull lines
  mutesOccupants() {
    return this.cullPhase === "sealed";
  }

  static locksItem(item) {
    return (
      !!item &&
      item.currentCage instanceof Cage &&
      (item.currentCage.isCulling() || (typeof item.currentCage.locksContents === "function" && item.currentCage.locksContents()))
    );
  }

  getOccupants() {
    if (typeof fluffies === "undefined") return [];
    return fluffies.filter((f) => f.currentCage === this && f.isAlive);
  }

  updateCullOccupants(dt) {
    const occupants = this.getOccupants();
    const t = this.cullTimer;

    if (t >= CAGE_CULL_DEATH_TIME) {
      if (!this.cullKilled) {
        this.cullKilled = true;
        // The ones watching will dread cages (Fears.js)
        if (typeof learnFearOfCages === "function") learnFearOfCages(this, occupants);
        for (const f of occupants) f.die("cull", "Suffocated in a culling cage"); // (you did it: Memory.js)
      }
      return;
    }

    for (const f of occupants) {
      f.expressionOverride = "CRYING_SHOCKED";
      f.expressionOverrideTimer = Math.max(f.expressionOverrideTimer || 0, 0.5);
    }

    if (t < CAGE_CULL_PANIC_TIME) {
      this.cullSpeechTimer -= dt;
      if (this.cullSpeechTimer <= 0) {
        this.cullSpeechTimer += CAGE_CULL_SPEECH_INTERVAL;
        for (const f of occupants) {
          // speak() itself skips wan die fluffies
          if (f.tooYoungToSpeak()) {
            f.speak(getDialogue("CULL_CHIRPY", f), false, true, true);
          } else {
            f.speak(getDialogue("CULL", f), false, false, true);
          }
        }
      }
    } else if (!this.cullSilenced) {
      this.cullSilenced = true;
      for (const f of occupants) {
        if (f.speech) {
          f.speech.text = null;
          f.speech.timer = 0;
        }
      }
    }
  }

  // Moves everything inside the cage out to just below it
  ejectContents() {
    if (this.isCulling()) return;
    const b = this.bounds;
    const arrays = [
      typeof fluffies !== "undefined" ? fluffies : [],
      typeof objects !== "undefined" ? objects : [],
    ];
    for (const arr of arrays) {
      for (const item of arr) {
        if (item.currentCage !== this) continue;
        item.currentCage = null;
        item.x = clamp(item.x, b.left, b.right);
        item.y = Math.min(height - 10, b.bottom + CAGE_EJECT_OFFSET_Y);
        if (item.targetX !== undefined) {
          item.targetX = item.x;
          item.targetY = item.y;
        }
      }
    }
    if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
      poofs.push(new Poof(this.x, b.bottom, this.scene));
    }
  }

  // Tapped (UI.js, before picking it up): a cull or eject cage with
  // fluffies in it does its job at once - one tap, no need to put it back
  // down in the same spot. Empty, it's just picked up and moved.
  tapAction() {
    if (this.cullPhase) return true; // (sealed: can't be moved now)
    if (!this.getOccupants().length) return false;
    if (this.tag === "cull") {
      this.askCull();
      return true;
    }
    if (this.tag === "eject") {
      this.ejectContents();
      return true;
    }
    return false;
  }

  // Cull mode, clicked: it can't be undone, so ask first (Choices.js)
  askCull() {
    if (this.cullPhase) return;
    const inside = this.getOccupants();
    if (!inside.length || typeof openChoice !== "function") {
      this.startCull();
      return;
    }
    const names = inside.map((f) => (typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "a fluffy"));
    const who = names.length <= 3 ? names.join(", ") : `${names.slice(0, 3).join(", ")} and ${names.length - 3} more`;
    openChoice({
      title: `Cull ${inside.length === 1 ? "the fluffy" : `all ${inside.length} fluffies`} in this cage?`,
      lines: [`The glass seals and the air goes: ${who} will suffocate.`, "It can't be stopped once it starts."],
      buttons: [
        { label: "Cull", kind: "danger", run: () => this.startCull() },
        { label: "Cancel", cancel: true, run: () => {} },
      ],
    });
  }

  startCull() {
    if (this.cullPhase) return;
    this.cullPhase = "extending";
    this.cullTimer = 0;
    this.cullSpeechTimer = 0;
    this.cullSilenced = false;
    this.cullKilled = false;
  }

  updateCull(dt) {
    if (!this.cullPhase) return;
    this.cullTimer += dt;

    if (this.cullPhase === "extending") {
      this.glassProgress = Math.min(1, this.cullTimer / CAGE_GLASS_EXTEND_TIME);
      if (this.glassProgress >= 1) {
        this.cullPhase = "sealed";
        this.cullTimer = 0;
        this.cullSmokeTimer = 0;
      }
    } else if (this.cullPhase === "sealed") {
      this.cullSmokeTimer -= dt;
      if (this.cullSmokeTimer <= 0) {
        this.cullSmokeTimer = CAGE_CULL_SMOKE_INTERVAL;
        this.spawnCullSmoke();
      }
      this.updateCullOccupants(dt);
      if (this.cullTimer >= CAGE_CULL_SEAL_DELAY) {
        this.cullPhase = "retracting";
        this.cullTimer = 0;
      }
    } else if (this.cullPhase === "retracting") {
      this.glassProgress = Math.max(
        0,
        1 - this.cullTimer / CAGE_GLASS_RETRACT_TIME,
      );
      if (this.glassProgress <= 0) {
        this.cullPhase = null;
        this.cullTimer = 0;
      }
    }
  }

  getInteriorRect() {
    const w = this.getImage().width * this.scale * this.widen();
    const h = this.getImage().height * this.scale;
    const insetX = w * 0.04;
    const insetTop = h * 0.08;
    const insetBottom = h * 0.08;
    return {
      x: this.x - w / 2 + insetX,
      y: this.y - h / 2 + insetTop,
      w: w - insetX * 2,
      h: h - insetTop - insetBottom,
    };
  }

  spawnCullSmoke() {
    if (typeof poofs === "undefined" || typeof Poof === "undefined") return;
    const r = this.getInteriorRect();
    const margin = 15 * this.scale;
    for (let i = 0; i < 2; i++) {
      const px = r.x + margin + Math.random() * Math.max(0, r.w - margin * 2);
      const py = r.y + margin + Math.random() * Math.max(0, r.h - margin * 2);
      poofs.push(new Poof(px, py, this.scene, CAGE_CULL_SMOKE_COLOR));
    }
  }

  update(dt) {
    if (!this.getImage()) return;

    // Track press position so a left click (no drag) can be detected on drop
    if (this.isDragging && !this.wasDragging) {
      this.pressPos.x = mouse.x;
      this.pressPos.y = mouse.y;
    }
    this.wasDragging = this.isDragging;

    this.updateCull(dt);

    const lastX = this.x;
    const lastY = this.y;

    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      // Simple boundary clamping for the cage itself
      const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
      const w = this.getImage().width * this.scale * this.widen();
      const h = this.getImage().height * this.scale;
      this.x = clamp(this.x, w / 2, sceneW(this.scene) - w / 2);
      this.y = clamp(this.y, topWallHeight + h / 2, sceneH(this.scene) - h / 2);
    }

    const dx = this.x - lastX;
    const dy = this.y - lastY;

    if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
      this.moveContents(dx, dy);
    }

    this.updateBounds();
  }

  updateBounds() {
    // Hit Test Bounds (Always sync in update)
    const img = this.getImage();
    const w = img.width * this.scale * this.widen();
    const h = img.height * this.scale;
    this.bounds.left = this.x - w / 2;
    this.bounds.right = this.x + w / 2;
    this.bounds.top = this.y - h / 2;
    this.bounds.bottom = this.y + h / 2;
  }

  moveContents(dx, dy) {
    const move = (item) => {
      if (item.currentCage === this && !item.isDragging) {
        item.x += dx;
        item.y += dy;
        if (item.targetX !== undefined) {
          item.targetX += dx;
          item.targetY += dy;
        }
      }
    };
    const arrays = [
      typeof fluffies !== "undefined" ? fluffies : [],
      typeof objects !== "undefined" ? objects : [],
    ];
    arrays.forEach((arr) => arr.forEach(move));
  }

  onDrop() {
    const wasClick =
      Math.hypot(mouse.x - this.pressPos.x, mouse.y - this.pressPos.y) <
      CAGE_CLICK_THRESHOLD;
    this.wasDragging = false;

    const lastX = this.x;
    const lastY = this.y;
    const transitioned = handleDropping(this);
    // Line up with a cage it's dropped beside (CAGE_SNAP): side by side, same
    // floor - for rows of breeding stock
    if (!transitioned) {
      const snapX = this.x;
      const snapY = this.y;
      this.snapToNeighbour();
      if (this.x !== snapX || this.y !== snapY) this.moveContents(this.x - snapX, this.y - snapY);
    }
    if (!transitioned && wasClick) {
      if (this.tag === "cull") {
        this.askCull();
      } else if (this.tag === "eject") {
        this.ejectContents();
      }
    }
    if (transitioned) {
      const dx = this.x - lastX;
      const dy = this.y - lastY;
      // Update scene and position for all contents
      const syncSceneAndPos = (item) => {
        if (item.currentCage === this) {
          item.scene = this.scene;
          item.x += dx;
          item.y += dy;
          if (item.targetX !== undefined) {
            item.targetX += dx;
            item.targetY += dy;
          }
        }
      };
      const arrays = [
        typeof fluffies !== "undefined" ? fluffies : [],
        typeof objects !== "undefined" ? objects : [],
      ];
      arrays.forEach((arr) => arr.forEach(syncSceneAndPos));
    }
  }

  // The nearest cage whose side is within CAGE_SNAP of one of ours: move
  // flush against it, bottoms level
  snapToNeighbour() {
    if (typeof objects === "undefined") return false;
    this.updateBounds();
    const w = this.bounds.right - this.bounds.left;
    const h = this.bounds.bottom - this.bounds.top;
    let best = null;
    let bd = CAGE_SNAP;
    for (const o of objects) {
      if (o === this || !(o instanceof Cage) || o.scene !== this.scene || o.isDragging) continue;
      o.updateBounds();
      const ob = o.bounds;
      if (Math.abs(ob.bottom - this.bounds.bottom) > h * 0.6) continue;
      const toRight = Math.abs(this.bounds.left - ob.right); // we go on its right
      const toLeft = Math.abs(this.bounds.right - ob.left); // ...or its left
      if (toRight < bd) {
        bd = toRight;
        best = { x: ob.right + w / 2, bottom: ob.bottom };
      }
      if (toLeft < bd) {
        bd = toLeft;
        best = { x: ob.left - w / 2, bottom: ob.bottom };
      }
    }
    if (!best) return false;
    this.x = best.x;
    this.y = best.bottom - h / 2;
    this.updateBounds();
    return true;
  }

  getBottomY() {
    if (!this.getImage()) return this.y;
    return this.y + (this.getImage().height * this.scale) / 2;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  serialize() {
    return {
      id: this.id,
      classType: this.constructor.name,
      x: this.x,
      y: this.y,
      scene: this.scene,
      scale: this.scale,
      tag: this.tag,
      mess: this.mess || undefined, // (CageLife.js)
    };
  }

  deserialize(data) {
    this.scale = data.scale || 1.0;
    this.tag = data.tag || "none";
    this.mess = data.mess || 0;
  }

  drawOffScreen(ctx) {
    if (!this.getImage()) return;
    const img = this.getImage();
    const w = img.width * this.scale * this.widen();
    const h = img.height * this.scale;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);

    if (this.glassProgress > 0) {
      this.drawGlass(ctx, w, h);
    }
    // Its mess (CageLife.js): stains on the floor of the cage
    if ((this.mess || 0) > 0.05) {
      const n = Math.ceil(this.mess * 8);
      for (let i = 0; i < n; i++) {
        const sx = -w / 2 + w * (0.12 + ((i * 0.37) % 0.76));
        const sy = h / 2 - h * 0.09 - (i % 3) * 3;
        ctx.fillStyle = i % 3 === 2 ? "rgba(214, 180, 40, 0.55)" : "rgba(92, 64, 51, 0.75)";
        ctx.beginPath();
        ctx.ellipse(sx, sy, 10 + (i % 4) * 3, 4 + (i % 2) * 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Draw Tag (with what a tap does, for cull and eject)
    if (this.tag && this.tag !== "none") {
      const hint = { cull: " \u00b7 tap to seal", eject: " \u00b7 tap to empty" }[this.tag];
      const label = this.tag.toUpperCase() + (hint && !this.cullPhase && this.getOccupants().length ? hint : "");
      ctx.font = "bold 12px Arial";
      ctx.textAlign = "center";
      ctx.fillStyle = CAGE_TAG_COLORS[this.tag] || "#4CAF50";
      ctx.fillRect(-w / 2 + 5, -h / 2 + 5, ctx.measureText(label).width + 10, 20);
      ctx.fillStyle = "white";
      ctx.fillText(label, -w / 2 + 5 + (ctx.measureText(label).width + 10) / 2, -h / 2 + 19);
    }
    ctx.restore();
  }

  // Draws the glass pane in cage-local coordinates, extending from the top
  drawGlass(ctx, w, h) {
    const insetX = w * 0.04;
    const top = -h / 2 + h * 0.08;
    const innerW = w - insetX * 2;
    const innerH = h - h * 0.16;
    const paneH = innerH * this.glassProgress;
    const left = -w / 2 + insetX;

    ctx.save();
    ctx.fillStyle = "rgba(180, 220, 235, 0.35)";
    ctx.fillRect(left, top, innerW, paneH);

    // Diagonal highlight streaks, clipped to the pane
    ctx.beginPath();
    ctx.rect(left, top, innerW, paneH);
    ctx.clip();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.45)";
    ctx.lineWidth = 6 * this.scale;
    ctx.beginPath();
    ctx.moveTo(left + innerW * 0.15, top + innerH);
    ctx.lineTo(left + innerW * 0.45, top);
    ctx.moveTo(left + innerW * 0.3, top + innerH);
    ctx.lineTo(left + innerW * 0.55, top);
    ctx.stroke();
    ctx.restore();

    // Leading bottom edge of the pane
    ctx.save();
    ctx.strokeStyle = "rgba(220, 240, 250, 0.9)";
    ctx.lineWidth = 3 * this.scale;
    ctx.beginPath();
    ctx.moveTo(left, top + paneH);
    ctx.lineTo(left + innerW, top + paneH);
    ctx.stroke();
    ctx.restore();
  }
}
