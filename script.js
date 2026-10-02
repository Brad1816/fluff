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
    // (slow or busy days, Pressure.js)
    sellRequestTimer -= dt * Math.max(1, Math.log2(indoorCount)) * (typeof marketBuyerRate === "function" ? marketBuyerRate() : 1);

    if (sellRequestTimer <= 0) {
      if (indoorCount > 0) {
        // Prioritize "sell" cage fluffies
        const sellCageFluffies = indoorFluffies.filter(
          (f) => f.currentCage && f.currentCage.tag === "sell",
        );
        const candidates =
          sellCageFluffies.length > 0 ? sellCageFluffies : indoorFluffies;

        // A buyer with tastes picks one they like (Buyers.js)
        currentSellRequest = makeSellRequest(candidates);
      }
      sellRequestTimer =
        sellRequestAverage / 2 + Math.random() * sellRequestAverage;
    }
  }
}

// A held tool that missed (no fluffy under the pointer) stays in your hand:
// it used to fall on the floor, so a near miss kept putting it down. A
// thumbtack or IV bag is put down (that's how you set one), and so is
// anything that isn't a tool. Esc, or the tool's
// toolbar slot, puts a tool away.
let _toolMissTold = false;
function missWithTool(obj) {
  const tool = typeof isToolObject === "function" && isToolObject(obj);
  const placeable = typeof isPlaceableWorldTool === "function" && isPlaceableWorldTool(obj); // (thumbtack, IV bag)
  if (!tool || placeable || (typeof Thumbtack !== "undefined" && obj instanceof Thumbtack)) {
    obj.onDrop();
    return;
  }
  if (typeof toolbox !== "undefined" && !toolbox.includes(obj)) toolbox.push(obj); // (so putting it away keeps it)
  if (!_toolMissTold && typeof addUIMessage === "function") {
    _toolMissTold = true;
    addUIMessage("Missed! It's still in your hand - Esc, or its toolbar slot, puts it away.");
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
          // Another of the same kind: a spare for when this one runs out (IVStand.js)
          if (typeof other.addSpare === "function" && other.addSpare(obj)) {
            obj.isDragging = false;
            isGlobalDragging = false;
            if (typeof removeToolFromToolbox === "function") removeToolFromToolbox(obj);
            const i = objects.indexOf(obj);
            if (i >= 0) objects.splice(i, 1);
            if (typeof addUIMessage === "function") addUIMessage(`Spare ${obj.type.toUpperCase()} bag on the IV stand (${other.spares.length}). It goes up when this one runs out.`);
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
      // Set down on the shelter's drop box: the shelter takes it (Shelter.js)
      if (typeof overShelterDropBox === "function" && overShelterDropBox(mouse.x, mouse.y) && dropInShelterBox(f)) return true;
      // One of yours set down outside: putting it out - ask first (Strays.js)
      if (typeof wouldPutOut === "function" && wouldPutOut(f)) {
        askPutOut(f, "drop");
        return true;
      }
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
              // (a mare it can breed with, if there is one: HorseMating.js)
              const mares = fluffies.filter(
                (m) =>
                  m.gender === "female" &&
                  m.growth >= 1.0 &&
                  m.currentCage === f.currentCage &&
                  m.isAlive,
              );
              const mare = mares.find((m) => !forcedBreedingProblem(f, m)) || mares[0];
              const problem = mare ? forcedBreedingProblem(f, mare) : null;
              if (mare && problem) {
                // Nothing to gain from hurting him: say why, and leave him be
                sayBreedingCageProblem(problem);
                hitFluffy = true;
                break;
              }
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
                        mouse.x - 8, // (just out of the nozzle)
                        mouse.y,
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
                f.pottyTraining + (0.1 + Math.random() * 0.1) * 0.25 * (typeof smartsLearn === "function" ? smartsLearn(f) : 1),
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
              // A squirt of water startles it (a flinch, a third of the
              // upset); the stick knocks it down
              if (!isSpray) {
                f.initBehavior("FLUFFY_KNOCKED_DOWN");
                f.stateTimer = 0.5;
              }

              f.changeHappiness(HAPPINESS_PENALTY_STICK_WHACK * (isSpray ? 0.35 : 1), "Hurt by you");
              f.expressionOverride = "CRYING_SHOCKED";
              f.expressionOverrideTimer = isSpray ? 1.5 : 3.0;

              if (isSpray) {
                obj.sprayTimer = 0.2;
                if (
                  typeof poofs !== "undefined" &&
                  images &&
                  images.spray_bottle
                ) {
                  poofs.push(
                    new Poof(
                      mouse.x - 8, // (just out of the nozzle)
                      mouse.y,
                      obj.scene,
                      "#b4cbff",
                    ),
                  );
                }
              } else {
                obj.whackTimer = 0.2;
              }

              notifyViolence(f, false, isSpray ? "spray" : "stick", key === "TRAINING");
            }

            // (scared stiff: it wets itself - not for a squirt of water)
            if (!isSpray) {
              f.excrete("poop");
              f.excrete("pee");
            }

            hitFluffy = true;
            break;
          }
        }
        if (!hitFluffy) missWithTool(obj);
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
        if (!hitFluffy) missWithTool(obj);
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
        if (!hitFluffy) missWithTool(obj);
        return true;
      } else if (typeof ThrowTool !== "undefined" && obj instanceof ThrowTool) {
        // Lift a fluffy up with it; let go to throw (ThrowTool.js)
        let hitFluffy = false;
        for (let i = fluffies.length - 1; i >= 0; i--) {
          const f = fluffies[i];
          if (f.scene !== obj.scene) continue;
          if (
            f.currentCage &&
            typeof FoalInACan !== "undefined" &&
            f.currentCage instanceof FoalInACan
          )
            continue;
          if (Cage.locksItem(f)) continue;
          let hitPart = f.hitTestAsSeen(mouse.x, mouse.y);
          if (hitPart) {
            hitFluffy = true;
            if (f.placedOn) {
              f.placedOn.releaseFluffy();
              f.placedOn = null;
            }
            f.interruptMating();
            cancelPendingConnections();

            if (f.isAlive) {
              if (f.tooYoungToWalk()) {
                const mom = fluffies.find(
                  (m) =>
                    m.id === f.motherId &&
                    m.scene === f.scene &&
                    m.isAlive &&
                    !m.tooYoungToWalk(),
                );
                if (mom) {
                  mom.setShock(2.0);
                  mom.speak(
                    getDialogue(
                      mom.adopted ? ["UPSIES", "WITNESS_BABY"] : ["UPSIES", "WITNESS_BABY", "FERAL"],
                      mom,
                    ),
                  );
                  const foalPos = f.getWorldPosition();
                  let targetX = foalPos.x + (Math.random() - 0.5) * 100;
                  let targetY = foalPos.y + (Math.random() - 0.5) * 50;
                  mom.setTargetPosition(targetX, targetY);
                  mom.initBehavior("MOVING");
                }
              } else if (hitPart === "torso") {
                let key = f.adopted ? ["UPSIES"] : ["UPSIES", "FERAL"];
                f.speak(getDialogue(key, f));
                if (f.happiness > WAN_DIE_THRESHOLD) {
                  f.changeHappiness(HAPPINESS_BONUS_UPSIES, "Picked up gently");
                  f.expressionOverride = "GOOD_UPSIES";
                  f.expressionOverrideTimer = 2.0;
                }
              } else {
                let key = f.adopted ? ["UPSIES", "BAD"] : ["UPSIES", "BAD", "FERAL"];
                f.speak(getDialogue(key, f));
                f.changeHappiness(HAPPINESS_PENALTY_BAD_UPSIES, "Picked up roughly");
                f.expressionOverride = null;
                f.expressionOverrideTimer = 0;
              }
            }

            f.isDragging = true;
            // Scared fluffies panic, trusting ones like it (Memory.js)
            if (typeof onFluffyPickedUp === "function") onFluffyPickedUp(f);
            f.heldWithThrowTool = true;
            f.currentCage = null;
            f.throwTool = obj;
            obj.heldHorse = f;
            f.grabbedPart = hitPart;
            if (f.grabbedPart !== "torso") {
              f.anim.bodyAngle = 0;
            }

            if (f.throwStartY === null) {
              f.throwStartY = f.y;
            }
            f.throwShadowY =
              typeof f.getBottomY === "function"
                ? f.getBottomY()
                : f.y + 83.2 * (Math.abs(f.scale) || 0.5);

            f.dragOffset.x = f.x - mouse.x;
            f.dragOffset.y = f.y - mouse.y;
            f.throwGrabTime = Date.now();
            f.isFallingFromThrow = false;
            f.throwFallVy = 0;
            f.throwFallVx = 0;
            isGlobalDragging = true;
            break;
          }
        }
        if (!hitFluffy) missWithTool(obj);
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
                f.pottyTraining + (0.1 + Math.random() * 0.1) * 0.25 * (typeof smartsLearn === "function" ? smartsLearn(f) : 1),
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
                    other.pottyTraining + (0.05 + Math.random() * 0.05) * 0.25 * (typeof smartsLearn === "function" ? smartsLearn(other) : 1),
                  );
                  other.speak(
                    getDialogue(["BRUSH", "WITNESS_TRAINING"], other),
                  );
                }
              }
            }
            if (!f.isSmarty()) {
              if (typeof brushDialogueKey === "function") key = brushDialogueKey(f, key);
              f.speak(getDialogue(key, f));
            }
            // Loves you: 1.5x as happy; doesn't like you: half (Affection.js)
            f.changeHappiness(
              HAPPINESS_BONUS_BRUSH *
                (typeof brushHappinessMultiplier === "function" ? brushHappinessMultiplier(f) : 1),
              "Brushed",
            );
            // Builds trust in you (Memory.js)
            if (typeof onFluffyBrushed === "function") onFluffyBrushed(f);
            // Groomed for a show (Shows.js)
            if (typeof onFluffyGroomed === "function") onFluffyGroomed(f);
            f.expressionOverride = "GOOD_UPSIES";
            f.expressionOverrideTimer = 1.0;
            f.initBehavior("BENDING_2");
            f.stateTimer = 1.0;
            hitFluffy = true;
            obj.whackTimer = 0.2;
            break;
          }
        }
        if (!hitFluffy) missWithTool(obj);
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
          const hitPart = f.hitTestAsSeen(mouse.x, mouse.y);
          if (typeof hitPart !== "string") continue;

          // (an operating table set to a part: that part is marked "planned")
          if (hitPart) {
            // The surgery screen: pick the part, and say yes (Surgery.js)
            openSurgery(f, knife, hitPart);
            hitFluffy = true;
            break;
          }
        }
        if (!hitFluffy) missWithTool(obj);
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
        if (!hitFluffy) missWithTool(obj);
        return true;
      } else if (typeof CauteryIron !== "undefined" && obj instanceof CauteryIron) {
        // Burn a bleeding wound shut (CauteryIron.js)
        let hitFluffy = false;
        for (const f of fluffies) {
          if (f.scene !== obj.scene || !f.isAlive) continue;
          if (f.currentCage && typeof FoalInACan !== "undefined" && f.currentCage instanceof FoalInACan) continue;
          if (!f.hitTestAsSeen(mouse.x, mouse.y)) continue;
          hitFluffy = true;
          if (!cauterizeWound(f, obj) && typeof addUIMessage === "function") addUIMessage("It isn't bleeding - nothing to burn shut.");
          break;
        }
        if (!hitFluffy) missWithTool(obj);
        return true;
      } else if (typeof Bandages !== "undefined" && obj instanceof Bandages) {
        // Wrap a healing wound (Bandages.js)
        let hitFluffy = false;
        for (const f of fluffies) {
          if (f.scene !== obj.scene || !f.isAlive) continue;
          if (f.currentCage && typeof FoalInACan !== "undefined" && f.currentCage instanceof FoalInACan) continue;
          if (!f.hitTestAsSeen(mouse.x, mouse.y)) continue;
          hitFluffy = true;
          applyBandage(f, obj);
          break;
        }
        if (!hitFluffy) missWithTool(obj);
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
              sutureWound(f, kit); // (SutureKit.js)
              hitFluffy = true;
              break;
            }
          }
        }
        if (!hitFluffy) missWithTool(kit);
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

      missWithTool(obj); // (the sponge stays in your hand; other things are put down)
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
const RIVER_SPAWN_WEIGHT = 3; // the river's share of new strays, against 1 for each other place
const RIVER_MIN_FERALS = 4; // fewer than this there: the next ones go to the river
let feralDespawnTimer = 30;
// opts.walkIn: you're there, so they come in from the right-hand edge and
// walk on in (rather than popping up in the middle)
function spawnFeralGroup(targetScene, forcedScenario = null, opts = {}) {
  const before = fluffies.length;
  _spawnFeralGroup(targetScene, forcedScenario);
  // Good smarty or bad? (Intelligence.js)
  for (let i = before; i < fluffies.length; i++) {
    if (fluffies[i].smartyKind === undefined && typeof rollSmartyKind === "function") rollSmartyKind(fluffies[i]);
    if (typeof rollAlicornIndifference === "function") rollAlicornIndifference(fluffies[i]); // (a few don't care about alicorns)
  }
  // Through the broken fence: not yours - you're asked (Strays.js)
  if (targetScene === "BACKYARD" && typeof noteBackyardStrays === "function") noteBackyardStrays(fluffies.slice(before));
  if (opts.walkIn) {
    for (let i = before; i < fluffies.length; i++) {
      const h = fluffies[i];
      const tx = h.x;
      h.x = width - 25 - Math.random() * 20;
      if (h.tooYoungToWalk && h.tooYoungToWalk()) {
        h.x = Math.max(h.x - 40, tx); // (carried in: a foal starts near its mum)
        continue;
      }
      h.initBehavior("MOVING");
      h.setTargetPosition(Math.min(tx, width - 200), h.y);
    }
  }
  return fluffies.length - before;
}

