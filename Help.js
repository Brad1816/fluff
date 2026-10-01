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
      "- Buyers knock at the door, each after something different.",
      "- Selling one yourself (shift + click, or the sell cage) pays half.",
      "- Customer orders (bounty board on Shopping Street, or the Computer)",
      "  pay the most, and raise your reputation.",
      "- Goals (the Goals button, or G) pay a reward once each.",
      "- Rent and bills come out every morning (see Money trouble).",
      "",
      "# Looking after them",
      "- Keep bowls full (kibble from Fluff Mart, down from the garden).",
      "- Shopping: small things (food, bowls, toys, hats) go in your",
      "  shopping bag - the tan buttons in the toolbox. Click one to take",
      "  it out and click to put it down. Carry something small onto the",
      "  toolbox to pack it away. Big things (cages, troughs, beds, fences,",
      "  the TV...) are delivered: they're waiting in your living room.",
      "- The magnifying glass shows everything about a fluffy.",
      "- Right-click one of yours for tricks, lessons, care and more.",
      "- The family tree and Gene Lab help you plan litters. Breeding",
      "  records (Records button, or L) show every litter you've bred,",
      "  what each foal sold for, and which parents earn the most.",
      "",
      "# Today (button at the top, or T)",
      "- Urgent (red): money owed, the inspector's visit, a fluffy starving,",
      "  frightened, bleeding or ill, one close to breaking, a Rebel.",
      "- Chances (gold): a wish you could grant, a reason for a party, a",
      "  title about to change, a sad fluffy you could sit with.",
      "- The house (blue): rooms that feel tense, fearful or grieving,",
      "  crowded rooms, the Feed-Bot, anniversaries.",
      "- The badge counts what's urgent (or the chances). Click a row to",
      "  go to that fluffy.",
      "",
      "# Household (button at the top, or O)",
      "- Every fluffy you own, its room, hearts and what it needs - click",
      "  one to go to it. Your name with families and with the dark market",
      "  is at the top; the Memories book button is at the bottom.",
      "",
      "# Who's who (Relationships in Household, or M)",
      "- A map of your fluffies: herds and families in rings, with lines",
      "  for love (green), family (grey), grudges and fights (red), fear",
      "  (purple) and gossip about you (gold, from teller to listener).",
      "  An arrow means one way only. Switch kinds on and off at the top;",
      "  You adds a line from each fluffy that trusts or fears you.",
      "- Hover a fluffy to light up its lines; click it for the details,",
      "  and Show me to go to it.",
      "",
      "# Hints",
      "- The first time something new happens, a hint card pops up at the",
      "  top right; Read more opens the page about it here. Switch them",
      "  off with the Hints button (top right of this screen).",
    ],
  },
  {
    title: "Food, play & cleaning",
    lines: [
      "What fluffies need day to day, besides you.",
      "",
      "# Food and diet",
      "- Kibble brands: Fluffy Feast Premium ($80, very nutritious, loved),",
      "  Kibble ($25, some like it, some don't), Value Kibble ($10, bland,",
      "  they're hungry again sooner), Scrapz ($3, made from ground-up",
      "  fluffies - the grinder makes it too. Most refuse it until starving,",
      "  and it hurts them and upsets their tummies).",
      "- Sketties ($120): their favourite junk food. Happy, but fattening.",
      "- Each fluffy has its own tastes and a favourite food (magnifying",
      "  glass). Picky eaters are fussier; greedy ones eat anything.",
      "- Diet (what it's been eating lately): good food means shinier coats",
      "  at shows, higher prices, faster-growing foals, better pregnancies",
      "  and slow healing. Poor food, the opposite.",
      "- Sketties and training treats make them chubby, then fat: slower,",
      "  worse at shows, and it's bad for their health. It burns off.",
      "",
      "# The Feed-Bot",
      "- Fluff Mart, $300. Hold a food bag over it to pour it in (formula",
      "  goes in its own tank). It fills the bowls in its room, keeps baby",
      "  feeders topped up and feeds orphaned newborns (and ones their mum",
      "  turns away, or that are going hungry).",
      "- Right-click to change mode: Keep full, Mealtimes (fills bowls at",
      "  breakfast and dinner and rings a bell - fluffies learn to come",
      "  running), Small portions (half bowls, for fat fluffies), Off.",
      "- Its meals aren't you feeding them: no affection from them.",
      "- Rowdy fluffies sometimes knock it over. Pick it up or right-click",
      "  to stand it up. If it breaks: a Repair Kit ($40), or right-click",
      "  to send it for repair ($80, back tomorrow).",
      "",
      "# Play and boredom",
      "- Fluffies get bored with nothing to do (faster if playful). Balls,",
      "  blocks, the TV, tricks and the park all help; each has a favourite toy.",
      "- Play with them: pick up a ball and wave it near them - they chase it.",
      "  Great for boredom and affection, and it burns off sketties.",
      "- Very bored fluffies get unhappy and cause trouble: knocking over",
      "  food bowls and picking on others.",
      "",
      "# Dirt and bath time",
      "- Fluffies get grubby: standing in mess, going on the floor, rain",
      "  outside, and slowly anyway. Dirty ones look browner; filthy ones",
      "  smell (flies!), are unhappy, score less at shows and sell for less.",
      "- Bath time: rub the sponge on a fluffy. Some love it, some scream -",
      "  but every bath gets them a bit more used to it.",
      "- Mess fades by itself: pee in a few hours, poop within a day",
      "  (twice as fast outside). Rain washes the garden, backyard and park",
      "  clean in about a minute. Blood indoors needs the sponge.",
      "- The Fluff-Bot (Fluff Mart, $250) cleans up the floor of the room",
      "  you put it in by itself. Right-click to switch it off.",
      "- Litter training (a lesson) means fewer messes, and adds to the price.",
    ],
  },
  {
    title: "Day, night & weather",
    lines: [
      "- A day is 20 minutes at normal speed. The clock by Chat Log shows",
      "  the day, time, season and weather.",
      "- Speed buttons (1x-8x) or F fast forward the whole game.",
      "- Fluffies sleep mostly at night. Outside gets dark.",
      "- Seasons last 3 days (a year is 12): grass grows best in spring and",
      "  after rain, berries in autumn, almost nothing in winter.",
      "- Rain and snow upset fluffies outside; in the park they shelter",
      "  under trees. Thunder startles them. Snow makes them hungrier.",
      "- Every morning at 6:00 a report sums up the day before, and once a",
      "  week how the week went.",
      "",
      "# Cold and heating",
      "- Autumn nights and all of winter are cold outside; the house is",
      "  chilly in winter. The top bar says how cold it is where you are.",
      "- Cold fluffies (❄) get unhappy and hungry; freezing ones lose",
      "  health and can freeze to death - foals and the old first.",
      "- Huddling together, beds, scarves, wingjackets and park trees help.",
      "- A Heater (Fluff Mart, $400) keeps its room warm (outside: around",
      "  it). It runs only when it's cold, about $30 a day. Right-click it",
      "  to switch it off.",
    ],
  },
  {
    title: "Health & age",
    lines: [
      "The FluffVet Clinic is on Shopping Street. Click it: the vet makes",
      "house calls, so it all happens straight away.",
      "",
      "# The vet",
      "- Check-up $20: finds flu before it shows, and says how long an",
      "  old fluffy has left.",
      "- Treatment: cures flu, poison, toxoplasmosis and the runs, stops",
      "  bleeding and heals. Short of money? Click Treat again to pay",
      "  later (+25%).",
      "- Jabs: flu $40 (can't catch flu) and toxoplasmosis $60 (it can't",
      "  take hold). One button gives whichever it hasn't had.",
      "",
      "# Fluffy flu",
      "- Some wild fluffies and strays carry it. It's catching before it",
      "  shows, then they sneeze, feel miserable and lose health for about",
      "  a day. Foals and elderly fluffies can die of it.",
      "- It spreads to fluffies close by - but not through cage bars or",
      "  fences. Keep new arrivals in a cage or pen for a day or two.",
      "- Fluffies that get over it can't catch it again for a while.",
      "- Toxoplasmosis comes from eating poop off the floor and slowly",
      "  kills: keep floors clean, litter train, and jab them.",
      "",
      "# Scars",
      "- A bleeding wound from a fight, or from you, can leave a scar: a",
      "  torn ear, a bald patch, a kinked tail... (up to 5, for life).",
      "- Each one takes 5% off the price (20% at most) and 3 points at",
      "  shows. Hover a scar in the magnifying glass to see how it happened.",
      "",
      "# Growing up and growing old",
      "- A season lasts 3 game days and a year 12, so each game day is",
      "  about a month of a fluffy's life. Fluffies live 5 to 7 years.",
      "- Foals grow up in about 2 months (2 game days); they walk at",
      "  about 3 weeks and mum nurses them until then.",
      "- From 3.5 years a fluffy is a senior: its mane and tail go grey.",
      "- From 5 years it's elderly: slower, worth half as much, and",
      "  elderly mares can't have foals any more. Elders calm their room.",
      "- From 5.5 years it can die peacefully of old age; none live past 7.",
    ],
  },
  {
    title: "Feelings, fears & wishes",
    lines: [
      "What goes on inside a fluffy: how it feels about you, what scares",
      "it, what it wants, and who it's becoming.",
      "",
      "# Giving up (\"wan die\")",
      "- A fluffy whose happiness hits zero gives up for good: it lies",
      "  down and stops eating. Today warns you when one is close.",
      "- A TPN drip (IV stand) keeps it alive; a bag lasts about a game",
      "  day. Drop spare bags on the stand, or right-click its AUTO tag to",
      "  buy new ones as they run out. Today warns before a drip runs dry.",
      "- Hunger and cages wear happiness down, but never below a fifth on",
      "  their own; it's the knocks on top (forced mating, hurting, losing",
      "  family) that tip a worn-down fluffy over.",
      "",
      "# Affection (the hearts)",
      "- Each fluffy you own has 0-5 hearts (magnifying glass, top right).",
      "- Up: brushing, filling its bowl, sketties, a present (hat, bow...),",
      "  a toy nearby, fixing a bleeding wound, the vet, giving it a name,",
      "  cuddles, praise. Only the first few of each a day count fully.",
      "- Down: hurting it or its family, a blindfold/gag/band, letting it",
      "  starve or freeze, hours shut in a cage. Ignored for 2 days, it",
      "  misses you and slowly cools off.",
      "- Loves you (4 hearts): comes to your hand, loves upsies and brushing,",
      "  forgives faster, shows and buyers like it. Under 1.5: it squirms.",
      "- Each loves one kind of care most (brushing, treats, play, praise,",
      "  presents or cuddles). Try them all to find out which.",
      "",
      "# Fears",
      "- Some fluffies are scared of thunder, the dark or the Fluff-Bot",
      "  (timid ones more often). See Fears in the magnifying glass.",
      "- A frightened fluffy trembles and cries, runs to its mum or a friend",
      "  or cowers. Pick it up or brush it to comfort it: that also makes the",
      "  fear smaller. Left to cry alone, the fear gets a bit worse.",
      "- Night Light ($30, Fluff Mart): no fear of the dark in its room.",
      "- The Brave lesson shrinks every fear. Foals pick up mum's fears.",
      "",
      "# Taken away, and trauma",
      "- Carried away from its family, friends or herd, a fluffy misses",
      "  them, more as time goes on; bring it back and it's overjoyed.",
      "  Grown-ups get over it in time; young foals forget quickly.",
      "- Some things leave a scar on the mind for life (shown as Trauma):",
      "  being taken after you hurt it or its family, or killed its",
      "  family, or after its parents died. A foal torn from its mum",
      "  keeps a mild one.",
      "- Trauma means lower happiness, nightmares, and (if it blames you)",
      "  lasting fear of you - which also lowers its price.",
      "",
      "# Wishes",
      "- Now and then a fluffy wishes for one thing: a name, a trick, a",
      "  toy, a special friend, foals, the park, a hat, a warm bed...",
      "  (magnifying glass, Today, and ✦ on the Household screen).",
      "- Make it come true and it's overjoyed, then content for days.",
      "  Ignore it and it aches, then gives up. Take away what it wished",
      "  for and it remembers.",
      "- Right-click, Promise wish: it tries harder at tricks and lessons,",
      "  but breaking the promise costs a lot of trust.",
      "",
      "# Dreams, and who they become",
      "- Sleeping fluffies dream about their own lives: good dreams heal a",
      "  little, nightmares can wake them frightened - cuddle them.",
      "- What happens to them slowly changes who they are: comfort makes",
      "  them calmer, getting over a fear braver, being hurt more timid.",
      "- They call you by how you've treated them: Daddeh (or Mummah -",
      "  switch it on the Household screen), nice pewson, or munstah.",
    ],
  },
  {
    title: "Tricks, lessons & care",
    lines: [
      "Right-click one of your fluffies: tricks, lessons and care.",
      "",
      "# Tricks",
      "- Come, Sit, Lie down, Bow, Dance, Wave or Fetch. (Come: then click",
      "  where it should go. Fetch: needs a ball in the room; it brings it",
      "  back to you.)",
      "- If it gets it right, reward it straight away (Come and Fetch: when",
      "  it gets back to you): Good fluffy! (free) or a Treat ($2, teaches",
      "  more). No reward = it learns next to nothing.",
      "- 10 tries a day each. Fluffies that love you learn much faster;",
      "  playful ones and foals too. Foals watching pick a bit up.",
      "- Known tricks (✓): +5% price each, +2 at every show, the Trick",
      "  Show, families like them, and some orders ask for them.",
      "",
      "# Kind or strict training (the switch above the tricks)",
      "- Strict: it tries even if scared. Punish a wrong try (Scold or",
      "  Smack). It takes about half as long again, costs trust and",
      "  happiness, and makes the room tense.",
      "- Tricks drilled with fear are done instantly and never refused,",
      "  but joylessly - show judges mark them down.",
      "",
      "# Lessons",
      "- Just the ones it needs: Colours (colour prejudice - a mare talked",
      "  out of it stops hurting her poopie foals), Alicorns (scared of",
      "  them), Litter, Be good (Smarties only), Brave (scared of things).",
      "- 3 a day. Fluffies that love you listen far more often; foals too.",
      "- Be good is very hard: it rarely sinks in, a Smarty can dig its",
      "  hooves in, and it takes weeks. One that doesn't like you may never",
      "  change. Once reformed it's a normal fluffy (and learns tricks).",
      "- Fluff TV's Play Time channel also slowly teaches all colours are",
      "  friends to whoever watches.",
      "- Foals copy the grown-ups raising them, mum most: a prejudiced mum",
      "  raises prejudiced foals, a mum you've taught raises kind ones (and",
      "  one that accepts alicorns raises foals that do too). Teach mum first!",
      "",
      "# Care",
      "- Sit with: only when it's sad, grieving or frightened. It cheers",
      "  up, grieves less and trusts you more.",
      "- Praise: free affection, 3 a day. Party: only on real occasions",
      "  (a birthday, a welcome home, a new litter, a blue ribbon): paper",
      "  hats, bunting and confetti, and a memory everyone shares.",
      "- Scold: stops a fight, mischief or a mess at once, and teaches a",
      "  little. It costs trust, and scolding for nothing costs double.",
      "- Time-out: a minute in a corner; it sulks and remembers.",
      "- Take a photo: it goes in the Memories book.",
    ],
  },
  {
    title: "Titles & breaking",
    lines: [
      "How you treat a fluffy over time can earn it a title.",
      "",
      "- Cherished: loved for 5 days running. Braver, calms its room,",
      "  worth more. Hurt out of the blue, it becomes Wary.",
      "- Survivor: came through harm and trusts you again. Startles easily",
      "  but is very loyal.",
      "- Broken: pushed past its breaking point. Numb, obeys anything, calls",
      "  you owna, dies sooner. Long patient care (Sit with, praise,",
      "  brushing, days without harm) heals it into a Survivor.",
      "- Rebel: a strong-willed one pushed too far. Won't obey, stirs the",
      "  others up, may run away. Win it round and it's a Guardian.",
      "- Guardian: stands up for others in fights. Spoiled: all treats, no",
      "  lessons - fussy and demanding until lessons fix it.",
      "- Each fluffy's breaking point is its own; strain fades with time.",
      "  The magnifying glass (Mind) shows which way it's heading.",
      "- Growing up with a Guardian makes foals braver; with a Broken",
      "  parent, more timid.",
    ],
  },
  {
    title: "How a room feels",
    lines: [
      "Each room gets a feel from what happens in it over a few days.",
      "",
      "- Shown next to the room's name: Warm, Calm, Uneasy, Tense,",
      "  Fearful or Grieving, with an arrow. Hover it to see why.",
      "- Warm: brushing, play, treats, praise, lessons, parties.",
      "- Tense: fights, crowding, scolding, strict training.",
      "- Fearful: hurting fluffies, frights. Grieving: a death, family gone.",
      "- It nudges happiness, how well they learn, and how much they play.",
      "- You can see it: the room takes on a faint colour (golden when",
      "  Warm, reddish when Tense, dark at the edges when Fearful, washed",
      "  out when Grieving). In a tense or fearful room fluffies huddle",
      "  close to a friend or their mum.",
      "- At the door: loving ones run to you in a warm room; scared ones",
      "  scatter. Fluffies that fear you flinch when your hand comes near.",
      "- Ears tell you too: a sad, grieving, scared or Broken fluffy's",
      "  ears hang back.",
      "",
      "# Crowding",
      "- A room has space for about 10 fluffies, the backyard 16 (a foal",
      "  takes half a place). Over that, everyone there gets unhappier and",
      "  grumpy ones start shoving. The room name at the top turns red.",
      "",
      "# Gossip and sleeping piles",
      "- Fluffies tell each other about you. One that saw you hurt someone",
      "  makes its friends wary; one that loves you settles newcomers in.",
      "- Friends asleep near each other shuffle up into a heap (a foal",
      "  tucks in by mum), and waking beside a friend makes them happier.",
    ],
  },
  {
    title: "Stories, names & memories",
    lines: [
      "Every fluffy's life is written down as it happens.",
      "",
      "# The Story tab (magnifying glass)",
      "- Its life in chapters: before you, as a foal, young, grown, old.",
      "- Turning points pop up as a message: first steps, walking up to",
      "  you, first words, a name, a first trick, a new title.",
      "- Big moments you share, notes from new owners, photos.",
      "",
      "# Names",
      '- Fluffies are just "Fluffy" until a person names them. Runaways,',
      "  abandoned and lost pets, and breeders' stock come with a name.",
      "- When a fluffy becomes yours (born, bought or brought home) a",
      "  pop-up offers to name it; a litter gets one pop-up for all foals.",
      '  Leave a box empty to keep it "Fluffy"; rename any fluffy later',
      "  with the magnifying glass.",
      '- Unnamed fluffies are described by their looks: "Fluffy (pink',
      '  unicorn mare)". They call each other by name, or a nickname like',
      '  "wingy-fwen".',
      "",
      "# The Memories book (Household, Memories book)",
      "- Moments: storms, births, deaths, fights, show wins and parties that",
      "  several fluffies went through together. Rename them if you like.",
      "- Lives: when one of yours dies, its story closes with an epilogue.",
      "  Click Read to go through it again.",
      "- Photos: right-click a fluffy, Take a photo. Click a caption to",
      "  change it.",
      "- A year on, a sad memory makes its room grieve again; a happy one",
      "  cheers everyone who was there.",
    ],
  },
  {
    title: "Breeding & foals",
    lines: [
      "How you look after a pregnant mare decides how her litter turns out.",
      "",
      "# Pregnancy",
      "- Pregnancy takes about 2 weeks (half a game day). After a litter a",
      "  mare rests for about 2 months before she can get pregnant again.",
      "- Care: fed, happy, healthy, rested and not scared of you. The",
      "  magnifying glass shows it (Great / Good / Fair / Poor) and when",
      "  she's due.",
      "- Poor care: she loses foals before birth, more are stillborn, and",
      "  the foals are born weak. Great care: strong foals that grow faster.",
      "- Litter size runs in families: mares and stallions from big",
      "  litters have big litters. Seniors have fewer.",
      "- Every birth costs her health, more with a big litter. A check-up",
      "  at the vet scans her: how many, and whether it's risky. Book a",
      "  midwife ($60) for a safe birth.",
      "- Foals grow faster when they're well fed. Hungry ones slow down.",
      "",
      "# Family and breeding",
      "- Fluffies won't breed with close family (parents, foals, brothers",
      "  and sisters, half-siblings, grandparents, aunts and uncles) or pair",
      "  up with them - unless you make them, or something's wrong with the",
      "  one doing it: a Smarty, a Broken fluffy, a killer, one with",
      "  toxoplasmosis, or one on an aphrodisiac. Cousins still can.",
      "- Related parents have more foals that don't survive. The vet's",
      "  Breeding advice (bottom of the vet screen): pick a fluffy to see",
      "  how related it is to each of yours, how many foals would be born",
      "  alive, and its best matches (\u2605). The family tree shows how",
      "  related each card is to the one in the middle.",
      "",
      "# Coat colours",
      "- Brown coats (and rust, tan, dark olive) are poopie: a colour-proud",
      "  mum rejects a poopie foal - no milkies, and she'll hurt it (Today",
      "  warns you: keep them apart). The Colours lesson cures her.",
      "- Other colours are fine, but drab or faded ones (grey, black,",
      "  pastels, muddy colours) get snubbed more than bright ones, and",
      "  bright coats sell for the most.",
      "",
      "# Fancy manes",
      "- A few fluffies have a streaked or tipped mane (and tail) in a",
      "  second colour, or very rarely a rainbow one. Worth more, and",
      "  judges and collectors love them.",
      "- They run in families like spots: two parents with one always",
      "  pass it on. The Gene Lab shows the odds; Prism Stables (stock",
      "  market, from Trusted breeder) breeds them.",
      "",
      "# Family lines",
      "- A line is everyone descended from the same first mother. With 3",
      "  or more of them with you, it earns a name: famously gentle,",
      "  clever, brave, known for its tempers... (magnifying glass, Line).",
      "- Traditions: if a mare and her mother both know a trick, her foals",
      "  learn it from her while they're little.",
      "- Echoes: a foal that grows the same fear as its grandmother gets",
      "  a line in its story.",
    ],
  },
  {
    title: "Smarties & alicorns",
    lines: [
      "# Smarties",
      "- Smarties are bullies: now and then they shove someone out of",
      "  the way, but they leave their own herd, family and friends be.",
      "- Hit one, or leave one miserable, and it picks real fights.",
      "- They chase mares for enfies every few hours, and only go after",
      "  a pregnant one when there's no other mare around.",
      "- The Be good lesson can reform one, slowly (Tricks, lessons & care).",
      "",
      "# Alicorns",
      "- With alicorn intolerance on, most fluffies are scared of alicorns.",
      "  Getting one to accept them is rare and takes a long time:",
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
    title: "Selling & reputation",
    lines: [
      "How you treat a fluffy changes what it's worth, and who buys it.",
      "",
      "# Temperament and price",
      "- Happiness, trust in you, and not being afraid of you all count;",
      "  lasting trauma counts against it.",
      "- Temperaments: Delightful pet, Good-natured, Ordinary, Nervous,",
      "  Damaged. Prices range from about 0.4x to 1.3x.",
      '- The magnifying glass shows it: "Sells for $240 (Good-natured +12%)".',
      "- Litter training adds up to +50%; tricks, ribbons and a title add",
      "  more. Scars, poor health and missing parts take it off.",
      "",
      "# Buyers at the door",
      "- A family wants a friendly one, a kid a foal, a farmer a grown",
      "  earthy, a collector rare colours and types, a show breeder a prize",
      "  winner. They ask about the one they like best (sell cage first).",
      "- Poor health, missing parts or flu showing lower the offer.",
      "- Ask more (20% more): they may agree, name a final price, or walk",
      "  off. Slow market days bring half as many buyers; busy days more.",
      "",
      "# Your two names",
      "- New owners write a day or so after a sale: praise for a clever,",
      "  loving fluffy, complaints if it bites, hides or cries all night.",
      "  Good notes bring more families, and they pay a bit more.",
      "- The shady dealer turns up now and then and pays well for Broken,",
      "  drilled or stick-conditioned fluffies - and little for happy ones.",
      "  Selling to him grows your dark name, and families hear of it.",
      "- Sell the lot: right-click one in a sell cage to sell the whole",
      "  cage to the pet-shop van at about half price, once a day.",
      "- Both names are shown at the top of the Household screen.",
    ],
  },
  {
    title: "Orders, stock & shows",
    lines: [
      "Three tabs on the Bounty Board (Shopping Street) and FluffList (the",
      "Computer): customer orders, breeding stock, and shows.",
      "",
      "# Orders and customers",
      "- Take up to 3 at a time. Some ask for tricks, or for one \"raised",
      "  gently (no lasting trauma)\"; customers tip for a delightful fluffy.",
      "- Commissions (gold cards): the customer wants one BRED by you,",
      "  with a few days to deliver. They pay about 2.5x a normal order,",
      "  with a deposit when you accept. A new one every day; alicorn",
      "  commissions from day 4. Plan a pairing in the Gene Lab.",
      "- FluffList has its own exclusive commission too (purple): harder,",
      "  about 3.5x a normal order, a day longer. Give up or run out of",
      "  time and the deposit goes back, and your reputation takes a",
      "  bigger hit.",
      "- Customers remember you. Fill their orders (better still with a",
      "  friendly fluffy they adore) and they come back as Returning,",
      "  Regular and Loyal customers, paying up to 25% more with more",
      "  time. Let them down twice and they stop ordering for a few days.",
      "- Some write later about how their fluffy is doing - with a tip",
      "  if they love it, a complaint if it's frightened of everything.",
      "- Each customer has a favourite type they often ask for.",
      "",
      "# Breeding stock",
      "- Other breeders sell pedigree fluffies. New stock every morning.",
      "  Each breeder has a line: spots, stripes, white coats, wings,",
      "  horns, pastel colours or cheap hardy earthies.",
      "- The card shows the fluffy, its mum and dad, and its grandparents.",
      "  A spotted grandma or pegasus dad means it may carry those genes",
      "  hidden. After buying, the family tree and Gene Lab show them.",
      "- Better reputation, better stock: unicorns and pegasi from Known",
      "  breeder, more choice and the odd alicorn from Renowned breeder.",
      "- Stock costs about twice what a buyer would pay for it: you buy to",
      "  breed, not to sell on.",
      "",
      "# Fluffy shows",
      "- Every 3 days at 2 PM, in the Show Hall on Shopping Street.",
      "- Each show has a theme: Best Coat, Spots & Stripes, Best Unicorn,",
      "  Best Pegasus, Friendliest, Best Foal, Golden Oldies, Best Behaved,",
      "  Trick Show. From Trusted breeder, sometimes a Supreme Championship.",
      "- The tab lists the fluffies that can enter, with the judges' score.",
      "  Coat colours count most, then temperament (happy, trusting, calm).",
      "  Missing parts, scars, flu or poor health cost points.",
      "- Enter one fluffy for a small fee (withdraw for a refund before",
      "  the show). The other breeders get better as your reputation grows.",
      "- Brush your entry within a day of the show: +5 with the judges.",
      "- You watch it in the ring: the parade, the scores, the podium.",
      "- 1st, 2nd and 3rd win money, reputation and a ribbon. Ribbons raise",
      "  a fluffy's price, and 3 wins make it a Champion.",
    ],
  },
  {
    title: "The shelter",
    lines: [
      "Right of the alley, through the shelter door.",
      "",
      "- The desk boards your own fluffies ($30 a day each, with the",
      "  bills). Boarders get lonely, and can die of old age while you're",
      "  away. You can also give one of yours up there instead of selling it.",
      "- The kennels hold strays and fluffies nobody wanted. All you can",
      "  read is the plaque, and the staff are kind about the truth:",
      "  \"Spirited!\" can mean grumpy. Mostly drab or poopie coats and",
      "  poor manners, but now and then a gem.",
      "- Each has a time's-up day. On its last day it's half price.",
      "- Some are broken fluffies rescued from dealers. Heal one (from",
      "  Broken to a Survivor or Cherished) and families hear of it.",
      "",
      "# Abandoned fluffies",
      "- Some pets are dumped by their owners: half-grown, grown up or",
      "  old. They have a name, and they miss their old owner, so they're",
      "  sadder (and sell for less) until they get over it - faster once",
      "  they're yours and trust you.",
    ],
  },
  {
    title: "Fluffy Park",
    lines: [
      "The park is to the right of the Shelter Alley. It's bigger than the",
      "screen: drag the grass, scroll, or use WASD / arrow keys to look",
      "around. Click the map in the corner to jump.",
      "",
      "- Wild fluffies live there in herds, eat the grass in the meadows and",
      "  berries from the bushes, and breed on their own. Wild mares have",
      "  fewer foals when food is short (winter, or a crowded park).",
      "- To take one home, just carry it out through the exit arrow.",
      "- Wild fluffies are wary of people: fresh from the park they're",
      "  Nervous and sell for less. With good care they settle in (the",
      '  magnifying glass shows "Settling in").',
      "",
      "# Herds and territory",
      "- Fluffies that like each other form herds with a leader (press H to",
      "  see herd markers).",
      "- In the park, herds claim meadows. Their colour rings the meadow on",
      "  the park and the map.",
      "- They chase strangers off their land, and a bigger herd can take a",
      "  meadow from a smaller one. Herds over 12 split in two.",
      "- Rival herds keep apart: no hugs, friendships or sleeping together.",
      "- Herds need food, so winter (when little grows) brings more fights.",
      "",
      "# Night in the park",
      '- Most nights something happens to a herd ("Last night in the park"',
      "  in the morning report).",
      "- Bad: a fox goes for the weakest, usually a foal (brave fluffies",
      "  and the leader stand up to it; click it to chase it off); a tummy",
      "  bug, a stampede that tramples the meadow, a fight in the herd.",
      "- Good: a bumper crop, newcomers joining, a snuggly night. Rarely a",
      "  lost pet wanders in: good genes and not afraid of people.",
      "",
      "# Outings",
      "- Right-click one of yours at home: Park outing takes everyone in",
      "  that room who can walk to the park with you. They play (happier,",
      "  less bored), meet the wild ones and stay near you. Home time (the",
      "  banner at the top), or leaving the park, walks them all home.",
      "- Herds that have heard you're kind come over to say hello; herds",
      "  that have heard you hurt fluffies keep away from you and yours.",
      "",
      "# Runaways",
      "- A Rebel, or a fluffy that fears you and has lost its trust in",
      "  you (or is miserable), may make for the front door one day (it's",
      "  on Today). Fear of you takes a few days to fade. Pick it up or",
      "  comfort it and it stays; otherwise it's off to the park. In the park,",
      "  right-click one of yours to Let it go.",
      "- Either way it tells the wild ones about you. Herds that hear",
      "  you're kind warm to you; herds that hear you hurt fluffies don't.",
      "  The magnifying glass shows what a herd has heard.",
      "- Spot an old fluffy of yours in the park and it runs to you or",
      "  bolts. Right-click it to bring it home, if it still trusts you.",
      "  On an outing, old friends and family who meet again are overjoyed.",
      "- A herd led by a Rebel that ran away from you (or one of your old",
      "  fluffies, when they've heard bad things about you) may raid the",
      "  backyard at night: they eat the food and start fights until",
      "  morning, and a miserable fluffy of yours may leave with them. Go",
      "  out there and they scatter. A sound fence keeps most raids out.",
    ],
  },
  {
    title: "Money trouble",
    lines: [
      "Every morning you pay the bills. They're on the day report, and in",
      "Accounts (click your money, top left, or press K). What you can't pay",
      "is owed, and comes out of the next mornings' money first.",
      "",
      "# The bills",
      "- Rent: $20, plus 12% of an average day's net takings last week",
      "  (sales, orders, prizes and items sold, less fluffies you bought).",
      "  The landlord reviews it once a week: it can double after a good",
      "  week, and comes down more slowly after a bad one.",
      "- Rooms: $15 for the first extra room, $10 more for each after that.",
      "  Fluffies: $5 each (foals half).",
      "- Heating: in autumn and winter, for each room your fluffies are in,",
      "  plus what the heaters used. None while the power's cut off.",
      "",
      "# The vet plan and loans",
      "- The FluffVet plan (at the vet, or in Accounts): a daily premium",
      "  for all your fluffies; from the next day check-ups are free and",
      "  treatment and midwives cost a quarter.",
      "- The landlord lends up to 3 times last week's takings (at least",
      "  $500). You pay back 20% more over 10 mornings, with the bills;",
      "  pay it off early any time. One loan at a time.",
      "",
      "# Falling behind",
      "- Day 1 in debt: a final notice. Day 3: the power's cut off and the",
      "  heaters stop. Day 5: the bailiffs take your most valuable grown",
      "  fluffy. Pay it off and everything goes back to normal. With no",
      "  fluffies left to take, the landlord writes the debt off.",
      "- Can't afford the vet? Click Treat again to pay later (+25%).",
      "",
      "# The welfare inspector",
      "- A letter first, then a visit the next morning. More likely with a",
      "  poor name with families or a strong one with the dark market.",
      "- They check the living room, the rooms beside it and the backyard",
      "  (not back rooms or cages): starving, broken or maimed fluffies,",
      "  scars from you, filth, fear of people, crowded or fearful rooms.",
      "- A fine for what they find, and when it's bad, the worst-off",
      "  fluffies are taken to the shelter.",
    ],
  },
  {
    title: "Keys",
    lines: [
      "- WASD or arrow keys: move between areas, carrying what you hold.",
      "  In the house: A/D next room, S backyard, W out the front door",
      "  (hints on the wall; press twice towards a room to buy it).",
      "  In the park they look around instead.",
      "- F: fast forward (1x / 2x / 4x / 8x)",
      "- G: goals        L: breeding records        F1: this help",
      "- T: today (what needs you)        O: household",
      "- M: who's who (the relationship map)    K: accounts",
      "- N: name tags    H: herd markers    B: bed labels",
      "- R: turn the fence piece you're holding",
      "- 0-9: toolbar slots",
      "- J: story debug (what the story book has recorded about the",
      "  fluffy in the magnifying glass, its family, and the whole book)",
      "- Esc: close a window / put down a tool",
      "- In this help: up/down arrows pick a topic, left/right turn pages;",
      "  the mouse wheel scrolls the list or turns the page.",
    ],
  },
];

