// Animation states and their target numeric values
const ANIMATION_STATES = {
  IDLE: {
    bodyAngle: 0,
    headAngle: (-5 * Math.PI) / 180, // Slight perk up
    headBobSpeed: 2,
    headBobAmp: 0.5,
    bodyBobSpeed: 2,
    bodyBobAmp: 2,
    legSwingAmp: 0,
    tailSpeed: 2,
    tailAmp: 0.1,
    yOffset: 0,
  },
  MOVING: {
    bodyAngle: 0,
    headAngle: (-5 * Math.PI) / 180,
    headBobSpeed: 18,
    headBobAmp: 2,
    bodyBobSpeed: 18,
    bodyBobAmp: 5,
    legSwingAmp: (30 * Math.PI) / 180,
    tailSpeed: 5,
    tailAmp: 0.2,
    yOffset: 0,
  },
  RUNNING: {
    bodyAngle: (5 * Math.PI) / 180,
    headAngle: (-10 * Math.PI) / 180,
    headBobSpeed: 25,
    headBobAmp: 4,
    bodyBobSpeed: 25,
    bodyBobAmp: 8,
    legSwingAmp: (50 * Math.PI) / 180,
    tailSpeed: 10,
    tailAmp: 0.4,
    yOffset: 0,
  },
  EATING: {
    bodyAngle: 0,
    headAngle: (85 * Math.PI) / 180, // Way down to graze
    headBobSpeed: 3, // Slow grazing munch
    headBobAmp: 3, // Slight movement while eating
    bodyBobSpeed: 0,
    bodyBobAmp: 0,
    legSwingAmp: 0,
    tailSpeed: 1, // Relaxed tail
    tailAmp: 0.05,
    yOffset: 0,
  },
  VOMITING: {
    bodyAngle: 0,
    headAngle: (85 * Math.PI) / 180,
    headBobSpeed: 3,
    headBobAmp: 3,
    bodyBobSpeed: 0,
    bodyBobAmp: 0,
    legSwingAmp: 0,
    tailSpeed: 1,
    tailAmp: 0.05,
    yOffset: 0,
  },
  SITTING: {
    bodyAngle: -Math.PI / 2.5, // Sit back ~60 degrees
    headAngle: Math.PI / 3, // Look forward/slightly up relative to body
    headBobSpeed: 1.5,
    headBobAmp: 0.5,
    bodyBobSpeed: 1,
    bodyBobAmp: 1,
    legSwingAmp: 0,
    tailSpeed: 3,
    tailAmp: 0.15,
    yOffset: 15,
  },
  LYING: {
    bodyAngle: 0,
    headAngle: (-5 * Math.PI) / 180, // Head slightly up
    headBobSpeed: 1,
    headBobAmp: 0.2,
    bodyBobSpeed: 1,
    bodyBobAmp: 0.5,
    legSwingAmp: 0,
    tailSpeed: 1,
    tailAmp: 0.05,
    yOffset: 25,
  },
  // Watching TV lying down (racked or can't sit up): lying pose
  FOCUSING_LYING: {
    bodyAngle: 0,
    headAngle: (-5 * Math.PI) / 180, // Head raised toward the screen
    headBobSpeed: 1,
    headBobAmp: 0.2,
    bodyBobSpeed: 1,
    bodyBobAmp: 0.5,
    legSwingAmp: 0,
    tailSpeed: 1,
    tailAmp: 0.05,
    yOffset: 25,
  },
  FOCUSING: {
    bodyAngle: -Math.PI / 2.5, // Sit back ~60 degrees
    headAngle: Math.PI / 3, // Look forward/slightly up relative to body
    headBobSpeed: 1.5,
    headBobAmp: 0.5,
    bodyBobSpeed: 1,
    bodyBobAmp: 1,
    legSwingAmp: 0,
    tailSpeed: 3,
    tailAmp: 0.15,
    yOffset: 15,
  },
  BENDING: {
    bodyAngle: -Math.PI / 4,
    headAngle: Math.PI / 4,
    headBobSpeed: 2,
    headBobAmp: 0.5,
    bodyBobSpeed: 4,
    bodyBobAmp: 0,
    legSwingAmp: 0,
    tailSpeed: 4,
    tailAmp: 0.2,
    yOffset: 0,
  },
  BENDING_2: {
    bodyAngle: 0,
    headAngle: (-5 * Math.PI) / 180,
    headBobSpeed: 1,
    headBobAmp: 0.2,
    bodyBobSpeed: 1,
    bodyBobAmp: 0.5,
    legSwingAmp: 0,
    tailSpeed: 1,
    tailAmp: 0.05,
    yOffset: 25,
  },
  SLEEPING: {
    bodyAngle: 0,
    headAngle: (10 * Math.PI) / 180, // Head resting down
    headBobSpeed: 0.5, // Slow breathing
    headBobAmp: 0.5,
    bodyBobSpeed: 0.5,
    bodyBobAmp: 1,
    legSwingAmp: 0,
    tailSpeed: 0.2,
    tailAmp: 0.02,
    yOffset: 25,
  },
  FLUFFY_JAB: {
    bodyAngle: 0,
    headAngle: (-10 * Math.PI) / 180,
    headBobSpeed: 0,
    headBobAmp: 0,
    bodyBobSpeed: 0,
    bodyBobAmp: 0,
    legSwingAmp: 0,
    tailSpeed: 5,
    tailAmp: 0.2,
    yOffset: 0,
  },
  FLUFFY_STOMPIE: {
    bodyAngle: -Math.PI / 8,
    headAngle: (10 * Math.PI) / 180,
    headBobSpeed: 0,
    headBobAmp: 0,
    bodyBobSpeed: 0,
    bodyBobAmp: 0,
    legSwingAmp: 0,
    tailSpeed: 5,
    tailAmp: 0.2,
    yOffset: 0,
  },
  FLUFFY_KNOCKED_DOWN: {
    bodyAngle: 0,
    headAngle: (20 * Math.PI) / 180,
    headBobSpeed: 0,
    headBobAmp: 0,
    bodyBobSpeed: 0,
    bodyBobAmp: 0,
    legSwingAmp: 0,
    tailSpeed: 2,
    tailAmp: 0.1,
    yOffset: 0,
  },
  FLUFFY_BITE: {
    bodyAngle: 0,
    headAngle: (-30 * Math.PI) / 180, // Head swings UP
    headBobSpeed: 0,
    headBobAmp: 0,
    bodyBobSpeed: 0,
    bodyBobAmp: 0,
    legSwingAmp: 0,
    tailSpeed: 10,
    tailAmp: 0.4,
    yOffset: 0,
  },
  ATTEMPTING_EXCRETION: {
    bodyAngle: 0,
    headAngle: (-5 * Math.PI) / 180,
    headBobSpeed: 1,
    headBobAmp: 0.2,
    bodyBobSpeed: 1,
    bodyBobAmp: 0.5,
    legSwingAmp: 0,
    tailSpeed: 1,
    tailAmp: 0.05,
    yOffset: 25,
  },
  HUGGING: {
    bodyAngle: -Math.PI / 2.5, // Sit back ~60 degrees
    headAngle: Math.PI / 3, // Look forward/slightly up relative to body
    headBobSpeed: 1.5,
    headBobAmp: 0.5,
    bodyBobSpeed: 1,
    bodyBobAmp: 1,
    legSwingAmp: 0,
    tailSpeed: 3,
    tailAmp: 0.15,
    yOffset: 15,
  },
  DROWNING: {
    bodyAngle: -Math.PI / 2.5, // Sit back ~60 degrees
    headAngle: Math.PI / 3, // Look forward/slightly up relative to body
    headBobSpeed: 1.5,
    headBobAmp: 0.5,
    bodyBobSpeed: 1,
    bodyBobAmp: 1,
    legSwingAmp: 0,
    tailSpeed: 3,
    tailAmp: 0.15,
    yOffset: 15,
  },
};

