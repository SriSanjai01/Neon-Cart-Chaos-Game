import { updateKart } from './physics';
import type { KartState } from './physics';
import { TICK_MS } from '../shared/constants';
import { HostState } from '../host/hostState';
import { TUNING } from './tuning';
import { RaceManager } from './raceLogic';
import { AudioEngine } from '../audio/audioEngine';
import { BotController } from './bot';

export interface Projectile {
  x: number; y: number; vx: number; vy: number;
  ownerId: string; targetId: string | null;
  active: boolean; life: number;
  type: string;
}
export interface Mine {
  x: number; y: number; ownerId: string; active: boolean; timer: number; type: string;
}

export class GameEngine {
  private hostState: HostState;
  private lastTick: number = 0;
  private rafId: number = 0;
  public raceManager: RaceManager;
  public activeItemBoxes: {x: number, y: number, active: boolean, timer: number}[] = [];
  public projectiles: Projectile[] = [];
  public mines: Mine[] = [];
  public audio: AudioEngine;
  
  public karts: Map<string, KartState> = new Map(); // clientId -> KartState
  public bots: Map<string, BotController> = new Map();
  
  constructor(hostState: HostState, audio: AudioEngine) {
    this.hostState = hostState;
    this.audio = audio;
    this.raceManager = new RaceManager(this.hostState.track);
  }

  start() {
    this.initKarts();
    this.lastTick = performance.now();
    this.loop(this.lastTick);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
  }

  private initKarts() {
    let i = 0;
    const clients = [];
    
    // Init item boxes
    this.activeItemBoxes = this.hostState.track.itemBoxes.map(b => ({x: b.x, y: b.y, active: true, timer: 0}));
    
    for (const player of this.hostState.players) {
      if (player.connected) {
        const startPos = this.hostState.track.startGrid[i] || {x: 0, y: 0};
        this.karts.set(player.clientId, {
          x: startPos.x,
          y: startPos.y,
          vx: 0,
          vy: 0,
          angle: this.hostState.track.startAngle,
          speed: 0,
          driftTicks: 0,
          boost: 0,
          heldItem: null,
          shieldActive: false,
          stunTicks: 0,
          lastInputSeq: 0,
          currentSteer: 0
        });
        if (player.isBot) {
          this.bots.set(player.clientId, new BotController(player.clientId, this.hostState.track));
        }
        clients.push(player.clientId);
        i++;
      }
    }
    this.raceManager.init(clients);
  }

  private loop = (timestamp: number) => {
    let delta = timestamp - this.lastTick;
    
    // Prevent huge jumps if tab is backgrounded
    if (delta > 1000) {
      delta = TICK_MS;
    }
    
    let ticks = 0;
    while (delta >= TICK_MS) {
      this.tick();
      delta -= TICK_MS;
      this.lastTick += TICK_MS;
      
      ticks++;
      if (ticks > 10) {
         // Panic mode to prevent infinite loops if severely lagging
         this.lastTick = timestamp;
         break;
      }
    }
    
    // Render goes here!
    if (this.onRender) {
      this.onRender();
    }
    
    this.rafId = requestAnimationFrame(this.loop);
  };