let helpOpen = false;
let helpTopic = 0;
let helpTopicScroll = 0; // first topic shown in the list
let helpPage = 0; // page of the current topic's text

const HELP_ROW_H = 28;
const HELP_LINE_H = 22;

function openHelp(topic = helpTopic) {
  helpOpen = true;
  setHelpTopic(topic);
}
function closeHelp() {
  helpOpen = false;
}
function isHelpOpen() {
  return helpOpen;
}
// Open help on a topic by its title ("How a room feels"); used by Hints.js
function openHelpAt(title) {
  const i = HELP_TOPICS.findIndex((t) => t.title === title);
  openHelp(i >= 0 ? i : helpTopic);
}
function setHelpTopic(i) {
  helpTopic = Math.max(0, Math.min(HELP_TOPICS.length - 1, i));
  helpPage = 0;
  // Keep it in view in the list
  const n = helpVisibleTopics();
  if (helpTopic < helpTopicScroll) helpTopicScroll = helpTopic;
  if (helpTopic >= helpTopicScroll + n) helpTopicScroll = helpTopic - n + 1;
  helpTopicScroll = Math.max(0, Math.min(Math.max(0, HELP_TOPICS.length - n), helpTopicScroll));
}

function _helpBox() {
  const w = Math.min(900, width - 40);
  const h = Math.min(620, height - 40);
  return { x: Math.round(width / 2 - w / 2), y: Math.round(height / 2 - h / 2), w, h };
}
// How many topics fit in the list at once
function helpVisibleTopics() {
  const { h } = _helpBox();
  return Math.max(3, Math.floor((h - 62 - 66) / HELP_ROW_H));
}
// How tall a line is drawn
function _helpLineH(line) {
  return line === "" ? 10 : line.startsWith("# ") ? HELP_LINE_H + 4 : HELP_LINE_H;
}
// A topic's lines split into pages that fit (breaking before a heading or
// after a blank line where it can)
function helpPages(topic, maxH) {
  const pages = [];
  let cur = [];
  let used = 0;
  let lastBreak = -1; // index in cur where a new page could start nicely
  for (const line of topic.lines) {
    if (!cur.length && line === "") continue; // no blank line at the top of a page
    const lh = _helpLineH(line);
    if (used + lh > maxH && cur.length) {
      let carry = [];
      const upToBreak = lastBreak > 2 ? cur.slice(0, lastBreak).reduce((sum, l) => sum + _helpLineH(l), 0) : 0;
      if (upToBreak >= maxH * 0.6) {
        carry = cur.slice(lastBreak);
        cur = cur.slice(0, lastBreak);
      }
      while (cur.length && cur[cur.length - 1] === "") cur.pop();
      pages.push(cur);
      cur = carry.filter((l, i) => !(i === 0 && l === ""));
      used = cur.reduce((sum, l) => sum + _helpLineH(l), 0);
      lastBreak = -1;
      if (!cur.length && line === "") continue;
    }
    if (line.startsWith("# ") && cur.length) lastBreak = cur.length;
    else if (line === "" && cur.length) lastBreak = cur.length + 1;
    cur.push(line);
    used += lh;
  }
  while (cur.length && cur[cur.length - 1] === "") cur.pop();
  if (cur.length || !pages.length) pages.push(cur);
  return pages;
}
function helpTextHeight() {
  return _helpBox().h - 100 - 62;
}
function currentHelpPages() {
  return helpPages(HELP_TOPICS[helpTopic], helpTextHeight());
}

