class Gib {
  constructor(
    imgKey,
    color = null,
    scene = "INDOORS",
    type = "part",
    x,
    y,
    grinder = null,
    bounds = null,
    parentScale = 1.0,
    growthValue = 0,
    pregnancyData = null,
    spotsConfig = null,
    preTintedImg = null,
    stripesConfig = null,
    faceData = null,
  ) {
    this.id = nextObjectId++;
    this.imgKey = imgKey;
    this.spotsConfig = spotsConfig;
    this.stripesConfig = stripesConfig;
    this.color = color;
    this.scene = scene;
    this.type = type;

    this.expression = faceData?.expression || null;
    this.eyeColor = faceData?.eyeColor || null;
    this.maneType = faceData?.maneType !== undefined ? faceData.maneType : null;
    this.maneColor = faceData?.maneColor || null;
    this.gradientConfig = faceData?.gradientConfig || null;
    this.hasHorn = faceData?.hasHorn || false;
    this.hornSizeFactor = faceData?.hornSizeFactor || 1.0;
    this.hasLeftEar = faceData?.hasLeftEar !== false;
    this.hasRightEar = faceData?.hasRightEar !== false;
    this.hasRightEye = faceData?.hasRightEye !== false;
    this.maneScale =
      typeof faceData?.maneScale === "number" ? faceData.maneScale : 1.0;
    this.eyesClosed = !!faceData?.eyesClosed;
    this.sensitive = !!faceData?.sensitive;
    this.faceRendered = false;

    if (this.isFaceGib()) {
      const faceCanvas = this.renderFaceSprite(preTintedImg);
      if (faceCanvas) {
        this.img = faceCanvas;
        this.faceRendered = true;
      } else if (preTintedImg) {
        this.img = preTintedImg;
      } else if (color) {
        this.img = tintImage(
          images[imgKey],
          this.color,
          this.spotsConfig,
          this.stripesConfig,
        );
      } else {
        this.img = images[imgKey];
      }
    } else if (preTintedImg) {
      this.img = preTintedImg;
    } else if (color) {
      this.img = tintImage(
        images[imgKey],
        this.color,
        this.spotsConfig,
        this.stripesConfig,
      );
    } else {
      this.img = images[imgKey];
    }

    this.x = x;
    this.y = y;
    this.grinder = grinder;
    this.bounds = bounds;
    this.growthValue = growthValue;
    this.pregnancyData = pregnancyData;

    // Random upward velocity
    this.vx = 0;
    this.vy = -(500 + Math.random() * 500);
    this.gravity = 2000;

    const rw = ((this.img ? this.img.width : 40) / 2) * parentScale;
    if (this.grinder) {
      const gb = this.grinder.gibBounds();
      const targetX =
        gb.left + rw + Math.random() * (gb.right - gb.left - 2 * rw);
      const t = (-2 * this.vy) / this.gravity;
      this.vx = (targetX - this.x) / t;
    } else {
      this.vx = (Math.random() - 0.5) * 400;
    }

    this.angle = Math.random() * Math.PI * 2;
    this.rotSpeed = (Math.random() - 0.5) * 20;
    this.shouldDespawn = false;

    this.scale = parentScale;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.freeGib = false;
    this.isRoadkill = false;
    this.roadkillFloorY = 0;
    this.carCollisionCooldown = 0;
  }

  isFaceGib() {
    return this.imgKey === "head" || this.type === "head";
  }

  // Draws the head with its face using the same code as living fluffies
  renderFaceSprite(baseHeadImg = null) {
    if (
      typeof images === "undefined" ||
      !images.head ||
      images.head.width === 0
    ) {
      return null;
    }

    const headImages = buildHorseHeadImages({
      bodyColor: this.color,
      maneColor: this.maneColor,
      pupilColor: this.eyeColor,
      maneType: this.maneType,
      gradient: this.gradientConfig,
      sensitive: this.sensitive,
      hasHorn: this.hasHorn,
    });
    // Keep the exact head coloring (spots/stripes) it was given
    headImages.head =
      baseHeadImg ||
      (this.color
        ? tintImage(
            images.head,
            this.color,
            this.spotsConfig,
            this.stripesConfig,
          )
        : images.head);
    if (!headImages.head) return null;

    const w = images.head.width;
    const h = images.head.height;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.translate(w * HORSE_HEAD_PIVOT.x, h * HORSE_HEAD_PIVOT.y);
    drawHorseHead(ctx, headImages, {
      w,
      h,
      maneScale: this.maneScale,
      headScale: 1,
      earScale: 1,
      farEar: this.hasLeftEar,
      nearEar: this.hasRightEar,
      nearEye: this.hasRightEye,
      horn: this.hasHorn,
      hornSizeFactor: this.hornSizeFactor,
      earFlop: 0,
      doubleChin: this.sensitive,
      expression: getExpressionConfig(this.expression || "NEUTRAL", true),
      isAlive: true,
      eyesClosed: this.eyesClosed,
      pinkEye: this.expression === "CRYING_SHOCKED",
      pupilOffset: { x: 0, y: 0 },
      pupilAlpha: 1,
      tears: null,
    });
    return canvas;
  }

