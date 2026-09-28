const DIALOGUE = {
  APHRODISIAC: [
    "REEEEEE!!!! NU-NU STICK HUWTIES!!!!!!",
    "NEE ENFIES NAO!!!!!!",
    "NEE GUD FEEWS!!!!!!!!!!!",
  ],
  // Idle chatter
  CHIRP: ["*chirp chirp*"],
  HELLO: {
    DEFAULT: {
      // Talk to self
      FERAL_CHIRPY: ["Peep", "Cheep", "Peep peep"],
      FERAL: [
        "<Speaker> gon' get nyu daddeh soon!",
        "<Speaker> nu wike dis pwace... gib housie?",
        "Hab suu many ouchies.. pwease wet fwuffies in nice housie?",
      ],
    },

    // Talk to relationship
    FATHER: [
      "Hewwo daddeh!",
      "Daddeh wan pway?",
      "<Speaker> wub daddeh!",
      "Daddeh! Daddeh! Wook at <speaker>!!",
      "Wub u' daddeh! Gib toysies?",
      "Wan' wotsa nummies!!",
      "<Speaker> do bestest dancie fo' daddeh?",
      "Hab tawkies wif daddeh!",
      "Daddeh! Daddeh! Am <speaker> bestest fwuffy?",
      "Hab nu' toysie fo' <speaker> daddeh?",
    ],
    MOTHER: [
      "Hewwo mummah!",
      "Wub mummah!",
      "<Speaker> wub mummah foweba!",
      "Mummah wan pway wif' <speaker>?",
      "Gib <speaker> bestest huggies, mummah!",
    ],
    BROTHER: [
      "Hewwo <target>!",
      "Wan pway wit <speaker>, bwudda?",
      "Bwudda gon hab big hewd an' be stwong fwuffy!",
      "Bwudda am bestest bwudda!",
    ],
    SISTER: [
      "Hewwo <target>!",
      "Wan go 'splore, <target>??",
      "<Target> am <speaker>'s fabowite fwuffy!",
      "<Target>, wan pway wawkies?",
    ],
    FRIEND: [
      "Hewwo fwen!",
      "<Speaker> wub fwen!",
      "Wan' pway fwen?",
      "Fwen!!",
      "Wub yu fwen!",
      "Fwen gib <speaker> heawt happies!",
      "Wut am doin', fwen?",
      "Fwen' wan pway gamesie?",
      "Fwen! Fwen! Wan' see <speaker> dancies?",
    ],
    SPECIAL_FRIEND: [
      "Hewwo speshow fwen!",
      "Wub speshow fwend!",
      "Wan be wif' yu' foweba speshow fwend!",
    ],
    REJECTED_BABY: ["Dummeh babbeh gu way!"],
    BABY: {
      MOTHER: ["Mummah wubs <target>, <target> wubs mummah..."],
      FATHER: ["Hewwo babbeh, am yu' daddeh"],
    },
    TUMMY_BABIES: {
      MOTHER: [
        "Mummah wubs babbehs, babbehs wub mummah...",
        "Wub widdwe tummeh babbehs...",
        "Tummeh babbehs gwow big and stwong...",
        "Cooo.. can feew babbehs pway in tummeh..",
        "Gon be best mummah fow' yu babbehs...",
        "Gon hab skettis an' toysies and suu many fwends fo' yu babbehs..",
        "Am soon mummah...",
        "Gon hab suuu many babbehs!",
        "Babbehs gon hab biggest heawt happies when see mummah!",
        "Mummah gun wub babbehs an' babbehs gun' gwow up an' be pwettiest fwuffies ebah! Make suu many heawy happies!",
      ],
    },
    PLAYER: {
      DEFAULT: [
        "Hewwo nice mistah! Be nyu daddeh?",
        "<Speaker> nee' nyu daddeh, nice mistah!",
        "Pwease nice mistah! Wan wawm housie!",
        "<Speaker> wub you, nice mistah! Can stay wif' nice mistah?",
        "<Speaker> su scawdies.. pwease gib nice homesie nice mistah!",
        "Hab homsie fo' <speaker>?",
      ],
      SMARTY: [
        "DUMMEH HOOMIN! GIB HOUSIE NAO!",
        "STOOPI HOOMIN! GIB ENFIES AND TOYSIES AND SKETTIES NAO!!!",
        "GIB SMAWTY HOUSIE!! OW SMAWTY GIB SOWWY HOOFSIES!!",
      ],
      CHIRPY: ["Chearp!", "Chirp! Coo..."],
    },
  },

  // Herds (Herds.js)
  HERD: {
    NEW_HERD: [
      "Aww fwens stay togedda! Am hewd nao!",
      "<Speaker> wiww be bestest hewd weadew!",
      "Nyu hewd! Fowwow <speaker>!",
    ],
    JOIN: [
      "<Speaker> am pawt ob <target>'s hewd nao!",
      "Nyu hewd! Nyu famiwy!",
      "<Speaker> fowwow <target>!",
    ],
    NEW_LEADER: [
      "<Speaker> am hewd weadew nao!",
      "Fowwow <speaker>, hewd!",
      "<Speaker> wiww take cawe ob hewd...",
    ],
    LEFT: [
      "<Speaker> nu wan be in dummeh hewd!",
      "Nu wike <target>! <Speaker> go 'way!",
      "<Speaker> find nyu hewd...",
    ],
    FOLLOW: [
      "Wait fow <speaker>!",
      "Hewd go dat way!",
      "<Target>! Wait!",
    ],
    STRANGER: [
      "Nu am <speaker>'s hewd! Go 'way!",
      "Who dat? Nu pawt ob hewd!",
      "Stwangew fwuffy! Stay back!",
    ],
  },
  // Taken away from herd / family (Separation.js)
  SEPARATION: {
    TAKEN: [
      "NU! Nu take fwuffy 'way fwom <target>!",
      "<TARGET>! HEWP! Nu wan go!",
      "Pwease! Fwuffy nee' hewd! Put fwuffy back!",
    ],
    TAKEN_FOAL: [
      "MUMMAH! MUMMAH! SCREEEE!",
      "Nu! Wan mummah! Wan mummah!!",
      "*chirp* *CHIRP* MUMMAH!!",
    ],
    LEFT_BEHIND: [
      "Nu! Bwing back <target>!",
      "Wai take <target>?! Meanie!",
      "<TARGET>! Come back!",
    ],
    MISS: [
      "Wan go home... miss hewd...",
      "Whewe am famiwy? Fwuffy aww awone...",
      "Fwuffy miss fwends so much...",
    ],
    MISS_FOAL: [
      "Mummah? Whewe am mummah?",
      "Wan mummah... wan miwkies...",
      "*sniff* mummah...",
    ],
    NIGHTMARE: [
      "*whimper* nu... nu take fwuffy...",
      "MUMMAH! ...*sniff* bad dweamies...",
      "Nu huwt famiwy! NU! ...*sob*",
    ],
    REUNITED: [
      "<TARGET>! Fwuffy back! Bestest day!",
      "Huggies! Nebah weave 'gain!",
      "Famiwy togedda 'gain! Happies!",
    ],
  },
  // Day, night and weather (WorldTime.js)
  WEATHER: {
    RAIN: [
      "Wain! Wain am scawy! Nu wike wettsies!",
      "Wettsies aww obew fwuffy! Nee' hidey pwace!",
      "Why sky make wawa? Fwuffy nu wike!",
    ],
    THUNDER: [
      "EEEEEK! Woud sky nu huwt fwuffy!",
      "Sky am angwy! Hewp!",
      "Big boomies! Fwuffy scawed!",
    ],
    SNOW: [
      "Cowd sky fwuffs! Fwuffy so cowd...",
      "Nee' wawmies... nee' huggies...",
      "White stuffs am cowd on hoofsies!",
    ],
    SUNNY: [
      "Sunnies am wawm! Bestest day!",
      "Fwuffy wub sunnies!",
    ],
    NIGHT: [
      "Dawk am scawy... wan mummah...",
      "Nite-nite time...",
    ],
  },
  // Fluffy flu (Illness.js)
  ILLNESS: {
    FLU: [
      "*ACHOO!* ...*sniffle*",
      "Nosie am all dwippy... *achoo*",
      "<Speaker> feew aww hot an' cowd... *cough cough*",
      "*sniff* Huu... tummeh an' head am huwties...",
      "*ACHOO!* *ACHOO!* Nu wike sneezies!",
    ],
  },
  // Abandoned fluffies missing their old owner (Abandoned.js)
  ABANDONED: {
    MISS: [
      "Whewe owd daddeh go? Daddeh come back fow <speaker>?",
      "Daddeh... <speaker> be gud nao... pwease come back...",
      "Why daddeh weave <speaker> outsides? <Speaker> nu undewstan'...",
      "Mebbe owd daddeh just fowget... mebbe come back tomowow...",
    ],
    OVER_IT: [
      "<Speaker> nu sad 'bout owd daddeh nu mowe. Hab nyu home!",
      "Owd daddeh gone... but <speaker> am otay nao!",
      "<Speaker> am happy hewe! Bestest home!",
    ],
  },
  // Getting used to alicorns (AlicornAcceptance.js)
  ALICORN_ACCEPT: {
    DEFAULT: [
      "Munstah nu am munstah... am jus' fwuffy!",
      "<Speaker> nu scawed of wingie-hown fwuffy nao!",
      "Wingie-hown fwen am nice! Can hab huggies?",
    ],
    INTRO: [
      "Hewwo... munstah? Nu num <speaker>?",
      "Daddeh howd <speaker>... <speaker> bwave...",
      "Munstah... nu am scawy wen daddeh hewe...",
    ],
  },
  // A fox in the park at night (NightEvents.js)
  PREDATOR: {
    FLEE: [
      "EEEEEK!! MUNSTAH!! WUN WAY!!",
      "SCAWY WED MUNSTAH!! HEWP!!",
      "NU NUM FWUFFY!! NUUUU!!",
      "Mummah!! Big munstah in da dawk!!",
    ],
    DEFEND: [
      "GU 'WAY MUNSTAH!! Nu huwt hewd!!",
      "<Speaker> am bwave! Nu scawed of yu!",
      "Weave babbehs awone, dummeh munstah!!",
    ],
    CAUGHT: [
      "EEEEEEEEK!!! HEWP!! HEWP <SPEAKER>!!",
      "MUMMAH!!! MUNSTAH GOT <SPEAKER>!!",
      "NUUUU!! NU NUM!! PWEASE!!",
    ],
    CHASED_OFF: [
      "An' STAY 'way!! Hewd am safe!",
      "Munstah wun 'way! <Speaker> am hewo!",
      "Ow... but munstah gone! Hewd safe nao!",
    ],
  },
  // Other night events in the park (NightEvents.js)
  NIGHT: {
    SICK: [
      "Tummeh huwties... nu feew gud...",
      "<Speaker> feew aww icky...",
      "Why tummeh make bad poopies...",
    ],
    COLD: [
      "Su cowd... nee' huggies...",
      "Nu can feew hoofsies... su cowd...",
      "Wawmies pwease... anybody...",
    ],
    STAMPEDE: [
      "WUN!! WUN!! SUMFING IN DA DAWK!!",
      "EEEK!! Evewybody wun!!",
      "Nu know why wun but WUNNING!!",
    ],
    QUARREL: [
      "<Target> am dummeh!! <Speaker> nu fwiend nao!",
      "Dat <speaker>'s sweepy pwace, <target>!!",
      "Gu 'way, meanie <target>!",
    ],
    NEWCOMER: [
      "Hewwo... can <speaker> stay wif nyu fwiends?",
      "Nyu hewd! <Speaker> nu awone nao!",
      "Pwease be fwiends? <Speaker> am wost...",
    ],
    LOST_PET: [
      "Whewe am housie? <Speaker> want daddeh...",
      "Hewwo? Daddeh? <Speaker> wost...",
      "Big outside am scawy... wan housie...",
    ],
  },
  // Herds and their meadows in Fluffy Park (Territory.js)
  TERRITORY: {
    CLAIM: [
      "Dis am hewd's nummy gwass pwace nao!",
      "<Speaker> find bestest meadow! Hewd wiww wiv hewe!",
      "Aww gwassies hewe am fow <speaker>'s hewd!",
    ],
    CHASE: [
      "GO 'WAY! Dis <speaker>'s hewd's gwassies!",
      "Nu takie ouw nummies, <target>!",
      "Shoo! Shoo! Nu am yu meadow!",
    ],
    LEAVE: [
      "Sowwy! Sowwy! <Speaker> go!",
      "Nu hit <speaker>! Weaving!",
      "Scawy fwuffy! Wun!",
    ],
    WON: [
      "Dis am ouw meadow nao! Hewd am bestest!",
      "Nummy gwassies aww fow <speaker>'s hewd!",
      "Dummeh hewd wun 'way! <Speaker> win!",
    ],
    LOST: [
      "Nu! Hewd's gwassies...",
      "Hewd hab tu find nyu home...",
      "Big meanie hewd took nummy meadow!",
    ],
  },
  // Bonds and grudges between fluffies (Bonds.js)
  BOND: {
    NEW_BUDDY: [
      "<Target> am <speaker>'s bestest fwen nao!",
      "<Speaker> an' <target> am bestest fwens foweba!",
      "Wub <target>! Awways pway togedda!",
    ],
    DEFEND: [
      "NU HUWT <TARGET>! <SPEAKER> PWOTECT!",
      "Weave <target> awone, meanie!",
      "<Speaker> hewp <target>!",
    ],
    GRUMBLE: [
      "Hmph... <target> am meanie fwuffy.",
      "Nu wike <target>... go 'way.",
      "<Speaker> nu fowget wat <target> did...",
    ],
    REFUSE: [
      "Nu! Nu wan be fwens wif <target>!",
      "<Target> am meanie! Nu fwens!",
      "Go 'way <target>!",
    ],
  },
  // Memory and trust (Memory.js)
  TRUST: {
    FLEE: [
      "Nu! Nu hand! Pwease nu huwt <speaker>!",
      "Scawy hand! Wun!",
      "<Speaker> sowwy! <Speaker> sowwy!",
    ],
    SEEK: [
      "Daddeh! Daddeh! Hewwo!",
      "<Speaker> wub daddeh! Gib pettie?",
      "Daddeh hewe! Yay!",
    ],
    UPSIES_SCARED: [
      "NUUU! Pwease nu hab huwties!",
      "S-sowwy daddeh! Pwease nu!",
      "Pwease be nice to <speaker>...",
    ],
    UPSIES_HAPPY: [
      "Upsies! <Speaker> wub upsies!",
      "Wub daddeh! Bestest huggies!",
      "Wheee! Upsies!",
    ],
  },
  // Personality traits (Traits.js). Said now and then while babbling.
  TRAIT: {
    BRAVE: [
      "Nu scawed! <Speaker> am bwavest fwuffy!",
      "Munstahs nu scawe <speaker>!",
      "<Speaker> wiww pwotect aww da fwens!",
    ],
    TIMID: [
      "F-fwuffy scawed...",
      "Pwease nu be woud...",
      "Wan hide... hab scawies...",
    ],
    SOCIAL: [
      "Wan pway wif aww da fwens!",
      "<Speaker> wub make nyu fwens!",
      "Hewwo! Wanna be fwens?",
    ],
    LONER: [
      "<Speaker> wike quiet time...",
      "Wan be awone fow wittwe bit...",
      "Nu need fwens... am otay.",
    ],
    GREEDY: [
      "Wan MOAW nummies!",
      "Nummies am bestest! Gib moaw!",
      "Tummy stiww hab woom fow nummies...",
    ],
    PICKY: [
      "Nu wike dese nummies...",
      "<Speaker> onwy wan speshuw nummies.",
      "Nu hungwy... maybe wattew.",
    ],
    PLAYFUL: [
      "Wan pway! Wan pway!",
      "Chase da baww! Chase da baww!",
      "Pway wif <speaker>?",
    ],
    LAZY: [
      "<Speaker> tiwed... wan sweepies...",
      "Nu wan wawk... too faw...",
      "Otay wif jus' sittin'...",
    ],
    GRUMPY: [
      "Hmph! Weave <speaker> awone!",
      "Nu touch! Am gwumpy!",
      "Dummeh noisy fwuffies...",
    ],
    GENTLE: [
      "<Speaker> wub evewyone!",
      "Gib huggies?",
      "Be nice to fwens, otay?",
    ],
  },
  PERSONALITY: {
    TRUE_FERAL: [
      "Wub homesie... <speaker> nu wike meanie outsidies...",
      "<Speaker> hab suu many huwties fwom outsidies..",
      "Nu wike outsidies... hab suu many meanie munstahs...",
      "<Speaker> mummah gib bwudda foweba sweepies... nu nuff' nummies fow aww da babbehs..",
    ],
    LOST_HERD: [
      "How time tiww owd hewd comes backsies?",
      "Meanie hoomins make owd hewd gu way fwum <speaker>...",
      "Daddeh fin' <speaker> owd hewd?? Nee' fin fwens!",
    ],
    RUNAWAY: [
      "Wub nyu daddeh... hate owd daddeh...",
      "Owd daddeh make <speaker> num yuckie buwnies...",
      "Wub yu nyu daddeh! Owd daddeh am take <speaker> fwuff and make <speaker> sweep outsidies...",
      "Nyu daddeh am bestest daddeh!",
      "Owd daddeh nu wub <speaker>... gib fwend foweba sweepies.. wub nyu daddeh",
    ],
    SMARTY: [
      "DUMMEH DADDEH! GIB SKETTIES!",
      "DUMMEH DADDEH! WAN ENFIE MAWE NAO!",
      "GIB SKETTIES GIB SKETTIES GIB SKETTIES!!!",
      "WAN ENFIES NAO!!!",
      "GIB GIB GIB GIB GIB!!! NAOW!!!",
    ],
    MILL_ESCAPE: [
      "Nyu homesie su much bettah than wowstest babbeh pwace...",
      "Nu wike owd pwace... udda fwuffies gib wowstest huwties..",
    ],
    MILL_BABY: [
      "Nyu homesie su much bettah than wowstest babbeh pwace...",
      "Nu wike owd pwace... udda fwuffies gib wowstest huwties..",
    ],
    ABANDONED_BABY: [
      "Mummah? Whewe mummah?",
      "Whewe <speaker> mummah? Nee' huggies...",
      "Mummah fowget <speaker>?? Whewe am mummah?",
    ],
    // Dumped by an owner when older (Abandoned.js)
    ABANDONED: [
      "Owd daddeh say <speaker> am too much... nu wan <speaker> nu mowe...",
      "Nyu daddeh nu weave <speaker> in box? Pwomise?",
      "<Speaker> twy be gud fwuffy fow owd daddeh... nu enuff...",
      "Nyu daddeh keep <speaker> foweba?",
    ],
  },

  HUG: {
    DEFAULT: [
      "Huggies! Yay!",
      "Huggies!",
      "Wub huggies!",
      "Cooo... wub huggies..",
      "Huggie <speaker>!!",
      "Cooo... suu wawmsies..",
      "<Speaker> huggies!",
      "Gib huggies!",
      "Cooo...",
      "Huggies gib bestest heawt happies...",
      "Awways gib huggies... make it aww bettah..",
      "Huggies make happies awways!!",
      "Nuffin gon' make <speaker> hab saddies ebah 'gain!",
      "Bestest huggies fow <speaker>!",
      "Wub huggies suuu much!!",
      "Coo wub coo...",
    ],
    SAD: [
      "HUUUHUUU!!!",
      "Huuu.... wub huggies...",
      "Huuhuuhuu... wub fwen...",
      "Huggies make huwties guu way...",
      "Huggies awways make heawt huwties gu way...",
      "Huu huu huuu... nee' huggies fo' heawt huwties..",
      "Wub fwen... hab wowstest heawt huwties...",
      "Fwen' huggies gon make it aww bettah?",
      "HUU HUUUU.... Nu wan huwties nu mowe...",
      "Huggies wiww take 'way heawt huwties?",
      "Nee' huggies gib happies back tu <speaker>... huu huu..",
      "Huggies an' wub.... Huggies an' wub...",
      "F-fwuffies awe fowe huggies an' wub... huu huu... wub huggies..",
    ],
  },

  DROWNING: {
    DEFAULT: [
      "NUUUUUUUUUUU!!!",
      "SCREEEEE!!!!!",
      "WAWA!!! WAWA BAD!!!",
      "PWEASE SABE <SPEAKER>!!!",
      "NU WAN DIE!!!",
      "EEEEEEEEEE NUUUUUU!!!",
    ],
    CHIRPY: [
      "EEEEEEEEEEEE!!!!",
      "CHEEEEEEEEEEEEEEPPPPPP!!!",
      "PIPIPIPIPIPIPIPIPIPIPIPI!",
    ],
  },

  // Missing
  LOST: {
    BABY: [
      "Babbeh? Whewe awe you?\nCom' back tu mummah!",
      "Babbeh? BABBEH?",
      "Nee' fin' babbeh!",
      "HUU HUUU... <SPEAKER> NEE' YU BABBEH!! COM' BACK TU MUMMAH!!",
      "B-b-babbeh a-am jus' make hidies!! G-gon' fin' yu babbeh!!",
      "Nu mowe pway time babbeh! Come back tu mummah!",
      "Nu can wib widdout wittle babbeh! Com back tu mummah wite nao!!",
      "Babbeh nu can gu' way, mummah wub babbeh...Huuu huuu..",
    ],
    MOTHER: {
      DEFAULT: [
        "Whewe mummah?",
        "Wai mummah gone? Am bad babbeh?",
        "Nu wike dis game mummah!",
        "Mummah?? <Speaker> hab nu dancie fow' yu!! Come tu <speaker>!!",
        "Nee' huggies an' wub, mummah!!",
        "Mummah, pwease com' back!! <Speaker> hab suu many scawdies!!",
        "Huuu huuu... com' back mummah!!",
        "Pwease com' back mummah! <Speaker> wiww be gud babbeh!! Nu mowe poopies eba!!",
        "Mummah nu wub <speaker>?? Com' back mummah!!",
        "<Speaker> see suu many nummies mummah!! Com' back tu <speaker>!!",
        "Mummah weave <speaker> tu get nummies fo' <speaker>?",
        "<Speaker> hab bestest nummies fow' yu tu make miwkies mummah!",
        "Huu huu huuu.... wan mummah back... wewe mummah...",
        "Mummah, <speaker> wiww' do dancies if yu com' back!",
      ],
      CHIRPY: ["Peep! peep!", "Pipipipipipi!", "Cheepcheep! Cheeeep!"],
      PERMANENT: [
        "Nu can wemembah mummah... am awone nao...",
        "Mummah hate <speaker>.. <speaker> wub mummah.. huu huu huu...",
        "<Speaker>... am dummeh??? Mummah nu wan?",
      ],
      PERMANENT_CHIRPY: [
        "Speep...",
        "P-p-peep... speep...?",
        "P-p-peep.. speepeep... *chirp*",
      ],
    },
    SPECIAL_FRIEND: {
      DEFAULT: [
        "Huu huu speshow fwen... wai gu 'way?",
        "Speshow fwen?? SPESHOW FWEN'??!!",
        "Speshow fwend?? Nuuuu huuu huu....",
        "NUUUUU HUUU HUUU!!! SPESHOW FWEND!!!",
        "B-bu' <speaker> nee' speshow fwend!! Wai gu way?? HUU HUU!!!",
      ],
      PERMANENT: [
        "Huuhuu... <speaker> awways wemembah 'ou speshow fwen...",
        "Huu huu... <speaker> wemembah pway wit speshow fwend...*Sniff*",
      ],
    },
    BROTHER: [
      "Whewe <target>?",
      "<Target>?? Com' pway wif <speaker>!!",
      "Bwudda nu wub <speaker> nu mowe??",
      "Huuu huuu huuu.. nu wike dis game bwudda!!",
      "Bwudda pway hidies wif' <speaker>?",
      "<Target>, pwease com' back... hab heawt huwties..",
      "<Target>?? <TARGET>???",
      "Whewe awe' yu' bwudda? Nee' huggies!",
    ],
    SISTER: [
      "Whewe <target>?",
      "<Target> nu wan pway nu mowe??",
      "<Speaker> wub yu' <target>!! Pwease com' back!!... Huu huu huuu...",
      "<Target>! Pwease nu be foweba sweepies!!!",
      "<Target> gone??",
      "Pwease com' back <target>.. hab wowstest heawt huwties..",
      "<Target>!!! Am suu sowwy fo' meanies!! pwease com' back!",
    ],
  },

  // Bowl eating
  EAT: {
    NUMMIES: {
      DEFAULT: [
        "Nummies! Wub daddeh! *crunch*",
        "*Munch*...*crunch*...",
        "Fank yu' fow nummies daddeh!",
        "*munch munch*",
        "<Speaker> wub nummies! *crunch*",
        "<Speaker> tummeh feew bettah naow!! *munch*",
        "<Speaker> num nummies!! *crunch crunch*",
        "*chomp*",
      ],
      SMARTY: [
        "HMPH! WAN SKETTIES NU WAN YACKIE KIBBOW! *crunch*",
        "KIBBOW TASTE WIKE POOPIES!",
        "GRRR... SMAWTY SAID GIB SKETTIS, NU KIBBOW!",
        "GIB SKETTIS NAO! HATECHU DUMMEH DADDEH!",
        "NU WAN KIBBOW, WAN SKETTIS!",
        "HMPH, NO MORE KIBBOWS!",
        "WAI GIV KIBBOWS? WAN BIGGEST SKETTIS!",
        "NU MOWE YACKIE KIBBOWS!!",
        "NU WAN DUMMEH KIBBOW, WAN  SKETTIS NOW!",
        "GIB SKETTIS NAO NAO NAO!!",
        "HMPH! WHEWE SKETTIS?!",
      ],
    },
    SKETTIES: {
      DEFAULT: [
        "Sketties! Wub daddeh! *crunch*",
        "Bestest skettis fo' bestest fwuffy!!",
        "Wub skettis! Wub!",
        "Mmmmmmm... sketti...",
        "Wub daddeh suuu much!! Gib skettis foweba?",
        "Can daddeh awways gib skettis? <Speaker> wub skettis!",
      ],
      SMARTY: [
        "HMPH! SKETTIES NU GUD ENUF! *crunch*",
        "SKETTIS SMEWW WIKE POOPIE SKETTIS!!",
        "*Sniff* DADDEH GIB BETTAH SKETTIS NEX' NUMMIE TIME!",
      ],
    },
    SOYLENT_BROWN: {
      DEFAULT: [
        "WEAWWY nu wike dis yackie nummies... huu huu huu...",
        "Huu huu... taste wike poopies...",
        "*KAFF* *horrific choking noises*",
        "Wha' am dese cwunchies in poopie nummies? Nu wike!",
      ],
    },
    RAT_POISON: {
      DEFAULT: [
        "Yackie nummies... nu taste pwetty...",
        "*Cough* Nu taste vewy gud...",
        "<Speaker> nu wike dis nummies...",
      ],
    },
  },

  // Milk drinking
  MUMMAH_COMIN: [
    "Mummah comin' <target>!",
    "Nu cwy anymowe <target>! Mummah comin'!!",
    "<Target>!! Mummah gon' make it aww betta!!",
  ],
  SNIFF_SNIFF: ["*sniff sniff*", "Sniff sniff sniff...?"],

  DRINK_MILKIES: {
    DEFAULT: ["Cheep! *suckle knead suckle*"],
    FORMULA: [
      "Chirp cheep! *suckle suckle*",
      "*Suckle suckle* cooo... cooo...chirp!",
      "*suckle suckle*",
      "Coooo...*suckle*",
    ],
  },

  GIVE_MILKIES: {
    DEFAULT: [
      "Dwink miwkies <target>!",
      "Mummah hab wotsa miwkies fow 'ou <target>!",
      "Mummah num bestest nummies tu gib bestest miwkies <target>!",
      "Cooo... mummah wan' <target> tu stay wit' mummah foweba..",
      "<Target> dwink awwww da miwkies... coo..",
      "<Target> wan' mowe miwkies?",
      "Wub yu' <target>! Dwink all da miwkies an' gwow big an' stwong!",
      "<Target> dwink miwkies... <target> wub miwkies...",
      "Wub yu' suuu much <target>! Wan' <target> tu hab biggest heawt happies!",
      "<Target> make speakies soon? Mummah gib yu' bestest miwkies! Say mummah??",
      "<Target> wan' mowe miwkies?",
      "Mummah wub yu', <target>... neba fowget...",
      "Can <target> make speakies? Say baww! Say baww, <target>!!",
      "<Target> gon' dwink miwkies an' gwow up an' be bestest fwuffy fo' mummah!",
      "<Target> wub miwkies an' mummah! Mummah hab biggest heawt happies!",
      "Cooo... wub <target>...",
    ],
    ADOPTION: [
      "Babbeh nee' miwkies? <Speaker> hab pwenty of miwkies!",
      "Babbeh nee' mummah? <Speaker> be babbeh's mummah!",
      "Babbeh has nu mummah! Dat am su saddies! Nu wowwy babbeh, <speaker> be babbeh's mummah.",
      "Babbeh wook suu hungwy... nu wowwy babbeh! <Speaker> be nu mummah!!",
      "Babbeh am suu widdwe... wai 'ou mummah nu wan babbeh? <Speaker> be nyu mummah!",
      "Nu hab heawt huwties nu mowe babbeh... <speaker> wiww take cawe ob' yu...",
      "Nu cwy nu mowe babbeh... babbeh hab nyu mummah nao!",
      "Nu make hungwy chiwpies nu mowe babbeh... nyu mummah wub yu...",
      "Hewwo widdwe babbeh... Whewe mummah? Nee' miwkies?",
      "Widdow babbeh wook suu hungwy... hab miwkies babbeh!",
      "Mummah gon take cawe ob' nu babbeh! Wike mummah's own babbeh!",
      "Hab miwkies nu babbeh! Mummah awways wan' mowe babbehs!!",
    ],
    ASLEEP: ["zzzzz..... zzz...", "zzz... am babbeh dwink miwkies? zzzzz...."],
    BLIND: [
      "Gud babbeh? Am dat 'ou?",
      "Huh? Am gud babbeh?",
      "Nu kno if miwkie thief ow gud babbeh...",
      "EEEEEEKKKK....babbeh??",
      "Mummah wan' eyesies tu see yu' num bestest miwkies, babbeh...",
      "Babbeh?? Am dat 'ou babbeh? Mummah stiww wub' yu babbeh... coo..",
      "Wan see babbeh... Huu huu huuuuu....",
    ],
    LEGLESS: [
      "Nuuu... nu dwink miwkies...",
      "Huu huu... weggies gone... nu can stop miwkie thief...",
      "Huuuhuuu... sowwy babbehs... miwkie thief steawing miwkies...",
      "HEWP!!! MIWKIE THIEF!!!",
      "Nuuu... babbehs gun hab wowstest tummeh huwties...",
      "Nu take miwkies... babbehs nee' miwkies tu gwow big an' stwong..",
      "Pwease nu dwink miwkies.. nu wan babbehs tu hab foweba sweepies...",
      "Huu huuu huuu... am wowstest miwkie mummah ebah...",
      "Hatechu, dummeh miwkie thief... HATECHU!!",
    ],
    ALICORN: [
      "NUUU!!! MUNSTAH BABBEH! NU STEAW MIWKIES!",
      "SCREEEEE!!! MUNSTAH MIWKIE THIEF!!!!",
      "HEWP! HEWP! MUNSTAH BABBEH STEAWING MIWKIES!!",
      "YUCKY MUNSTAH TAKE MIWKIES FO' BESTEST BABBEHS!!",
      "UGWY MUNSTAH STEAW MIWKIES FO' BABBEHS!!",
      "SCREEEEE!!! NU WAN' 'OU, MUNSTAH BABBEH!! GU NUM POOPIES!!",
    ],
  },
  NO_MILKIES: {
    DEFAULT: [
      "Sowwy <target>, miwkies aww gone... nee' wait fow mowe miwkies...",
      "<Target> nee miwkies bu' mummah nu hab miwkies...",
      "Huu huu... no mowe miwkies fow <target>... mummah nee' nummies fow make miwkies...",
      "Mummah teww babbehs dwink miwkies... bu' nu miwkies... huu huuu huuuu...",
      "Babbehs fin' nummies fo' mummah? Make bestest miwkies?",
      "Pwease nu hab tummeh huwties <target>... gib mummah wowstest heat huwties...",
      "Nu miwkies fo' <target>.... stiww wub mummah?",
    ],
    BAD_BABY: [
      "Dummeh babbeh twy steaw... bu nu hab any miwkies...",
      "Nu eben hab miwkies fow dummeh babbeh!",
      "NU MOWE MIWKIES FOW MUNSTAH MIWKIE THIEF!",
      "MUNSTAH NU GET MIWKIES! MIWKIES AWW GONE!",
      "Dummeh babbeh tuu swow fo' miwkies.. tee hee..",
      "GU NUM POOPIES DUMMEH BABBEH! MIWKIES NU AM FO' YU'!!",
      "Nu miwkies fo' yu', dummeh babbeh!",
    ],
  },
  DENY_MILKIES: {
    NOT_MOM: [
      "NU! MIWKIES NU FOW DUMMEH BABBEH!",
      "MIWKIES AM FOW MUMMAH BABBEHS!! NU FOW DUMMEH BABBEH!",
      "GU FIN' BABBEH'S MUMMAH, DUMMEH BABBEH!! NU WAN' YU'!!",
      "UDDA BABBEHS NU' DESEWBE BESTEST MIWKIES! ONWY MUMMAH BABBEHS!",
    ],
    ALICORN: [
      "DUMMEH MUNSTAH BABBEH NU STEAW MIWKIES FWOM GUD BABBEHS!!!",
      "MUNSTAH BABBEH NU TWY STEAW MIWKIES!!",
      "EEEEEEEEEEK!! GU WAY!!! GU WAY!!",
      "WOWSTEST HUWTIES FO' MUNSTAH!!",
      "EEEK!! MUNSTA TWY TAKE MIWKIES FWOM PWECIOUS BABBEHS!",
      "<SPEAKER> NU WIKE YU' MUNSTAH BABBEH!",
    ],
  },

  // [this][Self]
  HUNGRY: {
    DEFAULT: [
      "Big tummeh owwies!",
      "<Speaker> weawwy hungwy daddeh! Nee' nummies!",
      "Nee' nummies nao daddeh! Nao!",
      "Nu hab nummies in suuuu wong... nee nummies daddeh!",
      "<Speaker> wub yu' daddeh... pwease gib nummies...",
      "Nee' nummies tu gwow big an' stwong..",
      "Wowstest tummeh owwies... gib nummies nao!",
      "NUMMIES!!! PWEASE!!",
      "<Speaker> tummeh hab huwties. Nee' nummies!",
    ],
    FERAL: [
      "Pwease nice mistah... nee' nummies...",
      "Hab scawdies an' tummeh owies... gib nummies nice mistah?",
      "Pwease hewp <speaker>, nice mistah.. nu hab nummies in suuu wong..",
    ],
    CHIRPY: ["Chirp! Chirp!"],
  },
  VERY_HUNGRY: {
    DEFAULT: [
      "<Speaker> hungwy daddeh, hab nummies?",
      "<Speaker> wan' nummies!",
      "Hab nummies fow <speaker>?",
      "Nee' nummies foww tummeh daddeh!",
      "Pwease gib nummies? <Speaker> be gud!",
      "Daddeh, nummies pwease?",
      "Wan nummies! Nice daddeh gib nummies!",
      "Gib nummies fow <speaker>?",
      "<Speaker> do speshow twicks fo' nummies?",
      "Nu wike waiting fo' nummies...",
      "Daddeh! Nummies!",
      "<Speaker> wan' nummies an' huggies!",
    ],
    FERAL: ["Nice mistah hab nummies?"],
    CHIRPY: ["Cheep...", "Cheep cheep cheep!"],
  },
  STARVING: {
    DEFAULT: [
      "*haf*... *haf*...",
      "Nummies...",
      "Su hungwy...",
      "Wowstest tummeh owwies...",
      "*Whine*",
      "Huu huu huu... pwease... <speaker> weawwy hungwy!!",
      "G-gib nummies?? <Speaker> suuuu hungwy..",
    ],
    CHIRPY: ["Yaaaaawn....", "Yaaaaaaaaaaawwwwn"],
  },

  // [this][ACTION][SELF]
  POOP: {
    FART: ["*pfbft*"],
    PUSH: ["Hnnnnngggg!!", "HNNNNNNGGG!!!"],
    DONE: {
      DEFAULT: [
        "Ahhh... poopies done!",
        "Done wif poopies!",
        "Ahh... maek poopies!",
      ],
      CHIRPY: ["*satisfied peeping*", "Peep cheep!", "Cheep cheep!"],
    },
    BAD: {
      DEFAULT: [
        "Nuuuuu.... make bad poopies....",
        "Huuhuu... wai poopie pwace nu wisten?",
        "<Speaker> am dummeh bad poopie fwuffy...",
        "<Speaker> howp nu wun see bad poopies..",
      ],
    },
    DIRTY_PUDDLE_COMPLAINT: {
      DEFAULT: [
        "Daddeh nee' cwean poopies...",
        "Yackies... su much poopies...",
        "Daddeh pwease cwean poopies?",
        "<Speaker> nu wike yucky poopies daddeh...",
        "Huu huu... why housie su poopies?",
        "Huu huu.. <speaker> make walkies in poopies...",
        "<Speaker> hoofsies nu smeww pwetty nu mowe..",
        "Nu make <speaker> num' poopies, daddeh! Pwease cwean poopies!",
        "Nee' wicky cweanies...su much poopies..",
      ],
      SMARTY: [
        "DUMMEH DADDEH CWEAN POOPIES NAO!!",
        "CWEAN POOPIES NAO NAO NAO!!!!",
        "GON MAKE DUMMEH FWUFFIES NUM POOPIES SOON!!",
        "NU WIKE POOPIE SMEWW!! CWEAN NAO!!",
        "SMEWW WIKE POOPIES!! SMEWW WIKE DUMMEH DADDEH!!",
        "SMAWTY NEBA GON NUM' POOPIES 'GAIN! CWEAN POOPIES NAO!!!",
      ],
    },
    LITTERBOX_FULL: [
      "Yackies... wittabox nee' cweaning...",
      "Nuuuu... daddeh wittabox tuu fuww...",
      "<Speaker> nu wan' be poopie fwuffy... pwease cwean wittabox!",
      "Nu wan' make bad poopies... bu' wittabox tuu fuww..",
      "Suu many poopies in wittabox... nee' cweanies...",
      "Eeek! Wittabox am poopie!",
      "Daddeh! Cwean wittabox pwease!",
      "Wha' if <speaker> faww into poopies? Daddeh nee' cwean wittabox!",
      "Wittabox nu smeww pwetty!!",
    ],
  },

  // LITTERPAL
  LITTERPAL: {
    DEFAULT: [
      "HUUHUUU NU WAN BE WITTEWPAW!",
      "FWUFFIES AM FOW HUGGIES AND WUB NU AM FOW NUMMIN' POOPIES HUUUU!!!",
      "Daddeh nu wub <speaker>... wan <speaker> eat poopsies...",
      "DADDEH PWEASE WET OUT!! <SPEAKER> PWOMISE BE BESTEST FWUFFY EBAH!",
    ],
    SMARTY: [
      "DUMMEH DADDEH! NU WAN BE WITTEWPAW!",
      "NU WAN BE WITTEWPAWWWWWWWWWWWWWWWWWWW!!!!!! DUMMEH DADDEH DUMMEH DADDEH DUMMEH DADDDDDEEEEHHHHH!!!!",
      "DUMMEH DADDEH WET OUT NAO NAO NAO!!!",
      "AM 'SPOSED TU GET WICKIE CWEANIES!! NU AM 'SPOSED TU GIB!!! STOOPID DADDEH NU UNNASTAN!!",
    ],
    USE: {
      DEFAULT: [
        "Wickie-cweanies suuu gud...",
        "Fank 'ou wittapaw! Poopie pwace su cwean nao!",
      ],
      MALE: [
        "UUUNNNFFF! Wai wickie-cweanies maek nu-nu stick big?",
        "Wickie-cweanies maek nu-nu stick 'cited...",
      ],
      VICTIM: [
        "HUUUHUUU!!! NU WIKE POOPIES!!!",
        "NU WAN NUM POOPIES!",
        "Huu... hate gibbin wickie-cweanies...",
      ],
    },
  },

  // Special friends
  PROPOSE: {
    DEFAULT: [
      "Pwetty mawe wan' be speshow fwens?",
      "<Speaker> wike pwetty mawe, be speshow fwends?",
      "<Speaker> weawwy wike 'u pwetty mawe! Be speshow fwends wit' big an' stwong stawwion?",
    ],
    MARE: [
      "Pwetty mawe wan' be speshow fwens?",
      "<Speaker> wike pwetty mawe, be speshow fwends?",
      "<Speaker> weawwy wike 'u pwetty mawe! Be speshow fwends wit' big an' stwong stawwion?",
    ],
    MARE_TO_MARE: [
      "Pwetty mawe wan' be speshow fwens?",
      "<Speaker> wike pwetty mawe, be speshow fwends?",
      "<Speaker> weawwy wike 'u pwetty mawe! Be speshow fwends wit' pwetty mawe?",
    ],
    STALLION: [
      "Pwetty stawwion wan' be speshow fwens?",
      "<Speaker> wike pwetty stawwion, be speshow fwends?",
      "<Speaker> weawwy wike 'u pwetty stawwion! Be speshow fwends wit' big an' stwong stawwion?",
    ],
    REJECT: [
      "Um... hab speshow fwen awweady.",
      "Gu way yucky fwuffy!",
      "Awweady hab gud stawwion!",
      "Nu, <speaker> awweady hab' bestest speshow fwend.",
    ],
    REJECT_SEXUALITY: {
      DEFAULT: [
        "Nu am dat kind ob fwuffy!",
        "Ick! <Speaker> nu wike <target>!",
      ],
      STALLION: [
        "Nu! <Speaker> onwy wike pwetty mawes!",
        "Nu am dat kind ob fwuffy!",
        "Ick! <Speaker> nu wike <target>!",
        "Nu wan boy speshow fwend! Wan pwetty mawe!",
        "Nu wike stawwions! Mawes am pwettiew!",
        "Gu 'way stawwion! <Speaker> nu wike boy fwuffies!",
      ],
      MARE: [
        "Nu! <Speaker> onwy wike big stwong stawwions!",
        "Nu am dat kind ob fwuffy!",
        "Ick! <Speaker> nu wike <target>!",
        "Nu wan giww speshow fwend! Wan stawwion!",
        "Nu wike mawes! Stawwions am bettah!",
        "Gu 'way mawe! <Speaker> onwy wike boy fwuffies!",
      ],
    },
    ACCEPT: {
      DEFAULT: [
        "Yus! Wan be speshow fwens wif stawwion!",
        "Wub nyu speshow fwend!",
        "Yus!! <Speaker> wan' babbehs!!",
      ],
      MARE: [
        "Yus! Wan be speshow fwens wif stawwion!",
        "Wub nyu speshow fwend!",
        "Yus!! <Speaker> wan' babbehs!!",
      ],
      STALLION: [
        "Yus! Wan be speshow fwens wif stawwion!",
        "Wub nyu speshow fwend!",
        "Yus!! Bestest stwong speshow fwend! Wub nyu speshow fwend!",
      ],
      MARE_TO_MARE: [
        "Yus! Wan be speshow fwens wif pwetty mawe!",
        "Wub nyu speshow fwend!",
        "Yus!! Bestest pwetty speshow fwend! Wub nyu speshow fwend!",
      ],
    },
  },
  // Special hugs
  SPECIAL_HUGGIES: {
    ENF: ["Enf, enf, enf..."],
    IP: ["Ip, ip, ip, ip..."],
    GUD_FEEWS: ["GUD FEEWS!", "GUUUUD FEEEWS!!", "BESTEST FEEWS!!"],
    BAD_ENFIES: {
      DEFAULT: [
        "NUUUUUUUUUU!!!!!",
        "HUUUUU HUUUU HUUUUU!!!!!",
        "NUUUUUHUUUHUUU!!!! BAD ENFIES!!!!",
        "HUUU HUUUU... pwease be oba soon....",
        "*HURK* CAN FEEW BOO-BOO JOOSE IN SPESHOW PWACE... HUU HUU...",
        "*Rip* EEEEK!! MEANIE <TARGET> GIB SPESHOW PWACE WOWSTEST HUWTIES... Huu Huuuu...",
        "NUU WAN!! NU WAN!!!",
        "HUU HUUU... HATECHU MEANIE <TARGET>!!! HATECHU!!",
        "HEWP FWUFFYYYY!!!!!! HUU HUU HUUU...",
        "AAAAAAAAAAACCKKK!!!!!! PWEASEEE SAB' <SPEAKER>!!! NU WUB <SPEAKER>??!!!",
      ],
      MARE: [
        "NUUUUUUUUUU!!!!!",
        "HUUUUU HUUUU HUUUUU!!!!!",
        "NUUUUUHUUUHUUU!!!! BAD ENFIES!!!!",
        "HUUU HUUUU... pwease be oba soon....",
        "*EEEEEK* NU WAN BABBEHS TU WOOK WIKE MEANIE <TARGET>!!",
        "*HURK* CAN FEEW BOO-BOO JOOSE IN SPESHOW PWACE... HUU HUU...",
        "*Rip* EEEEK!! MEANIE <TARGET> GIB SPESHOW PWACE WOWSTEST HUWTIES... Huu Huuuu...",
        "NUU WAN!! NU WAN!!!",
        "HUU HUUU... HATECHU MEANIE <TARGET>!!! HATECHU!!",
        "HEWP FWUFFYYYY!!!!!! HUU HUU HUUU...",
        "HEWPPP!!! NU WAN BABBEHS TU WOOK WIKE MEANIE <TARGET>!!",
        "AAAAAAAAAAACCKKK!!!!!! PWEASEEE SAB' <SPEAKER>!!! NU WUB <SPEAKER>??!!!",
      ],
      STALLION: [
        "NUUUUUHUUUHUUU!!!! BAD ENFIES!!!!",
        "NU AM MAWE! NU AM MAWE!!!!!!!!",
        "NUUUUU! <SPEAKER> AM STAWWION! NU AM MAWEEE!!",
        "HUUU HUUU... DAT AM POOPIE PWACE!!!!! NU AM MAWE!!!",
        "*Rip* EEEEK!! MEANIE <TARGET> GIB POOPIE PWACE WOWSTEST HUWTIES... Huu Huuuu...",
      ],
    },
    INTERRUPTED: ["OOF!", "ACK!", "HNGH!"],
    NO_LEGS: [
      "HUUUUHUUUUUHUUUU!! AM DUMMEH NU-WEGGIE FWUFFY NU CAN HAB SPESHOW HUGGIES!!!",
      "Huuu huu huu.. wan be daddeh... nu hab' weggies fo' speshow huggies...",
      "Speshow wumps hab' wowstest huwties, bu' <speaker> nu hab' weggies... HUU HUU HUUUUUU...",
      "Speshow wumps, pwease hab nu mowe huwties... weggies com' back soon...",
      "HUUUU HUUUUUUUU.... <SPEAKER> NEE' WEGGIES FO' SPESHOW HUGGIES... SPESHOW FWEND NU CAN HAB' BABBEHS...",
      "Nee' weggies tu hab speshow huggies... huu huu...",
      "Speshow wumps hab wowsest huwties nao dat <speaker> nu can hab speshow huggies..",
      "Speshow wubs pwease nu hab huwties nu mowe... weggies com' back soon...",
    ],
    NO_LUMPS: [
      "HUUUUUHUUU!!! NU HAB WUMPS FOW SPESHOW HUGGIES!!! HUUUHUUU!!!",
      "Nu hab' wumps fo' speshow huggies... huu huuu... pwease nu weave <speaker> speshow fwend...",
      "<Speaker> hab' dweam bein' daddeh wit' suu many babbehs.... huu huuu..",
      "Daddeh, can <speaker> hab speshow wumps back pwease? Wan' have wots o' pwettiest babbehs wif speshow fwend! Huu huu....",
      "<Speaker> wan' wots o' babbehs tu wook wike <speaker>... huu huu...",
      "NU HAB SPESHOW WUMPS FO' ENFIES!!! SPESHOW FWEND NEBA GON WUB' <SPEAKER> ANYMOWE!!",
      "<Speaker> can neba be daddeh naow... huu huu huu...",
    ],
  },
  FLUFFY_SAVE_FROM_BAD_ENFIES: {
    DEFAULT: [
      "STAY 'WAY FWOM MAWE!! <SPEAKER> 'GON GIB BIGGEST OWWIES!!",
      "NU HUWT MAWE!! GIB HUWTIES!!",
      "<SPEAKER> AM BWAVE <SPEAKER>! SAB' MAWE!",
      "WOWSTEST HUWTIES FO' MEANIE <TARGET>!",
      "STAWP NAOO!! HHMF!!",
      "BWAVE <SPEAKER> SABE PWETTY MAWE!",
    ],
    MARE: [
      "STAY 'WAY FWOM MAWE!! <SPEAKER> 'GON GIB BIGGEST OWWIES!!",
      "NU HUWT MAWE!! GIB HUWTIES!!",
      "<SPEAKER> AM BWAVE <SPEAKER>! SAB' MAWE!",
      "WOWSTEST HUWTIES FO' MEANIE <TARGET>!",
      "STAWP NAOO!! HHMF!!",
      "BWAVE <SPEAKER> SABE PWETTY MAWE!",
    ],
    STALLION: [
      "STAY 'WAY FWOM STAWWION!! <SPEAKER> 'GON GIB BIGGEST OWWIES!!",
      "NU HUWT FWUFFY!! GIB HUWTIES!!",
      "<SPEAKER> AM BWAVE <SPEAKER>! SAB' FWUFFY!",
      "WOWSTEST HUWTIES FO' MEANIE <TARGET>!",
      "STAWP NAOO!! HHMF!!",
      "BWAVE <SPEAKER> SABE STAWWION!",
    ],
  },

  // Litterpal
  NUMMIES_COMPLAINT: [
    "Huuuu... nu wan num poopies...*GAG*",
    "Nu wike poopies! Nu wan!",
    "<Speaker> wan sketties... nu wike poopies...*HACK*",
    "Poopies wook wike nummies... huu huu....*GACK*",
    "Hab wowstest tummeh huwties.. nee' num poopies... huu huu...",
    "*HURK*... wook wike skettis... bu' nu taste wike skettis...",
    "Suu hungwy...*HUCK*...eat...p-poopies...*GAG*",
    "Wan' gud nummies... huu huuu...",
    "<Speaker> said wan' num gud nummies... nu poopies...*GULP*",
  ],

  // Birth and first words
  BIRTH: {
    START: ["BIGGEST POOPIES!!!"],
    PAIN: [
      "SCREEE!!!!",
      "EEEEEEEEEEEEEK!!!",
      "SCREEEEE-HEE-HEEE-HEEEEeeeee...",
      "REEEEEEEEEEEEEEEEE!!!",
    ],
    DEAD_BABY: [
      "Wai <target> nu maek chiwpies? Huu huu...",
      "<Target>? Wakies! Mummah hab wotsa miwkies...",
      "Nuuu! <Target> nu make bweathies! HUUUHUUUU!!",
      "<Target> am sweepies??",
      "Mummah nu heaw <target> chiwpies... Huu huu...",
      "Mummah wub yu' nu <target>!!...<Target>??",
      "<TARGET>!!!! NUUUUUU-HUUU-HUUUUUUuuuu...",
      "<Target> wuz in tummeh fo' suu wong... wai <target> nu make chiwpies??",
      "<Target> wakies!! Time fo' wickie cweanies... huuu huuu...",
      "<TARGET> AM FOWEBA SWEEPIES... HUUU HUUU...",
      "*Sniff* M-mummah nu take gud cawe of pwetty b-babbeh in tummeh?? Huu huu...",
      "Wiww dweam about yu' <target>... huu huu huuuuuuuuu....",
      "Wiww neba get tu gib <target> miwkies... HUUUUUUUUUU HUUUU....",
      "<Target>?? Wakies!! Mummah nee' tu gib yu' huggies an' wub!",
      "<Target> nu wan' gib mummah huggies?? Huu huuu huuuuuuuuuu....",
    ],
  },
  BABY_PEEP: ["Peep!", "Chirp!", "Peep...peep...peep..."],
  BABY_FIRST_WORDS: [
    "Chirp! d... dadd.. daddeh? Dadd... daddeh!",
    "Peep... m... mum... mummah! Mum.. mummah!",
    "Cheep! Cheep cheep! w... wub! Wub!",
    "Chirp! Chirp! m.. miw... miwkies! Miwkies!",
    "Peep...peep...wan'..wan! Wan'!..",
    "Peep...g-*chirp!* gib... gib...",
    "Peep... p-peep...h... hug...hug-gie... huggie..",
    "Chirp...p...p...poo...poopie...",
  ],

  babbeh: ["<target>"],
  brother: ["<target>"],
  sister: ["<target>"],

  // [this][Self]
  ADOPTED: {
    DEFAULT: [
      "YAY! FANK 'OU! <SPEAKER> WUB NYU DADDEH!",
      "HOUSIE SUUUU BIG!!! <SPEAKER> GON' HAB SUU MANY FWENDS!",
      "<SPEAKER> WUB NYU SAFE WOOM DADDEH!!",
      "*Gasp!* HOUSIE SUUU BIG!! SUU MUCH BETTA DEN YUCKY OUTSIDES!",
      "YAYYY!!! Daddeh hab nummies fow <speaker> nao?",
      "WUB NYU DADDEH!!!",
      "BESTEST DADDEH EBAH!!!",
    ],
    SMARTY: [
      "HMPH DIS HOUSIE AM POOPIES!!",
      "SMAWTY WAN' BIGGEW HOUSIE FO' BIGGEW HEWD...",
      "NAO GIB' SMAWTY AWW DA PWETTY MAWES TU MAKE BIGGEST HEWD!",
      "NAO GIB NUMMIES TU BIG AN' STWONG SMAWTY!",
      "NAO DADDEH DO WHATEBA SMAWTY SAY!",
      "NAO DADDEH GIB SMAWTY BIGGEST HEWD!!!",
      "GON GIB SUU MANY DUMMEHS SOWWY HOOFSIES NAO!!",
    ],
  },
  DOOR_KNOCK: {
    ADOPTED: [
      "*tap tap* Nu wike outside daddeh!",
      "*scratch* Bwing <speaker> back daddeh!",
      "*tap tap* Nu fowget <speaker> daddeh!",
      "*tap scratch* Nu weave <speaker> daddeh...",
      "*tap tap* Wai weave <speaker>? Am bad fwuffy?",
      "*scratch scratch scratch!* Daddeh! <Speaker> hab scawdies!!",
      "*tap tap* Nu wan pway outside nu mowe', daddeh!!",
      "*scratch scratch* <Speaker> miss yu' daddeh...",
      "*tap tap tap* Daddeh! <speaker> make poopies!! wet <speaker> back in nao?",
      "*scritch...scritch...* Huuu huuu... daddeh, <speaker> nu wike bein' away fwom daddeh!!",
      "*SCRATCH SCRATCH* Daddeh?? DADDEH??!!!!",
    ],
    DEFAULT: [
      "*tap tap* Hewwo?",
      "*scratch* Can <speaker> com' insies?",
      "*tap tap* Wan housie!",
      "*tap tap* Wet <speaker> insies? Be gud fwuffy!!",
      "*scratch scratch* Nice mistah, <speaker> suu cowdies.. gib nu housie?",
      "*tap tap* Mistah wan' nyu fwuffy?",
      "*tap tap* <Speaker> gib wub tu nice mistah!",
      "*scratch scratch* Smeww nice housie...",
      "*scratch scratch* Hab huwties on hoofsies.. gib <speaker> huggies?",
      "*whine* Wan wawm housie fo' <speaker>..",
      "*tap tap* <Speaker> be gud fwuffy! Be nu daddeh!!!",
      "*scratch* Pwease no weave outsies..",
      "*tap tap* Gib insies fo' pwetty <speaker>?",
      "*tap tap* Wan nu daddeh!! Wet nice <speaker> insies!",
      "*scratch scratch* Pwease wet <speaker> insies! Nu wan mowe sky wawa!",
      "*tap tap* Open doow fow <speaker>?",
      "*sniff* <Speaker> smell nummies..",
      "*whimper* Nee nyu daddeh...",
    ],
  },

  // Called in HorsePositioning.js handleFear()
  // [this][Object/FearedFluffy]
  FEAR: {
    MILKIE_THIEF: [
      "NU HUWT!! AM SOWWY FOW STEAW MIWKIES!!",
      "AM ONWY WITTOW BABBEH!!!!",
      "PWEASE NU HUWT!!",
      "HUUHUUHUU!!! Onwy wan wittow miwkies...",
    ],
    ALICORN: [
      "SCREEE! MUNSTAH!!",
      "NU NUM <SPEAKER> MUNSTAH!!",
      "MUNSTAH!!! NEE WUN WAY!!!",
      "H-HAB WINGIES AN' HOWN??? SCAWDIES!!!",
      "HUU HUU HUUU... NU NUM <SPEAKER>!!",
      "MUNSTAH GON NUM <SPEAKER>!! WUN WAY!! WUN WAY!!",
    ],
    CANNIBALISM: [
      "NUUUUU!!! NU AM NUMMIES!!!",
      "FWUFFIES AM FOW HUGGIES AN' WUB!! NU FOW NUMMIES!!",
    ],
    SPRINKLER: [
      "NUUUUUU!!!! WAWA BAD FOW FWUFFIES!!",
      "NU WAN WAWA!! WAWA BAD!! WAWA BAD!!!",
      "EEEEEEEK!!! SU COWDD!",
      "WOWSTEST COWDIESS",
      "HUU HUU.. WAWA MAKE COWDIES NU GU' WAY!",
      "SUU MUCH WAWA... NU WIKE!!",
      "FWUFF SUU COWDIES NAO!!! HUU HUU!!",
      "PWEASE GU WAY MEANIE WAWA!!",
      "NUUUUUUUUU!!!! STOP PWEASEEE!!!",
      "TUU MANY WAWASS!!!",
      "EEEEEEEEEEEK!!! SABE <SPEAKER>!!",
      "NU WAN! NU WAN!! HUU HUU HUUUUU!",
      "SCREEEEEEEEEEEEEEEEEEEEE!!!",
      "MEANIE WAWA!!!",
      "NU GIB WAWA!! AM BAD FO' FWUFFIES!",
      "EEEEEEEEEEK!!!",
      "SKREEEEE-HEE-HEE-HEEEEEEE...",
      "EEEEEEEK!!!! WAWAA MAKE <SPEAKER> NU FEEW PWETTY!!!",
    ],
    GRINDER: [
      "SCREEEE!! METAW MUNSTAH!!!",
      "NUUUUUUU!!! METAW MUNSTAH GUN' NUM <SPEAKER>!!!!",
      "EEEEEEK!!!",
      "MUNSTAH!!! GUN' NUM <SPEAKER>!!! HEWP!!",
    ],
    BLOOD: [
      "EEEEEEK!!! BOO-BOO JOOSE!!",
      "SCREEE!!! BOO-BOO JOOSE!! WAT AM HAPPEN TU FWUFFY??",
      "BOO-BOO JOOSE! EEK!!... <Speaker> hab scawdies..",
    ],
    CAR: [
      "SCREEE!!! VWOOM MUNSTAH!!!",
      "VWOOM MUNSTAH!!! NEE WUN WAY!!!",
      "EEEEEEK!!! VWOOM MUNSTAH GOIN' TU CWUSH <SPEAKER>!!!",
      "SCREEE!!! VWOOM MUNSTAH GUN' GIB <SPEAKER> FOWEBAH SWEEPIES!!!",
    ],
    CAR_COWER: [
      "SCREEEEEEEEEE!!!! PWEASE NU NUM FWUFFY VWOOMY MUNSTAH!!!!!",
      "NUUUUUUU AM SOWWY AM SOWWY!!!!",
      "NU WAN DIE! NU WAN DIE!!!!!!!",
    ],
    CAR_SMARTY: [
      "SMAWTY NU AM SCAWED OF STOOPID VWOOMY MUNSTAH!",
      "GU 'WAY DUMMEH VWOOMY MUNSTAH! DIS AM SMAWTY WAND!!",
      "DUMMEH VWOOMY MUNSTAH GIT SOWWY HOOFSIES!",
    ],
    CHASING_SMARTY: {
      DEFAULT: [
        "NUUUUU NU WAN BAD ENFIES!!!!",
        "NU WAN BAD ENFIES FWOM SMAWTY!",
        "Pwease... NUUUU!!!",
        "NU HUWT!! NU HUWT!!",
      ],
      MARE: [
        "NUUUUU NU WAN BAD ENFIES!!!!",
        "NU WAN BAD ENFIES FWOM SMAWTY!",
        "EEEK!! BAD ENFIES GIB BAD BABBEHS!!",
        "NU WAN' SMAWTY BABBEHS!!",
        "Pwease... NUUUU!!!",
        "NU HUWT!! NU HUWT!!",
      ],
      STALLION: [
        "NUUUUU! <SPEAKER> AM STAWWION! NU GIB ENFIES TU STAWWION!",
        "NUUUUU NU WAN BAD ENFIES!!!!",
        "NU WAN BAD ENFIES FWOM SMAWTY!",
        "HEWP!! MEANIE SMAWTY WAN' GIB STAWWION BAD ENFIES!!",
        "Pwease... NUUUU!!!",
        "NU HUWT!! NU HUWT!!",
      ],
    },
    BAD_ENFIES: [
      "SCREEE! GU WAY MEANIE <TARGET>!!",
      "EEEEEEE!!! NU WAN MOWE BAD ENFIES!!!",
      "EEEEEEEEEEK!!! MEANIE <TARGET> GIB <SPEAKER> WOWSTEST HEAWT HUWTIESS... HUU HUUUU...",
      "NU GAIN'! NU GAIN'!",
      "SCAWDIES!!! NU ENFIES PWEASE!!",
      "AWWEADY GIB ENFIES!!! PWEASE NU MOWE ENFIES!",
    ],
  },
  // [this][Corpse][i am your xyz]
  CORPSE: {
    DEFAULT: [
      "SCREEE! FWUFFY AM FOWEBAH SWEEPIES!",
      "EEEEEEK!!! WAI FWUFFY NU WAKIES?!!!",
      "EEEK!!! FWUFFY NU MAKE BWEATHIES!!! WOWSTEST SCAWDIES!!",
      "SCREEE!!! SUM WUN' SABE FWUFFY!! FWUFFY NU MAKE BWEATHIES!!!",
    ],
    BABY: {
      DEFAULT: [
        "SCREEE! BABBEH AM FOWEBAH SWEEPIES!",
        "EEEEK!!! BABBEH NU MAKE BWEATHIES!!!",
        "B-BU BABBEH SUU WIDDWE!!! WAI BABBEH AM FOWEBA SWEEPIES???!!!!!!!!!!",
        "BABBEH AM FOWEBA SWEEPIES???? WHEWE BABBEH MUMMAH??",
        "BABBEH TUU WIDDOW TU GO FOWEBA SWEEPIES!!! SCREEEEEE!!!!!!",
      ],
      MOTHER: [
        "HUUUUUHUUUUU!!!! <TARGET> FOWEBAH SWEEPIES! AM BAD MUMMAH!",
        "<TARGET>!!! NUUUU-HUUU-HUUUUU... AM DUMMEH MUMMAH!!!",
      ],
    },
    MOTHER: [
      "MUMMAH?? PWEEZE WAKIES MUMMAH! <SPEAKER> NEE HUGGIES!",
      "MUMMAH NU GIB HUGGIES NU MOWE??? AM DUMMEH <SPEAKER>??",
      "MUMMAHHHHH!!!! HUU HUUU HUUUUUUUU... PWEASE WAKIES!!!",
    ],
    FATHER: [
      "DADDEH??? WAKIES DADDEH HUHUHUHU!!!",
      "DADDEH PWEASE WAKIES!!! NEE' STWONG DADDEH!!",
      "DADDEH WAKIES PWEASE!! WUB DADDEH!! HUU HUU HUUUUUU",
    ],
    SPECIAL_FRIEND: [
      "SPESHOW FWEN WAKIES!!! <SPEAKER> NEE' SPESHOW FWEN HUHUHUHU!",
      "SPESHOW FWEN??!! NU AM TIME FO' SWEEPIES!! HUU HUUUUU...",
    ],
  },

  // Play
  PLAY: {
    BALL: [
      "Yay! Wub baww!",
      "Wub bouncy baww!",
      "Baww!! Baww!!",
      "Pway baww wif' <speaker>!!",
      "Baww wook suuu pwetty!",
      "<Speaker> hab' bestest hoofsies fo' baww!",
    ],
    BLOCK_KNOCK_DOWN: [
      "Yay! Bwockies faww!",
      "*giggle* Nee' stack bwockies 'gain!",
    ],
    BLOCK: {
      DEFAULT: [
        "Bwockie!",
        "Yay! Wub bwockies!",
        "Wub bwockies!!",
        "Wub pway bwockies!",
        "Bwockie time!",
        "Wub stack bwockies!!",
        "Gon' be bestest bwockie stackie 'eba!",
      ],
      FAIL: [
        "Bwockies faww...",
        "Bwockies nu wisten tu <speaker>...",
        "Bwockies nu wike <speaker>??",
        "Wai bwockies faww?? Am bad at stackies??",
      ],
      SUCCESS: [
        "Duin stackies!",
        "Stackies!!!!",
        "<Speaker> make stackies... am bestest stackies!",
        "Daddeh, wook at <speaker> duin stackies!",
        "Make bestest housie wif' bwockies...",
        "<Speaker> make biggest housie, an' daddeh hab biggest heawt happies!",
        "Gon' make housie fo' daddeh!",
        "Daddeh!! <Speaker> gon' make biggest housie fo ou'!",
        "<Speaker> gon' make biggest housie...",
      ],
    },
  },

  // Box
  SORRY_BOX: {
    ADOPTED: [
      "Nu wike sowwy box daddeh! Wet out?",
      "Pweez wet out daddeh! Pwomise wiww be gud fwuffy!",
      "<Speaker> wan' out daddeh! WAN' OUT!",
      "Huu huu huuuu... <speaker> nu know wut <speaker> do wong...",
      "Wan pway...*sniff* huuu huu huuuuuu....",
      "Daddeh... nu wan wive in sowwy box... wet out? A-an' <speaker> be gud fwuffy?",
      "<Speaker> wan' pway 'gain... huu huu...",
      "Pwease wet out daddeh!! <Speaker> hab scawdies!!",
      "Huuu huuu huuu....",
      "<Speaker> am gud fwuffy! Wet out an' gib huggies nao?",
      "Am onwy widdow <speaker>... huu huu...",
      "<Speaker> wan' daddeh tu wub <speaker> 'gain...*sniff*",
      "<Speaker> wub daddeh... daddeh hate <speaker>...",
      "Nu wan wive in sowwy box... ",
      "Huuu huuu huuuuu... wowstest heawt huwties...",
      "<Speaker> gib wus gon' gib' daddeh suu many huggies... huu huu..",
    ],
    FERAL: [
      "Nice mistah wet <speaker> out pweeze?",
      "Wai sowwy box? <Speaker> am gud, desewve nyu daddeh!",
      "<Speaker> am gud fwuffy nao! Wet out an' gib nu homesie a-an' sketties?",
      "<Speaker> neba eben duin anyfing nice mistah!! Pwease wet out!!",
      "<Speaker> wan homesie... wif nu sowwy box...",
      "Nice mistah nu wub <speaker>... huu huu..",
      "Am gud fwuffy nice mistah! Wet out!",
      "Huuu huuu...*sniff*... <Speaker> neba fin' gud daddeh nao...",
    ],
    SMARTY: [
      "DUMMEH HOOMIN WET SMAWTY OUT OF SOWWY BOX NAO!!!",
      "WHEN DUMMEH HOOMIN WET SMAWTY OUT, GIB WOWSTEST SOWWY HOOFSIES!",
      "SMAWTY AM' PWAY WIF NICE MISTAH!!! NU AM MEANIE FWUFFY!! PWEASE WET OUT!!!....huu huuu..",
      "BESTEST SMAWTY WIWW FIN' WAY OUT OB SOWWY BOX!!",
      "SMAWTY AM TU SMAWTY FO' SOWWY BOX!! WET OUT OW' SMAWTY GIB SOWWY HOOFSIES!!",
      "MEANIE HOOMIN!! TAKE SOWWY POOPIES!!",
      "WET OUT NAO!! OW...Ow... OW SMAWTY GON TEWW HEWD TU GIB MEANIE HOOMIN SOWWY HOOFSIES!!",
      "WET OUT! WET OUT! WET OUTT!!!!",
    ],
  },
  TV_FOCUS: {
    POOPIES: {
      DEFAULT: ["Fwuffies... poopsies in wittabox?"],
      SMARTY: ["HMPH! SMAWTY MAEK POOPIES WHEWE SMAWTY WAN'!"],
    },
    SMARTY_OFF: [
      "WAN PWAYMAWE CHANNEW NAO!",
      "TEEBEE! TEEBEE! TEEBEE! TEEBEE!",
      "WAN WATCH PWAYTIME TEEBEE!",
      "DADDEH TEEBEE IS BWOKEN!",
      "DIS CHANNEW IS BOWING!",
      "DUMMEH TEEBEE <SPEAKER> GIB SOWWY HOOFSIES!",
    ],
    MUNSTA: {
      DEFAULT: ["Munsta fwuffy... am... fwen?"],
      SMARTY: [
        "MUNSTA FWUFFY ONWY GUD FOW' SOWWY HOOFSIES AND FOWEBAH SWEEPIES!!",
      ],
    },
    MUNSTA_TOL: [
      "Pointy wingy fwuffies am fwends!",
      "<Speaker> wuws aww fwuffies!",
    ],
    HEAVY_METAL: [
      "SCREEEEEEEEEEEEEEEEEEE!!!!",
      "SCREEEEEE SCAWY!!!!!",
      "NUUUUUUUU SCAWY MUNSTA ON TEEBEE!!!!",
      "HUUU HUUU HUUUUU!!!",
    ],
    TORTURE_CHANNEL: [
      "Wat dat daddeh doin do fwuffy?!",
      "Daddeh! Daddeh! Munsta is kiwwing teebee fwuffy!",
      "NUUUUU NU WAN NU WAN HUU HUU HUUU...",
      "NUUU FWUFFY FWEN! <SPEAKER> WAN SAVE FWUFFY FWEN!",
    ],
    TORTURE_CHANNEL_TRAUMA: [
      "*stares blankly*",
      "Nu... n-n-nuuuu... uuu...",
      "Fwuffy fwen...",
      "*whimpers*",
      "<Speaker> see it when cwose see-pwaces...",
      "M-m-mummah?",
    ],
    TORTURE_CHANNEL_SMARTY: [
      "Wuh... wai mistah du dat tu smawty...?",
      "Nu wike... huu...",
      "*whines*",
      "Daddeh hab wun ob dose...",
      "Dat onwy widdwe babbeh...",
      "Nuuu! Smawty nee' speshow wumps!",
      "Dat fwuffy was in <speaker>'s hewd...",
      "*trembles*",
      "But dat am smawty! Wai nu gib dummeh daddeh sowwy hoofsies?",
      "But... smawties gib bad enfies...",
      "Nu wan be smawty nu mowe...",
    ],
  },

  LOW_HEALTH: [
    "*pant*... *pant*...",
    "*gasp*... *wheeze*...",
    "SCREEEEE!!!!!!",
    "HUHUUHUHUHUUUU!!!!!",
    "*whimper*... *whimper*...",
    "Su... huwties... daddeh... hewp..",
    "Huff...hufff...huwties...",
    "URK!... nee... huggiess.. huu huuu huuuu..",
    "NNNNGGGGG... daddeh... nee.. huggies...pwease..",
    "Huggies nu hewp <speaker>... pwease take 'way huwties daddeh...",
    "Huu huu huuu.....",
    "<Speaker> nu feew pwetty... huu huu... su much huwties..",
    "Wai gib su much huwties... huu huuu.. am gud fwuffy...",
  ],

  // script.js:2205
  // [this][Target/Reason]
  SORRY_STICK: {
    DEFAULT: [
      "SCREEEEE!!!",
      "WAI HUWT <SPEAKER>??",
      "NU HUWT!!!!",
      "NU AM BAD!!!",
      "NU KNU WAT <SPEAKER> DU WONG BUT NEBA DU AGAIN!",
      "HUUU HUU HUU HUUuuuuu...",
      "SKREEEEEEEEEEEEEEEEE-HEEE-HEEE-HEEEEEEeeee...",
      "Nu gib huwtiEEEEEEEEEEEEEEEEEE EEE HE-HEEEEEeeeeees",
    ],
    CHIRPY: [
      "SPEEEEP!!!",
      "PIPIPIPIPI!!!",
      "PEEEEEEEEP!!",
      "CHIIIIIIRP!",
      "PIPIPIPIPIPIPIPPipipipip....",
      "CHIRPCHIRPCHIRPCHIRPCHIRP!",
      "*pagan peeping*",
    ],
    BABY: [
      "SCREEEE!!!!",
      "NU HUWT <TARGET>!!",
      "WAI HUWT <TARGET>??",
      "AM ONWY WITTWE BABBEH!!",
      "WAN' MUMMAH!!! HUU HUU HUU..",
      "<TARGET> NU FEEW PWETTY!!",
      "<TARGET> DUIN NUFFIN WONG!!!",
      "NUUUUUU-HUUU-HUUU-HUUUuuu..",
      "MUMMMAHHHH!!! MUMMMAHHH!!! EEEEK!!",
      "DADDEHH PWEASEEE!!! <TARGET> WUB YU'!!!",
    ],
    TRAINING: [
      "SCREEE! SU SOWWY DADDEH!",
      "<SPEAKER> SOWWY! <SPEAKER> SOWWY!!!",
      "WAS ACKSIDENT! PWOMISE!!",
      "<SPEAKER> wiww make good poopies! PWOMISE!!!",
      "NU MOWE! NU MOWE!! WIWW MAKE GUD POOPIES!!!",
      "SUU MUCH HUWTIESSS... WIWW MAKE ONWY GUD POOPIES N-NICE DADDEH...",
    ],
  },

  SPRAY_BOTTLE: {
    DEFAULT: [
      "SCREEEEE!!!",
      "WAWA BAD FOW FWUFFIES!!!",
      "WAI WAWA?? WAI??",
      "<SPEAKER> NU WAN' WAWA!!",
      "WAWA BAD! WAWA BAD!!!!!",
      "<TARGET> NU WIKE WAWA!!!",
      "EEEEEE!!!!!!!",
      "NU KNU WAT <SPEAKER> DU WONG BUT NEBA DU AGAIN!",
      "HUUU HUU HUU HUUuuuuu...",
      "SKREEEEEEEEEEEEEEEEE-HEEE-HEEE-HEEEEEEeeee...",
    ],
    CHIRPY: [
      "SPEEEEP!!!",
      "PIPIPIPIPI!!!",
      "PEEEEEEEEP!!",
      "CHIIIIIIRP!",
      "PIPIPIPIPIPIPIPPipipipip....",
      "CHIRPCHIRPCHIRPCHIRPCHIRP!",
      "*pagan peeping*",
    ],
    BABY: [
      "SCREEEE!!!!",
      "AM ONWY WITTWE BABBEH!!",
      "WAN' MUMMAH!!! HUU HUU HUU..",
      "<TARGET> NU FEEW PWETTY!!",
      "<TARGET> NU WIKE WAWA!!!",
      "NUUUUUU-HUUU-HUUU-HUUUuuu..",
      "MUMMMAHHHH!!! MUMMMAHHH!!! EEEEK!!",
      "DADDEHH PWEASEEE!!! <TARGET> WUB YU'!!!",
    ],
    TRAINING: [
      "SCREEE! SU SOWWY DADDEH!",
      "<SPEAKER> SOWWY! <SPEAKER> SOWWY!!!",
      "WAS ACKSIDENT! PWOMISE!!",
      "<SPEAKER> wiww make good poopies! PWOMISE!!!",
      "NU MOWE! NU MOWE!! WIWW MAKE GUD POOPIES!!!",
      "SUU MUCH HUWTIESSS... WIWW MAKE ONWY GUD POOPIES N-NICE DADDEH...",
    ],
  },

  THUMBTACK: {
    DEFAULT: [
      "EEEEEEEE!!!!!",
      "SCREEEE!!!",
      "EEEEEEEK!!! NU WIKE!!",
      "PEEP! PEEP!! HUWTSIES!!!",
    ],
    FOAL: ["PIPIPIPIPIPIPIPI!!!!", "PEEEEEEEP!!", "EEEP!! EEP!!!"],
    CHIRPY: ["PIPIPIPIPIPIPIPI!!!!", "PEEEEEEEP!!", "EEEP!! EEP!!!"],
    TRAINING: [
      "SCREEE! SU SOWWY DADDEH!",
      "<SPEAKER> SOWWY! <SPEAKER> SOWWY!!!",
      "WAS ACKSIDENT! PWOMISE!!",
      "<SPEAKER> wiww make good poopies! PWOMISE!!!",
      "NU MOWE! NU MOWE!! WIWW MAKE GUD POOPIES!!!",
      "SUU MUCH HUWTIESSS... WIWW MAKE ONWY GUD POOPIES N-NICE DADDEH...",
    ],
  },

  CATTLE_PROD: {
    DEFAULT: [
      "REEEEEEE!!!!!!!",
      "SHOCKIES!!!!!!!!!!! SCREEEEEEEEEEE!!!!!",
      "EEEEEEEEEEEEEEEEEE NUUUU WIIIIKKKKEEEE!!!!!",
      "NUUUUUUUUUUUUUUU!!!! BUWNIES!!!!!!!!!!",
    ],
    BABY: [
      "EEEEE!!!!!!!! SCREEEEEEEEEEEEE!!!!",
      "PEEEEEEEEEEEEEEEEEEEEEEEP!!",
      "PIPIPIPIPIPIPIPIPIPIPIPIPIPIPI!!!!!",
    ],
  },

  // script.js:2306
  // [this][Target/Reason]
  BRUSH: {
    DEFAULT: [
      "Coo... wub bwushies...",
      "<Speaker> wub bwushies daddeh!!",
      "Wub bwushies! Wub!",
      "Cooo... cooo...",
      "<Speaker> feew suuu pwetty nao...",
      "<Speaker> wook pweety nao daddeh??",
      "Wub....wub...",
      "Cooo... bestest bwushies..",
      "Wub bwushies.. wub daddeh..",
    ],
    CHIRPY: ["Cooo.... coooooo....", "Chirp! Coo....", "Peep! cooo..."],
    TRAINING: [
      "Yay! Daddeh wub good poopies!",
      "Daddeh wike <speaker> good poopies?",
      "Coo... make good poopies...",
    ],
    WITNESS_TRAINING: [
      "<Speaker> wan' be gud fwuffy tuu!",
      "Gud poopies mean wub?",
      "Nee' make gud poopies in boxie...",
      "Daddeh!! <Speaker> am gud fwuffy tuu!! watch <speaker> make gud poopies in boxie!!",
      "Gib <speaker> bwushies too daddeh??",
    ],
  },

  // Amputation
  AMPUTATION: {
    DEFAULT: [
      "SCREEEEEEEEEEEE!!!",
      "WOWSTEST HUWTIES EBAH!!!",
      "SCREEEEE!!!! NU HUWTIES!!!!",
      "HUUU HUUU HUUUUU!!!!!",
      "SCREEEEEEEEEEEEEEEEEE!!!!! PWEAASEEE!!!!",
      "EEEEEEEEEEEEEEEEEEEEEEEEEKK!!!",
      "SCREEEEEEEEEEEEEEEEEEEEEEEEEEEE-HEEEE-HEEE-HEEEEEEE!!",
      "NUUUUUUUUUUU HUU HUU HUUUUUU!!!!",
      "EEEEEEEEEEEEEEEEEK!! HATECHU!!! HATECHU!!!",
      "EEEEEEEEEEEK!!! WAI HUWT <SPEAKER>!!! <SPEAKER> WUB DADDEH!!!",
    ],
    CHIRPY: [
      "SPEEEEEEEEEEEEEEEEE!!!!!",
      "SCREEEEEEEEEEEEEEEEeeee...",
      "*pagan peeping*",
    ],
    LUMPS: [
      "SCREEEEEEE!!! NU TAKE SPESHOW WUMPS!!!",
      "NUUUUUU!!!! SCREEE!!!!! NEE SPESHOW WUMPS!! NEE WUMPS!!!!",
      "<SPEAKER> NEE SPESHOW WUMPS FOW MAKE BABBEHS!!!!!! SCREEEEEEE!!!!!!",
      "NUUUUUUUUU!!! PWEASE GIB SPESHOW WUMPS BACK!!",
      "NUUUUU!!! <SPEAKER> NEE' SPESHOW WUMPS TU BE BESTEST STAWWION!!",
      "EEEEEEEEEK!!! NU TAKE WUMPS!!! MUMMAH SAIB SPESHOW WUMPS MAKE <SPEAKER> BESTEST STAWWION!",
      "SCREEEEEE!!!! PWEASE GIB BACK DADDEH, <SPEAKER> NU AM MAWE!!",
      "EEEEEEEEEEEEEEEE!!!! NU AM MAWE! NU AM MAWE!!",
      "REEEEEEEEEEE!!! D-DADDEH NU WIKE SPESHOW WUMPS??!!",
      "NUUUUUUUUU!!! WAI DADDEH NU WIKE SPESHOW WUMPS?? SPESHOW WUMPS AM BAD??",
      "HUUU HUUU HUUUU!!! WAI TAKE SPESHOW WUMPS!! <SPEAKER> AM STAWWION, NEE' SPESHOW WUMPS!!",
      "SCREEEEEEE!!!! NU TAKE WUMPS DADDEH?? <SPEAKER> WAN' HAB WOTS OB' BABBEHS!!",
      "REEEEEEEE!!!!! PWEASE DADDEH, <SPEAKER> WAN HAB BIGGEST FAMIWY!! GIB WUMPS BACK PWEASE!!",
    ],
  },

  WAN_DIE: [
    "Wan die... wan die...",
    "Huuu... wan die...",
    "Wan die...",
    "WAN DIE...",
    "WAN DIE... WAN DIE... WAN DIE... WAN DIE...",
    "Wan die...*sniff*...wan die...huu huuu...wan die...",
    "Wan die...wan die... wan die..",
  ],

  TRAUMA: {
    BABY: [
      "Huuhuu... mummah awways wub 'ou <target>...",
      "Miss <target>... huuu...",
      "Mummah nee' 'ou <target>...",
      "M-m-mummah.. wub <target>..*Sniff*...<target>..wub..mummah..",
      "Huuu huu... hab dweam pwayin' wit' <target>...",
      "<Speaker> wan' be wif <target> 'gain..",
      "Mummah nee' huggies fwom <target>... huu huuu..",
      "Mummah heaw <target> chiwpies???...nuuu.. huu huu huu...",
      "Mummah hab dweam <target> am sweepies wif' mummah... huu huu...",
      "Miss <target> wawm snuggies... huuu...",
      "Mummah heaw <target>'s widdow chiwpies in dweamie pwace... huu huu..",
      "HUU HUUU HUUUUUU... MUMMAH WAN' <TARGET> BACK!!!! NEE' <TARGET>!! HUUU HUUU HUUUUUU....",
    ],
    MISCARRIAGE: [
      "Huu huu... babbehs...",
      "Miss babbehs... huuhuuhuu...",
      "Tummeh babbehs nu chiwpies fo' mummah... huuuu...",
      "Babbehs am foweba sweepies cuz ob' dummeh mummah's wowstest tummeh... huu huu..",
      "Wai babbehs neba make chiwpies fo' mummah??...huuu..",
      "Mummah tummeh tuu poopie fo' bestest babbehs... huu huu huuu...",
      "Wai mummah nu get babbehs tu hab widdow chiwpie babbehs?? Mummah desewbe babbehs...*sniff*",
      "Mummah wud hab giben babbehs suu many toysies an' miwkies an'... *whimper*... HUU HUU HUUU.....",
      "M...mummah... mummah w-wub b-babbehs ... babbehs w-ub mummah..",
      "Mummah wub babbehs... babbehs f-fowebah s-s-sweepiess.... HUUU HUUUUUUU...",
      "Wan' babbehs fo' suuu wong...Huu huu huuuu...",
      "<Speaker> am wowstest tummeh mummah ebah...",
    ],
    LUMPS: [
      "Huu huu... nu haf speshow wumps nu moaw...",
      "Speshow wumps gone... nu can hab babbehs nu mowe... huuuu...",
      "Mummah? Mummah gif <speaker> speshow wumps agane? Huuhuu...",
      "<Speaker> wan' hab suu many babbehs.. huu huu huuu..",
      "<Speaker> wan' be nu daddeh suu much...",
      "Speshow wumps? Come back tu <speaker> nao?",
      "Nee' speshow wumps tu be bestest daddeh.. huu huu huuuuu...*sniff*",
    ],
    LEGS: [
      "<Speaker> nee weggies... huuuuu....",
      "How time tiww weggies? Huuhuuhuu...",
      "Wai weggies gone? <Speaker> am gud fwuffy! Huu huu...",
      "Nu can pway wif nu weggies... huu huu..",
      "Am wowstest nu weggie fwuffy...",
      "When weggies com' back tu <speaker>?? <Speaker> nee weggies fo' huggies...",
    ],
  },

  // script.js:5073
  // [this][Weapon/Target][Self]
  WITNESS_VIOLENCE: {
    DEFAULT: [
      "HUUUHUUU!!! NU HUWT <TARGET>!!!",
      "NU HUWT!!! NU HUWT <TARGET>!!!",
      "PWEASEEEEEE!!!! NUUUUU!!!! <TARGET>!!!",
    ],
    // Weapons
    GRINDER: {
      DEFAULT: [
        "SCREEEEEE!!!! FWUFFIES NU AM NUMMIES!!!",
        "WAI DADDEH MAEK <TARGET> TU NUMMIES?????",
        "<TARGET>!!! NUUUU!!!!",
        "SOYWENT BWOWN...AM FWUFFIES??? NUUUUU-HUU-HUUUUUUUUUU!!!",
        "NU TUWN <TARGET> INTO NUMMIES!!! <TARGET> AM FWEND!!! NU NUMMIES!!",
        "<SPEAKER> NU WAN' NUM NUMMIE <TARGET>!!! HUU HUU HUU!!!",
        "EEEEEEEEEEEEEEEEEEEEKKKK!!!!! NU CAN WOOK!!!!",
      ],
      FERAL: [
        "SCREEEEEE!!!! FWUFFIES NU AM NUMMIES!!!",
        "WAI MISTAH MAEK <TARGET> TU NUMMIES?????",
        "ONWY WAN' HOUSIE AN' WUB!!! NU MAKE NUMMIES!!!!",
        "NUUUUUUUUU!!!! <TARGET> NU AM NUMMIES!!! <TARGET> AM FWEND FO' NICE MISTAH!!",
      ],
    },
    KNIFE: {
      DEFAULT: [
        "Nuuuu... fwuffies am fow huggies an' wub...",
        "Fwuffies nu fow huwties daddeh... am fow huggies an' wub...",
        "Nuu huu huuu....",
        "F-fwuffy am fo'-EEP!",
        "Pwease nu huwt <target> nu mowe.. <target> am gud fwuffy.. gib heawt happies...",
        "Fwuffys nu am fo' huwties daddeh.. wai daddeh gib huwties?",
        "W-wub <target> nao... pwease??... huu...huuu..",
        "Nuuu.. nuu gib mowe huwties..",
        "Nuu can wook at fwend get huwties nu mowe... huu huu huuuuuu....",
      ],
      FERAL: [
        "Nuuuu... fwuffies am fow huggies an' wub...",
        "Fwuffies nu fow huwties... am fow huggies an' wub...",
        "Nuu huu huuu....",
        "F-fwuffy am fo'-EEP!",
        "Pwease nu huwt <target> nu mowe.. <target> am gud fwuffy.. gib heawt happies...",
        "Fwuffys nu am fo' huwties daddeh.. wai daddeh gib huwties?",
        "W-wub <target> nao... pwease??... huu...huuu..",
        "Nuuu.. nuu gib mowe huwties..",
        "Nuu can wook at fwend get huwties nu mowe... huu huu huuuuuu....",
        "Eeeek! Meanie mistah!!",
        "Meanie nu am nice soon daddeh!!",
      ],
    },
    STICK: {
      DEFAULT: [
        "Nuuuu... fwuffies am fow huggies an' wub...",
        "Fwuffies nu fow huwties daddeh... am fow huggies an' wub...",
        "Nuu huu huuu....",
        "F-fwuffy am fo'-EEP!",
        "Pwease nu huwt <target> nu mowe.. <target> am gud fwuffy.. gib heawt happies...",
        "Fwuffys nu am fo' huwties daddeh.. wai daddeh gib huwties?",
        "W-wub <target> nao... pwease??... huu...huuu..",
        "Nuuu.. nuu gib mowe huwties..",
        "Nuu can wook at fwend get huwties nu mowe... huu huu huuuuuu....",
      ],
      FERAL: [
        "Nuuuu... fwuffies am fow huggies an' wub...",
        "Fwuffies nu fow huwties... am fow huggies an' wub...",
        "Nuu huu huuu....",
        "F-fwuffy am fo'-EEP!",
        "Pwease nu huwt <target> nu mowe.. <target> am gud fwuffy.. gib heawt happies...",
        "Fwuffys nu am fo' huwties daddeh.. wai daddeh gib huwties?",
        "W-wub <target> nao... pwease??... huu...huuu..",
        "Nuuu.. nuu gib mowe huwties..",
        "Nuu can wook at fwend get huwties nu mowe... huu huu huuuuuu....",
        "Eeeek! Meanie mistah!!",
        "Meanie am nu nice soon daddeh!!",
      ],
      TRAINING: [
        "N-nu wan' be bad fwuffy...",
        "Gud poopies gu in boxie...",
        "Nee' membah gud poopies...",
        "Huu huu... nu want sowwy stickies...",
        "Nu wan be wike dat fwuffy!!",
        "<Speaker> a-am' bad poopie fwuffy?",
        "Huu huu huuuuu.... nu wan' wook...",
      ],
    },
    // Targets
    BABY: {
      DEFAULT: [
        "NUUUU!! WAI HUWT <TARGET>??",
        "NU HUWT <TARGET>! TUU WIDDWE!!",
        "SCREEE!!! DADDEH NU!!! <TARGET> TUU WIDDWE TU BE BAD!!!",
        "<TARGET> NUUU!!! WUN TU MUMMAH!!",
        "EEEK!!! <TARGET> WUN WAY FWOM MEANIE DADDEH!!",
        "DADDEH NU HUWT <TARGET> NU MOWE!! <TARGET> AM SPESHOW TU MUMMAH!!",
        "NUUUU!!!! <TARGET>!!!",
        "NU HUWT <TARGET> DADDEH!! <TARGET> AM FO' MUMMAH ONWY!!",
        "B-BABBEH??!!! NUUUUUUU!!!! COM' TU MUMMAH!!",
        "MUMMAH HEAW <TARGET> CWY!! NU MOWE HUWTIES DADDEH!",
      ],
      FERAL: [
        "NUUUU!! WAI HUWT <TARGET>??",
        "NU HUWT <TARGET>! TUU WIDDWE!!",
        "SCREEE!!! MISTAH NU!!! <TARGET> TUU WIDDWE TU BE BAD!!!",
        "PWEASE NU HUWT <TARGET> MEANIE MISTAH!!",
        "<TARGET> AM AWW <SPEAKER> HAB!! PWEASE NU GIB HUWTIES!!",
        "NU HUWT <TARGET>!!! YU GON' GIB <TARGET> FOWEBA SWEEPIES!!",
        "NUUUU HUU!! NU HUWT PWESHUS' <TARGET>!!",
        "<TARGET> AM SUUU WIDDOW!! WAI HUWT?? WAI HUWT??",
      ],
    },
  },

  // Family Attacked

  RELATIVE_KILLED: [
    "NUUUUUUUUUUUU!!!!!! HUUUUUUUUUU HUUUUUUU!!!!!!!!",
    "HUUUUUUUHUUUUUUUUUUUUU!!!! SCREEEEEEEEEEEEEEEEE!!!!!!!!!",
    "NUUUUUUUUUUUUU!!!! SCREEEEEEE!!!!! SCREEEEEEE!!!!! SCREEEEEEEEEEE!!!!!!",
    "SCREEEEEEEEEEEEE!!!! HUUUUU HUUUU HUUUUUU HUUUUUU HUUUUUUU!!!!!",
    "NUUUUUUUUUUUUUUUUUUUU!!!! HUUU HUUU HUUUUUU.....HUUUUU HUUU HUUU HUUUU..... NU WAN'!!!",
    "HUUUU HUUU HUUUUUU.... BIGGEST HEAWT HUWTIES.... WAI???",
    "*Gasp!* NUUUUUUUUUUUUUUUUUUUUUUU!!!!!! PWEASE NU BE FOWEBA SWEEPIES!!!",
  ],

  // [Hurt][Self]
  HURT: {
    DEFAULT: [
      "WOWSTEST OWWIES!!!",
      "REEEEEEEEEEEE!!!!!!!!!!!!!!",
      "HUU HUUUU HUUUUU!!!!! OWWWWWWWIIEEEESSS!!!",
      "SCREEEEEEEEEE- HEEE- HEE- HEEEEEEEEEE!",
      "EEEEEEEEEEEEEEEEEEEEEEEEK!!!! PWEASE NU MOWE!!!!",
      "SKREEEEEEEEEE!!!!! NU MOWE! NU MOWE!!! PWEEE-HEE-HEE-HEEEEEeeeeasee...",
      "EEEEEEEEEK!!!!!",
      "OWWWWWIEEEESSS!!! OWWWIEEESS!!!!! SCREEEEEEEEEEEEE!!!!",
    ],
    CHIRPY: [
      "SPEEEEE!!!!! SPEEP!!! SPEEEEEP!!!!!",
      "SCWEEEEEEEEEEEEEEE!!!!!!!!",
      "REEEEEEEEEEEEEEEE!!!",
      "EEEEEEEEEEEEEEEEEEEEE!!!!",
      "SCREEEEEE-HEE-HEE-HEEEEEEEeeeeee..",
    ],
    ALICORN_BABY: [
      "CHIIIIIIIIIIIIRRP!!!!",
      "PIPIPIPIPIPIPIPIPI!!!!",
      "CHEEEP! CHEEPCHEEEEP!!!",
      "CHIRP! CHIRP! CHIRP!",
    ],
    SMARTY: {
      DEFAULT: [
        "OWWWIES!!!!",
        "HUWTIES!",
        "EEEEK!!",
        "WOWSTEST SCAWDIES!!",
        "NU HUWT!!",
        "HEWPPPP!!!",
        "AACK!",
      ],
      BABY: ["SPEEEEEEP!"],
    },
  },
  // [Attack]
  ATTACK: {
    SMARTY: [
      "SMAWTY GIB HUWTIES!!",
      "SMAWTY GIB BIGGEST OWWIES TO DUMMEH!!",
      "SMAWTY AM BESTEST AT GIBBIN' HUWTIES!",
      "KEEP CWYING, DUMMEH!!",
      "CWY DUMMEH! CWY!! NU WUN GON' SAB' DUMMEH!",
      "SOWWY HOOFSIES!!",
    ],
    ALICORN_BABY: [
      "MUNSTAH BABBEH!!!",
      "NU STEAW MIWKIES MUNSTAH!!",
      "MUMMAH GIB BIGGEST OWWIES TO DUMMEH MUNSTAH BABBEH!!",
      "EEEK!!! MUNSTAH BABBEH!!",
      "GU WAY! GU WAY!!",
      "<SPEAKER> SAID GU WAY MUNSTAH!!",
    ],
    COLOR: {
      DEFAULT: [
        "YICKIE POOPIE FWUFFY!!",
        "MUMMAH NU WUB POOPIE BABBEH!!",
        "GU WAY UGWY POOPIE BABBEH!!",
        "MUMMAH GIB BIGGEST OWWIES TO POOPIE BABBEH!!",
      ],
    },
  },

  ATTACK_COLOR_DEFAULT: [
    "YICKIE POOPIE FWUFFY!!",
    "MUMMAH NU WUB POOPIE BABBEH!!",
    "GU WAY UGWY POOPIE BABBEH!!",
    "MUMMAH GIB BIGGEST OWWIES TO POOPIE BABBEH!!",
  ],

  // Upsies
  UPSIES: {
    DEFAULT: {
      DEFAULT: [
        "Yay! Wub upsies!",
        "Wub daddeh upsies!",
        "Wee!",
        "Bestest upsies!!",
        "Wub upsies!",
        "Pway time daddeh?",
        "Awways wub yu' upsies daddeh!",
        "<Speaker> wub daddeh an' daddeh wub <speaker>!",
        "Whewe we goin daddeh?",
        "Nummie time daddeh?",
        "Daddeh hab supwise fo' <speaker>?",
        "Wee! 'Splorin time!",
        "Wub daddeh! Wub daddeh!!",
      ],
      FERAL: [
        "Upsies! Mistah wub <speaker>?",
        "<Speaker> wub mistah! Mistah taek <speaker> tu nyu housie?",
        "Nee' be gud fwuffy fow mistah be nyu daddeh!",
        "Housie time!",
        "Wiww be gud fwuffy, if mistah am nu daddeh!",
        "N-nyu daddeh??",
        "Be daddeh mistah!!",
        "Yay! Mistah pick <speaker>!",
        "Uppies!! Mistah take <speaker> tu housie!",
      ],
    },
    BAD: {
      DEFAULT: [
        "WAI DADDEH GIB BAD UPSIES??",
        "HUWT! HUWT!",
        "OWWIES! DADDEH PWEEZE WET DOWN!",
        "EEEK!! PWEASE WET DOWN!! NAO!! HAB HUWTIES!!",
        "ACK!! NUUU!!",
        "NUU NUU NUUU!!!!",
        "HUU HUUU HUUU... HUWTIES!!",
        "WAI DADDEH GIB BAD UPSIES??! WET DOWN, WET DOWN!!",
      ],
      FERAL: [
        "MEANIE GIB BAD UPSIES!",
        "SCREEEE! BAD UPSIES!",
        "MEANIE MISTAH! OWWIE UPSIES!",
        "WET DOWN MEANIE MISTAH!!",
        "MISTAH NU HUWT <SPEAKER>! WET DOWN, NU MOWE HUWTIES!!",
      ],
    },
    WITNESS_BABY: {
      DEFAULT: [
        "<TARGET> TUU WIDDWE FOW UPSIES!",
        "UPSIES NU GUD FOW <TARGET>! TUU WIDDWE!!",
        "PWEEZE DADDEH!! WET <TARGET> DOWNSIES!",
        "C-CAWEFUW WIT <TARGET> DADDEH! <TARGET> NU AM TOYSIE!!",
        "'OU AM GIB <TARGET> HUWTIES DADDEH!! WET GU!!",
        "<TARGET> UPSIES AW FO' MUMMAH ONWY!!",
        "EEEEK!! <TARGET> NU WIKE DADDEH UPSIES! WET GU!!",
        "WET GU DADDEH!! GON HUWT <TARGET>!!",
        "NU TAKE <TARGET>!! <TARGET> AM TUU WIDDWE!! MUMMAH NEE' <TARGET>!",
        "B-BABBEH!!! NUUUUUU!!! WET GU' DADDEH, PWEASE!!",
      ],
      FERAL: [
        "<TARGET> TUU WIDDWE FOW UPSIES!",
        "UPSIES NU GUD FOW <TARGET>! TUU WIDDWE!!",
        "PWEEZE MISTAH!! WET <TARGET> DOWNSIES!",
        "NU TAKE <TARGET> MISTAH, <TARGET> AM SUUU SPESHOW TU MUMMAH!!",
        "PWEASE GIB <TARGET> BACK!! NEE MUMMAH TU GWOW BIG A-AN' STWONG!!",
        "WET <TARGET> DOWNSIES!! NAO!!! NU TAKE <TARGET>!!",
        "PWEASE NU TAKE <TARGET>!! <TARGET> WAN' MUMMAH HUGGIES, NICE MISTAH!",
        "<TARGET>!! MAKE JUMPIES!! JUMPIES ON'  MUMMAH!! WET GU' MISTAH!!",
        "<TARGET>!! NUU!! TUU WIDDWE!!",
        "STAWP!!! YU GON' HUWT <TARGET> MISTAH!!",
        "NU TAKE! NU TAKE! MUMMAH WUB <TARGET>!!",
      ],
    },
  },

  DOG_ATTACK: {
    ADOPTED: [
      "*growl BARK* DADDEH PWEASE! MUNSTAH HEWE! PWEASE WET IN SCREEEEEEEAAAAAAGGAGAH!!!!",
      "*grrrr* Hewwo bawky munstah! Daddeh nu wan <speaker> insies nu mowe a-EEEEEKKKK!!!!",
      "GU WAY!! GU WAY!!! *RIP* *TEAR* EEEEEEEEKK!!! DADDEHHhhhh... *Hurk!*...*Munch!* *Crunch*",
      "NUUU!!! HEWP DADDEH!!! *CRACK!* EEEEEEEEK!!!! SU MUCH BOO-BOO JOOSE...HUUU HUUU HUU*Hurk*",
      "DADDEH NU SABE <SPEAKER>??? EEEEK!!!...*RIP* Nuu... nuu num <speaker>.. <Speaker> am getting sweepies..*Gulp* *pant* *pant*",
    ],
    DEFAULT: [
      "*growl* Uh... hewwo nice bawky munstAAAAAAAAAAGGHHHH!!!!",
      "*grrrrr* Hewwo bawky munstah! Hab housie fo' fwuff-EEEEEEEEEEEEEEEEEEEEEK! *SNNNNNNAP!!!* *RIP* *TEAR* NNNNNNNNNGGGGGGGGG!!!! *gurgle* *gasp*",
      "HEWPP!!! BAWKIE MUNSTAH AM GIB SU MANY HUWTIES!!! *GROWL* *CHOMP* EEEEEEEEEEK!! NU NUM TUMMEH SKETTIS!!! *MUNCH MUNCH MUNCH*... huuuu huu huu... wan die...",
    ],
  },

  HELD_NEAR_GRINDER: {
    DEFAULT: [
      "NUUUUUUUU!!!",
      "PWEEEEEEZEEEEEE NU DWOP FWUFFYYYY!!!!",
      "NU WAN BE NUMMIES!!!!!",
      "NU WAN DIE!!! NU WAN DIE!!!!!",
      "WAN' WIVE!!! WAN WUB DADDEH!! PWEASE!!!",
      "NU GIB TU METAW MUNSTA FO' NUMMIES!!! PWEEASE!!",
      "HUUU HUUU HUUUUUUUUUUUU...",
      "*Haff*..*Haff*.. F-FWUFFY NU WAN DIE!!",
      "NU AM NUMMIES! NU AM NUMMIES!! AM <SPEAKER>!! AM FWEND!!!",
    ],
    ADOPTED: [
      "PWEEEEZE DADDEH!!! PWOMISE BE GUD!!!!",
      "<SPEAKER> WIWW NUM AWW DA POOPIES DADDEH!! PWEASE NU WET GU!!",
      "<SPEAKER> WIWW BE BESTEST FWUFFY EBAH FO' DADDEH!! PWEASE NU WET <SPEAKER> BE NUMMIES!!",
      "<SPEAKER> HAB WOWSTEST HEAWT HUWTIES DADDEH!! NU WUB <SPEAKER> NU MOWE??!",
      "WAI TUWN <SPEAKER> TU NUMMIES!! AM GUD FWUFFY!! AM GUD FWUFFY!!",
    ],
    FERAL: [
      "PWEEZE NICE MISTAH PWOMISE AM GUD FWUFFY!!!!!",
      "<SPEAKER> ONWY WAN' NICE HOUSIE!!!",
      "EBEN NICE MISTAH NU WUB <SPEAKER>??!!!",
      "WAI TUWN <SPEAKER> TU NUMMIES!! WIWW BE GUD FWUFFY!! WIWW BE GUD FWUFFY!!",
    ],
  },

  SMARTY_CHASE: {
    DEFAULT: [
      "DUMMEH MAWE WAN ENFIES NAO!",
      "DUMMEH MAWE ONWY GUD FOW ENFIES!!",
      "ENFIE MAWE GIB SMAWTY GUD FEEWS NAO!!",
      "WAN GUD FEEWS!!",
      "DUMMEH MAWE! ENFIE TIME!",
    ],
    MARE: [
      "DUMMEH MAWE WAN ENFIES NAO!",
      "DUMMEH MAWE ONWY GUD FOW ENFIES!!",
      "ENFIE MAWE GIB SMAWTY GUD FEEWS NAO!!",
      "WAN GUD FEEWS!!",
      "DUMMEH MAWE! ENFIE TIME!",
    ],
    STALLION: [
      "DUMMEH STAWWION WAN ENFIES NAO!",
      "DUMMEH STAWWION ONWY GUD FOW ENFIES!!",
      "ENFIE STAWWION GIB SMAWTY GUD FEEWS NAO!!",
      "WAN GUD FEEWS!!",
      "DUMMEH STAWWION! ENFIE TIME!",
    ],
  },

  CANNIBAL: {
    ATTACK: {
      DEFAULT: [
        "HUUUUU!!!! SU SOWWY FWIEND!!!!!",
        "<SPEAKER> AM BAD HUUUHUUUU!!! NU WAN NUM OTHA FWUFFIES!!!",
        "Fwuffies nu am nummies... bu' su hungwy...",
        "Nee' nummies... huu huu huuuu..",
        "SU SOWWY!!!",
        "Pwease nu make huwtie noisies nu mowe.. gib <speaker> wowstest heawt huwties..",
        "Huuuu huuu huuuu...",
        "WUB YU' FWEND!! SUU SOWWY!!! HUU HUUUU...",
      ],
    },
    EAT: {
      DEFAULT: [
        "*hack* *kaff* su much fwuff...",
        "Nu wike nummin' fwuffy huuu....",
        "*Gag* Tuu much fwuff...",
        "<Target> nu am nummies... bu' suuuu hungwy...",
        "Wan' pway wif fwuffies.. nu num fwuffies...",
        "Fwend nu taste pwetty... huu huu huuuu...",
        "*KRACK!!* *CRUNCH!!*",
      ],
    },
  },

  // update() if placed on operating table
  OPERATING_TABLE: {
    DEFAULT: [
      "Waow... su high upsies...",
      "Daddeh, wet <speaker> down? Am wittwe scawedies!",
      "Nu wan faww downsies!",
      "Su cowdies.. wai am put <speaker> hewe daddeh?",
      "Daddeh... can <speaker> gu down?",
      "Can daddeh take <speaker> downsies pwease?",
      "Hab nummies fow <speaker> hewe daddeh?",
      "Daddeh? Wai am wook at <speaker> wike dat?",
    ],
    FEAR: {
      DEFAULT: [
        "NUUUUUUU!!!! NU WAN OWWIES!!!",
        "DADDEH WET DOOOOWNNNN!!!! PWOMISE BE GUD!!!!!",
        "SCREEEEEEEEE!!!! DIS AM OWWIE PWACE!!!!!",
        "NU WIKE NU WIKE NU WIKE!!!!",
        "PWEASEEEEEE DADDEH!!! NU WAN BE DUMMEH FWUFFYYYY!!!! WAN WUN AN' PWAY!!!",
        "PWEASEEE!!! UDDA FWUFFIES NU WIKE DUMMEH FWUFFIES!!",
        "HUUUU HUUU HUUUUUUUU... PWEASE!!!!! PWEEEEEE-HEEEE-HEEESSE!!",
        "NUUUU HUU HUUUUUU... PWEASE!!! W-WUB <SPEAKER>??",
        "DADDEH NUU!!!!! PWEASE NU!!! WIWW BE BESTEST FWUFFY EBA!!",
      ],
      LEGS: [
        "NU WAN WOSE WEGGIES!!!!",
        "<SPEAKER> NEE WEGGIES DADDEH!!!",
        "NEE WEGGIES FOW WUN AN' PWAY!!!",
        "HOW GIB HUGGIES WIF NU WEGGIES???!!",
        "NEE' WEGGIES PWEASE!!!",
        "NEE' WEGGIES TU GIB DADDEH HUGGIES!!!",
        "HUUU HUU HUUU!!!!! WEGGIES!!!! NUUUU!!",
        "NU TAKE WEGGIES!!! HATECHU DADDEH!! HATECHU!!",
        "UDDA FWUFFIES WIWW GIB DUMMEH <SPEAKER> WOWSTEST HUWTIES!! PWEASE NU TAKE WEGGIES!!",
      ],
      LUMPS: [
        "REEEEEEEE!!!!! NU WAN WOSE WUMPS!!!!",
        "NEE SPESHOW WUMPS!!!! NEEEEEE WUMMPPPPPPSSS!!!!",
        "<SPEAKER> NEE WUMPS FOW BE STWONG STAWWION!!!!",
        "B-BU <SPEAKER> NEE' WUMPS!! WAN' TU BE BESTEST DADDEH!!",
        "NEE' WUMPS TU BE BESTEST DADDEH!!! HUU HUU...",
        "PWEASE NU TAKE WUMPS!!!! WAN' BE STAWWION!! NU AM MAWE!!",
        "NUUUUUUUUUUUUU-HUUUUU!!! WAN' HAB ENFIES!! NU TAKE WUMPS!!",
        "NEE' WUMPS!! NEE' WUMPS!! NUUU!!!",
        "D-DADDEH?? WEAVE WUMPS AWONE!!",
      ],
    },
  },

  PROPOSE_FRIEND: [
    "Nyu fwen?",
    "<Target> am nyu fwen?",
    "Wan' pway wif <speaker>?",
    "<Speaker> wan pway wiff yu!",
    "Wan' be nyu fwen?",
    "Am nyu fwen' fo' <speaker>?",
  ],
  REJECT_FRIEND_COLOR: [
    "YICKIE POOPIE FWUFFY!!!",
    "NU WAN POOPIE FWEN!!",
    "GU WAY DUMMEH POOPIE FWUFFY!",
    "FWUFFY TUU UGWY FOW BE FWENS!!",
  ],
  ACCEPT_FRIEND: [
    "Yay! Nyu fwen!",
    "<Speaker> wub nyu fwen!",
    "Nyu fwend am bestest fwend!",
    "Gon' hab suu much funsies!!",
    "Wub fwen!",
    "Fwen am <speaker>'s fabowite!",
  ],

  REUNION: {
    MOTHER: ["MUMMAH!!! MUMMAH BACK!!!"],
    BABY: [
      "<TARGET> AM BACKSIES YAYYY!!!!",
      "<TARGET> BACK! MUMMAH MISS <TARGET> SUU MUCHIES!!",
      "<TARGET>!!! AM BACKSIES!!! WUB <TARGET>!!",
      "<TARGET>??? <TARGET>??!!! <TARGET> COME BACKIES TU MUMMAH!!! <TARGET> WUB MUMMAH!!!",
      "MUMMAH HAB BESTEST HEAWT HAPPIES <TARGET>!! <TARGET> COM' BACK TU MUMMAH!!",
      "HUUU HUUU HUUUU... AM SUU HAPPIES... <TARGET> WUB MUMMAH 'GAIN!!",
      "B-BABBEH AM BACK?? WUB YU SUU MUCH!! FANK YU!! FANK YU!!!",
      "FANK YU SUU MUCH FOW GIB <TARGET> BACK!!! WUB <TARGET> MOWE DEN ANYFING!!",
      "EEEEE!!! <TARGET> AM BACK!!! FANK YU!! FANK YU!!! FANK YU!!!!!",
    ],
    BROTHER: [
      "YAAY!!! BWUDDA AM BACKSIES!!!",
      "BWUDDA!!! YAYY!!!!",
      "YAYY!!! CAN PWAY GAMSIES WIF BWUDDA NAO!!",
      "WUB BWUDDA!!! AM SUUU HAPPIES!!",
      "BWUDDA!!!",
    ],
    SISTER: [
      "<TARGET>!!! <TARGET> BACK!!!",
      "MISS YU <TARGET>!!! WUB YU!!!",
      "S-SISSIE?? <TARGET> STIWW WUB <SPEAKER>?? YAYYY!",
      "<TARGET>!!!!",
    ],
    FATHER: ["<TARGET> AM BACKSIES!!! FWUFFY DADDEH AM BACKSIES!!!!"],
    SPECIAL_FRIEND: {
      DEFAULT: [
        "SPESHOW FWEN AM BACK! MISS SPESHOW FWEN SU MUCHIES!!!",
        "SPESHOW FWEN'!!! YAY!!!",
        "<SPEAKER> MISS YU SUUUU MUCH SPESHOW FWEN'!!!!",
        "SPESHOW FWEN!!! MISS YU SUU MUCH!!",
        "SPESHOW FWEN'!! SPESHOW FWEN' AM BACKSIES!! WUB YU SPESHOW FWEN'!!",
      ],
      HETERO: [
        "SPESHOW FWEN AM BACK! MISS SPESHOW FWEN SU MUCHIES!!!",
        "YAY!!!! GON HAB SUU MANY NYU BABBEHS WIF SPESHOW FWEN' NAO!!",
        "SPESHOW FWEN'!!! YAY!!!",
        "<SPEAKER> MISS YU SUUUU MUCH SPESHOW FWEN'!!!!",
        "SPESHOW FWEN!!! MISS YU SUU MUCH!!",
        "SPESHOW FWEN'!! SPESHOW FWEN' AM BACKSIES!! WUB YU SPESHOW FWEN'!!",
      ],
      REJECT: [
        "Wha... owd speshow fwen am back? Bu' hab nyu speshow fwen nao...",
        "B-b-buh wike nyu speshow fwend! Wai am owd speshow fwend backsies?",
        "Am dat owd speshow fwend?? Nu can hab tu speshow fwends!",
        "Uhhm.. owd speshow fwend?? Bu' awweady hab nyu stwong speshow fwen'! Wai am owd speshow fwen backsies??",
        "OWD SPESHOW FWEN'??? Am suu sowwy... hab nu speshow fwen'... wub nyu speshow fwen...",
      ],
    },
  },
  // Separated from a friend or family member by a pen fence (Fence.js).
  // INSIDE = the speaker is the one shut in the pen, OUTSIDE = the other one is.
  PENNED: {
    FRIEND: {
      INSIDE: [
        "Fwen! Fwen! Come pway wif <speaker>!",
        "Wan go pway wif <Target>... mean fence nu wet <speaker> out...",
        "Wai <speaker> stuck in dis box? Fwen am ova dewe...",
        "Mistah fence, pwease wet <speaker> go see fwen!",
        "<Target>!! <Speaker> am hewe! Nu fowget <speaker>!",
      ],
      OUTSIDE: [
        "<Target> stuck in fence... nu am faiw...",
        "Dummeh fence! Wet fwen out!",
        "<Speaker> miss fwen... wan pway wif <Target>...",
        "Fwen? Fwen can come out an' pway?",
      ],
    },
    SPECIAL_FRIEND: {
      INSIDE: [
        "SPESHOW FWEN'! <Speaker> wan be wif speshow fwen'!",
        "Nu can weach speshow fwen'... huu huu...",
        "Speshow fwen' am so cwose... bu' fence am in de way...",
      ],
      OUTSIDE: [
        "Speshow fwen' stuck in fence! Nu weave speshow fwen'!",
        "<Speaker> wiww wait hewe fow speshow fwen'...",
        "Pwease wet speshow fwen' out! Miss speshow fwen' su much!",
      ],
    },
    MOTHER: {
      INSIDE: [
        "Mummah! Mummah! Wan be wif mummah!",
        "Mummah am ova dewe... nu can go tu mummah... huu huu...",
        "MUMMAH! <Speaker> am stuck! Hewp!",
      ],
      OUTSIDE: [
        "Mummah stuck in fence! Nu take mummah 'way!",
        "Mummah? Mummah come back tu <speaker>?",
        "Wan mummah! Wan huggies fwom mummah!",
      ],
    },
    BABY: {
      INSIDE: [
        "Babbeh! Mummah am hewe babbeh! Nu cwy!",
        "Wet mummah out! Babbeh nee' mummah!",
        "HUU HUU... babbeh am so cwose bu' mummah nu can weach...",
      ],
      OUTSIDE: [
        "Babbeh stuck in fence! Wet babbeh go!",
        "Nu take babbeh fwom mummah! Pwease!",
        "Mummah am hewe babbeh! Mummah nu go 'way!",
      ],
    },
    FATHER: {
      DEFAULT: [
        "Daddeh! Daddeh ova dewe!",
        "Wan be wif daddeh...",
      ],
    },
    SIBLING: {
      DEFAULT: [
        "Wan pway wif <Target>... fence am in de way...",
        "<Target>! Come ova hewe!",
        "Miss <Target>...",
      ],
    },
    CHIRPY: ["Peep... peep...", "*sad chirp*", "Peep? Peep peep!"],
    REUNITED: [
      "<Target>!!! Togedda 'gain! Yay!",
      "Nu mowe fence! Huggies!",
      "Bestest happies! Can pway wif <Target> 'gain!",
      "Yay! <Speaker> nu am stuck nu mowe!",
    ],
  },
  RETURN_HOME_REMARK: [
    "HUUUHUUUUU!!!! DADDEH BACK! <SPEAKER> TINK DADDEH GONE FOWEBAH!!!",
    "WAI DADDEH WEAVE <SPEAKER>? HUUU!!",
    "YAAAYYY!!! DADDEH BACK DADDEH BACK!!",
    "DADDEH AM GON FOWE SUUU WONG!!!",
    "DADDEH!!! DADDEH!!! BWING GUD NUMMIES BACK FOWE <SPEAKER>??",
    "YAY!!! DADDEH BACK!! <SPEAKER> HAB WOWSTEST SCAWDIES!!",
    "DADDEH NU AM FOWEBA SWEEPIES!!! YAY!!!",
    "DADDEH!! DADDEH!! <SPEAKER> MISS YU DADDEH!!",
    "DADDEHHH!!! YAY!!",
    "DADDEH!!! PWEASE NU WEAVE <SPEAKER> EBA 'GAIN!!",
    "DADDEH!! <SPEAKER> AWMOST HAB WOWSTEST SCAWDIES!! WUB DADDEH!!",
    "DADDEH BACK!! DADDEH BACK!!",
    "NEE' DADDEH FOWE' BESTEST HAPPIES!! YAY!!!",
    "BIGGEST HEAWT HAPPIES!! DADDEH AM BACKSIES!!",
  ],

  NAME: {
    CHIRPY: ["Chirp! Peep! Peep!", "Chearp chearp!"],
    DEFAULT: ["<Speaker> wub nyu namesie!", "Am cawwed <speaker> nao? Wub!"],
  },

  BED: {
    CLAIM: [
      "Hab su' nice cozy sweepie pwace!",
      "Nyu sweepies spot!! *happeh dancie*",
      "<Speaker> wub dis cozy sweepie pwace!",
      "Wook! hab speshow sweepies spot jus' fow <speaker>!",
      "Su' softies sweepie pwace!! Wub!!",
    ],
    CLAIM_PARTNER: [
      "Speshow fwen sweepies hewe too!! su' happeh!!",
      "Nao can hab sweepies wif speshow fwen!! bestesh!!",
      "*nuzzles* Sweepies togedda wif speshow fwen!",
      "Speshow fwen! com hab cozy sweepies togedda hewe!!",
    ],
    SLEEP: [
      "*yawn* time fow sweepies in cozy pwace..",
      "Su' softies sweepie pwace... *yawn*",
      "Haf bestest sweepies hewe...",
      "Cozy sweepie pwace make heawt happies..",
      "*settles in* Su' cozy an' wawm...",
    ],
    BOX_SLEEP: [
      "Boxie am otay...",
      "<Speaker> wish <speaker> hab bettah bedsies...",
      "Nu wike boxie but am bettah than sweeping on gwoundsies...",
      "Huu... boxie stiww am cowdsies...",
    ],
  },
  COMPLAIN_BLINDFOLD: ["EEEEK!! See-pwaces nu wowkin'!!!"],
  COMPLAIN_WINGJACKET: [
    "Nu wike itchy jackie!",
    "Daddeh pwease taek off jackie? Nu wike!",
    "Jackie am su itchies!!! Nu wike!",
  ],
  COMPLAIN_WINGJACKET_WINGS: ["Dummeh jackie!!! Wet <speaker> fwap wingies!!"],
  CASTRATION_BAND_PAIN: {
    DEFAULT: [
      "SCREEEEEEEEEEEEEE!!!! WUMPS HUWTIES!!!",
      "NU MOAW WUMPS HUWTIES!!! NU MOAW!!!!!",
      "REEEEEEEEE!!!!!!!!! PWEASE HEWP WUMPS!!! NEE WUMPS!!!!",
    ],
    BABY: ["EEEEEEE!!!!", "PIPIPIPI!!!!!", "PEEEP!!!! PEEEEEEEEEEP!!!"],
  },
  CASTRATION_BAND_FINISH: {
    DEFAULT: [
      "REEEEEEEEEEEEEEEEE!!!!!!!!!!!",
      "SCREEEEEAEAAAAAAARRRGGH!!!",
      "EEEEE!!! EEEE!!!!! REEEEEEEEEE!!!!!!!",
    ],
    BABY: [
      "EEEEE!!!!!!!! SCREEEEEEEEEEEEE!!!!",
      "PEEEEEEEEEEEEEEEEEEEEEEEP!!",
      "PIPIPIPIPIPIPIPIPIPIPIPIPIPIPI!!!!!",
    ],
  },
  CASTRATION_BAND_MATING: {
    DEFAULT: [
      "SCREEEEEEEEEE!!!! BIGGEST WUMPS HUWTIES!!!!!",
      "WOWSTEST WUMP HUWTIES EBAH!!!!!!!!!!!",
    ],
    BABY: ["EEEEEEE!!!!", "PIPIPIPI!!!!!"],
  },
};

