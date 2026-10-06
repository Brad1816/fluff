// Shared fluffy head rendering, used by the live renderer and by head gibs.
// Gibs can outlive their fluffy (and are saved without it), so everything here
// works from plain descriptions rather than a Horse.

// Where the head image rotates around, as a fraction of its width/height
const HORSE_HEAD_PIVOT = { x: 0.25, y: 0.85 };

// Colors the head-related images for a look:
//   bodyColor, maneColor, pupilColor   colors (falsy bodyColor = untinted)
//   maneType                           0-5
//   gradient                           { color, intensity } mane gradient
//   spots, stripes                     { color, seed } body patterns
//   sensitive                          SBS (special cheek)
//   hasHorn                            unicorn/alicorn
function buildHorseHeadImages(desc) {
  const tint = (img, color, ...rest) =>
    img && color ? tintImage(img, color, ...rest) : img;
  const pattern = (cfg, seedOffset, extra) =>
    cfg ? { ...cfg, seed: cfg.seed + seedOffset, ...extra } : null;
  const body = desc.bodyColor;
  const out = {};

  out.head = tint(
    images.head,
    body,
    pattern(desc.spots, 13, { isHead: true }),
    pattern(desc.stripes, 13, { isHead: true }),
  );
  if (images.sbs_double_chin) {
    out.sbs_double_chin = tint(
      images.sbs_double_chin,
      body,
      pattern(desc.spots, 71, { isLeg: true }),
      pattern(desc.stripes, 71, { isLeg: true }),
    );
  }
  out.ear = tint(
    images.ear,
    body,
    pattern(desc.spots, 47, { isLeg: true }),
    pattern(desc.stripes, 47, { isLeg: true }),
  );
  out.eyelid = tint(images.eye, body);

  const maneImg = images["mane_" + (desc.maneType || 0)] || images.mane_0;
  out.mane = tint(
    maneImg,
    desc.maneColor || body,
    null,
    null,
    desc.gradient || null,
  );

  if (images.pupil) out.pupil = tint(images.pupil, desc.pupilColor || "black");
  out.eye = images.eye;
  if (images.eye) out.eye_pink = tintImage(images.eye, "#ffcccc");
  if (images.cheek) {
    const cheekImg =
      desc.sensitive && images.cheek_sbs ? images.cheek_sbs : images.cheek;
    out.cheek = tint(cheekImg, body);
  }
  if (images.puffed_cheek) out.puffed_cheek = tint(images.puffed_cheek, body);
  if (images.eye_happy) out.eye_happy = images.eye_happy;
  if (images.eye_pained) out.eye_pained = images.eye_pained;
  // Sad/angry eye overlays are eyelids, so they take the body color
  if (images.eye_angry) out.eye_angry = tint(images.eye_angry, body);
  if (images.eye_sad) out.eye_sad = tint(images.eye_sad, body);
  if (desc.hasHorn && images.horn) out.horn = tint(images.horn, body);
  // Toxoplasmosis showing in the eyes (Coats.js)
  if (images.eye) out.eye_toxo = tintImage(images.eye, "#c8a46a");
  return out;
}

