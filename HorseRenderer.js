// Fluffies being chased by a smarty (or one under an aphrodisiac) in the
// same area, worked out once per game step instead of once per fluffy
let _chasedStamp = -1;
let _chasedSet = new Set();
function _chasedFluffies() {
  const now = typeof timePlayed === "number" ? timePlayed : 0;
  if (now === _chasedStamp) return _chasedSet;
  _chasedStamp = now;
  _chasedSet = new Set();
  for (const f of fluffies) {
    if (!f.isAlive || !f.chaseTarget || f.chaseTarget.scene !== f.scene) continue;
    if (f.isSmarty() || f.isUnderAphrodisiac()) _chasedSet.add(f.chaseTarget);
  }
  return _chasedSet;
}

class HorseRenderer {
  constructor(horse) {
    this.horse = horse;
    this.layout = null;
    this.tinted = null;
  }

  getManeScale() {
    return Math.min(1.0, this.horse.growth / 0.35);
  }

  getHeadScale() {
    return 1.25 - 0.25 * Math.min(1.0, this.horse.growth / 0.5);
  }

  getEarScale() {
    return 1.0;
  }

  getGrowthScale() {
    return 0.25 + 0.75 * this.horse.growth;
  }

  isCrying() {
    let expr = this.horse.expression;
    if (
      this.horse.expressionOverrideTimer > 0 &&
      this.horse.expressionOverride
    ) {
      expr = this.horse.expressionOverride;
    }
    return expr === "CRYING_SHOCKED";
  }

  updateExpression(dt) {
    if (!this.horse.isAlive) return;

    const isChaseTarget = _chasedFluffies().has(this.horse);

    if (this.horse.isUnderAphrodisiac()) {
      this.horse.expression = "MISERABLE";
    } else if (
      isChaseTarget &&
      this.horse.happiness > WAN_DIE_THRESHOLD &&
      this.horse.canSee()
    ) {
      this.horse.expression = "SHOCKED";
    } else if (this.horse.currentStateKey === "FOCUSING") {
      this.horse.expression = "FOCUSING";
    } else if (this.horse.currentStateKey === "DROWNING") {
      this.horse.expression = "CRYING_SHOCKED";
    } else if (this.horse.isDragging && this.horse.grabbedPart !== "torso") {
      this.horse.expression = "BAD_UPSIES";
    } else if (this.horse.currentStateKey === "ATTEMPTING_EXCRETION") {
      this.horse.expression = "BOWEL_MOVEMENT";
    } else {
      const isSmarty = this.horse.isSmarty();
      if (this.horse.happiness <= HAPPINESS_MISERABLE_THRESHOLD) {
        this.horse.expression = "MISERABLE";
      } else if (isSmarty) {
        this.horse.expression = "ANGRY";
      } else if (this.horse.happiness > HAPPINESS_HAPPY_THRESHOLD) {
        this.horse.expression = "HAPPY";
      } else if (this.horse.happiness < HAPPINESS_SAD_THRESHOLD) {
        this.horse.expression = "SAD";
      } else {
        this.horse.expression = "NEUTRAL";
      }
    }
  }

  getExpressionConfig() {
    let expr = this.horse.expression;
    if (
      this.horse.expressionOverrideTimer > 0 &&
      this.horse.expressionOverride
    ) {
      expr = this.horse.expressionOverride;
    }

    return getExpressionConfig(expr, this.horse.isAlive);
  }


  ensureTintedImages() {
    if (this.tinted) return;
    if (!images.head || images.head.width === 0) return;

    this.tinted = {};

    const spotsConfig = this.horse.hasSpots
      ? {
          color: this.horse.colors.spots,
          seed: this.horse.spotPatternSeed,
        }
      : null;

    const stripesConfig = this.horse.hasStripes
      ? {
          color: this.horse.colors.stripes,
          seed: this.horse.stripePatternSeed,
        }
      : null;

    const gradientConfig = this.horse.hasGradient
      ? {
          color: this.horse.colors.gradient,
          intensity: this.horse.gradientIntensity,
        }
      : null;

    this.tinted.head = tintImage(
      images.head,
      this.horse.colors.body,
      spotsConfig
        ? { ...spotsConfig, seed: spotsConfig.seed + 13, isHead: true }
        : null,
      stripesConfig
        ? { ...stripesConfig, seed: stripesConfig.seed + 13, isHead: true }
        : null,
    );
    if (images.sbs_double_chin) {
      this.tinted.sbs_double_chin = tintImage(
        images.sbs_double_chin,
        this.horse.colors.body,
        spotsConfig
          ? { ...spotsConfig, seed: spotsConfig.seed + 71, isLeg: true }
          : null,
        stripesConfig
          ? { ...stripesConfig, seed: stripesConfig.seed + 71, isLeg: true }
          : null,
      );
    }
    this.tinted.ear = tintImage(
      images.ear,
      this.horse.colors.body,
      spotsConfig
        ? { ...spotsConfig, seed: spotsConfig.seed + 47, isLeg: true }
        : null,
      stripesConfig
        ? { ...stripesConfig, seed: stripesConfig.seed + 47, isLeg: true }
        : null,
    );
    this.tinted.torso = tintImage(
      images.torso,
      this.horse.colors.body,
      spotsConfig,
      stripesConfig,
    );
    this.tinted.leg = tintImage(
      images.leg,
      this.horse.colors.body,
      spotsConfig
        ? { ...spotsConfig, seed: spotsConfig.seed + 29, isLeg: true }
        : null,
      stripesConfig
        ? { ...stripesConfig, seed: stripesConfig.seed + 29, isLeg: true }
        : null,
    );
    this.tinted.eyelid = tintImage(images.eye, this.horse.colors.body);

    let maneImg = images.mane_0;
    if (this.horse.maneType === 1) maneImg = images.mane_1;
    else if (this.horse.maneType === 2) maneImg = images.mane_2;
    else if (this.horse.maneType === 3) maneImg = images.mane_3;
    else if (this.horse.maneType === 4) maneImg = images.mane_4;
    else if (this.horse.maneType === 5) maneImg = images.mane_5;
    // Greyer with age (Aging.js)
    const maneColor = typeof maneColorFor === "function" ? maneColorFor(this.horse) : this.horse.colors.mane;
    this.tinted.mane = tintImage(
      maneImg,
      maneColor,
      null,
      null,
      gradientConfig,
    );

    let tailImg = images.tail;
    if (this.horse.tailType === 1) tailImg = images.tail_0;
    else if (this.horse.tailType === 2) tailImg = images.tail_1;
    this.tinted.tail = tintImage(
      tailImg,
      maneColor,
      null,
      null,
      gradientConfig,
    );
    // A fancy mane: streaks, tips or rainbow, the tail to match
    // (ManePatterns.js), greyed with age like the rest of the mane
    if (this.horse.manePattern && typeof paintManePattern === "function") {
      const p = this.horse.manePattern;
      const second = typeof agedColor === "function" && typeof greyAmount === "function" ? agedColor(p.color, 0.8 * greyAmount(this.horse)) : p.color;
      paintManePattern(this.tinted.mane, maneImg, p, second);
      paintManePattern(this.tinted.tail, tailImg, p, second);
    }

    if (images.pupil)
      this.tinted.pupil = tintImage(images.pupil, this.horse.colors.pupil);
    this.tinted.eye = images.eye;
    if (images.eye) this.tinted.eye_pink = tintImage(images.eye, "#ffcccc");
    if (images.cheek) {
      const cheekImgToUse =
        this.horse.isSensitive() && images.cheek_sbs
          ? images.cheek_sbs
          : images.cheek;
      this.tinted.cheek = tintImage(cheekImgToUse, this.horse.colors.body);
    }
    if (images.puffed_cheek)
      this.tinted.puffed_cheek = tintImage(
        images.puffed_cheek,
        this.horse.colors.body,
      );
    if (images.eye_happy) this.tinted.eye_happy = images.eye_happy;
    if (images.eye_pained) this.tinted.eye_pained = images.eye_pained;
    if (images.eye_angry)
      this.tinted.eye_angry = tintImage(
        images.eye_angry,
        this.horse.colors.body,
      );
    if (images.eye_sad)
      this.tinted.eye_sad = tintImage(images.eye_sad, this.horse.colors.body);

    if (
      (this.horse.type === "pegasus" || this.horse.type === "alicorn") &&
      images.wing
    ) {
      this.tinted.wing = tintImage(images.wing, this.horse.colors.body);
    }
    if (
      (this.horse.type === "unicorn" || this.horse.type === "alicorn") &&
      images.horn
    ) {
      this.tinted.horn = tintImage(images.horn, this.horse.colors.body);
    }
    if (this.horse.gender === "female" && images.horse_udders) {
      if (this.horse.isPoisoned) {
        this.tinted.udders = tintImage(images.horse_udders, "#4b5320");
      } else {
        // Don't tint udders
        this.tinted.udders = images.horse_udders;
      }
    }
    if (this.horse.gender === "male" && images.special_lumps) {
      this.tinted.special_lumps = tintImage(
        images.special_lumps,
        this.horse.colors.body,
      );
    }
  }

