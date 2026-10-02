let audioCtx = null;
const sounds = {};
const soundSources = {
  sorry_stick: "assets/sounds/sorry_stick.wav",
  knife: "assets/sounds/knife.wav",
  amputation: "assets/sounds/amputation.wav",
  fluffy_move: "assets/sounds/fluffy_move.wav",
  fluffy_angry: "assets/sounds/fluffy_angry.ogg",
  fluffy_death: "assets/sounds/fluffy_death.ogg",
  fluffy_enf: "assets/sounds/fluffy_enf.ogg",
  fluffy_happy: "assets/sounds/fluffy_happy.ogg",
  fluffy_sad: "assets/sounds/fluffy_sad.ogg",
  fluffy_scree: "assets/sounds/fluffy_scree.ogg",
  fluffy_shitting: "assets/sounds/fluffy_shitting.ogg",
  foal_chirp_1: "assets/sounds/foal_chirp_1.ogg",
  foal_chirp_2: "assets/sounds/foal_chirp_2.ogg",
  foal_chirp_3: "assets/sounds/foal_chirp_3.ogg",
  foal_chirp_4: "assets/sounds/foal_chirp_4.ogg",
  foal_death: "assets/sounds/foal_death.ogg",
  foal_peep: "assets/sounds/foal_peep.ogg",
  foal_scree: "assets/sounds/foal_scree.ogg",
  spray_bottle: "assets/sounds/spray_bottle.ogg",
  splashing: "assets/sounds/splash.mp3",
  thumbtack: "assets/sounds/thumbtack_sound.ogg",
  taser: "assets/sounds/taser.ogg",
  thud: "assets/sounds/thud.ogg",
};

let isMuted = false;
let masterVolume = 1.0;

function initAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

/**
 * Resumes the audio context. Should be called from a user interaction (e.g., click).
 */
function resumeAudioContext() {
  const ctx = initAudioContext();
  if (ctx.state === "suspended") {
    ctx
      .resume()
      .catch((e) => console.warn("Failed to resume AudioContext:", e));
  }
}

function loadSounds(onAllLoaded) {
  const totalSounds = Object.keys(soundSources).length;
  if (totalSounds === 0) {
    if (onAllLoaded) onAllLoaded();
    return;
  }

  let soundsLoadedCount = 0;
  const ctx = initAudioContext();

  for (const [key, src] of Object.entries(soundSources)) {
    fetch(src)
      .then((response) => response.arrayBuffer())
      .then((arrayBuffer) => ctx.decodeAudioData(arrayBuffer))
      .then((audioBuffer) => {
        sounds[key] = audioBuffer;
      })
      .catch((e) => {
        console.error(`Failed to load sound: ${src}`, e);
      })
      .finally(() => {
        soundsLoadedCount++;
        if (soundsLoadedCount === totalSounds) {
          if (onAllLoaded) onAllLoaded();
        }
      });
  }
}

function playSound(key, volume = 1.0, pitch = 1.0, loop = false) {
  if (isMuted) return null;

  const ctx = initAudioContext();
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
    return null;
  }

  if (sounds[key]) {
    const source = ctx.createBufferSource();
    source.buffer = sounds[key];
    source.loop = !!loop;

    // Pitch adjustment
    source.playbackRate.value = pitch;

    const gainNode = ctx.createGain();
    gainNode.gain.value = volume * masterVolume;

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    source.start(0);

    return {
      source,
      gainNode,
      stop() {
        try {
          source.stop();
          source.disconnect();
        } catch (e) {}
      },
    };
  }
  return null;
}

function startLoopingSound(key, volume = 1.0, pitch = 1.0) {
  return playSound(key, volume, pitch, true);
}

function stopSound(soundHandle) {
  if (soundHandle && typeof soundHandle.stop === "function") {
    soundHandle.stop();
  }
}

function toggleMute() {
  isMuted = !isMuted;
  return isMuted;
}
