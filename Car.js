class Car {
  constructor(scene = "ALLEY_ROAD") {
    this.scene = scene;
    this.carType = Math.random() < 0.5 ? "car_1" : "car_2";
    this.direction = Math.random() < 0.5 ? "left-to-right" : "right-to-left";
    this.isDestroyed = false;

    const speed = 1000 + Math.random() * 500; // speed in pixels per second

    if (this.direction === "left-to-right") {
      this.x = -600; // start off-screen left
      this.vx = speed;
      this.y = 340; // lower lane (driving right)
    } else {
      this.x = width + 100; // start off-screen right
      this.vx = -speed;
      this.y = 200; // upper lane (driving left)
    }

    // Tires: 10% chance tire_2, 90% chance tire_1
    this.tireType1 = Math.random() < 0.1 ? "tire_2" : "tire_1";
    this.tireType2 = Math.random() < 0.1 ? "tire_2" : "tire_1";

    if (this.carType === "car_1") {
      this.tireOffsets = [
        { x: 108, y: 188 },
        { x: 331, y: 188 },
      ];
    } else {
      this.tireOffsets = [
        { x: 44, y: 162 },
        { x: 261, y: 162 },
      ];
    }

    this.tireRotation = 0;
  }

  update(dt) {
    this.x += this.vx * dt;

    // Update tire rotation based on horizontal travel and estimated tire radius of 25px
    this.tireRotation += (this.vx * dt) / 25;

    // Check if fully off-screen
    const carImg = images[this.carType];
    const carWidth = carImg ? carImg.width : 500;

    if (this.direction === "left-to-right") {
      if (this.x > width + 100) {
        this.isDestroyed = true;
      }
    } else {
      if (this.x < -carWidth - 100) {
        this.isDestroyed = true;
      }
    }
  }

  getBottomY() {
    const carImg = images[this.carType];
    return this.y + (carImg ? carImg.height : 200);
  }

  draw(ctx) {
    const carImg = images[this.carType];
    if (!carImg || !carImg.complete) return;

    const tireImg1 = images[this.tireType1];
    const tireImg2 = images[this.tireType2];

    ctx.save();

    const isFlipped = this.direction === "right-to-left";

    if (isFlipped) {
      // Flip horizontally to face left
      ctx.translate(this.x + carImg.width, this.y);
      ctx.scale(-1, 1);
    } else {
      ctx.translate(this.x, this.y);
    }

    // Draw Tire 1 (underneath the car)
    if (tireImg1 && tireImg1.complete) {
      const offset1 = this.tireOffsets[0];
      ctx.save();
      ctx.translate(offset1.x, offset1.y);
      ctx.rotate(isFlipped ? -this.tireRotation : this.tireRotation);
      ctx.drawImage(tireImg1, -tireImg1.width / 2, -tireImg1.height / 2);
      ctx.restore();
    }

    // Draw Tire 2 (underneath the car)
    if (tireImg2 && tireImg2.complete) {
      const offset2 = this.tireOffsets[1];
      ctx.save();
      ctx.translate(offset2.x, offset2.y);
      ctx.rotate(isFlipped ? -this.tireRotation : this.tireRotation);
      ctx.drawImage(tireImg2, -tireImg2.width / 2, -tireImg2.height / 2);
      ctx.restore();
    }

    // Draw car chassis on top of the wheels
    ctx.drawImage(carImg, 0, 0);

    ctx.restore();
  }
}

// A car driving through a pool on the road scatters it: blood, pee and mess
// under it shrink a little with every car that goes over them (the way the
// sprinkler washes them away), and a big one takes a few cars to clear.
const CAR_PUDDLE_WEAR = 0.35; // (puddle scale lost per second under a car)
function carWearPuddles(car, dt, left, right, top, bottom) {
  if (typeof puddles === "undefined") return;
  for (const p of puddles) {
    if (p.scene !== car.scene || p.type === "water" || p.type === "tears") continue;
    for (let j = p.points.length - 1; j >= 0; j--) {
      const pt = p.points[j];
      if (pt.x < left || pt.x > right || pt.y < top || pt.y > bottom) continue;
      if (pt.targetScale && pt.scale < pt.targetScale - 0.01) continue; // (still spreading: the one it just made)
      p.shrinkPoint(j, CAR_PUDDLE_WEAR * dt, 0.03);
    }
  }
}
