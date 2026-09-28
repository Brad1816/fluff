let sellRequestAverage = 120;
let sellRequestTimer = sellRequestAverage; // 2 minutes average
let tutorialTimer = 10.0;

function updateMoneyAndRequests(dt) {
  if (tutorialTimer > 0) tutorialTimer -= dt;

  // Update UI Messages
  for (let i = uiMessages.length - 1; i >= 0; i--) {
    const msg = uiMessages[i];
    msg.timer -= dt;
    if (msg.timer < 1.0) msg.opacity = Math.max(0, msg.timer);
    if (msg.timer <= 0) uiMessages.splice(i, 1);
  }

  for (let i = debugMessages.length - 1; i >= 0; i--) {
    const msg = debugMessages[i];
    msg.timer -= dt;
    if (msg.timer < 1.0) msg.opacity = Math.max(0, msg.timer);
    if (msg.timer <= 0) debugMessages.splice(i, 1);
  }

  updateVFX(dt);

  if (currentSellRequest) {
    // Auto expire if fluffy dies or is removed from list
    const fluffyStillValid = fluffies.some(
      (f) => f.id === currentSellRequest.fluffyId && f.isAlive,
    );
    if (!fluffyStillValid) {
      currentSellRequest = null;
      return;
    }

    currentSellRequest.timer -= dt;
    if (currentSellRequest.timer <= 0) {
      currentSellRequest = null;
    }
  } else {
    const indoorFluffies = fluffies.filter(
      (f) =>
        getSceneConfig(f.scene).insidePlayerQuarters &&
        f.canBeSold() &&
        !f.isDragging,
    );
    const indoorCount = indoorFluffies.length;

    // Timer decreases faster with more indoor fluffies
    sellRequestTimer -= dt * Math.max(1, Math.log2(indoorCount));

    if (sellRequestTimer <= 0) {
      if (indoorCount > 0) {
        // Prioritize "sell" cage fluffies
        const sellCageFluffies = indoorFluffies.filter(
          (f) => f.currentCage && f.currentCage.tag === "sell",
        );
        const candidates =
          sellCageFluffies.length > 0 ? sellCageFluffies : indoorFluffies;

        const target =
          candidates[Math.floor(Math.random() * candidates.length)];
        currentSellRequest = {
          fluffyId: target.id,
          price: target.calculatePrice(),
          timer: 30,
          fluffy: target, // Keep ref for drawing
        };
      }
      sellRequestTimer =
        sellRequestAverage / 2 + Math.random() * sellRequestAverage;
    }
  }
}

