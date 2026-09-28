const FLUFF_TV_CHANNELS = [
  "OFF",
  "PLAY_TIME",
  "BABIES",
  "POOPIES",
  "ALICORN",
  "HEAVY_METAL",
  "TORTURE_CHANNEL",
];

const channel_images = {
  OFF: ["fluff_tv_off"],
  PLAY_TIME: ["fluff_tv_play_time_1", "fluff_tv_play_time_2"],
  BABIES: ["fluff_tv_babbehs_1", "fluff_tv_babbehs_2"],
  POOPIES: ["fluff_tv_poopies_1"],
  ALICORN: ["fluff_tv_alicorn_1"],
  HEAVY_METAL: ["fluff_tv_heavy_metal_1", "fluff_tv_heavy_metal_2"],
  TORTURE_CHANNEL: ["fluff_tv_torture_1", "fluff_tv_torture_2"],
};

//Channel speech effects and responses are now directly integrated into the array, so you don't have to edit checks for a line in three different places.
//Randomness is now weighted, meaning you don't need them to add up to 1 anymore, 1 1 1 1 1 5 will give five messages a 10% chance
//to fire, and the last one a 50% chance to fire.
const channel_speeches = {
  OFF: [],
  PLAY_TIME: [
    {
      text: "Gud fwuffies wub pwaytime an' bawwsies!",
      weight: 1,
      //This one doesn't have a flag, it's not required.
      tvResponse: "Baww! Baww!",
    },
    { text: "Gud fwuffies wisten to ownah!", weight: 1 },
    {
      text: "Gud fwuffies wub aww fwuffies! Eben poopie fwuffies!!",
      weight: 1,
      reducesColorism: true,
      tvResponse: "Wub... eben poopie fwuffies?",
    },
    {
      text: "Nu gib bwown-fwuffies huwties! Dat am bad!",
      weight: 1,
      tvExpression: "MISERABLE", //Fluffy reacts to TV
      reducesColorism: true,
      tvResponse: "Nu wan be bad fwuffy...",
    },
    {
      text: "Poopie-fwuffies am fwen!",
      weight: 1,
      reducesColorism: true,
      //This one doesn't have a tvResponse, it's not required.
    },
  ],
  BABIES: [
    { text: "Mummah wub babbehs... babbehs wub mummah...", weight: 1 },
    { text: "Gud mummahs wub aww babbehs!", weight: 1 },
    { text: "Babbehs am bestest fing ebah!", weight: 1 },
    {
      text: "Babbehs need mummah, be mummah fow babbehs wif nu mummah!",
      weight: 1,
      adoptionEagerness: true,
      tvResponse: "Wun mowe babbeh?",
    },
    {
      text: "Dis babbeh wost his mummah, dis mummah am his nu mummah!",
      weight: 1,
      adoptionEagerness: true,
      tvResponse: "Wan' hewp babbeh wif nu mummah!",
    },
    {
      text: "Babbehs need miwkies to gwow!",
      weight: 1,
      milkEncouragment: true,
      tvResponse: "Babbehs wiww be big an stwong fwom miwkies!",
    },
  ],

  POOPIES: [
    { text: "Gud fwuffies maek poopies in widdabox!", weight: 1 },
    { text: "Gud fwuffies nu num poopies!", weight: 1 },
    { text: "Poopies on fwoow am bad poopies! Gu in widdabox!", weight: 1 },
    { text: "Teww mummah ow daddeh if widdabox fuww!", weight: 1 },
    { text: "Gud fwuffies howd poopies 'tiw get tu widdabox!", weight: 1 },
  ],
  ALICORN: [
    { text: "Gud fwuffies nu caww odda fwuffies 'munstah'!", weight: 1 },
    { text: "Pointy-wingy fwuffies am gud fwuffies!", weight: 1 },
    { text: "Pointy-wingy babbehs am gud babbehs!", weight: 1 },
    { text: "Fwuffies wif wingies an' howns nu am munstah!", weight: 1 },
  ],
  HEAVY_METAL: [
    { text: "DIG! BURY ME! UNDERNEATH!", weight: 1 },
    { text: "DISORDER! DISORDER!", weight: 1 },
    { text: "TRAPPED IN MYSELF! BODY MY HOLDING CELL!", weight: 1 },
    { text: "WHO'S! TO SAY WHAT'S FOR ME TO BE!", weight: 1 },
    { text: "RED FLUID OF LIFE IS FLOWING RIGHT ALONG MY ARMS!", weight: 1 },
    { text: "WAKEUP! GRABABRUSHANDPUTALITTLEMAKEUP!", weight: 1 },
    { text: "ONE MONTH IN THE GRAVE TWISTED AND HALF-DECAYED", weight: 1 },
    { text: "THE SUN IS FALLLING FROM THE SKY", weight: 1 },
    { text: "I WONT BECOME THE THING I HATE", weight: 1 },
    { text: "BUT I COULD FAAAAADE AWAYYY", weight: 1 },
  ],
  TORTURE_CHANNEL: [
    { text: "Mistah no hurt fwuffy! Fwuff- SCREEEEEEEEE!!", weight: 1 },
    { text: "Huu huu huu wan die... mummah! Wan die!", weight: 1 },
    {
      text: "Am mummah soon! Nu wan num bad fow babbeh sketties! Huu huu...",
      weight: 1,
    }, //Reference to Carpdime
    { text: '"Sowwy babbeh..." "*pained chirping*"', weight: 1 }, //Reference to a forgotten comic
    {
      text: "Wook cwose to needwe? SCREEEE!! Huuuhuuu fwuffy's see-pwace!",
      weight: 1,
    },
    { text: "*hack* *cough* Nuu! Fwuff- *cough* nu am ashtway!", weight: 1 },
    { text: "Mummaaahhh... why did mummah gib biwth to fwuffy?", weight: 1 }, //Reference to a Yukkuri abuse doujin
    {
      text: '"Say goodbye to your babies, you little shit!" "NUUUUUUUUUUU!!"',
      weight: 1,
    }, //Reference to art by Petn
    { text: "Nu! Nu put fwuffy in spiky sowwy box!", weight: 1 },
    {
      text: "Babbeh! Dwink miwkies ow gu foweba sweepies! Pwease babbeh!",
      weight: 1,
    }, //Reference to forgotten art
    {
      text: "*gurgling* Daddeh! *blurble* Daddeh nu can bweathies! *gurgle*",
      weight: 1,
    },
    {
      text: "Huu huu... fwuffy poopie pwace hab worstest huwties...",
      weight: 1,
    },
    { text: "Nuu! Fwuffy nu wan gib speshuw huggies to sissie!", weight: 1 },
    {
      text: "Daddeh! Spinny-boxie too hot! Fwuffy too ho- *splortch*",
      weight: 1,
    },
    {
      text: "Give your babies forever sleepies or you get more needles!",
      weight: 1,
    },
    {
      text: "Babbehs! Shawpy spinny munsta giv foweva sweepies! Stay in mummah's tummeh!",
      weight: 1,
    }, //A loose reference to a Yukkuri abuse doujin
    { text: "Nu take pwetty wingies! Pwease nu take...", weight: 1 }, //Reference to art by Carpdime
    { text: "Hewwo snakey munsta! Nu fren? ... snakey munsta?", weight: 1 },
    {
      text: '"Why in daddeh wittewbox? Fwuffy use big wittabox now?" *FLUSH* "WAWA BAD! WAWA BAD!!"',
      weight: 1,
    },
    {
      text: "Daddeh? Huggies! Daddeh? Uppies? Wook! Dancie babbeh! Am dancie babbeh now! Huu huu...",
      weight: 1,
    }, //Reference to art by Spoosh
    {
      text: "Nuuuu! Nu wan waviowi! Wan weggies an wumps back! Why vet take weggies? Huu huu...",
      weight: 1,
    }, //Reference to art by Wolfram
  ],
};

