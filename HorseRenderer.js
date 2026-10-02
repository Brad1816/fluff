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

    let globalRotation = 0;
    if (this.horse.ragdollRotation !== 0)
      globalRotation = this.horse.ragdollRotation;
    else if (this.horse.birthRotation > 0)
      globalRotation = this.horse.birthRotation;

    // Invert rotation if facing left because canvas scale(-1, 1) reverses rotation direction visual
    if (!this.horse.facingRight) globalRotation = -globalRotation;

    let bodyY, headBobY, tailAngle, headAngle;
    let bodyAngle = this.horse.anim.bodyAngle || 0;

    if (this.horse.isDragging && this.horse.isAlive) {
      bodyY = 0;
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
      bodyY = lerp(this.horse.deathSnapshot.bodyY, 25, t);
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
      bodyY =
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
        bodyY += 20;
      }

      if (this.horse.currentStateKey === "BENDING")
        bodyAngle += Math.sin(this.horse.animPhase) * ((30 * Math.PI) / 180);
      if (this.horse.currentStateKey === "BENDING_2")
        bodyAngle += Math.sin(this.horse.animPhase) * ((10 * Math.PI) / 180);
      if (this.horse.currentStateKey === "RUNNING")
        bodyAngle -= Math.sin(this.horse.animPhase) * 0.15;
    }

    const isTased = this.horse.isBeingTased && this.horse.isBeingTased();
    if (isTased) {
      bodyY += (Math.random() - 0.5) * 2.5;
      bodyAngle += (Math.random() - 0.5) * 0.08;
    }

    const legAngles = this.calculateLegAngles(bodyAngle);

    if (this.horse.isAlive) {
      // Capture angles for death transition
      this.horse.lastFrameAngles = {
        bodyY: bodyY,
        legAngles: [...legAngles],
        headBobY: headBobY,
        tailAngle: tailAngle,
        headAngle: headAngle,
        bodyAngle: bodyAngle,
      };
    }

    const layout = this.buildLayout({
      globalRotation,
      bodyY,
      bodyAngle,
      headBobY,
      headAngle,
      tailAngle,
      legAngles,
      jabXOffset: this.jabXOffset || 0,
      facingRight: this.horse.facingRight,
    });

    if (isTased) {
      for (let i = 0; i < 4; i++) {
        layout.legs[i].x += (Math.random() - 0.5) * 3;
        layout.legs[i].y += (Math.random() - 0.5) * 3;
      }
      layout.head.angle += (Math.random() - 0.5) * 0.5;
      layout.head.x += (Math.random() - 0.5) * 4;
      layout.head.y += (Math.random() - 0.5) * 4;
      if (this.horse.limbs && this.horse.limbs.tail) {
        layout.tail.angle += (Math.random() - 0.5) * 0.6;
        layout.tail.x += (Math.random() - 0.5) * 3;
        layout.tail.y += (Math.random() - 0.5) * 3;
      }
    }

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
      if (this.horse.limbs && this.horse.limbs.tail && isTased) {
        layout.tail.angle += (Math.random() - 0.5) * 0.6;
      }

      if (effectiveGrabbedPart === "head") layout.head.angle = globalDown;
      else layout.head.angle = globalUp;
    }

    if (this.horse.hasBlockOnBack()) {
      const tW = layout.torso.w,
        tH = layout.torso.h;
      const rotate = (ox, oy) => {
        const cos = Math.cos(bodyAngle),
          sin = Math.sin(bodyAngle);
        return { x: ox * cos - oy * sin, y: ox * sin + oy * cos };
      };
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

    this.layout = layout;
  }

  // Positions every body part (torso-local) for the given pose. Shared by the
  // live renderer and snapshots.
  buildLayout(pose) {
    const bodyAngle = pose.bodyAngle;
    const tW = this.tinted.torso.width,
      tH = this.tinted.torso.height;
    const lW = this.tinted.leg.width,
      lH = this.tinted.leg.height;

    // Helper to rotate offsets by torso angle
    const rotate = (ox, oy) => {
      const cos = Math.cos(bodyAngle),
        sin = Math.sin(bodyAngle);
      return { x: ox * cos - oy * sin, y: ox * sin + oy * cos };
    };

    const layout = {
      torso: { x: 0, y: 0, angle: bodyAngle, w: tW, h: tH },
      head: null,
      tail: null,
      legs: [],
      bodyY: pose.bodyY,
      globalRotation: pose.globalRotation,
      stretch: 0,
    };

    // AGENT: leg distance relative to torso
    const frontLegX = tW * 0.3,
      backLegX = -tW * 0.3,
      legY = tH * 0.2;

    const legPos0 = rotate(backLegX, legY);
    const legPos1 = rotate(frontLegX, legY);
    const jabOffset = rotate(pose.jabXOffset, 0);
    const jabbedLegPos1 = {
      x: legPos1.x + jabOffset.x,
      y: legPos1.y + jabOffset.y,
    };
    const legPositions = [
      legPos0,
      jabbedLegPos1,
      pose.facingRight ? legPos1 : jabbedLegPos1,
      legPos0,
    ];
    layout.legs = legPositions.map((pos, i) => ({
      x: pos.x,
      y: pos.y,
      angle: pose.legAngles[i],
      w: lW,
      h: lH,
    }));

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
    const headPos = rotate(tW * 0.35, -tH * 0.25 + pose.headBobY);
    const tailPos = rotate(-tW * 0.4, -tH * 0.3);

    layout.head = {
      x: headPos.x,
      y: headPos.y,
      angle: pose.headAngle + bodyAngle,
      w: this.tinted.head.width,
      h: this.tinted.head.height,
    };
    layout.tail = {
      x: tailPos.x,
      y: tailPos.y,
      angle: pose.tailAngle + bodyAngle,
      w: this.tinted.tail.width,
      h: this.tinted.tail.height,
    };

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

    return layout;
  }

  // Draws a static picture of the horse centered at (x, y): standing (or
  // crawling if too young/SBS), facing right, neutral expression, no accessories.
  drawSnapshot(ctx, x, y, size) {
    this.ensureTintedImages();
    if (!this.tinted || !this.tinted.torso) return;

    const crawling = this.horse.tooYoungToWalk();
    const layout = this.buildLayout({
      globalRotation: 0,
      bodyY: crawling ? 20 : 0,
      bodyAngle: 0,
      headBobY: 0,
      headAngle: 0,
      tailAngle: 0,
      legAngles: crawling
        ? [Math.PI / 2, -Math.PI / 2, -Math.PI / 2, Math.PI / 2]
        : [0, 0, 0, 0],
      jabXOffset: 0,
      facingRight: true,
    });

    ctx.save();
    ctx.translate(x, y);
    // Scale to fit the requested size, accounting for horse growth
    const s = (size / 100) * 0.45 * this.getGrowthScale();
    ctx.scale(s, s);
    ctx.translate(0, layout.bodyY);
    this.drawBody(ctx, layout, this.getSnapshotView());
    ctx.restore();
  }

  // Per-frame visual state drawBody needs for the live horse
  getLiveView() {
    const h = this.horse;
    if (!h.isAlive && h.deathWeapon === "knife") {
      h.pupilOffset.x = lerp(h.pupilOffset.x, -2, 0.05);
      h.pupilOffset.y = lerp(h.pupilOffset.y, -12.5, 0.05);
    }
    return {
      facingRight: h.facingRight,
      isAlive: h.isAlive,
      expression: this.getExpressionConfig(),
      eyesClosed: h.isBlinking,
      earFlop: h.limbs.earFlopValue || 0,
      wingYScale: h.wingFlapPhase > 0 ? Math.cos(h.wingFlapPhase) : 1.0,
      pupilOffset: {
        x: h.pupilOffset.x + h.pupilTwitchOffset.x,
        y: h.pupilOffset.y + h.pupilTwitchOffset.y,
      },
      pupilAlpha: h.isAlive
        ? 1.0
        : Math.max(0.25, 1.0 - (h.deathTimer / 5) * 0.75),
      tears:
        h.tearStreakSize > 0
          ? {
              size: h.tearStreakSize,
              crying: this.isCrying(),
              flowPhase: h.tearFlowPhase,
              gapPhase: h.tearGapPhase,
            }
          : null,
      accessories: true,
    };
  }

  // Neutral visual state for snapshots
  getSnapshotView() {
    return {
      facingRight: true,
      isAlive: true,
      expression: getExpressionConfig("NEUTRAL"),
      eyesClosed: !this.horse.eyesHaveGrown() || this.horse.isSensitive(),
      earFlop: 0,
      wingYScale: 1.0,
      pupilOffset: { x: 0, y: 0 },
      pupilAlpha: 1.0,
      tears: null,
      accessories: false,
    };
  }

  // Puffy cloud outline: a ring of lobes around a core. Strokes go down first
  // and the fills cover them, so only the outer scalloped edge stays outlined.
  drawDreamCloud(ctx) {
    const lobeCount = 9;
    const ringRadius = 34;
    const lobeRadius = 13;
    const lobes = [];
    for (let i = 0; i < lobeCount; i++) {
      const a = (i / lobeCount) * Math.PI * 2;
      // Alternate lobe sizes slightly so it doesn't look too regular
      const r = lobeRadius * (i % 2 === 0 ? 1.0 : 0.85);
      lobes.push({ x: Math.cos(a) * ringRadius, y: Math.sin(a) * ringRadius, r });
    }

    ctx.beginPath();
    for (const l of lobes) {
      ctx.moveTo(l.x + l.r, l.y);
      ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    }
    ctx.stroke();

    ctx.beginPath();
    for (const l of lobes) {
      ctx.moveTo(l.x + l.r, l.y);
      ctx.arc(l.x, l.y, l.r, 0, Math.PI * 2);
    }
    ctx.moveTo(ringRadius, 0);
    ctx.arc(0, 0, ringRadius, 0, Math.PI * 2);
    ctx.fill("nonzero");
  }

  drawDream(ctx) {
    const progress = this.horse.dreamBubbleProgress || 0;
    if (!this.horse.shownDream || progress <= 0) return;
    // A dream from its story (Dreams.js), popping in and out the same way
    if (typeof this.horse.shownDream === "object") {
      if (typeof drawStoryDream !== "function") return;
      const c = 1.70158;
      const t = clamp(progress, 0, 1);
      const s = 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
      const ax = this.horse.x;
      const ay = this.horse.y - 80 * this.horse.scale; // (grows from its head)
      ctx.save();
      ctx.translate(ax, ay);
      ctx.scale(s, s);
      ctx.translate(-ax, -ay);
      drawStoryDream(ctx, this.horse);
      ctx.restore();
      return;
    }

    // Stage a bubble's pop-in within the overall progress (with a slight overshoot)
    const stage = (start, end) => {
      const t = clamp((progress - start) / (end - start), 0, 1);
      if (t <= 0) return 0;
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    };
    const pulse = (offset) =>
      1 +
      Math.sin(this.horse.dreamPulsePhase + offset) * DREAM_BUBBLE_PULSE_AMOUNT;

    const sizeScale = this.horse.scale / DREAM_BUBBLE_REFERENCE_SCALE;
    const bx = this.horse.x;
    const by = this.horse.y - 120 * this.horse.scale;

    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(sizeScale, sizeScale);
    // Invert X if facing right
    if (this.horse.facingRight) {
      ctx.scale(-1, 1);
    }

    // Draw cloud-like thought bubble, smallest trailing bubble first
    ctx.fillStyle = "white";
    ctx.strokeStyle = "#ccc";
    ctx.lineWidth = 2;

    const drawCircle = (x, y, r) => {
      if (r <= 0) return;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    };
    drawCircle(-32, 40, 4 * stage(0, 0.3) * pulse(1.2));
    drawCircle(-25, 35, 8 * stage(0.2, 0.5) * pulse(0.6));

    const mainScale = stage(0.4, 1.0) * pulse(0);
    if (mainScale <= 0) {
      ctx.restore();
      return;
    }
    ctx.scale(mainScale, mainScale);
    this.drawDreamCloud(ctx);

    // Draw dream image
    const dreamImg = images[`dream_${this.horse.shownDream}`];
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

  drawShadow(ctx) {
    if (this.horse.isDestroyed || !this.layout) return;
    if (this.horse._riding) return; // (on its mum's back: Carrying.js)
    if (
      this.horse.currentCage instanceof Cage ||
      this.horse.currentCage instanceof FoalInACan
    )
      return;
    if (this.horse.drowningTimer >= 5) return;

    let alpha =
      typeof HORSE_SHADOW_ALPHA !== "undefined" ? HORSE_SHADOW_ALPHA : 0.25;
    if (this.horse.drowningTimer > 0) {
      alpha *= Math.max(0, 1.0 - this.horse.drowningTimer / 5.0);
      if (alpha <= 0.001) return;
    }

    const s = Math.abs(this.horse.scale) || 0.5;
    const baseRx = HORSE_SHADOW_BASE_RADIUS_X;
    const baseRy = HORSE_SHADOW_BASE_RADIUS_Y;

    const shadowX = this.horse.x;
    let shadowY = this.horse.y + 83.2 * s;
    if (this.horse.heldWithThrowTool || this.horse.isFallingFromThrow) {
      if (typeof this.horse.throwShadowY === "number" && !isNaN(this.horse.throwShadowY)) {
        shadowY = this.horse.throwShadowY;
      }
    } else if (typeof this.horse.getBottomY === "function") {
      const bY = this.horse.getBottomY();
      if (typeof bY === "number" && !isNaN(bY)) {
        shadowY = bY;
      }
    }

    let heightInAir = 0;
    if (this.horse.heldWithThrowTool || this.horse.isFallingFromThrow) {
      if (typeof this.horse.throwStartY === "number") {
        heightInAir = Math.max(0, this.horse.throwStartY - this.horse.y);
      } else {
        heightInAir = Math.max(0, shadowY - (this.horse.y + 83.2 * s));
      }
    } else {
      heightInAir = Math.max(0, shadowY - (this.horse.y + 83.2 * s));
    }

    const heightFactor = 1 / (1 + heightInAir / 250);
    const radiusX = Math.max(1.5, baseRx * s * heightFactor);
    const radiusY = Math.max(1.0, baseRy * s * heightFactor);

    ctx.save();
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.beginPath();
    ctx.ellipse(shadowX, shadowY, radiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawOffScreen(ctx, clip = null) {
    if (this.horse.isDestroyed || !this.layout) return;
    this.ensureTintedImages();
    if (!this.tinted) return;

    if (this.horse.drowningTimer <= 0) {
        this.drawShadow(ctx);
    }

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

    this.drawBody(ctx, this.layout, this.getLiveView());

    ctx.restore();
  }

  // Draws the horse's parts at the current origin using the given layout and
  // view (visual state: expression, blinking, tears, etc.)
  drawBody(ctx, layout, view) {
    const drawPart = (img, rect) => {
      if (!img) return;

      const drawAccessoryLayer = (layer, slotCategory) => {
        if (!view.accessories || !this.horse.accessories) return;
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
          if (rect === layout.head) {
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
      if (rect === layout.head) {
        ox = -rect.w * 0.25;
        oy = -rect.h * 0.85;
      } else if (rect === layout.tail) {
        ox = -rect.w * 0.8;
        oy = -rect.h * 0.1;
      } else if (layout.legs.includes(rect)) {
        ox = -rect.w / 2;
        oy = 0;
      }

      if (rect === layout.torso) {
        drawAccessoryLayer("UNDER_BODY", "torso");
        const fatW = layout.fatW || 0;
        ctx.drawImage(img, ox - fatW / 2, oy, rect.w + fatW, rect.h + layout.stretch);
        drawAccessoryLayer("OVER_BODY", "torso");
        drawAccessoryLayer("UNDER_HEAD", "torso");
      } else if (rect !== layout.head) {
        ctx.drawImage(img, ox, oy, rect.w, rect.h);
      }

      // Overlays for head
      if (rect === layout.head) {
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
        const farEar = view.facingRight
          ? this.horse.limbs.leftEar
          : this.horse.limbs.rightEar;
        if (farEar && this.tinted.ear) {
          ctx.save();
          const flopAngle = view.earFlop;
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

        const expConfig = view.expression;
        const nearEye = view.facingRight
          ? this.horse.limbs.rightEye
          : this.horse.limbs.leftEye;
        let drawnExp = false;

        if (view.isAlive && nearEye) {
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
            const isCrying = view.isAlive && view.tears !== null;

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

            const pOffsetX = view.pupilOffset.x;
            const pOffsetY = view.pupilOffset.y;

            ctx.save();
            ctx.globalAlpha *= view.pupilAlpha;
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
          if ((view.eyesClosed || !nearEye) && this.tinted.eyelid) {
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

        const nearEar = view.facingRight
          ? this.horse.limbs.rightEar
          : this.horse.limbs.leftEar;
        if (nearEar && this.tinted.ear) {
          ctx.save();
          const earScale = this.getEarScale();
          ctx.scale(earScale, earScale);

          const eImg = this.tinted.ear;
          const flopAngle = view.earFlop;
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

        if (view.tears) {
          const tears = view.tears;
          // Tear stream with 5 unit y difference minimum between streaks
          let fullStartY, fullEndY;
          if (tears.crying) {
            fullStartY = eyeY + 12;
            fullEndY = eyeY + 12 + (72 - 12) * tears.size;
          } else {
            // Finishing: disappear from top down
            fullStartY = eyeY + 12 + (72 - 12) * (1 - tears.size);
            fullEndY = eyeY + 72;
          }

          ctx.fillStyle = "rgba(80, 80, 80, 0.65)";
          const segmentHeight = 10;
          const gap = 1 * (Math.sin(tears.gapPhase) * 0.5 + 0.5);
          const totalPeriod = segmentHeight + gap;

          // Offset the starting point by phase
          let startY_offset =
            fullStartY - (fullStartY % totalPeriod) + tears.flowPhase;
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
    const farLegs = view.facingRight ? [2, 3] : [0, 1];
    for (const i of farLegs) {
      if (this.horse.limbs.legs[i])
        drawPart(this.tinted.leg, layout.legs[i]);
    }

    // Torso & Overlays
    drawPart(this.tinted.torso, layout.torso);
    if (typeof drawScars === "function" && this.horse.scars) drawScars(ctx, this, "torso", layout); // Scars.js
    if (this.tinted.udders && !this.horse.tooYoungToWalk()) {
      const tW = layout.torso.w,
        tH = layout.torso.h;
      ctx.save();
      ctx.translate(layout.torso.x, layout.torso.y);
      ctx.rotate(layout.torso.angle);

      // Udder Scale based on milk charges
      const milkScale = 1.0 + (this.horse.milkCharges / 5.0) * 0.5;
      ctx.scale(milkScale, milkScale);

      ctx.drawImage(
        this.tinted.udders,
        -tW / 2.5 / milkScale,
        (tH / 3 + layout.stretch * 0.8) / milkScale,
      );
      ctx.restore();
    }
    if (
      this.horse.gender === "male" &&
      this.tinted.special_lumps &&
      this.horse.limbs.lumps &&
      !this.horse.tooYoungToWalk()
    ) {
      const tW = layout.torso.w,
        tH = layout.torso.h;
      ctx.save();
      ctx.translate(layout.torso.x, layout.torso.y);
      ctx.rotate(layout.torso.angle);
      ctx.drawImage(
        this.tinted.special_lumps,
        -tW * 0.3,
        tH * 0.4 + layout.stretch * 0.8,
      );
      ctx.restore();
    }

    if (
      view.accessories &&
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
          const tW = layout.torso.w,
            tH = layout.torso.h;
          ctx.save();
          ctx.translate(layout.torso.x, layout.torso.y);
          ctx.rotate(layout.torso.angle);
          const bandX = -tW * 0.3 + (accDef.offsetX || 0);
          const bandY =
            tH * 0.35 + layout.stretch * 0.8 + (accDef.offsetY || 0);
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
      view.accessories &&
      this.horse.accessories &&
      this.horse.accessories["torso"] &&
      this.horse.accessories["torso"].id === "wingjacket";
    let visibleWing =
      this.tinted.wing &&
      !hasWingJacket &&
      ((view.facingRight && this.horse.limbs.rightWing) ||
        (!view.facingRight && this.horse.limbs.leftWing));
    if (visibleWing) {
      ctx.save();
      ctx.translate(layout.torso.x, layout.torso.y);
      ctx.rotate(layout.torso.angle);

      const wingYScale = view.wingYScale;

      const wingW = this.tinted.wing.width;
      const wingH = this.tinted.wing.height;
      const wingAnchorX = -layout.torso.w * 0.25;
      const yAnchorFrac = 0.85;
      const wingAnchorY = -layout.torso.h * 0.75 + wingH * yAnchorFrac;

      const wS = this.horse.wingSizeFactor || 1.0;
      ctx.translate(wingAnchorX, wingAnchorY);
      ctx.scale(wS, wingYScale * wS);

      ctx.drawImage(this.tinted.wing, 0, -wingH * yAnchorFrac);
      ctx.restore();
    }

    drawPart(this.tinted.head, layout.head);
    if (this.horse.limbs.tail) drawPart(this.tinted.tail, layout.tail);
    if (typeof drawScars === "function" && this.horse.scars) {
      drawScars(ctx, this, "head", layout);
      if (this.horse.limbs.tail) drawScars(ctx, this, "tail", layout);
    }
    // A party hat (HouseLife.js)
    if (view.accessories && this.horse.partyHat && typeof drawPartyHat === "function") drawPartyHat(ctx, this, layout);

    // Near Legs
    const nearLegs = view.facingRight ? [0, 1] : [2, 3];
    for (const i of nearLegs) {
      if (this.horse.limbs.legs[i])
        drawPart(this.tinted.leg, layout.legs[i]);
    }
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

}
