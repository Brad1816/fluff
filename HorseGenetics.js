// Share of random wing+horn fluffies allowed to stay alicorns (see
// generateRandomGenes). Bred foals aren't affected: breeding for alicorns
// still works.
const ALICORN_RANDOM_KEEP = 0.03;

class HorseGenetics {
  constructor(horse) {
    this.horse = horse;
  }

  generateRandomGenes(bodyQuality = null, maneQuality = null) {
    const genes = [];
    // 0-47: Color (Binary)
    // 48: Eye Base (Base 3)
    // 49-52: Eye Dark (Binary)
    // 53-62: Wings/Horn (Binary)
    // 63: Mane type (Base 3)
    // 64: Tail type (Base 3)
    // 65-70: Miscarry genes (0-16)

    let bodyTarget = null;
    let maneTarget = null;

    if (bodyQuality !== null) {
      const anchor =
        POOPIE_ANCHORS[Math.floor(Math.random() * POOPIE_ANCHORS.length)];
      const randomBody = [
        Math.random() * 255,
        Math.random() * 255,
        Math.random() * 255,
      ];
      bodyTarget = [
        lerp(anchor[0], randomBody[0], bodyQuality),
        lerp(anchor[1], randomBody[1], bodyQuality),
        lerp(anchor[2], randomBody[2], bodyQuality),
      ];
    }

    if (maneQuality !== null) {
      const anchor =
        POOPIE_ANCHORS[Math.floor(Math.random() * POOPIE_ANCHORS.length)];
      const randomMane = [
        Math.random() * 255,
        Math.random() * 255,
        Math.random() * 255,
      ];
      maneTarget = [
        lerp(anchor[0], randomMane[0], maneQuality),
        lerp(anchor[1], randomMane[1], maneQuality),
        lerp(anchor[2], randomMane[2], maneQuality),
      ];
    }

    const setGenesForColor = (target) => {
      const rSum = Math.round(target[0] / 31.875);
      const gSum = Math.round(target[1] / 31.875);
      const bSum = Math.round(target[2] / 31.875);

      const fillGenes = (sum) => {
        const bits = [0, 0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < sum; i++) bits[i] = 1;
        // Shuffle bits for randomness
        for (let i = 7; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [bits[i], bits[j]] = [bits[j], bits[i]];
        }
        return bits;
      };

      return [...fillGenes(rSum), ...fillGenes(gSum), ...fillGenes(bSum)];
    };

    let colorGenes = [];
    if (bodyTarget || maneTarget) {
      const bt = bodyTarget || [
        Math.random() * 255,
        Math.random() * 255,
        Math.random() * 255,
      ];
      const mt = maneTarget || [
        Math.random() * 255,
        Math.random() * 255,
        Math.random() * 255,
      ];
      colorGenes = [...setGenesForColor(bt), ...setGenesForColor(mt)];
    } else {
      for (let i = 0; i < 48; i++) {
        colorGenes.push(Math.random() < 0.5 ? 0 : 1);
      }
    }

    for (let i = 0; i < 103; i++) {
      if (i < 48) {
        genes.push(colorGenes[i]);
      } else if (i === 63) {
        genes.push(Math.floor(Math.random() * 6));
      } else if (i === 48 || i === 64) {
        genes.push(Math.floor(Math.random() * 3));
      } else if (i >= 65 && i <= 70) {
        genes.push(Math.floor(Math.random() * 17));
      } else if (i === 77 || i === 78) {
        genes.push(Math.floor(Math.random() * 10));
      } else if (
        (i >= 83 && i <= 86) ||
        (i >= 91 && i <= 94) ||
        (i >= 99 && i <= 102)
      ) {
        if (i === 99) {
          genes.push(128 + Math.floor(Math.random() * 128));
        } else {
          genes.push(Math.floor(Math.random() * 256));
        }
      } else {
        genes.push(Math.random() < 0.5 ? 0 : 1);
      }
    }
    // Alicorns are meant to be extremely rare. With wing and horn genes each
    // at 50/50, about 1 in 30 random fluffies would come out with both. So
    // when a random fluffy gets both, usually one of them is knocked down to
    // 3 of 5 genes: hidden (it can still be passed on to foals), not shown.
    // Leaves about 1 in 1,000 random fluffies an alicorn.
    const count = (from) => genes.slice(from, from + 5).reduce((s, g) => s + g, 0);
    if (count(53) >= 4 && count(58) >= 4 && Math.random() > ALICORN_RANDOM_KEEP) {
      const start = Math.random() < 0.5 ? 53 : 58; // lose the wings or the horn
      const bits = [1, 1, 1, 0, 0].sort(() => Math.random() - 0.5);
      for (let i = 0; i < 5; i++) genes[start + i] = bits[i];
    }
    // Personality trait genes (Traits.js)
    if (typeof ensureTraitGenes === "function") ensureTraitGenes(genes);
    // Fancy mane genes (ManePatterns.js)
    if (typeof randomManeGenes === "function") randomManeGenes(genes);
    return genes;
  }