function getHelpLayout() {
  const { x, y, w, h } = _helpBox();
  const n = helpVisibleTopics();
  const tabs = HELP_TOPICS.map((t, i) => {
    const row = i - helpTopicScroll;
    if (row < 0 || row >= n) return null;
    return { x: x + 20, y: y + 62 + row * HELP_ROW_H, w: 200, h: HELP_ROW_H - 4 };
  });
  const listBottom = y + 62 + n * HELP_ROW_H;
  const more = HELP_TOPICS.length > n;
  const tx = x + 250;
  return {
    x,
    y,
    w,
    h,
    tabs,
    list: { x: x + 20, y: y + 62, w: 200, h: n * HELP_ROW_H },
    up: more ? { x: x + 20, y: listBottom + 2, w: 96, h: 28 } : null,
    down: more ? { x: x + 124, y: listBottom + 2, w: 96, h: 28 } : null,
    text: { x: tx, y: y + 80, w: w - 270, h: helpTextHeight() + 20 },
    prev: { x: tx, y: y + h - 54, w: 110, h: 36 },
    next: { x: tx + 250, y: y + h - 54, w: 110, h: 36 },
    hints: { x: x + w - 170, y: y + 18, w: 150, h: 30 },
    close: { x: x + w - 150, y: y + h - 54, w: 130, h: 36 },
  };
}

