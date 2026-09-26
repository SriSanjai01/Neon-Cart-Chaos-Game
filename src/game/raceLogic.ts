import type { TrackData } from './track';
import type { KartState } from './physics';

export interface RaceProgress {
  lap: number;
  nextCheckpoint: number;
  finished: boolean;
  finishTime: number | null;
  distanceToNext: number;
  racePosition: number; // 1st, 2nd, 3rd...
}

export class RaceManager {
  private track: TrackData;
  public progress: Map<string, RaceProgress> = new Map();
  private startTime: number = 0;
  private raceStarted: boolean = false;

  constructor(track: TrackData) {
    this.track = track;
  }

  init(clientIds: string[]) {
    this.raceStarted = false;
    for (const id of clientIds) {
      this.progress.set(id, {
        lap: 1,
        nextCheckpoint: 1, // Start at 1 (0 is finish line)
        finished: false,
        finishTime: null,
        distanceToNext: 0,
        racePosition: 1
      });
    }
  }

  startRace() {
    this.raceStarted = true;
    this.startTime = performance.now();
  }

  update(karts: Map<string, KartState>) {
    if (!this.raceStarted) return;
    // Check line intersections for checkpoints
    for (const [id, kart] of karts.entries()) {
      const p = this.progress.get(id);
      if (!p || p.finished) continue;

      const cp = this.track.checkpoints[p.nextCheckpoint];
      // Basic bounding box check for checkpoint crossing (simplified)
      // A robust implementation uses line segment intersection (kart previous pos -> current pos)
      // For now, simple distance check to checkpoint line center
      const cx = (cp.p1.x + cp.p2.x) / 2;
      const cy = (cp.p1.y + cp.p2.y) / 2;
      const dx = kart.x - cx;
      const dy = kart.y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      p.distanceToNext = dist;

      if (dist < this.track.width) {
        // Crossed!
        p.nextCheckpoint++;
        if (p.nextCheckpoint >= this.track.checkpoints.length) {
          p.nextCheckpoint = 0; // Wrap around to start/finish line
        }
        
        // If they just crossed checkpoint 0, it's a lap complete
        if (p.nextCheckpoint === 1) {
           p.lap++;
           if (p.lap > this.track.laps) {
             p.finished = true;
             p.finishTime = performance.now() - this.startTime;
           }
        }
      }
    }
    
    // Rank players
    const rankings = Array.from(this.progress.entries()).map(([id, p]) => {
      // higher score = further ahead
      // lap * 10000 + cp * 1000 - dist
      let score = p.lap * 10000 + p.nextCheckpoint * 1000;
      if (p.finished) score += 100000 - (p.finishTime || 0); // finished players are ranked by time
      else score -= p.distanceToNext;
      return { id, score };
    });
    
    rankings.sort((a, b) => b.score - a.score);
    
    rankings.forEach((r, i) => {
      this.progress.get(r.id)!.racePosition = i + 1;
    });
  }
}