function attemptDrop() {
  if (!isGlobalDragging || mouse.rightDown) return false;

  for (const obj of objects) {
    if (obj.isDragging && obj instanceof IVBag) {
      // Check for attachment to stand
      for (const other of objects) {
        if (
          other instanceof IVStand &&
          other.scene === currentScene &&
          other.hitTest(mouse.x, mouse.y)
        ) {
          if (!other.attachedBag) {
            obj.attachedTo = other;
            other.attachedBag = obj;
            obj.isDragging = false;
            isGlobalDragging = false;
            if (typeof removeToolFromToolbox === "function") {
              removeToolFromToolbox(obj);
            }
            return true;
          }
        }
      }
      // Check for Syringe draw
      for (const other of objects) {
        if (
          typeof Syringe !== "undefined" &&
          other instanceof Syringe &&
          other.scene === currentScene &&
          other.hitTest(mouse.x, mouse.y)
        ) {
          if (other.drawFromBag(obj)) {
            obj.isDragging = false;
            isGlobalDragging = false;
            return true;
          }
        }
      }
    }
    if (
      obj.isDragging &&
      typeof Syringe !== "undefined" &&
      obj instanceof Syringe
    ) {
      // Check if dropped onto an IVBag or IVStand with attached bag
      for (const other of objects) {
        if (
          other instanceof IVBag &&
          other.scene === currentScene &&
          other.hitTest(mouse.x, mouse.y)
        ) {
          if (obj.drawFromBag(other)) {
            obj.isDragging = true;
            isGlobalDragging = true;
            return true;
          }
        } else if (
          other instanceof IVStand &&
          other.attachedBag &&
          other.scene === currentScene &&
          other.hitTest(mouse.x, mouse.y)
        ) {
          if (obj.drawFromBag(other.attachedBag)) {
            obj.isDragging = true;
            isGlobalDragging = true;
            return true;
          }
        }
      }
    }
  }
  for (const f of fluffies) {
    if (f.isDragging) {
      f.onDrop();
      return true;
    }
  }
  for (const obj of objects) {
    if (obj.isDragging) {
      // Special interaction checks for some objects
      if (
        typeof isPunishmentTool === "function"
          ? isPunishmentTool(obj)
          : obj instanceof SorryStick || obj instanceof SprayBottle
      ) {
        let hitFluffy = false;
        const isSpray =
          typeof SprayBottle !== "undefined" && obj instanceof SprayBottle;
        const isTack =
          typeof Thumbtack !== "undefined" && obj instanceof Thumbtack;
        for (const f of fluffies) {
          if (f.scene !== obj.scene || !f.isAlive) continue;
          if (
            f.currentCage &&
            typeof FoalInACan !== "undefined" &&
            f.currentCage instanceof FoalInACan
          )
            continue;
          let hitPart = f.hitTestAsSeen(mouse.x, mouse.y);
          if (hitPart) {
            if (
              f.placedOn instanceof OperatingTable &&
              f.placedOn.category !== "DEFAULT"
            ) {
              const cat = f.placedOn.category;
              if (cat === "LEFT EYE") hitPart = "leftEye";
              if (cat === "RIGHT EYE") hitPart = "rightEye";
            }

            // Breeding Cage Effect
            const isEyeTarget =
              isTack && (hitPart === "leftEye" || hitPart === "rightEye");
            if (
              !isEyeTarget &&
              f.gender === "male" &&
              f.growth >= 1.0 &&
              f.currentCage &&
              f.currentCage.tag === "breeding"
            ) {
              const mare = fluffies.find(
                (m) =>
                  m.gender === "female" &&
                  m.growth >= 1.0 &&
                  m.currentCage === f.currentCage &&
                  m.isAlive,
              );
              if (mare) {
                if (isSpray) {
                  obj.sprayTimer = 0.2;
                  if (
                    typeof poofs !== "undefined" &&
                    images &&
                    images.spray_bottle
                  ) {
                    poofs.push(
                      new Poof(
                        mouse.x,
                        mouse.y - images.spray_bottle.height,
                        obj.scene,
                        "#b4cbff",
                      ),
                    );
                  }
                } else if (isTack) {
                  obj.pokeTimer = obj.pokeDuration;
                } else {
                  obj.whackTimer = 0.2;
                }
                playSound(
                  isSpray
                    ? "spray_bottle"
                    : isTack
                      ? "thumbtack"
                      : "sorry_stick",
                );
                hitFluffy = true;
                if (!(f.limbs.legs[1] && f.limbs.legs[2])) {
                  f.speak(getDialogue(["SPECIAL_HUGGIES", "NO_LEGS"], f), true);
                  break;
                }
                if (!f.limbs.lumps) {
                  f.speak(
                    getDialogue(["SPECIAL_HUGGIES", "NO_LUMPS"], f),
                    true,
                  );
                  break;
                }
                if (f.mateWith(mare, true, true)) {
                  f.speak(
                    getDialogue(
                      [
                        isSpray
                          ? "SPRAY_BOTTLE"
                          : isTack
                            ? "THUMBTACK"
                            : "SORRY_STICK",
                        "TRAINING",
                      ],
                      f,
                    ),
                  );
                  break;
                }
              }
            }

            // Action! (WHACK or SPRAY or POKE)
            let key = "WHACK_SCREE";

            // Potty Training Logic
            if (
              f.badPoopieTimer > 0 &&
              !f.trainedForThisOccurrence &&
              !f.isSmarty() &&
              typeof objects !== "undefined" &&
              objects.some(
                (o) =>
                  o.scene === f.scene &&
                  (o instanceof Litterbox ||
                    (o instanceof LitterpalBox && o.securedFluffy)),
              ) &&
              !f.tooYoungToSpeak()
            ) {
              f.trainedForThisOccurrence = true;
              f.pottyTraining = Math.min(
                1.0,
                f.pottyTraining + (0.1 + Math.random() * 0.1) * 0.25,
              );
              key = "TRAINING";
            } else if (f.tooYoungToSpeak()) {
              key = "CHIRPY";
            } else if (!f.tooYoungToSpeak() && f.growth <= 0.8) {
              key = "BABY";
            }

            if (isTack) {
              const isEye = hitPart === "leftEye" || hitPart === "rightEye";
              const hadEye = isEye && f.limbs && f.limbs[hitPart];
              obj.manualUse(f, key === "TRAINING", hitPart);
              if (!hadEye) {
                notifyViolence(f, false, "stick", key === "TRAINING");
              }
            } else {
              f.speak(
                getDialogue([isSpray ? "SPRAY_BOTTLE" : "SORRY_STICK", key], f),
              );
              playSound(isSpray ? "spray_bottle" : "sorry_stick");
              f.initBehavior("FLUFFY_KNOCKED_DOWN");
              f.stateTimer = 0.5;

              f.changeHappiness(HAPPINESS_PENALTY_STICK_WHACK);
              f.expressionOverride = "CRYING_SHOCKED";
              f.expressionOverrideTimer = 10.0;
              f.expressionOverrideTimer = 3.0;

              if (isSpray) {
                obj.sprayTimer = 0.2;
                if (
                  typeof poofs !== "undefined" &&
                  images &&
                  images.spray_bottle
                ) {
                  poofs.push(
                    new Poof(
                      mouse.x,
                      mouse.y - images.spray_bottle.height,
                      obj.scene,
                      "#b4cbff",
                    ),
                  );
                }
              } else {
                obj.whackTimer = 0.2;
              }

              notifyViolence(f, false, "stick", key === "TRAINING");
            }

            f.excrete("poop");
            f.excrete("pee");

            hitFluffy = true;
            break;
          }
        }
        if (!hitFluffy) obj.onDrop();
        return true;
      } else if (typeof Syringe !== "undefined" && obj instanceof Syringe) {
        let hitFluffy = false;
        for (const f of fluffies) {
          if (f.scene !== obj.scene || !f.isAlive) continue;
          if (
            f.currentCage &&
            typeof FoalInACan !== "undefined" &&
            f.currentCage instanceof FoalInACan
          )
            continue;
          let hitPart = f.hitTestAsSeen(mouse.x, mouse.y);
          if (hitPart) {
            if (
              f.placedOn instanceof OperatingTable &&
              f.placedOn.category !== "DEFAULT"
            ) {
              const cat = f.placedOn.category;
              if (cat === "LEFT EYE") hitPart = "leftEye";
              if (cat === "RIGHT EYE") hitPart = "rightEye";
            }

            obj.manualUse(f, hitPart);
            hitFluffy = true;
            break;
          }
        }
        if (!hitFluffy) obj.onDrop();
        return true;
      } else if (typeof CattleProd !== "undefined" && obj instanceof CattleProd) {
        let hitFluffy = false;
        for (const f of fluffies) {
          if (f.scene !== obj.scene || !f.isAlive) continue;
          if (
            f.currentCage &&
            typeof FoalInACan !== "undefined" &&
            f.currentCage instanceof FoalInACan
          )
            continue;
          let hitPart = f.hitTestAsSeen(mouse.x, mouse.y);
          if (hitPart) {
            if (
              f.placedOn instanceof OperatingTable &&
              f.placedOn.category !== "DEFAULT"
            ) {
              const cat = f.placedOn.category;
              if (cat === "LEFT EYE") hitPart = "leftEye";
              if (cat === "RIGHT EYE") hitPart = "rightEye";
            }

            if (obj.shockedFluffy !== f) {
              obj.manualUse(f, hitPart);
            }
            hitFluffy = true;
            break;
          }
        }
        if (!hitFluffy) obj.onDrop();
        return true;
      } else if (obj instanceof Brush) {
        let hitFluffy = false;
        for (const f of fluffies) {
          if (f.scene !== obj.scene || !f.isAlive) continue;
          if (
            f.currentCage &&
            typeof FoalInACan !== "undefined" &&
            f.currentCage instanceof FoalInACan
          )
            continue;
          if (f.hitTestAsSeen(mouse.x, mouse.y)) {
            // BRUSH!
            let key = f.tooYoungToSpeak() ? ["BRUSH", "CHIRPY"] : "BRUSH";

            // Potty Training Logic (Positive)
            if (
              f.goodPoopieTimer > 0 &&
              !f.trainedForThisOccurrence &&
              !f.isSmarty() &&
              typeof objects !== "undefined" &&
              objects.some(
                (o) => o instanceof Litterbox && o.scene === f.scene,
              ) &&
              !f.tooYoungToSpeak()
            ) {
              f.trainedForThisOccurrence = true;
              f.pottyTraining = Math.min(
                1.0,
                f.pottyTraining + (0.1 + Math.random() * 0.1) * 0.25,
              );
              key = ["BRUSH", "TRAINING"];

              // Others learn from seeing this
              for (const other of fluffies) {
                if (
                  other === f ||
                  !other.isAlive ||
                  other.scene !== f.scene ||
                  other.tooYoungToSpeak() ||
                  other.currentStateKey === "SLEEPING" ||
                  other.happiness <= WAN_DIE_THRESHOLD
                )
                  continue;

                if (!other.isSmarty()) {
                  other.pottyTraining = Math.min(
                    1.0,
                    other.pottyTraining + (0.05 + Math.random() * 0.05) * 0.25,
                  );
                  other.speak(
                    getDialogue(["BRUSH", "WITNESS_TRAINING"], other),
                  );
                }
              }
            }
            if (!f.isSmarty()) {
              f.speak(getDialogue(key, f));
            }
            f.changeHappiness(HAPPINESS_BONUS_BRUSH);
            // Builds trust in you (Memory.js)
            if (typeof onFluffyBrushed === "function") onFluffyBrushed(f);
            f.expressionOverride = "GOOD_UPSIES";
            f.expressionOverrideTimer = 1.0;
            f.initBehavior("BENDING_2");
            f.stateTimer = 1.0;
            hitFluffy = true;
            obj.whackTimer = 0.2;
            break;
          }
        }
        if (!hitFluffy) obj.onDrop();
        return true;
      } else if (obj instanceof Knife) {
        let knife = obj;
        let hitFluffy = false;
        for (const f of fluffies) {
          if (f.scene !== knife.scene || !f.isAlive) continue;
          if (
            f.currentCage &&
            typeof FoalInACan !== "undefined" &&
            f.currentCage instanceof FoalInACan
          )
            continue;
          // Check standard hit test first for general stick-like behavior
          let hitPart = f.hitTestAsSeen(mouse.x, mouse.y);
          if (typeof hitPart !== "string") continue;

          // Operating Table Override
          if (
            f.placedOn instanceof OperatingTable &&
            f.placedOn.category !== "DEFAULT"
          ) {
            const cat = f.placedOn.category;
            let overridePart = null;
            if (cat === "FRONT RIGHT LEG") overridePart = "leg_1";
            if (cat === "FRONT LEFT LEG") overridePart = "leg_2";
            if (cat === "BACK RIGHT LEG") overridePart = "leg_0";
            if (cat === "BACK LEFT LEG") overridePart = "leg_3";
            if (cat === "TAIL") overridePart = "tail";
            if (cat === "LEFT EAR") overridePart = "leftEar";
            if (cat === "RIGHT EAR") overridePart = "rightEar";
            if (cat === "LEFT EYE") overridePart = "leftEye";
            if (cat === "RIGHT EYE") overridePart = "rightEye";
            if (cat === "LEFT WING") overridePart = "leftWing";
            if (cat === "RIGHT WING") overridePart = "rightWing";
            if (cat === "HORN") overridePart = "horn";
            if (cat === "SPAYNEUTER") {
              if (f.gender === "female") {
                overridePart = "spay";
              } else {
                overridePart = "lumps";
              }
            }

            // Check if part exists
            let partExists = false;
            if (overridePart === "tail") partExists = f.limbs.tail;
            else if (overridePart === "head")
              partExists =
                f.limbs.leftEar ||
                f.limbs.rightEar ||
                f.limbs.leftEye ||
                f.limbs.rightEye;
            else if (overridePart === "leftEar") partExists = f.limbs.leftEar;
            else if (overridePart === "rightEar") partExists = f.limbs.rightEar;
            else if (overridePart === "leftEye") partExists = f.limbs.leftEye;
            else if (overridePart === "rightEye") partExists = f.limbs.rightEye;
            else if (overridePart === "lumps") partExists = f.limbs.lumps;
            else if (overridePart === "leftWing") partExists = f.limbs.leftWing;
            else if (overridePart === "rightWing")
              partExists = f.limbs.rightWing;
            else if (overridePart === "horn") partExists = f.limbs.horn;
            else if (overridePart === "spay") partExists = !f.spayed;
            else if (overridePart && overridePart.startsWith("leg_")) {
              const idx = parseInt(overridePart.split("_")[1]);
              partExists = f.limbs.legs[idx];
            }

            if (partExists) {
              hitPart = overridePart;
            } else {
              // If override selected but part missing, no swing
              hitPart = null;
            }
          }

          if (hitPart) {
            playSound("knife");
            // Create blood puddle
            const pX = f.x;
            const pY = f.getBottomY();
            if (knife.type !== "scalpel") {
              addPointToPuddle(f.scene, pX, pY, "#8a0303", 5 / 200, 25 / 200);
            }
            // Amputate!
            playSound("knife");
            const amputated = f.amputate(hitPart, knife);
            f.changeHappiness(HAPPINESS_PENALTY_AMPUTATION);

            notifyViolence(f, false, knife.type, false, !!amputated);

            // Calculate health damage
            if (knife.type !== "scalpel") {
              let damage = 100 / (2 + 14 * f.growth);
              if (amputated) damage *= 2;
              f.health -= damage;
            }

            if (amputated) {
              if (amputated === "lumps") {
                if (f.tooYoungToSpeak()) {
                  f.speak(getDialogue(["AMPUTATION", "CHIRPY"], f));
                } else {
                  f.speak(getDialogue(["AMPUTATION", "LUMPS"], f));
                }
                f.traumaMemory.push({
                  type: "lumps",
                  timer: 30 + Math.random() * 60,
                });
              } else {
                if (f.tooYoungToSpeak()) {
                  f.speak(getDialogue(["AMPUTATION", "CHIRPY"], f));
                } else {
                  f.speak(getDialogue(["AMPUTATION", "DEFAULT"], f));
                }
                if (amputated.startsWith("leg")) {
                  f.traumaMemory.push({
                    type: "legs",
                    timer: 30 + Math.random() * 60,
                  });
                }
              }

              // Spawn Gib
              // Assuming tinted images exist since we hit tested

              let gibImg = null;

              if (amputated === "head" || amputated === "ears")
                gibImg = f.tinted.ear;
              let gibGrowth = 0;
              if (amputated === "tail") {
                gibImg = f.tinted.tail;
                gibGrowth = 0.1 * f.growth;
              } else if (amputated.startsWith("leg")) {
                gibImg = f.tinted.leg;
                gibGrowth = 0.1 * f.growth;
              } else if (amputated === "lumps") {
                gibImg = f.tinted.special_lumps;
                gibGrowth = 0.025 * f.growth;
              } else if (amputated === "udders") {
                gibImg = f.tinted.udders;
                gibGrowth = 0.025 * f.growth;
              } else if (
                amputated.startsWith("rightEar") ||
                amputated.startsWith("leftEar")
              ) {
                gibImg = f.tinted.ear;
                gibGrowth = 0.025 * f.growth;
              } else if (amputated === "horn") {
                gibImg = f.tinted.horn;
                gibGrowth = 0.025 * f.growth;
              } else if (
                amputated === "leftWing" ||
                amputated === "rightWing"
              ) {
                gibImg = f.tinted.wing;
                gibGrowth = 0.05 * f.growth;
              }

              if (gibImg) {
                playSound("amputation");
                const partKey = amputated.includes("head")
                  ? "head"
                  : amputated.includes("torso")
                    ? "torso"
                    : amputated.includes("tail")
                      ? "tail"
                      : amputated.includes("Ear")
                        ? "ear"
                        : amputated.includes("leg")
                          ? "leg"
                          : amputated.includes("lumps")
                            ? "special_lumps"
                            : amputated.includes("udders")
                              ? "horse_udders"
                              : amputated === "horn"
                                ? "horn"
                                : amputated === "leftWing" ||
                                    amputated === "rightWing"
                                  ? "wing"
                                  : "part";
                let spotsConfig = null;
                if (f.hasSpots) {
                  const baseConfig = {
                    color: f.colors.spots,
                    seed: f.spotPatternSeed,
                  };
                  if (partKey === "head") {
                    spotsConfig = {
                      ...baseConfig,
                      seed: baseConfig.seed + 13,
                      isHead: true,
                    };
                  } else if (partKey === "torso") {
                    spotsConfig = baseConfig;
                  } else if (partKey === "ear") {
                    spotsConfig = {
                      ...baseConfig,
                      seed: baseConfig.seed + 47,
                      isLeg: true,
                    };
                  } else if (partKey === "leg") {
                    spotsConfig = {
                      ...baseConfig,
                      seed: baseConfig.seed + 29,
                      isLeg: true,
                    };
                  } else if (partKey === "sbs_double_chin") {
                    spotsConfig = {
                      ...baseConfig,
                      seed: baseConfig.seed + 71,
                      isLeg: true,
                    };
                  }
                }

                let stripesConfig = null;
                if (f.hasStripes) {
                  const baseConfig = {
                    color: f.colors.stripes,
                    seed: f.stripePatternSeed,
                  };
                  if (partKey === "head") {
                    stripesConfig = {
                      ...baseConfig,
                      seed: baseConfig.seed + 13,
                      isHead: true,
                    };
                  } else if (partKey === "torso") {
                    stripesConfig = baseConfig;
                  } else if (partKey === "ear") {
                    stripesConfig = {
                      ...baseConfig,
                      seed: baseConfig.seed + 47,
                      isLeg: true,
                    };
                  } else if (partKey === "leg") {
                    stripesConfig = {
                      ...baseConfig,
                      seed: baseConfig.seed + 29,
                      isLeg: true,
                    };
                  } else if (partKey === "sbs_double_chin") {
                    stripesConfig = {
                      ...baseConfig,
                      seed: baseConfig.seed + 71,
                      isLeg: true,
                    };
                  }
                }

                let faceData = null;
                if (partKey === "head") {
                  let activeExp = "NEUTRAL";
                  if (f.expressionOverride && f.expressionOverrideTimer > 0) {
                    activeExp = f.expressionOverride;
                  } else if (f.expression) {
                    activeExp = f.expression;
                  } else if (!f.isAlive) {
                    activeExp = "SAD";
                  }

                  faceData = {
                    expression: activeExp,
                    eyeColor: f.colors ? f.colors.pupil : "black",
                    maneType: f.maneType !== undefined ? f.maneType : 0,
                    maneColor: f.colors ? f.colors.mane : null,
                    gradientConfig: f.hasGradient
                      ? {
                          color: f.colors.gradient,
                          intensity: f.gradientIntensity,
                        }
                      : null,
                    hasHorn: !!(f.limbs && f.limbs.horn),
                    hornSizeFactor: f.hornSizeFactor || 1.0,
                  };
                }

                const gib = new Gib(
                  partKey,
                  f.colors.body,
                  f.scene,
                  partKey,
                  f.x,
                  f.y,
                  null, // No grinder
                  {
                    left: 0,
                    right: width,
                    top: 0,
                    bottom: f.y + f.tinted.torso.height * 0.5,
                    isGrinder: false,
                  },
                  f.scale,
                  gibGrowth,
                  null,
                  spotsConfig,
                  gibImg,
                  stripesConfig,
                  faceData,
                );
                gibs.push(gib);
              }

              // Visual effects

              for (let k = 0; k < 5; k++) {
                poofs.push(
                  new Poof(
                    f.x + (Math.random() - 0.5) * 50,
                    f.y + (Math.random() - 0.5) * 50,
                    f.scene,
                  ),
                );
              }
            } else {
              // Standard hit if no amputation possible (already gone or torso)

              if (f.tooYoungToSpeak()) {
                f.speak(getDialogue(["HURT", "CHIRPY"], f));
              } else {
                f.speak(getDialogue("HURT", f));
              }
            }

            f.excrete("poop");
            f.excrete("pee");

            if (f.health <= 0) {
              f.die("knife");
            } else {
              f.expressionOverride = "CRYING_SHOCKED";
              f.expressionOverrideTimer = 6.0;
              f.initBehavior("FLUFFY_KNOCKED_DOWN");
              f.stateTimer = 0.5;
            }

            knife.whackTimer = 0.2;
            hitFluffy = true;
            break;
          }
        }
        if (!hitFluffy) obj.onDrop();
        return true;
      } else if (obj instanceof MagnifyingGlass) {
        let hitFluffy = false;
        for (const f of fluffies) {
          if (f.scene !== obj.scene) continue;
          if (f.hitTestAsSeen(mouse.x, mouse.y)) {
            openInspectionModal(f);
            hitFluffy = true;
            break;
          }
        }
        if (!hitFluffy) obj.onDrop();
        return true;
      } else if (obj instanceof SutureKit) {
        let kit = obj;
        let hitFluffy = false;
        for (const f of fluffies) {
          if (f.scene !== kit.scene || !f.isAlive) continue;
          if (
            f.currentCage &&
            typeof FoalInACan !== "undefined" &&
            f.currentCage instanceof FoalInACan
          )
            continue;
          if (f.hitTestAsSeen(mouse.x, mouse.y)) {
            if (f.bleedingTimer > 0) {
              f.bleedingTimer = 0;
              kit.whackTimer = 0.2;
              kit.charges--;
              hitFluffy = true;
              if (kit.charges <= 0) {
                if (typeof removeToolFromToolbox === "function") {
                  removeToolFromToolbox(kit);
                }
                const idx = objects.indexOf(kit);
                if (idx > -1) objects.splice(idx, 1);
                if (
                  typeof poofs !== "undefined" &&
                  typeof Poof !== "undefined"
                ) {
                  poofs.push(new Poof(kit.x, kit.y, kit.scene));
                }
              }
              break;
            }
          }
        }
        if (!hitFluffy) kit.onDrop();
        return true;
      } else if (typeof TrashBag !== "undefined" && obj instanceof TrashBag) {
        if (typeof objects !== "undefined" && obj.fillAmount > 0) {
          const grinders = objects.filter(
            (o) => o instanceof Grinder && o.scene === obj.scene,
          );
          for (const grinder of grinders) {
            const g = grinder.bounds;
            if (
              obj.x > g.left &&
              obj.x < g.right &&
              obj.y > g.top &&
              obj.y < g.bottom
            ) {
              obj.emptyIntoGrinder(grinder);
              return true;
            }
          }
        }
        obj.onDrop();
        return true;
      } else if (obj instanceof FoodBag) {
        obj.onDrop();
        return true;
      }

      obj.onDrop();
      return true;
    }
  }
  for (const gib of gibs) {
    if (gib.isDragging) {
      gib.onDrop();
      return true;
    }
  }

  return false;
}

