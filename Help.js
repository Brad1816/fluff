// ---------------------------------------------------------------------------
// In-game help: "How it works".
//
// Open with the "?" button (after Goals) or F1; Esc or Close shuts it.
// Topics down the left, text on the right. To add or change a topic, edit
// HELP_TOPICS: each has a title and a list of lines ("" = gap, lines
// starting with "# " are small headings, "- " are bullets).
// ---------------------------------------------------------------------------

const HELP_TOPICS = [
  {
    title: "Getting started",
    lines: [
      "You run a fluffy breeding business: raise fluffies, breed them for",
      "good colours and rare types, and sell them or fill customer orders.",
      "",
      "# Money",
      "- Buyers knock at the door and pay full price for a fluffy.",
      "- Selling one yourself (shift + click, or the sell cage) pays half.",
      "- Customer orders (bounty board on Shopping Street, or the Computer)",
      "  pay the most, and raise your reputation.",
      "- Goals (the Goals button, or G) pay a reward once each.",
      "",
      "# Looking after them",
      "- Keep bowls full (kibble from Fluff Mart, down from the garden).",
      "- The magnifying glass shows everything about a fluffy.",
      "- The family tree and Gene Lab help you plan litters. Breeding",
      "  records (Records button, or L) show every litter you've bred,",
      "  what each foal sold for, and which parents earn the most.",
    ],
  },
  {
    title: "Temperament & price",
    lines: [
      "How you treat a fluffy changes what it's worth.",
      "",
      "- Happiness, trust in you, and not being afraid of you all count;",
      "  lasting trauma counts against it.",
      "- Temperaments: Delightful pet, Good-natured, Ordinary, Nervous,",
      "  Damaged. Prices range from about 0.4x to 1.3x.",
      '- The magnifying glass shows it: "Sells for $240 (Good-natured +12%)".',
      "- Customers tip for a delightful fluffy, pay less for a scared one,",
      '  and some orders ask for "Raised gently (no lasting trauma)".',
      "- Litter training adds up to +50% and a little extra.",
      "",
      "# Trust",
      "- Fluffies trust you more when they're fed at home and happy around",
      "  you. Hurting them (or others in front of them) makes them afraid.",
    ],
  },
  {
    title: "Fluffy Park",
    lines: [
      "The park is to the right of the Day Care Alley. It's bigger than the",
      "screen: drag the grass, scroll, or use WASD / arrow keys to look",
      "around. Click the map in the corner to jump.",
      "",
      "- Wild fluffies live there in herds, eat the grass in the meadows and",
      "  berries from the bushes, and breed on their own.",
      "- To take one home, just carry it out through the exit arrow.",
      "- Wild fluffies are wary of people: fresh from the park they're",
      "  Nervous and sell for less. With good care they settle in (the",
      '  magnifying glass shows "Settling in").',
    ],
  },
  {
    title: "Buying stock",
    lines: [
      'Other breeders sell pedigree fluffies: the "Breeding stock" tab on',
      "the Bounty Board (Shopping Street) or FluffList (the Computer).",
      "",
      "- New stock every morning. Each breeder has a line: spots, stripes,",
      "  white coats, wings, horns, pastel colours or cheap hardy earthies.",
      "- The card shows the fluffy, its mum and dad, and its grandparents.",
      "  A spotted grandma or pegasus dad means it may carry those genes",
      "  hidden. After buying, the family tree and Gene Lab show them.",
      "- Better reputation, better stock: unicorns and pegasi from Known",
      "  breeder, more choice and the odd alicorn from Renowned breeder.",
      "- Stock costs about twice what a buyer would pay for it: you buy to",
      "  breed, not to sell on.",
    ],
  },
  {
    title: "Fluffy shows",
    lines: [
      'Every 3 days at 2 PM there\'s a fluffy show: the "Shows" tab on the',
      "Bounty Board (Shopping Street) or FluffList (the Computer).",
      "",
      "- Each show has a theme: Best Coat, Spots & Stripes, Best Unicorn,",
      "  Best Pegasus, Friendliest, Best Foal, Golden Oldies, Best Behaved.",
      "  From Trusted breeder there's sometimes a Supreme Championship.",
      "- The tab lists the fluffies that can enter, with the judges' score.",
      "  Coat colours count most, then temperament (happy, trusting, calm).",
      "  Missing parts, flu or poor health cost points.",
      "- Enter one fluffy for a small fee (withdraw for a refund before",
      "  the show). The other breeders get better as your reputation grows.",
      "- 1st, 2nd and 3rd win money, reputation and a ribbon. Ribbons raise",
      "  a fluffy's price, and 3 wins make it a Champion.",
    ],
  },
  {
    title: "Herds & territory",
    lines: [
      "- Fluffies that like each other form herds with a leader (press H to",
      "  see herd markers).",
      "- In the park, herds claim meadows. Their colour rings the meadow on",
      "  the park and the map.",
      "- They chase strangers off their land, and a bigger herd can take a",
      "  meadow from a smaller one. Herds over 12 split in two.",
      "- Rival herds keep apart: no hugs, friendships or sleeping together.",
      "- Herds need food, so winter (when little grows) brings more fights.",
    ],
  },
  {
    title: "Day, night & weather",
    lines: [
      "- A day is 20 minutes at normal speed. The clock by Chat Log shows",
      "  the day, time, season and weather.",
      "- Speed buttons (1x-8x) or F fast forward the whole game.",
      "- Fluffies sleep mostly at night. Outside gets dark.",
      "- Seasons last 4 days: grass grows best in spring and after rain,",
      "  berries in autumn, almost nothing in winter.",
      "- Rain and snow upset fluffies outside; in the park they shelter",
      "  under trees. Thunder startles them. Snow makes them hungrier.",
      "- Every morning at 6:00 a report sums up the day before.",
    ],
  },
  {
    title: "Night in the park",
    lines: [
      "Most nights something happens to one of the park's herds. The",
      'morning report lists it under "Last night in the park".',
      "",
      "# Bad",
      "- A fox creeps in and goes for the weakest, usually a foal. Brave",
      "  fluffies and the herd leader stand up to it and may drive it off.",
      "  If you're there, click the fox to chase it away.",
      "- A tummy bug, a freezing night (autumn and winter), a stampede",
      "  that tramples the meadow, or a fight in the herd.",
      "",
      "# Good",
      "- A bumper crop, newcomers joining, a snuggly night that makes",
      "  the herd happier and closer.",
      "- Rarely, a lost pet wanders in: good genes and not afraid of",
      "  people, so it's worth taking home.",
    ],
  },
  {
    title: "Alicorns",
    lines: [
      "With alicorn intolerance on, most fluffies are scared of alicorns.",
      "Getting one to accept them is rare and takes a long time:",
      "",
      "- Only time spent near an alicorn that doesn't hurt anyone helps:",
      "  weeks of game time, and they forget if you keep them apart.",
      "- A little faster for foals, brave fluffies, a mum with her own",
      "  alicorn foal, friends who already accept them, or a caged alicorn.",
      "- A fluffy that really trusts you can be held near the alicorn to",
      "  introduce them. It takes a long time.",
      "- Smarties almost never come round. An alicorn attack sets them",
      "  right back.",
      "- A mum who does accept her alicorn foal takes it back.",
      '- The magnifying glass shows it: "Alicorns: Getting used to them".',
    ],
  },
  {
    title: "Taking & trauma",
    lines: [
      "Carrying a fluffy away from its family, friends or herd upsets it.",
      "",
      "- It misses them, more as time goes on; bring it back and it's",
      "  overjoyed. Grown-ups get over it in time.",
      "- Foals too young to remember forget it quickly.",
      "- Some ways of being taken leave a scar for life (shown as Trauma):",
      "  after you hurt it or its family, after you killed its family, or",
      "  after its parents died. A foal torn from its mum keeps a mild one.",
      "- Scars mean lower happiness, nightmares, and (if it blames you)",
      "  lasting fear of you - which also lowers its price.",
    ],
  },
  {
    title: "Health & the vet",
    lines: [
      "The FluffVet Clinic is on Shopping Street. Click it: the vet makes",
      "house calls, so it all happens straight away.",
      "",
      "# Fluffy flu",
      "- Some wild fluffies and strays carry it. It's catching before it",
      "  shows, then they sneeze, feel miserable and lose health for about",
      "  a day. Foals and elderly fluffies can die of it.",
      "- It spreads to fluffies close by - but not through cage bars or",
      "  fences. Keep new arrivals in a cage or pen for a day or two.",
      "- Fluffies that get over it can't catch it again for a while.",
      "",
      "# The vet",
      "- Check-up $20: finds flu before it shows, and says how long an",
      "  old fluffy has left.",
      "- Treatment: cures flu, poison, toxoplasmosis and the runs, stops",
      "  bleeding and heals. Flu jab $40: can't catch flu.",
    ],
  },
  {
    title: "Age & old age",
    lines: [
      "Age is counted in game days (the clock by Chat Log).",
      "",
      "- Foals grow up in about a day and a half.",
      "- From 16 days a fluffy is a senior: its mane and tail go grey.",
      "- From 24 days it's elderly: slower, worth half as much, and",
      "  elderly mares can't have foals any more.",
      "- From 28 days it can die peacefully of old age; most live to",
      "  about 35 days, none past 40.",
      "",
      "# Abandoned fluffies",
      "- Some pets are dumped by their owners: half-grown, grown up or",
      "  old. They have a name, and they miss their old owner, so they're",
      "  sadder (and sell for less) until they get over it - faster once",
      "  they're yours and trust you.",
    ],
  },
  {
    title: "Names",
    lines: [
      'Fluffies are just "Fluffy" until a person names them.',
      "",
      "- Runaways, abandoned pets and lost pets had an owner, so they come",
      "  with the name it gave them. Stock from breeders comes named too.",
      "- When a fluffy becomes yours (born, bought or brought home) a",
      "  pop-up offers to name it. A litter gets one pop-up for all foals.",
      '- Leave a box empty to keep it "Fluffy"; you can rename any fluffy',
      "  later with the magnifying glass.",
      "- Unnamed fluffies are described by their looks on the game's",
      '  screens, e.g. "Fluffy (pink unicorn mare)".',
    ],
  },
  {
    title: "Keys",
    lines: [
      "- WASD: move between areas (in the park, WASD or arrows look around)",
      "- F: fast forward (1x / 2x / 4x / 8x)",
      "- G: goals        L: breeding records        F1: this help",
      "- N: name tags    H: herd markers    B: bed labels",
      "- R: turn the fence piece you're holding",
      "- 0-9: toolbar slots",
      "- Esc: close a window / put down a tool",
    ],
  },
];