  processGenes() {
    // Older fluffies don't have personality trait genes yet (Traits.js)
    if (typeof ensureTraitGenes === "function") ensureTraitGenes(this.horse.genes);
    // ...or fancy mane genes (ManePatterns.js): a plain mane
    if (typeof ensureManeGenes === "function") ensureManeGenes(this.horse.genes);
    this.horse.manePattern = typeof manePatternOfGenes === "function" ? manePatternOfGenes(this.horse.genes) : null;
    // Decode Colors
    const getComponent = (startIdx) => {
      let sum = 0;
      for (let i = 0; i < 8; i++) sum += this.horse.genes[startIdx + i];
      return Math.floor(sum * 31.875);
    };
    const bodyR = getComponent(0);
    const bodyG = getComponent(8);
    const bodyB = getComponent(16);
    this.horse.colors.body = `rgb(${bodyR}, ${bodyG}, ${bodyB})`;

    const maneR = getComponent(24);
    const maneG = getComponent(32);
    const maneB = getComponent(40);
    this.horse.colors.mane = `rgb(${maneR}, ${maneG}, ${maneB})`;

    // Eye Color
    const base = this.horse.genes[48]; // 48
    let baseColor = [173, 216, 230]; // Light Blue
    if (base === 1) baseColor = [144, 238, 144]; // Light Green
    if (base === 2) baseColor = [255, 182, 193]; // Pink

    const darkCount =
      this.horse.genes[49] +
      this.horse.genes[50] +
      this.horse.genes[51] +
      this.horse.genes[52];
    // Darkness interpolation: 4 = black (0,0,0), 0 = base
    const t = 1.0 - darkCount / 4.0;
    const pupilR = Math.floor(baseColor[0] * t);
    const pupilG = Math.floor(baseColor[1] * t);
    const pupilB = Math.floor(baseColor[2] * t);
    this.horse.colors.pupil = `rgb(${pupilR}, ${pupilG}, ${pupilB})`;

    // Subtype
    const wingCount =
      this.horse.genes[53] +
      this.horse.genes[54] +
      this.horse.genes[55] +
      this.horse.genes[56] +
      this.horse.genes[57];
    const hornCount =
      this.horse.genes[58] +
      this.horse.genes[59] +
      this.horse.genes[60] +
      this.horse.genes[61] +
      this.horse.genes[62];
    const hasWings = wingCount >= 4;
    const hasHorn = hornCount >= 4;

    if (hasWings && hasHorn) this.horse.type = "alicorn";
    else if (hasWings) this.horse.type = "pegasus";
    else if (hasHorn) this.horse.type = "unicorn";
    else this.horse.type = "earthy";

    this.horse.maneType = this.horse.genes[63]; // 63
    this.horse.tailType = this.horse.genes[64]; // 64

    // Size Genetics
    let sizeBonus = 0;
    if (this.horse.genes[71]) sizeBonus += 0.04;
    if (this.horse.genes[72]) sizeBonus += 0.04;
    if (this.horse.genes[73]) sizeBonus += 0.04;
    if (this.horse.genes[74]) sizeBonus -= 0.04;
    if (this.horse.genes[75]) sizeBonus -= 0.04;
    if (this.horse.genes[76]) sizeBonus -= 0.04;
    this.horse.geneticsSizeBonus = sizeBonus;

    // Wing/Horn Size
    this.horse.hornSizeFactor = 0.75 + (this.horse.genes[77] || 0) * (0.25 / 9);
    this.horse.wingSizeFactor = 0.75 + (this.horse.genes[78] || 0) * (0.25 / 9);

    // Spot Pattern Genetics
    const spotCount =
      (this.horse.genes[79] || 0) +
      (this.horse.genes[80] || 0) +
      (this.horse.genes[81] || 0) +
      (this.horse.genes[82] || 0);
    this.horse.hasSpots = spotCount === 4;
    this.horse.spotPatternSeed =
      this.horse.genes[83] !== undefined ? this.horse.genes[83] : 0;

    // Decode RGB color for spots
    const spotR =
      this.horse.genes[84] !== undefined ? this.horse.genes[84] : 255;
    const spotG =
      this.horse.genes[85] !== undefined ? this.horse.genes[85] : 255;
    const spotB =
      this.horse.genes[86] !== undefined ? this.horse.genes[86] : 255;
    this.horse.colors.spots = `rgb(${spotR}, ${spotG}, ${spotB})`;

    // Stripe Pattern Genetics
    const stripeCount =
      (this.horse.genes[87] || 0) +
      (this.horse.genes[88] || 0) +
      (this.horse.genes[89] || 0) +
      (this.horse.genes[90] || 0);
    this.horse.hasStripes = stripeCount === 4;
    this.horse.stripePatternSeed =
      this.horse.genes[91] !== undefined ? this.horse.genes[91] : 0;

    // Decode RGB color for stripes (defaults to black/dark if undefined)
    const stripeR =
      this.horse.genes[92] !== undefined ? this.horse.genes[92] : 0;
    const stripeG =
      this.horse.genes[93] !== undefined ? this.horse.genes[93] : 0;
    const stripeB =
      this.horse.genes[94] !== undefined ? this.horse.genes[94] : 0;
    this.horse.colors.stripes = `rgb(${stripeR}, ${stripeG}, ${stripeB})`;

    // Gradient Pattern Genetics
    const gradientCount =
      (this.horse.genes[95] || 0) +
      (this.horse.genes[96] || 0) +
      (this.horse.genes[97] || 0) +
      (this.horse.genes[98] || 0);
    // All 4 needed, like spots and stripes (was 2 of 4, which gave about
    // two thirds of all fluffies a gradient mane and tail): most fluffies
    // are plain
    this.horse.hasGradient = gradientCount === 4;
    this.horse.gradientIntensity =
      this.horse.genes[99] !== undefined
        ? Math.max(128, this.horse.genes[99]) / 255
        : 0.5;

    // Decode RGB color for gradient
    const gradR =
      this.horse.genes[100] !== undefined ? this.horse.genes[100] : 255;
    const gradG =
      this.horse.genes[101] !== undefined ? this.horse.genes[101] : 255;
    const gradB =
      this.horse.genes[102] !== undefined ? this.horse.genes[102] : 255;
    this.horse.colors.gradient = `rgb(${gradR}, ${gradG}, ${gradB})`;
  }