  serialize() {
    return {
      id: this.id,
      imgKey: this.imgKey,
      color: this.color,
      x: this.x,
      y: this.y,
      grinderId: this.grinder ? this.grinder.id : null,
      growthValue: this.growthValue,
      scene: this.scene,
      type: this.type,
      pregnancyData: this.pregnancyData
        ? JSON.parse(JSON.stringify(this.pregnancyData))
        : null,
      vx: this.vx,
      vy: this.vy,
      angle: this.angle,
      rotSpeed: this.rotSpeed,
      scale: this.scale,
      freeGib: this.freeGib,
      bounds: this.bounds ? JSON.parse(JSON.stringify(this.bounds)) : null,
      spotsConfig: this.spotsConfig
        ? JSON.parse(JSON.stringify(this.spotsConfig))
        : null,
      stripesConfig: this.stripesConfig
        ? JSON.parse(JSON.stringify(this.stripesConfig))
        : null,
      isRoadkill: this.isRoadkill,
      roadkillFloorY: this.roadkillFloorY,
      ownerId: this.ownerId ?? null,
      expression: this.expression,
      eyeColor: this.eyeColor,
      maneType: this.maneType,
      maneColor: this.maneColor,
      gradientConfig: this.gradientConfig
        ? JSON.parse(JSON.stringify(this.gradientConfig))
        : null,
      hasHorn: this.hasHorn,
      hornSizeFactor: this.hornSizeFactor,
      hasLeftEar: this.hasLeftEar,
      hasRightEar: this.hasRightEar,
      hasRightEye: this.hasRightEye,
      maneScale: this.maneScale,
      eyesClosed: this.eyesClosed,
      sensitive: this.sensitive,
    };
  }

  static deserialize(data) {
    const faceData =
      data.expression !== undefined ||
      data.eyeColor !== undefined ||
      data.maneType !== undefined ||
      data.maneColor !== undefined
        ? {
            expression: data.expression,
            eyeColor: data.eyeColor,
            maneType: data.maneType,
            maneColor: data.maneColor,
            gradientConfig: data.gradientConfig,
            hasHorn: data.hasHorn,
            hornSizeFactor: data.hornSizeFactor,
            hasLeftEar: data.hasLeftEar,
            hasRightEar: data.hasRightEar,
            hasRightEye: data.hasRightEye,
            maneScale: data.maneScale,
            eyesClosed: data.eyesClosed,
            sensitive: data.sensitive,
          }
        : null;

    const g = new Gib(
      data.imgKey,
      data.color,
      data.scene,
      data.type,
      data.x,
      data.y,
      null, // Grinder will be linked in second pass
      data.bounds,
      data.scale,
      data.growthValue,
      data.pregnancyData,
      data.spotsConfig,
      null,
      data.stripesConfig,
      faceData,
    );
    g.id = data.id;
    g.vx = data.vx;
    g.vy = data.vy;
    g.angle = data.angle;
    g.rotSpeed = data.rotSpeed;
    g.freeGib = data.freeGib;
    g.isRoadkill = data.isRoadkill || false;
    g.roadkillFloorY = data.roadkillFloorY || 0;
    g.ownerId = data.ownerId ?? null;
    return g;
  }

  hitTest(px, py) {
    const rw = (this.img.width / 2) * this.scale;
    const rh = (this.img.height / 2) * this.scale;
    return (
      px > this.x - rw &&
      px < this.x + rw &&
      py > this.y - rh &&
      py < this.y + rh
    );
  }

  getBottomY() {
    return this.y + (this.img.height / 2) * this.scale;
  }

  update(dt) {
    if (this.carCollisionCooldown > 0) {
      this.carCollisionCooldown -= dt;
    }

    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;
      this.vx = 0;
      this.vy = 0;
      return;
    }

    if (this.isRoadkill) {
      if (!this.freeGib) {
        // Gravity and velocity updates
        this.vy += this.gravity * dt;
        this.y += this.vy * dt;
        this.x += this.vx * dt;
        this.angle += this.rotSpeed * dt;

        // Bounce on the roadkillFloorY level
        const rh = (this.img.height / 2) * this.scale;
        if (this.vy > 0 && this.y > this.roadkillFloorY - rh) {
          this.y = this.roadkillFloorY - rh;
          this.vy *= -0.4;
          this.vx *= 0.8;

          // Stop thresholds
          if (Math.abs(this.vy) < 80) {
            this.vy = 0;
            this.rotSpeed *= 0.8;
          }
          if (Math.abs(this.vx) < 10) {
            this.vx = 0;
            this.rotSpeed = 0;
          }

          if (this.vx === 0 && this.vy === 0) {
            this.freeGib = true;
            this.isRoadkill = false;
            this.roadkillFloorY = null;
            if (typeof addPointToPuddle !== "undefined") {
              const puddleScale =
                ((35 + Math.random() * 25) / 200) * this.scale * 2.5;
              addPointToPuddle(
                this.scene,
                this.x,
                this.y,
                "blood",
                0.05,
                puddleScale,
                0.05,
              );
            }
          }
        }
      }

      // Despawn if it travels too far out of screen (instead of bouncing back)
      if (this.x < -200 || this.x > sceneW(this.scene) + 200) {
        this.shouldDespawn = true;
      }
      return; // Skip standard bounds/grinder physics
    }