function randomFeralQuality() {
  return Math.random() < 0.75 ? Math.random() * 0.4 : Math.random();
}
// Feral Spawning
let feralTimer = 0; // Start by spawning a feral
let feralDespawnTimer = 30;
function spawnFeralGroup(targetScene, forcedScenario = null) {
  let scenario = forcedScenario;
  if (!scenario) {
    const r = Math.random();
    if (r < 0.15) {
      scenario = "herd";
    } else {
      const others = ["lone", "couple", "abandoned_baby", "single_mom"];
      scenario = others[Math.floor(Math.random() * others.length)];
    }
  }
  const sceneCfg =
    typeof getSceneConfig === "function"
      ? getSceneConfig(targetScene)
      : typeof SCENES !== "undefined"
        ? SCENES[targetScene]
        : null;
  const hasRiver = (sceneCfg && sceneCfg.hasRiver) || targetScene === "RIVER";

  let spawnX;
  if (hasRiver) {
    const minX = width * 0.25 + 80;
    const maxX = width - 80;
    spawnX = minX + Math.random() * Math.max(0, maxX - minX);
  } else {
    spawnX = Math.random() * width;
  }
  const spawnY = Math.random() * (height - 200) + 200;

  const spawnFeral = (
    growth,
    personalities = [],
    type = "earthy",
    forceBq = null,
    forceMq = null,
    motherId = null,
    gender = null,
    initialGenes = null,
  ) => {
    const bq = forceBq !== null ? forceBq : randomFeralQuality();
    const mq = forceMq !== null ? forceMq : randomFeralQuality();
    const h = new Horse(
      growth,
      motherId,
      targetScene,
      type,
      initialGenes,
      bq,
      mq,
      gender,
    );
    let fx = spawnX + (Math.random() - 0.5) * 50;
    let fy = spawnY + (Math.random() - 0.5) * 50;
    if (hasRiver) {
      fx = Math.max(width * 0.25 + 50, Math.min(width - 50, fx));
    }
    h.x = fx;
    h.y = fy;
    h.personalities = [...h.personalities, ...personalities];
    fluffies.push(h);
    return h;
  };

  const getRandomPersonality = (isBaby = false, isFemale = false) => {
    let personalities = [];
    if (isBaby) {
      personalities.push("abandoned_baby");
    } else {
      const pool = ["true_feral", "lost_from_herd", "runaway", "mill_escapee"];
      personalities.push(pool[Math.floor(Math.random() * pool.length)]);
    }

    // Add up to 2 extra personalities
    const extraPool = [
      "true_feral",
      "lost_from_herd",
      "runaway",
      "mill_escapee",
    ];
    for (let i = 0; i < 2; i++) {
      if (Math.random() < 0.2) {
        const p = extraPool[Math.floor(Math.random() * extraPool.length)];
        if (personalities.includes(p)) continue;

        // Mutual Exclusions
        if (
          p === "true_feral" &&
          (personalities.includes("runaway") ||
            personalities.includes("mill_escapee") ||
            personalities.includes("mill_baby"))
        )
          continue;
        if (
          p === "runaway" &&
          (personalities.includes("true_feral") ||
            personalities.includes("abandoned_baby") ||
            personalities.includes("mill_escapee") ||
            personalities.includes("mill_baby"))
        )
          continue;
        if (
          (p === "mill_escapee" || p === "mill_baby") &&
          (personalities.includes("true_feral") ||
            personalities.includes("runaway") ||
            personalities.includes("abandoned_baby"))
        )
          continue;
        if (
          p === "abandoned_baby" &&
          (personalities.includes("runaway") ||
            personalities.includes("mill_escapee") ||
            personalities.includes("mill_baby"))
        )
          continue;

        personalities.push(p);
      }
    }

    return personalities;
  };

  const adjustQuality = (personalities) => {
    if (personalities.includes("runaway")) return 0.6 + Math.random() * 0.4;
    if (
      personalities.includes("mill_escapee") ||
      personalities.includes("mill_baby")
    )
      return 0.5 + Math.random() * 0.5;
    if (personalities.includes("smarty")) return 0.4 + Math.random() * 0.4;
    return null; // use default feral quality
  };

  const getScenarioType = (personalities) => {
    if (
      personalities.includes("mill_escapee") ||
      personalities.includes("mill_baby")
    ) {
      const r = Math.random();
      if (r < 0.01) return "alicorn"; // alicorns are extremely rare
      if (r < 0.4) return "unicorn";
      if (r < 0.7) return "pegasus";
    }
    if (personalities.includes("smarty")) {
      if (Math.random() < 0.5) return "unicorn";
    }
    return "earthy";
  };

  if (scenario === "lone") {
    const p = getRandomPersonality();
    spawnFeral(
      1.0,
      p,
      getScenarioType(p),
      adjustQuality(p),
      adjustQuality(p),
      null,
      p.includes("smarty") ? "male" : null,
    );
  } else if (scenario === "couple") {
    const p1 = getRandomPersonality();
    const h1 = spawnFeral(
      1.0,
      p1,
      "earthy",
      adjustQuality(p1),
      adjustQuality(p1),
      null,
      "male",
    );
    const p2 = getRandomPersonality();
    const h2 = spawnFeral(
      1.0,
      p2,
      "earthy",
      adjustQuality(p2),
      adjustQuality(p2),
      null,
      "female",
    );
    if (h1.type === "alicorn") {
      h2.alicornTolerance = true;
    }
    if (h2.type === "alicorn") {
      h1.alicornTolerance = true;
    }
    if (!isSexuallyAttractedTo(h1, h2)) {
      h1.sexuality = "heterosexual";
    }
    if (!isSexuallyAttractedTo(h2, h1)) {
      h2.sexuality = "heterosexual";
    }
    relationships[h1.id][h2.id] = "special_friend";
    relationships[h2.id][h1.id] = "special_friend";
  } else if (scenario === "abandoned_baby") {
    spawnFeral(
      0.0,
      ["abandoned_baby"],
      Math.random() < 0.01 ? "alicorn" : "earthy", // alicorns are extremely rare
    );
  } else if (scenario === "single_mom") {
    const p = getRandomPersonality(false, true);
    const mom = spawnFeral(
      1.0,
      p,
      "earthy",
      adjustQuality(p),
      adjustQuality(p),
      null,
      "female",
    );
    mom.lactatingTimer = 900;
    mom.milkCharges = 5;
    const ghostDadGenes = mom.generateRandomGenes(
      randomFeralQuality(),
      randomFeralQuality(),
    );
    const numBabies = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < numBabies; i++) {
      const babyGenes = mom.combineGenes(ghostDadGenes);
      spawnFeral(0.0, [], "earthy", null, null, mom.id, null, babyGenes);
    }
  } else if (scenario === "herd") {
    const herdSize = 5 + Math.floor(Math.random() * 6);
    let smartySpawned = false;
    const currentHerdId = nextHerdId++;
    for (let i = 0; i < herdSize; i++) {
      let p;
      let type = "earthy";
      let spawnedHorse;
      if (!smartySpawned && Math.random() < 0.3) {
        p = ["smarty"];
        type = Math.random() < 0.5 ? "unicorn" : "earthy";
        smartySpawned = true;
        spawnedHorse = spawnFeral(
          1.0,
          p,
          type,
          adjustQuality(p),
          adjustQuality(p),
          null,
          "male",
        );
      } else {
        p = getRandomPersonality();
        spawnedHorse = spawnFeral(
          1.0,
          p,
          getScenarioType(p),
          adjustQuality(p),
          adjustQuality(p),
        );
      }
      if (spawnedHorse) {
        spawnedHorse.herdId = currentHerdId;
      }
    }
  }
}