  setGenesFromType(type) {
    if (type === "pegasus" || type === "alicorn") {
      // Force wings: bits 53-57 to 1
      for (let i = 53; i <= 57; i++) this.horse.genes[i] = 1;
    }
    if (type === "unicorn" || type === "alicorn") {
      // Force horn: bits 58-62 to 1
      for (let i = 58; i <= 62; i++) this.horse.genes[i] = 1;
    }
    if (type === "earthy") {
      for (let i = 53; i <= 62; i++) this.horse.genes[i] = 0;
    }
  }

  getColorName() {
    const rgb = this.horse.colors.body.match(/\d+/g).map(Number);
    const r = rgb[0] / 255,
      g = rgb[1] / 255,
      b = rgb[2] / 255;

    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    h *= 360;
    s *= 100;
    l *= 100;

    // 1. Greyscale Logic
    if (l < 10) return "bwack";
    if (l > 90 && s < 10) return "wite";
    if (s < 20) return "gway";

    // 2. Brown Logic (Dark, low-saturation orange/yellow)
    if (h >= 10 && h <= 50 && s < 60 && l < 50) return "bwown";

    // 3. Hue-based Logic
    if (l > 70 && (h < 20 || h > 320)) return "pink";
    if (h < 20 || h > 340) return "wed";
    if (h < 45) return "owange";
    if (h < 75) return "yewwow";
    if (h < 165) return "gween";
    if (h < 255) return "bwue";
    if (h < 320) return "puwpuw";
    return "pink";
  }

