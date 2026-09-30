// Day and night, seasons and weather (WorldTime.js)
const { check, checkEqual } = require("./helpers");

module.exports = [
  {
    name: "world time: clock, days, seasons and night",
    run: async (page) => {
      const r = await page.evaluate(() => {
        gameState = "PAUSED";
        const at = (t) => {
          timePlayed = t;
          return { text: describeWorldTime(), season: getSeason(), night: nightAmount(), isNight: isNightTime() };
        };
        const res = {
          start: at(0),
          noon: at(4 * HOUR_LENGTH),
          evening: at(11.5 * HOUR_LENGTH), // 7:30 PM
          midnight: at(16 * HOUR_LENGTH),
          day5: at(4 * DAY_LENGTH),
          day10: at(9 * DAY_LENGTH),
          day13: at(12 * DAY_LENGTH),
        };
        timePlayed = 0;
        gameState = "PLAYING";
        return res;
      });
      checkEqual(r.start.text, "Day 1 · 8:00 AM", "new game clock");
      checkEqual(r.start.season, "Spring", "first season");
      checkEqual(r.noon.night, 0, "darkness at noon");
      checkEqual(r.evening.text, "Day 1 · 7:30 PM", "evening clock");
      check(r.evening.night > 0.4 && r.evening.night < 0.6, `darkness at 7:30 PM: ${r.evening.night}`);
      checkEqual(r.midnight.night, 1, "darkness at midnight");
      check(r.midnight.isNight && !r.noon.isNight, "night/day");
      checkEqual(r.day5.season, "Summer", "season on day 5");
      checkEqual(r.day10.season, "Winter", "season on day 10 (3-day seasons)");
      checkEqual(r.day13.season, "Spring", "a new year on day 13");
    },
  },
  {
    name: "world time: fluffies go to bed sooner at night and sleep longer",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene();
        const f = new Horse(1, null, "INDOORS", "earthy");
        f.hunger = 1;
        f.happiness = 0.8;
        fluffies.push(f);
        const sleep = f.brain.desires.find((d) => d.name === "Sleep");
        f.sleepDeprivation = 0.4;
        timePlayed = 4 * HOUR_LENGTH; // noon
        const day = sleep.evaluate(f);
        const dayRates = sleepRateMultipliers();
        timePlayed = 16 * HOUR_LENGTH; // midnight
        const night = sleep.evaluate(f);
        const nightRates = sleepRateMultipliers();
        return { day, night, dayRates, nightRates };
      });
      checkEqual(r.day, 0, "sleep urge at noon when a bit tired");
      checkEqual(r.night, 60, "sleep urge at midnight when a bit tired");
      check(r.nightRates[0] > r.dayRates[0] && r.nightRates[1] < r.dayRates[1], "night: tire faster, rest slower");
    },
  },
  {
    name: "weather: rain fades in, soaks fluffies outside, sends park fluffies under trees, grows grass",
    run: async (page) => {
      const r = await page.evaluate(() => {
        __clearScene("PARK");
        __clearScene("OUTDOORS");
        __seedRandom(3);
        timePlayed = 2 * HOUR_LENGTH; // 10 AM
        changeScene("INDOORS");
        weatherState = freshWeatherState();
        weatherState.until = 1e9;
        const dryGrowth = growthMultiplier("grass");
        setWeather("rain", 5);
        weatherState.until = 1e9;
        updateWorldTime(20); // old weather fades out
        updateWorldTime(20); // rain fades in
        const res = { type: weatherState.type, intensity: weatherState.intensity, text: describeWeather() };
        res.rainGrowth = growthMultiplier("grass");
        res.dryGrowth = dryGrowth;
        // Out in the rain
        const out = new Horse(1, null, "OUTDOORS", "earthy");
        out.x = 600;
        out.y = 500;
        out.happiness = 0.8;
        const inside = new Horse(1, null, "INDOORS", "earthy");
        inside.happiness = 0.8;
        fluffies.push(out, inside);
        for (let i = 0; i < 30; i++) updateWorldTime(1);
        res.outHappy = out.happiness;
        res.inHappy = inside.happiness;
        // In the park: heads for the nearest tree
        const tree = PARK_SCENERY.find((t) => t.kind === "tree");
        const p = new Horse(1, null, "PARK", "earthy");
        p.x = tree.x + 250;
        p.y = tree.y + 40;
        p.hunger = 1;
        fluffies.push(p);
        const shelter = p.brain.desires.find((d) => d.name === "Shelter");
        res.shelterScore = shelter.evaluate(p);
        shelter.execute(p);
        res.target = Math.hypot(p.targetX - tree.x, p.targetY - tree.y);
        p.x = tree.x;
        p.y = tree.y + 10;
        p.initBehavior("IDLE");
        res.stayScore = shelter.evaluate(p);
        // Winter: no berries, little grass, snow makes outdoor fluffies hungry
        timePlayed = 10 * DAY_LENGTH;
        res.winterBerries = growthMultiplier("berries");
        setWeather("snow");
        updateWorldTime(20);
        updateWorldTime(20);
        res.snowHunger = weatherHungerMultiplier(out);
        res.snowHungerInside = weatherHungerMultiplier(inside);
        timePlayed = 2 * HOUR_LENGTH;
        return res;
      });
      checkEqual(r.type, "rain", "weather");
      checkEqual(r.intensity, 1, "rain strength after fading in");
      checkEqual(r.text, "Spring · Rain", "weather label");
      check(r.rainGrowth > r.dryGrowth, "rain should make grass grow faster");
      check(r.outHappy < 0.78 && r.inHappy >= 0.79, `happiness out ${r.outHappy.toFixed(3)} / in ${r.inHappy.toFixed(3)}`);
      checkEqual(r.shelterScore, 49, "urge to run for cover");
      check(r.target < 60, `runs to the tree (ends ${Math.round(r.target)}px away)`);
      checkEqual(r.stayScore, 47.5, "stays under the tree");
      checkEqual(r.winterBerries, 0, "berry growth in winter");
      check(r.snowHunger > 1.3 && r.snowHungerInside === 1, `snow hunger out ${r.snowHunger} / in ${r.snowHungerInside}`);
    },
  },
  {
    name: "weather: saved and loaded; drawing works in every weather",
    run: async (page) => {
      const r = await page.evaluate(async () => {
        gameState = "PAUSED";
        weatherState = { type: "storm", target: "storm", intensity: 0.7, until: 1e9, snowCover: 0.4 };
        await saveGame("__automated_test__");
        weatherState = freshWeatherState();
        await loadGame("__automated_test__");
        await saveManager.delete("__automated_test__");
        const back = JSON.stringify(weatherState);
        const c = document.createElement("canvas").getContext("2d");
        const errors = [];
        for (const scene of ["PARK", "OUTDOORS", "INDOORS"]) {
          for (const type of ["clear", "cloudy", "rain", "storm", "snow"]) {
            for (const t of [0, 11 * HOUR_LENGTH, 16 * HOUR_LENGTH]) {
              try {
                currentScene = scene;
                timePlayed = t;
                weatherState = { type, target: type, intensity: 1, until: 1e9, snowCover: 1 };
                drawWeatherGround(c);
                drawSkyAndWeather(c);
              } catch (e) {
                errors.push(`${scene}/${type}/${t}: ${e.message}`);
              }
            }
          }
        }
        currentScene = "INDOORS";
        timePlayed = 0;
        weatherState = freshWeatherState();
        weatherState.until = 1e9;
        gameState = "PLAYING";
        return { back, errors };
      });
      checkEqual(r.back, JSON.stringify({ type: "storm", target: "storm", intensity: 0.7, until: 1e9, snowCover: 0.4 }), "weather after loading");
      checkEqual(r.errors.length, 0, "drawing errors: " + r.errors.join("; "));
    },
  },
];
