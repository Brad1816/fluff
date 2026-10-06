// A foal trapped in a can: a small cage holding one foal. It has no modes,
// can't be sold or have things dropped into it, and right-clicking it frees
// the foal.
class FoalInACan extends Cage {
  constructor(scene = "ALLEY") {
    super(scene);
    this.formulaCharges = CAN_FORMULA_MAX;
  }

  getImage() {
    return images.foal_in_a_can;
  }

  // (x, y) is the bottom of the can
  getAnchorY() {
    return 1;
  }

  cycleTag() {
    // Cans don't have modes
  }

  canBeSold() {
    return false;
  }

  acceptsDroppedItems() {
    return false;
  }

  onRightClick() {
    this.freeFoal();
  }

  setPosition(x, y) {
    this.x = x;
    this.y = y;
  }

  freeFoal() {
    if (typeof fluffies !== "undefined") {
      const foal = fluffies.find((f) => f.currentCage === this);
      if (foal) {
        foal.currentCage = null;
        foal.despawnProtectionTimer = 10;
        // Jump out a little bit
        foal.vy = -150;
      }
    }

    if (typeof poofs !== "undefined" && typeof Poof !== "undefined") {
      poofs.push(new Poof(this.x, this.y - 20, this.scene, "green"));
    }

    if (typeof objects !== "undefined") {
      const idx = objects.indexOf(this);
      if (idx > -1) {
        objects.splice(idx, 1);
      }
    }
  }

  serialize() {
    return { ...super.serialize(), formulaCharges: this.formulaCharges };
  }

  deserialize(data) {
    super.deserialize(data);
    this.formulaCharges =
      data.formulaCharges !== undefined ? data.formulaCharges : 8;
  }
}