  calculateLegAngles(bodyAngle) {
    if (!this.horse.isAlive) {
      if (!this.horse.deathSnapshot) {
        // Capture last frame values or default if undefined
        this.horse.deathSnapshot = this.horse.lastFrameAngles || {
          bodyY: 0,
          legAngles: [0, 0, 0, 0],
          headBobY: 0,
          tailAngle: 0,
          headAngle: 0,
          bodyAngle: 0,
        };
      }

      const t = this.horse.deathAnim;
      const deadTargets = [
        -Math.PI / 2,
        Math.PI / 2,
        -Math.PI / 2,
        Math.PI / 2,
      ];
      const angles = [];
      for (let i = 0; i < 4; i++) {
        let startAngle = 0;
        if (this.horse.deathSnapshot.legAngles) {
          startAngle = this.horse.deathSnapshot.legAngles[i];
        } else {
          const prevLegAngle = this.horse.deathSnapshot.legAngle || 0;
          startAngle = i === 0 || i === 2 ? -prevLegAngle : prevLegAngle;
          startAngle += this.horse.deathSnapshot.bodyAngle || 0;
        }
        angles.push(lerp(startAngle, deadTargets[i], t));
      }
      return angles;
    }

    let swing = 0;
    if (this.horse.isDragging) {
      swing =
        this.horse.currentStateKey === "SITTING"
          ? 0
          : this.horse.physicsLegAngle;
    } else {
      swing = Math.sin(this.horse.animPhase) * this.horse.anim.legSwingAmp;
    }

    let leftLegAngle = -swing;
    let rightLegAngle = swing;

    if (
      (this.horse.isDragging &&
        this.horse.grabbedPart === "torso" &&
        (this.horse.currentStateKey === "SITTING" ||
          this.horse.isNearRunningGrinder())) ||
      this.horse.currentStateKey === "DROWNING"
    ) {
      const flail = this.horse.flailAngle || 0;
      leftLegAngle = swing + flail;
      rightLegAngle = swing - flail;
    } else if (this.horse.isDragging) {
      leftLegAngle = swing;
      rightLegAngle = swing;
    } else {
      let sittingAndMouseClose = false;

      if (
        this.horse.currentStateKey === "SITTING" ||
        this.horse.currentStateKey === "FOCUSING"
      ) {
        leftLegAngle = rightLegAngle = Math.PI / 4;
        if (
          this.horse.currentStateKey === "SITTING" &&
          this.horse.canSee() &&
          Math.sqrt(
            (mouse.x - this.horse.x) ** 2 + (mouse.y - this.horse.y) ** 2,
          ) < 200
        ) {
          sittingAndMouseClose = true;
        }
      }
      if (sittingAndMouseClose) {
        const wiggle = Math.sin(Date.now() / 100) * 0.5;
        leftLegAngle = -swing - Math.PI / 2 + wiggle;
        rightLegAngle = swing - Math.PI / 2 - wiggle;

        this.horse.facingRight = mouse.x > this.horse.x;
      }
      if (
        this.horse.currentStateKey === "LYING" ||
        this.horse.currentStateKey === "SLEEPING"
      ) {
        leftLegAngle = rightLegAngle = -Math.PI / 2;
      }
      if (this.horse.currentStateKey === "BENDING") {
        leftLegAngle = rightLegAngle = (60 * Math.PI) / 180;
      }
      if (this.horse.currentStateKey === "BENDING_2") {
        leftLegAngle = rightLegAngle = (-20 * Math.PI) / 180;
      }
      if (this.horse.currentStateKey === "ATTEMPTING_EXCRETION") {
        leftLegAngle = rightLegAngle = (-45 * Math.PI) / 180;
      }

      if (this.horse.currentStateKey === "FLUFFY_JAB") {
        const t = clamp(1.0 - this.horse.stateTimer / 0.5, 0, 1);
        rightLegAngle = -Math.sin(t * Math.PI) * 1.5;
        leftLegAngle = (10 * Math.PI) / 180;
        if (t >= 0.25 && t <= 0.75) {
          const tJab = (t - 0.25) / 0.5;
          this.jabXOffset = Math.sin(-tJab * 2 * Math.PI) * 15;
        } else {
          this.jabXOffset = 0;
        }
      } else {
        this.jabXOffset = 0;
      }
      if (this.horse.currentStateKey === "FLUFFY_STOMPIE") {
        this.jabXOffset = 0;
        const t = clamp(1.0 - this.horse.stateTimer / 0.5, 0, 1);
        if (t < 0.5) {
          rightLegAngle = -Math.sin(t * 2 * Math.PI) * 1.2;
        } else {
          rightLegAngle = Math.sin((t - 0.5) * 2 * Math.PI) * 0.8;
        }
        leftLegAngle = (10 * Math.PI) / 180;
      }

      if (this.horse.currentStateKey === "FLUFFY_KNOCKED_DOWN") {
        const duration = 0.5;
        const frac = this.horse.stateTimer / duration;
        const t = clamp(1.0 - frac, 0, 1);
        this.knockedDownBodyY = Math.cos((t * Math.PI) / 2) * 40;
        this.knockedDownLegAngle = -Math.PI * 0.5;
      } else {
        this.knockedDownBodyY = 0;
        this.knockedDownLegAngle = 0;
      }
    }

    let backLegAngle = -Math.PI / 3;
    if (this.horse.currentStateKey === "BENDING") backLegAngle = 0;
    else if (
      this.horse.currentStateKey === "SITTING" ||
      this.horse.currentStateKey === "FOCUSING"
    )
      backLegAngle = Math.PI / 16;
    else if (this.horse.currentStateKey === "BENDING_2")
      backLegAngle = -(30 * Math.PI) / 180;
    else if (this.horse.currentStateKey === "ATTEMPTING_EXCRETION")
      backLegAngle = -(45 * Math.PI) / 180;
    else if (
      this.horse.currentStateKey === "FLUFFY_JAB" ||
      this.horse.currentStateKey === "FLUFFY_STOMPIE"
    )
      backLegAngle = leftLegAngle;

    const angles = [];
    for (let idx = 0; idx < 4; idx++) {
      if (this.horse.isCrawling) {
        let crawlAngle = idx === 0 || idx === 3 ? Math.PI / 2 : -Math.PI / 2;
        if (this.horse.isBeingTased && this.horse.isBeingTased()) {
          crawlAngle += (Math.random() - 0.5) * 0.45;
        }
        angles.push(crawlAngle);
        continue;
      }

      if (this.horse.currentStateKey === "RUNNING") {
        if (idx === 0) angles.push((-leftLegAngle + bodyAngle) * 1.4);
        else if (idx === 1) angles.push(leftLegAngle + bodyAngle);
        else if (idx === 2) angles.push((leftLegAngle + bodyAngle) * 1.4);
        else if (idx === 3) angles.push(-leftLegAngle + bodyAngle);
        continue;
      }

      if (this.horse.currentStateKey === "HUGGING") {
        if (idx === 0) angles.push(backLegAngle);
        else if (idx === 1)
          angles.push(
            -Math.PI / 2 + Math.sin(Date.now() / 1000 + this.horse.id) * 0.5,
          );
        else if (idx === 2)
          angles.push(
            -Math.PI / 2 + Math.sin(Date.now() / 1000 + this.horse.id) * 0.5,
          );
        else if (idx === 3) angles.push(backLegAngle);
        continue;
      }

      let a = 0;
      const isPlanted =
        this.horse.currentStateKey === "SITTING" ||
        this.horse.currentStateKey === "FOCUSING" ||
        this.horse.currentStateKey === "BENDING" ||
        this.horse.currentStateKey === "BENDING_2" ||
        this.horse.currentStateKey === "FLUFFY_JAB" ||
        this.horse.currentStateKey === "FLUFFY_STOMPIE" ||
        this.horse.currentStateKey === "ATTEMPTING_EXCRETION";

      if (idx === 0) {
        a = isPlanted
          ? this.horse.currentStateKey === "BENDING_2"
            ? backLegAngle + (10 * Math.PI) / 180
            : backLegAngle
          : leftLegAngle;
      } else if (idx === 1) {
        a = rightLegAngle;
      } else if (idx === 2) {
        a = leftLegAngle;
      } else if (idx === 3) {
        a = isPlanted ? backLegAngle : rightLegAngle;
      }

      let kAngle = this.knockedDownLegAngle || 0;
      if (idx === 0 || idx === 3) kAngle = -kAngle;

      let finalAngle = a + bodyAngle + kAngle;
      if (this.horse.isBeingTased && this.horse.isBeingTased()) {
        finalAngle += (Math.random() - 0.5) * 0.45;
      }

      angles.push(finalAngle);
    }
    return angles;
  }