function updateFerals(dt) {
  // Determine active outdoor scenes where the player is NOT present to avoid pop-in
  feralTimer -= dt;
  if (feralTimer <= 0) {
    const validScenes = [];
    for (const sceneKey in SCENES) {
      const config = SCENES[sceneKey];
      if (config.spawnFerals && config.id !== currentScene) {
        validScenes.push(config.id);
      }
    }

    if (validScenes.length > 0) {
      const targetScene =
        validScenes[Math.floor(Math.random() * validScenes.length)];
      spawnFeralGroup(targetScene);
    }
    feralTimer = 15 + Math.random() * 45;
  }

  feralDespawnTimer -= dt;
  // Despawn Chance (1% per second approx check)
  if (Math.random() < 0.3 && feralDespawnTimer <= 0) {
    const candidates = fluffies.filter((f) => {
      const config = getSceneConfig(f.scene);
      return (
        (!config.insidePlayerQuarters ||
          (f.scene === "BACKYARD" && backyardFenceBroken)) &&
        // Living park fluffies have their own comings and goings (ParkLife.js)
        !(f.scene === "PARK" && f.isAlive) &&
        !f.isDragging &&
        f.scene !== currentScene &&
        (f.currentCage === null || f.currentCage === undefined)
      );
    });

    if (candidates.length > 0) {
      const corpsesToRemove = candidates.filter(
        (f) => !f.isAlive && f.despawnProtectionTimer <= 0,
      );
      const livingCandidates = candidates.filter(
        (f) => f.isAlive && f.despawnProtectionTimer <= 0,
      );
      const livingToRemoveCount = Math.ceil(livingCandidates.length * 0.15);
      const livingToRemove = [];

      // Select living victims randomly
      const availableLiving = [...livingCandidates];
      for (
        let i = 0;
        i < livingToRemoveCount && availableLiving.length > 0;
        i++
      ) {
        const idx = Math.floor(Math.random() * availableLiving.length);
        livingToRemove.push(availableLiving.splice(idx, 1)[0]);
      }

      const allToRemove = [...corpsesToRemove, ...livingToRemove];

      if (allToRemove.length > 0) {
        // Trigger dialogue if any living fluffy was in the OUTDOORS scene
        const hasOutdoorVictim = livingToRemove.some(
          (f) => f.scene === "OUTDOORS",
        );
        if (
          getSceneConfig(currentScene).insidePlayerQuarters &&
          hasOutdoorVictim
        ) {
          // Pick one representative victim for the dialogue key
          const rep = livingToRemove.find((f) => f.scene === "OUTDOORS");
          let key = rep.adopted
            ? ["DOG_ATTACK", "ADOPTED"]
            : ["DOG_ATTACK", "FERAL"];
          addDoorMessage(getDialogue(key, rep));
        }

        // Remove all victims
        for (const victim of allToRemove) {
          if (typeof noteFluffyLeft === "function") noteFluffyLeft(victim, "taken");
          const idx = fluffies.indexOf(victim);
          if (idx > -1) fluffies.splice(idx, 1);
        }
      }

      feralDespawnTimer = 30 + Math.random() * 60;
    }
  }
}

