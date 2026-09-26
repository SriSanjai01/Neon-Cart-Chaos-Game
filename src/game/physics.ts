import { TUNING } from './tuning';
import type { MsgInput } from '../shared/protocol';

export interface KartState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;       // direction kart is facing
  speed: number;       // forward speed
  driftTicks: number;  // how long we've been drifting
  boost: number;       // current boost amount (decays over time)
  heldItem: string | null;
  shieldActive: boolean;
  stunTicks: number;
  lastInputSeq: number; // to detect new item usages
  currentSteer?: number;
  invisible?: boolean; // warp speed effect
  reverseSteerTicks?: number; // oil slick effect
}

export function updateKart(kart: KartState, input: MsgInput | null) {
  if (kart.stunTicks > 0) {
    kart.stunTicks--;
    // Slow down rapidly while stunned
    kart.speed *= 0.9;
    
    // Still apply physics (sliding) but no steering or gas
    kart.x += Math.cos(kart.angle) * kart.speed;
    kart.y += Math.sin(kart.angle) * kart.speed;
    return;
  }

  const brakeVal = (input && input.b > 0) ? input.b : 0;
  // Speed limits (including boost)
  const targetSpeed = TUNING.baseSpeed + kart.boost;
  
  if (brakeVal > 0) {
    kart.speed -= TUNING.accel * 3 * brakeVal; // Strong deceleration
    if (kart.speed < 0) kart.speed = 0; // stop completely, no reverse for now
  } else {
    // If we are below target speed, snap to it quickly
    if (kart.speed < targetSpeed) {
      kart.speed += TUNING.accel;
      if (kart.speed > targetSpeed) kart.speed = targetSpeed;
    } else if (kart.speed > targetSpeed) {
      // If we are above target speed (boost is decaying), slowly decay
      kart.speed *= 0.98; 
      if (kart.speed < targetSpeed) kart.speed = targetSpeed;
    }
  }

  // Hard clamp max speed just in case
  if (kart.speed > TUNING.maxSpeed) {
    kart.speed = TUNING.maxSpeed;
  }

  // Steering
  // Turn rate depends on speed so you can't spin in place
  const speedRatio = Math.min(1, Math.abs(kart.speed) / (TUNING.maxSpeed * TUNING.turnRateSpeedScale));
  
  // Apply drift logic
  let isDrifting = false;
  if (input && input.d > 0 && Math.abs(input.s) > TUNING.driftThreshold && kart.speed > TUNING.maxSpeed * 0.5) {
    isDrifting = true;
    kart.driftTicks++;
  } else {
    if (kart.driftTicks > TUNING.driftBoostTimes[0]) {
      // Fire mini-turbo
      let tier = 0;
      if (kart.driftTicks > TUNING.driftBoostTimes[2]) tier = 2;
      else if (kart.driftTicks > TUNING.driftBoostTimes[1]) tier = 1;
      
      kart.boost = Math.max(kart.boost, TUNING.driftBoostStrengths[tier]);
    }
    kart.driftTicks = 0;
  }

  // Turn angle (smoothed)
  if (kart.currentSteer === undefined) kart.currentSteer = 0;
  let targetSteer = input ? input.s : 0;
  
  // Apply oil slick reverse steering
  if (kart.reverseSteerTicks && kart.reverseSteerTicks > 0) {
    kart.reverseSteerTicks--;
    targetSteer = -targetSteer;
  }

  if (targetSteer !== 0) {
      if (Math.abs(targetSteer) === 1) {
          // Digital (Touch/Keyboard): Slow lerp so turning ramps up the longer you hold it
          kart.currentSteer += (targetSteer - kart.currentSteer) * 0.08;
      } else {
          // Analog (Tilt): Direct map to reduce latency
          kart.currentSteer = targetSteer; 
      }
  } else {
      // Center quickly when released
      kart.currentSteer *= 0.5;
      if (Math.abs(kart.currentSteer) < 0.01) kart.currentSteer = 0;
  }
  
  let turnAmount = kart.currentSteer * TUNING.turnRate * speedRatio;
  if (isDrifting) {
    // Drifting sharpens the turn slightly
    turnAmount *= 1.5;
  }
  
  if (kart.speed < 0) {
    // Reverse steering is inverted
    turnAmount = -turnAmount;
  }
  
  kart.angle += turnAmount;

  // Velocity update
  const forwardX = Math.cos(kart.angle);
  const forwardY = Math.sin(kart.angle);

  // If drifting, kart slides a bit sideways (not fully aligned with velocity)
  if (isDrifting) {
     kart.vx = kart.vx * 0.9 + forwardX * kart.speed * 0.1;
     kart.vy = kart.vy * 0.9 + forwardY * kart.speed * 0.1;
  } else {
     kart.vx = forwardX * kart.speed;
     kart.vy = forwardY * kart.speed;
  }

  // Position update
  kart.x += kart.vx;
  kart.y += kart.vy;

  // Boost decay
  if (kart.boost > 0) {
    kart.boost -= 0.5;
    if (kart.boost < 0) kart.boost = 0;
  }
}
