// ---------------------------------------------------------------------------
// Special friends: your say, and how they stand by each other (playtest).
//
// Asking you: when two of your fluffies want to be special friends in the
// room you're in (HorseActionHandler.executeProposeToFriend: one asked, the
// other said yes), a question comes up: let them, or keep them apart. Kept
// apart, they're sad and won't ask each other again for SF_REFUSED_WAIT game
// seconds (f.sfRefused, saved: id -> until). Pairs you're not watching (other
// rooms, wild ones, while you sleep or skip time) decide for themselves, as
// before. A breeder decides who breeds with whom this way.
//
// Standing by each other: a special friend that sees its partner
//   - hurt (by you: Memory.notePlayerViolence; by another fluffy:
//     HorseSocial.performAttack) cries out, likes whoever did it less and,
//     if brave, goes for the fluffy that did it
//   - bred by someone else (HorseMating.mateWith) is upset - more so when
//     its partner was willing - and thinks less of the other fluffy
// (once per SF_REACT_GAP seconds each).
// ---------------------------------------------------------------------------

const SF_REFUSED_WAIT = 3 * 1200; // game seconds (3 days) before they ask each other again
const SF_REFUSED_SAD = 0.06;
const SF_REACT_GAP = 20; // seconds between one fluffy's reactions
const SF_HARM_OPINION = -0.3;
const SF_BRED_OPINION = -0.25;
const SF_BRED_SAD = 0.05;

function _sfNow() {
  return typeof timePlayed === "number" ? timePlayed : 0;
}

function specialFriendOf(f) {
  if (!f || typeof relationships === "undefined") return null;
  const rels = relationships[f.id] || {};
  for (const id in rels) {
    if (rels[id] !== "special_friend") continue;
    const o = fluffyById(id);
    if (o && o.isAlive) return o;
  }
  return null;
}

// Kept apart by you lately?
function sfRefused(a, b) {
  const until = a && a.sfRefused && a.sfRefused[b.id];
  return typeof until === "number" && until > _sfNow();
}

// Would you be asked about these two right now?
function sfAsksPlayer(a, b) {
  if (!a || !b || !a.adopted || !b.adopted) return false;
  if (typeof currentScene === "undefined" || a.scene !== currentScene || b.scene !== currentScene) return false;
  if (typeof gameState !== "undefined" && gameState !== "PLAYING") return false;
  if (typeof isSleeping === "function" && isSleeping()) return false;
  if (typeof openChoice !== "function") return false;
  return true;
}

function _sfSetSpecial(a, b) {
  if (!relationships[a.id]) relationships[a.id] = {};
  if (!relationships[b.id]) relationships[b.id] = {};
  relationships[a.id][b.id] = "special_friend";
  relationships[b.id][a.id] = "special_friend";
}

// HorseActionHandler.executeProposeToFriend, the yes: bond them (asking you
// first when you're watching). accept() says the yes and makes them happy.
function proposeSpecialFriends(a, b, accept) {
  if (!sfAsksPlayer(a, b)) {
    accept();
    _sfSetSpecial(a, b);
    return true;
  }
  if (a._sfAsking || b._sfAsking) return false;
  a._sfAsking = b._sfAsking = true;
  const na = fluffyDisplayName(a);
  const nb = fluffyDisplayName(b);
  openChoice({
    title: `${na} and ${nb} want to be special friends`,
    lines: [`${na} asked and ${nb} said yes.`, "Special friends stay close, comfort each other - and breed together."],
    buttons: [
      {
        label: "Let them",
        kind: "ok",
        run: () => {
          a._sfAsking = b._sfAsking = false;
          if (!a.isAlive || !b.isAlive) return;
          accept();
          _sfSetSpecial(a, b);
        },
      },
      {
        label: "Keep them apart",
        cancel: true,
        run: () => {
          a._sfAsking = b._sfAsking = false;
          for (const [x, y] of [
            [a, b],
            [b, a],
          ]) {
            if (!x.isAlive) continue;
            if (!x.sfRefused || typeof x.sfRefused !== "object") x.sfRefused = {};
            x.sfRefused[y.id] = _sfNow() + SF_REFUSED_WAIT;
            x.changeHappiness(-SF_REFUSED_SAD, "Kept from a special friend");
            if (x.friendshipCooldowns) x.friendshipCooldowns[y.id] = SF_REFUSED_WAIT;
          }
          sayIfAwake(b, ["SPECIAL_FRIEND", "REFUSED"], a, true);
        },
      },
    ],
  });
  return true;
}

function _sfCanReact(f) {
  if (!f || !f.isAlive || f.currentStateKey === "SLEEPING" || f.tooYoungToSpeak()) return false;
  if (!(f.canSee() || f.canHear())) return false;
  const now = _sfNow();
  if (f._sfReactAt !== undefined && now - f._sfReactAt >= 0 && now - f._sfReactAt < SF_REACT_GAP) return false;
  f._sfReactAt = now;
  return true;
}

// Its special friend was hurt (by: a fluffy, or null for you)
function onSpecialFriendHarmed(victim, by) {
  const sf = specialFriendOf(victim);
  if (!sf || sf.scene !== victim.scene || sf === by || !_sfCanReact(sf)) return;
  sayIfAwake(sf, ["SPECIAL_FRIEND", by ? "HURT_BY_FLUFFY" : "HURT_BY_YOU"], victim, true);
  sf.changeHappiness(-0.04, "Saw its special friend hurt");
  if (by && by.isAlive) {
    if (typeof changeOpinion === "function") changeOpinion(sf, by, SF_HARM_OPINION, "hurt my special friend");
    // A brave one stands up for its partner
    const brave = typeof traitValue === "function" ? traitValue(sf, "bravery") : 0;
    if (brave > 0.2 && sf.growth >= 1 && (sf.attackCooldown || 0) <= 0 && Math.hypot(sf.x - by.x, sf.y - by.y) < 150 && typeof sf.performAttack === "function")
      sf.performAttack(by, "RETALIATION");
  }
}

// HorseMating.mateWith: these two are breeding - any special friend of
// either that sees it, and isn't one of them, takes it badly
function onSpecialFriendBred(male, mare, forced) {
  for (const [partner, other] of [
    [male, mare],
    [mare, male],
  ]) {
    const sf = specialFriendOf(partner);
    if (!sf || sf === other || sf.scene !== partner.scene || !_sfCanReact(sf)) continue;
    // Was its partner willing? (forced, or a mare with a stallion she didn't choose)
    const willing = !forced;
    sayIfAwake(sf, ["SPECIAL_FRIEND", willing ? "BRED_WILLING" : "BRED_FORCED"], partner, true);
    sf.changeHappiness(-SF_BRED_SAD * (willing ? 1.5 : 1), "Its special friend bred with another");
    if (typeof changeOpinion === "function") {
      changeOpinion(sf, other, SF_BRED_OPINION, "bred with my special friend");
      if (willing) changeOpinion(sf, partner, SF_BRED_OPINION / 2, "bred with someone else");
    }
  }
}