let helpOpen = false;
let helpTopic = 0;

function openHelp(topic = helpTopic) {
  helpOpen = true;
  helpTopic = Math.max(0, Math.min(HELP_TOPICS.length - 1, topic));
}
function closeHelp() {
  helpOpen = false;
}
function isHelpOpen() {
  return helpOpen;
}

function getHelpLayout() {
  const w = Math.min(900, width - 40);
  const h = Math.min(580, height - 40);
  const x = Math.round(width / 2 - w / 2);
  const y = Math.round(height / 2 - h / 2);
  const tabs = HELP_TOPICS.map((t, i) => ({ x: x + 20, y: y + 62 + i * 33, w: 200, h: 28 }));
  return { x, y, w, h, tabs, close: { x: x + w - 150, y: y + h - 54, w: 130, h: 36 } };
}

function drawHelp(c) {
  if (!helpOpen) return;
  if (typeof ctx !== "undefined" && c !== ctx) return;
  const L = getHelpLayout();
  c.save();
  // Dimmed background and the panel (UIPanels.js)
  drawScreenPanel(c, L, { theme: "pink", dim: 0.5 });
  c.textBaseline = "alphabetic";
  c.textAlign = "left";
  c.fillStyle = "#ffd6f0";
  c.font = "bold 24px Arial";
  c.fillText("How it works", L.x + 24, L.y + 42);

  // Topics
  L.tabs.forEach((t, i) => {
    const on = i === helpTopic;
    c.fillStyle = on ? "rgba(255, 170, 220, 0.25)" : "rgba(255,255,255,0.05)";
    fillRoundRect(c, t.x, t.y, t.w, t.h, 8);
    c.fillStyle = on ? "white" : "rgba(255,255,255,0.75)";
    c.font = on ? "bold 15px Arial" : "15px Arial";
    c.fillText(HELP_TOPICS[i].title, t.x + 12, t.y + 20);
  });

  // Text
  const topic = HELP_TOPICS[helpTopic];
  const tx = L.x + 250;
  let y = L.y + 100;
  c.font = "bold 20px Arial";
  c.fillStyle = "#ffd6f0";
  c.fillText(topic.title, tx, L.y + 70);
  for (const line of topic.lines) {
    if (line === "") {
      y += 10;
      continue;
    }
    if (line.startsWith("# ")) {
      y += 4;
      c.font = "bold 15px Arial";
      c.fillStyle = "#f7d774";
      c.fillText(line.slice(2), tx, y);
    } else {
      c.font = "15px Arial";
      c.fillStyle = "rgba(255,255,255,0.9)";
      c.fillText(line, tx, y);
    }
    y += 22;
  }

  if (typeof drawGlassButton === "function")
    drawGlassButton(L.close.x, L.close.y, L.close.w, L.close.h, "Close", { fontSize: 16, borderRadius: 10 });
  c.restore();
}

// Mouse down (screen positions); swallows clicks while open
function handleHelpClick() {
  if (!helpOpen) return false;
  const L = getHelpLayout();
  const hit = (r) => isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h);
  if (hit(L.close) || !isPointInRect(mouse.x, mouse.y, L.x, L.y, L.w, L.h)) {
    closeHelp();
    return true;
  }
  L.tabs.forEach((t, i) => {
    if (hit(t)) helpTopic = i;
  });
  return true;
}

// Pop-up screen list (Screens.js)
registerScreen({
  name: "help",
  layer: 21,
  isOpen: () => helpOpen,
  close: () => closeHelp(),
  draw: (c) => drawHelp(c),
  click: () => handleHelpClick(),
});