let lastTime = 0;
let renderFrameCount = 0; // frames drawn so far (Horse.hitTestAsSeen)
function animate(timestamp) {
  if (!lastTime) lastTime = timestamp;

  if (!document.hasFocus()) {
    lastTime = timestamp;
    requestAnimationFrame(animate);
    return;
  }

  let elapsed = (timestamp - lastTime) / 1000;
  lastTime = timestamp;

  if (elapsed > 0) {
    currentFPS = Math.round(1 / elapsed);
  }

  // Cap catch-up to 2 seconds to prevent heavy lag after long inactivity
  if (elapsed > 2.0) elapsed = 2.0;

  // Park camera (Park.js); game logic sees world mouse positions
  if (typeof updateParkCamera === "function") updateParkCamera(elapsed);
  if (typeof mouseToWorld === "function") mouseToWorld();

  const fixedStep = 0.016; // ~60fps steps for physics stability
  const realElapsed = elapsed; // for fast forward (GameSpeed.js)
  while (elapsed > 0) {
    const dt = Math.min(elapsed, fixedStep);
    if (gameState === "PLAYING") {
      updateSimulation(dt);
    } else if (gameState === "TITLE") {
      titleBGTimer += dt;
    }

    if (transitionPhase !== "OFF") {
      transitionTimer += dt;
      const duration = 1.5; // 1s growth + 0.5s stagger
      const waitDuration = 0.0;

      if (transitionPhase === "IN" && transitionTimer >= duration) {
        transitionPhase = "WAIT";
        transitionTimer = 0;
        if (
          (preTransitionState === "PAUSE_LOADING" ||
            preTransitionState === "TITLE_LOADING") &&
          pendingSaveToLoad
        ) {
          const saveName = pendingSaveToLoad;
          pendingSaveToLoad = null;
          isTransitionLoading = true;
          loadGame(saveName).finally(() => {
            isTransitionLoading = false;
          });
        }
      } else if (
        transitionPhase === "WAIT" &&
        transitionTimer >= waitDuration &&
        !isTransitionLoading
      ) {
        switch (preTransitionState) {
          case "TITLE_NEW":
            gameState = "PLAYING";
            break;
          case "PLAYING":
            gameState = "TITLE";
            break;
          case "TITLE_LOADING":
          case "PAUSE_LOADING":
            gameState = "PLAYING";
            currentPauseScreenshot = null;
            break;
        }
        transitionPhase = "OUT";
        transitionTimer = 0;
      } else if (transitionPhase === "OUT" && transitionTimer >= duration) {
        transitionPhase = "OFF";
        transitionTimer = 0;
      }
    }

    elapsed -= dt;
  }
  // Fast forward: extra game steps at 2x/4x/8x
  if (typeof runFastForward === "function") runFastForward(realElapsed, fixedStep);

  render();
  requestAnimationFrame(animate);
}

function updateDayCare(dt) {
  if (isNaN(dt) || dt <= 0) return;
  if (typeof dayCareFluffies === "undefined" || !dayCareFluffies) return;

  // 1. Age and grow day care fluffies (CPU friendly)
  for (let i = 0; i < dayCareFluffies.length; i++) {
    const data = dayCareFluffies[i];
    data.age = (data.age || 0) + dt;
    if (data.growth < 1.0) {
      const growthMult =
        typeof debugGrowthMultiplier !== "undefined"
          ? debugGrowthMultiplier
          : 1.0;
      data.growth = Math.min(1.0, data.growth + (dt / 1680.0) * growthMult);
      if (data.growth >= 1.0) {
        if (typeof relationships !== "undefined") {
          for (const ownerId in relationships) {
            if (
              relationships[ownerId] &&
              relationships[ownerId][data.id] === "baby_child"
            ) {
              relationships[ownerId][data.id] = "child";
            }
          }
        }
      }
    }
  }

  // 2. Recurring cost: 50 money per fluffy every minute
  if (dayCareFluffies.length > 0) {
    dayCareFeeTimer -= dt;
    if (dayCareFeeTimer <= 0) {
      dayCareFeeTimer = DAY_CARE_FEE_INTERVAL;
      const totalFee =
        dayCareFluffies.length * DAY_CARE_RECURRING_FEE_PER_FLUFFY;
      if (!showDebugMenu) {
        money = Math.max(0, money - totalFee);
      }
      if (typeof addUIMessage !== "undefined") {
        addUIMessage(
          `Day Care Fee: Paid $${totalFee.toLocaleString()} ($${DAY_CARE_RECURRING_FEE_PER_FLUFFY}/fluffy)`,
        );
      }
    }
  } else {
    dayCareFeeTimer = DAY_CARE_FEE_INTERVAL;
  }
}