class FluffTV {
  constructor(scene = "INDOORS") {
    this.id = nextObjectId++;
    this.scene = scene;

    this.x = 0;
    this.y = 0;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.currentCage = null;

    // Channel state
    this.channel = "OFF";
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.speechTimer = 0;
  }

  nextChannel() {
    const idx = FLUFF_TV_CHANNELS.indexOf(this.channel);
    this.channel = FLUFF_TV_CHANNELS[(idx + 1) % FLUFF_TV_CHANNELS.length];
    this.frameIndex = 0;
    this.frameTimer = 0;
    this.msg = null;
  }

  hitTest(px, py) {
    const img = this._currentImage();
    if (!img) return false;
    return (
      px >= this.x - img.width / 2 &&
      px <= this.x + img.width / 2 &&
      py >= this.y - img.height &&
      py <= this.y
    );
  }

  /** Returns the loaded Image object for the current animation frame, or null. */
  _currentImage() {
    const keys = channel_images[this.channel];
    if (!keys || keys.length === 0) return images.fluff_tv_off || null;
    const key = keys[this.frameIndex % keys.length];
    return images[key] || null;
  }

  update(dt) {
    if (this.isDragging) {
      this.x = mouse.x + this.dragOffset.x;
      this.y = mouse.y + this.dragOffset.y;

      const topWallHeight = sceneTop(this.scene); // the park has a smaller top edge (Park.js)
      this.y = Math.max(this.y, topWallHeight + 10);
    }

    // Cycle channel frames every second
    this.frameTimer += dt;
    if (this.frameTimer >= 1.0) {
      this.frameTimer -= 1.0;
      const keys = channel_images[this.channel];
      if (keys && keys.length > 0) {
        this.frameIndex = (this.frameIndex + 1) % keys.length;
      }
    }

    this.speechTimer += dt;
    if (this.msg) {
      this.msg.opacity = Math.max(0.0, this.msg.opacity - dt);
    }
    if (this.speechTimer >= 10.0) {
      this.speechTimer = 0.0;
      if (Math.random() < 1.0) {
        let speeches = channel_speeches[this.channel];
        let totalWeight = speeches.reduce((sum, item) => sum + item.weight, 0);
        let rand = Math.random() * totalWeight;
        for (const bub of speeches) {
          rand -= bub.weight;
          if (rand <= 0) {
            this.msg = {
              opacity: 3.0,
              ...bub,
            };
            this._triggerFocusReactions();
            break;
          }
        }
      }
    }
    const img = this._currentImage();
    if (img) {
      handleGenericCageContainment(this, img.width, img.height);
    }
  }

