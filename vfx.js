class Poof {
  constructor(
    x,
    y,
    scene,
    color = "white",
    isSmoke = false,
    scale = 1.0,
    life = 1.0,
  ) {
    this.x = x;
    this.y = y;
    this.scene = scene;
    this.color = color;
    this.isSmoke = isSmoke;
    this.scale = scale;
    this.life = life;
    this.particles = [];
    const count = this.isSmoke ? 5 : 8;
    for (let i = 0; i < count; i++) {
      if (this.isSmoke) {
        this.particles.push({
          vx: (Math.random() - 0.5) * 25,
          vy: -35 - Math.random() * 45,
          r: 6 + Math.random() * 6,
        });
      } else {
        this.particles.push({
          vx: (Math.random() - 0.5) * 100,
          vy: (Math.random() - 0.5) * 100,
          r: 5 + Math.random() * 10,
        });
      }
    }
  }
  update(dt) {
    this.life -= dt * (this.isSmoke ? 1.0 : 2.0);
  }
  draw(ctx) {
    this.drawOffScreen(ctx);
  }

  drawOffScreen(ctx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    for (const p of this.particles) {
      const baseR = this.isSmoke ? Math.max(0, p.r * this.life) : p.r;
      const currentR = baseR * this.scale;
      if (currentR <= 0) continue;
      ctx.beginPath();
      ctx.arc(
        this.x + p.vx * (1 - this.life) * this.scale,
        this.y + p.vy * (1 - this.life) * this.scale,
        currentR,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    ctx.restore();
  }
}

class SmokePoof extends Poof {
  constructor(x, y, scene, color = CATTLE_PROD_SMOKE_COLOR) {
    super(x, y, scene, color, true);
  }
}

function updateVFX(dt) {
  // Update Poofs
  for (let i = poofs.length - 1; i >= 0; i--) {
    poofs[i].update(dt);
    if (poofs[i].life <= 0) poofs.splice(i, 1);
  }

  // Update Water Ripples
  rippleTimer -= dt;
  if (rippleTimer <= 0) {
    waterRipples = [];
    for (let i = 0; i < 15; i++) {
      waterRipples.push({
        x: Math.random() * width * 0.25,
        y: Math.random() * height,
      });
    }
    rippleTimer = 0.125; // 8 times a second
  }
}

function drawVFX(ctx) {
  for (const poof of poofs) {
    if (poof.scene === currentScene) {
      poof.draw(ctx);
    }
  }
}