function updateSimulation(dt) {
  timePlayed += dt;
  // Keep the family record book up to date (FamilyTree.js)
  if (typeof updateFamilyRecords === "function") updateFamilyRecords(dt);
  // Bonds and grudges between fluffies (Bonds.js)
  if (typeof updateSocialBonds === "function") updateSocialBonds(dt);
  // Herds forming, joining, leaving, rivalries (Herds.js)
  if (typeof updateHerds === "function") updateHerds(dt);
  // Herds claiming and fighting over meadows in the park (Territory.js)
  if (typeof updateTerritories === "function") updateTerritories(dt);
  // Day, night and weather (WorldTime.js)
  if (typeof updateWorldTime === "function") updateWorldTime(dt);
  // Fluffies missing the ones they were taken from (Separation.js)
  if (typeof updateSeparations === "function") updateSeparations(dt);
  // Offer to name fluffies that have just become yours (Names.js)
  if (typeof updateNamingPopups === "function") updateNamingPopups(dt);
  // Wild fluffies settling in at home (Wellbeing.js)
  if (typeof updateSettling === "function") updateSettling(dt);
  // Breeder goals (Goals.js)
  if (typeof updateGoals === "function") updateGoals(dt);
  // What happened today, for the morning report (DayReport.js)
  if (typeof updateDayReport === "function") updateDayReport(dt);
  // Night-time events in the park: foxes, bumper crops... (NightEvents.js)
  if (typeof updateNightEvents === "function") updateNightEvents(dt);
  // Fluffies getting used to alicorns (AlicornAcceptance.js)
  if (typeof updateAlicornAcceptance === "function") updateAlicornAcceptance(dt);
  // Corpses rot away (Corpses.js)
  if (typeof updateCorpses === "function") updateCorpses(dt);
  // Customer orders: new ones, deadlines (Orders.js)
  if (typeof updateCustomerOrders === "function") updateCustomerOrders(dt);
  // Breeders' market restocks each morning (StockMarket.js)
  if (typeof updateStockMarket === "function") updateStockMarket(dt);
  updatePuddles(dt);
  updateDayCare(dt);

  // Backyard Fence Break Logic
  if (!backyardFenceBroken && backyardFenceTier < 2) {
    backyardFenceBreakTimer -= dt;
    if (backyardFenceBreakTimer <= 0) {
      const rollInterval = backyardFenceTier === 0 ? 120.0 : 600.0;
      backyardFenceBreakTimer = rollInterval;
      if (Math.random() < 0.5) {
        backyardFenceBroken = true;
        if (typeof addUIMessage !== "undefined") {
          addUIMessage("The backyard fence has broken!");
        }
      }
    }
  }

  // Backyard Fence Broken - Invasion Roll
  if (backyardFenceBroken) {
    backyardInvasionTimer -= dt;
    if (backyardInvasionTimer <= 0) {
      backyardInvasionTimer = 60.0;
      if (Math.random() < 0.1) {
        spawnFeralGroup("BACKYARD");
      }
    }
  }

  // Spontaneous spawning for grassy scenes
  for (const sceneKey in SCENES) {
    const config = SCENES[sceneKey];
    if (config.isGrassy) {
      const hasGrass = objects.some(
        (o) => o instanceof Grass && o.scene === config.id,
      );
      const targetInterval = hasGrass
        ? GRASS_SPAWN_INTERVAL_HAS_GRASS
        : GRASS_SPAWN_INTERVAL_NO_GRASS;

      if (sceneGrassSpawnTimers[config.id] === undefined) {
        sceneGrassSpawnTimers[config.id] = 15.0;
      }

      sceneGrassSpawnTimers[config.id] -= dt;

      if (sceneGrassSpawnTimers[config.id] <= 0) {
        sceneGrassSpawnTimers[config.id] = targetInterval;

        if (Math.random() < 0.5 && images && images.grass) {
          let spawnX = 50 + Math.random() * (width - 100);
          if (config.hasRiver) {
            spawnX =
              width * 0.25 +
              images.grass.width +
              Math.random() * (width * 0.75 - 100);
          }
          const y = height * 0.15 + 50 + Math.random() * (height * 0.85 - 100);
          const newGrass = new Grass(spawnX, y, config.id, 0.0);
          objects.push(newGrass);
          if (typeof poofs !== "undefined") {
            poofs.push(new Poof(spawnX, y, config.id, "green"));
          }
        }
      }
    }
  }

  for (let i = objects.length - 1; i >= 0; i--) {
    const obj = objects[i];
    obj.update(dt);
    if (
      obj.isDestroyed ||
      (obj instanceof FoodBag && obj.amount <= 0) ||
      obj.shouldDespawn
    ) {
      if ((obj instanceof FoodBag && obj.amount <= 0) || obj.shouldDespawn) {
        if (obj.isDragging) isGlobalDragging = false;
        poofs.push(new Poof(obj.x, obj.y, obj.scene));
      }
      objects.splice(i, 1);
    }
  }

  updateFerals(dt);
  if (typeof updateParkLife === "function") updateParkLife(dt);
  updateMoneyAndRequests(dt);
  updateDoorMessages(dt);

  // Update Fluffies and handle deaths
  const now = gameTimeMs();
  if (typeof prepareFenceCollisions === "function") prepareFenceCollisions();
  for (let i = fluffies.length - 1; i >= 0; i--) {
    const f = fluffies[i];
    f.update(dt);
    // Fluffies can't walk through fence pieces
    if (typeof resolveFenceCollision === "function") {
      resolveFenceCollision(f);
    }
    // ...and get sad if a pen separates them from friends or family
    if (typeof updatePenFeelings === "function") {
      updatePenFeelings(f, dt);
    }
    // Trust grows, fear fades (Memory.js)
    if (typeof updatePlayerMemory === "function") {
      updatePlayerMemory(f, dt);
    }
    if (f.scene === currentScene) {
      f.lastSeenPlayerTime = now;
    }
    if (f.isDestroyed) {
      fluffies.splice(i, 1);
    }
  }

  updateGibs(dt);

  // Spawn cardboard boxes periodically for alley scenes
  if (typeof alleyBoxSpawnTimer !== "undefined") {
    alleyBoxSpawnTimer -= dt;
    if (alleyBoxSpawnTimer <= 0) {
      alleyBoxSpawnTimer = 180.0 + Math.random() * 180.0;
      const alleyScenes = Object.keys(SCENES).filter((s) => isAlleyScene(s));
      const candidateScenes = alleyScenes.filter((s) => {
        const count = objects.filter(
          (o) =>
            o instanceof Bed && o.type === "cardboard_box" && o.scene === s,
        ).length;
        return count < 3;
      });
      if (candidateScenes.length > 0) {
        const targetScene = candidateScenes.includes(currentScene)
          ? currentScene
          : candidateScenes[Math.floor(Math.random() * candidateScenes.length)];
        const box = new Bed(targetScene, "cardboard_box");
        const topWallHeight = height * 0.15;
        box.x = 100 + Math.random() * (width - 200);
        box.y =
          topWallHeight + 50 + Math.random() * (height - topWallHeight - 120);
        objects.push(box);
      }
    }
  }

  // Spawn and update cars in ALLEY_ROAD
  if (currentScene === "ALLEY_ROAD") {
    carSpawnTimer -= dt;
    if (carSpawnTimer <= 0) {
      cars.push(new Car("ALLEY_ROAD"));
      carSpawnTimer = 6.0 + Math.random() * 6.0; // spawn every 6-12s
    }
  }

  for (let i = cars.length - 1; i >= 0; i--) {
    const car = cars[i];
    car.update(dt);

    if (currentScene === "ALLEY_ROAD") {
      const carImg = images[car.carType];
      const carW = carImg ? carImg.width : 400;
      const carH = carImg ? carImg.height : 150;

      for (let j = fluffies.length - 1; j >= 0; j--) {
        const f = fluffies[j];
        if (f.scene === "ALLEY_ROAD" && !f.isDestroyed) {
          const fRadius = 30 * f.scale;
          const fHeight = 50 * f.scale;

          const fLeft = f.x - fRadius;
          const fRight = f.x + fRadius;
          const fTop = f.y - fHeight;
          const fBottom = f.y;

          const carLeft = car.x;
          const carRight = car.x + carW;
          const carTop = car.y + 100;
          const carBottom = car.y + carH + 20;

          const hit = !(
            fRight < carLeft ||
            fLeft > carRight ||
            fBottom < carTop ||
            fTop > carBottom
          );

          if (hit) {
            playSound("amputation");

            f.anatomy.explodeFromCar(car);

            if (typeof addPointToPuddle !== "undefined") {
              addPointToPuddle(
                "ALLEY_ROAD",
                f.x,
                f.y,
                "#8a0303",
                0.1,
                0.3,
                0.8,
              );
            }

            if (typeof poofs !== "undefined") {
              for (let k = 0; k < 8; k++) {
                const px = f.x + (Math.random() - 0.5) * 50;
                const py = f.y - 20 + (Math.random() - 0.5) * 50;
                poofs.push(new Poof(px, py, "ALLEY_ROAD", "#8a0303"));
              }
            }
          }
        }
      }

      // Collisions with gibs
      for (let j = gibs.length - 1; j >= 0; j--) {
        const g = gibs[j];
        if (
          g.scene === "ALLEY_ROAD" &&
          !g.shouldDespawn &&
          !g.grinder &&
          (g.carCollisionCooldown === undefined || g.carCollisionCooldown <= 0)
        ) {
          const gW = g.img ? g.img.width * g.scale : 20;
          const gH = g.img ? g.img.height * g.scale : 20;
          const gLeft = g.x - gW / 2;
          const gRight = g.x + gW / 2;
          const gTop = g.y - gH / 2;
          const gBottom = g.y + gH / 2;

          const carLeft = car.x;
          const carRight = car.x + carW;
          const carTop = car.y + 100;
          const carBottom = car.y + carH + 20;

          const hit = !(
            gRight < carLeft ||
            gLeft > carRight ||
            gBottom < carTop ||
            gTop > carBottom
          );

          if (hit) {
            g.shouldDespawn = true;
            playSound("amputation");

            if (typeof poofs !== "undefined") {
              for (let k = 0; k < 4; k++) {
                const px = g.x + (Math.random() - 0.5) * 20;
                const py = g.y + (Math.random() - 0.5) * 20;
                poofs.push(new Poof(px, py, "ALLEY_ROAD", "#8a0303"));
              }
            }

            if (typeof addPointToPuddle !== "undefined") {
              addPointToPuddle(
                "ALLEY_ROAD",
                g.x,
                g.y,
                "#8a0303",
                0.0,
                (20 + Math.random() * 20) / 200,
                0.05,
              );
            }
          }
        }
      }
    }

    if (car.isDestroyed) {
      cars.splice(i, 1);
    }
  }
}

