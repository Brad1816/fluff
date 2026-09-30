// ---------------------------------------------------------------------------
// Beyond the house, part 3 (design doc Phase 5): every life you've had in
// your care, and photos.
//
// Lives: when one of your fluffies dies (HorseAnatomy.die), its story is
// closed with a short epilogue (lifeEpilogue: how long it lived, its title,
// what it loved, its tricks and foals, how it died and who was with it)
// and kept in the Memories book's "Lives" tab (livesBook, saved). Click one
// to reread its whole story, chapter by chapter (LifeStory.js).
//
// Photos: right-click one of yours, "Take a photo". A little picture of it
// as it is right now, with a caption of what it's doing ("Wren asleep in a
// pile with Rowan"), goes in its story and in the book's "Photos" tab - a
// scrapbook across generations. Rename a caption by clicking it. At most
// PHOTO_MAX are kept (the oldest go); one photo per fluffy per PHOTO_REST.
// (The design doc's camera tool became a right-click action: no new tool
// to buy, and it works in the park too.)
// ---------------------------------------------------------------------------

const LIVES_MAX = 300;
const PHOTO_MAX = 40;
const PHOTO_SIZE = 96;
const PHOTO_REST = 30; // game seconds
const LIVES_PER_PAGE = 5;
const PHOTOS_PER_PAGE = 8;

function freshLivesBook() {
  return { lives: [], photos: [], nextPhoto: 1 };
}
let livesBook = freshLivesBook();
let livesReading = null; // life id being read in the book
const _photoImages = {}; // photo id -> Image

