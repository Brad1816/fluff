function handleCheatCode(code) {
  if (!code) return;
  const c = code.toLowerCase().trim();
  const arr = c.split(" ");
  if (arr.length === 0) {
    return;
  }
  const first = arr[0];
  let repeatCount = 1;
  if (arr.length > 1 && arr[1].match(/^\d+$/)) {
    repeatCount = parseInt(arr[1]);
  }

  if (first === "fbr") {
    if (backyardFenceTier < 2) {
      backyardFenceBroken = true;
      if (typeof addUIMessage !== "undefined") {
        addUIMessage("Fence broken!");
      }
    } else {
      if (typeof addUIMessage !== "undefined") {
        addUIMessage("Reinforced fence cannot be broken!");
      }
    }
  } else if (first === "invasion") {
    if (typeof spawnFeralGroup !== "undefined") {
      spawnFeralGroup("BACKYARD");
    }
  } else if (first === "sellp") {
    sellRequestTimer = 0;
  } else if (first === "grasstimer") {
    for (const key in sceneGrassSpawnTimers) {
      sceneGrassSpawnTimers[key] = 0;
    }
    if (typeof addUIMessage !== "undefined") {
      addUIMessage("Grass spawn timers reset to 0!");
    }
  } else if (first === "cbox") {
    alleyBoxSpawnTimer = 0;
    if (typeof addUIMessage !== "undefined") {
      addUIMessage("Alley cardboard box spawn timer reset to 0!");
    }
  } else if (first === "tpoop") {
    for (let i = 0; i < repeatCount; i++) {
      const h = new Horse(1.0, null, currentScene);
      h.hunger = 0.62;
      h.poopStorage = 0.6;
      h.pottyTraining = 1.0;
      fluffies.push(h);
    }
  } else if (first === "toxoimmunity") {
    addUIMessage("Immunized all active fluffies against toxoplasmosis.");
    for (const f of fluffies) {
      f.isToxoVaccinated = true;
    }
  } else if (first === "toxoinfection") {
    addUIMessage("Infected all unvaccinated fluffies with toxoplasmosis.");
    for (const f of fluffies) {
      f.isToxoplasmosis = true;
    }
  } else if (first === "toxocure") {
    addUIMessage("Purged all active fluffies of toxoplasmosis.");
    for (const f of fluffies) {
      f.isToxoplasmosis = false;
    }
  } else if (first === "toxoreset") {
    addUIMessage("Fluffies are now vulnerable to toxoplasmosis.");
    for (const f of fluffies) {
      f.isToxoVaccinated = false;
    }
  } else if (first === "sbs") {
    for (let i = 0; i < repeatCount; i++) {
      const h = new Horse(1.0, null, currentScene);
      h.sensitiveBaby = true;
      fluffies.push(h);
    }
  } else if (first === "sbsb") {
    for (let i = 0; i < repeatCount; i++) {
      const h = new Horse(1.0, null, currentScene);
      h.sensitiveBaby = true;
      h.growth = 0.0;
      fluffies.push(h);
    }
  } else if (first === "sbsm") {
    for (let i = 0; i < repeatCount; i++) {
      const mother = new Horse(
        1.0,
        null,
        currentScene,
        "earthy",
        null,
        1.0,
        1.0,
        "female",
      );
      mother.sensitiveBaby = true;
      mother.lactatingTimer = 1000;
      fluffies.push(mother);

      const foal = new Horse(
        0.1,
        mother.id,
        currentScene,
        "earthy",
        null,
        1.0,
        1.0,
      );
      foal.sensitiveBaby = true;
      foal.x = mother.x - 50;
      fluffies.push(foal);
    }
  } else if (first === "clrsm1") {
    const white = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    white.coloristDegree = 1.0;
    const brown = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      0.0,
      0.0,
      "male",
    );
    brown.x = white.x - 50;
    fluffies.push(white, brown);
    brown.proposeFriendship(white);
  } else if (first === "clrsm2") {
    const white = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    white.coloristDegree = 0.0;
    const brown = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      0.0,
      0.0,
      "male",
    );
    brown.x = white.x - 50;
    fluffies.push(white, brown);
    brown.proposeFriendship(white);
  } else if (first === "clrsm3") {
    const white = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    white.coloristDegree = 1.0;
    const brownBaby = new Horse(
      0.1,
      null,
      currentScene,
      "earthy",
      null,
      0.0,
      0.0,
      "male",
    );
    brownBaby.motherId = white.id;
    brownBaby.x = white.x - 50;
    fluffies.push(white, brownBaby);
  } else if (first === "clrsm4") {
    const white = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    white.coloristDegree = 0.0;
    const brownBaby = new Horse(
      0.1,
      null,
      currentScene,
      "earthy",
      null,
      0.0,
      0.0,
      "male",
    );
    brownBaby.motherId = white.id;
    brownBaby.x = white.x - 50;
    fluffies.push(white, brownBaby);
  } else if (first === "clrsm5") {
    const white = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    white.coloristDegree = 1.0;
    white.lactatingTimer = 1000;
    white.milkCharges = 5;
    const brownBaby = new Horse(
      0.2,
      null,
      currentScene,
      "earthy",
      null,
      0.0,
      0.0,
      "male",
    );
    brownBaby.motherId = white.id;
    brownBaby.x = white.x - 50;
    brownBaby.hunger = 0; // Hungry!
    fluffies.push(white, brownBaby);
  } else if (first === "clrsm6") {
    const white = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    white.coloristDegree = 0.0;
    white.lactatingTimer = 1000;
    white.milkCharges = 5;
    const brownBaby = new Horse(
      0.2,
      null,
      currentScene,
      "earthy",
      null,
      0.0,
      0.0,
      "male",
    );
    brownBaby.motherId = white.id;
    brownBaby.x = white.x - 50;
    brownBaby.hunger = 0; // Hungry!
    fluffies.push(white, brownBaby);
  } else if (first === "f") {
    for (let i = 0; i < repeatCount; i++) {
      let bq = 1.0,
        mq = 1.0;
      if (!getSceneConfig(currentScene).insidePlayerQuarters) {
        bq = randomFeralQuality();
        mq = randomFeralQuality();
      }
      const h = new Horse(1.0, null, currentScene, "earthy", null, bq, mq);
      fluffies.push(h);
    }
  } else if (first === "b") {
    for (let i = 0; i < repeatCount; i++) {
      let bq = 1.0,
        mq = 1.0;
      if (!getSceneConfig(currentScene).insidePlayerQuarters) {
        bq = randomFeralQuality();
        mq = randomFeralQuality();
      }
      const h = new Horse(0.0, null, currentScene, "earthy", null, bq, mq);
      fluffies.push(h);
    }
  } else if (first === "s") {
    for (let i = 0; i < repeatCount; i++) {
      const h = new Horse(
        1.0,
        null,
        currentScene,
        "unicorn",
        null,
        1.0,
        1.0,
        "male",
      );
      h.personalities = ["smarty"];
      fluffies.push(h);
    }
  } else if (first === "m") {
    for (let i = 0; i < repeatCount; i++) {
      let bq = 1.0,
        mq = 1.0;
      if (!getSceneConfig(currentScene).insidePlayerQuarters) {
        bq = randomFeralQuality();
        mq = randomFeralQuality();
      }
      const h = new Horse(
        1.0,
        null,
        currentScene,
        "earthy",
        null,
        bq,
        mq,
        "female",
      );
      h.lactatingTimer = 900;
      h.milkCharges = 5;
      fluffies.push(h);

      const ghostDadGenes = h.generateRandomGenes(
        getSceneConfig(currentScene).insidePlayerQuarters
          ? 1.0
          : randomFeralQuality(),
        getSceneConfig(currentScene).insidePlayerQuarters
          ? 1.0
          : randomFeralQuality(),
      );
      const numBabies = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < numBabies; i++) {
        const babyGenes = h.combineGenes(ghostDadGenes);
        const b = new Horse(
          0.0,
          h.id,
          currentScene,
          "earthy",
          babyGenes,
          bq,
          mq,
        );
        b.x = h.x + (Math.random() - 0.5) * 50;
        b.y = h.y + (Math.random() - 0.5) * 50;
        fluffies.push(b);
      }
    }
  } else if (first === "alica") {
    const mom = new Horse(
      1.0,
      null,
      currentScene,
      "alicorn",
      null,
      1.0,
      1.0,
      "female",
    );
    fluffies.push(mom);
    const baby = new Horse(0.0, mom.id, currentScene, "earthy", null, 1.0, 1.0);
    baby.x = mom.x + 30;
    baby.y = mom.y + 10;
    fluffies.push(baby);
  } else if (first === "alicb") {
    const mom = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    fluffies.push(mom);
    const baby = new Horse(
      0.0,
      mom.id,
      currentScene,
      "alicorn",
      null,
      1.0,
      1.0,
    );
    baby.x = mom.x + 30;
    baby.y = mom.y + 10;
    fluffies.push(baby);
  } else if (first === "tv") {
    for (const obj of objects) {
      if (!(obj instanceof FluffTV)) {
        continue;
      }
      obj.speechTimer = 15.0;
    }
  } else if (first === "fpropose") {
    const f1 = new Horse(
      1.0,
      null,
      currentScene,
      "alicorn",
      null,
      1.0,
      1.0,
      "female",
    );
    fluffies.push(f1);
    const f2 = new Horse(
      1.0,
      null,
      currentScene,
      "alicorn",
      null,
      1.0,
      1.0,
      "male",
    );
    fluffies.push(f2);
    if (!relationships[f1.id]) relationships[f1.id] = {};
    if (!relationships[f2.id]) relationships[f2.id] = {};
    relationships[f1.id][f2.id] = "friend";
    relationships[f2.id][f1.id] = "friend";
  } else if (first === "fwen") {
    const sceneFluffies = fluffies.filter((f) => f.scene === currentScene);
    for (let i = 0; i < sceneFluffies.length; i++) {
      for (let j = i + 1; j < sceneFluffies.length; j++) {
        const f1 = sceneFluffies[i];
        const f2 = sceneFluffies[j];
        if (!relationships[f1.id]) relationships[f1.id] = {};
        if (!relationships[f2.id]) relationships[f2.id] = {};
        relationships[f1.id][f2.id] = "friend";
        relationships[f2.id][f1.id] = "friend";
      }
    }
  } else if (first === "ma") {
    const mom = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    mom.limbs.legs = [false, false, false, false];
    mom.lactatingTimer = 900;
    mom.milkCharges = 5;
    fluffies.push(mom);
    const baby = new Horse(0.0, mom.id, currentScene, "earthy", null, 1.0, 1.0);
    baby.hunger = 0.4;
    baby.x = mom.x + 30;
    baby.y = mom.y + 10;
    fluffies.push(baby);
  } else if (first === "mb") {
    const mom = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    mom.limbs.legs = [false, false, false, false];
    mom.lactatingTimer = 900;
    mom.milkCharges = 5;
    fluffies.push(mom);
    const baby = new Horse(
      0.0,
      null, // unrelated
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
    );
    baby.hunger = 0.4;
    baby.x = mom.x + 30;
    baby.y = mom.y + 10;
    fluffies.push(baby);
  } else if (first === "mc") {
    const mom = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    mom.limbs.legs = [false, false, false, false];
    mom.lactatingTimer = 900;
    mom.milkCharges = 5;
    fluffies.push(mom);
    const baby = new Horse(
      0.0,
      mom.id,
      currentScene,
      "alicorn",
      null,
      1.0,
      1.0,
    );
    baby.hunger = 0.4;
    baby.x = mom.x + 30;
    baby.y = mom.y + 10;
    fluffies.push(baby);
  } else if (first === "md") {
    const mom = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    mom.limbs.leftEye = false;
    mom.limbs.rightEye = false;
    mom.lactatingTimer = 900;
    mom.milkCharges = 5;
    fluffies.push(mom);
    const baby = new Horse(0.0, mom.id, currentScene, "earthy", null, 1.0, 1.0);
    baby.hunger = 0.4;
    baby.x = mom.x + 30;
    baby.y = mom.y + 10;
    fluffies.push(baby);
  } else if (first === "me") {
    const mom = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    mom.limbs.leftEye = false;
    mom.limbs.rightEye = false;
    mom.lactatingTimer = 900;
    mom.milkCharges = 5;
    fluffies.push(mom);
    const baby = new Horse(
      0.0,
      null, // unrelated
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
    );
    baby.hunger = 0.4;
    baby.x = mom.x + 30;
    baby.y = mom.y + 10;
    fluffies.push(baby);
  } else if (first === "mf") {
    const mom = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    mom.limbs.leftEye = false;
    mom.limbs.rightEye = false;
    mom.lactatingTimer = 900;
    mom.milkCharges = 5;
    fluffies.push(mom);
    const baby = new Horse(
      0.0,
      mom.id,
      currentScene,
      "alicorn",
      null,
      1.0,
      1.0,
    );
    baby.hunger = 0.4;
    baby.x = mom.x + 30;
    baby.y = mom.y + 10;
    fluffies.push(baby);
  } else if (first === "mg") {
    const mom = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    mom.lactatingTimer = 900;
    mom.milkCharges = 5;
    fluffies.push(mom);
    const baby = new Horse(
      0.0,
      null, // unrelated
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
    );
    baby.hunger = 0.4;
    baby.x = mom.x + 30;
    baby.y = mom.y + 10;
    fluffies.push(baby);
  } else if (first === "grinder") {
    const g = new Grinder(currentScene);
    if (typeof objects !== "undefined") {
      objects.push(g);
    }

    const dummy = new Horse(1.0, null, currentScene);
    dummy.renderer.ensureTintedImages();

    if (dummy.tinted && dummy.tinted.torso) {
      const gib = new Gib(
        "torso",
        dummy.colors.body,
        currentScene,
        "torso",
        width / 2,
        height / 2,
        null, // No grinder
        { left: 0, right: width, top: 0, bottom: height }, // Screen bounds
        dummy.scale,
        0.375 * dummy.growth,
      );
      gib.freeGib = true;
      gibs.push(gib);
    }
  } else if (first === "blood" || c === "bld" || c === "bl") {
    bloodCheat = !bloodCheat;
    addUIMessage("Blood Cheat: " + (bloodCheat ? "ON" : "OFF"));
  } else if (first === "fps") {
    showFPS = !showFPS;
    addUIMessage("FPS Counter: " + (showFPS ? "ON" : "OFF"));
  } else if (first === "blind") {
    const h = new Horse(1.0, null, currentScene, "earthy", null, 1.0, 1.0);
    h.limbs.leftEye = false;
    h.limbs.rightEye = false;
    fluffies.push(h);
  } else if (first === "deaf") {
    const h = new Horse(1.0, null, currentScene, "earthy", null, 1.0, 1.0);
    h.limbs.leftEar = false;
    h.limbs.rightEar = false;
    fluffies.push(h);
  } else if (first === "deafblind") {
    const h = new Horse(1.0, null, currentScene, "earthy", null, 1.0, 1.0);
    h.limbs.leftEye = false;
    h.limbs.rightEye = false;
    h.limbs.leftEar = false;
    h.limbs.rightEar = false;
    fluffies.push(h);
  } else if (first === "despawn") {
    feralDespawnTimer = 0;
  } else if (first === "h") {
    debugHungerMultiplier = repeatCount ? repeatCount : 1.0;
    addUIMessage("Hunger Debug: " + debugHungerMultiplier);
  } else if (first === "p") {
    debugPregnancyMultiplier = repeatCount ? repeatCount : 1.0;
    addUIMessage("Pregnancy Debug: " + debugPregnancyMultiplier);
  } else if (first === "peed") {
    debugPeeMultiplier = repeatCount ? repeatCount : 1.0;
    addUIMessage("Pee Debug: " + debugPeeMultiplier);
  } else if (first === "pood") {
    debugPoopMultiplier = repeatCount ? repeatCount : 1.0;
    addUIMessage("Poop Debug: " + debugPoopMultiplier);
  } else if (first === "g") {
    debugGrowthMultiplier = repeatCount ? repeatCount : 1.0;
    addUIMessage("Growth Debug: " + debugGrowthMultiplier);
  } else if (first === "kill") {
    for (const f of fluffies) {
      if (!f.isAlive) continue;
      if (f.scene === currentScene) f.die();
    }
  } else if (first === "clear") {
    for (let i = puddles.length - 1; i >= 0; i--) {
      if (puddles[i].scene === currentScene) {
        puddles.splice(i, 1);
      }
    }
  } else if (first === "money") {
    const moneyAmt = arr.length > 1 ? parseInt(arr[1], 10) : 25000;
    money += isNaN(moneyAmt) ? 25000 : moneyAmt;
    addUIMessage("Money added!");
  } else if (first === "food") {
    const bowls = objects.filter((o) => o instanceof Bowl);
    for (const bowl of bowls) bowl.addFood();
    const grasses = objects.filter((o) => o instanceof Grass);
    for (const grass of grasses) grass.growth = 2.0;
    addUIMessage("Bowls filled!");
  } else if (first === "sleep") {
    for (let i = fluffies.length - 1; i >= 0; i--) {
      fluffies[i].initBehavior("SLEEPING");
    }
  } else if (first === "deprive") {
    for (let i = fluffies.length - 1; i >= 0; i--) {
      fluffies[i].sleepdeprivation = 1.0;
    }
  } else if (first === "undeprive") {
    for (let i = fluffies.length - 1; i >= 0; i--) {
      fluffies[i].sleepdeprivation = 0.0;
    }
  } else if (first === "jab") {
    for (let i = fluffies.length - 1; i >= 0; i--) {
      const h = fluffies[i];
      let count = 0;
      const repeatJab = () => {
        if (count < 5 && h.isAlive) {
          h.initBehavior("FLUFFY_JAB");
          count++;
          setTimeout(repeatJab, 1000);
        }
      };
      repeatJab();
    }
  } else if (first === "stomp") {
    for (let i = fluffies.length - 1; i >= 0; i--) {
      const h = fluffies[i];
      let count = 0;
      const repeatStomp = () => {
        if (count < 5 && h.isAlive) {
          h.initBehavior("FLUFFY_STOMPIE");
          count++;
          setTimeout(repeatStomp, 1000);
        }
      };
      repeatStomp();
    }
  } else if (first === "knock") {
    for (let i = fluffies.length - 1; i >= 0; i--) {
      let h = fluffies[i];
      let count = 0;
      const repeatKnock = () => {
        if (count < 5 && h.isAlive) {
          h.initBehavior("FLUFFY_KNOCKED_DOWN");
          count++;
          setTimeout(repeatKnock, 1000);
        }
      };
      repeatKnock();
    }
  } else if (first === "bite") {
    for (let i = fluffies.length - 1; i >= 0; i--) {
      let h = fluffies[i];
      let count = 0;
      const repeatBite = () => {
        if (count < 5 && h.isAlive) {
          h.initBehavior("FLUFFY_BITE");
          count++;
          setTimeout(repeatBite, 1000);
        }
      };
      repeatBite();
    }
  } else if (first === "mate") {
    const male = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "male",
    );
    const female = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    fluffies.push(male, female);
    male.updateLayout();
    female.updateLayout();
    male.mateWith(female);
  } else if (first === "badmate") {
    const smarty = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "male",
    );
    smarty.personalities = ["smarty"];
    const female = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    const bystander = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "male",
    );

    fluffies.push(smarty, female, bystander);
    smarty.updateLayout();
    female.updateLayout();
    bystander.updateLayout();
    bystander.x = width / 2 + 800 - Math.random() * 1600;
    bystander.y = height / 2 + 800 - Math.random() * 1600;
    smarty.mateWith(female, false, true);
  } else if (first === "cannibal") {
    const cannibal = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "male",
    );
    cannibal.hunger = 0.25;
    cannibal.cannibalismAcceptance = 0.5;

    const victim = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    victim.x = cannibal.x + 100;
    victim.y = cannibal.y;

    fluffies.push(cannibal, victim);
  } else if (first === "soonmummah") {
    const h = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    h.isPregnant = true;
    h.pregnancyTimer = pregnancyDuration * 0.1; // 75% complete
    h.babiesToBirth = Math.floor(Math.random() * 7) + 1;
    h.fatherGenes = [...h.genes];
    h.foalViability = [];
    h.lactatingTimer = 900;
    for (let i = 0; i < h.babiesToBirth; i++) h.foalViability.push(true);
    fluffies.push(h);
  } else if (first === "wandie") {
    const h = new Horse(1.0, null, currentScene);
    h.happiness = WAN_DIE_THRESHOLD;
    fluffies.push(h);
  } else if (first === "clearg") {
    let i = 0;
    while (i < objects.length) {
      if (objects[i] instanceof Grass) {
        objects.splice(i, 1);
        continue;
      }
      i++;
    }
  } else if (first === "poop") {
    for (const f of fluffies) {
      f.pottyTraining = 1.0;
      f.poopStorage = 0.75;
    }
  } else if (first === "pooput") {
    for (const f of fluffies) {
      f.poopStorage = 0.59;
    }
  } else if (first === "debug") {
    if (arr[1] === "on") {
      showDebugMenu = true;
    } else if (arr[1] === "off") {
      showDebugMenu = false;
      debugMenuAction = null;
      debugPairFirst = null;
    } else {
      showDebugMenu = !showDebugMenu;
      if (!showDebugMenu) {
        debugMenuAction = null;
        debugPairFirst = null;
      }
    }
    addUIMessage("Debug Menu: " + (showDebugMenu ? "ON" : "OFF"));
  } else if (first === "rel") {
    relCheat = !relCheat;
    addUIMessage(
      "Relationship Timer Cheat: " + (relCheat ? "ON (50x)" : "OFF"),
    );
  } else if (first === "worldc") {
    worldSettings.colorism = !worldSettings.colorism;
    addUIMessage("World Colorism: " + (worldSettings.colorism ? "ON" : "OFF"));
  } else if (first === "worldai") {
    worldSettings.alicornIntolerance = !worldSettings.alicornIntolerance;
    addUIMessage(
      "World Alicorn Intolerance: " +
        (worldSettings.alicornIntolerance ? "ON" : "OFF"),
    );
  } else if (first === "worlds") {
    worldSettings.smarties = !worldSettings.smarties;
    addUIMessage("World Smarties: " + (worldSettings.smarties ? "ON" : "OFF"));
  } else if (first === "worldsbs") {
    worldSettings.sbs = !worldSettings.sbs;
    addUIMessage(
      "World Sensitive Baby Syndrome: " + (worldSettings.sbs ? "ON" : "OFF"),
    );
  } else if (first === "worldt") {
    worldSettings.toxoplasmosis = !worldSettings.toxoplasmosis;
    if (!worldSettings.toxoplasmosis && typeof fluffies !== "undefined") {
      for (const f of fluffies) {
        f.isToxoplasmosis = false;
      }
    }
    addUIMessage(
      "World Toxoplasmosis: " + (worldSettings.toxoplasmosis ? "ON" : "OFF"),
    );
  } else if (first === "error") {
    throw new Error("Placeholder error triggered by cheat!");
  } else if (first === "rack") {
    const board = new ImmobilizationBoard(currentScene);
    objects.push(board);

    debugGrowthMultiplier = 50.0;
    const h = new Horse(0.0, null, currentScene);
    h.placedOn = board;
    h.facingRight = false;
    h.initBehavior("LYING");
    h.updateCrawling();
    board.securedFluffy = h;
    fluffies.push(h);
  } else if (first === "mbrack") {
    const boardX = width / 2;
    const boardY = height * 0.7;
    const board = new ImmobilizationBoard(currentScene);
    board.x = boardX;
    board.y = boardY;
    objects.push(board);

    const mom = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    mom.x = boardX;
    mom.y = boardY - (typeof tableOffset !== "undefined" ? tableOffset : 30);
    mom.placedOn = board;
    mom.facingRight = false;
    mom.initBehavior("LYING");
    mom.updateCrawling();
    mom.lactatingTimer = 900;
    mom.milkCharges = 5;
    board.securedFluffy = mom;
    fluffies.push(mom);

    const baby = new Horse(0.0, null, currentScene, "alicorn");
    baby.x = boardX - 100;
    baby.y = boardY;
    baby.hunger = 0.4;
    fluffies.push(baby);
  } else if (first === "mbbrack") {
    const boardX = width / 2;
    const boardY = height * 0.7;
    const board = new ImmobilizationBoard(currentScene);
    board.x = boardX;
    board.y = boardY;
    objects.push(board);

    const mom = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    mom.x = boardX;
    mom.y = boardY - (typeof tableOffset !== "undefined" ? tableOffset : 30);
    mom.placedOn = board;
    mom.facingRight = false;
    mom.initBehavior("LYING");
    mom.updateCrawling();
    mom.lactatingTimer = 900;
    mom.milkCharges = 5;
    board.securedFluffy = mom;
    fluffies.push(mom);
    mom.limbs.leftEye = false;
    mom.limbs.rightEye = false;

    const baby = new Horse(0.0, null, currentScene, "alicorn");
    baby.x = boardX - 100;
    baby.y = boardY;
    baby.hunger = 0.4;
    fluffies.push(baby);
  } else if (first === "blockt") {
    for (let i = 0; i < 20; i++) {
      const b = new Block(Math.random() * width, 0, currentScene);
      b.clampY();
      objects.push(b);
    }
  } else if (first === "couple") {
    const h1 = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "male",
    );
    fluffies.push(h1);

    const h2 = new Horse(
      1.0,
      null,
      currentScene,
      "earthy",
      null,
      1.0,
      1.0,
      "female",
    );
    fluffies.push(h2);

    if (!relationships[h1.id]) relationships[h1.id] = {};
    if (!relationships[h2.id]) relationships[h2.id] = {};
    relationships[h1.id][h2.id] = "special_friend";
    relationships[h2.id][h1.id] = "special_friend";

    if (h1.type === "alicorn") h2.alicornTolerance = true;
    if (h2.type === "alicorn") h1.alicornTolerance = true;
  } else if (first === "lpl") {
    const boxX = width / 2;
    const boxY = height * 0.7;
    const box = new LitterpalBox(currentScene);
    box.x = boxX;
    box.y = boxY;
    objects.push(box);

    const h1 = new Horse(1.0, null, currentScene);
    h1.x = boxX;
    h1.y = boxY;
    h1.placedOn = box;
    h1.attemptLockIntoTable(box);
    fluffies.push(h1);

    const h2 = new Horse(1.0, null, currentScene);
    h2.x = boxX + 150;
    h2.y = boxY;
    fluffies.push(h2);
  } else if (first === "lplb") {
    const boxX = width / 2;
    const boxY = height * 0.7;
    const box = new LitterpalBox(currentScene);
    box.x = boxX;
    box.y = boxY;
    objects.push(box);

    const h1 = new Horse(0.4, null, currentScene);
    h1.x = boxX;
    h1.y = boxY;
    h1.placedOn = box;
    h1.attemptLockIntoTable(box);
    fluffies.push(h1);

    const h2 = new Horse(1.0, null, currentScene);
    h2.x = boxX + 150;
    h2.y = boxY;
    fluffies.push(h2);
  } else if (first === "ntest") {
    const names = ["Racecar", "Brutus", "George", "John", "Ringo", "Paul"];
    const spacing = 100;
    const startX = width / 2 - (names.length / 2) * spacing;
    const startY = height / 2;

    for (let i = 0; i < names.length; i++) {
      const h = new Horse(1.0, null, currentScene);
      h.x = startX + i * spacing;
      h.y = startY;
      fluffyNames[h.id] = names[i];
      fluffies.push(h);
    }
  } else if (first === "up") {
    for (let i = 0; i < repeatCount; i++) {
      const pegasus = new Horse(
        1.0,
        null,
        currentScene,
        "pegasus",
        null,
        1.0,
        1.0,
      );
      fluffies.push(pegasus);
      const unicorn = new Horse(
        1.0,
        null,
        currentScene,
        "unicorn",
        null,
        1.0,
        1.0,
      );
      fluffies.push(unicorn);
    }
  } else if (first === "spot") {
    for (let i = 0; i < repeatCount; i++) {
      const h = new Horse(1.0, null, currentScene, "earthy", null, 1.0, 1.0);
      h.genes[79] = 1;
      h.genes[80] = 1;
      h.genes[81] = 1;
      h.genes[82] = 1;
      h.processGenes();
      console.log("Spot cheat spawned horse:", {
        id: h.id,
        hasSpots: h.hasSpots,
        spotColor: h.colors.spots,
        genes: [...h.genes],
      });
      fluffies.push(h);
    }
  } else if (first === "stripe") {
    for (let i = 0; i < repeatCount; i++) {
      const h = new Horse(1.0, null, currentScene, "earthy", null, 1.0, 1.0);
      h.genes[87] = 1;
      h.genes[88] = 1;
      h.genes[89] = 1;
      h.genes[90] = 1;
      h.processGenes();
      console.log("Stripe cheat spawned horse:", {
        id: h.id,
        hasStripes: h.hasStripes,
        stripeColor: h.colors.stripes,
        genes: [...h.genes],
      });
      fluffies.push(h);
    }
  } else if (first === "stripespot") {
    for (let i = 0; i < repeatCount; i++) {
      const h = new Horse(1.0, null, currentScene, "earthy", null, 1.0, 1.0);
      // Force spots
      h.genes[79] = 1;
      h.genes[80] = 1;
      h.genes[81] = 1;
      h.genes[82] = 1;
      // Force stripes
      h.genes[87] = 1;
      h.genes[88] = 1;
      h.genes[89] = 1;
      h.genes[90] = 1;
      h.processGenes();
      console.log("Stripespot cheat spawned horse:", {
        id: h.id,
        hasSpots: h.hasSpots,
        hasStripes: h.hasStripes,
        spotColor: h.colors.spots,
        stripeColor: h.colors.stripes,
        genes: [...h.genes],
      });
      fluffies.push(h);
    }
  } else if (first === "grad") {
    for (let i = 0; i < repeatCount; i++) {
      const h = new Horse(1.0, null, currentScene, "earthy", null, 1.0, 1.0);
      // Force gradient presence
      h.genes[95] = 1;
      h.genes[96] = 1;
      h.genes[97] = 1;
      h.genes[98] = 1;
      h.processGenes();
      console.log("Gradient cheat spawned horse:", {
        id: h.id,
        hasGradient: h.hasGradient,
        gradientColor: h.colors.gradient,
        gradientIntensity: h.gradientIntensity,
        genes: [...h.genes],
      });
      fluffies.push(h);
    }
  } else if (first === "bury") {
    gibs.length = 0;
    for (const f of fluffies) {
      if (!f.isAlive) f.isDestroyed = true;
    }
    addUIMessage("Corpses and body parts removed.");
  }
}

// Input for Spawning
window.addEventListener("keydown", (e) => {
  if (gameState !== "PLAYING") return;

  if (e.code === "Space") {
    e.preventDefault();
    const code = prompt("Enter Cheat Code:");
    handleCheatCode(code);
  } else if (e.key === "b" && bloodCheat) {
    addPointToPuddle(
      currentScene,
      mouse.x,
      mouse.y,
      "#8a0303",
      25 / 200,
      25 / 200,
    );
  }
});