function _spawnFeralGroup(targetScene, forcedScenario = null) {
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
    // A believable age (Aging.js); abandoned pets get theirs (Abandoned.js)
    if (typeof setSpawnAge === "function") setSpawnAge(h);
    if (typeof setupAbandoned === "function") setupAbandoned(h);
    // Runaways had an owner: they keep the name it gave them (Names.js)
    if (typeof giveOwnerName === "function") giveOwnerName(h);
    // Some strays bring Fluffy flu with them (Illness.js)
    if (typeof maybeCarryFlu === "function") maybeCarryFlu(h, FLU_STRAY_CHANCE);
    return h;
  };

  const getRandomPersonality = (isBaby = false, isFemale = false) => {
    let personalities = [];
    if (isBaby) {
      personalities.push("abandoned_baby");
    } else {
      const pool = ["true_feral", "lost_from_herd", "runaway", "mill_escapee"];
      // Dumped by an owner when older (Abandoned.js); not single mums
      if (!isFemale) pool.push("abandoned");
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
        if (p === "true_feral" && personalities.includes("abandoned")) continue;
        if (
          p === "runaway" &&
          (personalities.includes("abandoned") ||
            personalities.includes("true_feral") ||
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
    if (personalities.includes("abandoned")) return 0.5 + Math.random() * 0.4; // someone's pet
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
      if (r < 0.003) return "alicorn"; // alicorns are extremely rare
      if (r < 0.4) return "unicorn";
      if (r < 0.7) return "pegasus";
    }
    // Every breed has its smarties (Intelligence.js: as clever as their breed)
    if (personalities.includes("smarty")) {
      const r = Math.random();
      if (r < 0.01) return "alicorn";
      if (r < 0.31) return "unicorn";
      if (r < 0.51) return "pegasus";
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
    // An abandoned one on its own may have been dumped half grown (Abandoned.js)
    const lone = fluffies[fluffies.length - 1];
    if (typeof makeYoungAbandoned === "function" && lone && Math.random() < 0.3) makeYoungAbandoned(lone);
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
      Math.random() < 0.003 ? "alicorn" : "earthy", // alicorns are extremely rare
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
        type = getScenarioType(p);
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

    // The river is where strays gather: it gets RIVER_SPAWN_WEIGHT times
    // the share of new arrivals, and always some when it's nearly empty
    const riverHere = fluffies.filter((f) => f.scene === "RIVER" && f.isAlive && !f.adopted).length;
    if (validScenes.length > 0) {
      let targetScene = null;
      if (riverHere < RIVER_MIN_FERALS && validScenes.includes("RIVER")) targetScene = "RIVER";
      else {
        const w = validScenes.map((s) => (s === "RIVER" ? RIVER_SPAWN_WEIGHT : 1));
        let pick = Math.random() * w.reduce((a, b) => a + b, 0);
        for (let i = 0; i < validScenes.length; i++) {
          pick -= w[i];
          if (pick <= 0) {
            targetScene = validScenes[i];
            break;
          }
        }
        targetScene = targetScene || validScenes[validScenes.length - 1];
      }
      spawnFeralGroup(targetScene);
    }
    // You're at the river and it's quiet: now and then some wander in
    if (currentScene === "RIVER" && riverHere < RIVER_MIN_FERALS && Math.random() < 0.5) spawnFeralGroup("RIVER", null, { walkIn: true });
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
  // An open menu (Today, Household, the vet...) holds time still (Screens.js)
  const menuPause = gameState === "PLAYING" && typeof screenPausesGame === "function" && screenPausesGame();
  const realElapsed = menuPause ? 0 : elapsed; // for fast forward (GameSpeed.js)
  while (elapsed > 0) {
    const dt = Math.min(elapsed, fixedStep);
    if (gameState === "PLAYING" && !menuPause) {
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
  // Sleeping until morning: the night goes by fast (Sleep.js), and the
  // room is only drawn now and then meanwhile
  if (typeof runSleep === "function") runSleep();

  if (typeof sleepWantsDraw !== "function" || sleepWantsDraw()) render();
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
      data.growth = Math.min(1.0, data.growth + (dt / GROW_UP_TIME) * growthMult);
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

  // (the boarding fee is charged each morning with the bills, Bills.js)
  // Lonely, and getting older (Shelter.js)
  if (typeof updateBoarders === "function") updateBoarders(dt);
}

function updateSimulation(dt) {
  timePlayed += dt;
  // Every registered system: family records, bonds, herds, territory,
  // weather, goals, flu, ageing... in order (Systems.js; each file
  // registers its own with registerSystem)
  updateSystems(dt);
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
        return count < 3 && s !== currentScene; // (not popping up in front of you)
      });
      if (candidateScenes.length > 0) {
        const targetScene = candidateScenes[Math.floor(Math.random() * candidateScenes.length)];
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
        if (f.scene === "ALLEY_ROAD" && !f.isDestroyed && !f.heldWithThrowTool && !f.isFallingFromThrow) {
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

let _renderBuffer = null;
let _renderBufferCtx = null;

function render() {
  // (drawn at renderScale: sharp on a phone - globals.js resize)
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
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

  // The offscreen buffer we draw into, reused every frame (a new one each
  // frame was slow), remade only when the window size changes
  const bufW = Math.round(width * renderScale);
  const bufH = Math.round(height * renderScale);
  if (!_renderBuffer || _renderBuffer.width !== bufW || _renderBuffer.height !== bufH) {
    _renderBuffer = new OffscreenCanvas(bufW, bufH);
    _renderBufferCtx = _renderBuffer.getContext("2d");
  }
  const offScreenCanvas = _renderBuffer;
  const osCtx = _renderBufferCtx;
  osCtx.setTransform(renderScale, 0, 0, renderScale, 0, 0);
  osCtx.globalAlpha = 1;
  osCtx.clearRect(0, 0, width, height);

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
  // The shelter's front in Shelter Alley (Shelter.js)
  if (typeof drawShelterFront === "function") drawShelterFront(osCtx);
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

  const _bottomY = new Map();
  const _bottomYOf = (o) => {
    let y = _bottomY.get(o);
    if (y === undefined) {
      y = o.getBottomY();
      _bottomY.set(o, y);
    }
    return y;
  };
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

    // Y-Sorting (each one's bottom worked out once per frame, not on every
    // comparison: a fluffy's is costly)
    const ay = _bottomYOf(a);
    const by = _bottomYOf(b);

    return ay - by;
  });

  // Party bunting on the wall, and the glow under a sleeping heap (HouseLife.js)
  if (!parkCam && typeof drawPartyBunting === "function") drawPartyBunting(osCtx);
  if (!parkCam && typeof drawSleepHeapShadows === "function") drawSleepHeapShadows(osCtx);

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
  if (typeof drawConfetti === "function") drawConfetti(osCtx); // (HouseLife.js)
  // Foxes in the park at night (NightEvents.js)
  if (parkCam && typeof drawNightPredators === "function") drawNightPredators(osCtx);
  if (parkCam) {
    osCtx.restore();
    if (typeof mouseToScreen === "function") mouseToScreen();
  }
  // Night, sunsets, clouds, rain, snow, lightning (WorldTime.js)
  if (typeof drawSkyAndWeather === "function") drawSkyAndWeather(osCtx);
  // The feel of the room as a faint wash of colour (HouseLife.js)
  if (!parkCam && typeof drawRoomTint === "function") drawRoomTint(osCtx);
  // Their eyes shine in the dark (NightEvents.js)
  if (parkCam && typeof drawNightPredatorEyes === "function") drawNightPredatorEyes(osCtx, parkCam);
  // (The UI is drawn once, on the screen, after this buffer: drawUI(ctx)
  // below. It used to be drawn here too, but everything was covered.)
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
      // A snowflake when it's cold (Warmth.js)
      if (typeof drawColdMarker === "function") drawColdMarker(osCtx, f);
      f.drawDream(osCtx); // (only while the dream bubble is showing or popping in/out)
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
  // (pixel for pixel: the buffer is already at renderScale - a plain copy is fast)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(offScreenCanvas, 0, 0);
  ctx.setTransform(renderScale, 0, 0, renderScale, 0, 0);

  drawPortals();
  // House rooms: where WASD / the arrow keys go (UIScenes.js)
  if (typeof drawHouseNav === "function") drawHouseNav(ctx);
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
    // A debug action waiting for a click (pair two fluffies...): Esc cancels it
    if (typeof debugMenuAction !== "undefined" && debugMenuAction) {
      debugMenuAction = null;
      debugPairFirst = null;
      return;
    }
    // Close the top pop-up screen (Screens.js)
    if (escapeScreens()) {
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

  // Arrow keys in the help pages (Help.js)
  if (typeof handleHelpKey === "function" && handleHelpKey(e.code)) {
    e.preventDefault();
    return;
  }

  let requestedDir = null;
  // In the park WASD looks around instead (Park.js)
  const inPark = typeof isCameraScene === "function" && isCameraScene(currentScene);
  if (inPark) {
    // nothing: handled by the park's own key listener
  } else if (e.code === "KeyW" || e.code === "ArrowUp") requestedDir = "UP";
  else if (e.code === "KeyA" || e.code === "ArrowLeft") requestedDir = "LEFT";
  else if (e.code === "KeyS" || e.code === "ArrowDown") requestedDir = "DOWN";
  else if (e.code === "KeyD" || e.code === "ArrowRight") requestedDir = "RIGHT";
  if (requestedDir && e.code.startsWith("Arrow")) e.preventDefault(); // (no page scrolling)

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
      // Towards a room you haven't bought: ask, then buy (UIScenes.js)
      if (match && match.locked && typeof houseKeyTowardsLocked === "function") {
        houseKeyTowardsLocked(match);
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
  // Holding a key down doesn't flick a screen open and shut (or race
  // through the speeds)
  if (e.repeat && ["F1", "KeyG", "KeyL", "KeyK", "KeyM", "KeyT", "KeyO", "KeyJ", "KeyN", "KeyH", "KeyB", "KeyF"].includes(e.code)) return;
  // F1: help (Help.js)
  if (e.code === "F1" && typeof isHelpOpen === "function") {
    e.preventDefault();
    if (isHelpOpen()) closeHelp();
    else if (!isAnyScreenOpen()) openHelp();
    return;
  }
  // K: the accounts (Economy.js)
  if (e.code === "KeyK" && typeof isAccountsOpen === "function") {
    if (isAccountsOpen()) closeAccounts();
    else if (!isAnyScreenOpen()) openAccounts();
    return;
  }
  // M: who's who, the relationship map (RelationshipMap.js)
  if (e.code === "KeyM" && typeof isRelationshipMapOpen === "function") {
    if (isRelationshipMapOpen()) closeRelationshipMap();
    else if (typeof inspectedFluffy !== "undefined" && inspectedFluffy) {
      // from a fluffy's magnifying glass: the map, with that one picked
      const f = inspectedFluffy;
      inspectedFluffy = null;
      openRelationshipMap(f);
    } else if (!isAnyScreenOpen()) openRelationshipMap(null);
    return;
  }
  // G: the goals list (Goals.js)
  if (e.code === "KeyG" && typeof isGoalsOpen === "function") {
    if (isGoalsOpen()) closeGoals();
    else if (!isAnyScreenOpen()) openGoals();
    return;
  }
  // L: breeding records (BreedingRecords.js)
  if (e.code === "KeyL" && typeof isRecordsOpen === "function") {
    if (isRecordsOpen()) closeRecords();
    else if (!isAnyScreenOpen()) openRecords();
    return;
  }
  // J: the story debug view (StoryDebug.js) - from the magnifying glass, for that fluffy
  if (e.code === "KeyJ" && typeof isStoryDebugOpen === "function") {
    if (isStoryDebugOpen()) closeStoryDebug();
    else if (typeof inspectedFluffy !== "undefined" && inspectedFluffy) {
      openStoryDebug();
      inspectedFluffy = null;
    } else if (!isAnyScreenOpen()) openStoryDebug();
    return;
  }
  // T: what needs you today (Today.js)
  if (e.code === "KeyT" && typeof isTodayOpen === "function") {
    if (isTodayOpen()) closeToday();
    else if (!isAnyScreenOpen()) openToday();
    return;
  }
  // O: the household overview (Household.js)
  if (e.code === "KeyO" && typeof isHouseholdOpen === "function") {
    if (isHouseholdOpen()) closeHousehold();
    else if (!isAnyScreenOpen()) openHousehold();
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

  if (["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"].includes(e.key)) {
    if (
      typeof hoveredToolboxItem !== "undefined" &&
      hoveredToolboxItem &&
      !hoveredToolboxItem.isNav &&
      !hoveredToolboxItem.isBag
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