  updateLayout() {
    this.ensureTintedImages();
    if (!this.tinted || !this.tinted.torso) return;

    const layout = {
      torso: {
        x: 0,
        y: 0,
        angle: 0,
        w: this.tinted.torso.width,
        h: this.tinted.torso.height,
      },
      head: {
        x: 0,
        y: 0,
        angle: 0,
        w: this.tinted.head.width,
        h: this.tinted.head.height,
      },
      tail: {
        x: 0,
        y: 0,
        angle: 0,
        w: this.tinted.tail.width,
        h: this.tinted.tail.height,
      },
      legs: [
        {
          x: 0,
          y: 0,
          angle: 0,
          w: this.tinted.leg.width,
          h: this.tinted.leg.height,
        },
        {
          x: 0,
          y: 0,
          angle: 0,
          w: this.tinted.leg.width,
          h: this.tinted.leg.height,
        },
        {
          x: 0,
          y: 0,
          angle: 0,
          w: this.tinted.leg.width,
          h: this.tinted.leg.height,
        },
        {
          x: 0,
          y: 0,
          angle: 0,
          w: this.tinted.leg.width,
          h: this.tinted.leg.height,
        },
      ],
      bodyY: 0,
      globalRotation: 0,
      stretch: 0,
    };

    if (this.horse.ragdollRotation !== 0)
      layout.globalRotation = this.horse.ragdollRotation;
    else if (this.horse.birthRotation > 0)
      layout.globalRotation = this.horse.birthRotation;

    // Invert rotation if facing left because canvas scale(-1, 1) reverses rotation direction visual
    if (!this.horse.facingRight) layout.globalRotation = -layout.globalRotation;

    let headBobY, tailAngle, headAngle;
    let bodyAngle = this.horse.anim.bodyAngle || 0;

    if (this.horse.isDragging && this.horse.isAlive) {
      layout.bodyY = 0;
      headBobY = 0;
      tailAngle = 0;
      headAngle =
        this.horse.currentStateKey === "SITTING"
          ? this.horse.anim.headAngle
          : (-5 * Math.PI) / 180;
    } else if (!this.horse.isAlive) {
      if (!this.horse.deathSnapshot) {
        // Capture last frame values or default if undefined
        this.horse.deathSnapshot = this.horse.lastFrameAngles || {
          bodyY: 0,
          legAngles: [0, 0, 0, 0],
          headBobY: 0,
          tailAngle: 0,
          headAngle: 0,
          bodyAngle: 0,
        };
      }

      const t = this.horse.deathAnim;
      layout.bodyY = lerp(this.horse.deathSnapshot.bodyY, 25, t);
      headBobY = lerp(this.horse.deathSnapshot.headBobY, 0, t);
      tailAngle = lerp(this.horse.deathSnapshot.tailAngle, Math.PI / 8, t);
      headAngle = lerp(
        this.horse.deathSnapshot.headAngle,
        (40 * Math.PI) / 180,
        t,
      );
      // Interpolate bodyAngle to 0 (flat) from whatever it was
      bodyAngle = lerp(this.horse.deathSnapshot.bodyAngle, 0, t);
    } else {
      layout.bodyY =
        (this.horse.anim.yOffset || 0) +
        Math.sin(this.horse.animPhase) * this.horse.anim.bodyBobAmp +
        (this.knockedDownBodyY || 0);
      headBobY =
        Math.sin(this.horse.animPhase * 1.5) *
        this.horse.anim.headBobAmp *
        this.horse.growth;
      tailAngle =
        Math.sin(this.horse.animPhase * 0.5) * this.horse.anim.tailAmp;
      if (this.horse.currentStateKey === "SLEEPING") {
        tailAngle = 0.2 * Math.PI;
      }
      headAngle = this.horse.anim.headAngle;

      if (this.horse.headKnockTimer > 0) {
        headAngle = lerpAngle(
          headAngle,
          (60 * Math.PI) / 180,
          Math.pow(this.horse.headKnockTimer / headKnockTime, 2),
        );
        bodyAngle = lerpAngle(
          bodyAngle,
          0.1 * Math.PI,
          Math.pow(this.horse.headKnockTimer / headKnockTime, 2),
        );
      }

      if (this.horse.isCrawling && !this.horse.isDragging) {
        layout.bodyY += 20;
      }

      if (this.horse.currentStateKey === "BENDING")
        bodyAngle += Math.sin(this.horse.animPhase) * ((30 * Math.PI) / 180);
      if (this.horse.currentStateKey === "BENDING_2")
        bodyAngle += Math.sin(this.horse.animPhase) * ((10 * Math.PI) / 180);
      if (this.horse.currentStateKey === "RUNNING")
        bodyAngle -= Math.sin(this.horse.animPhase) * 0.15;
    }

    if (this.horse.isBeingTased && this.horse.isBeingTased()) {
      layout.bodyY += (Math.random() - 0.5) * 2.5;
      bodyAngle += (Math.random() - 0.5) * 0.08;
    }

    layout.torso.angle = bodyAngle;
    const tW = layout.torso.w,
      tH = layout.torso.h;

    // Helper to rotate offsets by torso angle
    const rotate = (ox, oy) => {
      const cos = Math.cos(bodyAngle),
        sin = Math.sin(bodyAngle);
      return { x: ox * cos - oy * sin, y: ox * sin + oy * cos };
    };

    // AGENT: leg distance relative to torso
    const frontLegX = tW * 0.3,
      backLegX = -tW * 0.3,
      legY = tH * 0.2;
    const lW = this.tinted.leg.width,
      lH = this.tinted.leg.height;

    const legAngles = this.calculateLegAngles(bodyAngle);

    if (this.horse.isAlive) {
      // Capture angles for death transition
      this.horse.lastFrameAngles = {
        bodyY: layout.bodyY,
        legAngles: [...legAngles],
        headBobY: headBobY,
        tailAngle: tailAngle,
        headAngle: headAngle,
        bodyAngle: bodyAngle,
      };
    }

    const legPos0 = rotate(backLegX, legY);
    const legPos1 = rotate(frontLegX, legY);
    const jabOffset = rotate(this.jabXOffset || 0, 0);

    layout.legs[0] = {
      x: legPos0.x,
      y: legPos0.y,
      angle: legAngles[0],
      w: lW,
      h: lH,
    };
    layout.legs[1] = {
      x: legPos1.x + jabOffset.x,
      y: legPos1.y + jabOffset.y,
      angle: legAngles[1],
      w: lW,
      h: lH,
    };
    layout.legs[2] = {
      x: legPos1.x + (this.horse.facingRight ? 0 : jabOffset.x),
      y: legPos1.y + (this.horse.facingRight ? 0 : jabOffset.y),
      angle: legAngles[2],
      w: lW,
      h: lH,
    };
    layout.legs[3] = {
      x: legPos0.x,
      y: legPos0.y,
      angle: legAngles[3],
      w: lW,
      h: lH,
    };

    if (this.horse.isBeingTased && this.horse.isBeingTased()) {
      for (let i = 0; i < 4; i++) {
        layout.legs[i].x += (Math.random() - 0.5) * 3;
        layout.legs[i].y += (Math.random() - 0.5) * 3;
      }
    }

    const belly = typeof weightBelly === "function" ? weightBelly(this.horse) : 0;
    if (this.horse.isPregnant || this.horse.isSensitive() || belly > 0) {
      let stretch = this.horse.isPregnant ? this.horse.pregnancyTorsoStretch || 0 : 0;
      if (this.horse.isSensitive()) {
        stretch = 1.0;
      }
      // A chubby tummy (Diet.js)
      stretch = Math.max(stretch, belly);
      layout.stretch = stretch * (tH * 0.2);
    }
    layout.fatW = belly * tW * 0.15; // wider too

    // AGENT: head and tail distance relative to torso
    const headPos = rotate(tW * 0.35, -tH * 0.25 + headBobY);
    const tailPos = rotate(-tW * 0.4, -tH * 0.3);

    let headX = headPos.x;
    let headY = headPos.y;
    let finalHeadAngle = headAngle + bodyAngle;

    if (this.horse.isBeingTased && this.horse.isBeingTased()) {
      finalHeadAngle += (Math.random() - 0.5) * 0.5;
      headX += (Math.random() - 0.5) * 4;
      headY += (Math.random() - 0.5) * 4;
    }

    layout.head = {
      x: headX,
      y: headY,
      angle: finalHeadAngle,
      w: this.tinted.head.width,
      h: this.tinted.head.height,
    };
    let tailX = tailPos.x;
    let tailY = tailPos.y;
    let finalTailAngle = tailAngle + bodyAngle;

    if (
      this.horse.limbs &&
      this.horse.limbs.tail &&
      this.horse.isBeingTased &&
      this.horse.isBeingTased()
    ) {
      finalTailAngle += (Math.random() - 0.5) * 0.6;
      tailX += (Math.random() - 0.5) * 3;
      tailY += (Math.random() - 0.5) * 3;
    }

    layout.tail = {
      x: tailX,
      y: tailY,
      angle: finalTailAngle,
      w: this.tinted.tail.width,
      h: this.tinted.tail.height,
    };

    // RAGDOLL OVERRIDE
    const headParts = ["leftEar", "rightEar", "leftEye", "rightEye"];
    const effectiveGrabbedPart = headParts.includes(this.horse.grabbedPart)
      ? "head"
      : this.horse.grabbedPart === "lumps"
        ? "torso"
        : this.horse.grabbedPart;

    if (
      this.horse.isDragging &&
      effectiveGrabbedPart &&
      effectiveGrabbedPart !== "torso"
    ) {
      // globalDown: Angle L such that S * R(g+L) * (0,1) = (0,1). => L = -g.
      const globalDown = -layout.globalRotation;
      // globalUp: Angle L such that S * R(g+L) * (0,1) = (0,-1). => L = PI - g.
      const globalUp = Math.PI - layout.globalRotation;

      // Override Legs
      for (let i = 0; i < 4; i++) {
        if (effectiveGrabbedPart === `leg_${i}`) {
          layout.legs[i].angle = globalUp;
        } else {
          const offset =
            i === 0 || i === 2
              ? this.horse.flailAngle || 0
              : -(this.horse.flailAngle || 0);
          layout.legs[i].angle = globalDown + offset;
        }
      }

      // Override Tail
      if (effectiveGrabbedPart === "tail") layout.tail.angle = globalUp;
      else layout.tail.angle = globalDown;
      if (
        this.horse.limbs &&
        this.horse.limbs.tail &&
        this.horse.isBeingTased &&
        this.horse.isBeingTased()
      ) {
        layout.tail.angle += (Math.random() - 0.5) * 0.6;
      }

      if (effectiveGrabbedPart === "head") layout.head.angle = globalDown;
      else layout.head.angle = globalUp;
    }

    if (this.horse.hasBlockOnBack()) {
      if (this.horse.isStacking) {
        const t = clamp((this.horse.stackingTimer - 1.0) / 2.0, 0, 1);
        const startAngle = -Math.PI / 1.5 - bodyAngle;
        const endAngle = (0 * Math.PI) / 180 - bodyAngle;
        const armAngle = startAngle + t * (endAngle - startAngle);

        layout.legs[1].angle = armAngle + bodyAngle;
        layout.legs[2].angle = armAngle + bodyAngle;

        const armLen = this.tinted.leg.height * 0.8;
        const armEnd = rotate(
          tW * 0.3 + Math.cos(armAngle - bodyAngle) * armLen,
          tH * 0.2 + Math.sin(armAngle - bodyAngle) * armLen,
        );
        layout.block = { x: armEnd.x, y: armEnd.y };
      } else {
        const backPos = rotate(-tW * 0.1, -tH * 0.4);
        layout.block = { x: backPos.x, y: backPos.y };
      }
    }

    // Horn layout (position in head-local space, relative to head pivot)
    if (this.tinted.horn) {
      const hS = this.horse.hornSizeFactor || 1.0;
      const headScale = this.getHeadScale();
      // In head-local space (pivot = 0,0), the horn is drawn at:
      //   ctx.translate(0, (1-hS)*hornH) then ctx.scale(hS,hS)
      //   then drawImage at (head.w*0.5/hS, localOY*1.05/hS)
      // Equivalent top-left in head-local coords (after headScale):
      const hornH = this.tinted.horn.height;
      const hornW = this.tinted.horn.width;
      layout.horn = {
        // X offset from head pivot
        localX: layout.head.w * 0.5 * headScale,
        // Y offset from head pivot (localOY = -head.h*0.85)
        localY:
          -layout.head.h * 0.85 * 1.05 * headScale +
          (1 - hS) * hornH * headScale,
        w: hornW * hS * headScale,
        h: hornH * hS * headScale,
      };
    } else {
      layout.horn = null;
    }

    const hasWingJacket =
      this.horse.accessories &&
      this.horse.accessories["torso"] &&
      this.horse.accessories["torso"].id === "wingjacket";
    // Wing layout (bounding box in torso-local space, from torso center)
    if (this.tinted.wing && !hasWingJacket) {
      const wS = this.horse.wingSizeFactor || 1.0;
      const wingW = this.tinted.wing.width;
      const wingH = this.tinted.wing.height;
      const yAnchorFrac = 0.85;
      // Anchor point in torso-local space
      const wingAnchorX = -layout.torso.w * 0.25;
      const wingAnchorY = -layout.torso.h * 0.75 + wingH * yAnchorFrac;
      // Scaled image drawn at (0, -wingH*yAnchorFrac) from anchor, scaled by wS
      layout.wing = {
        // top-left corner in torso-local space (from torso center)
        x: wingAnchorX,
        y: wingAnchorY - wingH * yAnchorFrac * wS,
        w: wingW * wS,
        h: wingH * wS,
      };
    } else {
      layout.wing = null;
    }

    this.layout = layout;
  }

