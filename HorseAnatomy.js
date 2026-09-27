class HorseAnatomy {
  constructor(horse) {
    this.horse = horse;
  }

  amputate(part, weapon = null) {
    this.horse.bloodTolerance = 1;
    this.horse.bloodReactionTimer = 15;
    this.horse.bleedingTimer =
      weapon &&
      (weapon.type === "scalpel")
        ? 0
        : 10;
    this.horse.sleepTargetSet = false;
    if (part === "head") {
      const nearEar = this.horse.facingRight ? "rightEar" : "leftEar";
      const farEar = this.horse.facingRight ? "leftEar" : "rightEar";
      const nearEye = this.horse.facingRight ? "rightEye" : "leftEye";
      const farEye = this.horse.facingRight ? "leftEye" : "rightEye";

      if (this.horse.limbs[nearEar]) {
        this.horse.limbs[nearEar] = false;
        return nearEar;
      }
      if (this.horse.limbs[nearEye]) {
        this.horse.limbs[nearEye] = false;
        return nearEye;
      }
      if (this.horse.limbs[farEar]) {
        this.horse.limbs[farEar] = false;
        return farEar;
      }
      if (this.horse.limbs[farEye]) {
        this.horse.limbs[farEye] = false;
        return farEye;
      }
    } else if (part === "leftEar" || part === "left_ear") {
      if (this.horse.limbs.leftEar) {
        this.horse.limbs.leftEar = false;
        return "leftEar";
      }
    } else if (part === "rightEar" || part === "right_ear") {
      if (this.horse.limbs.rightEar) {
        this.horse.limbs.rightEar = false;
        return "rightEar";
      }
    } else if (part === "leftEye" || part === "left_eye") {
      if (this.horse.limbs.leftEye) {
        this.horse.limbs.leftEye = false;
        return "leftEye";
      }
    } else if (part === "rightEye" || part === "right_eye") {
      if (this.horse.limbs.rightEye) {
        this.horse.limbs.rightEye = false;
        return "rightEye";
      }
    } else if (part === "tail") {
      if (this.horse.limbs.tail) {
        this.horse.limbs.tail = false;
        return "tail";
      }
    } else if (part === "lumps" || part === "special_lumps") {
      if (this.horse.limbs.lumps) {
        this.horse.limbs.lumps = false;
        return "lumps";
      }
    } else if (part === "spay") {
      if (!this.horse.spayed && this.horse.gender === "female") {
        this.horse.spayed = true;
        return "spay";
      }
    } else if (part === "udders" || part === "horse_udders") {
      if (this.horse.limbs.udders) {
        this.horse.limbs.udders = false;
        return "udders";
      }
    } else if (part && part.startsWith("leg_")) {
      const idx = parseInt(part.split("_")[1]);
      if (this.horse.limbs.legs[idx]) {
        this.horse.limbs.legs[idx] = false;
        return part;
      }
    } else if (part === "horn") {
      if (this.horse.limbs.horn) {
        this.horse.limbs.horn = false;
        return "horn";
      }
    } else if (part === "leftWing") {
      if (this.horse.limbs.leftWing) {
        this.horse.limbs.leftWing = false;
        return "leftWing";
      }
    } else if (part === "rightWing") {
      if (this.horse.limbs.rightWing) {
        this.horse.limbs.rightWing = false;
        return "rightWing";
      }
    }
    return null;
  }

  getMissingBodyParts() {
    const missing = [];
    if (!this.horse || !this.horse.limbs) return missing;

    if (Array.isArray(this.horse.limbs.legs)) {
      if (!this.horse.limbs.legs[1]) missing.push("front right leg");
      if (!this.horse.limbs.legs[2]) missing.push("front left leg");
      if (!this.horse.limbs.legs[0]) missing.push("back right leg");
      if (!this.horse.limbs.legs[3]) missing.push("back left leg");
    }
    if (!this.horse.limbs.tail) missing.push("tail");
    if (!this.horse.limbs.leftEar) missing.push("left ear");
    if (!this.horse.limbs.rightEar) missing.push("right ear");
    if (!this.horse.limbs.leftEye) missing.push("left eye");
    if (!this.horse.limbs.rightEye) missing.push("right eye");

    if (this.horse.type === "pegasus" || this.horse.type === "alicorn") {
      if (!this.horse.limbs.leftWing) missing.push("left wing");
      if (!this.horse.limbs.rightWing) missing.push("right wing");
    }
    if (this.horse.type === "unicorn" || this.horse.type === "alicorn") {
      if (!this.horse.limbs.horn) missing.push("horn");
    }

    if (this.horse.gender === "male" && !this.horse.limbs.lumps) {
      missing.push("lumps");
    }
    if (this.horse.gender === "female" && !this.horse.limbs.udders) {
      missing.push("udders");
    }

    return missing;
  }

  getMissingBodyPartsText() {
    const missing = this.getMissingBodyParts();
    return missing.length > 0 ? missing.join(", ") : "none";
  }

  die(weaponType = null, cause = null) {
    if (!this.horse.isAlive) return;
    this.horse.currentStateKey = "IDLE";
    this.horse.deathWeapon = weaponType;
    this.horse.bloodTolerance = 1;
    if (typeof notifyViolence !== "undefined" && weaponType) {
      notifyViolence(this.horse, true, weaponType);
    }
    this.horse.isAlive = false;
    this.horse.hunger = 0;
    if (this.horse.claimedBed) {
      this.horse.claimedBed.unclaim(this.horse.id);
      this.horse.claimedBed = null;
    }

    if (cause) {
      this.horse.causeOfDeath = cause;
    } else if (weaponType === "knife" || weaponType === "scalpel") {
      this.horse.causeOfDeath = "Knifed to death";
    } else if (weaponType === "grinder") {
      this.horse.causeOfDeath = "Ground to death";
    } else if (weaponType === "cattle_prod") {
      this.horse.causeOfDeath = "Electrocuted to death";
    }

    // Update other fluffies' relationships before removing this fluffy
    for (const [otherId, rels] of Object.entries(relationships)) {
      if (rels[this.horse.id]) {
        const rel = rels[this.horse.id];
        if (rel === "baby_child" || rel === "child") {
          const mother = fluffies.find((f) => f.id == otherId);
          if (mother && mother.isAlive) {
            const allChildren = Object.entries(rels).filter(
              ([id, type]) =>
                type === "baby_child" ||
                type === "child" ||
                type === "estranged_child" ||
                type === "dead_baby_child",
            );

            const aliveFoals = allChildren.filter(([id, type]) => {
              const foal = fluffies.find((f) => f.id == id);
              return foal && foal.isAlive && foal.id != this.horse.id;
            });

            if (aliveFoals.length === 0 && allChildren.length > 1) {
              if (weaponType) {
                mother.changeHappiness(-0.35);
              }
            }
          }
        }
      }
    }
  }

  performCannibalAttack(target) {
    if (!target || !target.isAlive) return;

    this.horse.facingRight = target.x > this.horse.x;
    target.facingRight = target.x < this.horse.x;

    target.wasAttackedBy(this.horse);
    this.horse.initBehavior("FLUFFY_BITE");

    // High chance of gibbing
    if (target.isCrawling && Math.random() < 0.8) {
      const potentialParts = [
        "tail",
        "special_lumps",
        "horse_udders",
        "leg_0",
        "leg_1",
        "leg_2",
        "leg_3",
        "leftEar",
        "rightEar",
      ];
      const availableParts = potentialParts.filter((p) => {
        if (p === "tail") return target.limbs.tail;
        if (p === "special_lumps") return target.limbs.lumps;
        if (p === "horse_udders") return target.limbs.udders;
        if (p === "leftEar") return target.limbs.leftEar;
        if (p === "rightEar") return target.limbs.rightEar;
        if (p.startsWith("leg_"))
          return target.limbs.legs[parseInt(p.split("_")[1])];
        return false;
      });

      if (availableParts.length > 0) {
        const partToGib =
          availableParts[Math.floor(Math.random() * availableParts.length)];
        target.anatomy.amputate(partToGib);
        let gibType = "part";
        if (partToGib.startsWith("leg")) gibType = "leg";
        else if (partToGib === "special_lumps") gibType = "special_lumps";
        else if (partToGib === "horse_udders") gibType = "horse_udders";
        else if (partToGib === "tail") gibType = "tail";
        else if (partToGib.includes("Ear")) gibType = "ear";

        target.anatomy.spawnGib(gibType);
      }
    }

    target.health -= 15;
    target.initBehavior("FLUFFY_KNOCKED_DOWN");
    target.setShock(1.0);
    this.horse.attackCooldown = 1.0;

    // Add cannibal to feared list for 3 minutes
    if (
      target.fearedFluffies &&
      !target.fearedFluffies.some((f) => f.id === this.horse.id)
    ) {
      target.fearedFluffies.push({
        id: this.horse.id,
        timer: 180,
        reason: "CANNIBALISM",
      });
    }

    if (this.horse.speech.timer <= 0) {
      this.horse.speak(getDialogue(["CANNIBAL", "ATTACK"], this.horse));
    }
  }

  eatGib(gib) {
    if (!gib) return;
    this.horse.initBehavior("FLUFFY_BITE");
    this.horse.speak(getDialogue(["CANNIBAL", "EAT"], this.horse));
    if (gib.type === "head" || gib.type === "torso") {
      this.horse.hunger = Math.min(
        1.0,
        this.horse.hunger + 1.0 * gib.growthValue,
      );
    } else {
      this.horse.hunger = Math.min(
        1.0,
        this.horse.hunger + 0.5 * gib.growthValue,
      );
    }
    this.horse.cannibalismAcceptance = Math.min(
      1.0,
      this.horse.cannibalismAcceptance + 0.25,
    );
    gib.shouldDespawn = true;
    if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
      poofs.push(new Poof(gib.x, gib.y, this.horse.scene, "#8a0303"));
    }
  }

  eatCorpse(corpse) {
    if (!corpse || corpse.isAlive) return;
    this.horse.initBehavior("FLUFFY_BITE");
    this.horse.speak(getDialogue(["CANNIBAL", "EAT"], this.horse));

    this.horse.cannibalismAcceptance = Math.min(
      1.0,
      this.horse.cannibalismAcceptance + 0.25,
    );

    // Check for available limbs
    const potentialParts = [
      "tail",
      "special_lumps",
      "horse_udders",
      "leg_0",
      "leg_1",
      "leg_2",
      "leg_3",
      "leftEar",
      "rightEar",
    ];
    const availableParts = potentialParts.filter((p) => {
      if (p === "tail") return corpse.limbs.tail;
      if (p === "special_lumps") return corpse.limbs.lumps;
      if (p === "horse_udders") return corpse.limbs.udders;
      if (p === "leftEar") return corpse.limbs.leftEar;
      if (p === "rightEar") return corpse.limbs.rightEar;
      if (p.startsWith("leg_"))
        return corpse.limbs.legs[parseInt(p.split("_")[1])];
      return false;
    });

    if (availableParts.length > 0) {
      const partToGib =
        availableParts[Math.floor(Math.random() * availableParts.length)];
      corpse.anatomy.amputate(partToGib);
      let gibType = "part";
      if (partToGib.startsWith("leg")) gibType = "leg";
      else if (partToGib === "special_lumps") gibType = "special_lumps";
      else if (partToGib === "horse_udders") gibType = "horse_udders";
      else if (partToGib === "tail") gibType = "tail";
      else if (partToGib.includes("Ear")) gibType = "ear";

      corpse.anatomy.spawnGib(gibType);
    } else {
      // No limbs left, butcher the core
      corpse.anatomy.spawnGib("head");
      corpse.anatomy.spawnGib("torso");
      corpse.isDestroyed = true;
      if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
        poofs.push(new Poof(corpse.x, corpse.y, this.horse.scene, "#8a0303"));
      }
    }
  }

  spawnGib(part, grinder = null, pregnancyData = null) {
    if (!this.horse.tinted) return null;
    let img = null;
    let type = "part";
    let growthVal = 0.05;

    let faceData = null;
    if (part === "head") {
      img = this.horse.tinted ? this.horse.tinted.head : null;
      type = "head";
      growthVal = 0.1;

      let activeExp = "NEUTRAL";
      if (
        this.horse.expressionOverride &&
        this.horse.expressionOverrideTimer > 0
      ) {
        activeExp = this.horse.expressionOverride;
      } else if (this.horse.expression) {
        activeExp = this.horse.expression;
      } else if (!this.horse.isAlive) {
        activeExp = "SAD";
      }

      faceData = {
        expression: activeExp,
        eyeColor: this.horse.colors ? this.horse.colors.pupil : "black",
        maneType: this.horse.maneType !== undefined ? this.horse.maneType : 0,
        maneColor: this.horse.colors ? this.horse.colors.mane : null,
        gradientConfig: this.horse.hasGradient
          ? {
              color: this.horse.colors.gradient,
              intensity: this.horse.gradientIntensity,
            }
          : null,
        hasHorn: !!(this.horse.limbs && this.horse.limbs.horn),
        hornSizeFactor: this.horse.hornSizeFactor || 1.0,
      };
    } else if (part === "torso") {
      img = this.horse.tinted.torso;
      type = "torso";
      growthVal = 0.375 * (1 + (this.horse.pregnancyTorsoStretch || 0));
    } else if (part === "tail") {
      img = this.horse.tinted.tail;
      growthVal = 0.05;
    } else if (part === "ear") {
      img = this.horse.tinted.ear;
      growthVal = 0.025;
    } else if (part === "leg") {
      img = this.horse.tinted.leg;
      growthVal = 0.1;
    } else if (part === "special_lumps") {
      img = this.horse.tinted.special_lumps;
      growthVal = 0.025;
    } else if (part === "horse_udders") {
      img = this.horse.tinted.udders;
      growthVal = 0.025;
    } else if (part === "horn") {
      img = this.horse.tinted.horn;
      growthVal = 0.025;
    } else if (part === "wing") {
      img = this.horse.tinted.wing;
      growthVal = 0.05;
    }

    const s = this.horse.scale;
    const g = this.horse.growth;

    let x = this.horse.x;
    let y = this.horse.y;

    if (grinder) {
      const gb = grinder.gibBounds();
      const h = images.grinder
        ? images.grinder.height * grinder.scale
        : gb.right - gb.left;
      x = grinder.x + (Math.random() - 0.5) * h;
    }

    let spotsConfig = null;
    if (this.horse.hasSpots) {
      const baseConfig = {
        color: this.horse.colors.spots,
        seed: this.horse.spotPatternSeed,
      };
      if (part === "head") {
        spotsConfig = {
          ...baseConfig,
          seed: baseConfig.seed + 13,
          isHead: true,
        };
      } else if (part === "torso") {
        spotsConfig = baseConfig;
      } else if (part === "ear") {
        spotsConfig = {
          ...baseConfig,
          seed: baseConfig.seed + 47,
          isLeg: true,
        };
      } else if (part === "leg") {
        spotsConfig = {
          ...baseConfig,
          seed: baseConfig.seed + 29,
          isLeg: true,
        };
      } else if (part === "sbs_double_chin") {
        spotsConfig = {
          ...baseConfig,
          seed: baseConfig.seed + 71,
          isLeg: true,
        };
      }
    }

    let stripesConfig = null;
    if (this.horse.hasStripes) {
      const baseConfig = {
        color: this.horse.colors.stripes,
        seed: this.horse.stripePatternSeed,
      };
      if (part === "head") {
        stripesConfig = {
          ...baseConfig,
          seed: baseConfig.seed + 13,
          isHead: true,
        };
      } else if (part === "torso") {
        stripesConfig = baseConfig;
      } else if (part === "ear") {
        stripesConfig = {
          ...baseConfig,
          seed: baseConfig.seed + 47,
          isLeg: true,
        };
      } else if (part === "leg") {
        stripesConfig = {
          ...baseConfig,
          seed: baseConfig.seed + 29,
          isLeg: true,
        };
      } else if (part === "sbs_double_chin") {
        stripesConfig = {
          ...baseConfig,
          seed: baseConfig.seed + 71,
          isLeg: true,
        };
      }
    }

    const gib = new Gib(
      part,
      this.horse.colors.body,
      this.horse.scene,
      part,
      x,
      y,
      grinder,
      grinder
        ? null
        : { left: 0, right: width, top: 0, bottom: this.horse.getBottomY() },
      s,
      growthVal * g,
      pregnancyData,
      spotsConfig,
      img,
      stripesConfig,
      faceData,
    );
    gibs.push(gib);
    return gib;
  }

  spawnMouthPoof(color = "white") {
    if (typeof poofs === "undefined" || typeof Poof === "undefined") return;
    if (this.horse.scene !== currentScene) return;
    if (!this.horse.layout) return;

    const s = this.horse.scale;
    const fx = this.horse.facingRight ? 1 : -1;

    // Position Head relative to Torso
    const headX = this.horse.layout.head.x * s * fx;
    const headY = this.horse.layout.head.y * s;

    // Position Mouth relative to Head
    const localMouthX = this.horse.layout.head.w * 0.6 * s * fx;
    const localMouthY = this.horse.layout.head.h * -0.0 * s;

    const pX = this.horse.x + headX + localMouthX;
    const pY = this.horse.y + headY + localMouthY;

    poofs.push(new Poof(pX, pY, this.horse.scene, color));
  }

  triggerPregnancy(father) {
    this.horse.isPregnant = true;
    this.horse.pregnancyTimer = pregnancyDuration;
    this.horse.lactatingTimer = 900; // 15 minutes
    this.horse.fatherGenes = [...father.genes];
    this.horse.babyDaddyId = father.id;
    this.horse.updateGrowthStats();

    // Decide number of foals and viability
    this.horse.babiesToBirth = Math.floor(Math.random() * 7) + 1;
    this.horse.foalViability = [];
    for (let i = 0; i < this.horse.babiesToBirth; i++) {
      let viable = true;
      // Check 3 pairs
      for (let pair = 0; pair < 3; pair++) {
        const momIdx = 65 + pair * 2;
        const dadIdx = 65 + pair * 2;
        const momGene =
          Math.random() < 0.5
            ? this.horse.genes[momIdx]
            : this.horse.genes[momIdx + 1];
        const dadGene =
          Math.random() < 0.5 ? father.genes[dadIdx] : father.genes[dadIdx + 1];
        if (momGene === dadGene) {
          viable = false;
          break;
        }
      }
      this.horse.foalViability.push(viable);
    }
  }

  spawnBaby(isViable = true) {
    if (!this.horse.fatherGenes) return;

    // Spawn baby
    const babyGenes = this.horse.genetics.combineGenes(this.horse.fatherGenes);

    const baby = new Horse(
      0.0,
      this.horse.id,
      this.horse.scene,
      "earthy",
      babyGenes,
    );
    baby.fatherId = this.horse.babyDaddyId;
    baby.birthRotation = Math.PI / 2;
    baby.currentCage = this.horse.currentCage;
    baby.hunger = 0.4;

    if (typeof worldSettings !== "undefined" && worldSettings.sbs) {
      let chance = this.horse.isSensitive() ? 0.175 : 0.04;

      if (babyGenes) {
        if (babyGenes[65] === babyGenes[66]) chance *= 4;
        if (babyGenes[67] === babyGenes[68]) chance *= 4;
        if (babyGenes[69] === babyGenes[70]) chance *= 4;
      }

      if (Math.random() < chance) {
        baby.sensitiveBaby = true;
      }
    }

    if (!isViable) {
      baby.anatomy.die(null, "Born non-viable");
      baby.bloodTolerance = 1;
      this.horse.bloodTolerance = 1;
      this.horse.bloodReactionTimer = 15;
      // Create blood puddle
      if (typeof puddles !== "undefined") {
        const pX = baby.x;
        const pY = baby.y;
      }
    }

    if (isViable && this.horse.fatherId !== undefined) {
      const dad = fluffies.find((f) => f.id == this.horse.fatherId);
      if (dad && dad.isAlive) {
        relationships[baby.id][this.horse.fatherId] = "father";
        if (!relationships[this.horse.fatherId])
          relationships[this.horse.fatherId] = {};
        relationships[this.horse.fatherId][baby.id] = "child";
      }
    }

    // Positioning
    if (this.horse.tinted && this.horse.tinted.torso) {
      baby.x =
        this.horse.x +
        (this.horse.facingRight
          ? -this.horse.tinted.torso.width * 0.2 * this.horse.scale
          : this.horse.tinted.torso.width * 0.2 * this.horse.scale);
      baby.y = this.horse.y + this.horse.tinted.torso.height * this.horse.scale;
    } else {
      baby.x = this.horse.x;
      baby.y = this.horse.y;
    }

    if (!isViable) {
      const pX = baby.x;
      const pY = baby.y;
      addPointToPuddle(baby.scene, pX, pY, "#8a0303", 10 / 200, 20 / 200);
    }

    fluffies.push(baby);
    if (isViable) {
      baby.speak(getDialogue("BABY_PEEP", baby, this.horse));
    } else {
      this.horse.speak(getDialogue(["BIRTH", "DEAD_BABY"], this.horse, baby));
    }
  }

  spawnTear() {
    const torsoWidth = this.horse.layout ? this.horse.layout.torso.w : 100;
    const offsetX =
      (torsoWidth / 2) * (this.horse.facingRight ? 1 : -1) * this.horse.scale;
    const pX = this.horse.x + offsetX;
    const pY = this.horse.getBottomY();
    const color = "rgba(180, 180, 180, 0.25)";

    addPointToPuddle(
      this.horse.scene,
      pX,
      pY,
      color,
      2.0 / 200,
      4.5 / 200,
      0.08,
    );
  }

  static spawnPrematureBabies(grinder, scene, x, y, data) {
    if (!data || !data.fatherGenes || !grinder) return;
    const prog = 1.0 - data.pregnancyTimer / pregnancyDuration;
    const count = data.babiesToBirth || Math.floor(Math.random() * 7) + 1;

    // Use temporary mom to handle gene combination once
    const dummyMom = new Horse(
      1.0,
      null,
      scene,
      "earthy",
      data.motherGenes,
      null,
      null,
      "female",
    );

    for (let i = 0; i < count; i++) {
      const babyGenes = dummyMom.genetics.combineGenes(data.fatherGenes);

      const dummy = new Horse(0.0, null, scene, "earthy", babyGenes);
      dummy.renderer.ensureTintedImages();

      if (dummy.tinted && dummy.tinted.torso) {
        const s = 0.25 * prog;

        const spawnPart = (partType, growthMult) => {
          const gb = grinder.gibBounds();
          const h = images.grinder
            ? images.grinder.height * grinder.scale
            : gb.right - gb.left;
          const gx = grinder.x + (Math.random() - 0.5) * h;
          const gy = y;

          let faceData = null;
          let img = null;
          if (partType === "head") {
            img = dummy.tinted ? dummy.tinted.head : null;
            faceData = {
              expression: dummy.expression || "NEUTRAL",
              eyeColor: dummy.colors ? dummy.colors.pupil : "black",
              maneType: dummy.maneType !== undefined ? dummy.maneType : 0,
              maneColor: dummy.colors ? dummy.colors.mane : null,
              gradientConfig: dummy.hasGradient
                ? {
                    color: dummy.colors.gradient,
                    intensity: dummy.gradientIntensity,
                  }
                : null,
              hasHorn: !!(dummy.limbs && dummy.limbs.horn),
              hornSizeFactor: dummy.hornSizeFactor || 1.0,
            };
          }

          const gib = new Gib(
            partType,
            dummy.colors.body,
            scene,
            partType,
            gx,
            gy,
            grinder,
            null,
            s * 0.5,
            s * growthMult,
            null,
            null,
            img,
            null,
            faceData,
          );
          gibs.push(gib);
        };

        spawnPart("torso", 0.375);
        spawnPart("head", 0.1);
        spawnPart("tail", 0.05);

        // 4 legs
        for (let j = 0; j < 4; j++) {
          spawnPart("leg", 0.1);
        }

        // 2 ears
        spawnPart("ear", 0.025);
        spawnPart("ear", 0.025);

        if (dummy.gender === "male" && dummy.tinted.special_lumps) {
          spawnPart("special_lumps", 0.025);
        }
        if (dummy.gender === "female" && dummy.tinted.udders) {
          spawnPart("horse_udders", 0.025);
        }
      }

      // Cleanup relationship table for dummy baby
      delete relationships[dummy.id];
    }
    // Cleanup relationship table for dummy mom
    delete relationships[dummyMom.id];
  }

  explode(grinder) {
    this.die("grinder");
    this.horse.isDestroyed = true;
    if (grinder) {
      if (!this.horse.tinted) return;
      const s = this.horse.scale;
      const g = this.horse.growth;

      // Values multiplied by fluffy's growth
      let pregnancyData = null;
      if (this.horse.isPregnant && this.horse.fatherGenes) {
        pregnancyData = {
          fatherGenes: [...this.horse.fatherGenes],
          motherGenes: [...this.horse.genes],
          pregnancyTimer: this.horse.pregnancyTimer,
          babiesToBirth: this.horse.babiesToBirth,
        };
      }

      this.spawnGib("torso", grinder, pregnancyData);
      this.spawnGib("head", grinder);

      if (this.horse.limbs.tail) {
        this.spawnGib("tail", grinder);
      }
      for (let i = 0; i < 4; i++) {
        if (this.horse.limbs.legs[i]) {
          this.spawnGib("leg", grinder);
        }
      }
      if (this.horse.tinted.ear) {
        if (this.horse.limbs.leftEar) {
          this.spawnGib("ear", grinder);
        }
        if (this.horse.limbs.rightEar) {
          this.spawnGib("ear", grinder);
        }
      }
      if (
        this.horse.gender === "male" &&
        this.horse.limbs.lumps &&
        this.horse.tinted.special_lumps
      ) {
        this.spawnGib("special_lumps", grinder);
      }
      if (
        this.horse.gender === "female" &&
        this.horse.limbs.udders &&
        this.horse.tinted.udders
      ) {
        this.spawnGib("horse_udders", grinder);
      }
    }
  }

  explodeFromCar(car) {
    this.die("car");
    this.horse.isDestroyed = true;
    if (!this.horse.tinted) return;
    const s = this.horse.scale;
    const g = this.horse.growth;

    // Values multiplied by fluffy's growth
    let pregnancyData = null;
    if (this.horse.isPregnant && this.horse.fatherGenes) {
      pregnancyData = {
        fatherGenes: [...this.horse.fatherGenes],
        motherGenes: [...this.horse.genes],
        pregnancyTimer: this.horse.pregnancyTimer,
        babiesToBirth: this.horse.babiesToBirth,
      };
    }

    const spawnedGibs = [];

    const spawn = (part, pregData = null) => {
      const gib = this.spawnGib(part, null, pregData);
      if (gib) spawnedGibs.push(gib);
    };

    spawn("torso", pregnancyData);
    spawn("head");

    if (this.horse.limbs.tail) {
      spawn("tail");
    }
    for (let i = 0; i < 4; i++) {
      if (this.horse.limbs.legs[i]) {
        spawn("leg");
      }
    }
    if (this.horse.tinted.ear) {
      if (this.horse.limbs.leftEar) {
        spawn("ear");
      }
      if (this.horse.limbs.rightEar) {
        spawn("ear");
      }
    }
    if (
      this.horse.gender === "male" &&
      this.horse.limbs.lumps &&
      this.horse.tinted.special_lumps
    ) {
      spawn("special_lumps");
    }
    if (
      this.horse.gender === "female" &&
      this.horse.limbs.udders &&
      this.horse.tinted.udders
    ) {
      spawn("horse_udders");
    }

    // Add a decent velocity to each of the gibs in the direction of the car
    const sign = Math.sign(car.vx);
    for (const gib of spawnedGibs) {
      gib.vx = sign * (200 + Math.random() * 400); // 200 - 600 px/sec
      gib.vy = -(300 + Math.random() * 300); // Fly upwards
      gib.freeGib = false;
      gib.isRoadkill = true;
      gib.roadkillFloorY = this.horse.y + (Math.random() - 0.5) * 80; // Small randomness
      gib.bounds = null; // Bounces on roadkillFloorY instead
      gib.carCollisionCooldown = 3.0; // Cooldown of 3 seconds
    }
  }
}