  calculatePrice() {
    if (!this.horse.isAlive) return 0;
    let price = 5 + 15 * Math.min(1.0, this.horse.growth);
    if (this.horse.type === "pegasus" || this.horse.type === "unicorn") {
      price *= 2;
    } else if (this.horse.type === "alicorn") {
      price *= 30;
      if (!this.horse.limbs.leftWing || !this.horse.limbs.rightWing) {
        price /= 2;
      }
      if (!this.horse.limbs.horn) {
        price /= 2;
      }
    }

    if (this.horse.isSensitive()) {
      price *= 30;
    }

    // Color Valuation
    price *= this.calculateColorMultiplier();

    // Potty training bonus: up to +50% and a little extra, so a trained
    // fluffy is worth more but it doesn't swamp everything else
    const trained = this.horse.pottyTraining || 0;
    price = price * (1 + 0.5 * trained) + 50 * trained;

    // Temperament: happy, trusting fluffies are worth more, frightened or
    // traumatised ones less (Wellbeing.js)
    if (typeof temperamentMultiplier === "function") price *= temperamentMultiplier(this.horse);

    // Old fluffies are worth less: senior x0.8, elderly x0.5 (Aging.js)
    if (typeof agePriceMultiplier === "function") price *= agePriceMultiplier(this.horse);
    if (typeof ribbonPriceMultiplier === "function") price *= ribbonPriceMultiplier(this.horse);
    // +5% for each trick it knows (Tricks.js)
    if (typeof trickPriceMultiplier === "function") price *= trickPriceMultiplier(this.horse);
    // Well fed and trim: worth a bit more (Diet.js)
    if (typeof dietPriceMultiplier === "function") price *= dietPriceMultiplier(this.horse);
    // A dirty fluffy sells for less (Bath.js)
    if (typeof dirtPriceMultiplier === "function") price *= dirtPriceMultiplier(this.horse);
    // Scars: -5% each, at most -20% (Scars.js)
    if (typeof scarPriceMultiplier === "function") price *= scarPriceMultiplier(this.horse);
    // Titles: Cherished x1.1, Broken x0.8... (Titles.js)
    if (typeof titlePriceMultiplier === "function") price *= titlePriceMultiplier(this.horse);

    return Math.floor(price);
  }