function render() {
  ctx.clearRect(0, 0, width, height);

  if (gameState === "TITLE") {
    drawTitleScreen();
    if (showSaveList) {
      drawSaveList();
    }
    if (showWorldSettingsPrompt) {
      drawWorldSettingsPrompt();
    }
    drawTransition();
    return;
  }

  // Create an OffscreenCanvas to buffer drawing
  const offScreenCanvas = new OffscreenCanvas(width, height);
  const osCtx = offScreenCanvas.getContext("2d");

  // Fluffy Park: draw the world through the camera (Park.js)
  const parkCam =
    typeof isCameraScene === "function" && isCameraScene(currentScene) ? camera : null;
  if (parkCam) {
    if (typeof mouseToWorld === "function") mouseToWorld();
    osCtx.save();
    osCtx.translate(-Math.round(parkCam.x), -Math.round(parkCam.y));
  }

  drawBackground(osCtx);
  // Snow lying on the ground (WorldTime.js)
  if (typeof drawWeatherGround === "function") drawWeatherGround(osCtx);
  if (parkCam && typeof drawParkScenery === "function") drawParkScenery(osCtx);

  if (typeof drawRoad !== "undefined") {
    drawRoad(osCtx);
  }
  renderPuddles(osCtx);
  drawForegroundBackground(osCtx);
  // Shopping street shop front and store shelves (Store.js)
  if (typeof drawStoreScenery === "function") drawStoreScenery(osCtx);
  drawDoorBackground(osCtx);

  // Filter visible renderables
  // (in the park, skip things far off screen)
  const onScreen = (o) => !parkCam || o.isDragging || isOnParkScreen(o.x, o.y);
  const visibleObjects = objects.filter((o) => o.scene === currentScene && onScreen(o));
  const visibleFluffies = fluffies.filter((f) => f.scene === currentScene && onScreen(f));
  // Where each fluffy is drawn this frame, so clicks can be lined up with
  // what the player saw (Horse.hitTestAsSeen)
  renderFrameCount++;
  for (const f of visibleFluffies) {
    f._seenX = f.x;
    f._seenY = f.y;
    f._seenFrame = renderFrameCount;
  }
  const visibleGibs = gibs.filter(
    (g) => g.scene === currentScene && !g.grinder,
  );

  const visibleCars = currentScene === "ALLEY_ROAD" ? cars : [];
  let renderables = [
    ...visibleObjects,
    ...visibleFluffies,
    ...visibleGibs,
    ...visibleCars,
  ];

  renderables.sort((a, b) => {
    // If Y is equal, check for cage containment
    if (typeof Cage !== "undefined") {
      if (a instanceof Cage && b.currentCage === a) return 1;
      if (b instanceof Cage && a.currentCage === b) return -1;
    }

    // FluffyTable logic
    if (typeof FluffyTable !== "undefined") {
      if (a instanceof FluffyTable && b.placedOn === a) {
        return a instanceof LitterpalBox ? 1 : -1;
      }
      if (b instanceof FluffyTable && a.placedOn === b) {
        return b instanceof LitterpalBox ? -1 : 1;
      }
    }

    if (a.placedOn) {
      a = a.placedOn;
    }
    if (b.placedOn) {
      b = b.placedOn;
    }

    if (a instanceof IVBag && a.attachedTo === b) {
      return 1;
    }
    if (b instanceof IVBag && b.attachedTo === a) {
      return -1;
    }
    if (a instanceof IVBag && a.attachedTo) {
      a = a.attachedTo;
    }
    if (b instanceof IVBag && b.attachedTo) {
      b = b.attachedTo;
    }

    // Bed renders in front of its sleeping claimant (except cardboard boxes which render behind)
    if (
      a instanceof Bed &&
      b.claimedBed === a &&
      b.currentStateKey === "SLEEPING"
    )
      return a.type === "cardboard_box" ? -1 : 1;
    if (
      b instanceof Bed &&
      a.claimedBed === b &&
      a.currentStateKey === "SLEEPING"
    )
      return b.type === "cardboard_box" ? 1 : -1;

    // Keep dragged items on top
    if (a.isDragging && !b.isDragging) return 1;
    if (b.isDragging && !a.isDragging) return -1;

    // Y-Sorting
    const ay = a.getBottomY();
    const by = b.getBottomY();

    return ay - by;
  });

  // Draw bed backs before everything else so they're always behind fluffies
  for (const obj of visibleObjects) {
    if (obj instanceof Bed) obj.drawBack(osCtx);
  }

  // Draw Visible Renderables to offscreen buffer
  for (const r of renderables) {
    if (r.drawOffScreen) {
      r.drawOffScreen(osCtx);
    } else {
      r.draw(osCtx);
    }
  }

  if (typeof drawBackyardFence !== "undefined") {
    drawBackyardFence(osCtx);
  }

  drawVFX(osCtx);
  // Foxes in the park at night (NightEvents.js)
  if (parkCam && typeof drawNightPredators === "function") drawNightPredators(osCtx);
  if (parkCam) {
    osCtx.restore();
    if (typeof mouseToScreen === "function") mouseToScreen();
  }
  // Night, sunsets, clouds, rain, snow, lightning (WorldTime.js)
  if (typeof drawSkyAndWeather === "function") drawSkyAndWeather(osCtx);
  // Their eyes shine in the dark (NightEvents.js)
  if (parkCam && typeof drawNightPredatorEyes === "function") drawNightPredatorEyes(osCtx, parkCam);
  drawUI(osCtx);
  if (parkCam) {
    osCtx.save();
    osCtx.translate(-Math.round(parkCam.x), -Math.round(parkCam.y));
    if (typeof mouseToWorld === "function") mouseToWorld();
  }

  // Draw Speech Bubbles and Dreams above everything else
  for (const f of visibleFluffies) {
    if (f.isAlive) {
      if (f.speech.text) f.drawSpeechBubble(osCtx);
      // Herd marker when H is on (Herds.js)
      if (typeof drawHerdMarker === "function") drawHerdMarker(osCtx, f);
      if (f.currentStateKey === "SLEEPING") f.drawDream(osCtx);
      const isPairSelection =
        debugMenuAction === "pair" && debugPairFirst === f.id;
      if (showFluffyNames || isPairSelection) {
        const name = fluffyDisplayNameById(f.id);
        const nameY = f.y + 45 * Math.sqrt(f.scale * 2.0);
        osCtx.save();
        osCtx.font = "bold 13px Arial";
        osCtx.textAlign = "center";
        const tw = osCtx.measureText(name).width;
        const ph = 18,
          pw = tw + 12;
        const bx = f.x - pw / 2,
          by = nameY;
        if (isPairSelection) {
          osCtx.fillStyle = "rgba(180,130,0,0.85)";
        } else {
          osCtx.fillStyle = "rgba(0,0,0,0.6)";
        }
        if (osCtx.roundRect) {
          osCtx.beginPath();
          osCtx.roundRect(bx, by, pw, ph, 5);
          osCtx.fill();
        } else {
          osCtx.fillRect(bx, by, pw, ph);
        }
        if (isPairSelection) {
          osCtx.strokeStyle = "gold";
          osCtx.lineWidth = 1.5;
          if (osCtx.roundRect) {
            osCtx.beginPath();
            osCtx.roundRect(bx, by, pw, ph, 5);
            osCtx.stroke();
          } else {
            osCtx.strokeRect(bx, by, pw, ph);
          }
          osCtx.fillStyle = "gold";
        } else {
          osCtx.fillStyle = "white";
        }
        osCtx.fillText(name, f.x, by + ph - 8);
        osCtx.restore();
      }
    }
  }

  if (showBedNames) {
    for (const obj of objects) {
      if (
        !(obj instanceof Bed) ||
        obj.scene !== currentScene ||
        obj.claimants.length === 0
      )
        continue;
      const names = obj.claimants.map((id) => fluffyDisplayNameById(id));
      const label = names.join(" & ");
      osCtx.save();
      osCtx.font = "bold 13px Arial";
      osCtx.textAlign = "center";
      const tw = osCtx.measureText(label).width;
      const ph = 18,
        pw = tw + 12;
      const bx = obj.x - pw / 2,
        by = obj.y + 15;
      osCtx.fillStyle = "rgba(0,0,0,0.6)";
      if (osCtx.roundRect) {
        osCtx.beginPath();
        osCtx.roundRect(bx, by, pw, ph, 5);
        osCtx.fill();
      } else {
        osCtx.fillRect(bx, by, pw, ph);
      }
      osCtx.fillStyle = "white";
      osCtx.fillText(label, obj.x, by + ph - 4);
      osCtx.restore();
    }
  }

  // Draw Outdoor Tapping Bubbles (if inside player quarters)
  if (getSceneConfig(currentScene).insidePlayerQuarters) {
    drawDoorMessages(osCtx);
  }

  drawTVMessages(osCtx);
  if (parkCam) {
    osCtx.restore();
    if (typeof mouseToScreen === "function") mouseToScreen();
  }

  // Final blit to main canvas
  ctx.drawImage(offScreenCanvas, 0, 0);

  drawPortals();
  // Park title and map (Park.js)
  if (typeof drawParkHud === "function") drawParkHud(ctx);
  // Store shelf hover highlight (Store.js)
  if (typeof drawStoreOverlay === "function") drawStoreOverlay(ctx);
  // Bounty board hover label (OrderBoard.js)
  if (typeof drawOrdersOverlay === "function") drawOrdersOverlay(ctx);
  drawUI(ctx);

  if (gameState === "PAUSED") {
    drawPauseMenu();
  }

  drawTransition();

  if (typeof errorHandler !== "undefined" && errorHandler.errors.length > 0) {
    ctx.save();

    let allLines = [];
    for (let errObj of errorHandler.errors) {
      let prefix = errObj.count > 1 ? `(+${errObj.count - 1}) ` : "";
      let splitLines = errObj.message.split("\n");
      if (splitLines.length > 0) {
        splitLines[0] = prefix + splitLines[0];
      }
      allLines = allLines.concat(splitLines);
      allLines.push("");
    }

    let boxHeight = allLines.length * 16 + 20;
    let boxY = height - boxHeight - 10;

    ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
    ctx.fillRect(10, boxY, width - 20, boxHeight);
    ctx.fillStyle = "white";
    ctx.font = "bold 14px Consolas, monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    for (let i = 0; i < allLines.length; i++) {
      ctx.fillText(allLines[i], 20, boxY + 10 + i * 16);
    }
    ctx.restore();
  }
}