  drawPortrait(ctx, x, y, size) {
    this.ensureTintedImages();
    if (!this.tinted) return;

    ctx.save();
    ctx.translate(x, y);
    // Scale to fit the requested size, but also account for legs/tail extent and horse growth
    const s = (size / 100) * 0.45 * this.getGrowthScale();
    ctx.scale(s, s);

    const tW = this.tinted.torso.width;
    const tH = this.tinted.torso.height;
    const frontLegX = tW * 0.3;
    const backLegX = -tW * 0.3;
    const legY = tH * 0.2;
    const rightLegAngle = this.horse.tooYoungToWalk() ? Math.PI / 2 : 0.2;
    const leftLegAngle = this.horse.tooYoungToWalk() ? Math.PI / 2 : 0.1;

    // Draw Far Legs (Left side)
    if (this.horse.limbs.legs[2])
      this.drawLeg(ctx, frontLegX, legY, -leftLegAngle);
    if (this.horse.limbs.legs[3])
      this.drawLeg(ctx, backLegX, legY, leftLegAngle);

    // Draw Torso & Parts
    ctx.drawImage(this.tinted.torso, -tW / 2, -tH / 2);
    if (this.tinted.udders) {
      ctx.save();
      const milkScale = 1.0 + (this.horse.milkCharges / 5.0) * 0.5;
      ctx.scale(milkScale, milkScale);
      ctx.drawImage(
        this.tinted.udders,
        -tW / 2.5 / milkScale,
        tH / 3 / milkScale,
      );
      ctx.restore();
    }
    const hasWingJacket =
      this.horse.accessories &&
      this.horse.accessories["torso"] &&
      this.horse.accessories["torso"].id === "wingjacket";
    let visibleWing =
      this.tinted.wing && this.horse.limbs.rightWing && !hasWingJacket;
    if (visibleWing) {
      ctx.save();
      const wS = this.horse.wingSizeFactor || 1.0;
      ctx.scale(wS, wS);
      ctx.drawImage(this.tinted.wing, (-tW * 0.25) / wS, (-tH * 0.75) / wS);
      ctx.restore();
    }

    // Head
    const neckX = tW * 0.35;
    const neckY = -tH * 0.25;
    ctx.save();
    ctx.translate(neckX, neckY);

    if (this.horse.headKnockTimer > 0) {
      ctx.rotate((60 * Math.PI) / 180);
    }

    const headImg = this.tinted.head;
    const pivotX = headImg.width * 0.25;
    const pivotY = headImg.height * 0.85;

    const maneScale = this.getManeScale();
    const headScale = this.getHeadScale();

    // Mane Behind
    if (maneScale > 0 && maneScale < MANE_LAYER_THRESHOLD && this.tinted.mane) {
      ctx.save();
      ctx.scale(maneScale, maneScale);
      ctx.drawImage(this.tinted.mane, -pivotX, -pivotY);
      ctx.restore();
    }

    // Scaled Head Group
    ctx.save();
    ctx.scale(headScale, headScale);

    // Far Ear (Left Ear)
    if (this.horse.limbs.leftEar && this.tinted.ear) {
      ctx.save();
      // Move forward (Positive X in portrait facing right)
      ctx.translate(30, -5);
      ctx.scale(0.95, 0.95);
      ctx.drawImage(this.tinted.ear, -pivotX, -pivotY);
      ctx.restore();
    }

    ctx.drawImage(this.tinted.head, -pivotX, -pivotY);

    if (maneScale >= MANE_LAYER_THRESHOLD && this.tinted.mane) {
      ctx.save();
      const relManeScale = maneScale / headScale;
      ctx.scale(relManeScale, relManeScale);
      ctx.drawImage(this.tinted.mane, -pivotX, -pivotY);
      ctx.restore();
    }

    if (this.horse.limbs.horn && this.tinted.horn) {
      ctx.save();
      const hS = this.horse.hornSizeFactor || 1.0;
      ctx.translate(0, (1 - hS) * this.tinted.horn.height);
      ctx.scale(hS, hS);
      ctx.drawImage(this.tinted.horn, (pivotX * 2.0) / hS, -pivotY / hS);
      ctx.restore();
    }
    if (this.horse.limbs.rightEar && this.tinted.ear) {
      ctx.save();
      const earScale = this.getEarScale();
      ctx.scale(earScale, earScale);

      const eImg = this.tinted.ear;
      const drawX = -20;
      const drawY = -pivotY + 10;

      // Do not flop ears in portrait
      ctx.drawImage(this.tinted.ear, drawX, drawY);
      ctx.restore();
    }

    const eyeX = headImg.width * 0.73 - pivotX;
    const eyeY = headImg.height * 0.5 - pivotY;

    if (this.tinted.eye && this.horse.limbs.rightEye) {
      ctx.drawImage(
        this.tinted.eye,
        eyeX - this.tinted.eye.width / 2,
        eyeY - this.tinted.eye.height / 2,
      );
    }
    if (this.tinted.pupil && this.horse.limbs.rightEye) {
      const img = this.tinted.pupil;
      const alpha = this.horse.isAlive
        ? 1.0
        : Math.max(0.25, 1.0 - (this.horse.deathTimer / 5) * 0.75);
      ctx.save();
      ctx.globalAlpha *= alpha;
      ctx.drawImage(img, eyeX - img.width / 2 + 2, eyeY - img.height / 2 + 2);
      ctx.restore();
    }

    // Blinking (Eyelid)
    if (
      (this.horse.isBlinking || !this.horse.limbs.rightEye) &&
      this.tinted.eyelid
    ) {
      const img = this.tinted.eyelid;
      ctx.drawImage(img, eyeX - img.width / 2, eyeY - img.height / 2);
    }

    // Force neutral mouth
    let mouthImg = images.mouth_neutral;
    if (mouthImg) {
      const mouthX = headImg.width * 0.85 - pivotX;
      const mouthY = headImg.height * 0.8 - pivotY;
      ctx.drawImage(
        mouthImg,
        mouthX - mouthImg.width / 2,
        mouthY - mouthImg.height / 2,
      );
    }

    // Force neutral cheek
    const cheekImg = this.tinted.cheek;
    if (cheekImg) {
      ctx.drawImage(cheekImg, -pivotX, -pivotY);
    }

    ctx.restore(); // End head scale group
    ctx.restore(); // End head translation group

    // Tail
    if (this.horse.limbs.tail) {
      const tailX = -tW * 0.4;
      const tailY = -tH * 0.3;
      ctx.save();
      ctx.translate(tailX, tailY);
      const tailImg = this.tinted.tail;
      ctx.drawImage(tailImg, -tailImg.width * 0.8, -tailImg.height * 0.1);
      ctx.restore();
    }

    // Draw Near Legs (Right side)
    if (this.horse.limbs.legs[0])
      this.drawLeg(ctx, backLegX, legY, rightLegAngle);
    if (this.horse.limbs.legs[1])
      this.drawLeg(ctx, frontLegX, legY, -rightLegAngle);

    ctx.restore();
  }