function getDialogue(keys = [], speaker = null, target = null) {
  // Set from string, set defaults, destructure
  if (typeof keys === "string") keys = [keys];
  keys = keys.map((k) => k?.toUpperCase());
  [key1 = "DEFAULT", key2 = "DEFAULT", key3 = "DEFAULT"] = keys;
  // Go down the list of options, because not all dialogues use 3 keys, and in case of bad keys
  let text =
    DIALOGUE[key1]?.[key2]?.[key3] ??
    DIALOGUE[key1]?.[key2]?.["DEFAULT"] ??
    DIALOGUE[key1]?.["DEFAULT"]?.[key2] ??
    DIALOGUE[key1]?.[key2] ??
    DIALOGUE[key1]?.["DEFAULT"] ??
    DIALOGUE[key1];

  if (!text && key1.includes("_")) {
    const parts = key1.split("_");
    const p1 = parts[0];
    const p2 = parts.slice(1).join("_");
    text =
      DIALOGUE[p1]?.[p2]?.[key2] ??
      DIALOGUE[p1]?.[p2]?.["DEFAULT"] ??
      DIALOGUE[p1]?.[p2] ??
      DIALOGUE[p1]?.["DEFAULT"] ??
      DIALOGUE[p1];
  }
  if (!text && DIALOGUE[key1 + "_" + key2]) {
    text = DIALOGUE[key1 + "_" + key2];
  }
  // Get random from array
  if (Array.isArray(text)) text = text[Math.floor(Math.random() * text.length)];
  // debug
  if (typeof text !== "string") return key1 + "_" + key2 + "_" + key3;

  const formatName = (name, code) => {
    let processedName = name.replace(/[lr]/g, "w").replace(/[LR]/g, "W");
    if (code === "<SPEAKER>" || code === "<TARGET>") {
      return processedName.toUpperCase();
    }
    // First letter capitalized
    return (
      processedName.charAt(0).toUpperCase() +
      processedName.slice(1).toLowerCase()
    );
  };

  const getFwuffyLabel = (code) => {
    if (code === "<SPEAKER>" || code === "<TARGET>") return "FWUFFY";
    if (code === "<Speaker>" || code === "<Target>") return "Fwuffy";
    return "fwuffy";
  };

  // Handle Speaker
  const speakerCodes = ["<speaker>", "<Speaker>", "<SPEAKER>"];
  for (const code of speakerCodes) {
    if (text.includes(code)) {
      let replacement = getFwuffyLabel(code);
      if (speaker && fluffyNames[speaker.id]) {
        replacement = formatName(fluffyNames[speaker.id], code);
      }
      text = text.split(code).join(replacement);
    }
  }

  // Handle Target
  const targetCodes = ["<target>", "<Target>", "<TARGET>"];
  for (const code of targetCodes) {
    if (text.includes(code)) {
      let replacement = getFwuffyLabel(code);
      if (target) {
        if (fluffyNames[target.id]) {
          replacement = formatName(fluffyNames[target.id], code);
        } else if (speaker) {
          // Fallback to relationship label
          const rels = relationships[speaker.id];
          const relType = rels ? rels[target.id] : null;

          let label = "fwuffy";
          if (
            relType === "baby_child" ||
            relType === "child" ||
            relType === "estranged_child" ||
            relType === "dead_baby_child"
          ) {
            label = "babbeh";
          } else if (relType === "brother") {
            label = "bwuddah";
          } else if (relType === "sister") {
            label = "sissie";
          } else if (relType === "special_friend") {
            label = "speshow fwen";
          } else if (relType === "mother") {
            label = "mummah";
          } else if (relType === "father") {
            label = "daddeh";
          }

          if (code === "<TARGET>") replacement = label.toUpperCase();
          else if (code === "<Target>")
            replacement = label.charAt(0).toUpperCase() + label.slice(1);
          else replacement = label;
        }
      }
      text = text.split(code).join(replacement);
    }
  }

  return text;
}