window.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    if (typeof transitionPhase !== "undefined" && transitionPhase !== "OFF") {
      return;
    }
    if (typeof dayCareModalOpen !== "undefined" && dayCareModalOpen) {
      dayCareModalOpen = false;
      return;
    }
    // Morning report (DayReport.js)
    if (typeof isDayReportOpen === "function" && isDayReportOpen()) {
      closeDayReport();
      return;
    }
    // Goals list (Goals.js)
    if (typeof isGoalsOpen === "function" && isGoalsOpen()) {
      closeGoals();
      return;
    }
    // Help (Help.js)
    if (typeof isHelpOpen === "function" && isHelpOpen()) {
      closeHelp();
      return;
    }
    if (typeof inspectedFluffy !== "undefined" && inspectedFluffy) {
      inspectedFluffy = null;
      return;
    }
    if (typeof unequipCurrentTool === "function") {
      const heldTool = objects.some(
        (o) => o.isDragging && typeof isToolObject === "function" && isToolObject(o),
      );
      if (heldTool) {
        unequipCurrentTool();
        return;
      }
    }
    if (gameState === "PLAYING") {
      if (typeof capturePauseScreenshot === "function") {
        capturePauseScreenshot();
      }
      gameState = "PAUSED";
      return;
    } else if (gameState === "PAUSED") {
      if (typeof showSaveList !== "undefined" && showSaveList) {
        showSaveList = false;
        return;
      }
      gameState = "PLAYING";
      return;
    } else if (gameState === "TITLE") {
      if (typeof showSaveList !== "undefined" && showSaveList) {
        showSaveList = false;
        return;
      }
      if (
        typeof showWorldSettingsPrompt !== "undefined" &&
        showWorldSettingsPrompt
      ) {
        showWorldSettingsPrompt = false;
        return;
      }
    }
  }

  if (gameState !== "PLAYING") return;
  if (!document.hasFocus()) return;

  let requestedDir = null;
  // In the park WASD looks around instead (Park.js)
  const inPark = typeof isCameraScene === "function" && isCameraScene(currentScene);
  if (inPark) {
    // nothing: handled by the park's own key listener
  } else if (e.code === "KeyW") requestedDir = "UP";
  else if (e.code === "KeyA") requestedDir = "LEFT";
  else if (e.code === "KeyS") requestedDir = "DOWN";
  else if (e.code === "KeyD") requestedDir = "RIGHT";

  if (requestedDir) {
    if (typeof isAnyScreenOpen === "function" && isAnyScreenOpen()) {
      return;
    }
    if (typeof getScenePortals !== "undefined") {
      const portals = getScenePortals(currentScene);
      let match = null;
      if (requestedDir === "UP") {
        match = portals.find((p) => p.type === "arrow_up" || p.type === "door");
      } else if (requestedDir === "LEFT") {
        match = portals.find((p) => p.type === "arrow_left");
      } else if (requestedDir === "DOWN") {
        match = portals.find((p) => p.type === "arrow_down");
      } else if (requestedDir === "RIGHT") {
        match = portals.find((p) => p.type === "arrow_right");
      }

      if (match && !match.locked) {
        changeScene(match.target);
        return;
      }
    }
  }

  if ((e.code === "Enter" || e.code === "NumpadEnter") && typeof isDayReportOpen === "function" && isDayReportOpen()) {
    closeDayReport();
    return;
  }
  if (e.code === "KeyN") {
    showFluffyNames = !showFluffyNames;
    return;
  }
  // F1: help (Help.js)
  if (e.code === "F1" && typeof isHelpOpen === "function") {
    e.preventDefault();
    if (isHelpOpen()) closeHelp();
    else if (!isAnyScreenOpen()) openHelp();
    return;
  }
  // G: the goals list (Goals.js)
  if (e.code === "KeyG" && typeof isGoalsOpen === "function") {
    if (isGoalsOpen()) closeGoals();
    else if (!isAnyScreenOpen()) openGoals();
    return;
  }
  // F: fast forward to the next speed (GameSpeed.js)
  if (e.code === "KeyF" && typeof nextGameSpeed === "function") {
    nextGameSpeed();
    return;
  }
  // H shows which herd each fluffy is in (Herds.js)
  if (e.code === "KeyH" && typeof showHerdMarkers !== "undefined") {
    showHerdMarkers = !showHerdMarkers;
    return;
  }
  // R turns the fence piece you are holding
  if (e.code === "KeyR" && typeof Fence !== "undefined") {
    const heldFence = objects.find((o) => o instanceof Fence && o.isDragging);
    if (heldFence) {
      heldFence.rotate();
      return;
    }
  }
  if (e.code === "KeyB") {
    showBedNames = !showBedNames;
    return;
  }
  if (e.code === "Escape" && debugMenuAction) {
    debugMenuAction = null;
    debugPairFirst = null;
    return;
  }

  if (["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(e.key)) {
    if (
      typeof hoveredToolboxItem !== "undefined" &&
      hoveredToolboxItem &&
      !hoveredToolboxItem.isNav
    ) {
      const slot = toolbarSlots.find((s) => s.key === e.key);
      if (slot) {
        const assignedTool = hoveredToolboxItem.tool || hoveredToolboxItem;
        slot.tool = assignedTool;
      }
      return;
    }
    const slot = toolbarSlots.find((s) => s.key === e.key);
    if (slot && slot.tool) {
      if (typeof swapOrEquipTool === "function") {
        swapOrEquipTool(slot.tool);
      } else {
        equipTool(slot.tool);
      }
      return;
    }
  }
});

loadImages(() => {
  const startUp = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const saveName = urlParams.get("save");
    if (saveName) {
      await loadGame(saveName);
      gameState = "PLAYING";
    }
    requestAnimationFrame(animate);
  };

  if (navigator.webdriver) {
    startUp();
  } else {
    loadSounds(() => {
      startUp();
    });
  }
});