// Draws a head (facing right) with the origin at its pivot. `img` comes from
// buildHorseHeadImages. look:
//   w, h                     head image size
//   maneScale, headScale, earScale
//   farEar, nearEar, nearEye, horn   which parts exist
//   hornSizeFactor, earFlop, doubleChin
//   expression               getExpressionConfig() result
//   isAlive, eyesClosed, pinkEye
//   pupilOffset {x, y}, pupilAlpha
//   tears                    null or { size, crying, flowPhase, gapPhase }
// hooks (optional) draw extras at fixed points in the head's transform:
//   overHead()   after the horn, before the eyes
//   overFace()   after the mouth, before the near ear
//   overCheeks() after the cheek
function drawHorseHead(ctx, img, look, hooks = {}) {
  const { w, h } = look;
  const maneScale = look.maneScale;
  const headScale = look.headScale;
  const expConfig = look.expression;
  const localOX = -w * HORSE_HEAD_PIVOT.x;
  const localOY = -h * HORSE_HEAD_PIVOT.y;

  const drawCentered = (image, x, y) =>
    ctx.drawImage(image, x - image.width / 2, y - image.height / 2);

  // Mane behind the head (young fluffies)
  if (maneScale > 0 && maneScale < MANE_LAYER_THRESHOLD && img.mane) {
    ctx.save();
    ctx.scale(maneScale, maneScale);
    ctx.drawImage(img.mane, localOX, localOY);
    ctx.restore();
  }

  ctx.save();
  ctx.scale(headScale, headScale);

  // Ear, optionally flopped around a point above its bottom center
  const drawEar = (x, y, scale) => {
    const eImg = img.ear;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    if (Math.abs(look.earFlop) > 0.01) {
      const pivotOffsetUp = 10;
      ctx.translate(eImg.width / 2, eImg.height - pivotOffsetUp);
      ctx.rotate(look.earFlop);
      ctx.drawImage(eImg, -eImg.width / 2, -eImg.height + pivotOffsetUp);
    } else {
      ctx.drawImage(eImg, 0, 0);
    }
    ctx.restore();
  };

  if (look.farEar && img.ear) drawEar(localOX + 35, localOY + 5, 0.95);

  ctx.drawImage(img.head, localOX, localOY, w, h);

  if (look.doubleChin && img.sbs_double_chin) {
    ctx.drawImage(img.sbs_double_chin, localOX - 10, localOY + 100);
  }

  // Mane in front of the head (grown fluffies). maneScale is relative to
  // the body, so undo the head scale
  if (maneScale >= MANE_LAYER_THRESHOLD && img.mane) {
    ctx.save();
    const relManeScale = maneScale / headScale;
    ctx.scale(relManeScale, relManeScale);
    ctx.drawImage(img.mane, localOX, localOY);
    ctx.restore();
  }

  if (look.horn && img.horn) {
    ctx.save();
    const hS = look.hornSizeFactor || 1.0;
    ctx.translate(0, (1 - hS) * img.horn.height);
    ctx.scale(hS, hS);
    // (a broken stump: Injuries.js)
    if (look.brokenHorn && typeof drawBrokenHorn === "function") drawBrokenHorn(ctx, img.horn, (w * 0.5) / hS, (localOY * 1.05) / hS);
    else ctx.drawImage(img.horn, (w * 0.5) / hS, (localOY * 1.05) / hS);
    ctx.restore();
  }

  if (hooks.overHead) hooks.overHead();

  // Eye
  const eyeX = w * 0.45;
  const eyeY = h * -0.325;
  const pupilX = eyeX + w * 0.02;
  const pupilY = eyeY + h * 0.01;
  const nearEye = look.nearEye;
  let drawnExp = false;

  if (look.isAlive && nearEye) {
    if (expConfig.eye === "pained" && img.eye_pained) {
      drawCentered(img.eye_pained, eyeX, eyeY);
      drawnExp = true;
    } else if (expConfig.eye === "happy" && img.eye_happy) {
      drawCentered(img.eye_happy, eyeX, eyeY);
      drawnExp = true;
    }
  }

  if (!drawnExp) {
    if (img.eye && nearEye) {
      drawCentered(
        look.pinkEye
          ? img.eye_pink || img.eye
          : look.toxoEye
            ? img.eye_toxo || img.eye
            : img.eye,
        eyeX,
        eyeY,
      );
    }

    if (img.pupil && nearEye) {
      const s = expConfig.pupilSize;
      ctx.save();
      ctx.globalAlpha *= look.pupilAlpha;
      ctx.drawImage(
        img.pupil,
        pupilX - (img.pupil.width * s) / 2 + look.pupilOffset.x,
        pupilY - (img.pupil.height * s) / 2 + look.pupilOffset.y,
        img.pupil.width * s,
        img.pupil.height * s,
      );
      ctx.restore();
    }

    if (expConfig.eye === "sad" && img.eye_sad && nearEye) {
      drawCentered(img.eye_sad, eyeX, eyeY);
    }
    if (expConfig.eye === "angry" && img.eye_angry && nearEye) {
      drawCentered(img.eye_angry, eyeX, eyeY);
    }

    // Closed (blinking, asleep) or missing eye
    if ((look.eyesClosed || !nearEye) && img.eyelid) {
      drawCentered(img.eyelid, eyeX, eyeY);
    }
  }

  // Mouth
  let mouthImg = images.mouth_neutral;
  if (expConfig.mouth === "shock") mouthImg = images.mouth_shock;
  else if (expConfig.mouth === "happy") mouthImg = images.mouth_happy;
  else if (expConfig.mouth === "sad") mouthImg = images.mouth_sad;
  if (mouthImg) drawCentered(mouthImg, w * 0.6, 0);

  if (hooks.overFace) hooks.overFace();

  if (look.nearEar && img.ear) {
    ctx.save();
    ctx.scale(look.earScale, look.earScale);
    drawEar(localOX + 10, localOY + 10, 1);
    ctx.restore();
  }

  // Cheek
  if (expConfig.cheek) {
    const cheekImg =
      expConfig.cheek === "puffed" ? img.puffed_cheek : img.cheek;
    if (cheekImg) ctx.drawImage(cheekImg, localOX, localOY);
  }

  if (hooks.overCheeks) hooks.overCheeks();

  if (look.tears) drawHorseTears(ctx, look.tears, eyeX, eyeY);

  ctx.restore(); // End head scale group
}

// Tear stream below the eye, in segments flowing down
function drawHorseTears(ctx, tears, eyeX, eyeY) {
  let fullStartY, fullEndY;
  if (tears.crying) {
    fullStartY = eyeY + 12;
    fullEndY = eyeY + 12 + (72 - 12) * tears.size;
  } else {
    // Finishing: disappear from top down
    fullStartY = eyeY + 12 + (72 - 12) * (1 - tears.size);
    fullEndY = eyeY + 72;
  }

  ctx.fillStyle = "rgba(80, 80, 80, 0.65)";
  const segmentHeight = 10;
  const gap = 1 * (Math.sin(tears.gapPhase) * 0.5 + 0.5);
  const totalPeriod = segmentHeight + gap;

  // Offset the starting point by phase
  let startY = fullStartY - (fullStartY % totalPeriod) + tears.flowPhase;
  if (startY < fullStartY) startY += totalPeriod;

  for (let y = startY - totalPeriod; y < fullEndY; y += totalPeriod) {
    const segStartY = Math.max(y, fullStartY);
    const segEndY = Math.min(y + segmentHeight, fullEndY);
    if (segEndY > segStartY) {
      ctx.beginPath();
      ctx.moveTo(eyeX - 3, segStartY);
      ctx.lineTo(eyeX - 3, segEndY);
      ctx.lineTo(eyeX + 3, segEndY);
      ctx.lineTo(eyeX + 3, segStartY);
      ctx.fill();
    }
  }
}