  drawDream(ctx) {
    if (!this.horse.currentDream) return;
    // A dream from its story (Dreams.js)
    if (typeof this.horse.currentDream === "object") {
      if (typeof drawStoryDream === "function") drawStoryDream(ctx, this.horse);
      return;
    }

    const bx = this.horse.x;
    const by = this.horse.y - 120 * this.horse.scale;

    ctx.save();
    ctx.translate(bx, by);
    // Invert X if facing right
    if (this.horse.facingRight) {
      ctx.scale(-1, 1);
    }

    // Draw cloud-like thought bubble
    ctx.fillStyle = "white";
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.arc(0, 0, 40, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-20, 35, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(-25, 40, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Draw dream image
    const dreamImg = images[`dream_${this.horse.currentDream}`];
    if (dreamImg && dreamImg.complete && dreamImg.width > 0) {
      const s = 0.5;
      ctx.save();
      // Apply horse's dream stretch and angle
      ctx.scale(
        s * (this.horse.dreamStretch ? this.horse.dreamStretch.x : 1.0),
        s * (this.horse.dreamStretch ? this.horse.dreamStretch.y : 1.0),
      );
      ctx.rotate(this.horse.dreamAngle || 0);
      ctx.drawImage(dreamImg, -dreamImg.width * 0.5, -dreamImg.height * 0.5);
      ctx.restore();
    }

    ctx.restore();
  }

  drawOffScreen(ctx, clip = null) {
    if (this.horse.isDestroyed || !this.layout) return;
    this.ensureTintedImages();
    if (!this.tinted) return;

    ctx.save();
    ctx.translate(this.horse.x, this.horse.y);
    ctx.scale(
      this.horse.facingRight ? this.horse.scale : -this.horse.scale,
      this.horse.scale,
    );
    if (this.layout.globalRotation !== 0)
      ctx.rotate(this.layout.globalRotation);

    if (
      !(this.horse.placedOn instanceof ImmobilizationBoard) &&
      !(this.horse.placedOn instanceof LitterpalBox)
    ) {
      ctx.translate(0, this.layout.bodyY);
    }

    // Apply clipping if specified
    if (clip) {
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      const update = (x, y, w, h) => {
        if (clip.left !== undefined) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x + w);
        }
        if (clip.right !== undefined) {
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x + w);
        }
        if (clip.top !== undefined) {
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y + h);
        }
        if (clip.bottom !== undefined) {
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y + h);
        }
      };

      const checkPart = (rect, ox, oy, hAdd = 0) => {
        if (!rect) return;
        update(rect.x + ox, rect.y + oy, rect.w, rect.h + hAdd);
      };

      // Torso
      checkPart(
        this.layout.torso,
        -this.layout.torso.w / 2,
        -this.layout.torso.h / 2,
        this.layout.stretch,
      );

      // Head
      checkPart(
        this.layout.head,
        -this.layout.head.w * 0.25,
        -this.layout.head.h * 0.85,
      );

      // Tail
      if (this.horse.limbs.tail) {
        checkPart(
          this.layout.tail,
          -this.layout.tail.w * 0.8,
          -this.layout.tail.h * 0.1,
        );
      }

      // Legs
      this.layout.legs.forEach((leg, i) => {
        if (this.horse.limbs.legs[i]) {
          checkPart(leg, -leg.w / 2, 0);
        }
      });

      const hasWingJacket =
        this.horse.accessories &&
        this.horse.accessories["torso"] &&
        this.horse.accessories["torso"].id === "wingjacket";
      // Wings
      if (this.tinted.wing && !hasWingJacket) {
        const wingW = this.tinted.wing.width;
        const wingH = this.tinted.wing.height;
        const yAnchorFrac = 0.85;
        const wS = this.horse.wingSizeFactor || 1.0;
        const wingAnchorX = -this.layout.torso.w * 0.25;
        const wingAnchorY = -this.layout.torso.h * 0.75 + wingH * yAnchorFrac;
        update(
          this.layout.torso.x + wingAnchorX,
          this.layout.torso.y + wingAnchorY - wingH * yAnchorFrac * wS,
          wingW * wS,
          wingH * wS,
        );
      }

      let x1 = minX,
        x2 = maxX,
        y1 = minY,
        y2 = maxY;

      if (minX === Infinity) {
        x1 = -10000;
        x2 = 10000;
      }
      if (minY === Infinity) {
        y1 = -10000;
        y2 = 10000;
      }

      if (clip.top !== undefined || clip.bottom !== undefined) {
        const h = maxY - minY;
        if (clip.top !== undefined) y2 = minY + h * clip.top;
        if (clip.bottom !== undefined) y1 = maxY - h * clip.bottom;
      }
      if (clip.left !== undefined || clip.right !== undefined) {
        const w = maxX - minX;
        if (clip.left !== undefined) x2 = minX + w * clip.left;
        if (clip.right !== undefined) x1 = maxX - w * clip.right;
      }

      ctx.beginPath();
      ctx.rect(x1, y1, x2 - x1, y2 - y1);
      ctx.clip();
    }

    const drawPart = (img, rect) => {
      if (!img) return;

      const drawAccessoryLayer = (layer, slotCategory) => {
        if (!this.horse.accessories) return;
        for (const [slot, data] of Object.entries(this.horse.accessories)) {
          const accDef =
            typeof ACCESSORY_DB !== "undefined" ? ACCESSORY_DB[data.id] : null;
          if (!accDef || accDef.layer !== layer) continue;

          if (
            slotCategory === "head" &&
            slot !== "head" &&
            slot !== "eyes" &&
            slot !== "mouth"
          )
            continue;
          if (slotCategory === "head_only" && slot !== "head") continue;
          if (
            slotCategory === "face_only" &&
            slot !== "eyes" &&
            slot !== "mouth"
          )
            continue;
          if (slotCategory === "torso" && slot !== "torso" && slot !== "neck")
            continue;

          const accImg =
            typeof images !== "undefined" ? images[accDef.imageKey] : null;
          if (!accImg || !accImg.complete) continue;

          ctx.save();

          let ox = -rect.w / 2;
          let oy = -rect.h / 2;
          if (rect === this.layout.head) {
            ox = -rect.w * 0.25;
            oy = -rect.h * 0.85;
            const headScale = this.getHeadScale();
            ctx.scale(headScale, headScale);
          }

          // Move to center of part then apply offset
          ctx.translate(
            ox + rect.w / 2 + accDef.offsetX,
            oy + rect.h / 2 + accDef.offsetY,
          );

          if (accDef.canColor && data.color) {
            if (!data.tintedImg || !data.tintedImg.width) {
              data.tintedImg = tintImage(accImg, data.color);
            }
            ctx.drawImage(
              data.tintedImg,
              -data.tintedImg.width / 2,
              -data.tintedImg.height / 2,
            );
          } else {
            ctx.drawImage(accImg, -accImg.width / 2, -accImg.height / 2);
          }
          ctx.restore();
        }
      };
      ctx.save();
      ctx.translate(rect.x, rect.y);
      ctx.rotate(rect.angle);
      let ox = -rect.w / 2,
        oy = -rect.h / 2;
      if (rect === this.layout.head) {
        ox = -rect.w * 0.25;
        oy = -rect.h * 0.85;
      } else if (rect === this.layout.tail) {
        ox = -rect.w * 0.8;
        oy = -rect.h * 0.1;
      } else if (this.layout.legs.includes(rect)) {
        ox = -rect.w / 2;
        oy = 0;
      }

      if (rect === this.layout.torso) {
        drawAccessoryLayer("UNDER_BODY", "torso");
        const fatW = this.layout.fatW || 0;
        ctx.drawImage(img, ox - fatW / 2, oy, rect.w + fatW, rect.h + this.layout.stretch);
        drawAccessoryLayer("OVER_BODY", "torso");
        drawAccessoryLayer("UNDER_HEAD", "torso");
      } else if (rect !== this.layout.head) {
        ctx.drawImage(img, ox, oy, rect.w, rect.h);
      }

      // Overlays for head
      if (rect === this.layout.head) {
        const maneScale = this.getManeScale();
        const headScale = this.getHeadScale();

        // 1. Mane Behind (if applicable)
        if (
          maneScale > 0 &&
          maneScale < MANE_LAYER_THRESHOLD &&
          this.tinted.mane
        ) {
          ctx.save();
          ctx.translate(ox + rect.w * 0.25, oy + rect.h * 0.85); // Pivot
          ctx.scale(maneScale, maneScale);
          ctx.drawImage(this.tinted.mane, -rect.w * 0.25, -rect.h * 0.85);
          ctx.restore();
        }

        // 2. Scaled Head Group
        ctx.save();
        ctx.translate(ox + rect.w * 0.25, oy + rect.h * 0.85); // Pivot
        ctx.scale(headScale, headScale);

        // Draw head relative to pivot
        const localOX = -rect.w * 0.25;
        const localOY = -rect.h * 0.85;

        // Far Ear
        const farEar = this.horse.facingRight
          ? this.horse.limbs.leftEar
          : this.horse.limbs.rightEar;
        if (farEar && this.tinted.ear) {
          ctx.save();
          const flopAngle = this.horse.limbs.earFlopValue || 0;
          const eImg = this.tinted.ear;
          const farX = localOX + 35;
          const farY = localOY + 5;

          ctx.translate(farX, farY);
          ctx.scale(0.95, 0.95);

          if (Math.abs(flopAngle) > 0.01) {
            // Rotate around a point higher than bottom center
            const pivotOffsetUp = 10;
            ctx.translate(eImg.width / 2, eImg.height - pivotOffsetUp);
            ctx.rotate(flopAngle);
            ctx.drawImage(eImg, -eImg.width / 2, -eImg.height + pivotOffsetUp);
          } else {
            ctx.drawImage(eImg, 0, 0);
          }
          ctx.restore();
        }

        ctx.drawImage(this.tinted.head, localOX, localOY, rect.w, rect.h);

        if (this.horse.isSensitive() && this.tinted.sbs_double_chin) {
          ctx.drawImage(
            this.tinted.sbs_double_chin,
            localOX - 10,
            localOY + 100,
          );
        }

        // Mane in front
        if (maneScale >= MANE_LAYER_THRESHOLD && this.tinted.mane) {
          ctx.save();
          // maneScale is world-relative, we need it relative to headScale
          const relManeScale = maneScale / headScale;
          ctx.scale(relManeScale, relManeScale);
          ctx.drawImage(this.tinted.mane, localOX, localOY);
          ctx.restore();
        }

        if (this.horse.limbs.horn && this.tinted.horn) {
          ctx.save();
          const hS = this.horse.hornSizeFactor || 1.0;
          ctx.translate(0, (1 - hS) * this.tinted.horn.height);
          ctx.scale(hS, hS);
          ctx.drawImage(
            this.tinted.horn,
            (rect.w * 0.5) / hS,
            (localOY * 1.05) / hS,
          );
          ctx.restore();
        }

        drawAccessoryLayer("OVER_HEAD", "head_only");

        const eyeX = rect.w * 0.45;
        const eyeY = rect.h * -0.325;
        const pupilX = eyeX + rect.w * 0.02;
        const pupilY = eyeY + rect.h * 0.01;

        const expConfig = this.getExpressionConfig();
        const nearEye = this.horse.facingRight
          ? this.horse.limbs.rightEye
          : this.horse.limbs.leftEye;
        let drawnExp = false;

        if (this.horse.isAlive && nearEye) {
          if (expConfig.eye === "pained" && this.tinted.eye_pained) {
            const img = this.tinted.eye_pained;
            ctx.drawImage(img, eyeX - img.width / 2, eyeY - img.height / 2);
            drawnExp = true;
          } else if (expConfig.eye === "happy" && this.tinted.eye_happy) {
            const img = this.tinted.eye_happy;
            ctx.drawImage(img, eyeX - img.width / 2, eyeY - img.height / 2);
            drawnExp = true;
          }
        }

        if (!drawnExp) {
          if (this.tinted.eye && nearEye) {
            const isCrying =
              this.horse.isAlive && this.horse.tearStreakSize > 0;

            const img = isCrying
              ? this.tinted.eye_pink || this.tinted.eye
              : this.tinted.eye;

            ctx.drawImage(
              img,

              eyeX - img.width / 2,

              eyeY - img.height / 2,
            );
          }

          if (this.tinted.pupil && nearEye) {
            const img = this.tinted.pupil;
            const s = expConfig.pupilSize;

            if (!this.horse.isAlive && this.horse.deathWeapon === "knife") {
              this.horse.pupilOffset.x = lerp(
                this.horse.pupilOffset.x,
                -2,
                0.05,
              );
              this.horse.pupilOffset.y = lerp(
                this.horse.pupilOffset.y,
                -12.5,
                0.05,
              );
            }
            let pOffsetX =
              this.horse.pupilOffset.x + this.horse.pupilTwitchOffset.x;
            let pOffsetY =
              this.horse.pupilOffset.y + this.horse.pupilTwitchOffset.y;

            const alpha = this.horse.isAlive
              ? 1.0
              : Math.max(0.25, 1.0 - (this.horse.deathTimer / 5) * 0.75);
            ctx.save();
            ctx.globalAlpha *= alpha;
            ctx.drawImage(
              img,
              pupilX - (img.width * s) / 2 + pOffsetX,
              pupilY - (img.height * s) / 2 + pOffsetY,
              img.width * s,
              img.height * s,
            );
            ctx.restore();
          }

          if (expConfig.eye === "sad" && this.tinted.eye_sad && nearEye) {
            const img = this.tinted.eye_sad;
            ctx.drawImage(img, eyeX - img.width / 2, eyeY - img.height / 2);
          }

          if (expConfig.eye === "angry" && this.tinted.eye_angry && nearEye) {
            const img = this.tinted.eye_angry;
            ctx.drawImage(img, eyeX - img.width / 2, eyeY - img.height / 2);
          }

          // Blinking (Eyelid)
          if ((this.horse.isBlinking || !nearEye) && this.tinted.eyelid) {
            const img = this.tinted.eyelid;
            ctx.drawImage(img, eyeX - img.width / 2, eyeY - img.height / 2);
          }
        }

        // Draw Mouth
        let mouthImg = null;
        if (expConfig.mouth === "shock") mouthImg = images.mouth_shock;
        else if (expConfig.mouth === "happy") mouthImg = images.mouth_happy;
        else if (expConfig.mouth === "sad") mouthImg = images.mouth_sad;
        else mouthImg = images.mouth_neutral;

        if (mouthImg) {
          const mouthX = rect.w * 0.6;
          const mouthY = rect.h * -0.0;
          ctx.drawImage(
            mouthImg,
            mouthX - mouthImg.width / 2,
            mouthY - mouthImg.height / 2,
          );
        }

        drawAccessoryLayer("OVER_HEAD", "face_only");

        const nearEar = this.horse.facingRight
          ? this.horse.limbs.rightEar
          : this.horse.limbs.leftEar;
        if (nearEar && this.tinted.ear) {
          ctx.save();
          const earScale = this.getEarScale();
          ctx.scale(earScale, earScale);

          const eImg = this.tinted.ear;
          const flopAngle = this.horse.limbs.earFlopValue || 0;
          const pushX = 10;
          const pushY = 10;
          const localX = localOX + pushX;
          const localY = localOY + pushY;

          if (Math.abs(flopAngle) > 0.01) {
            const pivotOffsetUp = 10;
            ctx.translate(
              localX + eImg.width / 2,
              localY + eImg.height - pivotOffsetUp,
            );
            ctx.rotate(flopAngle);
            ctx.drawImage(eImg, -eImg.width / 2, -eImg.height + pivotOffsetUp);
          } else {
            ctx.drawImage(eImg, localX, localY);
          }
          ctx.restore();
        }

        // Draw Cheek
        if (expConfig.cheek) {
          const cheekImg =
            expConfig.cheek === "puffed"
              ? this.tinted.puffed_cheek
              : this.tinted.cheek;
          if (cheekImg) {
            ctx.drawImage(cheekImg, localOX, localOY);
          }
        }

        drawAccessoryLayer("OVER_CHEEKS");

        if (this.horse.tearStreakSize > 0) {
          // Tear stream with 5 unit y difference minimum between streaks
          let fullStartY, fullEndY;
          if (this.isCrying()) {
            fullStartY = eyeY + 12;
            fullEndY = eyeY + 12 + (72 - 12) * this.horse.tearStreakSize;
          } else {
            // Finishing: disappear from top down
            fullStartY =
              eyeY + 12 + (72 - 12) * (1 - this.horse.tearStreakSize);
            fullEndY = eyeY + 72;
          }

          ctx.fillStyle = "rgba(80, 80, 80, 0.65)";
          const segmentHeight = 10;
          const gap = 1 * (Math.sin(this.horse.tearGapPhase) * 0.5 + 0.5);
          const totalPeriod = segmentHeight + gap;

          // Offset the starting point by phase
          let startY_offset =
            fullStartY - (fullStartY % totalPeriod) + this.horse.tearFlowPhase;
          if (startY_offset < fullStartY) startY_offset += totalPeriod;

          for (
            let y = startY_offset - totalPeriod;
            y < fullEndY;
            y += totalPeriod
          ) {
            const segStartY = Math.max(y, fullStartY);
            const segEndY = Math.min(y + segmentHeight, fullEndY);

            if (segEndY > segStartY) {
              ctx.beginPath();
              ctx.moveTo(eyeX - 3, segStartY);
              ctx.lineTo(eyeX - 3, segEndY);
              ctx.lineTo(eyeX + 3, segEndY);
              ctx.lineTo(eyeX + 3, segStartY);
              ctx.fill();
            }
          }
        }

        ctx.restore(); // End head scale group
      }
      ctx.restore();
    };

    // Draw Far Legs
    const farLegs = this.horse.facingRight ? [2, 3] : [0, 1];
    for (const i of farLegs) {
      if (this.horse.limbs.legs[i])
        drawPart(this.tinted.leg, this.layout.legs[i]);
    }

    // Torso & Overlays
    drawPart(this.tinted.torso, this.layout.torso);
    if (typeof drawScars === "function" && this.horse.scars) drawScars(ctx, this, "torso"); // Scars.js
    if (this.tinted.udders && !this.horse.tooYoungToWalk()) {
      const tW = this.layout.torso.w,
        tH = this.layout.torso.h;
      ctx.save();
      ctx.translate(this.layout.torso.x, this.layout.torso.y);
      ctx.rotate(this.layout.torso.angle);

      // Udder Scale based on milk charges
      const milkScale = 1.0 + (this.horse.milkCharges / 5.0) * 0.5;
      ctx.scale(milkScale, milkScale);

      ctx.drawImage(
        this.tinted.udders,
        -tW / 2.5 / milkScale,
        (tH / 3 + this.layout.stretch * 0.8) / milkScale,
      );
      ctx.restore();
    }
    if (
      this.horse.gender === "male" &&
      this.tinted.special_lumps &&
      this.horse.limbs.lumps &&
      !this.horse.tooYoungToWalk()
    ) {
      const tW = this.layout.torso.w,
        tH = this.layout.torso.h;
      ctx.save();
      ctx.translate(this.layout.torso.x, this.layout.torso.y);
      ctx.rotate(this.layout.torso.angle);
      ctx.drawImage(
        this.tinted.special_lumps,
        -tW * 0.3,
        tH * 0.4 + this.layout.stretch * 0.8,
      );
      ctx.restore();
    }

    if (
      this.horse.accessories &&
      this.horse.accessories["ABOVE_LUMPS"] &&
      this.horse.gender === "male" &&
      this.horse.limbs.lumps &&
      !this.horse.tooYoungToWalk()
    ) {
      const accData = this.horse.accessories["ABOVE_LUMPS"];
      const accDef =
        typeof ACCESSORY_DB !== "undefined" ? ACCESSORY_DB[accData.id] : null;
      if (accDef) {
        const accImg =
          typeof images !== "undefined" ? images[accDef.imageKey] : null;
        if (accImg && accImg.complete) {
          const tW = this.layout.torso.w,
            tH = this.layout.torso.h;
          ctx.save();
          ctx.translate(this.layout.torso.x, this.layout.torso.y);
          ctx.rotate(this.layout.torso.angle);
          const bandX = -tW * 0.3 + (accDef.offsetX || 0);
          const bandY =
            tH * 0.35 + this.layout.stretch * 0.8 + (accDef.offsetY || 0);
          const accScale = accDef.scale !== undefined ? accDef.scale : 1.0;

          ctx.translate(bandX, bandY);
          ctx.scale(accScale, accScale);

          if (accDef.canColor && accData.color) {
            if (!accData.tintedImg || !accData.tintedImg.width) {
              accData.tintedImg = tintImage(accImg, accData.color);
            }
            ctx.drawImage(accData.tintedImg, 0, 0);
          } else {
            ctx.drawImage(accImg, 0, 0);
          }
          ctx.restore();
        }
      }
    }

    const hasWingJacket =
      this.horse.accessories &&
      this.horse.accessories["torso"] &&
      this.horse.accessories["torso"].id === "wingjacket";
    let visibleWing =
      this.tinted.wing &&
      !hasWingJacket &&
      ((this.horse.facingRight && this.horse.limbs.rightWing) ||
        (!this.horse.facingRight && this.horse.limbs.leftWing));
    if (visibleWing) {
      ctx.save();
      ctx.translate(this.layout.torso.x, this.layout.torso.y);
      ctx.rotate(this.layout.torso.angle);

      const wingYScale =
        this.horse.wingFlapPhase > 0 ? Math.cos(this.horse.wingFlapPhase) : 1.0;

      const wingW = this.tinted.wing.width;
      const wingH = this.tinted.wing.height;
      const wingAnchorX = -this.layout.torso.w * 0.25;
      const yAnchorFrac = 0.85;
      const wingAnchorY = -this.layout.torso.h * 0.75 + wingH * yAnchorFrac;

      const wS = this.horse.wingSizeFactor || 1.0;
      ctx.translate(wingAnchorX, wingAnchorY);
      ctx.scale(wS, wingYScale * wS);

      ctx.drawImage(this.tinted.wing, 0, -wingH * yAnchorFrac);
      ctx.restore();
    }

    drawPart(this.tinted.head, this.layout.head);
    if (this.horse.limbs.tail) drawPart(this.tinted.tail, this.layout.tail);
    if (typeof drawScars === "function" && this.horse.scars) {
      drawScars(ctx, this, "head");
      if (this.horse.limbs.tail) drawScars(ctx, this, "tail");
    }
    // A party hat (HouseLife.js)
    if (this.horse.partyHat && typeof drawPartyHat === "function") drawPartyHat(ctx, this);

    // Near Legs
    const nearLegs = this.horse.facingRight ? [0, 1] : [2, 3];
    for (const i of nearLegs) {
      if (this.horse.limbs.legs[i])
        drawPart(this.tinted.leg, this.layout.legs[i]);
    }

    ctx.restore();
  }

  drawSpeechBubble(ctx) {
    const padding = 10;
    const maxWidth = 250;
    ctx.font = "16px Arial";

    const lines = wrapText(ctx, this.horse.speech.text, maxWidth - padding * 2);

    let maxLineWidth = 0;
    for (const line of lines) {
      maxLineWidth = Math.max(maxLineWidth, ctx.measureText(line).width);
    }

    const bubbleW = maxLineWidth + padding * 2;
    const lineHeight = 20;
    const bubbleH = lines.length * lineHeight + padding;

    const bx = this.horse.x - bubbleW / 2;
    const by =
      this.horse.y - 120 * Math.sqrt(this.horse.scale * 2.0) - (bubbleH - 30);

    ctx.save();
    ctx.globalAlpha = this.horse.speech.opacity;
    ctx.fillStyle = "white";
    ctx.strokeStyle = "black";
    ctx.lineWidth = 2;
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(bx, by, bubbleW, bubbleH, 10);
    } else {
      ctx.rect(bx, by, bubbleW, bubbleH);
    }
    ctx.fill();
    ctx.stroke();

    // Tail pointing to fluffy
    ctx.beginPath();
    ctx.moveTo(this.horse.x - 5, by + bubbleH);
    ctx.lineTo(this.horse.x + 5, by + bubbleH);
    ctx.lineTo(this.horse.x, by + bubbleH + 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "black";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";

    lines.forEach((line, i) => {
      ctx.fillText(line, bx + padding, by + padding + i * lineHeight);
    });

    ctx.restore();
  }

  drawLeg(ctx, x, y, angle) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const legImg = this.tinted.leg;
    ctx.drawImage(legImg, -legImg.width / 2, 0);
    ctx.restore();
  }
}