  onDrop() {
    handleDropping(this);
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  _triggerFocusReactions() {
    if (typeof fluffies === "undefined") return;
    const isTvOff = this.channel === "OFF";
    const isPlayTimeEquality = this.channel === "PLAY_TIME";
    const isBabiesLine = this.channel === "BABIES";
    const isPoopiesLine = this.channel === "POOPIES";
    const isMunstaLine = this.channel === "ALICORN";
    const isHeavyMetal = this.channel === "HEAVY_METAL";
    const isTortureChannel = this.channel === "TORTURE_CHANNEL";

    for (const f of fluffies) {
      if (!f.tvFocus || f.tvFocus.tv !== this) continue;
      if (!f.isAlive) continue;
      if (f.tooYoungToSpeak()) continue;

      const isSmarty = f.isSmarty();

      if (isPlayTimeEquality) {
        if (
          worldSettings.colorism &&
          f.coloristDegree > 0.0 &&
          this.msg.reducesColorism
        ) {
          f.coloristDegree = Math.max(0, f.coloristDegree - 0.05);
        }
        if (this.msg.tvResponse !== undefined) {
          f.speak(this.msg.tvResponse);
        }
        if (this.msg.tvExpression !== undefined) {
          f.expressionOverride = this.msg.tvExpression;
          f.expressionOverrideTimer = 3.0;
        }
      }

      if (isBabiesLine) {
        {
          if (this.msg.tvResponse !== undefined) {
            f.speak(this.msg.tvResponse);
          }
          if (this.msg.adoptionEagerness) {
            f.adoptionModifier = 0.3;
          }
          if (
            this.msg.milkEncouragement &&
            f.gender === "female" &&
            f.milkCharges < 5
          ) {
            f.milkCharges++;
          }
        }
      }

      if (isPoopiesLine) {
        if (!isSmarty) {
          f.pottyTraining = Math.min(1.0, f.pottyTraining + 0.4);
          f.changeHappiness(0.1);
        }
        const key = isSmarty ? "SMARTY" : "DEFAULT";
        f.speak(getDialogue(["TV_FOCUS", "POOPIES", key], f));
      }

      if (isMunstaLine) {
        if (
          worldSettings.alicornIntolerance &&
          !f.alicornTolerance &&
          Math.random() < 0.5
        ) {
          // 50%: flee (same as heavy metal)
          f.fleeFromTV(this);
          const lines = getDialogue(["TV_FOCUS", "HEAVY_METAL"], f);
          const chosen = Array.isArray(lines)
            ? lines[Math.floor(Math.random() * lines.length)]
            : lines;
          f.speak(chosen);
        } else if (!worldSettings.alicornIntolerance || f.alicornTolerance) {
          const lines = getDialogue(["TV_FOCUS", "MUNSTA_TOL"], f);
          const chosen = Array.isArray(lines)
            ? lines[Math.floor(Math.random() * lines.length)]
            : lines;
          f.speak(chosen);
        } else {
          // 50%: non-smarty becomes alicorn tolerant
          if (!isSmarty) {
            f.alicornTolerance = true;
            f.changeHappiness(0.1);
          }
          const key = isSmarty ? "SMARTY" : "DEFAULT";
          f.speak(getDialogue(["TV_FOCUS", "MUNSTA", key], f));
        }
      }

      if (isHeavyMetal) {
        f.fleeFromTV(this);
        const lines = getDialogue(["TV_FOCUS", "HEAVY_METAL"], f);
        const chosen = Array.isArray(lines)
          ? lines[Math.floor(Math.random() * lines.length)]
          : lines;
        f.speak(chosen);
        continue;
      }

      //Torture channel, this can reform smarties, but has a real chance of causing wan die.
      if (isTortureChannel) {
        if (
          f.happiness < 0.5 &&
          Math.random() / 2 < f.happiness &&
          f.isSmarty()
        ) {
          //Smarty reform logic
          f.poopStorage = 0;
          f.peeStorage = 0;
          f.fleeFromTV(this);
          f.speak(
            "NUUUUUUU! Wiww be gud fwuffy nao! Nu mowe bad poopies! Nu mowe sowwy-hoofsies! Am nyu fwuffy nao!",
          );
          f.pottyTraining += 0.5;
          f.coloristDegree -= 0.5;
          f.alicornTolerance = true;
          const reformPersonality = [
            "true_feral",
            "lost_from_herd",
            "runaway",
            "mill_escapee",
          ];
          f.personalities =
            reformPersonality[
              Math.floor(Math.random() * reformPersonality.length)
            ];
          delete f.isSmarty;
          return;
        }
        if (Math.random() > f.happiness && !f.isSmarty()) {
          //Smarties wont run away from the screen, fluffies are more likely to run away at low happiness
          f.fleeFromTV(this);
          const lines = getDialogue(["TV_FOCUS", "TORTURE_CHANNEL"], f);
          const chosen = Array.isArray(lines)
            ? lines[Math.floor(Math.random() * lines.length)]
            : lines;
          f.speak(chosen);
          continue;
        } else {
          f.expressionOverride = "CRYING_SHOCKED";
          f.expressionOverrideTimer = 15.5;
          let lines;
          if (f.isSmarty()) {
            lines = getDialogue(["TV_FOCUS", "TORTURE_CHANNEL_SMARTY"], f);
          } else {
            lines = getDialogue(["TV_FOCUS", "TORTURE_CHANNEL_TRAUMA"], f);
          }
          const chosen = Array.isArray(lines)
            ? lines[Math.floor(Math.random() * lines.length)]
            : lines;
          f.changeHappiness(-(f.happiness * 0.2)); //The dimishing returns keeps them sad but not functionally dead
          f.speak(chosen);
          continue;
        }
      }
    }
  }

  getBottomY() {
    return this.y;
  }

  serialize() {
    return {
      classType: "FluffTV",
      id: this.id,
      x: this.x,
      y: this.y,
      scene: this.scene,
      channel: this.channel,
      frameIndex: this.frameIndex,
      frameTimer: this.frameTimer,
      currentCageId: this.currentCage ? this.currentCage.id : null,
    };
  }

  deserialize(data) {
    if (data.channel && FLUFF_TV_CHANNELS.includes(data.channel)) {
      this.channel = data.channel;
    }
    this.frameIndex = data.frameIndex || 0;
    this.frameTimer = data.frameTimer || 0;
  }

  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    const img = this._currentImage();
    if (!img) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.drawImage(img, -img.width / 2, -img.height);
    ctx.restore();
  }
}
