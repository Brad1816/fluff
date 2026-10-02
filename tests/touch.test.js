// Playing with a finger (Touch.js): taps, drags, long presses and swipes
// become mouse clicks, drags, right-clicks and the wheel; and on a phone
// (?mobile=1) the game is laid out sideways, at least 600 tall, with the
// touch buttons down the right.
const { check, checkEqual } = require("./helpers");

const SETUP = `() => {
  __clearScene("INDOORS");
  closeAllChoices();
  currentScene = "INDOORS";
  namingPopupsEnabled = false;
  window.__mk = (x, y, opts = {}) => {
    const h = new Horse(1, null, "INDOORS", "earthy", null, 0.6, 0.6, opts.gender ?? "female");
    h.adopted = opts.adopted ?? true;
    h.x = x;
    h.y = y;
    h.brain.think = () => {};
    h.currentStateKey = "IDLE";
    fluffies.push(h);
    h.updateLayout();
    return h;
  };
  // A point on its body, on the screen
  window.__on = (f) => {
    f.updateLayout();
    for (let dy = 0; dy < 220; dy += 4) if (f.hitTestAsSeen(f.x, f.y - dy)) return __scr(f.x, f.y - dy - 8);
    return __scr(f.x, f.y - 40);
  };
  window.__scr = (x, y) => ({ x: x * scale + offsetX, y: y * scale + offsetY });
  window.__t = (type, p, id = 0) => {
    const t = new Touch({ identifier: id, target: canvas, clientX: p.x, clientY: p.y });
    canvas.dispatchEvent(new TouchEvent(type, { touches: type === "touchend" ? [] : [t], changedTouches: [t], targetTouches: type === "touchend" ? [] : [t], bubbles: true, cancelable: true }));
  };
  window.__tap = (p) => { __t("touchstart", p); __t("touchend", p); };
  window.__drag = (a, b, end = true) => {
    __t("touchstart", a);
    for (let i = 1; i <= 8; i++) __t("touchmove", { x: a.x + ((b.x - a.x) * i) / 8, y: a.y + ((b.y - a.y) * i) / 8 });
    if (end) __t("touchend", b);
  };
}`;