function filterMuffled(text, mufflingDegree = 0.5) {
  if (!text) return text;
  // Replace some vowels or characters to make it sound muffled
  // Avoid changing any letters in sections formatted as SCRE + (any number of Es)
  const muffled = text.replace(/(SCRE+)|([aeiouAEIOU])/g, (m, p1, p2) => {
    if (p1) return p1;
    return Math.random() < mufflingDegree ? "..." : p2;
  });
  return `${muffled}`;
}

function filterBabyTalk(text, growth) {
  if (!text) return text;
  const words = text.split(" ");
  const filteredWords = [];

  const replacementChance = 0.5 * (1.0 - growth);
  const insertionChance = 0.333 * (1.0 - growth);
  const stutterChance = 0.5 * (1.0 - growth);

  for (let i = 0; i < words.length; i++) {
    // Replacement check
    if (Math.random() < replacementChance) {
      filteredWords.push(Math.random() < 0.5 ? "*chirp*" : "*peep*");
    } else if (Math.random() < stutterChance) {
      filteredWords.push(words[i][0] + "..." + words[i]);
    } else {
      filteredWords.push(words[i]);
    }

    // Insertion check
    if (Math.random() < insertionChance) {
      filteredWords.push(Math.random() < 0.5 ? "*chirp*" : "*peep*");
    }
  }

  return filteredWords.join(" ");
}