  calculateColorMultiplier() {
    const getRGB = (startIdx) => {
      let sum = 0;
      for (let i = 0; i < 8; i++) sum += this.horse.genes[startIdx + i];
      return Math.floor(sum * 31.875);
    };

    const bRGB = [getRGB(0), getRGB(8), getRGB(16)];
    const mRGB = [getRGB(24), getRGB(32), getRGB(40)];

    // 1. How nice the coat is (judgeCoatColour, globals.js): poopie brown
    // x0.3, drab about x2.5, bright up to x6.4 (the same average as before)
    const coatP = judgeCoatColour(bRGB).p;
    let anchorMult = 0.3 + 6.1 * coatP * coatP;

    // 2. Greyscale Bonus (Saturation near zero)
    const isGreyscale = (rgb) => {
      const avg = (rgb[0] + rgb[1] + rgb[2]) / 3;
      const dev = Math.sqrt(
        ((rgb[0] - avg) ** 2 + (rgb[1] - avg) ** 2 + (rgb[2] - avg) ** 2) / 3,
      );
      return dev < 15; // Threshold for "greyscale"
    };

    let greyscaleMult = 1.0;
    if (isGreyscale(bRGB)) greyscaleMult = 2.0;

    // 3. Color Harmony (Matching colors)
    const harmDist = Math.sqrt(
      (bRGB[0] - mRGB[0]) ** 2 +
        (bRGB[1] - mRGB[1]) ** 2 +
        (bRGB[2] - mRGB[2]) ** 2,
    );
    // Bonus for matching: 1.0 matches, 0.0 max distance
    let harmonyMult = 1.0 + (1.0 - harmDist / MAX_COLOR_DIST);

    // 4. Secondary/Pattern Color Valuation
    let secondaryMult = 1.0;
    const parseRGB = (colorStr) => {
      if (!colorStr) return [255, 255, 255];
      const m = colorStr.match(/\d+/g);
      return m ? m.map(Number) : [255, 255, 255];
    };
    const getPatternMult = (rgb) => 0.6 + 2.45 * judgeCoatColour(rgb).p;

    if (this.horse.hasSpots) {
      secondaryMult *= getPatternMult(parseRGB(this.horse.colors.spots));
    }
    if (this.horse.hasStripes) {
      secondaryMult *= getPatternMult(parseRGB(this.horse.colors.stripes));
    }
    if (this.horse.hasGradient) {
      secondaryMult *= getPatternMult(parseRGB(this.horse.colors.gradient));
    }
    // A fancy mane (ManePatterns.js)
    if (typeof manePatternPriceMultiplier === "function") secondaryMult *= manePatternPriceMultiplier(this.horse);

    return anchorMult * greyscaleMult * harmonyMult * secondaryMult;
  }

  // How nice other fluffies think its coat is (colourism): 0 = poopie
  // brown, 1 = bright and lovely (judgeCoatColour in globals.js)
  calculateColorismPerception() {
    const getRGB = (startIdx) => {
      let sum = 0;
      for (let i = 0; i < 8; i++) sum += this.horse.genes[startIdx + i];
      return Math.floor(sum * 31.875);
    };
    return judgeCoatColour([getRGB(0), getRGB(8), getRGB(16)]).p;
  }

  combineGenes(otherGenes) {
    const babyGenes = [];
    // 0-102: looks and health genes. 103+: personality traits (Traits.js)
    const total = Math.max(
      103,
      typeof TRAIT_GENE_TOTAL === "number" ? TRAIT_GENE_TOTAL : 103,
    );
    for (let i = 0; i < total; i++) {
      if (i >= 103) {
        // A parent from before traits existed has none: use the other's
        // gene, or a random one if neither has it
        const mine = this.horse.genes[i];
        const theirs = otherGenes[i];
        let g = Math.random() < 0.5 ? theirs : mine;
        if (g === undefined) g = mine !== undefined ? mine : theirs;
        if (g === undefined) g = Math.random() < 0.5 ? 0 : 1;
        babyGenes.push(g);
        continue;
      }
      // Special handling for miscarry genes (65-70)
      // One from mom's pair, one from dad's pair
      if (i === 65 || i === 67 || i === 69) {
        // Mom's pair: (i, i+1)
        babyGenes.push(
          Math.random() < 0.5 ? this.horse.genes[i] : this.horse.genes[i + 1],
        );
      } else if (i === 66 || i === 68 || i === 70) {
        // Dad's pair: (i-1, i)
        babyGenes.push(Math.random() < 0.5 ? otherGenes[i - 1] : otherGenes[i]);
      } else {
        // Normal genes
        if (Math.random() < 0.5) {
          babyGenes.push(otherGenes[i]);
        } else {
          babyGenes.push(this.horse.genes[i]);
        }
      }
    }
    // Fancy mane genes (ManePatterns.js)
    if (typeof inheritManeGenes === "function") inheritManeGenes(babyGenes, this.horse.genes, otherGenes);
    return babyGenes;
  }
}