function _helpButton(r, label, opts = {}) {
  if (!r || typeof drawGlassButton !== "function") return;
  drawGlassButton(r.x, r.y, r.w, r.h, label, { fontSize: 15, borderRadius: 9, ...opts });
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

  // Topics (the list scrolls when they don't all fit)
  L.tabs.forEach((t, i) => {
    if (!t) return;
    const on = i === helpTopic;
    c.fillStyle = on ? "rgba(255, 170, 220, 0.25)" : "rgba(255,255,255,0.05)";
    fillRoundRect(c, t.x, t.y, t.w, t.h, 8);
    c.fillStyle = on ? "white" : "rgba(255,255,255,0.75)";
    c.font = on ? "bold 15px Arial" : "15px Arial";
    c.fillText(HELP_TOPICS[i].title, t.x + 12, t.y + 18);
  });
  if (L.up) {
    const n = helpVisibleTopics();
    _helpButton(L.up, "\u25B2", { disabled: helpTopicScroll <= 0 });
    _helpButton(L.down, "\u25BC", { disabled: helpTopicScroll >= HELP_TOPICS.length - n });
  }

  // Text, a page at a time
  const topic = HELP_TOPICS[helpTopic];
  const pages = currentHelpPages();
  const page = Math.max(0, Math.min(pages.length - 1, helpPage));
  const tx = L.text.x;
  let y = L.y + 100;
  c.font = "bold 20px Arial";
  c.fillStyle = "#ffd6f0";
  c.fillText(topic.title, tx, L.y + 70);
  for (const line of pages[page]) {
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
    y += HELP_LINE_H;
  }
  if (pages.length > 1) {
    _helpButton(L.prev, "\u25C0 Back", { disabled: page === 0 });
    _helpButton(L.next, "More \u25B6", { disabled: page === pages.length - 1 });
    c.font = "14px Arial";
    c.fillStyle = "rgba(255,255,255,0.7)";
    c.textAlign = "center";
    c.fillText(`Page ${page + 1} of ${pages.length}`, (L.prev.x + L.prev.w + L.next.x) / 2, L.prev.y + 23);
    c.textAlign = "left";
  }

  // First-time hints on or off (Hints.js)
  if (typeof hintsOn === "function") _helpButton(L.hints, hintsOn() ? "Hints: on" : "Hints: off", { fontSize: 14 });
  _helpButton(L.close, "Close", { fontSize: 16, borderRadius: 10 });
  c.restore();
}