// Watching TV, sitting up or lying down
function isFocusingState(stateKey) {
  return stateKey === "FOCUSING" || stateKey === "FOCUSING_LYING";
}

function canRun(f) {
  return (
    !f.isCrawling &&
    !f.isPregnant &&
    f.getLimbsMissing() === 0 &&
    !f.blockOnBack
  );
}

// Behavior transition logic
const BEHAVIOR_RULES = {
  IDLE: {
    getNextState: (f) => "IDLE",
    getDuration: () => 1.0 + Math.random() * 2.0,
  },
  EATING: {
    getNextState: (f) => "IDLE",
    getDuration: () => 2.0 + Math.random() * 4.0,
  },
  VOMITING: {
    getNextState: (f) => "IDLE",
    getDuration: () => 1.0,
  },
  MOVING: {
    getNextState: (f) => "IDLE",
    getDuration: () => 0,
  },
  RUNNING: {
    getNextState: (f) => "IDLE",
    getDuration: () => 0,
  },
  SITTING: {
    getNextState: (f) => "IDLE",
    getDuration: () => 4.0 + Math.random() * 6.0,
  },
  LYING: {
    getNextState: (f) => (f.happiness <= WAN_DIE_THRESHOLD ? "LYING" : "IDLE"),
    getDuration: () => 5.0 + Math.random() * 10.0,
  },
  BENDING: {
    getNextState: (f) => "IDLE",
    getDuration: () => 3,
  },
  BENDING_2: {
    getNextState: (f) => "IDLE",
    getDuration: () => 3,
  },
  SLEEPING: {
    getNextState: (f) => "IDLE",
    getDuration: () => 10.0 + Math.random() * 20.0,
  },
  FLUFFY_JAB: {
    getNextState: (f) => "IDLE",
    getDuration: () => 0.5,
  },
  FLUFFY_STOMPIE: {
    getNextState: (f) => "IDLE",
    getDuration: () => 0.5,
  },
  FLUFFY_KNOCKED_DOWN: {
    getNextState: (f) => "IDLE",
    getDuration: () => 0.5,
  },
  FLUFFY_BITE: {
    getNextState: (f) => "IDLE",
    getDuration: () => 0.5,
  },
  ATTEMPTING_EXCRETION: {
    getNextState: (f) => "IDLE",
    getDuration: () => 1 + 5 * Math.random(),
  },
  HUGGING: {
    getNextState: (f) => "IDLE",
    getDuration: () => 1 + 2 * Math.random(),
  },
  FOCUSING: {
    getNextState: (f) => "IDLE",
    getDuration: () => 30 + 30 * Math.random(),
  },
  FOCUSING_LYING: {
    getNextState: (f) => "IDLE",
    getDuration: () => 30 + 30 * Math.random(),
  },
  DROWNING: {
    getNextState: (f) => {
      if (f.drowningTimer > 0) return "DROWNING";
      return "IDLE";
    },
    getDuration: () => 0.1,
  },
};