    if (!this.freeGib) {
      // Vertical motion with gravity
      this.vy += this.gravity * dt;
      this.y += this.vy * dt;

      // Horizontal update
      this.x += this.vx * dt;

      this.angle += this.rotSpeed * dt;
    }

    // Bounce inside bounds
    const rw = (this.img.width / 2) * this.scale;
    const rh = (this.img.height / 2) * this.scale;

    if (this.grinder) {
      const gb = this.grinder.gibBounds();
      if (this.y > gb.bottom - rh) {
        this.y = gb.bottom - rh;
        this.vy *= -0.8;
        this.vy -= 400 * Math.random();

        // Determine new vx such that it lands within bounds again
        const targetX =
          gb.left + rw + Math.random() * (gb.right - gb.left - 2 * rw);
        const t = (-2 * this.vy) / this.gravity;
        this.vx = (targetX - this.x) / t;
        this.rotSpeed = (Math.random() - 0.5) * 20;

        // 0.15 chance to despawn when hitting bottom of a grinder
        if (Math.random() < 0.15) {
          this.shouldDespawn = true;
        }
        if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
          poofs.push(new Poof(this.x, this.y, this.scene, "#8a0303"));
        }
      }
    } else if (this.bounds) {
      if (this.y > this.bounds.bottom - rh) {
        this.y = this.bounds.bottom - rh;
        // Amputation bounce: Halve vx, reduce vy, no extra velocity
        this.vy *= -0.5;
        this.vx *= 0.5;

        // Stop thresholds
        if (Math.abs(this.vy) < 80) {
          this.vy = 0;
          this.rotSpeed *= 0.8;
        }
        if (Math.abs(this.vx) < 10) {
          this.vx = 0;
          this.rotSpeed = 0;
        }

        if (this.vx === 0 && this.vy === 0) {
          this.freeGib = true;
        }
      }

      // Horizontal bounds clamping for non-grinder gibs
      if (this.x < rw) {
        this.x = rw;
        this.vx *= -0.5;
      } else if (this.x > sceneW(this.scene) - rw) {
        this.x = sceneW(this.scene) - rw;
        this.vx *= -0.5;
      }
    }
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    if (this.isFaceGib() && !this.faceRendered) {
      const faceCanvas = this.renderFaceSprite();
      if (faceCanvas) {
        this.img = faceCanvas;
        this.faceRendered = true;
      }
    }
    if (!this.img) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.scale(this.scale, this.scale);
    ctx.drawImage(this.img, -this.img.width / 2, -this.img.height / 2);
    ctx.restore();
  }

  onDrop() {
    handleDropping(this);
    if (!this.bounds) {
      this.bounds = { left: 0, right: sceneW(this.scene), top: 0, bottom: sceneH(this.scene) - 15 };
    }
    this.bounds.bottom = this.y + (this.img.height * this.scale) / 2;
    this.freeGib = true;

    // Check for Grinder drop
    if (typeof objects !== "undefined") {
      for (const obj of objects) {
        if (obj instanceof Grinder) {
          const g = obj.bounds;
          if (
            this.x > g.left &&
            this.x < g.right &&
            this.y > g.top &&
            this.y < g.bottom &&
            obj.scene === currentScene
          ) {
            this.freeGib = false;
            this.bounds = obj.gibBounds();
            this.grinder = obj;
            this.y = obj.y - 100;
            return true;
          }
        }
      }
    }
    // Set down near fluffies: they react (BodyParts.js)
    if (typeof onBodyPartDropped === "function") onBodyPartDropped(this);
  }
}

function updateGibs(dt) {
  for (let i = gibs.length - 1; i >= 0; i--) {
    gibs[i].update(dt);
    if (gibs[i].shouldDespawn) {
      // Find which grinder it was in
      const grinder = gibs[i].grinder;
      if (grinder) {
        grinder.addGrowth(gibs[i].growthValue);

        // Spawn premature babies if this was a pregnant torso
        if (gibs[i].type === "torso" && gibs[i].pregnancyData) {
          HorseAnatomy.spawnPrematureBabies(
            gibs[i].grinder,
            gibs[i].scene,
            gibs[i].x,
            gibs[i].y,
            gibs[i].pregnancyData,
          );
        }

        // Create blood puddle
        addPointToPuddle(
          grinder.scene,
          gibs[i].x,
          gibs[i].y,
          "blood",
          5 / 200,
          (40 + Math.random() * 40) / 200,
        );
      }
      gibs.splice(i, 1);
    }
  }
}

window.drawGibsForGrinder = function (ctx, grinder) {
  for (const gib of gibs) {
    if (gib.scene !== currentScene) continue;
    if (grinder && gib.grinder !== grinder) continue;
    gib.draw(ctx);
  }
};
