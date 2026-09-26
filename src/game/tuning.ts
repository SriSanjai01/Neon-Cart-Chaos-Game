export const TUNING = {
  // Acceleration & Speed
  baseSpeed: 7,
  accel: 0.5, // Used for recovering to base speed quickly
  reverseAccel: 0.1,
  maxSpeed: 15,
  maxReverseSpeed: -3,
  friction: 0.95,
  
  // Track Boundaries
  offRoadFriction: 0.85, // Heavy slowdown when off track
  maxOffRoadDistance: 600, // Teleport back if further than this
  
  // Steering
  turnRate: 0.06,
  turnRateSpeedScale: 0.6, // turn slower when going slow
  
  // Drift
  driftThreshold: 0.5, // steer input required to drift
  driftBoostTimes: [30, 60, 120], // ticks needed for short, med, long boost
  driftBoostStrengths: [12, 15, 20],
  
  // Collisions
  wallBounce: -0.5,
  kartBumpForce: 2,
  kartMass: 1,
  
  // Dimensions
  kartRadius: 15,
};