module.exports = [
  {
    name: "touch: a tap picks a fluffy up and a tap puts it down; dragging carries it and letting go puts it down; a drag on the floor picks nothing up",
    run: async (page) => {
      const ev = (fn) => page.evaluate(fn);
      const wait = () => page.waitForTimeout(150);
      await page.evaluate((setup) => {
        eval(setup)();
        window.__f = __mk(700, 600);
      }, SETUP);
      await ev(() => __tap(__on(__f)));
      await wait();
      const tapUp = await ev(() => __f.isDragging);
      // (the finger comes down where it should go: it follows, then the tap puts it down)
      await ev(() => __t("touchstart", __scr(1000, 620)));
      await wait();
      await ev(() => __t("touchend", __scr(1000, 620)));
      await wait();
      const tapDown = await ev(() => ({ down: !__f.isDragging, x: Math.round(__f.x) }));
      // Drag it and let go
      await ev(() => {
        __f.currentStateKey = "IDLE";
        __drag(__on(__f), __scr(800, 640), false);
      });
      await wait();
      const carried = await ev(() => __f.isDragging);
      await ev(() => __t("touchend", __scr(800, 640)));
      await wait();
      const dropped = await ev(() => ({ down: !__f.isDragging, x: Math.round(__f.x) }));
      // Picked up with a tap, then dragged: carried, put down where the finger lets go
      await ev(() => __tap(__on(__f)));
      await wait();
      const tapUp2 = await ev(() => __f.isDragging);
      await ev(() => __drag(__scr(900, 600), __scr(1100, 620), false));
      await wait();
      await ev(() => __t("touchend", __scr(1100, 620)));
      await wait();
      const carry = await ev(() => ({ down: !__f.isDragging, x: Math.round(__f.x) }));
      // A drag across the empty floor: nothing in hand afterwards
      await ev(() => __drag(__scr(500, 450), __scr(560, 460)));
      await wait();
      const empty = await ev(() => ({ hands: !fluffies.some((x) => x.isDragging) && !isGlobalDragging, up: !mouse.down }));
      check(tapUp, "a tap picks it up");
      check(tapDown.down && Math.abs(tapDown.x - 1000) < 40, `a tap puts it down there: ${JSON.stringify(tapDown)}`);
      check(carried, "dragging carries it");
      check(dropped.down && Math.abs(dropped.x - 800) < 40, `letting go puts it down: ${JSON.stringify(dropped)}`);
      check(tapUp2 && carry.down && Math.abs(carry.x - 1100) < 40, `picked up with a tap, a drag carries it there: ${JSON.stringify(carry)}`);
      check(empty.hands && empty.up, "a drag on the floor leaves nothing in hand");
    },
  },
  {
    name: "touch: a long press is a right-click (training menu on your fluffy, a tool onto the number row); a quick tap isn't; a second finger cancels it",
    run: async (page) => {
      const setupDone = await page.evaluate((setup) => {
        eval(setup)();
        const f = __mk(800, 600);
        window.__f = f;
        __t("touchstart", __on(f));
        return true;
      }, SETUP);
      check(setupDone, "set up");
      await page.waitForTimeout(250);
      const early = await page.evaluate(() => ({ tricks: SCREENS.some((s) => s.name === "tricks" && _screenOpen(s)), ring: !!document.getElementById("touch-ring") }));
      await page.waitForTimeout(450);
      const r = await page.evaluate(() => {
        const out = { tricks: SCREENS.some((s) => s.name === "tricks" && _screenOpen(s)), held: __f.isDragging };
        __t("touchend", __on(__f));
        out.rightUp = !mouse.rightDown;
        closeTrickUI();
        return out;
      });
      checkEqual(early.tricks, false, "not yet (still pressing)");
      check(early.ring, "a ring grows under the finger");
      check(r.tricks, `held: the training menu opens (a right-click): ${JSON.stringify(r)}`);
      checkEqual(r.held, false, "and it isn't picked up");
      check(r.rightUp, "the right button is let go");
      // A tool in the toolbox, held: onto the number row; held again: off it
      const t = await page.evaluate(() => {
        const sponge = new Sponge("INDOORS");
        toolbox.push(sponge);
        showToolbox = true;
        for (const s of toolbarSlots) if (s.tool === sponge) s.tool = null;
        mouse.x = -10;
        mouse.y = -10;
        // Find its button in the toolbox
        const L = _toolboxAndToolbarLayout();
        const slots = _toolboxPageSlots(L.cols, L.rows);
        const i = slots.findIndex((it) => (it.tool || it) === sponge);
        const bx = L.toolboxX + (i % L.cols) * (L.btnSize + L.btnGap) + L.btnSize / 2;
        const by = L.toolboxY + Math.floor(i / L.cols) * (L.btnSize + L.btnGap) + L.btnSize / 2;
        window.__sp = sponge;
        window.__spAt = __scr(bx, by);
        __t("touchstart", __spAt);
        return { found: i >= 0 };
      });
      check(t.found, "the sponge is in the toolbox");
      await page.waitForTimeout(650);
      const t2 = await page.evaluate(() => {
        __t("touchend", __spAt);
        const out = { onRow: toolbarSlots.some((s) => s.tool === __sp), inHand: __sp.isDragging };
        toggleToolOnToolbar(__sp);
        out.offRow = !toolbarSlots.some((s) => s.tool === __sp);
        // Two fingers: no right-click
        __t("touchstart", __on(__f));
        const a = new Touch({ identifier: 0, target: canvas, clientX: 10, clientY: 10 });
        const b = new Touch({ identifier: 1, target: canvas, clientX: 60, clientY: 60 });
        canvas.dispatchEvent(new TouchEvent("touchstart", { touches: [a, b], changedTouches: [b], bubbles: true, cancelable: true }));
        return out;
      });
      await page.waitForTimeout(650);
      const t3 = await page.evaluate(() => {
        const out = { tricks: SCREENS.some((s) => s.name === "tricks" && _screenOpen(s)) };
        canvas.dispatchEvent(new TouchEvent("touchend", { touches: [], changedTouches: [new Touch({ identifier: 0, target: canvas, clientX: 10, clientY: 10 })], bubbles: true, cancelable: true }));
        return out;
      });
      check(t2.onRow && !t2.inHand, `a long press on a tool puts it on the number row: ${JSON.stringify(t2)}`);
      check(t2.offRow, "and toggles it off");
      checkEqual(t3.tricks, false, "a second finger cancels the long press");
    },
  },
  {
    name: "touch: swiping scrolls the help pages and the chat log; sell mode needs two taps on the same fluffy",
    run: async (page) => {
      const r = await page.evaluate((setup) => {
        eval(setup)();
        const out = {};
        // Help: swipe up over the text turns the page
        openHelp(HELP_TOPICS.findIndex((t) => t.title === "Getting started"));
        const L = getHelpLayout();
        const before = helpPage;
        const mid = __scr(L.x + L.w * 0.6, L.y + L.h * 0.6);
        __drag(mid, { x: mid.x, y: mid.y - 120 });
        out.page = [before, helpPage];
        out.helpStill = helpOpen;
        closeHelp();
        // Chat log: a swipe scrolls it
        showChatLog = true;
        sceneChatLogs[currentScene] = Array.from({ length: 60 }, (_, i) => ({ name: "Daisy", text: "Line " + i, time: 0 }));
        chatLogScrollOffset = 0;
        const c = __scr(150, 240);
        __drag(c, { x: c.x, y: c.y - 100 });
        out.chat = chatLogScrollOffset;
        showChatLog = false;
        // Sell mode: first tap shows it, second sells
        const f = __mk(900, 600);
        const startMoney = money;
        setTouchSellMode(true);
        out.shift = isShiftPressed;
        __tap(__on(f));
        out.afterOne = fluffies.includes(f);
        __tap(__on(f));
        out.afterTwo = fluffies.includes(f);
        out.paid = money > startMoney;
        setTouchSellMode(false);
        out.shiftOff = isShiftPressed;
        return out;
      }, SETUP);
      check(r.page[1] > r.page[0] && r.helpStill, `a swipe turns the help page: ${JSON.stringify(r)}`);
      check(r.chat !== 0, `a swipe scrolls the chat log: ${r.chat}`);
      check(r.shift, "sell mode holds Shift");
      check(r.afterOne, "the first tap doesn't sell");
      check(!r.afterTwo && r.paid, `the second tap sells: ${JSON.stringify(r)}`);
      checkEqual(r.shiftOff, false, "off again");
    },
  },
  {
    name: "touch: on a phone (?mobile=1) the game is sideways and at least 600 tall, sharp, clear of the buttons; Esc / sell / more buttons work; held upright it asks to be turned; naming uses the phone's keyboard",
    run: async (page) => {
      const url = page.url().split("?")[0] + "?mobile=1";
      const browser = page.context().browser();
      const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
      const p = await ctx.newPage();
      const errors = [];
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("dialog", (d) => d.accept("Biscuit"));
      try {
        await p.goto(url);
        await p.waitForFunction(() => typeof gameState !== "undefined" && gameState === "TITLE", null, { timeout: 30000 });
        const size = await p.evaluate(() => ({
          touchMode,
          width,
          height,
          renderScale,
          cw: canvas.width,
          cssW: parseFloat(canvas.style.width),
          cssH: parseFloat(canvas.style.height),
          left: parseFloat(canvas.style.left),
          bar: !!document.getElementById("touch-bar"),
          manifest: !!document.querySelector('link[rel="manifest"]'),
        }));
        check(size.touchMode, "a phone");
        check(size.height >= 600 && size.width > size.height, `sideways, at least 600 tall: ${JSON.stringify(size)}`);
        check(size.renderScale > 1 && size.cw === Math.round(size.width * size.renderScale), `drawn sharp: ${JSON.stringify(size)}`);
        check(size.left + size.cssW <= 844 - 56 + 0.5 && size.cssH <= 390.5, `fits, clear of the button strip: ${JSON.stringify(size)}`);
        check(size.bar && size.manifest, "touch buttons and the home-screen manifest");
        // Start a game
        await p.evaluate(() => {
          worldSettings = new WorldSettings(true, true, true, true, fluffySexualitySliderSet.getValues(), true);
          preTransitionState = "TITLE_NEW";
          transitionPhase = "IN";
          transitionTimer = 0;
        });
        await p.waitForFunction(() => gameState === "PLAYING" && transitionPhase === "OFF", null, { timeout: 20000 });
        await p.waitForTimeout(400);
        const bar = await p.evaluate(() => {
          closeDayReport();
          const vis = (k) => getComputedStyle(document.querySelector(`[data-k="${k}"]`)).display !== "none";
          return { menu: vis("menu"), sell: vis("sell"), more: vis("more"), rotate: vis("rotate") };
        });
        check(bar.menu && bar.sell && bar.more && !bar.rotate, `buttons while playing: ${JSON.stringify(bar)}`);
        const tapBtn = async (k) => {
          const b = await p.$(`[data-k="${k}"]`);
          const box = await b.boundingBox();
          await p.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
          await p.waitForTimeout(300);
        };
        await tapBtn("menu");
        const paused = await p.evaluate(() => gameState);
        await tapBtn("menu");
        const resumed = await p.evaluate(() => gameState);
        checkEqual(paused, "PAUSED", "Esc button: pause menu");
        checkEqual(resumed, "PLAYING", "and back");
        await tapBtn("sell");
        const sell = await p.evaluate(() => [touchSellMode, isShiftPressed]);
        await tapBtn("sell");
        check(sell[0] && sell[1], "sell button: sell mode");
        await tapBtn("more");
        const more = await p.evaluate(() => [...document.querySelectorAll("#touch-more .tb-item")].map((b) => b.textContent));
        check(more.includes("Who's who (map)") && more.includes("Accounts"), `more: ${more}`);
        const items = await p.$$("#touch-more .tb-item");
        const mapBtn = items[more.indexOf("Who's who (map)")];
        const mb = await mapBtn.boundingBox();
        await p.touchscreen.tap(mb.x + mb.width / 2, mb.y + mb.height / 2);
        await p.waitForTimeout(300);
        const mapOpen = await p.evaluate(() => isRelationshipMapOpen());
        await tapBtn("menu");
        const mapShut = await p.evaluate(() => !isRelationshipMapOpen());
        check(mapOpen && mapShut, "the map from More, closed with the ✕ button");
        // Naming: tap the box, the phone's keyboard (a prompt) fills it
        const named = await p.evaluate(() => {
          const f = new Horse(1, null, currentScene, "earthy", null, 0.6, 0.6, "female");
          f.adopted = true;
          fluffies.push(f);
          namingPopup = { ids: [f.id], kind: "single", names: [""], focus: 0 };
          const L = getNamingLayout();
          const b = L.rows[0].box;
          return { x: (b.x + b.w / 2) * scale + offsetX, y: (b.y + b.h / 2) * scale + offsetY };
        });
        await p.touchscreen.tap(named.x, named.y);
        await p.waitForTimeout(300);
        const name = await p.evaluate(() => namingPopup && namingPopup.names[0]);
        checkEqual(name, "Biscuit", "named with the phone's keyboard");
        // Held upright
        await p.setViewportSize({ width: 390, height: 844 });
        await p.waitForTimeout(300);
        const upright = await p.evaluate(() => getComputedStyle(document.getElementById("rotate-note")).display);
        await p.setViewportSize({ width: 844, height: 390 });
        await p.waitForTimeout(300);
        const sideways = await p.evaluate(() => getComputedStyle(document.getElementById("rotate-note")).display);
        checkEqual(upright, "flex", "held upright: turn it sideways");
        checkEqual(sideways, "none", "sideways: the game");
        check(!errors.length, `no errors: ${errors.slice(0, 3).join(" | ")}`);
      } finally {
        await ctx.close();
      }
    },
  },
];