function _lvOk() {
  if (!livesBook || typeof livesBook !== "object") livesBook = freshLivesBook();
  if (!Array.isArray(livesBook.lives)) livesBook.lives = [];
  if (!Array.isArray(livesBook.photos)) livesBook.photos = [];
  if (typeof livesBook.nextPhoto !== "number") livesBook.nextPhoto = livesBook.photos.length + 1;
  return livesBook;
}
function _lvNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}
function _lvDay() {
  return typeof getDayNumber === "function" ? getDayNumber() : 1;
}
function _lvName(f) {
  return typeof fluffyDisplayName === "function" ? fluffyDisplayName(f) : "A fluffy";
}
function _lvHe(f) {
  return f.gender === "male" ? { sub: "he", obj: "him", poss: "his", Sub: "He", Poss: "His" } : { sub: "she", obj: "her", poss: "her", Sub: "She", Poss: "Her" };
}
function _lvList(a) {
  return a.length <= 1 ? a.join("") : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`;
}

// ---- Lives ----

function lifeEpilogue(f, cause) {
  const n = _lvName(f);
  const p = _lvHe(f);
  const days = typeof ageDays === "function" ? ageDays(f) : (f.age || 0) / DAY_LENGTH;
  const age = typeof fluffyAgeText === "function" ? fluffyAgeText(days) : `${Math.round(days)} days`;
  const out = [];
  out.push(`${n} lived ${age === "newborn" ? "only a few days" : age}.`);
  const title = typeof titleOf === "function" ? titleOf(f) : null;
  if (title) out.push(["Rebel", "Survivor", "Guardian"].includes(title) ? `${p.Sub} was a ${title} to the end.` : `${p.Sub} was ${title} to the end.`);
  if (f.favouriteFound && typeof _pnWords === "function" && typeof favouriteCareOf === "function") out.push(`${p.Sub} loved ${_pnWords(favouriteCareOf(f), f).ing.toLowerCase()} most of all.`);
  const tricks = typeof knownTricks === "function" ? knownTricks(f).map((k) => getTrick(k).name.toLowerCase()) : [];
  if (tricks.length) out.push(`${p.Sub} knew how to ${_lvList(tricks)}.`);
  const foals = typeof getFamilyChildren === "function" ? getFamilyChildren(f.id).length : 0;
  if (foals) out.push(`${p.Sub} had ${foals === 1 ? "one foal" : `${foals} foals`}.`);
  const with_ = typeof fluffies !== "undefined" ? fluffies.filter((o) => o !== f && o.isAlive && o.adopted && o.scene === f.scene && o.growth >= 0.3 && fluffyNames[o.id]).slice(0, 3).map((o) => fluffyNames[o.id]) : [];
  const how = cause ? String(cause).replace(/^./, (c) => c.toLowerCase()) : "died";
  const where = typeof houseRoomName === "function" && houseRoomName(f.scene) ? ` in the ${houseRoomName(f.scene).toLowerCase()}` : "";
  out.push(`${p.Sub} died${how && how !== "died" ? ` (${how})` : ""}${where}${with_.length ? `, with ${_lvList(with_)} beside ${p.obj}` : ""}.`);
  return out.join(" ");
}

// HorseAnatomy.die
function recordLife(f, cause) {
  if (!f || !f.adopted) return null;
  const b = _lvOk();
  if (b.lives.some((l) => l.id === f.id)) return null;
  const life = {
    id: f.id,
    name: _lvName(f),
    gender: f.gender,
    motherId: f.motherId ?? null,
    fatherId: f.fatherId ?? null,
    bornAt: _lvNow() - (f.age || 0),
    diedAt: _lvNow(),
    day: _lvDay(),
    title: typeof titleOf === "function" ? titleOf(f) : null,
    epilogue: lifeEpilogue(f, cause),
  };
  b.lives.push(life);
  if (b.lives.length > LIVES_MAX) b.lives.shift();
  return life;
}

// A stand-in for LifeStory.js to read a life that's over
function _lifeStub(life) {
  return { id: life.id, gender: life.gender, motherId: life.motherId, fatherId: life.fatherId, age: Math.max(0, life.diedAt - life.bornAt) + (_lvNow() - life.diedAt), adopted: true, isAlive: false, growth: 1 };
}

// ---- Photos ----

function _lvCaption(f) {
  const n = _lvName(f);
  const state = f.currentStateKey;
  const near = typeof fluffies !== "undefined" ? fluffies.filter((o) => o !== f && o.isAlive && o.scene === f.scene && Math.hypot(o.x - f.x, o.y - f.y) < 130) : [];
  const nearName = near.map((o) => fluffyNames[o.id]).filter(Boolean)[0];
  if (state === "SLEEPING") return nearName ? `${n} asleep in a pile with ${nearName}` : `${n}, fast asleep`;
  if (f.trickNow) return `${n} doing ${typeof getTrick === "function" && getTrick(f.trickNow.key) ? `"${getTrick(f.trickNow.key).name}"` : "a trick"}`;
  if (state === "EATING") return `${n} at dinner`;
  if (f.growth < 1 && near.some((o) => o.id === f.motherId)) return `${n} with ${fluffyNames[f.motherId] || "mum"}`;
  if (f.accessories && f.accessories.head) return `${n} in a fine hat`;
  if (typeof isFrightened === "function" && isFrightened(f)) return `${n}, frightened`;
  if (nearName) return `${n} and ${nearName}`;
  if (f.happiness >= 0.75) return `${n}, happy as can be`;
  if (f.happiness < 0.3) return `${n}, looking sad`;
  const room = typeof houseRoomName === "function" && houseRoomName(f.scene) ? ` in the ${houseRoomName(f.scene).toLowerCase()}` : "";
  return `${n}${room}`;
}

// The picture: a square around it, from the screen
function _lvGrab(f) {
  try {
    if (typeof canvas === "undefined" || typeof document === "undefined") return null;
    const cam = typeof isCameraScene === "function" && isCameraScene(f.scene) && typeof camera !== "undefined" ? camera : { x: 0, y: 0 };
    const size = 200 * Math.max(0.6, f.scale || 1);
    const sx = Math.max(0, Math.min(canvas.width - size, f.x - cam.x - size / 2));
    const sy = Math.max(0, Math.min(canvas.height - size, f.y - cam.y - size * 0.7));
    const c = document.createElement("canvas");
    c.width = PHOTO_SIZE;
    c.height = PHOTO_SIZE;
    c.getContext("2d").drawImage(canvas, sx, sy, size, size, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
    return c.toDataURL("image/jpeg", 0.7);
  } catch (e) {
    return null;
  }
}

function photoActions(f) {
  if (!f || !f.isAlive || !f.adopted) return [];
  const now = _lvNow();
  if (typeof f._photoAt === "number" && now >= f._photoAt && now - f._photoAt < PHOTO_REST) return [];
  return [{ key: "photo", name: "Take a photo", sub: "for the book", run: (x) => takePhoto(x) }];
}

function takePhoto(f) {
  if (!f || !f.isAlive) return null;
  const b = _lvOk();
  f._photoAt = _lvNow();
  const photo = { id: b.nextPhoto++, fid: f.id, name: _lvName(f), day: _lvDay(), caption: _lvCaption(f), data: f.scene === currentScene ? _lvGrab(f) : null };
  b.photos.push(photo);
  while (b.photos.length > PHOTO_MAX) b.photos.shift();
  if (typeof recordStory === "function") recordStory("photo", f, { x: photo.id });
  if (typeof addUIMessage === "function") addUIMessage(`Snap! "${photo.caption}" is in the Memories book.`);
  _photoFlash = 0.25;
  return photo;
}

function photoById(id) {
  return _lvOk().photos.find((p) => p.id === id) || null;
}

function _photoImage(p) {
  if (!p || !p.data || typeof Image === "undefined") return null;
  let img = _photoImages[p.id];
  if (!img) {
    img = new Image();
    img.src = p.data;
    _photoImages[p.id] = img;
  }
  return img.complete && img.width ? img : null;
}

// A white flash when the photo's taken (UI.js draws it)
let _photoFlash = 0;
function drawPhotoFlash(c, dt = 1 / 60) {
  if (_photoFlash <= 0) return;
  c.save();
  c.fillStyle = `rgba(255,255,255,${Math.min(0.8, _photoFlash * 3)})`;
  c.fillRect(0, 0, width, height);
  c.restore();
  _photoFlash -= dt;
}

// ---- The Memories book's Lives and Photos tabs (SharedMemories.js) ----

function _livesLayout(L) {
  const list = _lvOk().lives.slice().reverse();
  const pages = Math.max(1, Math.ceil(list.length / LIVES_PER_PAGE));
  memoriesBookPage = Math.max(0, Math.min(pages - 1, memoriesBookPage));
  const rows = list.slice(memoriesBookPage * LIVES_PER_PAGE, (memoriesBookPage + 1) * LIVES_PER_PAGE).map((life, i) => {
    const ry = L.y + 80 + i * 92;
    return { life, x: L.x + 24, y: ry, w: L.w - 48, h: 84, read: { x: L.x + L.w - 24 - 90, y: ry + 10, w: 80, h: 28 } };
  });
  return { rows, pages };
}

function _readArea(L) {
  return { x: L.x + 30, y: L.y + 96, w: L.w - 60, h: L.h - 160 };
}

function drawBookLives(c, L) {
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.font = "italic 13px Georgia";
  c.fillStyle = "rgba(245,227,200,0.7)";
  const life = livesReading !== null ? _lvOk().lives.find((l) => l.id === livesReading) : null;
  if (life) {
    c.fillText(`${life.name}, who died on day ${life.day}`, L.x + 24, L.y + 64);
    const back = { x: L.x + 24, y: L.y + L.h - 50, w: 110, h: 32 };
    c.font = "italic 14px Georgia";
    c.fillStyle = "#eadcc8";
    const ep = typeof wrapText === "function" ? wrapText(c, life.epilogue, L.w - 60) : [life.epilogue];
    ep.slice(0, 2).forEach((l, i) => c.fillText(l, L.x + 30, L.y + 84 + i * 16));
    if (typeof drawLifeStoryTab === "function") drawLifeStoryTab(c, _lifeStub(life), { ...(_readArea(L)), y: L.y + 84 + Math.min(2, ep.length) * 16 + 10 });
    drawGlassButton(back.x, back.y, back.w, back.h, "◀ All lives", { fontSize: 14, borderRadius: 10 });
    drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 15, borderRadius: 10 });
    return;
  }
  c.fillText("Every life you've had in your care", L.x + 24, L.y + 64);
  const V = _livesLayout(L);
  if (!V.rows.length) {
    c.font = "italic 16px Georgia";
    c.fillStyle = "rgba(245,227,200,0.6)";
    c.fillText("No one has died in your care yet.", L.x + 24, L.y + 120);
  }
  for (const r of V.rows) {
    c.fillStyle = "rgba(200, 190, 230, 0.08)";
    fillRoundRect(c, r.x, r.y, r.w, r.h, 10);
    c.font = "bold 18px Georgia";
    c.fillStyle = "#f5e3c8";
    c.fillText(fitText(c, `✝ ${r.life.name}${r.life.title ? ` · ${r.life.title}` : ""}`, r.w - 140), r.x + 14, r.y + 28);
    c.font = "14px Georgia";
    c.fillStyle = "#eadcc8";
    const lines = typeof wrapText === "function" ? wrapText(c, r.life.epilogue, r.w - 28) : [r.life.epilogue];
    lines.slice(0, 2).forEach((l, i) => c.fillText(i === 1 && lines.length > 2 ? fitText(c, l + " ...", r.w - 28) : l, r.x + 14, r.y + 52 + i * 20));
    drawGlassButton(r.read.x, r.read.y, r.read.w, r.read.h, "Read", { fontSize: 13, borderRadius: 8 });
  }
  _bookPager(c, L, V.pages);
}

function _bookPager(c, L, pages) {
  if (pages > 1) {
    drawGlassButton(L.prev.x, L.prev.y, L.prev.w, L.prev.h, "◀", { fontSize: 15, borderRadius: 10 });
    drawGlassButton(L.next.x, L.next.y, L.next.w, L.next.h, "▶", { fontSize: 15, borderRadius: 10 });
    c.font = "13px Arial";
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.textAlign = "left";
    c.fillText(`${memoriesBookPage + 1} / ${pages}`, L.next.x + L.next.w + 12, L.next.y + 21);
  }
  drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 15, borderRadius: 10 });
}

function _bookPageClick(L, pages) {
  const hit = (b) => isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h);
  if (pages > 1 && hit(L.prev)) {
    memoriesBookPage = Math.max(0, memoriesBookPage - 1);
    return true;
  }
  if (pages > 1 && hit(L.next)) {
    memoriesBookPage = Math.min(pages - 1, memoriesBookPage + 1);
    return true;
  }
  return false;
}

function handleBookLivesClick(L) {
  const hit = (b) => isPointInRect(mouse.x, mouse.y, b.x, b.y, b.w, b.h);
  if (livesReading !== null) {
    if (hit({ x: L.x + 24, y: L.y + L.h - 50, w: 110, h: 32 })) {
      livesReading = null;
      return true;
    }
    const life = _lvOk().lives.find((l) => l.id === livesReading);
    if (life && typeof handleLifeStoryClick === "function") handleLifeStoryClick(_readArea(L));
    return true;
  }
  const V = _livesLayout(L);
  if (_bookPageClick(L, V.pages)) return true;
  for (const r of V.rows) {
    if (hit(r.read)) {
      livesReading = r.life.id;
      if (typeof lifeStoryPage !== "undefined") lifeStoryPage = 0;
      return true;
    }
  }
  return true;
}

function _photosLayout(L) {
  const list = _lvOk().photos.slice().reverse();
  const pages = Math.max(1, Math.ceil(list.length / PHOTOS_PER_PAGE));
  memoriesBookPage = Math.max(0, Math.min(pages - 1, memoriesBookPage));
  const cellW = (L.w - 48) / 4;
  const cells = list.slice(memoriesBookPage * PHOTOS_PER_PAGE, (memoriesBookPage + 1) * PHOTOS_PER_PAGE).map((p, i) => ({
    p,
    x: L.x + 24 + (i % 4) * cellW,
    y: L.y + 84 + Math.floor(i / 4) * 210,
    w: cellW - 12,
    h: 200,
  }));
  return { cells, pages };
}

function drawBookPhotos(c, L) {
  c.textAlign = "left";
  c.textBaseline = "alphabetic";
  c.font = "italic 13px Georgia";
  c.fillStyle = "rgba(245,227,200,0.7)";
  c.fillText("Right-click a fluffy and take a photo. Click a caption to change it.", L.x + 24, L.y + 64);
  const V = _photosLayout(L);
  if (!V.cells.length) {
    c.font = "italic 16px Georgia";
    c.fillStyle = "rgba(245,227,200,0.6)";
    c.fillText("No photos yet.", L.x + 24, L.y + 120);
  }
  for (const cell of V.cells) {
    const p = cell.p;
    c.fillStyle = "#f4efe6"; // a white print
    c.fillRect(cell.x, cell.y, cell.w, cell.h);
    const size = Math.min(cell.w - 16, 140);
    const ix = cell.x + (cell.w - size) / 2;
    const img = _photoImage(p);
    if (img) c.drawImage(img, ix, cell.y + 8, size, size);
    else {
      c.fillStyle = "#cfc6b8";
      c.fillRect(ix, cell.y + 8, size, size);
      c.fillStyle = "#8a7f70";
      c.font = "italic 12px Georgia";
      c.textAlign = "center";
      c.fillText("(no picture)", cell.x + cell.w / 2, cell.y + 8 + size / 2);
      c.textAlign = "left";
    }
    c.fillStyle = "#3a2e22";
    c.font = "italic 12px Georgia";
    c.textAlign = "center";
    const lines = typeof wrapText === "function" ? wrapText(c, p.caption, cell.w - 12) : [p.caption];
    lines.slice(0, 2).forEach((l, i) => c.fillText(l, cell.x + cell.w / 2, cell.y + size + 26 + i * 14));
    c.fillStyle = "#8a7f70";
    c.font = "11px Georgia";
    c.fillText(`day ${p.day}`, cell.x + cell.w / 2, cell.y + cell.h - 6);
    c.textAlign = "left";
  }
  _bookPager(c, L, V.pages);
}

function handleBookPhotosClick(L) {
  const V = _photosLayout(L);
  if (_bookPageClick(L, V.pages)) return true;
  for (const cell of V.cells) {
    if (isPointInRect(mouse.x, mouse.y, cell.x, cell.y + 140, cell.w, cell.h - 140)) {
      const t = typeof prompt === "function" ? prompt("Caption:", cell.p.caption) : null;
      if (t !== null && t !== undefined && String(t).trim()) cell.p.caption = String(t).trim().slice(0, 80);
      return true;
    }
  }
  return true;
}
