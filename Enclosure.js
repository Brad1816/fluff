// A larger, comfortable cage: no modes and no passive happiness loss
class Enclosure extends Cage {
  getImage() {
    return images.enclosure;
  }

  causesUnhappiness() {
    return false;
  }

  getSellValue() {
    return 2500;
  }

  cycleTag() {
    // Enclosures don't have modes
  }
}
