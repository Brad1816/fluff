class ThrowTool {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;
    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;
    this.heldHorse = null;
  }

  update(dt) {
    if (this.isDragging) {
      if (typeof mouse !== "undefined") {
        this.x = mouse.x + this.dragOffset.x;
        this.y = mouse.y + this.dragOffset.y;
      }
    }
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    if (!images.throw_tool_unheld || !images.throw_tool_held) return;

    const img = this.heldHorse ? images.throw_tool_held : images.throw_tool_unheld; 

    const oldAlpha = ctx.globalAlpha;
    ctx.save();
    ctx.globalAlpha = 0.3;
    ctx.translate(this.x, this.y + img.height / 2);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.globalAlpha = oldAlpha;
    ctx.restore();
  }

  hitTest(px, py) {
    return Math.hypot(px - this.x, py - this.y) <= 20;
  }

  getBottomY() {
    return Infinity;
  }

  onDrop() {
    if (this.heldHorse) {
      const h = this.heldHorse;
      this.heldHorse = null;
      if (typeof h.onDrop === "function") {
        h.onDrop();
      }
    }
    this.isDragging = false;
    if (typeof objects !== "undefined") {
      const idx = objects.indexOf(this); if (idx !== -1) { objects.splice(idx, 1); }
    }
    if (typeof isGlobalDragging !== "undefined") {
      isGlobalDragging =
        (typeof objects !== "undefined" && objects.some((o) => o.isDragging)) ||
        (typeof fluffies !== "undefined" && fluffies.some((f) => f.isDragging));
    }
  }

  serialize() {
    return {
      classType: "ThrowTool",
      id: this.id,
      scene: this.scene,
    };
  }

  deserialize(data) {
    if (data.id !== undefined && data.id !== null) {
      this.id = data.id;
    }
    if (data.scene) {
      this.scene = data.scene;
    }
  }
}

// Add ThrowTool to default toolbox on load if not already present, ensuring it is prepended
if (typeof toolbox !== "undefined" && Array.isArray(toolbox)) {
  const hasTool = toolbox.some((t) => t instanceof ThrowTool);
  if (!hasTool) {
    toolbox.unshift(new ThrowTool());
  } else {
    const idx = toolbox.findIndex((t) => t instanceof ThrowTool);
    if (idx > 0) {
      const [tool] = toolbox.splice(idx, 1);
      toolbox.unshift(tool);
    }
  }
}
if (typeof ensureThrowToolPrepended === "function") {
  ensureThrowToolPrepended();
}
if (typeof initDefaultToolbar === "function") {
  initDefaultToolbar();
}