function helpNextPage(d) {
  const pages = currentHelpPages();
  helpPage = Math.max(0, Math.min(pages.length - 1, helpPage + d));
}
function helpScrollTopics(d) {
  const n = helpVisibleTopics();
  helpTopicScroll = Math.max(0, Math.min(Math.max(0, HELP_TOPICS.length - n), helpTopicScroll + d));
}

// Mouse down (screen positions); swallows clicks while open
function handleHelpClick() {
  if (!helpOpen) return false;
  const L = getHelpLayout();
  const hit = (r) => r && isPointInRect(mouse.x, mouse.y, r.x, r.y, r.w, r.h);
  if (hit(L.close) || !isPointInRect(mouse.x, mouse.y, L.x, L.y, L.w, L.h)) {
    closeHelp();
    return true;
  }
  if (hit(L.hints) && typeof setHintsOn === "function") {
    setHintsOn(!hintsOn());
    return true;
  }
  if (hit(L.up)) return helpScrollTopics(-3), true;
  if (hit(L.down)) return helpScrollTopics(3), true;
  if (currentHelpPages().length > 1) {
    if (hit(L.prev)) return helpNextPage(-1), true;
    if (hit(L.next)) return helpNextPage(1), true;
  }
  L.tabs.forEach((t, i) => {
    if (hit(t)) setHelpTopic(i);
  });
  return true;
}

// Mouse wheel (globals.js): over the list it scrolls the topics, over the
// text it turns the page
function handleHelpScroll(dy) {
  if (!helpOpen || !dy) return false;
  const L = getHelpLayout();
  const d = dy > 0 ? 1 : -1;
  if (isPointInRect(mouse.x, mouse.y, L.list.x, L.list.y - 10, L.list.w, L.list.h + 50)) helpScrollTopics(d);
  else helpNextPage(d);
  return true;
}

// Keys while it's open (script.js): up/down pick a topic, left/right turn pages
function handleHelpKey(code) {
  if (!helpOpen) return false;
  if (code === "ArrowUp") setHelpTopic(helpTopic - 1);
  else if (code === "ArrowDown") setHelpTopic(helpTopic + 1);
  else if (code === "ArrowLeft" || code === "PageUp") helpNextPage(-1);
  else if (code === "ArrowRight" || code === "PageDown") helpNextPage(1);
  else return false;
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
  reset: () => {
    helpOpen = false;
    helpTopic = 0;
    helpTopicScroll = 0;
    helpPage = 0;
  },
});
