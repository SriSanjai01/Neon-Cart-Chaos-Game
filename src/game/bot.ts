import type { KartState } from './physics';
import type { TrackData } from './track';
import type { MsgInput } from '../shared/protocol';

export class BotController {
  private track: TrackData;
  private currentTargetIdx: number = 0;

  constructor(_clientId: string, track: TrackData) {
    this.track = track;
  }

  public getNextInput(kart: KartState, currentSeq: number): MsgInput {
    const input: MsgInput = {
      t: 'in',
      s: 0,
      g: 1, // always gas
      b: 0,
      d: 0,
      i: kart.lastInputSeq, // default to no new item use
      seq: currentSeq
    };

    if (kart.stunTicks > 0) {
      return input;
    }

    // Find nearest point on centerline
    let nearestDist = Infinity;
    let nearestIdx = 0;
    for (let i = 0; i < this.track.centerline.length; i++) {
      const pt = this.track.centerline[i];
      const dx = pt.x - kart.x;
      const dy = pt.y - kart.y;
      const dist = dx*dx + dy*dy;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    // Look ahead a few points
    const lookahead = 4;
    this.currentTargetIdx = (nearestIdx + lookahead) % this.track.centerline.length;
    const targetPt = this.track.centerline[this.currentTargetIdx];

    // Add some random noise so they weave slightly and aren't absolutely perfect
    const jitterX = (Math.random() - 0.5) * 40;
    const jitterY = (Math.random() - 0.5) * 40;

    const dx = (targetPt.x + jitterX) - kart.x;
    const dy = (targetPt.y + jitterY) - kart.y;
    const targetAngle = Math.atan2(dy, dx);
    
    // Normalize angles to compare
    let angleDiff = targetAngle - kart.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    // Steer towards target
    if (angleDiff > 0.1) {
      input.s = 1; // turn right
    } else if (angleDiff < -0.1) {
      input.s = -1; // turn left
    } else {
      input.s = angleDiff / 0.1; // soft turn
    }

    // Drift if turning sharply and moving fast
    if (Math.abs(angleDiff) > 0.5 && kart.speed > 10) {
      input.d = 1;
    }

    // Use item if we have one
    if (kart.heldItem) {
      // Small random chance to delay usage
      if (Math.random() > 0.95) {
        input.i = kart.lastInputSeq + 1;
      }
    }

    return input;
  }
}