  private tick() {
    // 0. Disable input if race hasn't started or player finished
    // 1. Update each kart physics
    for (const player of this.hostState.players) {
      const kart = this.karts.get(player.clientId);
      const prog = this.raceManager.progress.get(player.clientId);
      
      if (kart) {
        let input = player.lastInput || { t:'in', seq:0, s: 0, g: 0, b: 0, d: 0, i: kart.lastInputSeq };
        // If bot, run AI
        if (player.isBot) {
           const bot = this.bots.get(player.clientId);
           if (bot) {
             input = bot.getNextInput(kart, (input?.seq || 0) + 1);
           }
        }
        
        // Disable input if race not started or player finished
        if (!player.connected || !this.hostState || this.hostState.state !== 'RACING' || (prog && prog.finished)) {
           input = { t:'in', seq:0, s: 0, g: 0, b: 1, d: 0, i: kart.lastInputSeq };
        }
        if (input) {
           updateKart(kart, input);
        }
      }
    }
    
    // 2. Kart vs Kart Collisions
    const clients = Array.from(this.karts.keys());
    for (let i = 0; i < clients.length; i++) {
      for (let j = i + 1; j < clients.length; j++) {
        const k1 = this.karts.get(clients[i])!;
        const k2 = this.karts.get(clients[j])!;
        
        let dx = k2.x - k1.x;
        let dy = k2.y - k1.y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        let minDist = TUNING.kartRadius * 2;
        
        if (dist < minDist) {
           if (dist === 0) {
             // Add random jitter to separate them
             dx = (Math.random() - 0.5) * 0.1;
             dy = (Math.random() - 0.5) * 0.1;
             dist = Math.sqrt(dx*dx + dy*dy);
           }
           
           const overlap = minDist - dist;
           const nx = dx / dist;
           const ny = dy / dist;
           
           // Push apart
           k1.x -= nx * overlap * 0.5;
           k1.y -= ny * overlap * 0.5;
           k2.x += nx * overlap * 0.5;
           k2.y += ny * overlap * 0.5;
           
           // Momentum exchange (simplified)
           const dvx = k2.vx - k1.vx;
           const dvy = k2.vy - k1.vy;
           const dot = dvx * nx + dvy * ny;
           
           if (dot < 0) {
             const bounce = -0.5 * dot;
             k1.vx -= nx * bounce;
             k1.vy -= ny * bounce;
             k2.vx += nx * bounce;
             k2.vy += ny * bounce;
           }
        }
      }
    }
    
    // 3. Update Race Logic
    this.raceManager.update(this.karts);
    
    // 4. Item boxes logic
    for (const box of this.activeItemBoxes) {
      if (!box.active) {
        box.timer++;
        if (box.timer > 180) { // respawn after 3 seconds
          box.active = true;
          box.timer = 0;
        }
        continue;
      }
      
      for (const kart of this.karts.values()) {
        const dx = kart.x - box.x;
        const dy = kart.y - box.y;
        if (dx*dx + dy*dy < 900) { // hit box (radius ~30)
          box.active = false;
          this.audio.playItemPickup();
          if (!kart.heldItem) {
            // Assign item based on pos (simple random for now)
            const items = ['TURBO', 'SHIELD', 'MISSILE', 'MINE', 'FIREBALL', 'LIGHTNING', 'OIL_SLICK', 'WARP_SPEED', 'FAKE_BOX', 'TORNADO'];
            kart.heldItem = items[Math.floor(Math.random() * items.length)];
          }
        }
      }
    }
    
    // 5. Item usage
    for (const player of this.hostState.players) {
      const kart = this.karts.get(player.clientId);
      if (kart && player.lastInput) {
        if (player.lastInput.i > kart.lastInputSeq) {
          kart.lastInputSeq = player.lastInput.i;
          if (kart.heldItem) {
            // Use it
            if (kart.heldItem === 'TURBO') {
               kart.boost += 30;
            } else if (kart.heldItem === 'WARP_SPEED') {
               kart.boost += 150;
               kart.invisible = true;
               setTimeout(() => { kart.invisible = false; }, 3000);
            } else if (kart.heldItem === 'SHIELD') {
               kart.shieldActive = true;
               setTimeout(() => { kart.shieldActive = false; }, 5000);
            } else if (kart.heldItem === 'MINE' || kart.heldItem === 'FAKE_BOX' || kart.heldItem === 'OIL_SLICK') {
               this.mines.push({
                 x: kart.x - Math.cos(kart.angle) * TUNING.kartRadius * 2,
                 y: kart.y - Math.sin(kart.angle) * TUNING.kartRadius * 2,
                 ownerId: player.clientId,
                 active: true,
                 timer: 0,
                 type: kart.heldItem
               });
            } else if (kart.heldItem === 'LIGHTNING') {
               let firstPlaceId = null;
               for (const [id, prog] of this.raceManager.progress.entries()) {
                 if (prog.racePosition === 1) {
                   firstPlaceId = id; break;
                 }
               }
               if (firstPlaceId && firstPlaceId !== player.clientId) {
                 const targetKart = this.karts.get(firstPlaceId);
                 if (targetKart && !targetKart.invisible) {
                   targetKart.shieldActive = false;
                   targetKart.stunTicks = 90;
                   targetKart.speed = 0;
                   targetKart.boost = 0;
                   targetKart.heldItem = null;
                 }
               }
            } else if (kart.heldItem === 'MISSILE' || kart.heldItem === 'FIREBALL' || kart.heldItem === 'TORNADO') {
               const myProg = this.raceManager.progress.get(player.clientId);
               let targetId: string | null = null;
               if (kart.heldItem === 'MISSILE' && myProg) {
                 for (const [otherId, otherProg] of this.raceManager.progress.entries()) {
                   if (otherProg.racePosition === myProg.racePosition - 1) {
                     targetId = otherId; break;
                   }
                 }
               }
               let speed = kart.heldItem === 'FIREBALL' ? 40 : (kart.heldItem === 'TORNADO' ? 10 : 25);
               this.projectiles.push({
                 x: kart.x + Math.cos(kart.angle) * TUNING.kartRadius * 2,
                 y: kart.y + Math.sin(kart.angle) * TUNING.kartRadius * 2,
                 vx: Math.cos(kart.angle) * speed,
                 vy: Math.sin(kart.angle) * speed,
                 ownerId: player.clientId,
                 targetId: targetId,
                 active: true,
                 life: kart.heldItem === 'FIREBALL' ? 150 : (kart.heldItem === 'TORNADO' ? 400 : 300),
                 type: kart.heldItem
               });
            }
            kart.heldItem = null;
          }
        }
      }
    }
    
    // 6. Projectiles update
    for (const p of this.projectiles) {
      if (!p.active) continue;
      p.life--;
      if (p.life <= 0) p.active = false;
      
      // Homing logic (Missile only)
      if (p.type === 'MISSILE' && p.targetId) {
        const target = this.karts.get(p.targetId);
        if (target) {
           const dx = target.x - p.x;
           const dy = target.y - p.y;
           const dist = Math.sqrt(dx*dx + dy*dy);
           if (dist > 0) {
             const speed = 20;
             const targetVx = (dx / dist) * speed;
             const targetVy = (dy / dist) * speed;
             p.vx += (targetVx - p.vx) * 0.05; // steer towards target
             p.vy += (targetVy - p.vy) * 0.05;
           }
        }
      }
      
      // Tornado wandering logic
      if (p.type === 'TORNADO') {
         p.vx += (Math.random() - 0.5) * 2;
         p.vy += (Math.random() - 0.5) * 2;
         const speed = Math.sqrt(p.vx*p.vx + p.vy*p.vy);
         if (speed > 10) {
            p.vx = (p.vx / speed) * 10;
            p.vy = (p.vy / speed) * 10;
         }
      }

      p.x += p.vx;
      p.y += p.vy;
      
      // Projectile Wall Collisions (Fireball bounces)
      if (p.type === 'FIREBALL') {
        let minDist2 = Infinity;
        let nearestPt = {x: 0, y: 0};
        
        for (let i = 0; i < this.hostState.track.centerline.length; i++) {
          const p1 = this.hostState.track.centerline[i];
          const p2 = this.hostState.track.centerline[(i+1)%this.hostState.track.centerline.length];
          const l2 = (p2.x - p1.x)**2 + (p2.y - p1.y)**2;
          let t = 0;
          if (l2 !== 0) t = Math.max(0, Math.min(1, ((p.x - p1.x) * (p2.x - p1.x) + (p.y - p1.y) * (p2.y - p1.y)) / l2));
          const projX = p1.x + t * (p2.x - p1.x);
          const projY = p1.y + t * (p2.y - p1.y);
          const d2 = (p.x - projX)**2 + (p.y - projY)**2;
          if (d2 < minDist2) { minDist2 = d2; nearestPt = {x: projX, y: projY}; }
        }
        
        const dist = Math.sqrt(minDist2);
        const boundaryDist = 100; // trackWidth / 2
        
        if (dist > boundaryDist) {
          const nx = (p.x - nearestPt.x) / dist;
          const ny = (p.y - nearestPt.y) / dist;
          const dot = p.vx * nx + p.vy * ny;
          p.vx -= 2 * dot * nx;
          p.vy -= 2 * dot * ny;
          p.x += nx * (dist - boundaryDist + 1);
          p.y += ny * (dist - boundaryDist + 1);
        }
      }

      // Collision with karts
      for (const [clientId, kart] of this.karts.entries()) {
        if (clientId === p.ownerId && p.life > 280) continue; // immunity briefly
        if (kart.invisible) continue; // invincible to items
        
        const dx = kart.x - p.x;
        const dy = kart.y - p.y;
        // Tornado has larger hit radius
        const hitRadius = p.type === 'TORNADO' ? TUNING.kartRadius * 4 : TUNING.kartRadius * 2;
        if (dx*dx + dy*dy < hitRadius * hitRadius) {
           if (p.type !== 'TORNADO') p.active = false;
           if (kart.shieldActive) {
             kart.shieldActive = false;
           } else {
             if (p.type === 'TORNADO') {
               kart.stunTicks = 60;
               kart.speed *= 0.5;
               kart.angle += 0.5; // spin them
             } else if (p.type === 'FIREBALL') {
               kart.stunTicks = 60;
               kart.speed = 0;
               kart.boost = 0;
             } else { // Missile
               kart.stunTicks = 60;
               kart.boost = 0;
             }
           }
        }
      }
    }
    
    // 7. Mine & Hazard logic
    for (const m of this.mines) {
      if (!m.active) continue;
      m.timer++;
      
      if (m.type === 'OIL_SLICK' && m.timer > 600) {
        m.active = false; // oil slick dissipates after 10 seconds
        continue;
      }
      
      for (const [clientId, kart] of this.karts.entries()) {
        // Give the owner 1 second (60 ticks) of immunity so they don't hit their own mine instantly
        if (clientId === m.ownerId && m.timer < 60) continue;
        if (kart.invisible) continue;
        
        const dx = kart.x - m.x;
        const dy = kart.y - m.y;
        if (dx*dx + dy*dy < TUNING.kartRadius * TUNING.kartRadius * 4) {
           if (m.type === 'OIL_SLICK') {
              // Oil slick doesn't pop shield, it just makes you slip
              kart.reverseSteerTicks = 150; // 2.5 seconds of reversed steering
              kart.speed *= 0.8;
           } else { // MINE or FAKE_BOX
             m.active = false;
             if (kart.shieldActive) {
               kart.shieldActive = false; // consume shield
             } else {
               kart.stunTicks = 90; // 1.5 second stun
               kart.boost = 0;
             }
           }
        }
      }
    }
    
    // 8. Track Collisions (Off-road & Rescue)
    const trackWidth = 200; // Visual width is roughly 200
    for (const kart of this.karts.values()) {
       let minDist2 = Infinity;
       let nearestPt = {x: 0, y: 0};
       
       for (let i = 0; i < this.hostState.track.centerline.length; i++) {
         const p1 = this.hostState.track.centerline[i];
         const p2 = this.hostState.track.centerline[(i+1)%this.hostState.track.centerline.length];
         
         const l2 = (p2.x - p1.x)**2 + (p2.y - p1.y)**2;
         let t = 0;
         if (l2 !== 0) {
             t = Math.max(0, Math.min(1, ((kart.x - p1.x) * (p2.x - p1.x) + (kart.y - p1.y) * (p2.y - p1.y)) / l2));
         }
         
         const projX = p1.x + t * (p2.x - p1.x);
         const projY = p1.y + t * (p2.y - p1.y);
         const dx = kart.x - projX;
         const dy = kart.y - projY;
         const d2 = dx*dx + dy*dy;
         
         if (d2 < minDist2) {
           minDist2 = d2;
           nearestPt = {x: projX, y: projY};
         }
       }
       
       const dist = Math.sqrt(minDist2);
       const boundaryDist = trackWidth / 2;
       
       if (dist > boundaryDist) {
         // Solid Wall Collision!
         const dx = nearestPt.x - kart.x;
         const dy = nearestPt.y - kart.y;
         const overlap = dist - boundaryDist;
         const nx = dx / dist;
         const ny = dy / dist;
         
         // Push kart back into the track
         kart.x += nx * overlap;
         kart.y += ny * overlap;
         
         // Heavily penalize speed for hitting the wall
         kart.speed *= 0.8;
         kart.boost = 0; // instantly kill any active boost
       }
    }
  }

  public onRender: (() => void) | null = null;
}
